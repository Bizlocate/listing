"use server";

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";

export async function approveContactRequest(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor || (actor.role !== "super_admin" && actor.role !== "area_admin")) {
    redirect("/");
  }

  const requestId = String(formData.get("requestId"));
  const supabase = await createClient();

  const { data: request } = await supabase
    .from("contact_requests")
    .select("id, listing_id, requested_by, reason, listings(unit_id)")
    .eq("id", requestId)
    .single();

  if (!request) {
    redirect("/contact-requests");
  }

  // @ts-expect-error -- Supabase nested select typing
  const unitId = request.listings?.unit_id as string | undefined;
  const { data: ownership } = await supabase
    .from("unit_ownerships")
    .select("owner_id")
    .eq("unit_id", unitId)
    .is("end_date", null)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!ownership) {
    redirect(`/contact-requests/${requestId}?error=no_owner`);
  }

  const { data: claimed } = await supabase
    .from("contact_requests")
    .update({ status: "approved", approved_by: actor.id, approved_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "pending")
    .select()
    .maybeSingle();

  if (!claimed) {
    redirect(`/contact-requests/${requestId}?error=already_handled`);
  }

  const accessExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const { error: logError } = await supabase.from("contact_access_logs").insert({
    contact_request_id: requestId,
    user_id: request.requested_by,
    owner_id: ownership!.owner_id,
    unit_id: unitId,
    listing_id: request.listing_id,
    reason: request.reason,
    approved_by: actor.id,
    access_expiry: accessExpiry,
  });

  if (logError) {
    redirect(`/contact-requests/${requestId}?error=access_log_failed`);
  }

  redirect(`/contact-requests/${requestId}?approved=1`);
}

export async function rejectContactRequest(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor || (actor.role !== "super_admin" && actor.role !== "area_admin")) {
    redirect("/");
  }

  const requestId = String(formData.get("requestId"));
  const supabase = await createClient();

  const { data: claimed } = await supabase
    .from("contact_requests")
    .update({ status: "rejected", approved_by: actor.id, approved_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "pending")
    .select()
    .maybeSingle();

  if (!claimed) {
    redirect(`/contact-requests/${requestId}?error=already_handled`);
  }

  redirect(`/contact-requests/${requestId}?rejected=1`);
}

export async function revokeContactAccess(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor || (actor.role !== "super_admin" && actor.role !== "area_admin")) {
    redirect("/");
  }

  const requestId = String(formData.get("contactRequestId"));
  const supabase = await createClient();

  await supabase
    .from("contact_access_logs")
    .update({ revoked: true })
    .eq("contact_request_id", requestId)
    .eq("revoked", false);

  redirect(`/contact-requests/${requestId}?revoked=1`);
}
