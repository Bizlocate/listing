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

export async function createOwnerForUnit(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor || (actor.role !== "super_admin" && actor.role !== "area_admin")) {
    redirect("/");
  }

  const unitId = String(formData.get("unitId"));
  const spaceId = String(formData.get("spaceId") ?? "");
  const name = String(formData.get("name"));
  const primaryContact = String(formData.get("primaryContact") ?? "");
  const otherContact = String(formData.get("otherContact") ?? "");
  const icOrCompanyNo = String(formData.get("icOrCompanyNo") ?? "");
  const ownerType = String(formData.get("ownerType") ?? "");
  const remarks = String(formData.get("remarks") ?? "");

  const supabase = await createClient();
  const { data: owner, error: ownerError } = await supabase
    .from("owners")
    .insert({
      name,
      primary_contact: primaryContact || null,
      other_contact: otherContact || null,
      ic_or_company_no: icOrCompanyNo || null,
      owner_type: ownerType || null,
      remarks: remarks || null,
      created_by: actor.id,
    })
    .select("id")
    .single();

  if (ownerError || !owner) {
    redirect(`/units/${unitId}?error=owner_create_failed`);
  }

  const { error: ownershipError } = await supabase.from("unit_ownerships").insert({
    unit_id: unitId,
    space_id: spaceId || null,
    owner_id: owner!.id,
  });

  if (ownershipError) {
    await supabase.from("owners").delete().eq("id", owner!.id);
    redirect(`/units/${unitId}?error=ownership_link_failed`);
  }

  redirect(`/units/${unitId}?owner_added=1`);
}
