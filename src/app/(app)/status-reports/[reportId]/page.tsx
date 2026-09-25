import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/badge";
import {
  statusReportTypeLabel,
  statusReportStatusLabel,
  statusReportStatusTone,
  reportEffect,
  type StatusReportType,
  type StatusReportStatus,
} from "@/lib/status-reports/labels";
import { listingStatusLabel } from "@/lib/listings/status-labels";
import { confirmStatusReport, rejectStatusReport } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  already_handled: "This report was already confirmed or rejected.",
  apply_failed: "Report marked confirmed but the listing could not be updated. Update the listing manually.",
};

export default async function StatusReportDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<{ error?: string; confirmed?: string; rejected?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "area_admin")) {
    redirect("/");
  }

  const { reportId } = await params;
  const { error, confirmed, rejected } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  const supabase = await createClient();
  const { data: report } = await supabase
    .from("listing_status_reports")
    .select(
      "id, listing_id, report_type, remarks, status, profiles!listing_status_reports_reported_by_fkey(full_name), listings(listing_status, units(jalan, unit_no, unit_code))",
    )
    .eq("id", reportId)
    .single();

  if (!report) {
    notFound();
  }

  const effect = reportEffect(report.report_type as StatusReportType);
  const effectText = effect.listingStatus
    ? `Confirming will set the listing to "${listingStatusLabel(effect.listingStatus)}".`
    : effect.touchVerified
      ? "Confirming will refresh the listing's last verified date."
      : "Confirming only marks this report reviewed — follow up on the listing manually.";

  return (
    <div className="max-w-2xl space-y-5">
      <Link className="text-sm text-sky-600" href="/status-reports">
        ← Status reports
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-lg font-semibold text-slate-900">
          {statusReportTypeLabel(report.report_type as StatusReportType)}
        </h1>
        <Badge tone={statusReportStatusTone(report.status as StatusReportStatus)}>
          {statusReportStatusLabel(report.status as StatusReportStatus)}
        </Badge>
      </div>

      <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-600">
          {/* @ts-expect-error -- Supabase nested select typing */}
          {report.listings?.units?.jalan} {report.listings?.units?.unit_no} · {report.listings?.units?.unit_code}
        </p>
        <p className="text-sm text-slate-600">
          {/* @ts-expect-error -- Supabase nested select typing */}
          Reported by {report.profiles?.full_name} · listing is currently {report.listings?.listing_status}
        </p>
        <p className="mt-3 text-slate-900">{report.remarks ?? "No remarks."}</p>

        {confirmed ? <p className="mt-4 text-sm text-sky-700">Confirmed.</p> : null}
        {rejected ? <p className="mt-4 text-sm text-slate-600">Rejected.</p> : null}
        {errorMessage ? <p className="mt-4 text-sm text-red-600">{errorMessage}</p> : null}

        {report.status === "pending_review" ? (
          <>
            <p className="mt-4 text-sm text-slate-600">{effectText}</p>
            <div className="mt-3 flex gap-2">
              <form action={confirmStatusReport}>
                <input type="hidden" name="reportId" value={report.id} />
                <button
                  type="submit"
                  className="rounded-full bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
                >
                  Confirm
                </button>
              </form>
              <form action={rejectStatusReport}>
                <input type="hidden" name="reportId" value={report.id} />
                <button
                  type="submit"
                  className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Reject
                </button>
              </form>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
