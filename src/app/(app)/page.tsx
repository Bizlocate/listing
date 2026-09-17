import { getCurrentProfile } from "@/lib/auth/get-current-profile";

export default async function HomePage() {
  const profile = await getCurrentProfile();

  return (
    <div className="space-y-2">
      <h1 className="text-lg font-semibold text-slate-900">Welcome to Bizlocate</h1>
      <p className="text-slate-600">
        Signed in successfully. Feature pages (Listings) land in later plans.
      </p>
      <div className="flex flex-col gap-1">
        {profile?.role === "area_admin" || profile?.role === "super_admin" ? (
          <a href="/units" className="text-sky-600">
            Units →
          </a>
        ) : null}
        {profile?.role === "area_admin" || profile?.role === "super_admin" ? (
          <a href="/owners" className="text-sky-600">
            Owners →
          </a>
        ) : null}
        {profile?.role === "super_admin" ? (
          <a href="/admin/areas" className="text-sky-600">
            Manage areas →
          </a>
        ) : null}
        {profile?.role === "super_admin" ? (
          <a href="/admin/users" className="text-sky-600">
            Manage users →
          </a>
        ) : null}
      </div>
    </div>
  );
}
