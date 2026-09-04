# VIRA — MVP V1: arquitetura, schema e execução incremental

## Contexto

O usuário (pt-BR) validou: **continuar em React + Vite, mobile-first, PWA**. Nada de React Native/Expo. Requisitos explícitos:

- Código **modular em TypeScript**; **backend real** (auth, banco, RLS, migrations, backend functions).
- **Nenhuma tela ilustrativa nem botão sem função** — todo fluxo grava/ler no Enter Cloud. Única exceção: paywall (estados free/premium reais no banco, mas upgrade sem cobrança real — documentado).
- **Apresentar arquitetura, estrutura de pastas, schema do banco e migrations ANTES de implementar telas**; depois implementar em etapas incrementais.
- Marca **"VIRA"** (nome e texto visíveis); identificadores de código **neutros** (app, user, task, session, intervention, dashboard, auth, settings) — branding desacoplado.
- **IA real já incluída**: chatbot LLM (decisão anterior: modelo `alibaba/qwen-3.8-max`, protocolo `openai_chat_completions`, streaming SSE), backend function no Enter Cloud.

### Estado já concluído (não refazer)
- Enter Cloud habilitado; **IA habilitada** (secret `AI_API_TOKEN_*` disponível via `Deno.env.get`).
- **Migration `supabase/migrations/migration_20260903_032004000` aplicada**: 20 tabelas + RLS owner-scoped + catálogos seed (12 obstáculos, 8 intervenções) + triggers (`handle_new_user`, `ensure_subscription`, `ensure_privacy`, `set_updated_at`).
- Auth configurado: email+password, signup habilitado, **auto-confirm ativo**, sem providers sociais.
- `src/integrations/supabase/client.ts` + `types.ts` gerados (tipado com `Database`, contém as tabelas). **Nunca editar** (framework regrava).
- i18n: `public/locales/en.json` é o recurso editável do preview (contém a copy "VIRA"); `src/pages/Index.tsx` é a Home atual (placeholder a ser substituído).

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│ UI (mobile-first)  pages/ · components/ · hooks/            │
│   React Router · React Query · shadcn/ui · Tailwind tokens  │
├─────────────────────────────────────────────────────────────┤
│ Domínio (TS puro, sem UI, testável)                         │
│   lib/intervention · lib/metrics · lib/behaviors · lib/plan │
├─────────────────────────────────────────────────────────────┤
│ Dados (acesso tipado)  lib/data/*  sobre o client supabase  │
│   RLS garante isolamento por dono no banco                  │
├─────────────────────────────────────────────────────────────┤
│ Backend (Enter Cloud)                                       │
│   Postgres (tabelas+RLS+triggers) · Auth · backend funcs    │
│   functions/assistant-chat  functions/send-push             │
└─────────────────────────────────────────────────────────────┘
```

Princípios:
- **Camada de domínio independente da UI**: engine de intervenção e métricas são funções puras (`lib/`), testáveis com Vitest.
- **Toda persistência via client tipado do supabase** (RLS no banco, nunca no cliente). Sem SQL cru em backend function.
- **Sem mock funcional**: cada tela usa queries/mutations reais. Botões sempre executam ações reais (ou navegam).

---

## Estrutura de pastas (a criar)

```
src/
  main.tsx / App.tsx / router.tsx        # entrada, providers, rotas (neutras)
  index.css                              # tokens dark premium + cor de ação
  analytics.ts                           # bootstrap do @enter-pro/analytics-sdk
  lib/
    utils.ts                             # cn() (existe)
    intervention/  types.ts · catalog.ts · engine.ts · engine.test.ts
    metrics/       metrics.ts · metrics.test.ts
    behaviors/     patterns.ts           # insights por regras (melhor horário, top obstáculo…)
    plan/          suggestions.ts        # sugestão de planos SE→ENTÃO
    data/          profiles.ts · tasks.ts · sessions.ts · events.ts
                   checkins.ts · notifications.ts · subscriptions.ts
                   patterns.ts · catalogs.ts · consents.ts · push.ts
    ai/            chat.ts               # cliente SSE (fetch-event-source)
  hooks/
    use-auth.ts · use-profile.ts · use-tasks.ts · use-sessions.ts
    use-ai-chat.ts · use-checkin.ts · use-dashboard.ts · use-push.ts
  components/
    app-shell.tsx                        # bottom nav mobile + header
    guarded-route.tsx                    # redireciona não-autenticado para /auth
    ui/                                  # shadcn (existe) + variantes novas
  pages/
    Index.tsx                            # Home real (próxima ação + "ESTOU TRAVADO")
    auth/index.tsx                       # login/cadastro (email+password)
    onboarding/index.tsx                 # perfil + tipo de procrastinação por regras
    tasks/index.tsx · tasks/new.tsx      # CRUD com decomposição + primeiro passo
    stuck/index.tsx                      # fluxo 2 passos → intervenção → sessão
    session/[id].tsx                     # modo foco + check-in pós-sessão + recovery
    dashboard/index.tsx                  # métricas + relatório semanal
    profile/index.tsx                    # privacidade · planos (paywall) · SE→ENTÃO
    assistant/index.tsx                  # chat IA
    NotFound.tsx                         # existe
supabase/
  functions/assistant-chat/index.ts      # chat LLM (stream) + crise + fallback
  functions/send-push/index.ts           # web push (VAPID via secret)
public/
  sw.js                                  # service worker (push + notificationclick)
  manifest.webmanifest                   # PWA instalável
  locales/en.json                        # recurso i18n editável (copy VIRA, pt-BR)
```

---

## Schema do banco (JÁ migrado — nenhuma migration nova no MVP)

`supabase/migrations/migration_20260903_032004000` cria 20 tabelas. RLS em todas: owner = `user_id = auth.uid()`; catálogos `obstacles`/`interventions` com policy de leitura para `authenticated`.

| Tabela | Papel no fluxo |
|---|---|
| `profiles` | nome, horários, dias de trabalho, meta principal, `procrastination_profile`, `onboarding_completed` |
| `goals` | metas (categoria) |
| `tasks` | título, `first_step`, `scheduled_at`, `duration_min`, status |
| `sessions` | `planned_start`/`actual_start`, status, `obstacle_code`, `intervention_code`, `energy` |
| `session_events` | `task_started`/`completed`/`abandoned`/`recovery_*` (base das métricas) |
| `obstacles` (seed 12) | catálogo do passo ② do fluxo travado |
| `interventions` (seed 8) | catálogo da engine |
| `intervention_results` | o que foi mostrado/aceito → personalização |
| `implementation_intentions` | planos SE→ENTÃO |
| `energy_checkins` | energia 1–5 + contexto |
| `focus_sessions` | duração real do modo foco |
| `behavior_patterns` | insights gerados por regras |
| `experiments` / `experiment_assignments` | estrutura A/B (UI futura; tabelas prontas) |
| `notifications` / `push_subscriptions` | centro in-app + push |
| `subscriptions` | free/premium (paywall mock) |
| `consents` / `privacy_settings` | LGPD |
| `audit_logs` | trilha de ações |

Ajustes futuros (registrados, **não** executados no MVP): índices adicionais, view SQL agregada de métricas, coluna de expiração de push.

---

## Decisões-chave

- **Auth**: email+password (login/cadastro), auto-confirm; padrão `onAuthStateChange` registrado **antes** de checar sessão; `signUp` com `emailRedirectTo = origin`; rotas protegidas por `GuardedRoute`.
- **Engine de intervenção** (`lib/intervention`): TS puro, determinística; mapa obstáculo→intervenção (task_too_big/no_start_point/tired/no_motivation → micro_start; phone/distracted → distraction_removal; anxious/fear_of_failure/perfectionism → cognitive_restructuring; no_environment → restructuring; bad_time → replan; other → micro_start) + mensagens/CTA pt-BR; testes unitários.
- **Métricas** (`lib/metrics`): funções puras — taxa de iniciação (started/planned), LTA (actual_start − planned_start), taxa de conclusão, recovery rate; dashboard consome `lib/data` + regras de `behavior_patterns`.
- **Paywall**: estados reais em `subscriptions` (free/premium via botão "assinar" que grava premium + `audit_logs`); **sem cobrança real** — única exceção de mock, documentada na tela.
- **IA**: backend function `assistant-chat` (protocolo `openai_chat_completions`, model `alibaba/qwen-3.8-max`, streaming SSE); system prompt pt-BR curto orientado à ação, sem diagnóstico; **screen de crise** (frases de sofrimento → orienta ajuda profissional/CVV 188 e encerra fluxo); **fallback por regras** se o LLM falhar. Frontend: `@microsoft/fetch-event-source` (nova dependência) + hook `use-ai-chat` + página `/assistant`.
- **Notificações**: centro in-app (`notifications`) + lembretes adaptativos (se ignora → reduz frequência); push via `sw.js` + `push_subscriptions` + backend function `send-push` (VAPID via secret — a pedir via modal); limitação iOS documentada.
- **i18n**: `en.json` continua sendo o recurso editável do preview (fluxo atual do usuário não quebra). Ao final, `enter_i18n` skill adiciona `pt-BR` como idioma padrão sem quebrar o preview.
- **Analytics**: eventos mínimos da spec §31 via `@enter-pro/analytics-sdk` (skill `enter_analytics`), sem conteúdo sensível.

---

## Fases incrementais (cada fase: lint + tsc + build + verificação visual mobile)

1. **Fundação**: tokens dark premium + cor de ação âmbar em `index.css`/`tailwind.config.ts`; `AppShell` (bottom nav mobile); rotas neutras em `router.tsx`; `GuardedRoute`; página `/auth` funcional (login/cadastro/logout); estado de sessão no React Query (`use-auth`).
2. **Domínio + dados**: `lib/intervention/*` + testes; `lib/metrics/*` + testes; repos `lib/data/*` tipados (sem UI nova).
3. **Onboarding → Tarefas → Home**: `/onboarding` grava `profiles` e gera `procrastination_profile` por regras; `/tasks` CRUD real (decomposição + `first_step` + `scheduled_at`); Home mostra próxima ação + primeiro passo + check-in de energia + CTA **ESTOU TRAVADO**.
4. **Fluxo travado → Sessão**: `/stuck` (atividade → obstáculo → intervenção → CTA começar) cria `sessions`(planned)+`intervention_results`; `/session/:id` modo foco (cronômetro opcional, pausar/encerrar) grava `focus_sessions` + `session_events`; check-in pós-sessão; recovery "salvar o dia" (5/15/30 min) sem culpa.
5. **Dashboard**: taxa de iniciação, LTA, conclusão, recovery; relatório semanal; `behavior_patterns` (melhor horário, top obstáculo, duração ideal) gerados e exibidos.
6. **Perfil/privacidade/paywall**: consentimentos e exportação/exclusão de dados (LGPD); tela de planos (paywall mock real); planos SE→ENTÃO (`implementation_intentions`) com sugestão por regras.
7. **Assistente IA**: dependência `@microsoft/fetch-event-source`; backend function `assistant-chat` + deploy; página `/assistant` com streaming, screen de crise e fallback.
8. **Notificações + analytics**: `sw.js` + PWA manifest; centro in-app; push (VAPID); instrumentação mínima via skill `enter_analytics`.
9. **Encerramento**: `pt-BR` padrão via skill `enter_i18n`; Vitest rodando; `pnpm lint` + `pnpm exec tsc --noEmit` + `pnpm run build` limpos; polimento visual (mobile 390 + desktop 1280).

---

## Implementation checklist

- [ ] Fase 1: tokens dark premium + cor de ação em `src/index.css`/`tailwind.config.ts`
- [ ] Fase 1: `src/components/app-shell.tsx` (bottom nav: Home, Tarefas, Dashboard, Assistente, Perfil)
- [ ] Fase 1: rotas neutras registradas em `src/router.tsx` (auth, onboarding, tasks, stuck, session/:id, dashboard, profile, assistant)
- [ ] Fase 1: `GuardedRoute` redireciona não-autenticado para `/auth`
- [ ] Fase 1: `/auth` — login/cadastro/logout funcionais (auto-confirm), estado no `use-auth`
- [ ] Fase 2: `lib/intervention` (types, catalog 8, engine) + testes passando
- [ ] Fase 2: `lib/metrics` (initiation, LTA, completion, recovery) + testes passando
- [ ] Fase 2: repos `lib/data/*` para profiles, tasks, sessions, events, checkins, notifications, subscriptions, catalogs, consents, push
- [ ] Fase 3: `/onboarding` grava perfil + `procrastination_profile` por regras + `onboarding_completed`
- [ ] Fase 3: `/tasks` CRUD real (criar com decomposição/`first_step`/`scheduled_at`, editar, concluir, excluir)
- [ ] Fase 3: Home real: próxima ação + primeiro passo + mini check-in energia (1–5) + CTA **ESTOU TRAVADO**
- [ ] Fase 4: `/stuck` 2 passos → intervenção da engine → `sessions`(planned) + `intervention_results` + `session_events`
- [ ] Fase 4: `/session/:id` — iniciar, pausar, encerrar, cronômetro opcional; grava `focus_sessions`
- [ ] Fase 4: check-in pós-sessão + recovery 5/15/30 ("salvar o dia") sem culpa
- [ ] Fase 5: Dashboard com 4 métricas + relatório semanal + `behavior_patterns`
- [ ] Fase 6: Perfil: consentimentos, exportação, exclusão de dados; paywall mock real; planos SE→ENTÃO + sugestão
- [ ] Fase 7: backend function `assistant-chat` (LLM stream + crise CVV 188 + fallback por regras) e deploy
- [ ] Fase 7: página `/assistant` com streaming (`@microsoft/fetch-event-source`) e screen de crise
- [ ] Fase 8: `public/sw.js` + `manifest.webmanifest`; centro in-app; push (VAPID via secret); eventos analytics mínimos
- [ ] Fase 9: `pt-BR` padrão via skill `enter_i18n`; Vitest (engine + metrics); lint/tsc/build limpos

## Verification checklist

- [ ] Build: `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm run build` e `pnpm test` sem erros
- [ ] Positivo: cadastro → onboarding → criar tarefa com primeiro passo → Home mostra próxima ação → "ESTOU TRAVADO" → obstáculo → intervenção → sessão inicia → check-in grava → dashboard mostra taxa de iniciação/LTA/recovery
- [ ] Positivo: chat IA responde em stream curto e orientado à ação; frase de crise → resposta de segurança (CVV 188) e fluxo interrompido
- [ ] Positivo: paywall — conta free vê premium bloqueado; "assinar" (mock) grava `subscriptions.plan = premium` e desbloqueia
- [ ] Negativo/default: não logado → redirecionado a `/auth`; rotas protegidas bloqueiam
- [ ] Negativo/default: falha do LLM → fallback por regras responde sem quebrar
- [ ] Fronteira: energia 1/5 → sessão mínima sugerida; 5/5 → sessão normal
- [ ] Fronteira: RLS — outro usuário autenticado não lê dados alheios (select retorna vazio)
- [ ] Manual no preview: fluxo mobile (bottom nav), dark theme, contraste AA, copy pt-BR direta e adulta (sem chaves i18n vazadas, sem emojis)
