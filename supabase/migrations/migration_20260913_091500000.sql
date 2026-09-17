-- ============ SCHEDULED PROACTIVE NUDGE (notify-best-hour) ============
-- Requires the `pg_cron` and `pg_net` extensions enabled on this project
-- (Supabase dashboard → Database → Extensions, or `create extension` if you
-- have the privilege). Both are commonly pre-enabled on Supabase projects;
-- if this migration fails on the `create extension` lines, enable them from
-- the dashboard first and re-run just the `cron.schedule` block below.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- IMPORTANT — fill in before running:
--   <PROJECT_REF>            → your Supabase project ref (in the project URL)
--   <SERVICE_ROLE_OR_ANON_KEY> → a key allowed to call this function. The
--     function itself uses the service role key server-side (from its own
--     environment) to query the database — this header key is only what
--     Supabase's edge runtime requires to accept the HTTP call at all.
select cron.schedule(
  'notify-best-hour-hourly',
  '0 * * * *', -- every hour, on the hour
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/notify-best-hour',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_OR_ANON_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- To remove the schedule later: select cron.unschedule('notify-best-hour-hourly');
