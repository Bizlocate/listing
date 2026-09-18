import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";

export default async function AvailableListingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data: listings } = await supabase
    .from("available_listings")
    .select("id, jalan, unit_no, unit_code, sub_area_name, area_name, floor_label, asking_rental")
    .order("last_verified_date", { ascending: false });

  const rows = listings ?? [];

  return (
    <div className="max-w-5xl space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Available listings</h1>

      <div className="rounded-2xl border border-sky-100 bg-white shadow-sm">
        {rows.map((listing, i) => (
          <Link
            key={listing.id}
            href={`/available-listings/${listing.id}`}
            className={`flex items-center gap-4 px-5 py-3.5 hover:bg-sky-50/60 ${
              i === rows.length - 1 ? "" : "border-b border-sky-100"
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">
                {listing.jalan} {listing.unit_no}
              </p>
              <p className="text-sm text-slate-600">
                {listing.unit_code} · {listing.area_name} / {listing.sub_area_name} ·{" "}
                {listing.floor_label ?? "Whole unit"}
              </p>
            </div>
            <strong className="text-slate-900">
              {listing.asking_rental ? `RM ${Number(listing.asking_rental).toLocaleString()}` : "—"}
            </strong>
          </Link>
        ))}
        {rows.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-600">No available listings.</p>
        ) : null}
      </div>
    </div>
  );
}
