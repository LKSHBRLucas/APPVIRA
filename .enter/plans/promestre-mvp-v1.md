# ProMestre — MVP V1: app adaptativo contra procrastinação

## Contexto

O usuário entregou uma especificação completa (70 seções) de um produto de intervenção comportamental contra procrastinação. A proposta central: o app **identifica o obstáculo** que impede o usuário de começar uma tarefa e **seleciona uma intervenção** (baseada em ciência comportamental / BCT Taxonomy) para reduzir a barreira e gerar o primeiro comportamento. Não é um todo-list, nem um Pomodoro, nem um habit tracker.

Decisões confirmadas com o usuário:
- **Escopo**: MVP V1 completo — arquitetura, banco (todas as entidades), auth, onboarding, tarefas, fluxo "ESTOU TRAVADO", motor de intervenção (8 intervenções), sessão/modo foco, check-ins (energia + pós-sessão), dashboard com métricas, paywall mockado.
- **IA**: chatbot com LLM real já nesta entrega (habilitar capacidade de IA do backend).
- **Idioma**: pt-BR padrão.
- **Notificações**: in-app + push do navegador (service worker + backend).

**Restrição de plataforma (documentada):** o ambiente Enter suporta somente React + Vite + Tailwind + TypeScript (web). A especificação permite alternativa equivalente mobile-first, então construímos um **web app mobile-first** (responsivo, instalável via manifest) — **não** React Native/Expo. Bloqueio de apps do sistema é impossível na web: entregamos alternativa honesta (modo foco + checklist de remoção de distrações + orientação), nunca prometendo bloqueio real.

**Nome/tagline propostos:** ProMestre — "Comece antes que sua mente negocie." (provavelmente ajustável no perfil/branding futuro).

---

## Conflitos identificados na especificação (e resoluções)

1. **React Native + Expo exigido** → não suportado pelo ambiente → web app mobile-first + PWA manifest (alternativa prevista na própria spec §32).
2. **Bloqueio de distrações nativo (Android/iOS)** → impossível na web → modo foco com checklist "remova o celular / coloque em outro cômodo" + cronômetro opcional; documentado como limitação.
3. **Offline-first total** → MVP usa cache local (localStorage para tarefas do dia + persistência do React Query) e sincroniza com o backend; limitação documentada.
4. **IA "não inventar evidências / não diagnosticar"** → system prompt restrito no backend function + respostas curtas orientadas à ação + screen de segurança psicológica (crise → orienta ajuda, CVV 188, interrompe fluxo normal).
5. **Analytics mínimo vs. rastreamento de eventos** → registrar apenas eventos de produto da lista §31, sem conteúdo sensível.
6. **Preço R$ 24,90/mês** → paywall mockado com estados free/premium e estrutura de `subscriptions` para testar preços depois.

---

## Arquitetura

- **Frontend**: React 19 + Vite + Tailwind + TypeScript, mobile-first, dark premium. React Query (dados), React Router (rotas), shadcn/ui.
- **Backend**: Enter Cloud — Postgres, Auth, RLS, backend functions (chat IA, push).
- **IA**: backend function `chat` com LLM (protocolo do skill `enter_llm_integration`; seleção de modelo com o usuário antes de codar), fallback por regras se o LLM falhar.
- **Motor de intervenção**: TypeScript puro e determinístico (regras), testável, em `src/lib/intervention/`.
- **Métricas**: funções puras em `src/lib/metrics/` (LTA, taxa de iniciação, taxa de conclusão, recovery rate) + views SQL agregadas para o dashboard.
- **Analytics**: infra já existente (`@enter-pro/analytics-sdk`, `src/analytics.ts`); instrumentar eventos da spec §31 via skill `enter_analytics`.
- **i18n**: infra já existente (i18next); adicionar **pt-BR como fallback/idioma padrão** (editar `i18n.config.json` + `public/locales/pt-BR.json`; workflow do skill `enter_i18n`).

---

## Banco de dados (migrations + RLS + seeds)

Todas as tabelas com RLS (dono = `auth.uid()`), criadas via ferramenta de migração do skill `enter_cloud`. Trigger `handle_new_user` cria `profiles`.

