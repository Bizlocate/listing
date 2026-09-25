import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/badge";
import {
  CONTACT_REQUEST_REASONS,
  contactRequestReasonLabel,
  contactRequestStatusLabel,
  contactRequestStatusTone,
  type ContactRequestReason,
} from "@/lib/contact-requests/labels";
import { STATUS_REPORT_TYPES, statusReportTypeLabel, type StatusReportType } from "@/lib/status-reports/labels";
import { requestOwnerContact, submitStatusReport } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  request_failed: "Could not send request. Try again.",
  report_failed: "Could not send report. Try again.",
};

const FIELD_CLASSES =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none";

export default async function AvailableListingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ listingId: string }>;
  searchParams: Promise<{ error?: string; requested?: string; reported?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  const { listingId } = await params;
  const { error, requested, reported } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  const supabase = await createClient();
  const { data: listing } = await supabase
    .from("available_listings")
    .select(
      "id, jalan, unit_no, unit_code, full_address, sub_area_name, area_name, floor_label, asking_rental, remarks",
    )
    .eq("id", listingId)
    .single();

  if (!listing) {
    notFound();
  }

  const { data: latestRequest } = await supabase
    .from("contact_requests")
    .select("id, status")
    .eq("listing_id", listingId)
    .eq("requested_by", profile.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: reveal } = await supabase
    .rpc("get_owner_contact_for_listing", { p_listing_id: listingId })
    .maybeSingle<{ owner_name: string; phone: string; access_expiry: string | null }>();

  return (
    <div className="max-w-2xl space-y-5">
      <Link className="text-sm text-sky-600" href="/available-listings">
        ← Available listings
      </Link>

      <div>
        <h1 className="text-lg font-semibold text-slate-900">
          {listing.jalan} {listing.unit_no}
        </h1>
        <p className="text-sm text-slate-600">
          {listing.unit_code} · {listing.area_name} / {listing.sub_area_name} ·{" "}
          {listing.floor_label ?? "Whole unit"}
        </p>
        <p className="mt-1 text-2xl font-extrabold text-slate-900">
          {listing.asking_rental ? `RM ${Number(listing.asking_rental).toLocaleString()} / month` : "—"}
        </p>
      </div>

      <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Owner contact
        </div>

        {reveal ? (
          <div className="mt-2">
            <p className="font-semibold text-slate-900">{reveal.owner_name}</p>
            <p className="text-slate-900">{reveal.phone}</p>
            {reveal.access_expiry ? (
              <p className="mt-1 text-sm text-slate-600">
                Access expires {new Date(reveal.access_expiry).toLocaleString("en-MY")}
              </p>
            ) : null}
          </div>
        ) : latestRequest?.status === "pending" ? (
          <p className="mt-2 text-sm text-slate-600">
            <Badge tone={contactRequestStatusTone("pending")}>{contactRequestStatusLabel("pending")}</Badge>{" "}
            Waiting for admin approval.
          </p>
        ) : (
          <>
            {latestRequest?.status === "rejected" ? (
              <p className="mt-2 text-sm text-slate-600">
                <Badge tone={contactRequestStatusTone("rejected")}>
                  {contactRequestStatusLabel("rejected")}
                </Badge>{" "}
                Your last request was rejected — you can request again.
              </p>
            ) : latestRequest?.status === "approved" ? (
              <p className="mt-2 text-sm text-slate-600">Your access window has expired — request again.</p>
            ) : null}

            {requested ? (
              <p className="mt-2 text-sm text-sky-700">Request sent.</p>
            ) : null}
            {error === "request_failed" && errorMessage ? (
              <p className="mt-2 text-sm text-red-600">{errorMessage}</p>
            ) : null}

            <form action={requestOwnerContact} className="mt-3 space-y-3">
              <input type="hidden" name="listingId" value={listing.id} />
              <div className="space-y-1">
                <label className="text-sm text-slate-700" htmlFor="reason">
                  Reason
                </label>
                <select id="reason" name="reason" className={FIELD_CLASSES} defaultValue="have_tenant">
                  {CONTACT_REQUEST_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {contactRequestReasonLabel(r as ContactRequestReason)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm text-slate-700" htmlFor="tenantCompany">
                  Tenant / company
                </label>
                <input id="tenantCompany" name="tenantCompany" className={FIELD_CLASSES} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm text-slate-700" htmlFor="budget">
                    Budget (RM)
                  </label>
                  <input id="budget" name="budget" type="number" className={FIELD_CLASSES} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-slate-700" htmlFor="moveInDate">
                    Move in
                  </label>
                  <input id="moveInDate" name="moveInDate" type="date" className={FIELD_CLASSES} />
                </div>
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
                Request owner contact
              </button>
            </form>
          </>
        )}
      </div>

      <form
        action={submitStatusReport}
        className="space-y-3 rounded-2xl border border-sky-100 bg-white p-5 shadow-sm"
      >
        <input type="hidden" name="listingId" value={listing.id} />
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Report status
        </div>
        {reported ? <p className="text-sm text-sky-700">Report sent — an admin will review it.</p> : null}
        {error === "report_failed" && errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="reportType">
            What did you find?
          </label>
          <select id="reportType" name="reportType" className={FIELD_CLASSES} defaultValue="still_available">
            {STATUS_REPORT_TYPES.map((t) => (
              <option key={t} value={t}>
                {statusReportTypeLabel(t as StatusReportType)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="reportRemarks">
            Remarks
          </label>
          <textarea id="reportRemarks" name="remarks" className={FIELD_CLASSES} />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-sky-600 px-4 py-2 text-base font-medium text-white hover:bg-sky-700"
        >
          Send report
        </button>
      </form>
    </div>
  );
}
