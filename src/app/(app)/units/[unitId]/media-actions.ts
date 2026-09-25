"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";

const PHOTO_TYPES = ["cover", "property", "banner"];
const DOC_TYPES = ["ic", "hakmilik", "other"];
const UUID = /^[0-9a-fA-F-]{36}$/;

// Path must be exactly <unitId>/<uuid>.<ext> (as built by buildStoragePath); rejects ../ tricks.
function isValidPath(unitId: string, path: string) {
  return UUID.test(unitId) && new RegExp(`^${unitId}/[0-9a-fA-F-]{36}\\.[a-z0-9]{1,5}$`).test(path);
}

async function requireAdmin() {
  const actor = await getCurrentProfile();
  if (!actor || (actor.role !== "super_admin" && actor.role !== "area_admin")) {
    redirect("/");
  }
  return actor;
}

export async function recordUnitPhoto(unitId: string, path: string, photoType: string): Promise<{ error?: string }> {
  const actor = await requireAdmin();
  if (!isValidPath(unitId, path) || !PHOTO_TYPES.includes(photoType)) {
    return { error: "Invalid upload." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("unit_photos")
    .insert({ unit_id: unitId, url: path, photo_type: photoType, created_by: actor.id });
  if (error) return { error: "Could not save photo." };
  revalidatePath(`/units/${unitId}`);
  return {};
}

export async function recordUnitDocument(unitId: string, path: string, docType: string): Promise<{ error?: string }> {
  const actor = await requireAdmin();
  if (!isValidPath(unitId, path) || !DOC_TYPES.includes(docType)) {
    return { error: "Invalid upload." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("unit_documents")
    .insert({ unit_id: unitId, url: path, doc_type: docType, uploaded_by: actor.id });
  if (error) return { error: "Could not save document." };
  revalidatePath(`/units/${unitId}`);
  return {};
}

// Storage object first, then the row: a failure leaves the row visible so the delete can be retried.
async function deleteMedia(
  formData: FormData,
  table: "unit_photos" | "unit_documents",
  idField: string,
  bucket: string,
) {
  await requireAdmin();
  const unitId = String(formData.get("unitId"));
  const id = String(formData.get(idField));
  const back = `/units/${unitId}`;
  const failed = `${back}?error=delete_failed`;
  const supabase = await createClient();

  const { data: row, error: selectError } = await supabase
    .from(table)
    .select("url")
    .eq("id", id)
    .eq("unit_id", unitId)
    .maybeSingle();
  if (selectError) redirect(failed);
  if (!row) redirect(back);

  const { error: removeError } = await supabase.storage.from(bucket).remove([row.url]);
  if (removeError) redirect(failed);

  const { error: deleteError } = await supabase.from(table).delete().eq("id", id).eq("unit_id", unitId);
  if (deleteError) redirect(failed);
  redirect(back);
}

export async function deleteUnitPhoto(formData: FormData) {
  await deleteMedia(formData, "unit_photos", "photoId", "unit-photos");
}

export async function deleteUnitDocument(formData: FormData) {
  await deleteMedia(formData, "unit_documents", "documentId", "unit-documents");
}
