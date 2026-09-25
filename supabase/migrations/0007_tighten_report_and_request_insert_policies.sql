-- Final review fix for the Listing Status Report plan:
--
-- The insert policies for `listing_status_reports` and `contact_requests` in
-- 0001 only checked ownership (`reported_by` / `requested_by = auth.uid()`).
-- A service provider calling PostgREST directly could therefore insert a row
-- that is already `confirmed` / `approved`, or with a forged `reviewed_by` /
-- `approved_by`, polluting the admin audit trail. Require the row to start in
-- its initial state with no reviewer set; only the admin update policies can
-- move it forward.
--
-- Run this once in Supabase SQL Editor (Dashboard > SQL Editor > New query > paste > Run)

drop policy "listing_status_reports_insert_self" on public.listing_status_reports;
create policy "listing_status_reports_insert_self" on public.listing_status_reports for insert
  with check (
    reported_by = auth.uid()
    and status = 'pending_review'
    and reviewed_by is null
    and reviewed_at is null
  );

drop policy "contact_requests_insert_self" on public.contact_requests;
create policy "contact_requests_insert_self" on public.contact_requests for insert
  with check (
    requested_by = auth.uid()
    and status = 'pending'
    and approved_by is null
    and approved_at is null
  );
