import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/badge";

export default async function UnitsPage() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data: units } = await supabase
    .from("units")
    .select(
      "id, unit_code, jalan, unit_no, full_address, property_type, status, sub_areas(name, areas(name))",
    )
    .order("created_at", { ascending: false });

  const canCreate = profile.role === "super_admin" || profile.role === "area_admin";

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Units</h1>
        {canCreate ? (
          <a
            href="/units/new"
            className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
          >
            + New unit
          </a>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(units ?? []).map((u) => (
          <a
            key={u.id}
            href={`/units/${u.id}`}
            className="block rounded-2xl border border-sky-100 bg-white p-4 shadow-sm hover:border-sky-300"
          >
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {u.unit_code}
            </div>
            <div className="mt-1 font-semibold text-slate-900">
              {u.jalan} {u.unit_no}
            </div>
            <div className="mt-1 text-sm text-slate-600">
              {/* @ts-expect-error -- Supabase nested select typing */}
              {u.sub_areas?.areas?.name} / {u.sub_areas?.name} · {u.property_type}
            </div>
            <div className="mt-3">
              <Badge tone={u.status === "active" ? "ok" : "neutral"}>
                {u.status === "active" ? "Active" : "Archived"}
              </Badge>
            </div>
          </a>
        ))}
      </div>

      {(units ?? []).length === 0 ? (
        <p className="text-sm text-slate-600">No units yet.</p>
      ) : null}
    </div>
  );
}
