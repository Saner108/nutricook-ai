-- NutriCook AI — Rate limiting addendum.
-- Run this once in the Supabase SQL editor, in addition to migration.sql.
--
-- This is separate from usage_counters/consume_quota (which enforce the daily
-- free-tier allowance). This enforces a short sliding window (requests per
-- minute) to stop rapid-fire abuse — e.g. a compromised or scripted token
-- hammering /api/generate — independent of whether the caller still has
-- quota left for the day.

-- ── Table ─────────────────────────────────────────────────────────────────
create table if not exists rate_limit_hits (
  user_id uuid not null references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  hits int not null default 1,
  primary key (user_id, window_start)
);

alter table rate_limit_hits enable row level security;
-- No client policies: this table is written/read only by the serverless
-- service-role key, same as usage_counters' write path.

-- ── Function ──────────────────────────────────────────────────────────────
-- Buckets requests into fixed 60-second windows per user. Returns true if
-- the request is allowed (and was counted), false if the caller has already
-- made p_limit or more requests in the current window.
-- Runs as the service role, called only from the serverless proxy.
create or replace function check_rate_limit(p_user uuid, p_limit int default 20)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  bucket timestamptz := date_trunc('minute', now());
  cur_hits int;
begin
  insert into rate_limit_hits (user_id, window_start, hits)
    values (p_user, bucket, 1)
  on conflict (user_id, window_start)
    do update set hits = rate_limit_hits.hits + 1
  returning hits into cur_hits;

  return cur_hits <= p_limit;
end;
$$;

revoke execute on function public.check_rate_limit(uuid, int) from public, anon, authenticated;

-- Optional housekeeping: old windows accumulate forever otherwise. Safe to
-- run periodically (e.g. a daily Supabase cron / pg_cron job) — not required
-- for correctness, just table bloat control.
-- delete from rate_limit_hits where window_start < now() - interval '1 day';
