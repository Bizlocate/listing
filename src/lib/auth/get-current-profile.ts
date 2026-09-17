import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/auth/role";

export async function getCurrentProfile(): Promise<{
  id: string;
  fullName: string;
  role: Role;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "active") {
    // Stale session (missing/suspended profile): clear it so /login isn't a dead loop.
    await supabase.auth.signOut();
    return null;
  }

  return { id: profile.id, fullName: profile.full_name, role: profile.role as Role };
}
