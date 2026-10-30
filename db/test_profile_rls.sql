-- Manual verification only: use an isolated Supabase database with the core schema
-- and profile RLS migration already applied. Run this entire file as postgres.
-- All fixtures roll back; if interrupted or an assertion fails, issue ROLLBACK.
begin;

insert into auth.users (id, email) values
  ('f7100000-0000-4000-8000-000000000001', 'profile-rls-owner@example.invalid'),
  ('f7100000-0000-4000-8000-000000000002', 'profile-rls-other@example.invalid');

do $$
begin
  if (select count(*) from public.profiles where id in (
    'f7100000-0000-4000-8000-000000000001',
    'f7100000-0000-4000-8000-000000000002'
  )) <> 2 then
    raise exception 'Signup trigger did not create both synthetic profiles';
  end if;
end $$;

delete from public.profiles where id = 'f7100000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f7100000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"f7100000-0000-4000-8000-000000000001","role":"authenticated"}', true);

do $$
declare
  owner_id uuid := 'f7100000-0000-4000-8000-000000000001';
  other_id uuid := 'f7100000-0000-4000-8000-000000000002';
  affected integer;
begin
  insert into public.profiles (id, name) values (owner_id, 'inserted');
  if not exists (select 1 from public.profiles where id = owner_id and name = 'inserted') then
    raise exception 'Owner INSERT/SELECT failed';
  end if;

  update public.profiles set name = 'updated' where id = owner_id;
  get diagnostics affected = row_count;
  if affected <> 1 or not exists (select 1 from public.profiles where id = owner_id and name = 'updated') then
    raise exception 'Owner UPDATE failed';
  end if;

  insert into public.profiles (id, name) values (owner_id, 'upserted')
    on conflict (id) do update set name = excluded.name;
  if not exists (select 1 from public.profiles where id = owner_id and name = 'upserted') then
    raise exception 'Owner conflict-update upsert failed';
  end if;

  if exists (select 1 from public.profiles where id = other_id) then
    raise exception 'Cross-user SELECT exposed another profile';
  end if;
  update public.profiles set name = 'forbidden' where id = other_id;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'Cross-user UPDATE changed another profile';
  end if;

  begin
    insert into public.profiles (id, name) values (other_id, 'forbidden');
    raise exception 'Cross-user INSERT was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.profiles (id, name) values (other_id, 'forbidden')
      on conflict (id) do update set name = excluded.name;
    raise exception 'Cross-user upsert was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set id = 'f7100000-0000-4000-8000-000000000003' where id = owner_id;
    raise exception 'Owner identity reassignment was allowed';
  exception when insufficient_privilege then null;
  end;

  if has_function_privilege(current_user, 'public.consume_quota(uuid,text)', 'EXECUTE') then
    raise exception 'Authenticated role can invoke the privileged quota RPC';
  end if;
end $$;

reset role;

insert into public.water_logs (user_id, glasses)
  values ('f7100000-0000-4000-8000-000000000001', 5);

set local role service_role;

insert into public.subscriptions (user_id, stripe_customer_id, stripe_subscription_id, status)
  values ('f7100000-0000-4000-8000-000000000001', 'cus_profile_rls_fixture', 'sub_profile_rls_fixture', 'canceled');

do $$
declare
  owner_id uuid := 'f7100000-0000-4000-8000-000000000001';
  generation integer;
begin
  for generation in 1..3 loop
    if public.consume_quota(owner_id, 'generation') is distinct from true then
      raise exception 'Synthetic free-tier generation % failed', generation;
    end if;
  end loop;
  if public.consume_quota(owner_id, 'scan') is distinct from true
    or public.consume_quota(owner_id, 'generation') is distinct from false
    or public.consume_quota(owner_id, 'scan') is distinct from false then
    raise exception 'Synthetic quotas were not exhausted';
  end if;
end $$;

reset role;

set local role authenticated;

do $$
declare
  owner_id uuid := 'f7100000-0000-4000-8000-000000000001';
  affected integer;
begin
  delete from public.profiles where id = owner_id;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'Owner DELETE removed the profile';
  end if;
  if not exists (select 1 from public.profiles where id = owner_id and name = 'upserted')
    or not exists (select 1 from public.water_logs where user_id = owner_id and glasses = 5)
    or not exists (select 1 from public.subscriptions where user_id = owner_id
      and stripe_customer_id = 'cus_profile_rls_fixture' and stripe_subscription_id = 'sub_profile_rls_fixture'
      and status = 'canceled' and current_period_end is null)
    or not exists (select 1 from public.usage_counters where user_id = owner_id
      and used_on = current_date and generations = 3 and scans = 1) then
    raise exception 'Zero-row DELETE did not preserve actual profile/dependent/quota rows';
  end if;

  begin
    insert into public.profiles (id, name) values (owner_id, 'reinserted');
    raise exception 'Profile reinsertion succeeded after blocked DELETE';
  exception when unique_violation then null;
  end;
  insert into public.profiles (id, name) values (owner_id, 'after-delete')
    on conflict (id) do update set name = excluded.name;

  delete from public.profiles where id = 'f7100000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'Cross-user DELETE removed another profile';
  end if;
end $$;

reset role;

set local role service_role;

do $$
declare
  owner_id uuid := 'f7100000-0000-4000-8000-000000000001';
begin
  if not exists (select 1 from public.profiles where id = owner_id and name = 'after-delete')
    or not exists (select 1 from public.profiles where id = 'f7100000-0000-4000-8000-000000000002' and name = '')
    or not exists (select 1 from public.water_logs where user_id = owner_id and glasses = 5)
    or not exists (select 1 from public.subscriptions where user_id = owner_id
      and stripe_customer_id = 'cus_profile_rls_fixture' and stripe_subscription_id = 'sub_profile_rls_fixture'
      and status = 'canceled' and current_period_end is null)
    or not exists (select 1 from public.usage_counters where user_id = owner_id
      and used_on = current_date and generations = 3 and scans = 1) then
    raise exception 'Privileged verification found changed or missing synthetic rows';
  end if;
  if public.consume_quota(owner_id, 'generation') is distinct from false
    or public.consume_quota(owner_id, 'scan') is distinct from false then
    raise exception 'Attempted DELETE/reinsert/upsert reset exhausted quota';
  end if;
end $$;

reset role;

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
declare
  affected integer;
begin
  begin
    if exists (select 1 from public.profiles where id in (
      'f7100000-0000-4000-8000-000000000001',
      'f7100000-0000-4000-8000-000000000002'
    )) then
      raise exception 'Anonymous SELECT exposed synthetic profiles';
    end if;
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.profiles (id) values ('f7100000-0000-4000-8000-000000000003');
    raise exception 'Anonymous INSERT was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set name = 'forbidden'
      where id = 'f7100000-0000-4000-8000-000000000001';
    get diagnostics affected = row_count;
    if affected <> 0 then
      raise exception 'Anonymous UPDATE changed a profile';
    end if;
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.profiles where id = 'f7100000-0000-4000-8000-000000000001';
    get diagnostics affected = row_count;
    if affected <> 0 then
      raise exception 'Anonymous DELETE removed a profile';
    end if;
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;
