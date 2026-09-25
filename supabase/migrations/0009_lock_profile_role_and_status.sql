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

-- Same class of hole, found in the 0009 review:
-- 1. profiles_insert_self only checked id = auth.uid(), so an auth user with no
--    profile row could insert one with role = 'super_admin'. Nothing in the app
--    uses this policy (handle_new_user and the service-role client bypass RLS).
drop policy "profiles_insert_self" on public.profiles;

-- 2. unit_submissions_insert_self only checked submitted_by, so an SP could insert
--    a submission already 'linked'/'converted' with any matched_unit_id (skipping the
--    admin queue and writing onto any unit's timeline). Same pattern as 0007.
drop policy "unit_submissions_insert_self" on public.unit_submissions;
create policy "unit_submissions_insert_self" on public.unit_submissions for insert
  with check (
    submitted_by = auth.uid()
    and status = 'pending'
    and matched_unit_id is null
  );
