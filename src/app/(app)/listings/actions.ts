"use server";

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import type { ListingStatus } from "@/lib/listings/status-labels";

export async function createListing(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor || (actor.role !== "super_admin" && actor.role !== "area_admin")) {
    redirect("/");
  }

  const unitId = String(formData.get("unitId"));
  const spaceId = String(formData.get("spaceId") ?? "");
  const listingType = String(formData.get("listingType"));
  const askingRentalRaw = String(formData.get("askingRental") ?? "");
  const sellingPriceRaw = String(formData.get("sellingPrice") ?? "");
  const availableFrom = String(formData.get("availableFrom") ?? "");
  const remarks = String(formData.get("remarks") ?? "");
  const intent = String(formData.get("intent"));
  const listingStatus: ListingStatus =
    intent === "pending_verification" ? "pending_verification" : "draft";

  const supabase = await createClient();
  const { error } = await supabase.from("listings").insert({
    unit_id: unitId,
    space_id: spaceId || null,
    listing_type: listingType,
    asking_rental: askingRentalRaw ? Number(askingRentalRaw) : null,
    selling_price: sellingPriceRaw ? Number(sellingPriceRaw) : null,
    available_from: availableFrom || null,
    remarks: remarks || null,
    listing_status: listingStatus,
    created_by: actor.id,
    updated_by: actor.id,
  });

  if (error) {
    redirect(`/listings/new?unitId=${unitId}&error=create_failed`);
  }

  redirect(`/units/${unitId}?listing_created=1`);
}
