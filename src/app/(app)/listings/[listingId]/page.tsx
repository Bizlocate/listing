import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/badge";
import {
  LISTING_STATUSES,
  listingStatusLabel,
  listingStatusTone,
  listingTypeLabel,
  type ListingStatus,
  type ListingType,
} from "@/lib/listings/status-labels";
import { verificationStatusLabel, contactStatusLabel } from "@/lib/owners/status-labels";
import { updateListingStatus } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  update_failed: "Could not update listing. Try again.",
};

const FIELD_CLASSES =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none";

export default async function ListingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ listingId: string }>;
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "area_admin")) {
    redirect("/");
  }

  const { listingId } = await params;
  const { error, updated } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  const supabase = await createClient();
  const { data: listing } = await supabase
    .from("listings")
    .select(
      "id, unit_id, listing_type, asking_rental, selling_price, listing_status, available_from, remarks, units(unit_code, jalan, unit_no, full_address, sub_areas(name, areas(name))), unit_spaces(floor_label)",
    )
    .eq("id", listingId)
    .single();

  if (!listing) {
    notFound();
  }

  const { data: ownerships } = await supabase
    .from("unit_ownerships")
    .select("id, owners(id, name, primary_contact, verification_status, contact_status)")
    .eq("unit_id", listing.unit_id);

  return (
    <div className="max-w-4xl space-y-5">
      <Link
        href="/listings"
        className="rounded-full border border-slate-300 px-3.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
      >
        ← Listings
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {/* @ts-expect-error -- Supabase nested select typing */}
            {listing.units?.unit_code} · {listingTypeLabel(listing.listing_type as ListingType)}
          </div>
          <h1 className="text-xl font-semibold text-slate-900">
            {/* @ts-expect-error -- Supabase nested select typing */}
            {listing.units?.jalan} {listing.units?.unit_no}
          </h1>
          <p className="text-sm text-slate-600">
            {/* @ts-expect-error -- Supabase nested select typing */}
            {listing.units?.sub_areas?.areas?.name} / {listing.units?.sub_areas?.name} ·{" "}
            {/* @ts-expect-error -- Supabase nested select typing */}
            {listing.unit_spaces?.floor_label ?? "Whole unit"}
          </p>
        </div>
        <Badge tone={listingStatusTone(listing.listing_status as ListingStatus)}>
          {listingStatusLabel(listing.listing_status as ListingStatus)}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
            <div className="flex items-baseline gap-3">
              <div className="text-3xl font-extrabold text-slate-900">
                {listing.asking_rental ? `RM ${Number(listing.asking_rental).toLocaleString()}` : "—"}
              </div>
              {listing.asking_rental ? <span className="text-slate-600">/ month</span> : null}
            </div>
            {listing.selling_price ? (
              <p className="mt-1 text-slate-600">
                Selling: RM {Number(listing.selling_price).toLocaleString()}
              </p>
            ) : null}
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Available from" value={listing.available_from} />
              <Field label="Remarks" value={listing.remarks} />
            </div>
          </div>

          <form
            action={updateListingStatus}
            className="max-w-sm space-y-4 rounded-2xl border border-sky-100 bg-white p-5 shadow-sm"
          >
            <input type="hidden" name="listingId" value={listing.id} />
            <h2 className="font-medium text-slate-900">Update status</h2>
            {updated ? <p className="text-sm text-sky-700">Listing updated.</p> : null}
            {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
            <div className="space-y-1">
              <label className="text-sm text-slate-700" htmlFor="listingStatus">
                Status
              </label>
              <select
                id="listingStatus"
                name="listingStatus"
                defaultValue={listing.listing_status}
                className={FIELD_CLASSES}
              >
                {LISTING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {listingStatusLabel(s)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-sky-600 px-4 py-2 text-base font-medium text-white hover:bg-sky-700"
            >
              Save
            </button>
          </form>
        </div>

        <div className="space-y-3.5">
          <div className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Owner · admin only
            </div>
            {(ownerships ?? []).length === 0 ? (
              <p className="mt-1 text-sm text-slate-600">No owner on record yet.</p>
            ) : (
              (ownerships ?? []).map((o) => (
                <div key={o.id} className="mt-2 first:mt-0">
                  <a
                    className="font-semibold text-sky-700"
                    // @ts-expect-error -- Supabase nested select typing
                    href={`/owners/${o.owners?.id}`}
                  >
                    {/* @ts-expect-error -- Supabase nested select typing */}
                    {o.owners?.name}
                  </a>
                  <div className="text-sm text-slate-600">
                    {/* @ts-expect-error -- Supabase nested select typing */}
                    {o.owners?.primary_contact ?? "—"}
                  </div>
                  <div className="mt-1 flex gap-1">
                    <Badge tone="accent">
                      {/* @ts-expect-error -- Supabase nested select typing */}
                      {verificationStatusLabel(o.owners?.verification_status)}
                    </Badge>
                    <Badge tone="neutral">
                      {/* @ts-expect-error -- Supabase nested select typing */}
                      {contactStatusLabel(o.owners?.contact_status)}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Unit</div>
            <a className="text-sky-700" href={`/units/${listing.unit_id}`}>
              {/* @ts-expect-error -- Supabase nested select typing */}
              {listing.units?.unit_code}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-slate-900">{value ?? "—"}</div>
    </div>
  );
}
