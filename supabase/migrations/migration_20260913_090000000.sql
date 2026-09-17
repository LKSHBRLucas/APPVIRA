-- ============ TASK BREAKDOWN ============
-- Stores the AI-assisted step breakdown for a task (obstacle: "a tarefa
-- parece grande demais" / "não sei por onde começar"). Nullable JSONB array
-- of strings, e.g. ["Abrir o documento", "Escrever o título", ...].
-- RLS already enabled on tasks; existing owner-scoped policies cover it.

alter table public.tasks
  add column breakdown_steps jsonb;

-- ============ DEVICE PUSH TOKENS (native push, Capacitor) ============
-- Separate from `push_subscriptions` (Web Push/VAPID shape: endpoint + keys).
-- Native push via Firebase Cloud Messaging uses a single opaque token per
-- device/app install instead, so it gets its own table rather than forcing
-- the web shape onto it.

create table public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null default 'android',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.device_push_tokens enable row level security;

create policy "own device_push_tokens" on public.device_push_tokens
  for select to authenticated using (user_id = auth.uid());
create policy "insert own device_push_tokens" on public.device_push_tokens
  for insert to authenticated with check (user_id = auth.uid());
create policy "update own device_push_tokens" on public.device_push_tokens
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own device_push_tokens" on public.device_push_tokens
  for delete to authenticated using (user_id = auth.uid());

create index device_push_tokens_user_idx on public.device_push_tokens(user_id);
