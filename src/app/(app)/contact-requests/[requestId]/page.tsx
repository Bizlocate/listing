import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/badge";
import {
  contactRequestReasonLabel,
  contactRequestStatusLabel,
  contactRequestStatusTone,
  isContactAccessActive,
  type ContactRequestReason,
  type ContactRequestStatus,
} from "@/lib/contact-requests/labels";
import { approveContactRequest, rejectContactRequest, revokeContactAccess } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  no_owner: "This unit has no owner on record yet — add one before approving.",
  already_handled: "This request was already approved or rejected.",
  access_log_failed: "Approved but could not create the access log. Contact an admin.",
};

export default async function ContactRequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<{ error?: string; approved?: string; rejected?: string; revoked?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "area_admin")) {
    redirect("/");
  }

  const { requestId } = await params;
  const { error, approved, rejected, revoked } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  const supabase = await createClient();
  const { data: request } = await supabase
    .from("contact_requests")
    .select(
      "id, status, reason, tenant_company, business_type, budget, move_in_date, remarks, created_at, profiles!contact_requests_requested_by_fkey(full_name), listings(units(jalan, unit_no, unit_code, full_address))",
    )
    .eq("id", requestId)
    .single();

  if (!request) {
    notFound();
  }

  let activeAccess = false;
  if (request.status === "approved") {
    const { data: accessLog } = await supabase
      .from("contact_access_logs")
      .select("id, access_expiry, revoked")
      .eq("contact_request_id", requestId)
      .order("access_start", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (accessLog) {
      activeAccess = isContactAccessActive(accessLog.access_expiry, accessLog.revoked);
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <Link className="text-sm text-sky-600" href="/contact-requests">
        ← Contact requests
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-lg font-semibold text-slate-900">
          {/* @ts-expect-error -- Supabase nested select typing */}
          {request.profiles?.full_name}
        </h1>
        <Badge tone={contactRequestStatusTone(request.status as ContactRequestStatus)}>
          {contactRequestStatusLabel(request.status as ContactRequestStatus)}
        </Badge>
      </div>

      <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-600">
          {/* @ts-expect-error -- Supabase nested select typing */}
          {request.listings?.units?.jalan} {request.listings?.units?.unit_no} ·{" "}
          {/* @ts-expect-error -- Supabase nested select typing */}
          {request.listings?.units?.unit_code}
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <Field label="Reason" value={contactRequestReasonLabel(request.reason as ContactRequestReason)} />
          <Field label="Tenant / company" value={request.tenant_company} />
          <Field label="Business type" value={request.business_type} />
          <Field label="Budget" value={request.budget ? `RM ${Number(request.budget).toLocaleString()}` : null} />
          <Field label="Move in" value={request.move_in_date} />
          <Field label="Remarks" value={request.remarks} />
        </dl>

        {approved ? <p className="mt-4 text-sm text-sky-700">Approved — 48h access granted.</p> : null}
        {rejected ? <p className="mt-4 text-sm text-slate-600">Rejected.</p> : null}
        {revoked ? <p className="mt-4 text-sm text-slate-600">Access revoked.</p> : null}
        {errorMessage ? <p className="mt-4 text-sm text-red-600">{errorMessage}</p> : null}

        {request.status === "pending" ? (
          <div className="mt-5 flex gap-2">
            <form action={approveContactRequest}>
              <input type="hidden" name="requestId" value={request.id} />
              <button
                type="submit"
                className="rounded-full bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
              >
                Approve 48h
              </button>
            </form>
            <form action={rejectContactRequest}>
              <input type="hidden" name="requestId" value={request.id} />
              <button
                type="submit"
                className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Reject
              </button>
            </form>
          </div>
        ) : null}

        {activeAccess ? (
          <div className="mt-5">
            <form action={revokeContactAccess}>
              <input type="hidden" name="contactRequestId" value={request.id} />
              <button
                type="submit"
                className="rounded-full border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"
              >
                Revoke access
              </button>
            </form>
          </div>
        ) : null}
      </div>
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
