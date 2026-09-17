import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { verificationStatusLabel, contactStatusLabel } from "@/lib/owners/status-labels";

export default async function OwnersPage() {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "area_admin")) {
    redirect("/");
  }

  const supabase = await createClient();
  const { data: owners } = await supabase
    .from("owners")
    .select("id, name, primary_contact, verification_status, contact_status")
    .order("name");

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Owners</h1>

      <table className="w-full max-w-2xl text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Contact</th>
            <th className="py-2 pr-4">Verification</th>
            <th className="py-2 pr-4">Contact status</th>
          </tr>
        </thead>
        <tbody>
          {(owners ?? []).map((o) => (
            <tr key={o.id} className="border-b border-slate-100">
              <td className="py-2 pr-4 text-sky-700">
                <a href={`/owners/${o.id}`}>{o.name}</a>
              </td>
              <td className="py-2 pr-4 text-slate-600">{o.primary_contact ?? "—"}</td>
              <td className="py-2 pr-4 text-slate-600">
                {verificationStatusLabel(o.verification_status)}
              </td>
              <td className="py-2 pr-4 text-slate-600">{contactStatusLabel(o.contact_status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
