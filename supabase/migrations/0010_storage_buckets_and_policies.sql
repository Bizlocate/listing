-- Private Storage buckets for unit photos, IC/land-title documents and SP submission photos.
-- Access control is enforced here (storage.objects RLS), keyed off the first path
-- segment: <unit_id>/... for unit buckets, <auth.uid()>/... for submission photos.
--
-- No UPDATE policies (no upsert/overwrite; replace = delete + insert). Unit-bucket policies go
-- through unit_id_from_object_name(), which returns null (=> deny) for a non-uuid first segment
-- instead of raising, so a malformed object name can never error out unrelated storage queries.
--
-- Run this once in Supabase SQL Editor (Dashboard > SQL Editor > New query > paste > Run)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('unit-photos', 'unit-photos', false, 8388608, array['image/jpeg','image/png','image/webp']),
  ('unit-documents', 'unit-documents', false, 10485760, array['application/pdf','image/jpeg','image/png','image/webp']),
  ('submission-photos', 'submission-photos', false, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- First path segment as uuid, or null if it isn't one. Pure (no table access): immutable, not definer.
create or replace function public.unit_id_from_object_name(p_name text)
returns uuid language sql immutable set search_path = '' as $$
  select case
    when split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', 1)::uuid
  end;
$$;

-- unit-photos: any logged-in user reads; only super_admin / the unit's area admin writes
create policy "unit_photos_objects_select" on storage.objects for select to authenticated
  using (bucket_id = 'unit-photos');
create policy "unit_photos_objects_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'unit-photos'
    and public.unit_id_from_object_name(name) is not null
    and (public.is_super_admin()
         or public.is_area_admin_for_area(public.area_id_for_unit(public.unit_id_from_object_name(name))))
  );
create policy "unit_photos_objects_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'unit-photos'
    and (public.is_super_admin()
         or public.is_area_admin_for_area(public.area_id_for_unit(public.unit_id_from_object_name(name))))
  );

-- unit-documents (IC / hakmilik): admin-only for every operation, never SP
create policy "unit_documents_objects_select" on storage.objects for select to authenticated
  using (
    bucket_id = 'unit-documents'
    and (public.is_super_admin()
         or public.is_area_admin_for_area(public.area_id_for_unit(public.unit_id_from_object_name(name))))
  );
create policy "unit_documents_objects_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'unit-documents'
    and public.unit_id_from_object_name(name) is not null
    and (public.is_super_admin()
         or public.is_area_admin_for_area(public.area_id_for_unit(public.unit_id_from_object_name(name))))
  );
create policy "unit_documents_objects_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'unit-documents'
    and (public.is_super_admin()
         or public.is_area_admin_for_area(public.area_id_for_unit(public.unit_id_from_object_name(name))))
  );

-- submission-photos: an SP uploads into their own folder and can read only their own;
-- admins (super_admin, or role area_admin) can read all to review submissions
create policy "submission_photos_objects_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'submission-photos'
    and split_part(name, '/', 1) = auth.uid()::text
  );
create policy "submission_photos_objects_select" on storage.objects for select to authenticated
  using (
    bucket_id = 'submission-photos'
    and (split_part(name, '/', 1) = auth.uid()::text
         or public.is_super_admin()
         or public.current_role() = 'area_admin')
  );
-- SP may delete own photos that no submission references yet (replace / abandoned form).
create policy "submission_photos_objects_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'submission-photos'
    and split_part(name, '/', 1) = auth.uid()::text
    and not exists (select 1 from public.unit_submissions s where s.photo_url = objects.name)
  );

-- unit_submissions.photo_url is SP-supplied: pin it to the submitter's own folder and the exact
-- <uuid>.<ext> shape, so it can't reference another user's photo or smuggle %2e%2e / ../ segments
-- into the admin review page's storage request. (No SP update policy exists, so insert is the only gate.)
drop policy "unit_submissions_insert_self" on public.unit_submissions;
create policy "unit_submissions_insert_self" on public.unit_submissions for insert
  with check (
    submitted_by = auth.uid()
    and status = 'pending'
    and matched_unit_id is null
    and (photo_url is null
         or photo_url ~ ('^' || auth.uid()::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{1,5}$'))
  );
