import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { roleLabel } from "@/lib/auth/role";
import { Badge } from "@/components/badge";
import { createUser } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  create_failed: "Could not create user. Check the details and try again.",
};

const FIELD_CLASSES =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none";

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
    <div className="grid max-w-4xl grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <h1 className="text-lg font-semibold text-slate-900">Users</h1>
        <div className="rounded-2xl border border-sky-100 bg-white shadow-sm">
          {(users ?? []).map((u, i) => (
            <div
              key={u.id}
              className={`flex items-center gap-4 px-5 py-3.5 ${
                i === (users ?? []).length - 1 ? "" : "border-b border-sky-100"
              }`}
            >
              <div className="grid h-9 w-9 flex-none place-items-center rounded-full bg-sky-100 text-xs font-bold text-sky-800">
                {initials(u.full_name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{u.full_name}</p>
                <p className="text-sm text-slate-600">{u.status}</p>
              </div>
              <Badge tone="accent">{roleLabel(u.role)}</Badge>
            </div>
          ))}
          {(users ?? []).length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-600">No users yet.</p>
          ) : null}
        </div>
      </div>

      <form
        action={createUser}
        className="h-fit space-y-4 rounded-2xl border border-sky-100 bg-white p-6 shadow-sm"
      >
        <h2 className="font-medium text-slate-900">Create user</h2>
        {created ? <p className="text-sm text-sky-700">User created.</p> : null}
        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="fullName">
            Full name
          </label>
          <input id="fullName" name="fullName" required className={FIELD_CLASSES} />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="email">
            Email
          </label>
          <input id="email" name="email" type="email" required className={FIELD_CLASSES} />
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
            className={FIELD_CLASSES}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="role">
            Role
          </label>
          <select id="role" name="role" defaultValue="sp" className={FIELD_CLASSES}>
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
    </div>
  );
}

function initials(fullName: string): string {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
