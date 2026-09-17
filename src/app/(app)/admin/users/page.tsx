import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { roleLabel } from "@/lib/auth/role";
import { createUser } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  create_failed: "Could not create user. Check the details and try again.",
};

export default async function AdminUsersPage({
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
  const { data: users } = await supabase
    .from("profiles")
    .select("id, full_name, role, status, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Users</h1>

      <form
        action={createUser}
        className="max-w-sm space-y-4 rounded-lg border border-sky-100 p-6 shadow-sm"
      >
        <h2 className="font-medium text-slate-900">Create user</h2>
        {created ? <p className="text-sm text-sky-700">User created.</p> : null}
        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="fullName">
            Full name
          </label>
          <input
            id="fullName"
            name="fullName"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="password">
            Temporary password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="role">
            Role
          </label>
          <select
            id="role"
            name="role"
            defaultValue="sp"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          >
            <option value="sp">Salesperson</option>
            <option value="area_admin">Area Admin</option>
            <option value="super_admin">Super Admin</option>
          </select>
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-sky-600 px-4 py-2 text-base font-medium text-white hover:bg-sky-700"
        >
          Create user
        </button>
      </form>

      <table className="w-full max-w-2xl text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Role</th>
            <th className="py-2 pr-4">Status</th>
          </tr>
        </thead>
        <tbody>
          {(users ?? []).map((u) => (
            <tr key={u.id} className="border-b border-slate-100">
              <td className="py-2 pr-4 text-slate-900">{u.full_name}</td>
              <td className="py-2 pr-4 text-sky-700">{roleLabel(u.role)}</td>
              <td className="py-2 pr-4 text-slate-600">{u.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
