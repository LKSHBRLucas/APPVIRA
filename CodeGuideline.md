# Code Guideline

## Project Structure Overview

```
project-root/
  ├── i18n.config.json       # i18n manifest for supported locales and language metadata
  ├── public/
  │   ├── locales/           # public/locales/{code}.json translation files
  │   ├── manifest.webmanifest  # PWA manifest
  │   └── sw.js              # Service worker (push + notification click)
  ├── src/
  │   ├── components/        # All reusable UI components
  │   │   ├── ui/            # shadcn prebuilt components
  │   │   ├── app-shell.tsx  # App shell: header + bottom nav + Outlet
  │   │   ├── auth-provider.tsx  # AuthProvider (supabase session state)
  │   │   └── guarded-route.tsx  # Route guard (auth + onboarding)
  │   ├── hooks/             # Custom React hooks (one hook per file)
  │   │   ├── use-auth.ts    # useAuth() — session/user/signIn/signUp/signOut
  │   │   ├── use-profile.ts # profile query + update
  │   │   ├── use-tasks.ts   # tasks CRUD mutations
  │   │   ├── use-sessions.ts / use-session-mutations.ts
  │   │   ├── use-checkin.ts # energy check-ins
  │   │   ├── use-subscription.ts
  │   │   ├── use-intentions.ts
  │   │   ├── use-ai-chat.ts # SSE streaming chat with the AI backend function
  │   │   ├── use-notifications.ts / use-push.ts
  │   │   └── use-mobile.ts / use-toast.ts (template)
  │   ├── i18n/              # i18n runtime: config.ts (entry) + util.ts (helpers)
  │   ├── lib/               # Pure domain logic + data access (no React)
  │   │   ├── utils.ts       # cn()
  │   │   ├── auth-context.ts
  │   │   ├── intervention/  # types.ts, catalog.ts, engine.ts + tests (rules → intervention)
  │   │   ├── metrics/       # metrics.ts + tests (initiation, LTA, completion, recovery)
  │   │   ├── behaviors/     # profiles.ts (procrastination profile), insights.ts
  │   │   ├── plan/          # suggestions.ts (SE→ENTÃO by rules)
  │   │   └── data/          # supabase repos: profiles, tasks, sessions, catalogs,
  │   │                      #   checkins, subscriptions, behaviors, consents,
  │   │                      #   intentions, notifications, push, focus, intervention-results
  │   ├── pages/             # Each page in its own subdirectory
  │   │   ├── Index.tsx      # Home (next action, energy, "Estou travado")
  │   │   ├── auth/          # login/signup
  │   │   ├── onboarding/    # profile wizard → procrastination profile
  │   │   ├── tasks/         # list + new (decomposition + first step)
  │   │   ├── stuck/         # 3-step stuck flow → intervention → session
  │   │   ├── session/       # focus mode + post-session check-in + recovery
  │   │   ├── dashboard/     # metrics + weekly report + insights
  │   │   ├── profile/       # plan (paywall mock), SE→ENTÃO, privacy
  │   │   ├── assistant/     # AI chat (streaming + crisis screen)
  │   │   ├── notifications/ # in-app center + push toggle
  │   │   └── NotFound.tsx
  │   ├── App.tsx            # Providers (QueryClient, Auth, Tooltip, Toaster, Router)
  │   ├── router.tsx         # Router config (routes registered here)
  │   ├── main.tsx           # Entry point
  │   └── index.css          # Global styles + design tokens (dark premium)
  ├── supabase/
  │   ├── config.toml
  │   ├── migrations/        # migration_20260903_032004000 (20 tables + RLS + seeds)
  │   └── functions/
  │       └── assistant-chat/index.ts  # AI chat backend function (Qwen 3.8 Max)
  ├── vitest.config.ts       # Unit tests for lib/intervention and lib/metrics
  ├── package.json
  ├── tailwind.config.ts
  └── ...                    # Other config and lock files
```

