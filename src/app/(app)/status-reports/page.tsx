import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/badge";
import {
  statusReportTypeLabel,
  statusReportStatusLabel,
  statusReportStatusTone,
  type StatusReportType,
  type StatusReportStatus,
} from "@/lib/status-reports/labels";

export default async function StatusReportsPage() {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "area_admin")) {
    redirect("/");
  }

  const supabase = await createClient();
  const { data: reports, error } = await supabase
    .from("listing_status_reports")
    .select(
      "id, report_type, status, created_at, profiles!listing_status_reports_reported_by_fkey(full_name), listings(units(jalan, unit_no, unit_code))",
    )
    .order("created_at", { ascending: false });

  const allRows = reports ?? [];
  const rows = [
    ...allRows.filter((r) => r.status === "pending_review"),
    ...allRows.filter((r) => r.status !== "pending_review"),
  ];
  const pendingCount = allRows.filter((r) => r.status === "pending_review").length;

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-lg font-semibold text-slate-900">Status reports</h1>
        <Badge tone="warn">Pending {pendingCount}</Badge>
      </div>
      {error ? <p className="text-sm text-red-600">Could not load reports: {error.message}</p> : null}

      <div className="rounded-2xl border border-sky-100 bg-white shadow-sm">
        {rows.map((report, i) => (
          <Link
            key={report.id}
            href={`/status-reports/${report.id}`}
            className={`flex items-center gap-4 px-5 py-3.5 hover:bg-sky-50/60 ${
              i === rows.length - 1 ? "" : "border-b border-sky-100"
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">
                {/* @ts-expect-error -- Supabase nested select typing */}
                {report.listings?.units?.jalan} {report.listings?.units?.unit_no} ·{" "}
                {statusReportTypeLabel(report.report_type as StatusReportType)}
              </p>
              <p className="text-sm text-slate-600">
                {/* @ts-expect-error -- Supabase nested select typing */}
                {report.profiles?.full_name} · {report.listings?.units?.unit_code}
              </p>
            </div>
            <Badge tone={statusReportStatusTone(report.status as StatusReportStatus)}>
              {statusReportStatusLabel(report.status as StatusReportStatus)}
            </Badge>
          </Link>
        ))}
        {rows.length === 0 ? <p className="px-5 py-4 text-sm text-slate-600">No status reports.</p> : null}
      </div>
    </div>
  );
}
