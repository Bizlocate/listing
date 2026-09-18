import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { roleLabel } from "@/lib/auth/role";
import { AppShell } from "@/components/app-shell";
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
    <AppShell fullName={profile.fullName} roleLabel={roleLabel(profile.role)} signOutAction={signOut}>
      {children}
    </AppShell>
  );
}