| Tabela | Colunas principais |
|---|---|
| `profiles` | user_id (PK=FK auth), nome, timezone, onboarded_at, plano (free/premium) |
| `goals` | user_id, título, categoria (study/training/project/reading/organizing/other), alvo |
| `tasks` | user_id, goal_id?, título, categoria, first_step, scheduled_at, duration_min, status, prioridade |
| `sessions` | user_id, task_id?, planned_start, actual_start, status (planned/started/completed/abandoned/recovered), duration_planned, duration_actual, obstacle_code, intervention_code |
| `session_events` | session_id, type (task_started/completed/abandoned/recovery_*), occurred_at |
| `obstacles` | code, label, group (seed de 12) |
| `interventions` | code, name, mechanism, indication, contraindication, context, duration, description (seed de 8) |
| `intervention_results` | session_id, intervention_code, shown_at, accepted, outcome |
| `implementation_intentions` | user_id, if_part, then_part, trigger, ativo |
| `energy_checkins` | user_id, level (1–5), context, checked_at |
| `focus_sessions` | session_id, started_at, ended_at, duration |
| `behavior_patterns` | user_id, pattern_type, data (jsonb), generated_at |
| `experiments` | user_id, name, arm_a, arm_b, status (cria a estrutura; UI em iteração futura) |
| `experiment_assignments` | experiment_id, session_id, arm |
| `notifications` | user_id, type, title, body, sent_at, opened_at, status |
| `push_subscriptions` | user_id, endpoint, keys, created_at |
| `subscriptions` | user_id, plan, status, started_at, trial_end? |
| `consents` | user_id, type, granted_at, version |
| `privacy_settings` | user_id, settings (jsonb) |
| `audit_logs` | user_id, action, created_at |

Seeds: 12 obstacles + 8 interventions (catálogo completo com mecanismo/indicação/contraindicação).

---

## Motor de intervenção (regras → 8 intervenções)

`src/lib/intervention/catalog.ts` + `engine.ts` + `types.ts`. Mapeamento obstáculo → intervenção:

| Obstáculo | Intervenção |
|---|---|
| tarefa grande / complexidade | MICRO-START (5–15 min) + decompor |
| não sei por onde começar | PRIMEIRO PASSO (ação física e observável) |
| celular / distraído | REMOÇÃO DE DISTRAÇÃO (modo foco + checklist) |
| cansado / energia baixa | MICRO-START (reduzir demanda, sessão mínima) |
| sem vontade | MICRO-START (não depender de motivação) |
| perfeccionismo | REESTRUTURAÇÃO COGNITIVA BREVE (versão mínima aceitável) |
| ansioso / medo de errar | REESTRUTURAÇÃO COGNITIVA BREVE + PRIMEIRO PASSO |
| ambiente inadequado | REESTRUTURAÇÃO (alterar ambiente) |
| horário inadequado | REPLANEJAMENTO (mover atividade) |
| falhei antes | RECOVERY (recuperar sessão, sem punição) |

Saída da engine: `{ intervention, message, ctaLabel, firstStep?, sessionPlan? }` em pt-BR. Cada resultado gravado em `intervention_results` (alimenta personalização futura e `behavior_patterns`).

---

## Fluxo de navegação (rotas)

`/` Home → `#estou-travado` é o fluxo prioritário da spec (§66):

- `/` **Home**: "O que devo fazer agora?" + próxima ação + primeiro passo + [COMEÇAR] + botão grande **[ESTOU TRAVADO]** + próximas atividades + mini check-in de energia
- `/auth` login/cadastro
- `/onboarding` onboarding curto (~5–8 perguntas; perfil de procrastinação gerado)
- `/stuck` fluxo "ESTOU TRAVADO": ① atividade → ② obstáculo → ③ intervenção + [COMEÇAR]
- `/session/:id` modo foco (só a tarefa atual, cronômetro opcional, pausar/encerrar) → check-in pós-sessão
- `/tasks` lista + criação com decomposição ("o que exatamente você vai fazer?") + primeiro passo
- `/dashboard` métricas: taxa de iniciação, LTA, conclusão, recovery + **relatório semanal** ("Seu padrão esta semana")
- `/profile` configurações: privacidade (consentimentos, exportação/exclusão de dados), planos (paywall mock), planos SE→ENTÃO (implementation intentions), notificações
- `/assistant` chatbot IA (curto, orientado à ação, com screen de crise)
- Admin dashboard, experimentos ("Teste seu método"), bloqueio nativo: **adiados** (roadmap V1.1/V2), documentados como fora do escopo — sem botões "em breve" falsos.

