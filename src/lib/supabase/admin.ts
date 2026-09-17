import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS entirely. Server-only: never import this
// from a Client Component or anything that ships to the browser. Used for
// admin actions Supabase's regular auth API requires elevated privileges for
// (e.g. creating users directly instead of via public self-signup).
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
