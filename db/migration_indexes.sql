-- NutriCook AI — Performance indexes addendum.
-- Run this once in the Supabase SQL editor, in addition to migration.sql.
--
-- Why these are separate: migration.sql was already applied to production.
-- New indexes are non-destructive (CREATE INDEX IF NOT EXISTS), so this file
-- is safe to run at any time without downtime. PostgreSQL builds them online.
--
-- Motivation: grocery_items, favorites, and recipes are filtered by user_id
-- on every load (PostgREST + RLS = WHERE user_id = auth.uid()), but the
-- tables only had their primary key on `id`. As rows accumulate across users
-- PostgreSQL can end up doing a seq-scan before RLS narrows the result to one
-- user's rows. A partial index on user_id cuts that to a tiny index scan.
--
-- meal_logs and weight_logs already have a covering unique constraint on
-- (user_id, logged_on[, slot]), which PostgreSQL uses as an index — those
-- tables' main queries are already fast and are not duplicated here.

-- ── User-scoped table indexes ──────────────────────────────────────────────

create index if not exists grocery_items_user_id_idx
  on grocery_items (user_id);

create index if not exists favorites_user_id_idx
  on favorites (user_id);

create index if not exists recipes_user_id_created_at_idx
  on recipes (user_id, created_at desc);
-- Covers the default load order (created_at asc maps to the reverse scan)
-- and lets the frontend sort by recency without a sort step.

-- ── Rate limit housekeeping index ─────────────────────────────────────────
-- The cleanup query in migration_ratelimit.sql is:
--   DELETE FROM rate_limit_hits WHERE window_start < now() - interval '1 day';
-- The composite PK (user_id, window_start) can't be used for this range
-- predicate because user_id isn't in the WHERE clause. A standalone index
-- on window_start lets PostgreSQL use a range scan instead of a seq scan.

create index if not exists rate_limit_hits_window_start_idx
  on rate_limit_hits (window_start);
