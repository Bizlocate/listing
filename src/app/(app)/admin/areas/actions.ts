"use server";

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";

export async function createArea(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor || actor.role !== "super_admin") {
    redirect("/");
  }

  const name = String(formData.get("name"));
  const code = String(formData.get("code")).toUpperCase();

  const supabase = await createClient();
  const { error } = await supabase.from("areas").insert({ name, code });

  if (error) {
    let errorParam = "create_failed";
    if (error.code === "23505") {
      errorParam = error.message.includes("code") ? "duplicate_code" : "duplicate_name";
    }
    redirect(`/admin/areas?error=${errorParam}`);
  }

  redirect("/admin/areas?created=1");
}
