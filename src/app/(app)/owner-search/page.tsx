import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { OwnerSearchBoard } from "@/components/owner-search-board";
import { MOCK_OWNER_SEARCH_TASKS, countOpenOwnerSearchTasks } from "@/lib/mock/owner-search";

export default async function OwnerSearchPage() {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "area_admin")) {
    redirect("/");
  }

  return (
    <div className="max-w-5xl space-y-1">
      <h1 className="text-lg font-semibold text-slate-900">Owner search</h1>
      <p className="mb-4 text-sm text-slate-600">
        {countOpenOwnerSearchTasks()} open · sample data, not wired to the owner search queue yet.
      </p>
      <OwnerSearchBoard tasks={MOCK_OWNER_SEARCH_TASKS} />
    </div>
  );
}