> Backend-handoff temporary files (`scripts/`, `i18n.scan.json`, `reports/i18n/`, `docs/i18n-*.md`) are kept in the repo only until backend integration of i18n statistics/scan/auto-translate is complete. They are owned by the backend long-term and will be removed once integration lands. Treat them as read-only handoff copies — do not extend them.

## Directory Responsibilities

- **public/**: Static files served directly. PWA manifest and service worker live here.
- **public/locales/**: Translation files, one per language (`{code}.json`). Flat dotted keys (e.g. `home.hero.title`); the `fallbackLng` file is the structural source of truth.
- **i18n.config.json**: The lightweight i18n manifest for fallback language, language labels, browser detection aliases, and document direction. Single source of truth for the language list.
- **src/components/**: All UI components.
  - **ui/**: Contains atomic and composite UI components (shadcn).
  - **app-shell.tsx**: Global chrome (header, bottom nav) rendered as a layout route; new feature pages go under `/` in `router.tsx` with a nav item added to `NAV_ITEMS`.
  - **guarded-route.tsx**: Wrap every authenticated route. `requireOnboarding` redirects to `/onboarding` until the profile is completed.
- **src/hooks/**: Custom React hooks. Each file should export a single hook focused on one responsibility.
- **src/i18n/**: Two files only (`config.ts`, `util.ts`).
- **src/lib/**: Pure logic and data access, no React. `lib/data/*` are the only modules that touch the supabase client — pages use hooks, never the client directly.
- **src/pages/**: All route-level pages. Each page in its own subdirectory (`pages/<name>/index.tsx`).
- **supabase/functions/**: Backend functions (Deno). Deploy with the deploy tool after editing; read the token via `Deno.env.get`.

**Important:**
Whenever a new module (such as a component, hook, or utility) or a new page is added or removed, this document **must be updated immediately** to reflect the changes.

## How to Add New Code

### 1. Adding a New Page

- **Create a subdirectory under `src/pages/`** for the page (`pages/<name>/index.tsx`).
- **Register the route in `src/router.tsx`** with a semantic name (e.g. `path: "/dashboard", name: "dashboard"`).
- If it belongs in the authenticated app, add it as a child of the `"/"` layout route; optionally add a nav item to `NAV_ITEMS` in `src/components/app-shell.tsx`.

### 2. Adding a New Component

- Reusable components go in `src/components/` (feature-grouped subdirectories allowed).
- Components used only by one page live in that page's subdirectory.
- Small files (< 100 lines) are encouraged.

### 3. Adding a New Hook

- One hook per file in `src/hooks/`, named `use-<feature>.ts`.
- Hooks own React Query keys and mutations; they call `lib/data/*` repos.

### 4. Adding Utilities

- Pure functions go to `src/lib/` (e.g. `intervention/`, `metrics/`, `behaviors/`, `plan/`).
- Unit tests co-locate as `*.test.ts` and run with `pnpm test` (Vitest).

### 5. Adding or Updating Languages

- Language metadata goes through `i18n.config.json`; locale content lives in `public/locales/{code}.json` as flat dotted-key JSON. Runtime reads only through `src/i18n/util.ts`.
- Translations are read with the official `useTranslation()` from `react-i18next`.

### 6. Adding a Backend Function

- Create `supabase/functions/<name>/index.ts` with `Deno.serve`, CORS preflight, and no raw SQL (use client query methods).
- Call the deploy tool with only the function name; edit-then-redeploy for changes.

## Coding Best Practices

- **One module, one responsibility** — each file does one thing.
- **High cohesion, low coupling** — pages → hooks → `lib/data` repos → supabase client.
- **Naming:** `PascalCase` for components and page directories; `camelCase` for hooks and utilities; route names are semantic and lowercase.
- **Auth pattern:** register `onAuthStateChange` BEFORE `getSession()`; never pass an async callback; defer client calls inside the callback with `setTimeout(..., 0)`.
- **Never edit generated files** `src/integrations/supabase/client.ts` and `types.ts`.
- **Documentation:** comment complex logic; document the purpose of each module at the top of the file if not obvious.
