import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { Badge } from "@/components/badge";
import {
  MOCK_LISTINGS,
  countListingsByStatus,
  LISTING_STATUS_LABEL,
  LISTING_STATUS_TONE,
} from "@/lib/mock/listings";

export default async function ListingsPage() {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "area_admin")) {
    redirect("/");
  }

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-lg font-semibold text-slate-900">Listings</h1>
        <Badge tone="ok">Available {countListingsByStatus("available")}</Badge>
        <Badge tone="accent">Reserved {countListingsByStatus("reserved")}</Badge>
        <Link
          href="/listings/new"
          className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
        >
          New listing
        </Link>
      </div>

      <div className="rounded-2xl border border-sky-100 bg-white shadow-sm">
        {MOCK_LISTINGS.map((listing, i) => (
          <Link
            key={listing.id}
            href={`/listings/${listing.id}`}
            className={`flex items-center gap-4 px-5 py-3.5 hover:bg-sky-50/60 ${
              i === MOCK_LISTINGS.length - 1 ? "" : "border-b border-sky-100"
            }`}
          >
            <div className="h-14 w-[74px] flex-none rounded-lg bg-slate-200" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">{listing.address}</p>
              <p className="text-sm text-slate-600">
                {listing.code} · {listing.spaceLabel}
              </p>
            </div>
            <Badge tone={LISTING_STATUS_TONE[listing.status]}>{LISTING_STATUS_LABEL[listing.status]}</Badge>
            <strong className="w-24 flex-none text-right text-slate-900">
              RM {listing.askingRental.toLocaleString()}
            </strong>
          </Link>
        ))}
      </div>
    </div>
  );
}
