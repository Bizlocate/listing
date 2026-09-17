"use server";

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";

export async function createUnit(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor || (actor.role !== "super_admin" && actor.role !== "area_admin")) {
    redirect("/");
  }

  const subAreaId = String(formData.get("subAreaId"));
  const jalan = String(formData.get("jalan") ?? "");
  const unitNo = String(formData.get("unitNo") ?? "");
  const fullAddress = String(formData.get("fullAddress"));
  const facing = String(formData.get("facing") ?? "");
  const propertyType = String(formData.get("propertyType") ?? "");
  const landType = String(formData.get("landType") ?? "");
  const tenure = String(formData.get("tenure") ?? "");
  const tenureYearsRaw = String(formData.get("tenureYears") ?? "");
  const unitSizeRaw = String(formData.get("unitSize") ?? "");
  const unitSizeType = String(formData.get("unitSizeType") ?? "");
  const remarks = String(formData.get("remarks") ?? "");

  const supabase = await createClient();
  const { data: unit, error } = await supabase
    .from("units")
    .insert({
      sub_area_id: subAreaId,
      jalan: jalan || null,
      unit_no: unitNo || null,
      full_address: fullAddress,
      facing: facing || null,
      property_type: propertyType || null,
      land_type: landType || null,
      tenure: tenure || null,
      tenure_years: tenureYearsRaw ? Number(tenureYearsRaw) : null,
      unit_size: unitSizeRaw ? Number(unitSizeRaw) : null,
      unit_size_type: unitSizeType || null,
      remarks: remarks || null,
      created_by: actor.id,
      updated_by: actor.id,
    })
    .select("id")
    .single();

  if (error || !unit) {
    redirect("/units/new?error=create_failed");
  }

  redirect(`/units/${unit.id}`);
}
