-- Private Storage buckets for unit photos, IC/land-title documents and SP submission photos.
-- Access control is enforced here (storage.objects RLS), keyed off the first path
-- segment: <unit_id>/... for unit buckets, <auth.uid()>/... for submission photos.
--
-- There are deliberately no UPDATE policies (no upsert/overwrite; replace = delete + insert)
-- and no DELETE policy on submission-photos. A malformed (non-uuid) first path segment makes
-- the ::uuid cast raise, which fails the statement (deny).
--
-- Run this once in Supabase SQL Editor (Dashboard > SQL Editor > New query > paste > Run)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('unit-photos', 'unit-photos', false, 8388608, array['image/jpeg','image/png','image/webp']),
  ('unit-documents', 'unit-documents', false, 10485760, array['application/pdf','image/jpeg','image/png','image/webp']),
  ('submission-photos', 'submission-photos', false, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- unit-photos: any logged-in user reads; only super_admin / the unit's area admin writes
create policy "unit_photos_objects_select" on storage.objects for select
  using (bucket_id = 'unit-photos' and auth.role() = 'authenticated');
create policy "unit_photos_objects_insert" on storage.objects for insert
  with check (
    bucket_id = 'unit-photos'
    and (public.is_super_admin()
         or public.is_area_admin_for_area(public.area_id_for_unit(((storage.foldername(name))[1])::uuid)))
  );
create policy "unit_photos_objects_delete" on storage.objects for delete
  using (
    bucket_id = 'unit-photos'
    and (public.is_super_admin()
         or public.is_area_admin_for_area(public.area_id_for_unit(((storage.foldername(name))[1])::uuid)))
  );

-- unit-documents (IC / hakmilik): admin-only for every operation, never SP
create policy "unit_documents_objects_select" on storage.objects for select
  using (
    bucket_id = 'unit-documents'
    and (public.is_super_admin()
         or public.is_area_admin_for_area(public.area_id_for_unit(((storage.foldername(name))[1])::uuid)))
  );
create policy "unit_documents_objects_insert" on storage.objects for insert
  with check (
    bucket_id = 'unit-documents'
    and (public.is_super_admin()
         or public.is_area_admin_for_area(public.area_id_for_unit(((storage.foldername(name))[1])::uuid)))
  );
create policy "unit_documents_objects_delete" on storage.objects for delete
  using (
    bucket_id = 'unit-documents'
    and (public.is_super_admin()
         or public.is_area_admin_for_area(public.area_id_for_unit(((storage.foldername(name))[1])::uuid)))
  );

-- submission-photos: an SP uploads into their own folder and can read only their own;
-- admins (super_admin, or role area_admin) can read all to review submissions
create policy "submission_photos_objects_insert" on storage.objects for insert
  with check (
    bucket_id = 'submission-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "submission_photos_objects_select" on storage.objects for select
  using (
    bucket_id = 'submission-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text
         or public.is_super_admin()
         or public.current_role() = 'area_admin')
  );
