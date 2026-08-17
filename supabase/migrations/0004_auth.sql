-- Profile rows are created by the database, not by application code.
--
-- Doing it in the signup action means a user who closes the tab mid-request ends
-- up authenticated with no profile — a broken state every later query has to
-- defend against. The trigger makes account creation atomic.
create or replace function handle_new_user() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, locale)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)),
    coalesce(nullif(new.raw_user_meta_data ->> 'locale', ''), 'ka')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Backfill anyone who signed up before this migration existed.
insert into public.profiles (id, display_name, locale)
select
  u.id,
  coalesce(nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''), split_part(u.email, '@', 1)),
  'ka'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- A signed-in user reads and edits their own row and nobody else's.
-- Note the deliberate absence of an INSERT policy: only the trigger creates
-- profiles, so there is no path for a client to fabricate one.
create policy profiles_read_own on profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy profiles_update_own on profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- `role` decides who may publish events, so it must not be self-assignable.
-- Promotion to venue_owner happens in a security-definer function when a venue
-- is created (Phase 2), never by a client writing to this column.
create or replace function guard_profile_role() returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role then
    raise exception 'role cannot be changed directly';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_role on profiles;
create trigger profiles_guard_role
  before update on profiles
  for each row execute function guard_profile_role();
