-- NutriCook AI — Phase 4 schema + Row-Level Security.
-- Run this once in the Supabase SQL editor for your project.
-- Every table is scoped to the signed-in user via RLS (user_id = auth.uid()).
-- `subscriptions` and `usage_counters` are readable by their owner but only
-- WRITABLE by the service-role key used in the serverless functions.

-- ── Tables ────────────────────────────────────────────────────────────────

-- profiles: one row per auth user, created by a trigger on signup.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  goal text not null default 'Muscle Gain',
  weight_lbs numeric,
  target_lbs numeric,
  units text not null default 'imperial' check (units in ('imperial','metric')),
  kcal_target int not null default 2200,
  protein_target int not null default 165,
  carbs_target int not null default 220,
  fat_target int not null default 73,
  water_target int not null default 8,
  dietary_prefs jsonb not null default '[]',
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists weight_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  logged_on date not null default current_date,
  weight_lbs numeric not null,
  unique (user_id, logged_on)          -- one log per day, upsert on re-log
);

create table if not exists meal_logs (  -- powers real history (Plan tab, past weeks)
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  eaten_on date not null,
  slot text not null check (slot in ('Breakfast','Lunch','Dinner','Snack')),
  name text not null,
  emoji text default '🍽',
  kcal int not null,
  protein int not null,
  carbs int not null,
  fat int not null,
  done boolean not null default true,
  unique (user_id, eaten_on, slot)
);

create table if not exists water_logs (
  user_id uuid not null references profiles(id) on delete cascade,
  logged_on date not null default current_date,
  glasses int not null default 0,
  primary key (user_id, logged_on)
);

create table if not exists recipes (    -- every AI recipe a user saves
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  difficulty text,
  prep_time text,
  servings int,
  macros jsonb not null,
  ingredients jsonb not null default '[]',
  steps jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table if not exists favorites (  -- hearted dishes (snapshot; works for mock meals + recipes)
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  emoji text,
  kcal int, protein int, carbs int, fat int,
  unique (user_id, name)
);

create table if not exists try_list (
  user_id uuid not null references profiles(id) on delete cascade,
  recipe_id bigint not null references recipes(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

create table if not exists grocery_items (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  qty text default '',
  category text not null default 'Other',
  done boolean not null default false,
  source text default 'manual',         -- manual | recipe | seed
  created_at timestamptz not null default now()
);

create table if not exists subscriptions (  -- written ONLY by the Stripe webhook (service role)
  user_id uuid primary key references profiles(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'none',   -- none | active | past_due | canceled
  current_period_end timestamptz
);

create table if not exists usage_counters (  -- server-side free-tier enforcement
  user_id uuid not null references profiles(id) on delete cascade,
  used_on date not null default current_date,
  generations int not null default 0,
  scans int not null default 0,
  primary key (user_id, used_on)
);

-- ── New-user trigger: create the profiles row on signup ───────────────────

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── Row-Level Security ────────────────────────────────────────────────────

alter table profiles       enable row level security;
alter table weight_logs    enable row level security;
alter table meal_logs      enable row level security;
alter table water_logs     enable row level security;
alter table recipes        enable row level security;
alter table favorites      enable row level security;
alter table try_list       enable row level security;
alter table grocery_items  enable row level security;
alter table subscriptions  enable row level security;
alter table usage_counters enable row level security;

-- Owner-only full access on the user-owned tables (user_id = auth.uid()).
do $$
declare t text;
begin
  foreach t in array array[
    'weight_logs','meal_logs','water_logs','recipes',
    'favorites','try_list','grocery_items'
  ] loop
    execute format('drop policy if exists own_rows on %I;', t);
    execute format(
      'create policy own_rows on %I for all
         using (user_id = auth.uid()) with check (user_id = auth.uid());', t);
  end loop;
end $$;

-- profiles keys on id, not user_id.
drop policy if exists own_profile on profiles;
create policy own_profile on profiles for all
  using (id = auth.uid()) with check (id = auth.uid());

-- subscriptions + usage_counters: owner may SELECT only. All writes happen through
-- the service-role key in serverless (which bypasses RLS).
drop policy if exists read_own_subscription on subscriptions;
create policy read_own_subscription on subscriptions for select
  using (user_id = auth.uid());

drop policy if exists read_own_usage on usage_counters;
create policy read_own_usage on usage_counters for select
  using (user_id = auth.uid());

-- ── Atomic free-tier enforcement (called by the serverless proxy) ─────────
-- Checks Pro status + today's counter and increments in one transaction.
-- Returns true if the action is allowed (and was counted), false if over the
-- free limit. Runs as the service role, so it is safe to pass the user id in.
create or replace function consume_quota(p_user uuid, p_kind text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  is_pro boolean;
  cur usage_counters;
begin
  select (s.status = 'active' and (s.current_period_end is null or s.current_period_end > now()))
    into is_pro from subscriptions s where s.user_id = p_user;
  is_pro := coalesce(is_pro, false);

  insert into usage_counters (user_id, used_on) values (p_user, current_date)
    on conflict (user_id, used_on) do nothing;
  select * into cur from usage_counters
    where user_id = p_user and used_on = current_date for update;

  if not is_pro then
    if p_kind = 'scan' and cur.scans >= 1 then return false; end if;
    if p_kind <> 'scan' and cur.generations >= 3 then return false; end if;
  end if;

  if p_kind = 'scan' then
    update usage_counters set scans = scans + 1
      where user_id = p_user and used_on = current_date;
  else
    update usage_counters set generations = generations + 1
      where user_id = p_user and used_on = current_date;
  end if;
  return true;
end;
$$;
