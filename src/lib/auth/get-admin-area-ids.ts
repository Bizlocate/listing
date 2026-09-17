import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/auth/role";

export function canSeeAllAreas(role: Role): boolean {
  return role === "super_admin";
}

// Returns the area ids this user is an Area Admin for. Meaningless for
// super_admin (who can see/write everywhere regardless) — callers should
// check canSeeAllAreas(role) first and skip calling this for super_admin.
export async function getAdminAreaIds(profileId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("area_admins")
    .select("area_id")
    .eq("profile_id", profileId);

  if (error) {
    console.error("[getAdminAreaIds] failed to load area assignments", error);
  }

  return (data ?? []).map((row) => row.area_id);
}
