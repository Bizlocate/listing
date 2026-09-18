import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { countListingsByStatus } from "@/lib/mock/listings";
import { countOpenOwnerSearchTasks } from "@/lib/mock/owner-search";
import { countAgingVerificationTasks } from "@/lib/mock/verification";

export default async function HomePage() {
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "super_admin" || profile?.role === "area_admin";

  if (!profile || !isAdmin) {
    return (
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Welcome to Bizlocate</h1>
        <p className="mt-2 text-slate-600">Signed in successfully.</p>
      </div>
    );
  }

  const available = countListingsByStatus("available");
  const openOwnerSearch = countOpenOwnerSearchTasks();
  const aging = countAgingVerificationTasks(45);
  const firstName = profile.fullName.split(" ")[0];

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Good morning, {firstName}</h1>
        <p className="text-slate-600">{openOwnerSearch + aging} items need you today.</p>
      </div>

      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
        <StatTile label="Available" value={available} href="/listings" />
        <StatTile label="Owner search" value={openOwnerSearch} href="/owner-search" tone="accent" />
        <StatTile label="Aging 45d+" value={aging} href="/verification" tone="warn" />
      </div>

      <div>
        <h2 className="mb-3 font-medium text-slate-900">Work queue</h2>
        <div className="rounded-2xl border border-sky-100 bg-white shadow-sm">
          <WorkQueueRow
            label="Danau Niaga 3, GF"
            note="Amirul · has tenant · 3h"
            href="/contact-requests"
            action="Review"
          />
          <WorkQueueRow
            label="Genting Klang 12A"
            note="Number found · Siti · 1d"
            href="/owner-search"
            action="Open"
          />
          <WorkQueueRow
            label="Metro Perdana 8, GF"
            note="52 days unverified"
            href="/verification"
            action="Open"
            last
          />
        </div>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: number;
  href: string;
  tone?: "accent" | "warn";
}) {
  const toneClasses =
    tone === "accent"
      ? "bg-sky-50 border-sky-200 text-sky-800"
      : tone === "warn"
        ? "bg-amber-50 border-amber-200 text-amber-800"
        : "bg-white border-sky-100 text-slate-900";

  return (
    <Link href={href} className={`rounded-2xl border p-4 shadow-sm ${toneClasses}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-3xl font-extrabold leading-tight">{value}</div>
    </Link>
  );
}

function WorkQueueRow({
  label,
  note,
  href,
  action,
  last,
}: {
  label: string;
  note: string;
  href: string;
  action: string;
  last?: boolean;
}) {
  return (
    <div className={`flex items-center gap-4 px-5 py-3.5 ${last ? "" : "border-b border-sky-100"}`}>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900">{label}</p>
        <p className="text-sm text-slate-600">{note}</p>
      </div>
      <Link
        href={href}
        className="flex-none rounded-full border border-slate-300 px-3.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
      >
        {action}
      </Link>
    </div>
  );
}
