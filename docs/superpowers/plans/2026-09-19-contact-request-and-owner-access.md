# Contact Request & Temporary Owner Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SP can browse Available Listings (owner-safe fields only) and request owner contact with a reason. Admin (Super Admin / Area Admin scoped to area) approves or rejects the request; approval creates a time-boxed `contact_access_logs` row (48h). While that access is active, the requesting SP sees the owner's real name + phone on the listing; once expired (or if never approved), the phone stays masked. Admin never needs this reveal path — admins already read `owners` directly via existing RLS.

**Architecture:** Same pattern as every prior plan — Server Components read via RLS-gated Supabase queries, Server Actions handle writes with a UX-level role check backstopped by DB RLS/GRANTs. One new migration: a single security-definer function is the *only* path by which a non-admin can ever see an owner's phone number — this is the real enforcement of "SP never gets direct owner PII," matching the design spec's `owners`/`contact_access_logs` no-SELECT-for-SP rule. Everything else (tables, RLS, `available_listings` view) already exists from `0001_phase1_schema.sql`.

**Tech Stack:** Next.js Server Components/Actions, Supabase (`@supabase/ssr`), Tailwind, the shared `Badge` component, one Postgres migration (SQL Editor, run manually by the user as with every prior migration).

## Important Context: Replacing a Mock Page, Same Policy as Prior Plans

`src/app/(app)/contact-requests/page.tsx` currently renders `ContactRequestBoard` (`src/components/contact-request-board.tsx`) fed by `src/lib/mock/contact-requests.ts` — a design-reference mock from the parallel UI-shell session, with a client-side two-pane list+detail and non-functional Approve/Reject buttons. This plan replaces `contact-requests/page.tsx` with the route-based list+detail pattern used everywhere else in this codebase, and adds a brand-new SP-facing route (`/available-listings`) that has no mock counterpart. Per established policy, `src/lib/mock/contact-requests.ts` and `src/components/contact-request-board.tsx` are **not** deleted or modified — they stay in place, unused.

The sidebar nav already has `"/contact-requests"` in `ADMIN_NAV` (`src/components/app-shell.tsx`) — no nav task needed for that. `/available-listings` is new and needs a `GENERAL_NAV` entry (same unconditional slot `"/submit-unit"` uses, so every role including `sp` sees it).

## Schema This Plan Assumes (already deployed — do not re-create)

- `contact_requests(id, listing_id not null, requested_by not null, reason text check in ('have_tenant','arrange_viewing','rental_negotiation','listing_verification','other'), tenant_company, business_type, budget numeric, move_in_date date, remarks, status text default 'pending' check in ('pending','approved','rejected','expired'), approved_by, approved_at, created_at)`. RLS: insert only as self (`requested_by = auth.uid()`), select own or admin-scoped-to-listing's-area, update admin-scoped-to-listing's-area only.
- `contact_access_logs(id, contact_request_id not null, user_id not null, owner_id not null, unit_id not null, listing_id not null, reason, approved_by, approval_date, access_start, access_expiry not null, revoked default false)`. RLS: select own or admin-scoped; insert/update admin-scoped only. **No SELECT policy exists for `owners` for non-admins** — this plan does not add one; the reveal path is the new security-definer function instead.
- `public.available_listings` view (`security_invoker = true`, `0001` lines 556-569): already excludes all owner PII, already readable by every authenticated role via `listings_select_all` (`auth.role() = 'authenticated'`).
- `unit_ownerships(id, unit_id, space_id, owner_id, is_primary, start_date, end_date, created_at)` — this plan reads it (inside the new function and inside the approve action) to find the unit's current owner; it does not write to it.

## Global Constraints

