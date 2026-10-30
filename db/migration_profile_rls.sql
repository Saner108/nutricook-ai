begin;

drop policy if exists own_profile on public.profiles;
drop policy if exists own_profile_select on public.profiles;
drop policy if exists own_profile_insert on public.profiles;
drop policy if exists own_profile_update on public.profiles;

create policy own_profile_select on public.profiles for select to authenticated
  using (id = auth.uid());

create policy own_profile_insert on public.profiles for insert to authenticated
  with check (id = auth.uid());

create policy own_profile_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

commit;
