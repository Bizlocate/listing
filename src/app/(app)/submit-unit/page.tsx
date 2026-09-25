import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/badge";
import { GeolocationFields } from "@/components/geolocation-fields";
import { SubmissionPhotoField } from "@/components/unit-media-uploaders";
import { findDuplicateCandidates } from "@/lib/units/duplicate-detection";
import { createUnitSubmission } from "./actions";

const FIELD_CLASSES =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none";

const ERROR_MESSAGES: Record<string, string> = {
  create_failed: "Could not submit unit. Check the details and try again.",
};

const DISCOVERY_TYPES = [
  { value: "vacant", label: "Vacant" },
  { value: "banner", label: "Banner" },
  { value: "target_unit", label: "Target unit" },
  { value: "other", label: "Other" },
];

export default async function SubmitUnitPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  const { error, created } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  const supabase = await createClient();

  const { data: subAreas } = await supabase
    .from("sub_areas")
    .select("id, name, area_id, areas(name)")
    .order("name");

  const { data: submissions } = await supabase
    .from("unit_submissions")
    .select("id, sub_area_id, jalan, unit_no, address, discovery_type, status, created_at")
    .eq("submitted_by", profile.id)
    .order("created_at", { ascending: false });

  const submissionsWithDuplicates = await Promise.all(
    (submissions ?? []).map(async (s) => {
      if (s.status !== "pending" || !s.sub_area_id) {
        return { ...s, hasDuplicates: false };
      }
      const { data: existingUnits } = await supabase
        .from("units")
        .select("id, unit_code, jalan, unit_no, full_address, sub_area_id")
        .eq("sub_area_id", s.sub_area_id);

      const candidates = findDuplicateCandidates(
        { subAreaId: s.sub_area_id, jalan: s.jalan ?? "", unitNo: s.unit_no ?? "", address: s.address },
        (existingUnits ?? []).map((u) => ({
          id: u.id,
          unitCode: u.unit_code,
          subAreaId: u.sub_area_id,
          jalan: u.jalan,
          unitNo: u.unit_no,
          fullAddress: u.full_address,
        })),
      );
      return { ...s, hasDuplicates: candidates.length > 0 };
    }),
  );

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Submit unit</h1>

      <form
        action={createUnitSubmission}
        className="space-y-4 rounded-2xl border border-sky-100 bg-white p-6 shadow-sm"
      >
        <GeolocationFields />
        {created ? <p className="text-sm text-sky-700">Submitted. An admin will review it.</p> : null}
        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="subAreaId">
            Sub-area
          </label>
          <select id="subAreaId" name="subAreaId" required className={FIELD_CLASSES}>
            <option value="">Select a sub-area</option>
            {(subAreas ?? []).map((sa) => (
              <option key={sa.id} value={sa.id}>
                {/* @ts-expect-error -- Supabase nested select typing */}
                {sa.areas?.name} / {sa.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="jalan">
            Jalan
          </label>
          <input id="jalan" name="jalan" className={FIELD_CLASSES} />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="unitNo">
            Unit no
          </label>
          <input id="unitNo" name="unitNo" className={FIELD_CLASSES} />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="address">
            Address
          </label>
          <input id="address" name="address" required className={FIELD_CLASSES} />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="discoveryType">
            Discovery type
          </label>
          <select id="discoveryType" name="discoveryType" defaultValue="vacant" className={FIELD_CLASSES}>
            {DISCOVERY_TYPES.map((dt) => (
              <option key={dt.value} value={dt.value}>
                {dt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="bannerPhone">
            Banner phone (if visible)
          </label>
          <input id="bannerPhone" name="bannerPhone" className={FIELD_CLASSES} />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="remarks">
            Remarks
          </label>
          <textarea id="remarks" name="remarks" className={FIELD_CLASSES} rows={3} />
        </div>
        <SubmissionPhotoField userId={profile.id} />
        <button
          type="submit"
          className="w-full rounded-md bg-sky-600 px-4 py-2 text-base font-medium text-white hover:bg-sky-700"
        >
          Submit
        </button>
      </form>

      <div className="space-y-3">
        <h2 className="font-medium text-slate-900">My submissions</h2>
        {submissionsWithDuplicates.length === 0 ? (
          <p className="text-sm text-slate-600">No submissions yet.</p>
        ) : (
          submissionsWithDuplicates.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-xl bg-sky-50 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">
                  {s.jalan} {s.unit_no}
                </p>
                <p className="text-sm text-slate-600">{s.address}</p>
              </div>
              {s.status === "pending" && s.hasDuplicates ? <Badge tone="warn">Possible duplicate</Badge> : null}
              <Badge tone={s.status === "pending" ? "neutral" : s.status === "linked" ? "accent" : "ok"}>
                {s.status}
              </Badge>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
