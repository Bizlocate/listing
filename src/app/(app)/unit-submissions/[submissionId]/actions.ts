"use server";

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";

export async function linkSubmissionToUnit(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor || (actor.role !== "super_admin" && actor.role !== "area_admin")) {
    redirect("/");
  }

  const submissionId = String(formData.get("submissionId"));
  const unitId = String(formData.get("unitId"));

  const supabase = await createClient();
  const { error } = await supabase
    .from("unit_submissions")
    .update({ status: "linked", matched_unit_id: unitId })
    .eq("id", submissionId);

  if (error) {
    redirect(`/unit-submissions/${submissionId}?error=link_failed`);
  }

  redirect("/unit-submissions?linked=1");
}

export async function createUnitFromSubmission(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor || (actor.role !== "super_admin" && actor.role !== "area_admin")) {
    redirect("/");
  }

  const submissionId = String(formData.get("submissionId"));
  const subAreaId = String(formData.get("subAreaId"));
  const jalan = String(formData.get("jalan") ?? "");
  const unitNo = String(formData.get("unitNo") ?? "");
  const address = String(formData.get("address"));

  const supabase = await createClient();

  const { data: unit, error: unitError } = await supabase
    .from("units")
    .insert({
      sub_area_id: subAreaId,
      jalan: jalan || null,
      unit_no: unitNo || null,
      full_address: address,
      created_by: actor.id,
      updated_by: actor.id,
    })
    .select("id")
    .single();

  if (unitError || !unit) {
    redirect(`/unit-submissions/${submissionId}?error=create_failed`);
  }

  const { error: searchTaskError } = await supabase
    .from("owner_search_tasks")
    .insert({ unit_id: unit!.id });

  if (searchTaskError) {
    redirect(`/unit-submissions/${submissionId}?error=search_task_failed`);
  }

  const { error: submissionError } = await supabase
    .from("unit_submissions")
    .update({ status: "converted", matched_unit_id: unit!.id })
    .eq("id", submissionId);

  if (submissionError) {
    redirect(`/unit-submissions/${submissionId}?error=update_failed`);
  }

  redirect(`/units/${unit!.id}?converted=1`);
}
