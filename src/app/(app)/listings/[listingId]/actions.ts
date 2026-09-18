"use server";

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";

export async function updateListingStatus(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor || (actor.role !== "super_admin" && actor.role !== "area_admin")) {
    redirect("/");
  }

  const listingId = String(formData.get("listingId"));
  const listingStatus = String(formData.get("listingStatus"));

  const supabase = await createClient();
  const { error } = await supabase
    .from("listings")
    .update({ listing_status: listingStatus, updated_by: actor.id })
    .eq("id", listingId);

  if (error) {
    redirect(`/listings/${listingId}?error=update_failed`);
  }

  redirect(`/listings/${listingId}?updated=1`);
}
