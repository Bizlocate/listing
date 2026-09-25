import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { canManageUsers } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";
import { describeActivity, changedKeys } from "@/lib/activity/describe";

export default async function AuditLogPage() {
  const profile = await getCurrentProfile();
  if (!profile || !canManageUsers(profile.role)) {
    redirect("/");
  }

  const supabase = await createClient();
  const { data: entries, error } = await supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, previous_value, new_value, created_at, profiles(full_name)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="max-w-5xl space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Audit log</h1>
      {error ? <p className="text-sm text-red-600">Could not load audit log: {error.message}</p> : null}

      <div className="rounded-2xl border border-sky-100 bg-white shadow-sm">
        {(entries ?? []).map((e, i, all) => {
          const keys = changedKeys(e.previous_value, e.new_value);
          return (
            <div key={e.id} className={`px-5 py-3.5 ${i === all.length - 1 ? "" : "border-b border-sky-100"}`}>
              <p className="font-semibold text-slate-900">{describeActivity(e.action, null)}</p>
              <p className="text-sm text-slate-600">
                {/* @ts-expect-error -- Supabase nested select typing */}
                {e.profiles?.full_name ?? "System"} ·{" "}
                {new Date(e.created_at).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" })} ·{" "}
                {e.entity_type} {e.entity_id ? String(e.entity_id).slice(0, 8) : ""}
              </p>
              {e.action.endsWith(".update") && keys.length > 0 ? (
                <p className="text-sm text-slate-500">Changed: {keys.join(", ")}</p>
              ) : null}
            </div>
          );
        })}
        {(entries ?? []).length === 0 ? <p className="px-5 py-4 text-sm text-slate-600">No audit entries yet.</p> : null}
      </div>
    </div>
  );
}
