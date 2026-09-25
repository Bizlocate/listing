-- Timeline (activities) + Audit Log written by triggers, not by app code.
-- Clients can no longer insert rows into either table (the old *_insert_self
-- policies let any user log fake entries); security-definer triggers write them.
--
-- NOTE: profiles_select is intentionally NOT widened here. profiles also holds
-- phone and status, so letting area_admins read every row would expose more
-- than names. Resolve actor/requester/reporter names another way (e.g. a
-- security-definer function returning id + full_name only).
--
-- Run this once in Supabase SQL Editor (Dashboard > SQL Editor > New query > paste > Run)

alter table public.activities add column unit_id uuid;  -- no FK: history outlives a deleted unit
alter table public.activities add column detail text;
create index on public.activities (unit_id, created_at desc);

drop policy "activities_insert_self" on public.activities;
drop policy "audit_logs_insert_self" on public.audit_logs;

create or replace function public.log_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  n jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  o jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  r jsonb := coalesce(n, o);
  status_col text := case tg_table_name
    when 'listings' then 'listing_status'
    when 'units' then 'status'
    when 'owner_search_tasks' then 'status'
    when 'contact_requests' then 'status'
    when 'listing_status_reports' then 'status'
    when 'unit_submissions' then 'status'
  end;
  v_unit uuid;
  v_detail text;
begin
  if tg_op = 'UPDATE' and n = o then
    return null;
  end if;

  v_unit := case tg_table_name
    when 'units' then (r->>'id')::uuid
    when 'unit_submissions' then (r->>'matched_unit_id')::uuid
    when 'contact_requests' then (select l.unit_id from public.listings l where l.id = (r->>'listing_id')::uuid)
    when 'listing_status_reports' then (select l.unit_id from public.listings l where l.id = (r->>'listing_id')::uuid)
    else (r->>'unit_id')::uuid
  end;

  if tg_op = 'UPDATE' and status_col is not null and o->>status_col is distinct from n->>status_col then
    v_detail := (o->>status_col) || ' -> ' || (n->>status_col);
  elsif tg_op = 'UPDATE' and tg_table_name = 'contact_access_logs'
        and n->>'revoked' = 'true' and o->>'revoked' <> 'true' then
    v_detail := 'revoked';
  end if;

  insert into public.activities (entity_type, entity_id, action, actor_id, unit_id, detail)
  values (tg_table_name, (r->>'id')::uuid, tg_table_name || '.' || lower(tg_op), auth.uid(), v_unit, v_detail);
  return null;
end;
$$;

create or replace function public.log_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  n jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  o jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  r jsonb := coalesce(n, o);
begin
  if tg_op = 'UPDATE' then
    if n = o then return null; end if;
    if tg_table_name = 'profiles' and o->>'role' is not distinct from n->>'role'
       and o->>'status' is not distinct from n->>'status' then return null; end if;
    if tg_table_name = 'listings' and o->>'listing_status' is not distinct from n->>'listing_status' then return null; end if;
    if tg_table_name in ('contact_requests', 'listing_status_reports')
       and o->>'status' is not distinct from n->>'status' then return null; end if;
  end if;

  insert into public.audit_logs (action, user_id, entity_type, entity_id, previous_value, new_value)
  values (tg_table_name || '.' || lower(tg_op), auth.uid(), tg_table_name, (r->>'id')::uuid, o, n);
  return null;
end;
$$;

create trigger trg_log_activity after insert or update or delete on public.units
  for each row execute function public.log_activity();
create trigger trg_log_activity after insert or update or delete on public.unit_spaces
  for each row execute function public.log_activity();
create trigger trg_log_activity after insert or update or delete on public.unit_ownerships
  for each row execute function public.log_activity();
create trigger trg_log_activity after insert or update or delete on public.listings
  for each row execute function public.log_activity();
create trigger trg_log_activity after insert or update or delete on public.owner_search_tasks
  for each row execute function public.log_activity();
create trigger trg_log_activity after insert or update or delete on public.unit_submissions
  for each row execute function public.log_activity();
create trigger trg_log_activity after insert or update or delete on public.contact_requests
  for each row execute function public.log_activity();
create trigger trg_log_activity after insert or update or delete on public.contact_access_logs
  for each row execute function public.log_activity();
create trigger trg_log_activity after insert or update or delete on public.listing_status_reports
  for each row execute function public.log_activity();

create trigger trg_log_audit after insert or update or delete on public.owners
  for each row execute function public.log_audit();
create trigger trg_log_audit after insert or update or delete on public.unit_ownerships
  for each row execute function public.log_audit();
create trigger trg_log_audit after insert or update or delete on public.contact_access_logs
  for each row execute function public.log_audit();
create trigger trg_log_audit after insert or update or delete on public.contact_requests
  for each row execute function public.log_audit();
create trigger trg_log_audit after insert or update or delete on public.listings
  for each row execute function public.log_audit();
create trigger trg_log_audit after insert or update or delete on public.listing_status_reports
  for each row execute function public.log_audit();
create trigger trg_log_audit after insert or update or delete on public.profiles
  for each row execute function public.log_audit();
create trigger trg_log_audit after insert or update or delete on public.area_admins
  for each row execute function public.log_audit();
