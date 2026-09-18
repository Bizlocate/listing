import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/badge";
import { listingStatusLabel, listingStatusTone, type ListingStatus } from "@/lib/listings/status-labels";

export default async function ListingsPage() {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "area_admin")) {
    redirect("/");
  }

  const supabase = await createClient();
  const { data: listings } = await supabase
    .from("listings")
    .select(
      "id, asking_rental, listing_status, units(unit_code, jalan, unit_no), unit_spaces(floor_label)",
    )
    .order("created_at", { ascending: false });

  const rows = listings ?? [];
  const availableCount = rows.filter((l) => l.listing_status === "available").length;
  const reservedCount = rows.filter((l) => l.listing_status === "reserved").length;

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-lg font-semibold text-slate-900">Listings</h1>
        <Badge tone="ok">Available {availableCount}</Badge>
        <Badge tone="accent">Reserved {reservedCount}</Badge>
        <Link
          href="/units"
          className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
        >
          New listing
        </Link>
      </div>

      <div className="rounded-2xl border border-sky-100 bg-white shadow-sm">
        {rows.map((listing, i) => (
          <Link
            key={listing.id}
            href={`/listings/${listing.id}`}
            className={`flex items-center gap-4 px-5 py-3.5 hover:bg-sky-50/60 ${
              i === rows.length - 1 ? "" : "border-b border-sky-100"
            }`}
          >
            <div className="h-14 w-[74px] flex-none rounded-lg bg-slate-200" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">
                {/* @ts-expect-error -- Supabase nested select typing */}
                {listing.units?.jalan} {listing.units?.unit_no}
              </p>
              <p className="text-sm text-slate-600">
                {/* @ts-expect-error -- Supabase nested select typing */}
                {listing.units?.unit_code} · {listing.unit_spaces?.floor_label ?? "Whole unit"}
              </p>
            </div>
            <Badge tone={listingStatusTone(listing.listing_status as ListingStatus)}>
              {listingStatusLabel(listing.listing_status as ListingStatus)}
            </Badge>
            <strong className="w-24 flex-none text-right text-slate-900">
              {listing.asking_rental ? `RM ${Number(listing.asking_rental).toLocaleString()}` : "—"}
            </strong>
          </Link>
        ))}
        {rows.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-600">No listings yet.</p>
        ) : null}
      </div>
    </div>
  );
}