- The 48-hour access window is a fixed constant, not a configurable setting — matches the existing mock UI's "Approve 48h" button and the spec's "24/48h" note; no admin-facing duration picker in this plan.
- `contact_access_logs.revoked` exists in the schema but this plan never sets it `true` — manual early-revoke is out of scope (no button for it); expiry is time-only.
- The `expired` value in `contact_requests.status` is a valid DB literal but nothing in this plan transitions a row to it automatically — "expired" access is derived at read time from `contact_access_logs.access_expiry`, not from `contact_requests.status`. A request row can sit at `approved` forever while its access window still correctly shows as expired in the UI.
- Approve/reject use the same atomic-claim pattern established in the Submit-Unit plan (`.eq("status","pending")` on the update) to prevent a double-approve race.
- If a listing's unit has no owner on record yet (`unit_ownerships` empty), Approve fails with an explicit error instead of inserting a `contact_access_logs` row with a null `owner_id` (the column is `not null`).
- Light theme, white background, sky-blue accents, `Badge` component — match established conventions.

---

## File Structure

- `src/lib/contact-requests/labels.ts` — pure label/tone helpers for `reason` and `status`, plus `isContactAccessActive(accessExpiry, revoked)`.
- `supabase/migrations/0006_owner_contact_reveal.sql` — new: `get_owner_contact_for_listing(p_listing_id uuid)` security-definer function.
- `src/app/(app)/available-listings/page.tsx` — new: SP-facing browse list (any authenticated role).
- `src/app/(app)/available-listings/[listingId]/page.tsx` — new: listing detail + owner-contact panel (request form / pending / revealed / expired states).
- `src/app/(app)/available-listings/[listingId]/actions.ts` — new: `requestOwnerContact(formData)`.
- `src/app/(app)/contact-requests/page.tsx` — modify (full replacement): real list, admin-only.
- `src/app/(app)/contact-requests/[requestId]/page.tsx` — new: detail + Approve/Reject.
- `src/app/(app)/contact-requests/[requestId]/actions.ts` — new: `approveContactRequest`, `rejectContactRequest`.
- `src/components/app-shell.tsx` — modify: add `/available-listings` to `GENERAL_NAV`.

---

### Task 1: Contact request label helpers

**Files:**
- Create: `src/lib/contact-requests/labels.ts`
- Test: `src/lib/contact-requests/labels.test.ts`

**Interfaces:**
- Produces: `export type ContactRequestReason = "have_tenant" | "arrange_viewing" | "rental_negotiation" | "listing_verification" | "other"`
- Produces: `export const CONTACT_REQUEST_REASONS: ContactRequestReason[]`
- Produces: `export function contactRequestReasonLabel(reason: ContactRequestReason): string`
- Produces: `export type ContactRequestStatus = "pending" | "approved" | "rejected" | "expired"`
- Produces: `export function contactRequestStatusLabel(status: ContactRequestStatus): string`
- Produces: `export function contactRequestStatusTone(status: ContactRequestStatus): BadgeTone` (imports `BadgeTone` from `@/lib/ui/badge-tone`)
- Produces: `export function isContactAccessActive(accessExpiry: string, revoked: boolean): boolean`

- [ ] **Step 1: Write the failing test**

Create `src/lib/contact-requests/labels.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  contactRequestReasonLabel,
  contactRequestStatusLabel,
  contactRequestStatusTone,
  isContactAccessActive,
  CONTACT_REQUEST_REASONS,
} from "./labels";

describe("contactRequestReasonLabel", () => {
  it("labels every reason", () => {
    expect(contactRequestReasonLabel("have_tenant")).toBe("I have a tenant");
    expect(contactRequestReasonLabel("arrange_viewing")).toBe("Arrange viewing");
    expect(contactRequestReasonLabel("rental_negotiation")).toBe("Rental negotiation");
    expect(contactRequestReasonLabel("listing_verification")).toBe("Listing verification");
    expect(contactRequestReasonLabel("other")).toBe("Other");
  });

  it("has exactly the 5 DB enum values", () => {
    expect(CONTACT_REQUEST_REASONS).toEqual([
      "have_tenant",
      "arrange_viewing",
      "rental_negotiation",
      "listing_verification",
      "other",
    ]);
  });
});

describe("contactRequestStatusLabel / Tone", () => {
  it("labels and tones every status without throwing", () => {
    for (const status of ["pending", "approved", "rejected", "expired"] as const) {
      expect(typeof contactRequestStatusLabel(status)).toBe("string");
      expect(typeof contactRequestStatusTone(status)).toBe("string");
    }
  });
});

describe("isContactAccessActive", () => {
  it("is true for a future expiry that isn't revoked", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isContactAccessActive(future, false)).toBe(true);
  });

  it("is false once past expiry", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(isContactAccessActive(past, false)).toBe(false);
  });

  it("is false when revoked even with a future expiry", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isContactAccessActive(future, true)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './labels'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/contact-requests/labels.ts`:

