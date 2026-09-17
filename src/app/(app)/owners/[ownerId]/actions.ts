"use server";

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { todayInMalaysia } from "@/lib/owners/today-my";

export async function updateOwner(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor || (actor.role !== "super_admin" && actor.role !== "area_admin")) {
    redirect("/");
  }

  const ownerId = String(formData.get("ownerId"));
  const verificationStatus = String(formData.get("verificationStatus"));
  const contactStatus = String(formData.get("contactStatus"));
  const remarks = String(formData.get("remarks") ?? "");

  const update: Record<string, unknown> = {
    verification_status: verificationStatus,
    contact_status: contactStatus,
    remarks: remarks || null,
  };

  if (verificationStatus === "verified_owner") {
    update.last_verified_date = todayInMalaysia();
  }

  const supabase = await createClient();
  const { error } = await supabase.from("owners").update(update).eq("id", ownerId);

  if (error) {
    redirect(`/owners/${ownerId}?error=update_failed`);
  }

  redirect(`/owners/${ownerId}?updated=1`);
}
