import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import {
  OWNER_SEARCH_STATUSES,
  ownerSearchStatusLabel,
  type OwnerSearchTaskStatus,
} from "@/lib/owner-search/status-labels";
import { updateOwnerSearchTask } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  update_failed: "Could not update task. Try again.",
};

const FIELD_CLASSES =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none";

export default async function OwnerSearchTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ taskId: string }>;
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "area_admin")) {
    redirect("/");
  }

  const { taskId } = await params;
  const { error, updated } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  const supabase = await createClient();
  const { data: task } = await supabase
    .from("owner_search_tasks")
    .select(
      "id, unit_id, status, found_contact, remarks, units(unit_code, jalan, unit_no, full_address, sub_areas(name, areas(name)))",
    )
    .eq("id", taskId)
    .single();

  if (!task) {
    notFound();
  }

  return (
    <div className="max-w-2xl space-y-5">
      <Link className="text-sm text-sky-600" href="/owner-search">
        ← Owner search
      </Link>

      <div>
        <h1 className="text-lg font-semibold text-slate-900">
          {/* @ts-expect-error -- Supabase nested select typing */}
          {task.units?.jalan} {task.units?.unit_no}
        </h1>
        <p className="text-sm text-slate-600">
          {/* @ts-expect-error -- Supabase nested select typing */}
          {task.units?.full_address} · {task.units?.sub_areas?.areas?.name} / {task.units?.sub_areas?.name}
        </p>
        <a className="text-sm text-sky-600" href={`/units/${task.unit_id}`}>
          View unit →
        </a>
      </div>

      {task.status === "owner_confirmed" ? (
        <p className="rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-800">
          Once confirmed, record the owner&apos;s details on{" "}
          <Link href={`/units/${task.unit_id}?tab=owner`} className="font-semibold underline">
            the unit&apos;s Owner tab
          </Link>{" "}
          — this task&apos;s status alone doesn&apos;t create an Owner record.
        </p>
      ) : null}

      <form
        action={updateOwnerSearchTask}
        className="space-y-4 rounded-2xl border border-sky-100 bg-white p-6 shadow-sm"
      >
        <input type="hidden" name="taskId" value={task.id} />
        <h2 className="font-medium text-slate-900">Update</h2>
        {updated ? <p className="text-sm text-sky-700">Task updated.</p> : null}
        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={task.status}
            className={FIELD_CLASSES}
          >
            {OWNER_SEARCH_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ownerSearchStatusLabel(s as OwnerSearchTaskStatus)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="foundContact">
            Found contact
          </label>
          <input
            id="foundContact"
            name="foundContact"
            defaultValue={task.found_contact ?? ""}
            className={FIELD_CLASSES}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="remarks">
            Remarks
          </label>
          <textarea
            id="remarks"
            name="remarks"
            defaultValue={task.remarks ?? ""}
            className={FIELD_CLASSES}
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-sky-600 px-4 py-2 text-base font-medium text-white hover:bg-sky-700"
        >
          Save
        </button>
      </form>
    </div>
  );
}
