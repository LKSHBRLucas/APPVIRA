-- ============ SESSION CHECK-IN (focus_sessions extras) ============
-- End-of-session reflection captured after the user closes a focus session:
--   accomplished        - did the user accomplish what they intended?
--   intervention_helped - did the offered intervention help?
--   feeling             - post-session state (1-5).
-- These feed behavior metrics (initiation, latency-to-action, intervention
-- effectiveness) in later analytics. RLS is already enabled on focus_sessions;
-- the existing owner-scoped policies cover the new columns.

alter table public.focus_sessions
  add column accomplished text check (accomplished in ('yes', 'partial', 'no')),
  add column intervention_helped text check (intervention_helped in ('yes', 'partial', 'no')),
  add column feeling int check (feeling between 1 and 5);
