import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/badge";

export default async function UnitSubmissionsPage() {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "area_admin")) {
    redirect("/");
  }

  const supabase = await createClient();
  const { data: submissions } = await supabase
    .from("unit_submissions")
    .select("id, jalan, unit_no, address, discovery_type, status, created_at, sub_areas(name, areas(name))")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const rows = submissions ?? [];

  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Unit submissions</h1>

      <div className="rounded-2xl border border-sky-100 bg-white shadow-sm">
        {rows.map((s, i) => (
          <a
            key={s.id}
            href={`/unit-submissions/${s.id}`}
            className={`flex items-center gap-4 px-5 py-3.5 hover:bg-sky-50/60 ${
              i === rows.length - 1 ? "" : "border-b border-sky-100"
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">
                {s.jalan} {s.unit_no}
              </p>
              <p className="text-sm text-slate-600">
                {s.address} ·{" "}
                {/* @ts-expect-error -- Supabase nested select typing */}
                {s.sub_areas?.areas?.name} / {s.sub_areas?.name}
              </p>
            </div>
            <Badge tone="neutral">{s.discovery_type}</Badge>
          </a>
        ))}
        {rows.length === 0 ? <p className="px-5 py-4 text-sm text-slate-600">No pending submissions.</p> : null}
      </div>
    </div>
  );
}
