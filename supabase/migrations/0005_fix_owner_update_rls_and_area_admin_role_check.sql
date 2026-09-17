-- Two fixes from final review of the Owners plan:
--
-- 1. `owners_admin_scoped` was a single FOR ALL policy whose WITH CHECK
--    required `created_by = auth.uid()` for area_admins. WITH CHECK applies
--    to UPDATE as well as INSERT, so an area_admin could see an owner (via
--    the unit_ownerships join) but could never actually update it unless
--    they were the one who created it — the core "admin records a call
--    outcome" workflow silently failed with a generic error for anyone but
--    the creator. Split into per-operation policies: INSERT keeps the
--    created_by requirement (that's the only thing that made sense there),
--    SELECT/UPDATE/DELETE use the area-scoped visibility check for their
--    WITH CHECK too, matching their USING.
--
-- 2. `is_area_admin_for_area()` only checked for an area_admins row, never
--    the caller's current role. A user whose role changes away from
--    area_admin (once role editing exists) would keep every RLS privilege
--    tied to that function as long as a stale area_admins row remained.
--    Add the role recheck at this one choke point — it backstops every
--    table that calls this function (units, unit_spaces, owners,
--    unit_ownerships, owner_search_tasks, listings, contact_requests,
--    contact_access_logs, listing_status_reports, activities).
--
-- Run this once in Supabase SQL Editor (Dashboard > SQL Editor > New query > paste > Run)

create or replace function public.is_area_admin_for_area(p_area_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.area_admins aa
    join public.profiles p on p.id = aa.profile_id
    where aa.profile_id = auth.uid()
      and aa.area_id = p_area_id
      and p.role in ('super_admin', 'area_admin')
  );
$$;

drop policy "owners_admin_scoped" on public.owners;

create policy "owners_select_admin_scoped" on public.owners for select
  using (
    public.is_super_admin()
    or created_by = auth.uid()
    or exists (
      select 1 from public.unit_ownerships uo
      where uo.owner_id = owners.id
        and public.is_area_admin_for_area(public.area_id_for_unit(uo.unit_id))
    )
  );

create policy "owners_update_admin_scoped" on public.owners for update
  using (
    public.is_super_admin()
    or created_by = auth.uid()
    or exists (
      select 1 from public.unit_ownerships uo
      where uo.owner_id = owners.id
        and public.is_area_admin_for_area(public.area_id_for_unit(uo.unit_id))
    )
  )
  with check (
    public.is_super_admin()
    or created_by = auth.uid()
    or exists (
      select 1 from public.unit_ownerships uo
      where uo.owner_id = owners.id
        and public.is_area_admin_for_area(public.area_id_for_unit(uo.unit_id))
    )
  );

create policy "owners_delete_admin_scoped" on public.owners for delete
  using (
    public.is_super_admin()
    or created_by = auth.uid()
    or exists (
      select 1 from public.unit_ownerships uo
      where uo.owner_id = owners.id
        and public.is_area_admin_for_area(public.area_id_for_unit(uo.unit_id))
    )
  );

create policy "owners_insert_admin" on public.owners for insert
  with check (
    public.is_super_admin()
    or (public.current_role() = 'area_admin' and created_by = auth.uid())
  );
