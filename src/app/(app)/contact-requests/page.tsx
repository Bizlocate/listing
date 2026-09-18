import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { ContactRequestBoard } from "@/components/contact-request-board";
import { MOCK_CONTACT_REQUESTS, countPendingContactRequests } from "@/lib/mock/contact-requests";

export default async function ContactRequestsPage() {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "area_admin")) {
    redirect("/");
  }

  return (
    <div className="max-w-5xl space-y-1">
      <h1 className="text-lg font-semibold text-slate-900">Contact requests</h1>
      <p className="mb-4 text-sm text-slate-600">
        {countPendingContactRequests()} pending · sample data, approvals aren&apos;t persisted yet.
      </p>
      <ContactRequestBoard requests={MOCK_CONTACT_REQUESTS} />
    </div>
  );
}
