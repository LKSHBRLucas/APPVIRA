# VIRA — Fase de Produção: estabilização, configurações, documentação e preparação para beta

## Contexto

O app está funcional (auth, onboarding, tarefas, fluxo "Estou travado" com motor de
intervenção determinístico + personalização por IA, modo foco, check-in, dashboard,
assistente com IA, analytics). Falta a fase de produção: remover sobras de template e
mock, padronizar erros/loading/mensagens, validar formulários, proteger contra ações
duplicadas, melhorar performance e responsividade, criar a tela de Configurações,
documentar a arquitetura e deixar tudo pronto para testes beta/publicação.

Decisões confirmadas com o usuário:
- Nova tela **/settings** como hub (Perfil, Preferências, Notificações, Privacidade);
  item "Ajustes" na navegação; `/profile` continua (Plano + Intenções SE→ENTÃO),
  acessível por atalho nas Configurações.
- **Excluir conta** incluído na Privacidade, via função de backend real, com
  confirmação em duas etapas.
- Remover o **mock do paywall** (upgrade/cancelar sem Stripe) — vira card informativo.

## 1. Limpeza — remover mock, componentes e dependências não utilizados

### Mock
- `src/pages/profile/index.tsx`: remover upgrade/cancel de plano (mock). Manter leitura
  real de `subscriptions`; exibir card estático "Plano Gratuito — pagamentos em breve".
- `src/pages/NotFound.tsx`: remover `console.error` cru e cores cruas (`bg-gray-100`,
  `text-blue-500`); restilizar com tokens do design system.

### Componentes shadcn não utilizados (0 imports em código de app) — deletar
`src/components/ui/`: accordion, alert, alert-dialog, aspect-ratio, avatar, breadcrumb,
calendar, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer,
dropdown-menu, form, hover-card, input-otp, menubar, navigation-menu, pagination, popover,
progress, radio-group, resizable, scroll-area, sheet, sidebar, slider, table, tabs,
textarea, toast, toaster, toggle, toggle-group, tooltip, use-toast.
Manter: button, input, label, card, switch, select, sonner, skeleton, badge, separator
(badge/separator/skeleton passam a ser usados na nova tela de Configurações).

### Hooks órfãos — deletar
- `src/hooks/use-toast.ts`, `src/hooks/use-mobile.tsx`.

### App.tsx
- Remover `<Toaster />` (Radix) e `TooltipProvider` (tooltip excluído); manter Sonner.

### Dependências (pnpm remove) — sem referência após a limpeza
- UI: recharts, framer-motion, vaul, cmdk, input-otp, embla-carousel-react,
  react-resizable-panels, react-day-picker, @hookform/resolvers, react-hook-form, zod
- Radix: @radix-ui/react-{accordion, alert-dialog, aspect-ratio, avatar, checkbox,
  collapsible, context-menu, dialog, dropdown-menu, hover-card, menubar,
  navigation-menu, popover, progress, radio-group, scroll-area, slider, tabs, toggle,
  toggle-group, tooltip, toast}
- Manter: next-themes (usado pelo sonner), date-fns (usado em páginas), @tanstack/react-query,
  @enter-pro/analytics-sdk, @supabase/supabase-js, i18next, sonner, lucide-react,
  @microsoft/fetch-event-source.

## 2. Padronizar erros, loading e mensagens

### Novo utilitário `src/lib/feedback.ts`
- `logError(context, error)`: `console.error` com contexto (para o SDK de analytics
  capturar automaticamente o erro via evento `error`).
- `handleError(t, error, fallbackKey)`: `logError` + `toast.error(t(fallbackKey))`.

### Error Boundary `src/components/error-boundary.tsx`
- Classe com `componentDidCatch` → `logError` + fallback visual com tokens e botão
  "Recarregar". Montado em `src/App.tsx` envolvendo o app.

### Loading consistente
- Usar `src/components/ui/skeleton.tsx` (existe) no lugar dos `animate-pulse` avulsos em
  dashboard, tasks, home, notifications.
- `src/components/page-spinner.tsx` (spinner central, tokens) para loading de página
  (guarded-route, lazy routes, session).

### Empty state consistente `src/components/empty-state.tsx`
- Card pontilhado com ícone + texto + CTA opcional; substituir os blocos inline de
  empty em tasks, notifications, dashboard, plans, profile.

### i18n
- Adicionar chave genérica `errors.default` ("Não deu certo. Tente de novo.") e usá-la
  como fallback em todos os catch.

## 3. Validação de formulários e proteção contra ações duplicadas

Padrão em todo handler assíncrono: guard de `saving`/`submitting`, `try/catch/finally`
resetando o guard, `handleError` no catch, botão `disabled` enquanto pendente.

- `src/pages/auth/index.tsx`: validar e-mail (regex) e senha (mín. 8 no signup) com
  mensagens por campo antes do submit; `handleSubmit` já tem guard.
- `src/pages/onboarding/index.tsx`: `try/catch/finally` no `next` (hoje sem catch — erro
  deixaria `saving=true` travado).
