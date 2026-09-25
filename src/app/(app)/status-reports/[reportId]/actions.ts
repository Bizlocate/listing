"use server";

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { reportEffect, type StatusReportType } from "@/lib/status-reports/labels";
import { todayInMalaysia } from "@/lib/owners/today-my";

export async function confirmStatusReport(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor || (actor.role !== "super_admin" && actor.role !== "area_admin")) {
    redirect("/");
  }

  const reportId = String(formData.get("reportId"));
  const supabase = await createClient();

  const { data: claimed } = await supabase
    .from("listing_status_reports")
    .update({ status: "confirmed", reviewed_by: actor.id, reviewed_at: new Date().toISOString() })
    .eq("id", reportId)
    .eq("status", "pending_review")
    .select("listing_id, report_type")
    .maybeSingle();

  if (!claimed) {
    redirect(`/status-reports/${reportId}?error=already_handled`);
  }

  const effect = reportEffect(claimed.report_type as StatusReportType);
  if (effect.listingStatus || effect.touchVerified) {
    const patch: Record<string, string> = { updated_by: actor.id, updated_at: new Date().toISOString() };
    if (effect.listingStatus) patch.listing_status = effect.listingStatus;
    if (effect.touchVerified) patch.last_verified_date = todayInMalaysia();

    const { data: updated, error } = await supabase
      .from("listings")
      .update(patch)
      .eq("id", claimed.listing_id)
      .select("id");
    if (error || !updated?.length) {
      redirect(`/status-reports/${reportId}?error=apply_failed`);
    }
  }

  redirect(`/status-reports/${reportId}?confirmed=1`);
}

export async function rejectStatusReport(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor || (actor.role !== "super_admin" && actor.role !== "area_admin")) {
    redirect("/");
  }

  const reportId = String(formData.get("reportId"));
  const supabase = await createClient();

  const { data: claimed } = await supabase
    .from("listing_status_reports")
    .update({ status: "rejected", reviewed_by: actor.id, reviewed_at: new Date().toISOString() })
    .eq("id", reportId)
    .eq("status", "pending_review")
    .select("id")
    .maybeSingle();

  if (!claimed) {
    redirect(`/status-reports/${reportId}?error=already_handled`);
  }

  redirect(`/status-reports/${reportId}?rejected=1`);
}
