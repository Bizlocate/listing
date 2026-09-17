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
    redirect(`/admin/areas?error=${error.code === "23505" ? "duplicate_code" : "create_failed"}`);
  }

  redirect("/admin/areas?created=1");
}
