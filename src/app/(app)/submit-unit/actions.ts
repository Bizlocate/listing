"use server";

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";

export async function createUnitSubmission(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor) {
    redirect("/login");
  }

  const subAreaId = String(formData.get("subAreaId"));
  const jalan = String(formData.get("jalan") ?? "");
  const unitNo = String(formData.get("unitNo") ?? "");
  const address = String(formData.get("address"));
  const discoveryType = String(formData.get("discoveryType"));
  const bannerPhone = String(formData.get("bannerPhone") ?? "");
  const remarks = String(formData.get("remarks") ?? "");
  const latRaw = String(formData.get("lat") ?? "");
  const lngRaw = String(formData.get("lng") ?? "");

  const supabase = await createClient();

  const { data: subArea } = await supabase
    .from("sub_areas")
    .select("id, area_id")
    .eq("id", subAreaId)
    .single();

  const { error } = await supabase.from("unit_submissions").insert({
    submitted_by: actor.id,
    area_id: subArea?.area_id ?? null,
    sub_area_id: subAreaId,
    jalan: jalan || null,
    unit_no: unitNo || null,
    address,
    lat: latRaw ? Number(latRaw) : null,
    lng: lngRaw ? Number(lngRaw) : null,
    discovery_type: discoveryType,
    banner_phone: bannerPhone || null,
    remarks: remarks || null,
  });

  if (error) {
    redirect("/submit-unit?error=create_failed");
  }

  redirect("/submit-unit?created=1");
}
