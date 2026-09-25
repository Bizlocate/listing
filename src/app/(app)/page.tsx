import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { todayInMalaysia } from "@/lib/owners/today-my";
import {
  isOwnerSearchTaskOpen,
  type OwnerSearchTaskStatus,
} from "@/lib/owner-search/status-labels";
import {
  contactRequestReasonLabel,
  type ContactRequestReason,
} from "@/lib/contact-requests/labels";
import { statusReportTypeLabel, type StatusReportType } from "@/lib/status-reports/labels";
import { isAging, timeAgo } from "@/lib/dashboard/helpers";

type QueueItem = {
  key: string;
  createdAt: string;
  label: string;
  note: string;
  href: string;
  action: string;
};
type UnitRef = { jalan: string | null; unit_no: string | null } | null | undefined;

function unitLabel(unit: UnitRef): string {
  return `${unit?.jalan ?? ""} ${unit?.unit_no ?? ""}`.trim() || "Unknown unit";
}

export default async function HomePage() {
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "super_admin" || profile?.role === "area_admin";

  if (!profile || !isAdmin) {
    return (
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Welcome to Bizlocate</h1>
        <p className="mt-2 text-slate-600">Signed in successfully.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/available-listings"
            className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-800 hover:bg-sky-100"
          >
            Browse available listings
          </Link>
          <Link
            href="/submit-unit"
            className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Submit a unit
          </Link>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const [available, ownerSearch, requests, reports, submissions] = await Promise.all([
    supabase
      .from("listings")
      .select("id, last_verified_date, created_at")
      .eq("listing_status", "available"),
    supabase.from("owner_search_tasks").select("id, status, created_at, units(jalan, unit_no)"),
    supabase
      .from("contact_requests")
      .select("id, reason, created_at, listings(units(jalan, unit_no))")
      .eq("status", "pending"),
    supabase
      .from("listing_status_reports")
      .select("id, report_type, created_at, listings(units(jalan, unit_no))")
      .eq("status", "pending_review"),
    supabase.from("unit_submissions").select("id, address, created_at").eq("status", "pending"),
  ]);

  const errors = [available, ownerSearch, requests, reports, submissions]
    .map((r) => r.error?.message)
    .filter(Boolean);

  const today = todayInMalaysia();
  const nowMs = Date.now();
  const availableRows = available.data ?? [];
  const agingCount = availableRows.filter((l) =>
    isAging(l.last_verified_date, l.created_at, today),
  ).length;
  const openTasks = (ownerSearch.data ?? []).filter((t) =>
    isOwnerSearchTaskOpen(t.status as OwnerSearchTaskStatus),
  );
  const requestRows = requests.data ?? [];
  const reportRows = reports.data ?? [];
  const submissionRows = submissions.data ?? [];

  const needYou =
    openTasks.length + requestRows.length + reportRows.length + submissionRows.length + agingCount;

  const queue: QueueItem[] = [
    ...requestRows.map((r) => ({
      key: `cr-${r.id}`,
      createdAt: r.created_at,
      // @ts-expect-error -- Supabase nested select typing
      label: unitLabel(r.listings?.units),
      note: `${contactRequestReasonLabel(r.reason as ContactRequestReason)} · ${timeAgo(r.created_at, nowMs)}`,
      href: `/contact-requests/${r.id}`,
      action: "Review",
    })),
    ...reportRows.map((r) => ({
      key: `sr-${r.id}`,
      createdAt: r.created_at,
      // @ts-expect-error -- Supabase nested select typing
      label: unitLabel(r.listings?.units),
      note: `${statusReportTypeLabel(r.report_type as StatusReportType)} · ${timeAgo(r.created_at, nowMs)}`,
      href: `/status-reports/${r.id}`,
      action: "Review",
    })),
    ...submissionRows.map((s) => ({
      key: `us-${s.id}`,
      createdAt: s.created_at,
      label: s.address,
      note: `New unit submission · ${timeAgo(s.created_at, nowMs)}`,
      href: `/unit-submissions/${s.id}`,
      action: "Review",
    })),
    ...openTasks.map((t) => ({
      key: `os-${t.id}`,
      createdAt: t.created_at,
      // @ts-expect-error -- Supabase nested select typing
      label: unitLabel(t.units),
      note: `Owner search · ${timeAgo(t.created_at, nowMs)}`,
      href: `/owner-search/${t.id}`,
      action: "Open",
    })),
  ]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 8);

  const firstName = profile.fullName.split(" ")[0];

  return (
    <div className="max-w-5xl space-y-6">
      {errors.length > 0 ? (
        <p className="text-sm text-red-600">Could not load: {errors.join("; ")}</p>
      ) : null}

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Good morning, {firstName}</h1>
        <p className="text-slate-600">{needYou} items need you today</p>
      </div>

      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
        <StatTile label="Available" value={availableRows.length} href="/listings" />
        <StatTile label="Owner search" value={openTasks.length} href="/owner-search" tone="accent" />
        <StatTile label="Requests" value={requestRows.length} href="/contact-requests" tone="accent" />
        <StatTile label="Reports" value={reportRows.length} href="/status-reports" tone="accent" />
        <StatTile label="Submissions" value={submissionRows.length} href="/unit-submissions" tone="accent" />
        <StatTile label="Aging 45d+" value={agingCount} href="/listings" tone="warn" />
      </div>

      <div>
        <h2 className="mb-3 font-medium text-slate-900">Work queue</h2>
        <div className="rounded-2xl border border-sky-100 bg-white shadow-sm">
          {queue.map((item, i) => (
            <WorkQueueRow
              key={item.key}
              label={item.label}
              note={item.note}
              href={item.href}
              action={item.action}
              last={i === queue.length - 1}
            />
          ))}
          {queue.length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-600">Nothing waiting — all clear.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: number;
  href: string;
  tone?: "accent" | "warn";
}) {
  const toneClasses =
    tone === "accent"
      ? "bg-sky-50 border-sky-200 text-sky-800"
      : tone === "warn"
        ? "bg-amber-50 border-amber-200 text-amber-800"
        : "bg-white border-sky-100 text-slate-900";

  return (
    <Link href={href} className={`rounded-2xl border p-4 shadow-sm ${toneClasses}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-3xl font-extrabold leading-tight">{value}</div>
    </Link>
  );
}

function WorkQueueRow({
  label,
  note,
  href,
  action,
  last,
}: {
  label: string;
  note: string;
  href: string;
  action: string;
  last?: boolean;
}) {
  return (
    <div className={`flex items-center gap-4 px-5 py-3.5 ${last ? "" : "border-b border-sky-100"}`}>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900">{label}</p>
        <p className="text-sm text-slate-600">{note}</p>
      </div>
      <Link
        href={href}
        className="flex-none rounded-full border border-slate-300 px-3.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
      >
        {action}
      </Link>
    </div>
  );
}
