import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { createListing } from "../actions";

const FIELD_CLASSES =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none";

const ERROR_MESSAGES: Record<string, string> = {
  create_failed: "Could not create listing. Check the details and try again.",
};

export default async function NewListingPage({
  searchParams,
}: {
  searchParams: Promise<{ unitId?: string; error?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "area_admin")) {
    redirect("/");
  }

  const { unitId, error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  if (!unitId) {
    return (
      <div className="max-w-2xl space-y-4">
        <h1 className="text-lg font-semibold text-slate-900">New listing</h1>
        <p className="text-sm text-slate-600">
          Listings are created from a unit, so its details are reused instead
          of retyped. Pick a unit first.
        </p>
        <a
          href="/units"
          className="inline-block rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
        >
          Go to Units
        </a>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: unit } = await supabase
    .from("units")
    .select("id, unit_code, jalan, unit_no, full_address")
    .eq("id", unitId)
    .single();

  if (!unit) {
    return (
      <div className="max-w-2xl space-y-4">
        <h1 className="text-lg font-semibold text-slate-900">New listing</h1>
        <p className="text-sm text-red-600">That unit could not be found.</p>
        <a href="/units" className="text-sky-600">
          ← Units
        </a>
      </div>
    );
  }

  const { data: spaces } = await supabase
    .from("unit_spaces")
    .select("id, floor_label")
    .eq("unit_id", unitId)
    .order("floor_label");

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">New listing</h1>
      <p className="text-sm text-slate-600">
        {unit.unit_code} — {unit.jalan} {unit.unit_no}, {unit.full_address}
      </p>

      <form
        action={createListing}
        className="space-y-5 rounded-2xl border border-sky-100 bg-white p-6 shadow-sm"
      >
        <input type="hidden" name="unitId" value={unit.id} />
        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm text-slate-700" htmlFor="spaceId">
              Space
            </label>
            <select id="spaceId" name="spaceId" className={FIELD_CLASSES}>
              <option value="">Whole unit</option>
              {(spaces ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.floor_label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-700" htmlFor="listingType">
              Listing type
            </label>
            <select id="listingType" name="listingType" defaultValue="rent" className={FIELD_CLASSES}>
              <option value="rent">Rent</option>
              <option value="sale">Sale</option>
              <option value="rent_sale">Rent &amp; Sale</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-700" htmlFor="askingRental">
              Asking rental (RM/month)
            </label>
            <input id="askingRental" name="askingRental" type="number" className={FIELD_CLASSES} />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-700" htmlFor="sellingPrice">
              Selling price (RM)
            </label>
            <input id="sellingPrice" name="sellingPrice" type="number" className={FIELD_CLASSES} />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-700" htmlFor="availableFrom">
              Available from
            </label>
            <input id="availableFrom" name="availableFrom" type="date" className={FIELD_CLASSES} />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="remarks">
            Remarks for salespersons
          </label>
          <textarea id="remarks" name="remarks" className={FIELD_CLASSES} rows={3} />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            name="intent"
            value="pending_verification"
            className="rounded-full bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
          >
            Send for verification
          </button>
          <button
            type="submit"
            name="intent"
            value="draft"
            className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Save draft
          </button>
        </div>
      </form>
    </div>
  );
}
