import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { Badge } from "@/components/badge";
import { MOCK_VERIFICATION_TASKS } from "@/lib/mock/verification";

export default async function VerificationPage() {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "area_admin")) {
    redirect("/");
  }

  return (
    <div className="max-w-5xl space-y-1">
      <h1 className="text-lg font-semibold text-slate-900">Verification</h1>
      <p className="mb-4 text-sm text-slate-600">
        Listings past 45 days queue themselves — sample data for now.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MOCK_VERIFICATION_TASKS.map((task) => (
          <div key={task.id} className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Badge tone="warn">{task.daysSinceVerified} days</Badge>
              <span className="ml-auto text-sm text-slate-600">{task.assignedTo ?? "Unassigned"}</span>
            </div>
            <div className="mt-2.5 font-semibold text-slate-900">{task.address}</div>
            <div className="text-sm text-slate-600">
              {task.listingCode} · RM {task.askingRental.toLocaleString()}
            </div>
            <div className="mt-3.5 flex gap-2">
              <button
                type="button"
                className="rounded-full bg-sky-600 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-sky-700"
              >
                Still available
              </button>
              <button
                type="button"
                className="rounded-full border border-slate-300 px-3.5 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Report
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
