import { redirect, notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { canSeeAllAreas, getAdminAreaIds } from "@/lib/auth/get-admin-area-ids";
import { createUnitSpace } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  space_create_failed: "Could not add space. Check the details and try again.",
};

const FLOOR_TYPES = ["Ground", "Mezzanine", "1st", "2nd", "3rd", "Upper Floor", "Whole Building", "Custom"];

export default async function UnitDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ unitId: string }>;
  searchParams: Promise<{ error?: string; space_created?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  const { unitId } = await params;
  const { error, space_created } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  const supabase = await createClient();
  const { data: unit } = await supabase
    .from("units")
    .select(
      "id, unit_code, jalan, unit_no, full_address, facing, property_type, land_type, tenure, tenure_years, unit_size, unit_size_type, remarks, status, sub_areas(name, area_id, areas(name))",
    )
    .eq("id", unitId)
    .single();

  if (!unit) {
    notFound();
  }

  const canManage =
    canSeeAllAreas(profile.role) ||
    (profile.role === "area_admin" &&
      // @ts-expect-error -- Supabase nested select typing
      (await getAdminAreaIds(profile.id)).includes(unit.sub_areas?.area_id));

  const { data: spaces } = await supabase
    .from("unit_spaces")
    .select("id, floor_type, floor_label, size, size_type, status")
    .eq("unit_id", unitId)
    .order("floor_label");

  return (
    <div className="space-y-6">
      <a className="text-sm text-sky-600" href="/units">
        ← Units
      </a>

      <div>
        <h1 className="text-lg font-semibold text-slate-900">{unit.unit_code}</h1>
        <p className="text-slate-600">
          {unit.jalan} {unit.unit_no}, {unit.full_address}
        </p>
        <p className="text-sm text-slate-600">
          {/* @ts-expect-error -- Supabase nested select typing */}
          {unit.sub_areas?.areas?.name} / {unit.sub_areas?.name}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm max-w-md">
        <dt className="text-slate-500">Facing</dt>
        <dd className="text-slate-900">{unit.facing ?? "—"}</dd>
        <dt className="text-slate-500">Property type</dt>
        <dd className="text-slate-900">{unit.property_type ?? "—"}</dd>
        <dt className="text-slate-500">Land type</dt>
        <dd className="text-slate-900">{unit.land_type ?? "—"}</dd>
        <dt className="text-slate-500">Tenure</dt>
        <dd className="text-slate-900">
          {unit.tenure ?? "—"}
          {unit.tenure_years ? ` (${unit.tenure_years} years)` : ""}
        </dd>
        <dt className="text-slate-500">Size</dt>
        <dd className="text-slate-900">
          {unit.unit_size ? `${unit.unit_size} ${unit.unit_size_type ?? ""}` : "—"}
        </dd>
        <dt className="text-slate-500">Remarks</dt>
        <dd className="text-slate-900">{unit.remarks ?? "—"}</dd>
      </dl>

      <table className="w-full max-w-2xl text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-2 pr-4">Floor</th>
            <th className="py-2 pr-4">Size</th>
            <th className="py-2 pr-4">Status</th>
          </tr>
        </thead>
        <tbody>
          {(spaces ?? []).map((s) => (
            <tr key={s.id} className="border-b border-slate-100">
              <td className="py-2 pr-4 text-slate-900">{s.floor_label}</td>
              <td className="py-2 pr-4 text-slate-600">
                {s.size ? `${s.size} ${s.size_type ?? ""}` : "—"}
              </td>
              <td className="py-2 pr-4 text-slate-600">{s.status}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {canManage ? (
        <form
          action={createUnitSpace}
          className="max-w-sm space-y-4 rounded-lg border border-sky-100 p-6 shadow-sm"
        >
          <input type="hidden" name="unitId" value={unit.id} />
          <h2 className="font-medium text-slate-900">Add space</h2>
          {space_created ? <p className="text-sm text-sky-700">Space added.</p> : null}
          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
          <div className="space-y-1">
            <label className="text-sm text-slate-700" htmlFor="floorType">
              Floor type
            </label>
            <select
              id="floorType"
              name="floorType"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
            >
              {FLOOR_TYPES.map((ft) => (
                <option key={ft} value={ft}>
                  {ft}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-700" htmlFor="floorLabel">
              Floor label (e.g. 45-G)
            </label>
            <input
              id="floorLabel"
              name="floorLabel"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-700" htmlFor="size">
              Size
            </label>
            <input
              id="size"
              name="size"
              type="number"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-700" htmlFor="sizeType">
              Size type (e.g. sqft)
            </label>
            <input
              id="sizeType"
              name="sizeType"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-sky-600 px-4 py-2 text-base font-medium text-white hover:bg-sky-700"
          >
            Add space
          </button>
        </form>
      ) : null}
    </div>
  );
}
