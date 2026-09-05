# VIRA — Documentação Técnica (resumo)

> App comportamental anti-procrastinação (marca VIRA, tagline "Transforme intenção em
> ação."). Cópia em pt-BR, mobile-first, PWA. Nenhuma tela decorativa: todo botão
> persiste no backend real (Enter Cloud).

## 1. Stack

- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS (design system em tokens em
  `src/index.css`), React Router 7, TanStack Query (hooks de dados), react-i18next.
- **Backend**: Enter Cloud (banco Postgres + autenticação + backend functions). Sem
  backend próprio no frontend; nenhum mock.
- **IA**: Enter AI (gateway `api.enter.pro`), modelos via protocolo OpenAI Chat
  Completions. Modelos em uso: Qwen 3.8 Max (assistente), GPT 5.6 Luna (personalização).
- **Analytics**: `@enter-pro/analytics-sdk` (Enter Analytics) — eventos registrados no
  backend e emitidos via `trackEvent`.

## 2. Arquitetura de pastas (frontend)

```
src/
  pages/        Rotas (auth, onboarding, Index/home, stuck, session, tasks, dashboard,
                settings, profile, plans, assistant, notifications, NotFound)
  components/   AppShell (navegação), GuardedRoute, ErrorBoundary, EmptyState,
                PageSpinner, language-switcher, ui/* (design system)
  hooks/        use-auth, use-profile, use-tasks, use-sessions, use-checkin, use-privacy,
                use-push, use-notifications, use-subscription, use-intentions,
                use-dashboard, use-personalization, use-ai-chat, use-timer
  lib/data/     Repositórios tipados sobre o cliente Supabase (única camada que o chama)
  lib/metrics/  Funções puras de métricas (metrics, dashboard)
  lib/intervention/ Motor de intervenção (regras + seletor personalizado)
  lib/personalization/ Contexto do usuário para IA
  lib/plan/     Gerador de plano SE → ENTÃO
  lib/behaviors/ Perfis de procrastinação e insights
  lib/feedback.ts  logError/handleError padronizados
  router.tsx    Rotas com code-splitting (React.lazy + Suspense)
```

Regra: **páginas nunca chamam o cliente Supabase diretamente** — sempre via `lib/data/*`
e hooks. Isso centraliza consultas, invalidação (TanStack Query) e a troca de backend.

## 3. Fluxo de dados principal

```
Home (energia) ──► energy_checkins
Estou travado ──► sessions + session_obstacles (até 3) ──► pickPersonalized (IA, fallback regras)
              ──► intervention_results (accepted=true) ──► analytics (obstacles_selected, intervention_applied)
Sessão de foco ──► sessions.status/actual_start + session_events(task_started)
Check-in ──► focus_sessions (accomplished, intervention_helped, feeling) + sessions.status final
         ──► intervention_results.outcome final + analytics (session_completed/abandoned)
Dashboard ──► sessions + session_obstacles + focus_sessions (filtros por período)
Personalização ──► sessões + check-ins → contexto → função intervention-select (GPT 5.6 Luna)
```

Métricas: Taxa de iniciação, Tempo até a ação (LTA), Taxa de conclusão, Recovery rate,
eficácia por intervenção, obstáculos/horários mais comuns — tudo derivado das mesmas
tabelas (`src/lib/metrics/*`), funções puras testadas.

## 4. Banco de dados (Enter Cloud)

Todas as tabelas têm **RLS owner-scoped** (`user_id = auth.uid()`); catálogos
(`obstacles`, `interventions`) legíveis por qualquer usuário autenticado. Tabelas
principais: `profiles` (inclui `preferences` jsonb), `goals`, `tasks`, `sessions`,
`session_events`, `session_obstacles`, `intervention_results`, `implementation_intentions`,
`energy_checkins`, `focus_sessions`, `behavior_patterns`, `experiments(assignments)`,
`notifications`, `push_subscriptions`, `subscriptions`, `consents`, `privacy_settings`,
`audit_logs`. Migrações em `supabase/migrations/` (aplicadas pelo tool de migração).

Nunca editar `src/integrations/supabase/client.ts` e `types.ts` (gerados pelo framework).

## 5. Serviços reutilizáveis

- `lib/data/*` — CRUD tipado (única camada de acesso).
- `lib/metrics/metrics.ts` + `dashboard.ts` — métricas puras.
- `lib/intervention/engine.ts` — regras determinísticas (votação + desempate) + `buildPlan`.
- `lib/intervention/personalized.ts` — `pickPersonalized`: IA com fallback determinístico
  (nunca bloqueia o fluxo); `ruleId` grava proveniência (`model:gpt-5.6-luna` vs `rules_v2`).
- `lib/personalization/context.ts` — agrega dados reais para o prompt da IA.
- `lib/feedback.ts` — `logError`/`handleError` (toast + console; analytics captura erros).

## 6. Backend functions

| Função | Responsabilidade |
|---|---|
| `assistant-chat` | Assistente IA (Qwen 3.8 Max, SSE streaming, detecção de crise → CVV 188, fallback por regras) |
| `intervention-select` | Personalização (GPT 5.6 Luna, JSON, valida código no servidor) |
| `delete-account` | Exclui linhas do usuário (ordem de dependência) + `auth.admin.deleteUser` |

Padrões: `Deno.serve`, CORS/OPTIONS, sem SQL cru (só client queries), secrets via
`Deno.env.get`, log suficiente para diagnóstico.

## 7. Integrações

- **Enter Cloud**: banco, auth (email+senha, auto-confirm), storage, backend functions.
- **Enter Analytics**: eventos registrados e emitidos via SDK (`session_started`,
  `session_completed`, `session_abandoned`, `obstacles_selected`, `intervention_applied`).
- **Enter AI**: modelo do assistente e da personalização; chave em
  `AI_API_TOKEN_feaa78ccc1f0`; cabeçalhos `X-Enter-Project-ID` e `X-Session-ID`.
- **Push (PWA)**: `public/sw.js` + `manifest.webmanifest`; assinatura real só quando
  VAPID estiver configurado (hoje VAPID vazio → UI honesta "push ainda não configurado").

## 8. Pontos preparados para evolução

- **IA no motor**: interface `InterventionSelector` + `pickPersonalized` com fallback —
  trocar modelo = mudar `MODEL`/`MODEL_TAG` (sem tocar no fluxo).
- **Experimentos**: tabelas `experiments`/`experiment_assignments` prontas; `ruleId`
  permite comparar regras vs modelo.
- **Push real**: coletar chave VAPID (secreto) e ativar assinatura.
- **Pagamentos**: tabela `subscriptions` + UI de plano existem; integrar Stripe quando
  chegar a hora (hoje card informativo, sem cobrança).
- **i18n**: estrutura i18next pronta (manifesto em `i18n.config.json`, `public/locales/`);
  hoje a cópia é pt-BR; adicionar outros idiomas = novos arquivos de locale.
- **Analytics**: mais eventos podem ser registrados no registry para personalização e
  experimentos futuros.