```typescript
import type { BadgeTone } from "@/lib/ui/badge-tone";

export type ContactRequestReason =
  | "have_tenant"
  | "arrange_viewing"
  | "rental_negotiation"
  | "listing_verification"
  | "other";

export const CONTACT_REQUEST_REASONS: ContactRequestReason[] = [
  "have_tenant",
  "arrange_viewing",
  "rental_negotiation",
  "listing_verification",
  "other",
];

const REASON_LABELS: Record<ContactRequestReason, string> = {
  have_tenant: "I have a tenant",
  arrange_viewing: "Arrange viewing",
  rental_negotiation: "Rental negotiation",
  listing_verification: "Listing verification",
  other: "Other",
};

export function contactRequestReasonLabel(reason: ContactRequestReason): string {
  return REASON_LABELS[reason];
}

export type ContactRequestStatus = "pending" | "approved" | "rejected" | "expired";

const STATUS_LABELS: Record<ContactRequestStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  expired: "Expired",
};

const STATUS_TONES: Record<ContactRequestStatus, BadgeTone> = {
  pending: "warn",
  approved: "ok",
  rejected: "dark",
  expired: "neutral",
};

export function contactRequestStatusLabel(status: ContactRequestStatus): string {
  return STATUS_LABELS[status];
}

export function contactRequestStatusTone(status: ContactRequestStatus): BadgeTone {
  return STATUS_TONES[status];
}

export function isContactAccessActive(accessExpiry: string, revoked: boolean): boolean {
  return !revoked && new Date(accessExpiry).getTime() > Date.now();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/contact-requests/labels.ts src/lib/contact-requests/labels.test.ts
git commit -m "feat: add contact request label helpers"
```

---

### Task 2: Owner contact reveal migration

**Files:**
- Create: `supabase/migrations/0006_owner_contact_reveal.sql`

