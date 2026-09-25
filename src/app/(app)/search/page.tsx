import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { canAccessAdminTools } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";
import { sanitizeSearchTerm } from "@/lib/search/sanitize";

const LIMIT = 20;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  const { q } = await searchParams;
  const term = sanitizeSearchTerm(Array.isArray(q) ? (q[0] ?? "") : (q ?? ""));

  if (term.length < 2) {
    return (
      <div className="max-w-5xl space-y-4">
        <h1 className="text-lg font-semibold text-slate-900">Search</h1>
        <p className="text-sm text-slate-600">Type at least 2 characters.</p>
      </div>
    );
  }

  const supabase = await createClient();
  const isAdmin = canAccessAdminTools(profile.role);
  const pat = `%${term}%`;

  // sp may only search unit/listing identifiers, never owner data: owner/unit queries are admin-only.
  const [listingsRes, unitsRes, ownersRes] = await Promise.all([
    supabase
      .from("available_listings")
      .select("id, jalan, unit_no, unit_code, full_address, sub_area_name, area_name, asking_rental")
      .or(`jalan.ilike.${pat},unit_no.ilike.${pat},unit_code.ilike.${pat},full_address.ilike.${pat}`)
      .order("unit_code").limit(LIMIT),
    isAdmin
      ? supabase
          .from("units")
          .select("id, unit_code, jalan, unit_no, full_address")
          .or(`unit_code.ilike.${pat},jalan.ilike.${pat},unit_no.ilike.${pat},full_address.ilike.${pat}`)
          .order("unit_code").limit(LIMIT)
      : null,
    isAdmin
      ? supabase
          .from("owners")
          .select("id, name, primary_contact, other_contact")
          .or(`name.ilike.${pat},primary_contact.ilike.${pat},other_contact.ilike.${pat}`)
          .order("name").limit(LIMIT)
      : null,
  ]);

  const errors = [listingsRes.error, unitsRes?.error, ownersRes?.error].filter(Boolean);
  const listings = listingsRes.data ?? [];
  const units = unitsRes?.data ?? [];
  const owners = ownersRes?.data ?? [];
  const empty = listings.length + units.length + owners.length === 0;

  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Search</h1>

      {errors.map((e, i) => (
        <p key={i} className="text-sm text-red-600">
          Search error: {e?.message}
        </p>
      ))}

      {listings.length > 0 ? (
        <Section title="Listings">
          {listings.map((l) => (
            <Row key={l.id} href={`/available-listings/${l.id}`}>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900">{l.full_address}</p>
                <p className="text-sm text-slate-600">
                  {l.unit_code} · {l.area_name} / {l.sub_area_name}
                </p>
              </div>
              <strong className="text-slate-900">
                {l.asking_rental ? `RM ${Number(l.asking_rental).toLocaleString()}` : "—"}
              </strong>
            </Row>
          ))}
        </Section>
      ) : null}

      {units.length > 0 ? (
        <Section title="Units">
          {units.map((u) => (
            <Row key={u.id} href={`/units/${u.id}`}>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900">{u.full_address}</p>
                <p className="text-sm text-slate-600">{u.unit_code}</p>
              </div>
            </Row>
          ))}
        </Section>
      ) : null}

      {owners.length > 0 ? (
        <Section title="Owners">
          {owners.map((o) => (
            <Row key={o.id} href={`/owners/${o.id}`}>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900">{o.name}</p>
                <p className="text-sm text-slate-600">{o.primary_contact ?? "—"}</p>
              </div>
            </Row>
          ))}
        </Section>
      ) : null}

      {empty && errors.length === 0 ? (
        <p className="text-sm text-slate-600">No results for “{term}”.</p>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      <div className="rounded-2xl border border-sky-100 bg-white shadow-sm">{children}</div>
    </section>
  );
}

function Row({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 border-b border-sky-100 px-5 py-3.5 last:border-b-0 hover:bg-sky-50/60"
    >
      {children}
    </Link>
  );
}
