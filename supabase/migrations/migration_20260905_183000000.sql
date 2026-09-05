-- ============ PROFILES PREFERENCES ============
-- Editable user preferences (e.g. default_focus_min) stored as JSONB so new
-- prefs do not need new columns. RLS already enabled on profiles; the existing
-- owner-scoped policies cover the new column.

alter table public.profiles
  add column preferences jsonb not null default '{}'::jsonb;
