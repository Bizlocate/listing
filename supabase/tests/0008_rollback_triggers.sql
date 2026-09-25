-- Emergency: removes the 0008 activity/audit triggers if they ever break writes.
-- The dropped insert policies can stay dropped (nothing else writes those tables).
do $$ declare t text; begin
  foreach t in array array['units','unit_spaces','unit_ownerships','listings','owner_search_tasks','unit_submissions','contact_requests','contact_access_logs','listing_status_reports'] loop
    execute format('drop trigger if exists trg_log_activity on public.%I', t); end loop;
  foreach t in array array['owners','unit_ownerships','contact_access_logs','contact_requests','listings','listing_status_reports','profiles','area_admins'] loop
    execute format('drop trigger if exists trg_log_audit on public.%I', t); end loop;
end $$;
