import { redirect, notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import {
  VERIFICATION_STATUSES,
  CONTACT_STATUSES,
  verificationStatusLabel,
  contactStatusLabel,
} from "@/lib/owners/status-labels";
import { updateOwner } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  update_failed: "Could not update owner. Try again.",
};

export default async function OwnerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ ownerId: string }>;
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "area_admin")) {
    redirect("/");
  }

  const { ownerId } = await params;
  const { error, updated } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  const supabase = await createClient();
  const { data: owner } = await supabase
    .from("owners")
    .select(
      "id, name, primary_contact, other_contact, ic_or_company_no, owner_type, verification_status, contact_status, remarks, last_verified_date",
    )
    .eq("id", ownerId)
    .single();

  if (!owner) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <a className="text-sm text-sky-600" href="/owners">
        ← Owners
      </a>

      <div>
        <h1 className="text-lg font-semibold text-slate-900">{owner.name}</h1>
        <p className="text-slate-600">{owner.primary_contact ?? "No primary contact"}</p>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm max-w-md">
        <dt className="text-slate-500">Other contact</dt>
        <dd className="text-slate-900">{owner.other_contact ?? "—"}</dd>
        <dt className="text-slate-500">IC / Company No</dt>
        <dd className="text-slate-900">{owner.ic_or_company_no ?? "—"}</dd>
        <dt className="text-slate-500">Owner type</dt>
        <dd className="text-slate-900">{owner.owner_type ?? "—"}</dd>
        <dt className="text-slate-500">Last verified</dt>
        <dd className="text-slate-900">{owner.last_verified_date ?? "—"}</dd>
      </dl>

      <form
        action={updateOwner}
        className="max-w-sm space-y-4 rounded-lg border border-sky-100 p-6 shadow-sm"
      >
        <input type="hidden" name="ownerId" value={owner.id} />
        <h2 className="font-medium text-slate-900">Update status</h2>
        {updated ? <p className="text-sm text-sky-700">Owner updated.</p> : null}
        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="verificationStatus">
            Verification status
          </label>
          <select
            id="verificationStatus"
            name="verificationStatus"
            defaultValue={owner.verification_status}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          >
            {VERIFICATION_STATUSES.map((vs) => (
              <option key={vs} value={vs}>
                {verificationStatusLabel(vs)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="contactStatus">
            Contact status
          </label>
          <select
            id="contactStatus"
            name="contactStatus"
            defaultValue={owner.contact_status}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          >
            {CONTACT_STATUSES.map((cs) => (
              <option key={cs} value={cs}>
                {contactStatusLabel(cs)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="remarks">
            Remarks
          </label>
          <textarea
            id="remarks"
            name="remarks"
            defaultValue={owner.remarks ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
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
