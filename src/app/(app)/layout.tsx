import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { roleLabel } from "@/lib/auth/role";
import { signOut } from "../(auth)/actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between border-b border-sky-100 px-4 py-3">
        <div>
          <p className="font-semibold text-slate-900">{profile.fullName}</p>
          <p className="text-sm text-sky-700">{roleLabel(profile.role)}</p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Sign out
          </button>
        </form>
      </header>
      <main className="p-4">{children}</main>
    </div>
  );
}