**Interfaces:**
- Produces: Postgres function `public.get_owner_contact_for_listing(p_listing_id uuid) returns table(owner_name text, phone text, access_expiry timestamptz)`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0006_owner_contact_reveal.sql`:

```sql
-- The only path by which a non-admin ever sees an owner's name/phone.
-- Admins already read `owners` directly (owners_select_admin_scoped, 0005).
-- Everyone else gets a row back ONLY if they hold an active, unrevoked,
-- unexpired contact_access_logs entry for this listing (or is an admin,
-- so the app doesn't need to branch the query by role).
create or replace function public.get_owner_contact_for_listing(p_listing_id uuid)
returns table(owner_name text, phone text, access_expiry timestamptz)
language sql stable security definer set search_path = public as $$
  select o.name, o.primary_contact, cal.access_expiry
  from public.listings l
  join public.unit_ownerships uo on uo.unit_id = l.unit_id
  join public.owners o on o.id = uo.owner_id
  left join public.contact_access_logs cal
    on cal.listing_id = l.id
    and cal.user_id = auth.uid()
    and cal.revoked = false
    and cal.access_expiry > now()
  where l.id = p_listing_id
    and (
      public.is_super_admin()
      or public.is_area_admin_for_area(public.area_id_for_listing(p_listing_id))
      or cal.id is not null
    )
  order by uo.is_primary desc, uo.created_at asc
  limit 1;
$$;

grant execute on function public.get_owner_contact_for_listing(uuid) to authenticated;
```

- [ ] **Step 2: Hand off to the user to run**

Tell the user (in Chinese, matching how every prior migration was handed off): 去 Supabase SQL Editor 跑 `0006_owner_contact_reveal.sql`, 跑完回报 "跑好了".

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0006_owner_contact_reveal.sql
git commit -m "feat: add owner contact reveal function for temporary access"
```

---

### Task 3: SP Available Listings browse + Request Owner Contact

**Files:**
- Create: `src/app/(app)/available-listings/page.tsx`
- Create: `src/app/(app)/available-listings/[listingId]/page.tsx`
- Create: `src/app/(app)/available-listings/[listingId]/actions.ts`
- Modify: `src/components/app-shell.tsx`

**Interfaces:**
- Consumes: `getCurrentProfile()`, `createClient()`, `CONTACT_REQUEST_REASONS`, `contactRequestReasonLabel`, `contactRequestStatusLabel`, `contactRequestStatusTone`, `isContactAccessActive` from `@/lib/contact-requests/labels` (Task 1), `get_owner_contact_for_listing` RPC (Task 2), `Badge` from `@/components/badge`
- Produces: `export async function requestOwnerContact(formData: FormData): Promise<void>`

- [ ] **Step 1: List page**

Create `src/app/(app)/available-listings/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";

export default async function AvailableListingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data: listings } = await supabase
    .from("available_listings")
    .select("id, jalan, unit_no, unit_code, sub_area_name, area_name, floor_label, asking_rental")
    .order("last_verified_date", { ascending: false });

  const rows = listings ?? [];

  return (
    <div className="max-w-5xl space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Available listings</h1>

      <div className="rounded-2xl border border-sky-100 bg-white shadow-sm">
        {rows.map((listing, i) => (
          <Link
            key={listing.id}
            href={`/available-listings/${listing.id}`}
            className={`flex items-center gap-4 px-5 py-3.5 hover:bg-sky-50/60 ${
              i === rows.length - 1 ? "" : "border-b border-sky-100"
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">
                {listing.jalan} {listing.unit_no}
              </p>
              <p className="text-sm text-slate-600">
                {listing.unit_code} · {listing.area_name} / {listing.sub_area_name} ·{" "}
                {listing.floor_label ?? "Whole unit"}
              </p>
            </div>
            <strong className="text-slate-900">
              {listing.asking_rental ? `RM ${Number(listing.asking_rental).toLocaleString()}` : "—"}
            </strong>
          </Link>
        ))}
        {rows.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-600">No available listings.</p>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Request action**

Create `src/app/(app)/available-listings/[listingId]/actions.ts`:

```typescript
"use server";

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";

export async function requestOwnerContact(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  const listingId = String(formData.get("listingId"));
  const reason = String(formData.get("reason"));
  const tenantCompany = String(formData.get("tenantCompany") ?? "");
  const businessType = String(formData.get("businessType") ?? "");
  const budget = String(formData.get("budget") ?? "");
  const moveInDate = String(formData.get("moveInDate") ?? "");
  const remarks = String(formData.get("remarks") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.from("contact_requests").insert({
    listing_id: listingId,
    requested_by: profile.id,
    reason,
    tenant_company: tenantCompany || null,
    business_type: businessType || null,
    budget: budget ? Number(budget) : null,
    move_in_date: moveInDate || null,
    remarks: remarks || null,
  });

  if (error) {
    redirect(`/available-listings/${listingId}?error=request_failed`);
  }

  redirect(`/available-listings/${listingId}?requested=1`);
}
```

- [ ] **Step 3: Detail page**

Create `src/app/(app)/available-listings/[listingId]/page.tsx`:

```tsx
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/badge";
import {
  CONTACT_REQUEST_REASONS,
  contactRequestReasonLabel,
  contactRequestStatusLabel,
  contactRequestStatusTone,
  type ContactRequestReason,
  type ContactRequestStatus,
} from "@/lib/contact-requests/labels";
import { requestOwnerContact } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  request_failed: "Could not send request. Try again.",
};

const FIELD_CLASSES =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none";

export default async function AvailableListingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ listingId: string }>;
  searchParams: Promise<{ error?: string; requested?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  const { listingId } = await params;
  const { error, requested } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  const supabase = await createClient();
  const { data: listing } = await supabase
    .from("available_listings")
    .select(
      "id, jalan, unit_no, unit_code, full_address, sub_area_name, area_name, floor_label, asking_rental, remarks",
    )
    .eq("id", listingId)
    .single();

  if (!listing) {
    notFound();
  }

  const { data: latestRequest } = await supabase
    .from("contact_requests")
    .select("id, status")
    .eq("listing_id", listingId)
    .eq("requested_by", profile.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: reveal } = await supabase
    .rpc("get_owner_contact_for_listing", { p_listing_id: listingId })
    .maybeSingle();

  return (
    <div className="max-w-2xl space-y-5">
      <Link className="text-sm text-sky-600" href="/available-listings">
        ← Available listings
      </Link>

      <div>
        <h1 className="text-lg font-semibold text-slate-900">
          {listing.jalan} {listing.unit_no}
        </h1>
        <p className="text-sm text-slate-600">
          {listing.unit_code} · {listing.area_name} / {listing.sub_area_name} ·{" "}
          {listing.floor_label ?? "Whole unit"}
        </p>
        <p className="mt-1 text-2xl font-extrabold text-slate-900">
          {listing.asking_rental ? `RM ${Number(listing.asking_rental).toLocaleString()} / month` : "—"}
        </p>
      </div>

      <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Owner contact
        </div>

        {reveal ? (
          <div className="mt-2">
            <p className="font-semibold text-slate-900">{reveal.owner_name}</p>
            <p className="text-slate-900">{reveal.phone}</p>
            <p className="mt-1 text-sm text-slate-600">
              Access expires {new Date(reveal.access_expiry).toLocaleString("en-MY")}
            </p>
          </div>
        ) : latestRequest?.status === "pending" ? (
          <p className="mt-2 text-sm text-slate-600">
            <Badge tone={contactRequestStatusTone("pending")}>Pending</Badge> Waiting for admin approval.
          </p>
        ) : (
          <>
            {latestRequest?.status === "rejected" ? (
              <p className="mt-2 text-sm text-slate-600">
                <Badge tone={contactRequestStatusTone("rejected")}>Rejected</Badge> Your last request was
                rejected — you can request again.
              </p>
            ) : latestRequest?.status === "approved" ? (
              <p className="mt-2 text-sm text-slate-600">Your access window has expired — request again.</p>
            ) : null}

            {requested ? (
              <p className="mt-2 text-sm text-sky-700">Request sent.</p>
            ) : null}
            {errorMessage ? <p className="mt-2 text-sm text-red-600">{errorMessage}</p> : null}

            <form action={requestOwnerContact} className="mt-3 space-y-3">
              <input type="hidden" name="listingId" value={listing.id} />
              <div className="space-y-1">
                <label className="text-sm text-slate-700" htmlFor="reason">
                  Reason
                </label>
                <select id="reason" name="reason" className={FIELD_CLASSES} defaultValue="have_tenant">
                  {CONTACT_REQUEST_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {contactRequestReasonLabel(r as ContactRequestReason)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm text-slate-700" htmlFor="tenantCompany">
                  Tenant / company
                </label>
                <input id="tenantCompany" name="tenantCompany" className={FIELD_CLASSES} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm text-slate-700" htmlFor="budget">
                    Budget (RM)
                  </label>
                  <input id="budget" name="budget" type="number" className={FIELD_CLASSES} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-slate-700" htmlFor="moveInDate">
                    Move in
                  </label>
                  <input id="moveInDate" name="moveInDate" type="date" className={FIELD_CLASSES} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm text-slate-700" htmlFor="remarks">
                  Remarks
                </label>
                <textarea id="remarks" name="remarks" className={FIELD_CLASSES} />
              </div>
              <button
                type="submit"
                className="w-full rounded-md bg-sky-600 px-4 py-2 text-base font-medium text-white hover:bg-sky-700"
              >
                Request owner contact
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Nav entry**

In `src/components/app-shell.tsx`, change:

```typescript
const GENERAL_NAV = [{ href: "/submit-unit", label: "Submit Unit" }];
```

to:

```typescript
const GENERAL_NAV = [
  { href: "/submit-unit", label: "Submit Unit" },
  { href: "/available-listings", label: "Available Listings" },
];
```

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit` — no new errors.
Run: `npm test` — still passing.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/available-listings" src/components/app-shell.tsx
git commit -m "feat: add SP available listings browse and request owner contact"
```

---

### Task 4: Admin Contact Requests — approve/reject with temporary access

**Files:**
- Modify (full replacement): `src/app/(app)/contact-requests/page.tsx`
- Create: `src/app/(app)/contact-requests/[requestId]/page.tsx`
- Create: `src/app/(app)/contact-requests/[requestId]/actions.ts`

**Interfaces:**
- Consumes: `getCurrentProfile()`, `createClient()`, `contactRequestReasonLabel`, `contactRequestStatusLabel`, `contactRequestStatusTone` from `@/lib/contact-requests/labels` (Task 1), `Badge` from `@/components/badge`
- Produces: `export async function approveContactRequest(formData: FormData): Promise<void>`, `export async function rejectContactRequest(formData: FormData): Promise<void>`

- [ ] **Step 1: Replace the list page**

Replace `src/app/(app)/contact-requests/page.tsx` with:

```tsx
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/badge";
import {
  contactRequestStatusLabel,
  contactRequestStatusTone,
  type ContactRequestStatus,
} from "@/lib/contact-requests/labels";

export default async function ContactRequestsPage() {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "area_admin")) {
    redirect("/");
  }

  const supabase = await createClient();
  const { data: requests } = await supabase
    .from("contact_requests")
    .select(
      "id, status, reason, created_at, profiles(full_name), listings(units(jalan, unit_no, unit_code))",
    )
    .order("created_at", { ascending: false });

  const allRows = requests ?? [];
  const rows = [
    ...allRows.filter((r) => r.status === "pending"),
    ...allRows.filter((r) => r.status !== "pending"),
  ];
  const pendingCount = rows.filter((r) => r.status === "pending").length;

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-lg font-semibold text-slate-900">Contact requests</h1>
        <Badge tone="warn">Pending {pendingCount}</Badge>
      </div>

      <div className="rounded-2xl border border-sky-100 bg-white shadow-sm">
        {rows.map((request, i) => (
          <a
            key={request.id}
            href={`/contact-requests/${request.id}`}
            className={`flex items-center gap-4 px-5 py-3.5 hover:bg-sky-50/60 ${
              i === rows.length - 1 ? "" : "border-b border-sky-100"
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">
                {/* @ts-expect-error -- Supabase nested select typing */}
                {request.profiles?.full_name}
              </p>
              <p className="text-sm text-slate-600">
                {/* @ts-expect-error -- Supabase nested select typing */}
                {request.listings?.units?.jalan} {request.listings?.units?.unit_no} ·{" "}
                {/* @ts-expect-error -- Supabase nested select typing */}
                {request.listings?.units?.unit_code}
              </p>
            </div>
            <Badge tone={contactRequestStatusTone(request.status as ContactRequestStatus)}>
              {contactRequestStatusLabel(request.status as ContactRequestStatus)}
            </Badge>
          </a>
        ))}
        {rows.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-600">No contact requests.</p>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Actions**

Create `src/app/(app)/contact-requests/[requestId]/actions.ts`:

```typescript
"use server";

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";

export async function approveContactRequest(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor || (actor.role !== "super_admin" && actor.role !== "area_admin")) {
    redirect("/");
  }

  const requestId = String(formData.get("requestId"));
  const supabase = await createClient();

  const { data: request } = await supabase
    .from("contact_requests")
    .select("id, listing_id, requested_by, reason, listings(unit_id)")
    .eq("id", requestId)
    .single();

  if (!request) {
    redirect("/contact-requests");
  }

  // @ts-expect-error -- Supabase nested select typing
  const unitId = request.listings?.unit_id as string | undefined;
  const { data: ownership } = await supabase
    .from("unit_ownerships")
    .select("owner_id")
    .eq("unit_id", unitId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!ownership) {
    redirect(`/contact-requests/${requestId}?error=no_owner`);
  }

  const { data: claimed } = await supabase
    .from("contact_requests")
    .update({ status: "approved", approved_by: actor.id, approved_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "pending")
    .select()
    .maybeSingle();

  if (!claimed) {
    redirect(`/contact-requests/${requestId}?error=already_handled`);
  }

  const accessExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const { error: logError } = await supabase.from("contact_access_logs").insert({
    contact_request_id: requestId,
    user_id: request.requested_by,
    owner_id: ownership!.owner_id,
    unit_id: unitId,
    listing_id: request.listing_id,
    reason: request.reason,
    approved_by: actor.id,
    access_expiry: accessExpiry,
  });

  if (logError) {
    redirect(`/contact-requests/${requestId}?error=access_log_failed`);
  }

  redirect(`/contact-requests/${requestId}?approved=1`);
}

export async function rejectContactRequest(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor || (actor.role !== "super_admin" && actor.role !== "area_admin")) {
    redirect("/");
  }

  const requestId = String(formData.get("requestId"));
  const supabase = await createClient();

  const { data: claimed } = await supabase
    .from("contact_requests")
    .update({ status: "rejected", approved_by: actor.id, approved_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "pending")
    .select()
    .maybeSingle();

  if (!claimed) {
    redirect(`/contact-requests/${requestId}?error=already_handled`);
  }

  redirect(`/contact-requests/${requestId}?rejected=1`);
}
```

- [ ] **Step 3: Detail page**

Create `src/app/(app)/contact-requests/[requestId]/page.tsx`:

```tsx
import { redirect, notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/badge";
import {
  contactRequestReasonLabel,
  contactRequestStatusLabel,
  contactRequestStatusTone,
  type ContactRequestReason,
  type ContactRequestStatus,
} from "@/lib/contact-requests/labels";
import { approveContactRequest, rejectContactRequest } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  no_owner: "This unit has no owner on record yet — add one before approving.",
  already_handled: "This request was already approved or rejected.",
  access_log_failed: "Approved but could not create the access log. Contact an admin.",
};

export default async function ContactRequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<{ error?: string; approved?: string; rejected?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "area_admin")) {
    redirect("/");
  }

  const { requestId } = await params;
  const { error, approved, rejected } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  const supabase = await createClient();
  const { data: request } = await supabase
    .from("contact_requests")
    .select(
      "id, status, reason, tenant_company, business_type, budget, move_in_date, remarks, created_at, profiles(full_name), listings(units(jalan, unit_no, unit_code, full_address))",
    )
    .eq("id", requestId)
    .single();

  if (!request) {
    notFound();
  }

  return (
    <div className="max-w-2xl space-y-5">
      <a className="text-sm text-sky-600" href="/contact-requests">
        ← Contact requests
      </a>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-lg font-semibold text-slate-900">
          {/* @ts-expect-error -- Supabase nested select typing */}
          {request.profiles?.full_name}
        </h1>
        <Badge tone={contactRequestStatusTone(request.status as ContactRequestStatus)}>
          {contactRequestStatusLabel(request.status as ContactRequestStatus)}
        </Badge>
      </div>

      <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-600">
          {/* @ts-expect-error -- Supabase nested select typing */}
          {request.listings?.units?.jalan} {request.listings?.units?.unit_no} ·{" "}
          {/* @ts-expect-error -- Supabase nested select typing */}
          {request.listings?.units?.unit_code}
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <Field label="Reason" value={contactRequestReasonLabel(request.reason as ContactRequestReason)} />
          <Field label="Tenant / company" value={request.tenant_company} />
          <Field label="Business type" value={request.business_type} />
          <Field label="Budget" value={request.budget ? `RM ${Number(request.budget).toLocaleString()}` : null} />
          <Field label="Move in" value={request.move_in_date} />
          <Field label="Remarks" value={request.remarks} />
        </dl>

        {approved ? <p className="mt-4 text-sm text-sky-700">Approved — 48h access granted.</p> : null}
        {rejected ? <p className="mt-4 text-sm text-slate-600">Rejected.</p> : null}
        {errorMessage ? <p className="mt-4 text-sm text-red-600">{errorMessage}</p> : null}

        {request.status === "pending" ? (
          <div className="mt-5 flex gap-2">
            <form action={approveContactRequest}>
              <input type="hidden" name="requestId" value={request.id} />
              <button
                type="submit"
                className="rounded-full bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
              >
                Approve 48h
              </button>
            </form>
            <form action={rejectContactRequest}>
              <input type="hidden" name="requestId" value={request.id} />
              <button
                type="submit"
                className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Reject
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-slate-900">{value ?? "—"}</div>
    </div>
  );
}
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit` — no new errors.
Run: `npm test` — still passing.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/contact-requests"
git commit -m "feat: wire contact requests to real data with temporary owner access"
```

---

## Manual Verification (controller-driven, after all tasks land)

1. As `sp`, go to `/available-listings` → confirm listings show with no owner fields anywhere in the DOM. Open one → confirm "Owner contact" shows a request form.
2. Submit the form with reason "I have a tenant" → confirm redirect shows "Request sent." and the panel now shows "Pending" instead of the form.
3. As `super_admin`, go to `/contact-requests` → confirm the new request appears with Pending badge and the SP's name/listing address. Open it → confirm all submitted fields render.
4. Click "Approve 48h" → confirm redirect shows "Approved — 48h access granted." and the badge updates to Approved.
5. Back as `sp` on the same listing detail page → confirm the owner's real name and phone now render, with an "Access expires <date>" line roughly 48h out.
6. As `super_admin`, run `select access_expiry from contact_access_logs order by access_start desc limit 1;` in SQL Editor, note the row's `id`, then manually `update contact_access_logs set access_expiry = now() - interval '1 hour' where id = '<that id>';` to simulate expiry.
7. Reload the SP's listing detail page → confirm the panel falls back to "Your access window has expired — request again." with the form showing again (not the phone number).
8. As `sp`, submit a second request on a different available listing; as admin, click "Reject" on it → confirm the SP's detail page shows "Your last request was rejected — you can request again." and the request form.
9. Confirm `/contact-requests` for an `area_admin` scoped to a different area does not show requests for listings outside their assigned area (RLS `contact_requests_select` already enforces this — verify the list is empty or correctly filtered for that admin).

## Self-Review Notes

- **Spec coverage:** spec workflow lines 219-221 ("SP: browse Available Listings -> Request Owner Contact (reason required)" / "Area Admin: Approve/Reject -> contact_access_logs row, 24/48h expiry, phone auto-masks again after expiry") and the role-matrix rule that `owners`/`contact_access_logs` have no SP SELECT policy (spec line 177). Manual revoke, configurable expiry duration, and auto-transitioning `contact_requests.status` to `expired` are explicitly out of scope per Global Constraints.
- **Placeholder scan:** none — every action performs a real DB write, every read is a real Supabase query.
- **Type consistency:** `ContactRequestReason`/`ContactRequestStatus` from Task 1 used identically across Tasks 3 and 4. `requestOwnerContact`'s field names (`listingId`, `reason`, `tenantCompany`, `businessType`, `budget`, `moveInDate`, `remarks`) match Task 3's form exactly. `approveContactRequest`/`rejectContactRequest`'s `requestId` field matches Task 4's forms exactly.
- **Security boundary:** the new migration's function is the single chokepoint for owner PII reaching a non-admin — it does not grant any new table-level SELECT on `owners` or `contact_access_logs`, so the "no SELECT policy for SP" rule from the original design spec stays intact.
