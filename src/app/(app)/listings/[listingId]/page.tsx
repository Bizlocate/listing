import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { Badge } from "@/components/badge";
import { getListingById, LISTING_STATUS_LABEL, LISTING_STATUS_TONE } from "@/lib/mock/listings";

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "area_admin")) {
    redirect("/");
  }

  const { listingId } = await params;
  const listing = getListingById(listingId);
  if (!listing) {
    notFound();
  }

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/listings" className="rounded-full border border-slate-300 px-3.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
          ← Listings
        </Link>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {listing.code} {listing.exclusive ? "· exclusive" : ""}
          </div>
          <h1 className="text-xl font-semibold text-slate-900">{listing.address}</h1>
        </div>
        <Badge tone={LISTING_STATUS_TONE[listing.status]}>{LISTING_STATUS_LABEL[listing.status]}</Badge>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
            <div className="flex items-baseline gap-3">
              <div className="text-3xl font-extrabold text-slate-900">
                RM {listing.askingRental.toLocaleString()}
              </div>
              <span className="text-slate-600">/ month</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Space" value={listing.spaceLabel} />
              <Field label="Available from" value={listing.availableFrom} />
              <Field label="Verified" value={listing.lastVerified} />
            </div>
          </div>
        </div>

        <div className="space-y-3.5">
          <div className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Owner · admin only
            </div>
            <div className="font-semibold text-slate-900">{listing.ownerName}</div>
            <div className="text-sm text-slate-600">{listing.ownerContactMasked}</div>
          </div>
          <div className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Unit</div>
            <div className="text-sky-700">{listing.unitCode}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-slate-900">{value}</div>
    </div>
  );
}
