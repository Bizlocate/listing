"use server";

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";

export async function requestOwnerContact(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  const listingId = String(formData.get("listingId"));
  const reason = String(formData.get("reason"));
  const tenantCompany = String(formData.get("tenantCompany") ?? "");
  const businessType = String(formData.get("businessType") ?? "");
  const budget = String(formData.get("budget") ?? "");
  const moveInDate = String(formData.get("moveInDate") ?? "");
  const remarks = String(formData.get("remarks") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.from("contact_requests").insert({
    listing_id: listingId,
    requested_by: profile.id,
    reason,
    tenant_company: tenantCompany || null,
    business_type: businessType || null,
    budget: budget ? Number(budget) : null,
    move_in_date: moveInDate || null,
    remarks: remarks || null,
  });

  if (error) {
    redirect(`/available-listings/${listingId}?error=request_failed`);
  }

  redirect(`/available-listings/${listingId}?requested=1`);
}
