import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

const FIELD_CLASSES =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none";

export default async function NewListingPage() {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "area_admin")) {
    redirect("/");
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">New listing</h1>
      <p className="text-sm text-slate-600">
        Unit details are reused — you only price this cycle. (Sample form — not wired to a unit yet.)
      </p>

      <div className="space-y-5 rounded-2xl border border-sky-100 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm text-slate-700" htmlFor="space">
              Space
            </label>
            <select id="space" name="space" className={FIELD_CLASSES}>
              <option>Ground floor · 770 sf</option>
              <option>1st floor · 770 sf</option>
              <option>Whole unit</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-700" htmlFor="listingType">
              Listing type
            </label>
            <select id="listingType" name="listingType" className={FIELD_CLASSES}>
              <option>Rent</option>
              <option>Sale</option>
              <option>Rent or sale</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-700" htmlFor="askingRental">
              Asking rental (RM/month)
            </label>
            <input id="askingRental" name="askingRental" defaultValue="4,800" className={FIELD_CLASSES} />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-700" htmlFor="availableFrom">
              Available from
            </label>
            <input id="availableFrom" name="availableFrom" defaultValue="1 Oct 2026" className={FIELD_CLASSES} />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="remarks">
            Remarks for salespersons
          </label>
          <textarea
            id="remarks"
            name="remarks"
            defaultValue="Corner lot, high foot traffic. Owner prefers F&B."
            className={FIELD_CLASSES}
            rows={3}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-full bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
          >
            Send for verification
          </button>
          <button
            type="button"
            className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Save draft
          </button>
        </div>
      </div>
    </div>
  );
}
