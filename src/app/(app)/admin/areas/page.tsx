import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { createArea } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  duplicate_code: "That area code is already in use.",
  duplicate_name: "That area name is already in use.",
  create_failed: "Could not create area. Check the details and try again.",
};

export default async function AreasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "super_admin") {
    redirect("/");
  }

  const { error, created } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  const supabase = await createClient();
  const { data: areas } = await supabase
    .from("areas")
    .select("id, name, code, status")
    .order("name");

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Areas</h1>

      <form
        action={createArea}
        className="max-w-sm space-y-4 rounded-lg border border-sky-100 p-6 shadow-sm"
      >
        <h2 className="font-medium text-slate-900">Create area</h2>
        {created ? <p className="text-sm text-sky-700">Area created.</p> : null}
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
            Code (short, e.g. SET)
          </label>
          <input
            id="code"
            name="code"
            required
            maxLength={10}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base uppercase focus:border-sky-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-sky-600 px-4 py-2 text-base font-medium text-white hover:bg-sky-700"
        >
          Create area
        </button>
      </form>

      <table className="w-full max-w-2xl text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Code</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4"></th>
          </tr>
        </thead>
        <tbody>
          {(areas ?? []).map((a) => (
            <tr key={a.id} className="border-b border-slate-100">
              <td className="py-2 pr-4 text-slate-900">{a.name}</td>
              <td className="py-2 pr-4 text-sky-700">{a.code}</td>
              <td className="py-2 pr-4 text-slate-600">{a.status}</td>
              <td className="py-2 pr-4">
                <a className="text-sky-600" href={`/admin/areas/${a.id}`}>
                  Sub-areas →
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
