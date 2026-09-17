import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { canSeeAllAreas, getAdminAreaIds } from "@/lib/auth/get-admin-area-ids";
import { createUnit } from "../actions";

const ERROR_MESSAGES: Record<string, string> = {
  create_failed: "Could not create unit. Check the details and try again.",
};

export default async function NewUnitPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "area_admin")) {
    redirect("/");
  }

  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  const supabase = await createClient();

  let subAreaQuery = supabase
    .from("sub_areas")
    .select("id, name, code, area_id, areas(name)")
    .order("name");

  if (!canSeeAllAreas(profile.role)) {
    const areaIds = await getAdminAreaIds(profile.id);
    subAreaQuery = subAreaQuery.in("area_id", areaIds.length > 0 ? areaIds : ["00000000-0000-0000-0000-000000000000"]);
  }

  const { data: subAreas } = await subAreaQuery;

  return (
    <div className="space-y-6">
      <a className="text-sm text-sky-600" href="/units">
        ← Units
      </a>
      <h1 className="text-lg font-semibold text-slate-900">New unit</h1>

      <form
        action={createUnit}
        className="max-w-sm space-y-4 rounded-lg border border-sky-100 p-6 shadow-sm"
      >
        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="subAreaId">
            Sub-area
          </label>
          <select
            id="subAreaId"
            name="subAreaId"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          >
            <option value="">Select a sub-area</option>
            {(subAreas ?? []).map((sa) => (
              <option key={sa.id} value={sa.id}>
                {/* @ts-expect-error -- Supabase nested select typing */}
                {sa.areas?.name} / {sa.name}
              </option>
            ))}
          </select>
          {!canSeeAllAreas(profile.role) && (subAreas ?? []).length === 0 ? (
            <p className="text-sm text-sky-700">
              No sub-areas are available in your assigned areas. Ask a Super Admin to
              assign you an area.
            </p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="jalan">
            Jalan
          </label>
          <input
            id="jalan"
            name="jalan"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="unitNo">
            Unit no
          </label>
          <input
            id="unitNo"
            name="unitNo"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="fullAddress">
            Full address
          </label>
          <input
            id="fullAddress"
            name="fullAddress"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="facing">
            Facing
          </label>
          <input
            id="facing"
            name="facing"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="propertyType">
            Property type
          </label>
          <input
            id="propertyType"
            name="propertyType"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="landType">
            Land type
          </label>
          <input
            id="landType"
            name="landType"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="tenure">
            Tenure
          </label>
          <input
            id="tenure"
            name="tenure"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="tenureYears">
            Tenure years
          </label>
          <input
            id="tenureYears"
            name="tenureYears"
            type="number"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="unitSize">
            Unit size
          </label>
          <input
            id="unitSize"
            name="unitSize"
            type="number"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="unitSizeType">
            Unit size type (e.g. sqft)
          </label>
          <input
            id="unitSizeType"
            name="unitSizeType"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="remarks">
            Remarks
          </label>
          <textarea
            id="remarks"
            name="remarks"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-sky-600 px-4 py-2 text-base font-medium text-white hover:bg-sky-700"
        >
          Create unit
        </button>
      </form>
    </div>
  );
}
