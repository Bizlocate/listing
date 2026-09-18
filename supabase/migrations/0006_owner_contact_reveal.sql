-- The only path by which a non-admin ever sees an owner's name/phone.
-- Admins already read `owners` directly (owners_select_admin_scoped, 0005).
-- Everyone else gets a row back ONLY if they hold an active, unrevoked,
-- unexpired contact_access_logs entry for this listing (or is an admin,
-- so the app doesn't need to branch the query by role).

create or replace function public.get_owner_contact_for_listing(p_listing_id uuid)
returns table(owner_name text, phone text, access_expiry timestamptz)
language sql stable security definer set search_path = public as $$
  select o.name, o.primary_contact, cal.access_expiry
  from public.listings l
  join public.unit_ownerships uo on uo.unit_id = l.unit_id
  join public.owners o on o.id = uo.owner_id
  left join public.contact_access_logs cal
    on cal.listing_id = l.id
    and cal.user_id = auth.uid()
    and cal.revoked = false
    and cal.access_expiry > now()
  where l.id = p_listing_id
    and (
      public.is_super_admin()
      or public.is_area_admin_for_area(public.area_id_for_listing(p_listing_id))
      or cal.id is not null
    )
  order by uo.is_primary desc, uo.created_at asc
  limit 1;
$$;

grant execute on function public.get_owner_contact_for_listing(uuid) to authenticated;
