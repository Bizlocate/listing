import { redirect, notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { canSeeAllAreas, getAdminAreaIds } from "@/lib/auth/get-admin-area-ids";
import { verificationStatusLabel, contactStatusLabel } from "@/lib/owners/status-labels";
import {
  listingStatusLabel,
  listingStatusTone,
  listingTypeLabel,
  type ListingStatus,
  type ListingType,
} from "@/lib/listings/status-labels";
import { describeActivity } from "@/lib/activity/describe";
import { Badge } from "@/components/badge";
import { UnitDetailTabs } from "@/components/unit-detail-tabs";
import { UnitPhotoUploader, UnitDocumentUploader } from "@/components/unit-media-uploaders";
import { createUnitSpace, createOwnerForUnit } from "./actions";
import { deleteUnitPhoto, deleteUnitDocument } from "./media-actions";

const DOC_TYPE_LABELS: Record<string, string> = { ic: "IC", hakmilik: "Hakmilik", other: "Other" };

const ERROR_MESSAGES: Record<string, string> = {
  space_create_failed: "Could not add space. Check the details and try again.",
  owner_create_failed: "Could not create owner. Check the details and try again.",
  ownership_link_failed: "Could not link owner to this unit. The owner record was not saved.",
};

const FLOOR_TYPES = ["Ground", "Mezzanine", "1st", "2nd", "3rd", "Upper Floor", "Whole Building", "Custom"];

const FIELD_CLASSES =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none";

export default async function UnitDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ unitId: string }>;
  searchParams: Promise<{
    error?: string;
    space_created?: string;
    owner_added?: string;
    listing_created?: string;
    tab?: string;
  }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  const { unitId } = await params;
  const { error, space_created, owner_added, listing_created, tab } = await searchParams;
  const deleteError = error === "delete_failed" ? "Could not delete the file. Try again." : null;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;
  const initialTab: "overview" | "spaces" | "owner" | "listings" | "timeline" =
    tab === "owner"
      ? "owner"
      : tab === "timeline"
        ? "timeline"
        : listing_created
        ? "listings"
        : owner_added || error === "owner_create_failed" || error === "ownership_link_failed"
          ? "owner"
          : space_created || error === "space_create_failed"
            ? "spaces"
            : "overview";

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

  const ownerships = canManage
    ? (
        await supabase
          .from("unit_ownerships")
          .select(
            "id, space_id, is_primary, unit_spaces(floor_label), owners(id, name, primary_contact, verification_status, contact_status)",
          )
          .eq("unit_id", unitId)
      ).data
    : null;

  const { data: listings } = await supabase
    .from("listings")
    .select("id, listing_type, asking_rental, listing_status, unit_spaces(floor_label)")
    .eq("unit_id", unitId)
    .order("created_at", { ascending: false });

  // Activities RLS returns zero rows (no error) for non-admins, so skip the query for them.
  const { data: activities, error: activitiesError } = canManage
    ? await supabase
        .from("activities")
        .select("id, action, detail, actor_id, created_at, profiles(full_name)")
        .eq("unit_id", unitId)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: null, error: null };

  const { data: photos, error: photosError } = await supabase
    .from("unit_photos")
    .select("id, url, photo_type")
    .eq("unit_id", unitId)
    .order("created_at", { ascending: false });

  const photoUrls = new Map<string, string>();
  let photoUrlsError: string | null = null;
  if (photos && photos.length > 0) {
    const { data: signed, error: signError } = await supabase.storage
      .from("unit-photos")
      .createSignedUrls(
        photos.map((p) => p.url),
        3600,
      );
    if (signError) photoUrlsError = signError.message;
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) photoUrls.set(s.path, s.signedUrl);
    }
  }

  // Documents are admin-only: skip both the query and signed URLs for everyone else.
  let documents: { id: string; url: string; doc_type: string }[] = [];
  let documentsError: string | null = null;
  const documentUrls = new Map<string, string>();
  if (canManage) {
    const { data: docs, error: docsError } = await supabase
      .from("unit_documents")
      .select("id, url, doc_type")
      .eq("unit_id", unitId);
    if (docsError) documentsError = docsError.message;
    documents = docs ?? [];
    if (documents.length > 0) {
      const { data: signed, error: signError } = await supabase.storage
        .from("unit-documents")
        .createSignedUrls(
          documents.map((d) => d.url),
          300,
        );
      if (signError) documentsError = signError.message;
      for (const s of signed ?? []) {
        if (s.path && s.signedUrl) documentUrls.set(s.path, s.signedUrl);
      }
    }
  }

  const timelineContent = !canManage ? (
    <p className="text-sm text-slate-600">Timeline is restricted to admins.</p>
  ) : (
    <div>
      {activitiesError ? <p className="text-sm text-red-600">Could not load timeline: {activitiesError.message}</p> : null}
      <ol className="space-y-3">
        {(activities ?? []).map((a) => (
          <li key={a.id} className="border-b border-sky-100 pb-3 last:border-0">
            <p className="font-semibold text-slate-900">{describeActivity(a.action, a.detail)}</p>
            <p className="text-sm text-slate-600">
              {/* @ts-expect-error -- Supabase nested select typing */}
              {a.profiles?.full_name ?? (a.actor_id ? "Team member" : "System")} ·{" "}
              {new Date(a.created_at).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" })}
            </p>
          </li>
        ))}
      </ol>
      {(activities ?? []).length === 0 ? <p className="text-sm text-slate-600">No activity yet.</p> : null}
    </div>
  );

  const overviewContent = (
    <>
      {deleteError ? <p className="mb-4 text-sm text-red-600">{deleteError}</p> : null}
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        <Field label="Facing" value={unit.facing} />
        <Field label="Property type" value={unit.property_type} />
        <Field label="Land type" value={unit.land_type} />
        <Field
          label="Tenure"
          value={unit.tenure ? `${unit.tenure}${unit.tenure_years ? ` (${unit.tenure_years} yrs)` : ""}` : null}
        />
        <Field
          label="Size"
          value={unit.unit_size ? `${unit.unit_size} ${unit.unit_size_type ?? ""}` : null}
        />
      </div>
      <p className="mt-4 text-sm text-slate-600">{unit.remarks ?? "No remarks."}</p>

      <section className="mt-6 space-y-3">
        <h3 className="font-medium text-slate-900">Photos</h3>
        {photosError ? <p className="text-sm text-red-600">Could not load photos: {photosError.message}</p> : null}
        {photoUrlsError ? <p className="text-sm text-red-600">Could not load photo images: {photoUrlsError}</p> : null}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(photos ?? []).map((p) => (
            <div key={p.id} className="space-y-1">
              {photoUrls.get(p.url) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoUrls.get(p.url)}
                  alt={`${p.photo_type} photo of ${unit.unit_code}`}
                  className="h-32 w-full rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-32 w-full items-center justify-center rounded-lg bg-slate-100 text-sm text-slate-500">
                  Unavailable
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <Badge tone="neutral">{p.photo_type}</Badge>
                {canManage ? (
                  <form action={deleteUnitPhoto}>
                    <input type="hidden" name="unitId" value={unit.id} />
                    <input type="hidden" name="photoId" value={p.id} />
                    <button type="submit" className="text-sm text-red-600 hover:underline">
                      Delete
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        {!photosError && (photos ?? []).length === 0 ? <p className="text-sm text-slate-600">No photos yet.</p> : null}
        {canManage ? <UnitPhotoUploader unitId={unit.id} /> : null}
      </section>

      {canManage ? (
        <section className="mt-6 space-y-3">
          <h3 className="font-medium text-slate-900">Documents · admin only</h3>
          {documentsError ? <p className="text-sm text-red-600">Could not load documents: {documentsError}</p> : null}
          <ul className="space-y-2">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center gap-3 rounded-xl bg-sky-50 px-4 py-2">
                {documentUrls.get(d.url) ? (
                  <a
                    href={documentUrls.get(d.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 flex-1 truncate font-semibold text-sky-700"
                  >
                    {DOC_TYPE_LABELS[d.doc_type] ?? d.doc_type}
                  </a>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-slate-500">
                    {DOC_TYPE_LABELS[d.doc_type] ?? d.doc_type} (unavailable)
                  </span>
                )}
                <form action={deleteUnitDocument}>
                  <input type="hidden" name="unitId" value={unit.id} />
                  <input type="hidden" name="documentId" value={d.id} />
                  <button type="submit" className="text-sm text-red-600 hover:underline">
                    Delete
                  </button>
                </form>
              </li>
            ))}
          </ul>
          {!documentsError && documents.length === 0 ? <p className="text-sm text-slate-600">No documents yet.</p> : null}
          <UnitDocumentUploader unitId={unit.id} />
        </section>
      ) : null}
    </>
  );

  const spacesContent = (
    <div className="grid gap-3">
      {(spaces ?? []).map((s) => (
        <div
          key={s.id}
          className="flex items-center gap-3 rounded-xl bg-sky-50 px-4 py-3"
        >
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-900">{s.floor_label}</p>
            <p className="text-sm text-slate-600">
              {s.size ? `${s.size} ${s.size_type ?? ""}` : "Size not set"}
            </p>
          </div>
          <Badge tone="neutral">{s.status}</Badge>
        </div>
      ))}
      {(spaces ?? []).length === 0 ? <p className="text-sm text-slate-600">No spaces yet.</p> : null}

      {canManage ? (
        <form
          action={createUnitSpace}
          className="mt-2 max-w-sm space-y-4 rounded-xl border border-sky-100 p-5"
        >
          <input type="hidden" name="unitId" value={unit.id} />
          <h3 className="font-medium text-slate-900">Add space</h3>
          {space_created ? <p className="text-sm text-sky-700">Space added.</p> : null}
          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
          <div className="space-y-1">
            <label className="text-sm text-slate-700" htmlFor="floorType">
              Floor type
            </label>
            <select id="floorType" name="floorType" required className={FIELD_CLASSES}>
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
            <input id="floorLabel" name="floorLabel" required className={FIELD_CLASSES} />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-700" htmlFor="size">
              Size
            </label>
            <input id="size" name="size" type="number" className={FIELD_CLASSES} />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-700" htmlFor="sizeType">
              Size type (e.g. sqft)
            </label>
            <input id="sizeType" name="sizeType" className={FIELD_CLASSES} />
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

  const ownerContent = canManage ? (
    <div className="space-y-4">
      {owner_added ? <p className="text-sm text-sky-700">Owner added.</p> : null}
      <div className="grid gap-3">
        {(ownerships ?? []).map((o) => (
          <div key={o.id} className="rounded-xl bg-sky-50 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <a
                className="font-semibold text-sky-700"
                // @ts-expect-error -- Supabase nested select typing
                href={`/owners/${o.owners?.id}`}
              >
                {/* @ts-expect-error -- Supabase nested select typing */}
                {o.owners?.name}
              </a>
              <span className="text-sm text-slate-600">
                {/* @ts-expect-error -- Supabase nested select typing */}
                · {o.unit_spaces?.floor_label ?? "Whole unit"}
              </span>
            </div>
            <div className="mt-1 text-sm text-slate-600">
              {/* @ts-expect-error -- Supabase nested select typing */}
              {o.owners?.primary_contact ?? "—"}
            </div>
            <div className="mt-2 flex gap-2">
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
        ))}
        {(ownerships ?? []).length === 0 ? (
          <p className="text-sm text-slate-600">No owner on record yet.</p>
        ) : null}
      </div>

      <form
        action={createOwnerForUnit}
        className="max-w-sm space-y-4 rounded-xl border border-sky-100 p-5"
      >
        <input type="hidden" name="unitId" value={unit.id} />
        <h3 className="font-medium text-slate-900">Add owner</h3>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="spaceId">
            Space (leave blank for whole unit)
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
          <label className="text-sm text-slate-700" htmlFor="name">
            Name
          </label>
          <input id="name" name="name" required className={FIELD_CLASSES} />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="primaryContact">
            Primary contact
          </label>
          <input id="primaryContact" name="primaryContact" className={FIELD_CLASSES} />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="otherContact">
            Other contact
          </label>
          <input id="otherContact" name="otherContact" className={FIELD_CLASSES} />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="icOrCompanyNo">
            IC / Company No
          </label>
          <input id="icOrCompanyNo" name="icOrCompanyNo" className={FIELD_CLASSES} />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="ownerType">
            Owner type
          </label>
          <input id="ownerType" name="ownerType" className={FIELD_CLASSES} />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="remarks">
            Remarks
          </label>
          <textarea id="remarks" name="remarks" className={FIELD_CLASSES} />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-sky-600 px-4 py-2 text-base font-medium text-white hover:bg-sky-700"
        >
          Add owner
        </button>
      </form>
    </div>
  ) : (
    <p className="text-sm text-slate-600">Owner details are restricted to your assigned areas.</p>
  );

  const listingsContent = (
    <div className="space-y-4">
      {listing_created ? <p className="text-sm text-sky-700">Listing created.</p> : null}
      <div className="grid gap-3">
        {(listings ?? []).map((l) => (
          <a
            key={l.id}
            href={`/listings/${l.id}`}
            className="flex items-center gap-3 rounded-xl bg-sky-50 px-4 py-3 hover:bg-sky-100"
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">
                {/* @ts-expect-error -- Supabase nested select typing */}
                {l.unit_spaces?.floor_label ?? "Whole unit"} · {listingTypeLabel(l.listing_type as ListingType)}
              </p>
              <p className="text-sm text-slate-600">
                {l.asking_rental ? `RM ${Number(l.asking_rental).toLocaleString()}` : "No price set"}
              </p>
            </div>
            <Badge tone={listingStatusTone(l.listing_status as ListingStatus)}>
              {listingStatusLabel(l.listing_status as ListingStatus)}
            </Badge>
          </a>
        ))}
        {(listings ?? []).length === 0 ? (
          <p className="text-sm text-slate-600">No listings yet.</p>
        ) : null}
      </div>
      {canManage ? (
        <a
          href={`/listings/new?unitId=${unit.id}`}
          className="inline-block rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
        >
          + New listing
        </a>
      ) : null}
    </div>
  );

  return (
    <div className="max-w-4xl space-y-5">
      <a className="text-sm text-sky-600" href="/units">
        ← Units
      </a>

      <div className="flex flex-wrap items-center gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {unit.unit_code}
          </div>
          <h1 className="text-xl font-semibold text-slate-900">
            {unit.jalan} {unit.unit_no}
          </h1>
          <p className="text-sm text-slate-600">
            {/* @ts-expect-error -- Supabase nested select typing */}
            {unit.sub_areas?.areas?.name} / {unit.sub_areas?.name} · {unit.full_address}
          </p>
        </div>
        <Badge tone={unit.status === "active" ? "ok" : "neutral"}>
          {unit.status === "active" ? "Active" : "Archived"}
        </Badge>
      </div>

      <UnitDetailTabs
        overview={overviewContent}
        spaces={spacesContent}
        owner={ownerContent}
        listings={listingsContent}
        timeline={timelineContent}
        initialTab={initialTab}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-slate-900">{value ?? "—"}</div>
    </div>
  );
}
