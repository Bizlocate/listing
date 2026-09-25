-- Security fix: profiles_update_self (0001) had USING but no WITH CHECK, and
-- 0003 grants UPDATE on all tables to `authenticated`, so any logged-in user
-- could PATCH their own row over PostgREST and set role = 'super_admin'
-- (or flip status). Pin role and status on self-update: the new row's values
-- must equal the current stored values (a STABLE function inside WITH CHECK
-- sees the pre-update snapshot). profiles_update_super_admin is untouched, so
-- super_admins can still change any role/status. handle_new_user() and the
-- service-role admin client bypass RLS, so user creation is unaffected.
--
-- Run this once in Supabase SQL Editor (Dashboard > SQL Editor > New query > paste > Run)

create or replace function public.current_status()
returns text language sql stable security definer set search_path = public as $$
  select status from public.profiles where id = auth.uid();
$$;

drop policy "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = public.current_role()
    and status = public.current_status()
  );
