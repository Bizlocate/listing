"use server";

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";

export async function updateOwnerSearchTask(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor || (actor.role !== "super_admin" && actor.role !== "area_admin")) {
    redirect("/");
  }

  const taskId = String(formData.get("taskId"));
  const status = String(formData.get("status"));
  const foundContact = String(formData.get("foundContact") ?? "");
  const remarks = String(formData.get("remarks") ?? "");

  const supabase = await createClient();
  const { error } = await supabase
    .from("owner_search_tasks")
    .update({
      status,
      found_contact: foundContact || null,
      remarks: remarks || null,
    })
    .eq("id", taskId);

  if (error) {
    redirect(`/owner-search/${taskId}?error=update_failed`);
  }

  redirect(`/owner-search/${taskId}?updated=1`);
}