- `src/pages/tasks/new.tsx`: validar título (não vazio), duração (1–480, mensagem se
  inválido em vez de clamp silencioso), `scheduled_at` válido; `try/catch/finally`.
- `src/pages/stuck/index.tsx`: `handleStart` com try/catch (hoje sem); `handleAnalyze` já
  tem try/finally.
- `src/pages/profile/index.tsx`: `handleCreateIntention` com try/catch/finally.
- `src/pages/session/index.tsx`: já protegido (guards + try/catch) — manter.
- Home (energy check-in): impedir duplo envio do mesmo nível enquanto a mutation está
  pendente.
- `src/hooks/use-tasks.ts`/`use-sessions.ts` etc.: mutations já invalidadas; sem mudanças.

## 4. Performance

- **Code-splitting**: `src/router.tsx` — converter imports de páginas para
  `React.lazy(() => import(...))` + `Suspense` com `PageSpinner`. Helper
  `lazyRoute(import)` em `src/router.tsx`. Reduz o bundle inicial (~1.4 MB hoje).
- `src/pages/session/index.tsx` e dashboard: manter memoizações existentes.

## 5. Responsividade, acessibilidade e consistência visual

- Adicionar `focus-visible:ring-2 focus-visible:ring-ring` a botões custom:
  chips de obstáculo (stuck), chips de check-in e sensação (session), energia (home),
  filtro de período (dashboard), tabs (profile/settings).
- `src/pages/NotFound.tsx`: restilizar com tokens (já citado).
- Revisar páginas em `mobile_390` e `desktop_1280` (dashboard, settings, stuck) com
  screenshots após implementação.

## 6. Tela de Configurações (`/settings`)

### Banco
- Migração: `alter table public.profiles add column preferences jsonb not null default '{}'::jsonb`
  (armazena `default_focus_min`). Aplicar via `supabase_migration` (tipos regeneram;
  nunca editar `types.ts`).

### Função de backend `delete-account` (nova)
- `supabase/functions/delete-account/index.ts`: com JWT do usuário, deleta as linhas de
  todas as tabelas com `user_id` do usuário (ordem dependência: session_obstacles,
  intervention_results, focus_sessions, session_events, sessions, tasks, goals,
  energy_checkins, implementation_intentions, behavior_patterns, notifications,
  push_subscriptions, subscriptions, consents, privacy_settings, audit_logs,
  experiment_assignments, experiments, profiles) e então `supabase.auth.admin.deleteUser(uid)`.
  Sem SQL cru — só client queries. Deploy via `supabase_deploy_edge_function`.
  Conferir convenções em `enter_cloud/references/edge-functions.md` antes de escrever.

### Dados/hooks
- `src/hooks/use-privacy.ts`: `getPrivacySettings` + `updatePrivacySettings`
  (funções já existem em `src/lib/data/consents.ts`).
- Reutilizar: `useProfile` (update), `usePush`, `setConsent`/`listConsents`,
  `updatePrivacySettings`, `useSessions`/`useTasks`/`useIntentions`/`listFocusSessions`
  para o export.

### Página `src/pages/settings/index.tsx` (tabs: Perfil / Preferências / Notificações / Privacidade)
- **Perfil**: nome (Input, validação não-vazio ≤80), objetivo principal (Select com
  opções; grava `main_goal`), card informativo do perfil de procrastinação
  (`deriveInsights`+`dominantProfile` dos dados reais), atalho "Plano e intenções"
  → `/profile`.
- **Preferências**: idioma (`LanguageSwitcher` existente), duração padrão de foco
  (1–120, grava `preferences.default_focus_min`) — e usar esse default em
  `tasks/new` e onboarding.
- **Notificações**: notificações no app (Switch → `privacy_settings.notifications_enabled`),
  push (Switch → `usePush.subscribe/unsubscribe`, com copy honesto quando VAPID vazio).
- **Privacidade**: consentimentos (`behavioral_data_for_product`, `research_consent`,
  `notifications` via `privacy_settings`/`consents`), exportar dados (estende o export
  atual com intenções e check-ins), sair, **excluir conta** (confirmação em 2 etapas
  inline → `supabase.functions.invoke("delete-account")` → `signOut` → `/auth`).

### Navegação e perfil
- `src/components/app-shell.tsx`: último item da nav → `/settings` (label "Ajustes",
  ícone `Settings`).
- `src/router.tsx`: rota `/settings`.
- `src/pages/profile/index.tsx`: remover aba "privacidade" (consents/export/sair foram
  para settings) e o mock do paywall; manter Plano (card informativo) + Intenções.

### i18n
- Novas chaves em `public/locales/en.json`: settings.*, errors.default, tasks.validação,
  auth.validation.* etc. (todas em pt-BR, conforme padrão atual).

## 7. Documentação técnica

