import { redirect, notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { findDuplicateCandidates } from "@/lib/units/duplicate-detection";
import { linkSubmissionToUnit, createUnitFromSubmission } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  link_failed: "Could not link submission. Try again.",
  create_failed: "Could not create unit. Try again.",
  search_task_failed: "Unit created, but the owner search task could not be created.",
  update_failed: "Unit created, but the submission status could not be updated.",
  already_handled: "This submission has already been handled by another review.",
};

const FIELD_CLASSES =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none";

export default async function UnitSubmissionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ submissionId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "area_admin")) {
    redirect("/");
  }

  const { submissionId } = await params;
  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  const supabase = await createClient();
  const { data: submission } = await supabase
    .from("unit_submissions")
    .select(
      "id, sub_area_id, jalan, unit_no, address, discovery_type, banner_phone, remarks, status, sub_areas(name, areas(name))",
    )
    .eq("id", submissionId)
    .single();

  if (!submission) {
    notFound();
  }

  let candidates: {
    id: string;
    unitCode: string;
    jalan: string | null;
    unitNo: string | null;
    fullAddress: string;
  }[] = [];

  if (submission.sub_area_id) {
    const { data: existingUnits } = await supabase
      .from("units")
      .select("id, unit_code, jalan, unit_no, full_address, sub_area_id")
      .eq("sub_area_id", submission.sub_area_id);

    candidates = findDuplicateCandidates(
      {
        subAreaId: submission.sub_area_id,
        jalan: submission.jalan ?? "",
        unitNo: submission.unit_no ?? "",
        address: submission.address,
      },
      (existingUnits ?? []).map((u) => ({
        id: u.id,
        unitCode: u.unit_code,
        subAreaId: u.sub_area_id,
        jalan: u.jalan,
        unitNo: u.unit_no,
        fullAddress: u.full_address,
      })),
    );
  }

  return (
    <div className="max-w-2xl space-y-5">
      <a className="text-sm text-sky-600" href="/unit-submissions">
        ← Unit submissions
      </a>

      <div>
        <h1 className="text-lg font-semibold text-slate-900">
          {submission.jalan} {submission.unit_no}
        </h1>
        <p className="text-sm text-slate-600">
          {submission.address} ·{" "}
          {/* @ts-expect-error -- Supabase nested select typing */}
          {submission.sub_areas?.areas?.name} / {submission.sub_areas?.name}
        </p>
        <p className="text-sm text-slate-600">
          Discovery: {submission.discovery_type}
          {submission.banner_phone ? ` · Banner phone: ${submission.banner_phone}` : ""}
        </p>
        {submission.remarks ? <p className="mt-1 text-sm text-slate-600">{submission.remarks}</p> : null}
      </div>

      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      {submission.status !== "pending" ? (
        <p className="text-sm text-slate-600">This submission has already been {submission.status}.</p>
      ) : (
        <>
          {candidates.length > 0 ? (
            <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <h2 className="font-medium text-slate-900">Possible existing units</h2>
              {candidates.map((c) => (
                <form key={c.id} action={linkSubmissionToUnit} className="flex items-center gap-3">
                  <input type="hidden" name="submissionId" value={submission.id} />
                  <input type="hidden" name="unitId" value={c.id} />
                  <div className="min-w-0 flex-1 text-sm text-slate-700">
                    <a className="font-semibold text-sky-700" href={`/units/${c.id}`}>
                      {c.unitCode}
                    </a>{" "}
                    — {c.jalan} {c.unitNo}, {c.fullAddress}
                  </div>
                  <button
                    type="submit"
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Link to this unit
                  </button>
                </form>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600">No matching existing units found.</p>
          )}

          <form
            action={createUnitFromSubmission}
            className="space-y-4 rounded-2xl border border-sky-100 bg-white p-6 shadow-sm"
          >
            <input type="hidden" name="submissionId" value={submission.id} />
            <input type="hidden" name="subAreaId" value={submission.sub_area_id ?? ""} />
            <h2 className="font-medium text-slate-900">Create as new unit</h2>
            <p className="text-sm text-slate-600">
              {/* @ts-expect-error -- Supabase nested select typing */}
              Sub-area: {submission.sub_areas?.areas?.name} / {submission.sub_areas?.name}
            </p>
            <div className="space-y-1">
              <label className="text-sm text-slate-700" htmlFor="jalan">
                Jalan
              </label>
              <input id="jalan" name="jalan" defaultValue={submission.jalan ?? ""} className={FIELD_CLASSES} />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-700" htmlFor="unitNo">
                Unit no
              </label>
              <input id="unitNo" name="unitNo" defaultValue={submission.unit_no ?? ""} className={FIELD_CLASSES} />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-700" htmlFor="address">
                Full address
              </label>
              <input
                id="address"
                name="address"
                defaultValue={submission.address}
                required
                className={FIELD_CLASSES}
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-sky-600 px-4 py-2 text-base font-medium text-white hover:bg-sky-700"
            >
              Create unit
            </button>
          </form>
        </>
      )}
    </div>
  );
}
