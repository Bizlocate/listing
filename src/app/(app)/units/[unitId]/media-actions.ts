"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";

const PHOTO_TYPES = ["cover", "property", "banner"];
const DOC_TYPES = ["ic", "hakmilik", "other"];

async function requireAdmin() {
  const actor = await getCurrentProfile();
  if (!actor || (actor.role !== "super_admin" && actor.role !== "area_admin")) {
    redirect("/");
  }
  return actor;
}

export async function recordUnitPhoto(unitId: string, path: string, photoType: string): Promise<{ error?: string }> {
  const actor = await requireAdmin();
  if (!path.startsWith(`${unitId}/`) || !PHOTO_TYPES.includes(photoType)) {
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
  if (!path.startsWith(`${unitId}/`) || !DOC_TYPES.includes(docType)) {
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

export async function deleteUnitPhoto(formData: FormData) {
  await requireAdmin();
  const unitId = String(formData.get("unitId"));
  const photoId = String(formData.get("photoId"));
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("unit_photos")
    .delete()
    .eq("id", photoId)
    .eq("unit_id", unitId)
    .select("url")
    .maybeSingle();
  if (row) {
    await supabase.storage.from("unit-photos").remove([row.url]);
  }
  redirect(`/units/${unitId}`);
}

export async function deleteUnitDocument(formData: FormData) {
  await requireAdmin();
  const unitId = String(formData.get("unitId"));
  const documentId = String(formData.get("documentId"));
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("unit_documents")
    .delete()
    .eq("id", documentId)
    .eq("unit_id", unitId)
    .select("url")
    .maybeSingle();
  if (row) {
    await supabase.storage.from("unit-documents").remove([row.url]);
  }
  redirect(`/units/${unitId}`);
}
