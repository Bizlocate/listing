import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Units</h1>
        {canCreate ? (
          <a
            href="/units/new"
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
          >
            + New unit
          </a>
        ) : null}
      </div>

      <table className="w-full max-w-3xl text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-2 pr-4">Unit code</th>
            <th className="py-2 pr-4">Address</th>
            <th className="py-2 pr-4">Area</th>
            <th className="py-2 pr-4">Type</th>
            <th className="py-2 pr-4">Status</th>
          </tr>
        </thead>
        <tbody>
          {(units ?? []).map((u) => (
            <tr key={u.id} className="border-b border-slate-100">
              <td className="py-2 pr-4 text-sky-700">
                <a href={`/units/${u.id}`}>{u.unit_code}</a>
              </td>
              <td className="py-2 pr-4 text-slate-900">
                {u.jalan} {u.unit_no}
              </td>
              <td className="py-2 pr-4 text-slate-600">
                {/* @ts-expect-error -- Supabase nested select typing */}
                {u.sub_areas?.areas?.name} / {u.sub_areas?.name}
              </td>
              <td className="py-2 pr-4 text-slate-600">{u.property_type}</td>
              <td className="py-2 pr-4 text-slate-600">{u.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
