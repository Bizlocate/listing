import { redirect, notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { createSubArea, assignAreaAdmin } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  duplicate_code: "That sub-area code is already in use for this area.",
  duplicate_name: "That sub-area name is already in use for this area.",
  create_failed: "Could not create sub-area. Check the details and try again.",
  already_assigned: "That admin is already assigned to this area.",
  assign_failed: "Could not assign admin. Try again.",
};

export default async function AreaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ areaId: string }>;
  searchParams: Promise<{ error?: string; created?: string; assigned?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "super_admin") {
    redirect("/");
  }

  const { areaId } = await params;
  const { error, created, assigned } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  const supabase = await createClient();
  const { data: area } = await supabase
    .from("areas")
    .select("id, name, code")
    .eq("id", areaId)
    .single();

  if (!area) {
    notFound();
  }

  const { data: subAreas } = await supabase
    .from("sub_areas")
    .select("id, name, code, population, consumer_type")
    .eq("area_id", areaId)
    .order("name");

  const { data: assignedAdmins } = await supabase
    .from("area_admins")
    .select("profile_id, profiles(id, full_name)")
    .eq("area_id", areaId);

  const { data: candidateAdmins } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "area_admin")
    .order("full_name");

  return (
    <div className="space-y-6">
      <div>
        <a className="text-sm text-sky-600" href="/admin/areas">
          ← Areas
        </a>
        <h1 className="text-lg font-semibold text-slate-900">
          {area.name} ({area.code})
        </h1>
      </div>

      <form
        action={createSubArea}
        className="max-w-sm space-y-4 rounded-lg border border-sky-100 p-6 shadow-sm"
      >
        <input type="hidden" name="areaId" value={area.id} />
        <h2 className="font-medium text-slate-900">Create sub-area</h2>
        {created ? <p className="text-sm text-sky-700">Sub-area created.</p> : null}
        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            name="name"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="code">
            Code (short, e.g. DK)
          </label>
          <input
            id="code"
            name="code"
            required
            maxLength={10}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base uppercase focus:border-sky-500 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="population">
            Population
          </label>
          <input
            id="population"
            name="population"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="consumerType">
            Consumer type
          </label>
          <input
            id="consumerType"
            name="consumerType"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="commercialProfile">
            Commercial profile
          </label>
          <input
            id="commercialProfile"
            name="commercialProfile"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-sky-600 px-4 py-2 text-base font-medium text-white hover:bg-sky-700"
        >
          Create sub-area
        </button>
      </form>

      <table className="w-full max-w-2xl text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Code</th>
            <th className="py-2 pr-4">Population</th>
            <th className="py-2 pr-4">Consumer type</th>
          </tr>
        </thead>
        <tbody>
          {(subAreas ?? []).map((sa) => (
            <tr key={sa.id} className="border-b border-slate-100">
              <td className="py-2 pr-4 text-slate-900">{sa.name}</td>
              <td className="py-2 pr-4 text-sky-700">{sa.code}</td>
              <td className="py-2 pr-4 text-slate-600">{sa.population}</td>
              <td className="py-2 pr-4 text-slate-600">{sa.consumer_type}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="space-y-4">
        <h2 className="font-medium text-slate-900">Assigned admins</h2>
        {assigned ? <p className="text-sm text-sky-700">Admin assigned.</p> : null}
        <ul className="max-w-sm space-y-1 text-sm">
          {(assignedAdmins ?? []).length === 0 ? (
            <li className="text-slate-500">No admins assigned yet.</li>
          ) : (
            assignedAdmins!.map((aa) => (
              <li key={aa.profile_id} className="text-slate-900">
                {/* @ts-expect-error -- Supabase nested select typing */}
                {aa.profiles?.full_name}
              </li>
            ))
          )}
        </ul>

        <form
          action={assignAreaAdmin}
          className="max-w-sm space-y-4 rounded-lg border border-sky-100 p-6 shadow-sm"
        >
          <input type="hidden" name="areaId" value={area.id} />
          <div className="space-y-1">
            <label className="text-sm text-slate-700" htmlFor="profileId">
              Assign area admin
            </label>
            <select
              id="profileId"
              name="profileId"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
            >
              <option value="">Select an admin</option>
              {(candidateAdmins ?? []).map((admin) => (
                <option key={admin.id} value={admin.id}>
                  {admin.full_name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-sky-600 px-4 py-2 text-base font-medium text-white hover:bg-sky-700"
          >
            Assign
          </button>
        </form>
      </div>
    </div>
  );
}