---

## Componentes principais

`AppShell` (bottom nav mobile), `StuckFlow` (stepper), `InterventionCard`, `SessionView` (modo foco), `EnergyPicker`, `TaskItem`/`TaskForm` (com decomposição), `MetricCard`/`MetricGrid`, `WeeklyReport`, `PaywallSheet`, `AssistantChat`, `NotificationCenter`. Páginas em subpastas por feature (convenção do `CodeGuideline.md`).

---

## IA — chatbot

- Habilitar capacidade de IA (`enable_ai_capability`) após Enter Cloud; carregar skill `enter_llm_integration` e **apresentar seleção de modelo ao usuário** antes de codar.
- Backend function `chat`: system prompt pt-BR curto e orientado à ação (nunca motivacional genérico, nunca diagnóstico); detecção de frases de crise → resposta de segurança (orienta ajuda profissional, CVV 188, encerra o fluxo normal); fallback por regras se o LLM falhar.
- Sem persistência de conversa no MVP (minimização de dados), documentado.

## Notificações

- `public/sw.js` (service worker: push + notificationclick) + manifest PWA.
- In-app: centro de notificações em `notifications` + lembretes adaptativos ("você planejou estudar às 21h; primeiro passo: abrir a aula 3"; se ignora muitas, reduzir frequência).
- Push: subscription no navegador (`push_subscriptions`) + backend function `send-push` (Web Push/VAPID). Chaves VAPID via `supabase_add_secret` (modal ao usuário). Limitação iOS Safari documentada.

---

## Design system

Tokens em `src/index.css` + `tailwind.config.ts` (dark premium, mobile-first):
- Fundo escuro (`--background` ~224 22% 5%), `--card`/`--popover` derivados; `--foreground` alto contraste.
- Cor de ação `--primary` âmbar/laranja (gatilho de ação, não "gamificação"), com `--primary-foreground` escuro (AA).
- Gradientes e sombras como tokens (`--gradient-primary`, `--shadow-glow`); `--radius` maior; tipografia com fonte variável (adicionar via dependência, fallback system stack).
- Estados: `Estou travado` em destaque (variação de botão), nunca texto branco em variante outline (pitfall conhecido).

---

## Fases de execução

1. Habilitar **Enter Cloud** (`supabase_enable`) → carregar skill `enter_cloud`; habilitar **capacidade de IA** (`enable_ai_capability`) → skill `enter_llm_integration`.
2. Migrations (todas as tabelas + RLS + seeds) + cliente Supabase (`src/integrations/supabase/client.ts`).
3. Auth (login/cadastro/logout, estado de sessão, rotas protegidas).
4. Design system + AppShell + roteamento.
5. Onboarding (perfil de procrastinação por regras).
6. Tarefas (decomposição + primeiro passo + agendamento).
7. Home (próxima ação, energia, "Estou travado").
8. Fluxo "ESTOU TRAVADO" (2 passos + eventos de analytics).
9. Motor de intervenção (engine + catálogo + testes unitários).
10. Sessão/modo foco + check-ins (pós-sessão, energia).
11. Dashboard + relatório semanal (métricas: iniciação, LTA, conclusão, recovery; `behavior_patterns`).
12. Paywall mockado (free/premium, `subscriptions`).
13. Chatbot IA (backend function + UI + screen de crise + fallback).
14. Notificações (in-app + service worker + push; VAPID via secrets).
15. Perfil/privacidade (consentimentos, exportação/exclusão de dados, LGPD).
16. Analytics (eventos da spec §31 via skill `enter_analytics`).
17. i18n pt-BR padrão (skill `enter_i18n`).
18. Testes, lint, build, polimento visual.

---

## Riscos técnicos

- Web não bloqueia apps → limitação honesta já prevista.
- Push web: depende de permissão do usuário e VAPID; iOS Safari não suporta bem → fallback in-app.
- IA: custo por uso e latência; fallback por regras garante funcionamento.
- Template sem test runner → adicionar Vitest para testar engine e métricas.
- Offline: cache parcial apenas (localStorage/React Query persist).

---

## Implementation checklist

