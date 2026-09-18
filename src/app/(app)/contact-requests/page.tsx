import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/badge";
import {
  contactRequestStatusLabel,
  contactRequestStatusTone,
  type ContactRequestStatus,
} from "@/lib/contact-requests/labels";

export default async function ContactRequestsPage() {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "area_admin")) {
    redirect("/");
  }

  const supabase = await createClient();
  const { data: requests } = await supabase
    .from("contact_requests")
    .select(
      "id, status, reason, created_at, profiles!contact_requests_requested_by_fkey(full_name), listings(units(jalan, unit_no, unit_code))",
    )
    .order("created_at", { ascending: false });

  const allRows = requests ?? [];
  const rows = [
    ...allRows.filter((r) => r.status === "pending"),
    ...allRows.filter((r) => r.status !== "pending"),
  ];
  const pendingCount = rows.filter((r) => r.status === "pending").length;

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-lg font-semibold text-slate-900">Contact requests</h1>
        <Badge tone="warn">Pending {pendingCount}</Badge>
      </div>

      <div className="rounded-2xl border border-sky-100 bg-white shadow-sm">
        {rows.map((request, i) => (
          <a
            key={request.id}
            href={`/contact-requests/${request.id}`}
            className={`flex items-center gap-4 px-5 py-3.5 hover:bg-sky-50/60 ${
              i === rows.length - 1 ? "" : "border-b border-sky-100"
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">
                {/* @ts-expect-error -- Supabase nested select typing */}
                {request.profiles?.full_name}
              </p>
              <p className="text-sm text-slate-600">
                {/* @ts-expect-error -- Supabase nested select typing */}
                {request.listings?.units?.jalan} {request.listings?.units?.unit_no} ·{" "}
                {/* @ts-expect-error -- Supabase nested select typing */}
                {request.listings?.units?.unit_code}
              </p>
            </div>
            <Badge tone={contactRequestStatusTone(request.status as ContactRequestStatus)}>
              {contactRequestStatusLabel(request.status as ContactRequestStatus)}
            </Badge>
          </a>
        ))}
        {rows.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-600">No contact requests.</p>
        ) : null}
      </div>
    </div>
  );
}
