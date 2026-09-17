import { getCurrentProfile } from "@/lib/auth/get-current-profile";

export default async function HomePage() {
  const profile = await getCurrentProfile();

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900">Welcome to Bizlocate</h1>
      <p className="mt-2 text-slate-600">
        Signed in successfully. Feature pages (Units, Owners, Listings) land in
        later plans.
      </p>
      {profile?.role === "super_admin" ? (
        <a href="/admin/users" className="mt-4 inline-block text-sky-600">
          Manage users →
        </a>
      ) : null}
    </div>
  );
}