- [ ] `supabase_enable` aprovado pelo usuário; skill `enter_cloud` carregado
- [ ] `enable_ai_capability` aprovado; skill `enter_llm_integration` carregado; **seleção de modelo apresentada e confirmada com o usuário**
- [ ] Migrations criadas para todas as entidades da spec (20 tabelas) com RLS owner-scoped e trigger de `profiles`
- [ ] Seeds de 12 obstacles e 8 interventions com mecanismo/indicação/contraindicação
- [ ] Cliente Supabase em `src/integrations/supabase/client.ts` (sem edição manual posterior)
- [ ] Auth: login, cadastro, logout, guard de rotas, estado de sessão no React Query
- [ ] Design tokens em `index.css`/`tailwind.config.ts` (dark premium, cor de ação, mobile-first)
- [ ] `AppShell` com bottom nav mobile e rotas registradas em `src/router.tsx`
- [ ] Onboarding funcional (grava perfil, gera tipo de procrastinação por regras, marca onboarded)
- [ ] Tarefas: criação com decomposição + primeiro passo + horário; CRUD real no backend
- [ ] Home: próxima ação, primeiro passo, check-in de energia (1–5), CTA "ESTOU TRAVADO"
- [ ] Fluxo `/stuck`: ① atividade ② obstáculo ③ intervenção → cria `session` (status planned) e grava eventos
- [ ] Engine de intervenção em `src/lib/intervention/` (catálogo + regras obstáculo→intervenção) + testes unitários
- [ ] Sessão/modo foco `/session/:id`: tarefa atual, cronômetro opcional, pausar/encerrar, check-in pós-sessão (começou? concluiu? / o que aconteceu?)
- [ ] Salvar o dia (recovery): sessões perdidas geram oferta 5/15/30 min ou encerrar conscientemente, sem culpa/streak
- [ ] Dashboard: taxa de iniciação, LTA (planejado→início), conclusão, recovery; relatório semanal ("Seu padrão esta semana")
- [ ] `behavior_patterns`: insights por regras (melhor horário, maior obstáculo, duração com maior iniciação) gravados e exibidos
- [ ] Implementation intentions (planos SE→ENTÃO): CRUD + sugestão por regras a partir de padrões
- [ ] Paywall mock: estados free/premium, tela de assinatura, `subscriptions` (sem pagamento real)
- [ ] Chatbot IA: backend function `chat` (LLM + screen de crise + fallback por regras) e UI `/assistant`
- [ ] Notificações: service worker, centro in-app, lembretes adaptativos, push (VAPID via secrets) com fallback honesto
- [ ] Perfil/privacidade: consentimentos, exportação de dados, exclusão de conta/dados, política e termos
- [ ] Analytics: eventos da spec §31 instrumentados via skill `enter_analytics` (mínimos, sem conteúdo sensível)
- [ ] i18n: pt-BR como idioma padrão (`i18n.config.json` + `public/locales/pt-BR.json`)
- [ ] Vitest adicionado; testes de engine + métricas passando
- [ ] `pnpm lint` e `pnpm run build` passando
- [ ] Limitações documentadas (plataforma web, bloqueio de apps, offline, push iOS) — sem botões "em breve" falsos

## Verification checklist

- [ ] Build: `pnpm run build` conclui sem erros; lint sem erros; testes unitários passam (`pnpm test`)
- [ ] Positivo: cadastro → onboarding → criar tarefa com primeiro passo → Home mostra próxima ação → "ESTOU TRAVADO" → obstáculo "tarefa grande" → intervenção MICRO-START com CTA → sessão inicia → check-in pós-sessão grava → dashboard mostra taxa de iniciação/LTA/recovery
- [ ] Positivo: chat IA responde curto e orientado à ação; frase de crise ("não aguento mais") → resposta de segurança (CVV 188), fluxo normal interrompido
- [ ] Positivo: paywall mostra premium bloqueado em conta free e desbloqueia em premium (mock)
- [ ] Negativo/default: usuário não logado redirecionado para `/auth`; rotas protegidas bloqueiam
- [ ] Negativo/default: sessão perdida → oferta de recuperação sem culpa; streak não zerado/não exibido como métrica principal
- [ ] Fronteira: energia 1/5 → sessão mínima sugerida; energia 5/5 → sessão normal; notificações ignoradas → frequência reduzida
- [ ] Fronteira: RLS — query direta de outro usuário retorna vazio; SQL de tabelas `auth`/`storage` intocadas
- [ ] Manual no preview: fluxo mobile (bottom nav), dark theme, contraste AA, texto 100% pt-BR (sem chaves i18n vazadas)
