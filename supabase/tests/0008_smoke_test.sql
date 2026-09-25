-- Run in Supabase SQL Editor AFTER 0008. Acts as the super admin under real RLS,
-- fires every trigger once, then raises on purpose so ALL writes roll back.
-- PASS = an error saying "SMOKE OK - N activities, M audit rows; all rolled back".
-- Any other error names the trigger/statement at fault.
do $smoke$
declare v_admin uuid; v_act int; v_aud int;
begin
  select id into v_admin from public.profiles where role = 'super_admin' and status = 'active' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.unit_spaces (unit_id, floor_type, floor_label) select id, 'Custom', 'SMOKE TEST' from public.units limit 1;
  update public.units set remarks = coalesce(remarks,'') || '.' where id = (select id from public.units limit 1);
  update public.listings set listing_status = case listing_status when 'available' then 'reserved' else 'available' end where id = (select id from public.listings limit 1);
  update public.owner_search_tasks set remarks = coalesce(remarks,'') || '.' where id = (select id from public.owner_search_tasks limit 1);
  update public.unit_submissions set remarks = coalesce(remarks,'') || '.' where id = (select id from public.unit_submissions limit 1);
  update public.contact_requests set remarks = coalesce(remarks,'') || '.' where id = (select id from public.contact_requests limit 1);
  update public.contact_access_logs set revoked = not revoked where id = (select id from public.contact_access_logs limit 1);
  update public.listing_status_reports set remarks = coalesce(remarks,'') || '.' where id = (select id from public.listing_status_reports limit 1);
  update public.unit_ownerships set is_primary = not is_primary where id = (select id from public.unit_ownerships limit 1);
  update public.owners set remarks = coalesce(remarks,'') || '.' where id = (select id from public.owners limit 1);
  update public.profiles set role = case role when 'sp' then 'area_admin' else 'sp' end where id = (select id from public.profiles where id <> v_admin limit 1);
  delete from public.area_admins where profile_id = (select profile_id from public.area_admins limit 1);
  select count(*) into v_act from public.activities;
  select count(*) into v_aud from public.audit_logs;
  raise exception 'SMOKE OK - % activities, % audit rows; all rolled back', v_act, v_aud;
end $smoke$;
