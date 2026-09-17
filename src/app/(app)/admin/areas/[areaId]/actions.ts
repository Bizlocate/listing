"use server";

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";

export async function createSubArea(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor || actor.role !== "super_admin") {
    redirect("/");
  }

  const areaId = String(formData.get("areaId"));
  const name = String(formData.get("name"));
  const code = String(formData.get("code")).toUpperCase();
  const population = String(formData.get("population") ?? "");
  const consumerType = String(formData.get("consumerType") ?? "");
  const commercialProfile = String(formData.get("commercialProfile") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.from("sub_areas").insert({
    area_id: areaId,
    name,
    code,
    population: population || null,
    consumer_type: consumerType || null,
    commercial_profile: commercialProfile || null,
  });

  if (error) {
    let errorParam = "create_failed";
    if (error.code === "23505") {
      errorParam = error.message.includes("code") ? "duplicate_code" : "duplicate_name";
    }
    redirect(`/admin/areas/${areaId}?error=${errorParam}`);
  }

  redirect(`/admin/areas/${areaId}?created=1`);
}

export async function assignAreaAdmin(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor || actor.role !== "super_admin") {
    redirect("/");
  }

  const areaId = String(formData.get("areaId"));
  const profileId = String(formData.get("profileId"));

  const supabase = await createClient();
  const { error } = await supabase
    .from("area_admins")
    .insert({ area_id: areaId, profile_id: profileId });

  if (error) {
    const errorParam = error.code === "23505" ? "already_assigned" : "assign_failed";
    redirect(`/admin/areas/${areaId}?error=${errorParam}`);
  }

  redirect(`/admin/areas/${areaId}?assigned=1`);
}