- `docs/architecture.md` (nova, resumida): visão geral, stack, arquitetura de pastas
  (pages → hooks → lib/data → Enter Cloud), fluxo de dados principal (travado →
  sessão → check-in → dashboard/personalização/analytics), banco (20+ tabelas + RLS
  owner-scoped), serviços (metrics, dashboard, intervention, personalization),
  integrações (Enter Cloud, backend functions assistant-chat/intervention-select/
  delete-account, Enter Analytics, AI capability), pontos de evolução (IA já plugada via
  `InterventionSelector`, experimentos, push real com VAPID, Stripe, i18n pt-BR/en).

## 8. Preparação beta

- `pnpm check` (lint+tsc), `pnpm test` (56 testes hoje + novos do feedback/settings se
  aplicar), `pnpm build` limpos após todas as remoções.
- Verificar PWA (public/sw.js, manifest.webmanifest) intactos.
- Sem console.log no código; erros via `logError`.

## Arquivos críticos
- Deletar: ~39 arquivos `src/components/ui/*`, `src/hooks/use-toast.ts`,
  `src/hooks/use-mobile.tsx`
- Criar: `src/lib/feedback.ts`, `src/components/error-boundary.tsx`,
  `src/components/page-spinner.tsx`, `src/components/empty-state.tsx`,
  `src/hooks/use-privacy.ts`, `src/pages/settings/index.tsx`,
  `supabase/functions/delete-account/index.ts`, `docs/architecture.md`
- Editar: `src/App.tsx`, `src/router.tsx`, `src/components/app-shell.tsx`,
  `src/pages/{auth,onboarding,tasks/new,profile,stuck,tasks,Index,dashboard,notifications,NotFound}.tsx`,
  `public/locales/en.json`, `package.json`

## Checklist de implementação
- [ ] Remover mock do paywall em `src/pages/profile/index.tsx` (card estático "Plano Gratuito")
- [ ] Restilizar `src/pages/NotFound.tsx` com tokens e `logError` (sem cores cruas/console cru)
- [ ] Deletar os 39 arquivos `src/components/ui/*` não utilizados e os 2 hooks órfãos
- [ ] Remover `<Toaster/>` (Radix) e `TooltipProvider` de `src/App.tsx`; manter Sonner
- [ ] `pnpm remove` das dependências listadas (UI + Radix); `pnpm check` + `pnpm build` limpos
- [ ] Criar `src/lib/feedback.ts` (`logError`, `handleError`) e usar nos catches das páginas
- [ ] Criar `src/components/error-boundary.tsx` e envolvê-lo em `src/App.tsx`
- [ ] Usar `Skeleton` nos loadings de dashboard, tasks, home, notifications
- [ ] Criar `src/components/page-spinner.tsx` e `src/components/empty-state.tsx`; substituir empty states inline (tasks, notifications, dashboard, plans)
- [ ] Validações: auth (email/senha), tasks/new (título, duração 1–480, data), onboarding (try/finally), stuck `handleStart`, profile intenção (try/finally), energia (guard de duplo clique)
- [ ] Code-splitting: `React.lazy` + `Suspense` em `src/router.tsx`
- [ ] `focus-visible` em chips/botões custom (stuck, session, home, dashboard, tabs)
- [ ] Migração `profiles.preferences jsonb` aplicada via `supabase_migration`
- [ ] Escrever `supabase/functions/delete-account/index.ts` e fazer deploy
- [ ] Criar `src/hooks/use-privacy.ts`
- [ ] Criar `src/pages/settings/index.tsx` com 4 abas funcionais e persistindo de verdade
- [ ] Nav: `src/components/app-shell.tsx` aponta para `/settings`; rota em `src/router.tsx`
- [ ] Slim de `src/pages/profile/index.tsx` (Plano informativo + Intenções + atalho settings)
- [ ] `tasks/new` e onboarding usam `preferences.default_focus_min` como padrão
- [ ] Chaves i18n novas em `public/locales/en.json`
- [ ] Criar `docs/architecture.md`

## Checklist de verificação
- [ ] `pnpm check` (lint + tsc) sem erros
- [ ] `pnpm test` verde (mantém os 56 testes atuais; novos se adicionados)
- [ ] `pnpm build` sem erros (aviso de chunk deve sumir ou cair com code-splitting)
- [ ] Sem import quebrado após deletar componentes (grep por `@/components/ui/<deletado>` retorna 0 em código de app)
- [ ] Erro simulado em mutation mostra toast `errors.default` e `console.error` contextual; `saving` sempre reseta em `finally`
- [ ] Botões de submit ficam `disabled` enquanto pendentes (auth, onboarding, tasks/new, stuck, settings, perfil)
- [ ] `/settings` renderiza 4 abas; nome/objetivo persistem em `profiles`; duração padrão persiste em `preferences`
- [ ] Excluir conta: confirmação em 2 etapas → função exclui linhas e conta → redireciona `/auth`
- [ ] `/profile` sem aba privacidade e sem mock de upgrade; atalho para settings
- [ ] NotFound estilizado com tokens
- [ ] Screenshots mobile_390 e desktop_1280 das rotas afetadas (dashboard, settings, stuck, home) sem overflow/quebra
- [ ] PWA: `public/sw.js` e `manifest.webmanifest` intactos
