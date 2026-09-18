import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/badge";
import {
  ownerSearchStatusLabel,
  ownerSearchStatusTone,
  type OwnerSearchTaskStatus,
} from "@/lib/owner-search/status-labels";

export default async function OwnerSearchPage() {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "area_admin")) {
    redirect("/");
  }

  const supabase = await createClient();
  const { data: tasks } = await supabase
    .from("owner_search_tasks")
    .select(
      "id, status, found_contact, units(unit_code, jalan, unit_no, full_address, sub_areas(name, areas(name)))",
    )
    .order("created_at", { ascending: true });

  const rows = tasks ?? [];
  const openCount = rows.filter(
    (t) => t.status !== "owner_confirmed" && t.status !== "wrong_number" && t.status !== "unable_to_reach",
  ).length;
  const confirmedCount = rows.filter((t) => t.status === "owner_confirmed").length;

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-lg font-semibold text-slate-900">Owner search</h1>
        <Badge tone="warn">Open {openCount}</Badge>
        <Badge tone="ok">Confirmed {confirmedCount}</Badge>
      </div>

      <div className="rounded-2xl border border-sky-100 bg-white shadow-sm">
        {rows.map((task, i) => (
          <a
            key={task.id}
            href={`/owner-search/${task.id}`}
            className={`flex items-center gap-4 px-5 py-3.5 hover:bg-sky-50/60 ${
              i === rows.length - 1 ? "" : "border-b border-sky-100"
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">
                {/* @ts-expect-error -- Supabase nested select typing */}
                {task.units?.jalan} {task.units?.unit_no}
              </p>
              <p className="text-sm text-slate-600">
                {/* @ts-expect-error -- Supabase nested select typing */}
                {task.units?.unit_code} · {task.units?.sub_areas?.areas?.name} / {task.units?.sub_areas?.name}
              </p>
            </div>
            <span className="text-sm text-slate-600">{task.found_contact ?? "No contact yet"}</span>
            <Badge tone={ownerSearchStatusTone(task.status as OwnerSearchTaskStatus)}>
              {ownerSearchStatusLabel(task.status as OwnerSearchTaskStatus)}
            </Badge>
          </a>
        ))}
        {rows.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-600">No owner search tasks.</p>
        ) : null}
      </div>
    </div>
  );
}
