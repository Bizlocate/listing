"use server";

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";

export async function createUnitSpace(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor || (actor.role !== "super_admin" && actor.role !== "area_admin")) {
    redirect("/");
  }

  const unitId = String(formData.get("unitId"));
  const floorType = String(formData.get("floorType"));
  const floorLabel = String(formData.get("floorLabel"));
  const sizeRaw = String(formData.get("size") ?? "");
  const sizeType = String(formData.get("sizeType") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.from("unit_spaces").insert({
    unit_id: unitId,
    floor_type: floorType,
    floor_label: floorLabel,
    size: sizeRaw ? Number(sizeRaw) : null,
    size_type: sizeType || null,
  });

  if (error) {
    redirect(`/units/${unitId}?error=space_create_failed`);
  }

  redirect(`/units/${unitId}?space_created=1`);
}
