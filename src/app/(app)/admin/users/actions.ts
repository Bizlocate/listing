"use server";

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Role } from "@/lib/auth/role";

const VALID_ROLES: Role[] = ["super_admin", "area_admin", "sp"];

export async function createUser(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor || actor.role !== "super_admin") {
    redirect("/");
  }

  const fullName = String(formData.get("fullName"));
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const roleInput = String(formData.get("role"));
  const role: Role = VALID_ROLES.includes(roleInput as Role) ? (roleInput as Role) : "sp";

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });

  if (error) {
    redirect("/admin/users?error=create_failed");
  }

  redirect("/admin/users?created=1");
}
