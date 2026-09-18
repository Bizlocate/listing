# Area Admin Assignment & Owners Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Super Admin can assign Area Admins to Areas (closing the gap left by the previous plan — area-scoped features existed but had no way to actually assign anyone). Admins can record property Owners against a Unit (or a specific Unit Space), browse/search Owners, and update an Owner's verification/contact status.

**Architecture:** Same pattern as the previous two plans — Server Components read via RLS-gated Supabase queries, Server Actions handle writes with a UX-level role check backstopped by already-deployed RLS. No new migrations needed: `owners`, `unit_ownerships`, and `area_admins` already exist with full RLS from `0001_phase1_schema.sql`.

**Tech Stack:** Next.js Server Components/Actions, Supabase (`@supabase/ssr`), Tailwind (existing conventions).

## Schema This Plan Assumes (already deployed — do not re-create)

- `area_admins(profile_id uuid, area_id uuid)` — composite primary key `(profile_id, area_id)`, so a duplicate assignment insert fails with Postgres error `23505`. RLS: only `super_admin` can write; a user can SELECT their own rows.
- `owners(id uuid, name text not null, primary_contact text, other_contact text, ic_or_company_no text, owner_type text, verification_status text default 'unverified' check in ('unverified','possible_owner','verified_owner','wrong_contact'), contact_status text default 'not_contacted' check in ('not_contacted','no_answer','contacted','follow_up','wrong_number','do_not_contact'), remarks text, created_by uuid, created_at, last_verified_date date)`. RLS (`owners_admin_scoped`): SELECT/UPDATE/DELETE allowed for `super_admin`, the row's `created_by`, or an `area_admin` whose assigned area contains a unit linked to this owner via `unit_ownerships`. INSERT requires `created_by = auth.uid()` and role `super_admin` or `area_admin`.
- `unit_ownerships(id uuid, unit_id uuid not null, space_id uuid nullable, owner_id uuid not null, is_primary boolean default true, start_date date default current_date, end_date date nullable)`. RLS (`unit_ownerships_admin_scoped`): scoped to `super_admin` or the `area_admin` of the unit's area, for all operations.

Because RLS already enforces all of this, every Server Action in this plan does a role check purely for UX (avoid a wasted round trip); the database is the real boundary.

## Global Constraints

- Owner data is sensitive business information — never query or render it on any page reachable by the `sp` role (spec §6, §36). Every file in this plan lives under admin-gated routes/sections only.
- `verification_status` values are exactly `unverified | possible_owner | verified_owner | wrong_contact`; `contact_status` values are exactly `not_contacted | no_answer | contacted | follow_up | wrong_number | do_not_contact` (spec §6) — use these literal strings, matching the DB CHECK constraints exactly.
- One Owner may own multiple units; one Unit may have different owners per floor/space (spec §6) — `unit_ownerships.space_id` is nullable (null = whole unit), never force a space selection.
- The design spec's workflow section treats reaching `owner_confirmed`/Verified Owner as a deliberate, manual confirmation step — `last_verified_date` should only be (re)set when an admin explicitly sets `verification_status` to `verified_owner`, never auto-stamped on unrelated edits.
- Light theme, white background, sky-blue accents — match `src/app/(app)/units/[unitId]/page.tsx`'s existing conventions exactly.

---

## File Structure

- `src/lib/owners/status-labels.ts` — pure label-mapping functions for the two owner status enums.
- `src/app/(app)/admin/areas/[areaId]/actions.ts` — modify: add `assignAreaAdmin(formData)`.
- `src/app/(app)/admin/areas/[areaId]/page.tsx` — modify: add an "Assigned admins" list + assign form.
- `src/app/(app)/units/[unitId]/actions.ts` — modify: add `createOwnerForUnit(formData)`.
- `src/app/(app)/units/[unitId]/page.tsx` — modify: add an "Owners" section (admin-only) + add-owner form.
- `src/app/(app)/owners/page.tsx` — new: Owners list (admin-only, RLS-scoped).
- `src/app/(app)/owners/[ownerId]/actions.ts` — new: `updateOwner(formData)`.
- `src/app/(app)/owners/[ownerId]/page.tsx` — new: Owner detail + edit form.
- `src/app/(app)/page.tsx` — modify: add "Owners" link.

---

### Task 1: Owner status label helpers

**Files:**
- Create: `src/lib/owners/status-labels.ts`
- Test: `src/lib/owners/status-labels.test.ts`

**Interfaces:**
- Produces: `export type VerificationStatus = "unverified" | "possible_owner" | "verified_owner" | "wrong_contact"`
- Produces: `export type ContactStatus = "not_contacted" | "no_answer" | "contacted" | "follow_up" | "wrong_number" | "do_not_contact"`
- Produces: `export function verificationStatusLabel(status: VerificationStatus): string`
- Produces: `export function contactStatusLabel(status: ContactStatus): string`
- Produces: `export const VERIFICATION_STATUSES: VerificationStatus[]` and `export const CONTACT_STATUSES: ContactStatus[]` (for building `<select>` option lists)

- [ ] **Step 1: Write the failing test**

Create `src/lib/owners/status-labels.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  verificationStatusLabel,
  contactStatusLabel,
  VERIFICATION_STATUSES,
  CONTACT_STATUSES,
} from "./status-labels";

describe("verificationStatusLabel", () => {
  it("labels every verification status", () => {
    expect(verificationStatusLabel("unverified")).toBe("Unverified");
    expect(verificationStatusLabel("possible_owner")).toBe("Possible Owner");
    expect(verificationStatusLabel("verified_owner")).toBe("Verified Owner");
    expect(verificationStatusLabel("wrong_contact")).toBe("Wrong Contact");
  });
});

describe("contactStatusLabel", () => {
  it("labels every contact status", () => {
    expect(contactStatusLabel("not_contacted")).toBe("Not Contacted");
    expect(contactStatusLabel("no_answer")).toBe("No Answer");
    expect(contactStatusLabel("contacted")).toBe("Contacted");
    expect(contactStatusLabel("follow_up")).toBe("Follow Up");
    expect(contactStatusLabel("wrong_number")).toBe("Wrong Number");
    expect(contactStatusLabel("do_not_contact")).toBe("Do Not Contact");
  });
});

describe("status lists", () => {
  it("VERIFICATION_STATUSES has exactly the 4 DB enum values", () => {
    expect(VERIFICATION_STATUSES).toEqual([
      "unverified",
      "possible_owner",
      "verified_owner",
      "wrong_contact",
    ]);
  });

  it("CONTACT_STATUSES has exactly the 6 DB enum values", () => {
    expect(CONTACT_STATUSES).toEqual([
      "not_contacted",
      "no_answer",
      "contacted",
      "follow_up",
      "wrong_number",
      "do_not_contact",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './status-labels'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/owners/status-labels.ts`:

```typescript
export type VerificationStatus =
  | "unverified"
  | "possible_owner"
  | "verified_owner"
  | "wrong_contact";

export type ContactStatus =
  | "not_contacted"
  | "no_answer"
  | "contacted"
  | "follow_up"
  | "wrong_number"
  | "do_not_contact";

export const VERIFICATION_STATUSES: VerificationStatus[] = [
  "unverified",
  "possible_owner",
  "verified_owner",
  "wrong_contact",
];

export const CONTACT_STATUSES: ContactStatus[] = [
  "not_contacted",
  "no_answer",
  "contacted",
  "follow_up",
  "wrong_number",
  "do_not_contact",
];

const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  unverified: "Unverified",
  possible_owner: "Possible Owner",
  verified_owner: "Verified Owner",
  wrong_contact: "Wrong Contact",
};

const CONTACT_LABELS: Record<ContactStatus, string> = {
  not_contacted: "Not Contacted",
  no_answer: "No Answer",
  contacted: "Contacted",
  follow_up: "Follow Up",
  wrong_number: "Wrong Number",
  do_not_contact: "Do Not Contact",
};

export function verificationStatusLabel(status: VerificationStatus): string {
  return VERIFICATION_LABELS[status];
}

export function contactStatusLabel(status: ContactStatus): string {
  return CONTACT_LABELS[status];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/owners/status-labels.ts src/lib/owners/status-labels.test.ts
git commit -m "feat: add owner status label helpers"
```

---

### Task 2: Area Admin assignment

**Files:**
- Modify: `src/app/(app)/admin/areas/[areaId]/actions.ts`
- Modify: `src/app/(app)/admin/areas/[areaId]/page.tsx`

**Interfaces:**
- Consumes: `getCurrentProfile()`, `createClient()` (both already imported in these files)
- Produces: `export async function assignAreaAdmin(formData: FormData): Promise<void>` (added alongside the existing `createSubArea`)

- [ ] **Step 1: Add the server action**

In `src/app/(app)/admin/areas/[areaId]/actions.ts`, the current full file is:

```typescript
"use server";

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";

export async function createSubArea(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor || actor.role !== "super_admin") {
    redirect("/");
  }

  const areaId = String(formData.get("areaId"));
  const name = String(formData.get("name"));
  const code = String(formData.get("code")).toUpperCase();
  const population = String(formData.get("population") ?? "");
  const consumerType = String(formData.get("consumerType") ?? "");
  const commercialProfile = String(formData.get("commercialProfile") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.from("sub_areas").insert({
    area_id: areaId,
    name,
    code,
    population: population || null,
    consumer_type: consumerType || null,
    commercial_profile: commercialProfile || null,
  });

  if (error) {
    let errorParam = "create_failed";
    if (error.code === "23505") {
      errorParam = error.message.includes("code") ? "duplicate_code" : "duplicate_name";
    }
    redirect(`/admin/areas/${areaId}?error=${errorParam}`);
  }

  redirect(`/admin/areas/${areaId}?created=1`);
}
```

Append this new function to the same file (keep `createSubArea` unchanged above it):

```typescript

export async function assignAreaAdmin(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor || actor.role !== "super_admin") {
    redirect("/");
  }

  const areaId = String(formData.get("areaId"));
  const profileId = String(formData.get("profileId"));

  const supabase = await createClient();
  const { error } = await supabase
    .from("area_admins")
    .insert({ area_id: areaId, profile_id: profileId });

  if (error) {
    const errorParam = error.code === "23505" ? "already_assigned" : "assign_failed";
    redirect(`/admin/areas/${areaId}?error=${errorParam}`);
  }

  redirect(`/admin/areas/${areaId}?assigned=1`);
}
```

- [ ] **Step 2: Update the page**

In `src/app/(app)/admin/areas/[areaId]/page.tsx`, the current full file is:

```tsx
import { redirect, notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { createSubArea } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  duplicate_code: "That sub-area code is already in use for this area.",
  duplicate_name: "That sub-area name is already in use for this area.",
  create_failed: "Could not create sub-area. Check the details and try again.",
};

export default async function AreaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ areaId: string }>;
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "super_admin") {
    redirect("/");
  }

  const { areaId } = await params;
  const { error, created } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  const supabase = await createClient();
  const { data: area } = await supabase
    .from("areas")
    .select("id, name, code")
    .eq("id", areaId)
    .single();

  if (!area) {
    notFound();
  }

  const { data: subAreas } = await supabase
    .from("sub_areas")
    .select("id, name, code, population, consumer_type")
    .eq("area_id", areaId)
    .order("name");

  return (
    <div className="space-y-6">
      <div>
        <a className="text-sm text-sky-600" href="/admin/areas">
          ← Areas
        </a>
        <h1 className="text-lg font-semibold text-slate-900">
          {area.name} ({area.code})
        </h1>
      </div>

      <form
        action={createSubArea}
        className="max-w-sm space-y-4 rounded-lg border border-sky-100 p-6 shadow-sm"
      >
        <input type="hidden" name="areaId" value={area.id} />
        <h2 className="font-medium text-slate-900">Create sub-area</h2>
        {created ? <p className="text-sm text-sky-700">Sub-area created.</p> : null}
        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            name="name"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="code">
            Code (short, e.g. DK)
          </label>
          <input
            id="code"
            name="code"
            required
            maxLength={10}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base uppercase focus:border-sky-500 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="population">
            Population
          </label>
          <input
            id="population"
            name="population"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="consumerType">
            Consumer type
          </label>
          <input
            id="consumerType"
            name="consumerType"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="commercialProfile">
            Commercial profile
          </label>
          <input
            id="commercialProfile"
            name="commercialProfile"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-sky-600 px-4 py-2 text-base font-medium text-white hover:bg-sky-700"
        >
          Create sub-area
        </button>
      </form>

      <table className="w-full max-w-2xl text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Code</th>
            <th className="py-2 pr-4">Population</th>
            <th className="py-2 pr-4">Consumer type</th>
          </tr>
        </thead>
        <tbody>
          {(subAreas ?? []).map((sa) => (
            <tr key={sa.id} className="border-b border-slate-100">
              <td className="py-2 pr-4 text-slate-900">{sa.name}</td>
              <td className="py-2 pr-4 text-sky-700">{sa.code}</td>
              <td className="py-2 pr-4 text-slate-600">{sa.population}</td>
              <td className="py-2 pr-4 text-slate-600">{sa.consumer_type}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

Replace the whole file with this (adds the `assigned`/`already_assigned` error cases, an assigned-admins list, an assign form, and a query for candidate admins — everything else is unchanged):

```tsx
import { redirect, notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { createSubArea, assignAreaAdmin } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  duplicate_code: "That sub-area code is already in use for this area.",
  duplicate_name: "That sub-area name is already in use for this area.",
  create_failed: "Could not create sub-area. Check the details and try again.",
  already_assigned: "That admin is already assigned to this area.",
  assign_failed: "Could not assign admin. Try again.",
};

export default async function AreaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ areaId: string }>;
  searchParams: Promise<{ error?: string; created?: string; assigned?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "super_admin") {
    redirect("/");
  }

  const { areaId } = await params;
  const { error, created, assigned } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  const supabase = await createClient();
  const { data: area } = await supabase
    .from("areas")
    .select("id, name, code")
    .eq("id", areaId)
    .single();

  if (!area) {
    notFound();
  }

  const { data: subAreas } = await supabase
    .from("sub_areas")
    .select("id, name, code, population, consumer_type")
    .eq("area_id", areaId)
    .order("name");

  const { data: assignedAdmins } = await supabase
    .from("area_admins")
    .select("profile_id, profiles(id, full_name)")
    .eq("area_id", areaId);

  const { data: candidateAdmins } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "area_admin")
    .order("full_name");

  return (
    <div className="space-y-6">
      <div>
        <a className="text-sm text-sky-600" href="/admin/areas">
          ← Areas
        </a>
        <h1 className="text-lg font-semibold text-slate-900">
          {area.name} ({area.code})
        </h1>
      </div>

      <form
        action={createSubArea}
        className="max-w-sm space-y-4 rounded-lg border border-sky-100 p-6 shadow-sm"
      >
        <input type="hidden" name="areaId" value={area.id} />
        <h2 className="font-medium text-slate-900">Create sub-area</h2>
        {created ? <p className="text-sm text-sky-700">Sub-area created.</p> : null}
        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            name="name"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="code">
            Code (short, e.g. DK)
          </label>
          <input
            id="code"
            name="code"
            required
            maxLength={10}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base uppercase focus:border-sky-500 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="population">
            Population
          </label>
          <input
            id="population"
            name="population"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="consumerType">
            Consumer type
          </label>
          <input
            id="consumerType"
            name="consumerType"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="commercialProfile">
            Commercial profile
          </label>
          <input
            id="commercialProfile"
            name="commercialProfile"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-sky-600 px-4 py-2 text-base font-medium text-white hover:bg-sky-700"
        >
          Create sub-area
        </button>
      </form>

      <table className="w-full max-w-2xl text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Code</th>
            <th className="py-2 pr-4">Population</th>
            <th className="py-2 pr-4">Consumer type</th>
          </tr>
        </thead>
        <tbody>
          {(subAreas ?? []).map((sa) => (
            <tr key={sa.id} className="border-b border-slate-100">
              <td className="py-2 pr-4 text-slate-900">{sa.name}</td>
              <td className="py-2 pr-4 text-sky-700">{sa.code}</td>
              <td className="py-2 pr-4 text-slate-600">{sa.population}</td>
              <td className="py-2 pr-4 text-slate-600">{sa.consumer_type}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="space-y-4">
        <h2 className="font-medium text-slate-900">Assigned admins</h2>
        {assigned ? <p className="text-sm text-sky-700">Admin assigned.</p> : null}
        <ul className="max-w-sm space-y-1 text-sm">
          {(assignedAdmins ?? []).length === 0 ? (
            <li className="text-slate-500">No admins assigned yet.</li>
          ) : (
            assignedAdmins!.map((aa) => (
              // @ts-expect-error -- Supabase nested select typing
              <li key={aa.profile_id} className="text-slate-900">
                {/* @ts-expect-error -- Supabase nested select typing */}
                {aa.profiles?.full_name}
              </li>
            ))
          )}
        </ul>

        <form
          action={assignAreaAdmin}
          className="max-w-sm space-y-4 rounded-lg border border-sky-100 p-6 shadow-sm"
        >
          <input type="hidden" name="areaId" value={area.id} />
          <div className="space-y-1">
            <label className="text-sm text-slate-700" htmlFor="profileId">
              Assign area admin
            </label>
            <select
              id="profileId"
              name="profileId"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
            >
              <option value="">Select an admin</option>
              {(candidateAdmins ?? []).map((admin) => (
                <option key={admin.id} value={admin.id}>
                  {admin.full_name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-sky-600 px-4 py-2 text-base font-medium text-white hover:bg-sky-700"
          >
            Assign
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit` — no new errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/admin/areas/[areaId]/actions.ts" "src/app/(app)/admin/areas/[areaId]/page.tsx"
git commit -m "feat: add area admin assignment"
```

---

### Task 3: Add Owner to a Unit

**Files:**
- Modify: `src/app/(app)/units/[unitId]/actions.ts`

**Interfaces:**
- Consumes: `getCurrentProfile()`, `createClient()` (already imported in this file)
- Produces: `export async function createOwnerForUnit(formData: FormData): Promise<void>` (added alongside the existing `createUnitSpace`)

- [ ] **Step 1: Add the server action**

The current file `src/app/(app)/units/[unitId]/actions.ts` is:

```typescript
"use server";

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";

export async function createUnitSpace(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor || (actor.role !== "super_admin" && actor.role !== "area_admin")) {
    redirect("/");
  }

  const unitId = String(formData.get("unitId"));
  const floorType = String(formData.get("floorType"));
  const floorLabel = String(formData.get("floorLabel"));
  const sizeRaw = String(formData.get("size") ?? "");
  const sizeType = String(formData.get("sizeType") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.from("unit_spaces").insert({
    unit_id: unitId,
    floor_type: floorType,
    floor_label: floorLabel,
    size: sizeRaw ? Number(sizeRaw) : null,
    size_type: sizeType || null,
  });

  if (error) {
    redirect(`/units/${unitId}?error=space_create_failed`);
  }

  redirect(`/units/${unitId}?space_created=1`);
}
```

Append this new function to the same file (keep `createUnitSpace` unchanged above it):

```typescript

export async function createOwnerForUnit(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor || (actor.role !== "super_admin" && actor.role !== "area_admin")) {
    redirect("/");
  }

  const unitId = String(formData.get("unitId"));
  const spaceId = String(formData.get("spaceId") ?? "");
  const name = String(formData.get("name"));
  const primaryContact = String(formData.get("primaryContact") ?? "");
  const otherContact = String(formData.get("otherContact") ?? "");
  const icOrCompanyNo = String(formData.get("icOrCompanyNo") ?? "");
  const ownerType = String(formData.get("ownerType") ?? "");
  const remarks = String(formData.get("remarks") ?? "");

  const supabase = await createClient();
  const { data: owner, error: ownerError } = await supabase
    .from("owners")
    .insert({
      name,
      primary_contact: primaryContact || null,
      other_contact: otherContact || null,
      ic_or_company_no: icOrCompanyNo || null,
      owner_type: ownerType || null,
      remarks: remarks || null,
      created_by: actor.id,
    })
    .select("id")
    .single();

  if (ownerError || !owner) {
    redirect(`/units/${unitId}?error=owner_create_failed`);
  }

  const { error: ownershipError } = await supabase.from("unit_ownerships").insert({
    unit_id: unitId,
    space_id: spaceId || null,
    owner_id: owner!.id,
  });

  if (ownershipError) {
    redirect(`/units/${unitId}?error=ownership_link_failed`);
  }

  redirect(`/units/${unitId}?owner_added=1`);
}
```

Note: `owner!.id` uses a non-null assertion because `redirect()` in the branch above is typed to never return (it throws), so by this point TypeScript should narrow `owner` to non-null — if `tsc` still complains, keep the `!` as written above; it's safe given the control flow.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit` — no new errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/units/[unitId]/actions.ts"
git commit -m "feat: add create-owner-for-unit action"
```

---

### Task 4: Show Owners on the Unit detail page

**Files:**
- Modify: `src/app/(app)/units/[unitId]/page.tsx`

**Interfaces:**
- Consumes: `createOwnerForUnit` from `./actions` (Task 3), `verificationStatusLabel`, `contactStatusLabel` from `@/lib/owners/status-labels` (Task 1)

- [ ] **Step 1: Update the page**

The current file `src/app/(app)/units/[unitId]/page.tsx` is:

```tsx
import { redirect, notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { canSeeAllAreas, getAdminAreaIds } from "@/lib/auth/get-admin-area-ids";
import { createUnitSpace } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  space_create_failed: "Could not add space. Check the details and try again.",
};

const FLOOR_TYPES = ["Ground", "Mezzanine", "1st", "2nd", "3rd", "Upper Floor", "Whole Building", "Custom"];

export default async function UnitDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ unitId: string }>;
  searchParams: Promise<{ error?: string; space_created?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  const { unitId } = await params;
  const { error, space_created } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  const supabase = await createClient();
  const { data: unit } = await supabase
    .from("units")
    .select(
      "id, unit_code, jalan, unit_no, full_address, facing, property_type, land_type, tenure, tenure_years, unit_size, unit_size_type, remarks, status, sub_areas(name, area_id, areas(name))",
    )
    .eq("id", unitId)
    .single();

  if (!unit) {
    notFound();
  }

  const canManage =
    canSeeAllAreas(profile.role) ||
    (profile.role === "area_admin" &&
      // @ts-expect-error -- Supabase nested select typing
      (await getAdminAreaIds(profile.id)).includes(unit.sub_areas?.area_id));

  const { data: spaces } = await supabase
    .from("unit_spaces")
    .select("id, floor_type, floor_label, size, size_type, status")
    .eq("unit_id", unitId)
    .order("floor_label");

  return (
    <div className="space-y-6">
      <a className="text-sm text-sky-600" href="/units">
        ← Units
      </a>

      <div>
        <h1 className="text-lg font-semibold text-slate-900">{unit.unit_code}</h1>
        <p className="text-slate-600">
          {unit.jalan} {unit.unit_no}, {unit.full_address}
        </p>
        <p className="text-sm text-slate-600">
          {/* @ts-expect-error -- Supabase nested select typing */}
          {unit.sub_areas?.areas?.name} / {unit.sub_areas?.name}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm max-w-md">
        <dt className="text-slate-500">Facing</dt>
        <dd className="text-slate-900">{unit.facing ?? "—"}</dd>
        <dt className="text-slate-500">Property type</dt>
        <dd className="text-slate-900">{unit.property_type ?? "—"}</dd>
        <dt className="text-slate-500">Land type</dt>
        <dd className="text-slate-900">{unit.land_type ?? "—"}</dd>
        <dt className="text-slate-500">Tenure</dt>
        <dd className="text-slate-900">
          {unit.tenure ?? "—"}
          {unit.tenure_years ? ` (${unit.tenure_years} years)` : ""}
        </dd>
        <dt className="text-slate-500">Size</dt>
        <dd className="text-slate-900">
          {unit.unit_size ? `${unit.unit_size} ${unit.unit_size_type ?? ""}` : "—"}
        </dd>
        <dt className="text-slate-500">Remarks</dt>
        <dd className="text-slate-900">{unit.remarks ?? "—"}</dd>
      </dl>

      <table className="w-full max-w-2xl text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-2 pr-4">Floor</th>
            <th className="py-2 pr-4">Size</th>
            <th className="py-2 pr-4">Status</th>
          </tr>
        </thead>
        <tbody>
          {(spaces ?? []).map((s) => (
            <tr key={s.id} className="border-b border-slate-100">
              <td className="py-2 pr-4 text-slate-900">{s.floor_label}</td>
              <td className="py-2 pr-4 text-slate-600">
                {s.size ? `${s.size} ${s.size_type ?? ""}` : "—"}
              </td>
              <td className="py-2 pr-4 text-slate-600">{s.status}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {canManage ? (
        <form
          action={createUnitSpace}
          className="max-w-sm space-y-4 rounded-lg border border-sky-100 p-6 shadow-sm"
        >
          <input type="hidden" name="unitId" value={unit.id} />
          <h2 className="font-medium text-slate-900">Add space</h2>
          {space_created ? <p className="text-sm text-sky-700">Space added.</p> : null}
          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
          <div className="space-y-1">
            <label className="text-sm text-slate-700" htmlFor="floorType">
              Floor type
            </label>
            <select
              id="floorType"
              name="floorType"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
            >
              {FLOOR_TYPES.map((ft) => (
                <option key={ft} value={ft}>
                  {ft}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-700" htmlFor="floorLabel">
              Floor label (e.g. 45-G)
            </label>
            <input
              id="floorLabel"
              name="floorLabel"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-700" htmlFor="size">
              Size
            </label>
            <input
              id="size"
              name="size"
              type="number"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-700" htmlFor="sizeType">
              Size type (e.g. sqft)
            </label>
            <input
              id="sizeType"
              name="sizeType"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-sky-600 px-4 py-2 text-base font-medium text-white hover:bg-sky-700"
          >
            Add space
          </button>
        </form>
      ) : null}
    </div>
  );
}
```

Replace the whole file with this (adds `createOwnerForUnit`/label imports, new error messages, an owners section gated by `canManage`, and the add-owner form — the unit header/details/spaces sections above it are unchanged):

```tsx
import { redirect, notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { canSeeAllAreas, getAdminAreaIds } from "@/lib/auth/get-admin-area-ids";
import { verificationStatusLabel, contactStatusLabel } from "@/lib/owners/status-labels";
import { createUnitSpace, createOwnerForUnit } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  space_create_failed: "Could not add space. Check the details and try again.",
  owner_create_failed: "Could not create owner. Check the details and try again.",
  ownership_link_failed: "Owner was created but could not be linked to this unit.",
};

const FLOOR_TYPES = ["Ground", "Mezzanine", "1st", "2nd", "3rd", "Upper Floor", "Whole Building", "Custom"];

export default async function UnitDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ unitId: string }>;
  searchParams: Promise<{ error?: string; space_created?: string; owner_added?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  const { unitId } = await params;
  const { error, space_created, owner_added } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  const supabase = await createClient();
  const { data: unit } = await supabase
    .from("units")
    .select(
      "id, unit_code, jalan, unit_no, full_address, facing, property_type, land_type, tenure, tenure_years, unit_size, unit_size_type, remarks, status, sub_areas(name, area_id, areas(name))",
    )
    .eq("id", unitId)
    .single();

  if (!unit) {
    notFound();
  }

  const canManage =
    canSeeAllAreas(profile.role) ||
    (profile.role === "area_admin" &&
      // @ts-expect-error -- Supabase nested select typing
      (await getAdminAreaIds(profile.id)).includes(unit.sub_areas?.area_id));

  const { data: spaces } = await supabase
    .from("unit_spaces")
    .select("id, floor_type, floor_label, size, size_type, status")
    .eq("unit_id", unitId)
    .order("floor_label");

  const ownerships = canManage
    ? (
        await supabase
          .from("unit_ownerships")
          .select(
            "id, space_id, is_primary, owners(id, name, primary_contact, verification_status, contact_status)",
          )
          .eq("unit_id", unitId)
      ).data
    : null;

  return (
    <div className="space-y-6">
      <a className="text-sm text-sky-600" href="/units">
        ← Units
      </a>

      <div>
        <h1 className="text-lg font-semibold text-slate-900">{unit.unit_code}</h1>
        <p className="text-slate-600">
          {unit.jalan} {unit.unit_no}, {unit.full_address}
        </p>
        <p className="text-sm text-slate-600">
          {/* @ts-expect-error -- Supabase nested select typing */}
          {unit.sub_areas?.areas?.name} / {unit.sub_areas?.name}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm max-w-md">
        <dt className="text-slate-500">Facing</dt>
        <dd className="text-slate-900">{unit.facing ?? "—"}</dd>
        <dt className="text-slate-500">Property type</dt>
        <dd className="text-slate-900">{unit.property_type ?? "—"}</dd>
        <dt className="text-slate-500">Land type</dt>
        <dd className="text-slate-900">{unit.land_type ?? "—"}</dd>
        <dt className="text-slate-500">Tenure</dt>
        <dd className="text-slate-900">
          {unit.tenure ?? "—"}
          {unit.tenure_years ? ` (${unit.tenure_years} years)` : ""}
        </dd>
        <dt className="text-slate-500">Size</dt>
        <dd className="text-slate-900">
          {unit.unit_size ? `${unit.unit_size} ${unit.unit_size_type ?? ""}` : "—"}
        </dd>
        <dt className="text-slate-500">Remarks</dt>
        <dd className="text-slate-900">{unit.remarks ?? "—"}</dd>
      </dl>

      <table className="w-full max-w-2xl text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-2 pr-4">Floor</th>
            <th className="py-2 pr-4">Size</th>
            <th className="py-2 pr-4">Status</th>
          </tr>
        </thead>
        <tbody>
          {(spaces ?? []).map((s) => (
            <tr key={s.id} className="border-b border-slate-100">
              <td className="py-2 pr-4 text-slate-900">{s.floor_label}</td>
              <td className="py-2 pr-4 text-slate-600">
                {s.size ? `${s.size} ${s.size_type ?? ""}` : "—"}
              </td>
              <td className="py-2 pr-4 text-slate-600">{s.status}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {canManage ? (
        <form
          action={createUnitSpace}
          className="max-w-sm space-y-4 rounded-lg border border-sky-100 p-6 shadow-sm"
        >
          <input type="hidden" name="unitId" value={unit.id} />
          <h2 className="font-medium text-slate-900">Add space</h2>
          {space_created ? <p className="text-sm text-sky-700">Space added.</p> : null}
          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
          <div className="space-y-1">
            <label className="text-sm text-slate-700" htmlFor="floorType">
              Floor type
            </label>
            <select
              id="floorType"
              name="floorType"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
            >
              {FLOOR_TYPES.map((ft) => (
                <option key={ft} value={ft}>
                  {ft}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-700" htmlFor="floorLabel">
              Floor label (e.g. 45-G)
            </label>
            <input
              id="floorLabel"
              name="floorLabel"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-700" htmlFor="size">
              Size
            </label>
            <input
              id="size"
              name="size"
              type="number"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-700" htmlFor="sizeType">
              Size type (e.g. sqft)
            </label>
            <input
              id="sizeType"
              name="sizeType"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-sky-600 px-4 py-2 text-base font-medium text-white hover:bg-sky-700"
          >
            Add space
          </button>
        </form>
      ) : null}

      {canManage ? (
        <div className="space-y-4">
          <h2 className="font-medium text-slate-900">Owners</h2>
          {owner_added ? <p className="text-sm text-sky-700">Owner added.</p> : null}

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
              {(ownerships ?? []).map((o) => (
                // @ts-expect-error -- Supabase nested select typing
                <tr key={o.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 text-sky-700">
                    {/* @ts-expect-error -- Supabase nested select typing */}
                    <a href={`/owners/${o.owners?.id}`}>{o.owners?.name}</a>
                  </td>
                  {/* @ts-expect-error -- Supabase nested select typing */}
                  <td className="py-2 pr-4 text-slate-600">{o.owners?.primary_contact ?? "—"}</td>
                  <td className="py-2 pr-4 text-slate-600">
                    {/* @ts-expect-error -- Supabase nested select typing */}
                    {verificationStatusLabel(o.owners?.verification_status)}
                  </td>
                  <td className="py-2 pr-4 text-slate-600">
                    {/* @ts-expect-error -- Supabase nested select typing */}
                    {contactStatusLabel(o.owners?.contact_status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <form
            action={createOwnerForUnit}
            className="max-w-sm space-y-4 rounded-lg border border-sky-100 p-6 shadow-sm"
          >
            <input type="hidden" name="unitId" value={unit.id} />
            <h3 className="font-medium text-slate-900">Add owner</h3>
            <div className="space-y-1">
              <label className="text-sm text-slate-700" htmlFor="spaceId">
                Space (leave blank for whole unit)
              </label>
              <select
                id="spaceId"
                name="spaceId"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
              >
                <option value="">Whole unit</option>
                {(spaces ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.floor_label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-700" htmlFor="name">
                Name
              </label>
              <input
                id="name"
                name="name"
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-700" htmlFor="primaryContact">
                Primary contact
              </label>
              <input
                id="primaryContact"
                name="primaryContact"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-700" htmlFor="otherContact">
                Other contact
              </label>
              <input
                id="otherContact"
                name="otherContact"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-700" htmlFor="icOrCompanyNo">
                IC / Company No
              </label>
              <input
                id="icOrCompanyNo"
                name="icOrCompanyNo"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-700" htmlFor="ownerType">
                Owner type
              </label>
              <input
                id="ownerType"
                name="ownerType"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-700" htmlFor="remarks">
                Remarks
              </label>
              <textarea
                id="remarks"
                name="remarks"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-sky-600 px-4 py-2 text-base font-medium text-white hover:bg-sky-700"
            >
              Add owner
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit` — no new errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/units/[unitId]/page.tsx"
git commit -m "feat: show owners on unit detail page"
```

---

### Task 5: Owners list page

**Files:**
- Create: `src/app/(app)/owners/page.tsx`

**Interfaces:**
- Consumes: `getCurrentProfile()`, `createClient()`, `verificationStatusLabel`, `contactStatusLabel` from Task 1

- [ ] **Step 1: Create the page**

Create `src/app/(app)/owners/page.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify it compiles and the auth redirect works**

Run: `npx tsc --noEmit` — no new errors.
Run: `npm run dev` in the background, `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/owners` — expect `307`. Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/owners/page.tsx"
git commit -m "feat: add owners list page"
```

---

### Task 6: Owner detail + edit

**Files:**
- Create: `src/app/(app)/owners/[ownerId]/actions.ts`
- Create: `src/app/(app)/owners/[ownerId]/page.tsx`

**Interfaces:**
- Consumes: `getCurrentProfile()`, `createClient()`, `VERIFICATION_STATUSES`, `CONTACT_STATUSES`, `verificationStatusLabel`, `contactStatusLabel` from Task 1
- Produces: `export async function updateOwner(formData: FormData): Promise<void>`

- [ ] **Step 1: Create the server action**

Create `src/app/(app)/owners/[ownerId]/actions.ts`:

```typescript
"use server";

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";

export async function updateOwner(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor || (actor.role !== "super_admin" && actor.role !== "area_admin")) {
    redirect("/");
  }

  const ownerId = String(formData.get("ownerId"));
  const verificationStatus = String(formData.get("verificationStatus"));
  const contactStatus = String(formData.get("contactStatus"));
  const remarks = String(formData.get("remarks") ?? "");

  const update: Record<string, unknown> = {
    verification_status: verificationStatus,
    contact_status: contactStatus,
    remarks: remarks || null,
  };

  if (verificationStatus === "verified_owner") {
    update.last_verified_date = new Date().toISOString().slice(0, 10);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("owners").update(update).eq("id", ownerId);

  if (error) {
    redirect(`/owners/${ownerId}?error=update_failed`);
  }

  redirect(`/owners/${ownerId}?updated=1`);
}
```

- [ ] **Step 2: Create the page**

Create `src/app/(app)/owners/[ownerId]/page.tsx`:

```tsx
import { redirect, notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import {
  VERIFICATION_STATUSES,
  CONTACT_STATUSES,
  verificationStatusLabel,
  contactStatusLabel,
} from "@/lib/owners/status-labels";
import { updateOwner } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  update_failed: "Could not update owner. Try again.",
};

export default async function OwnerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ ownerId: string }>;
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "area_admin")) {
    redirect("/");
  }

  const { ownerId } = await params;
  const { error, updated } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  const supabase = await createClient();
  const { data: owner } = await supabase
    .from("owners")
    .select(
      "id, name, primary_contact, other_contact, ic_or_company_no, owner_type, verification_status, contact_status, remarks, last_verified_date",
    )
    .eq("id", ownerId)
    .single();

  if (!owner) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <a className="text-sm text-sky-600" href="/owners">
        ← Owners
      </a>

      <div>
        <h1 className="text-lg font-semibold text-slate-900">{owner.name}</h1>
        <p className="text-slate-600">{owner.primary_contact ?? "No primary contact"}</p>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm max-w-md">
        <dt className="text-slate-500">Other contact</dt>
        <dd className="text-slate-900">{owner.other_contact ?? "—"}</dd>
        <dt className="text-slate-500">IC / Company No</dt>
        <dd className="text-slate-900">{owner.ic_or_company_no ?? "—"}</dd>
        <dt className="text-slate-500">Owner type</dt>
        <dd className="text-slate-900">{owner.owner_type ?? "—"}</dd>
        <dt className="text-slate-500">Last verified</dt>
        <dd className="text-slate-900">{owner.last_verified_date ?? "—"}</dd>
      </dl>

      <form
        action={updateOwner}
        className="max-w-sm space-y-4 rounded-lg border border-sky-100 p-6 shadow-sm"
      >
        <input type="hidden" name="ownerId" value={owner.id} />
        <h2 className="font-medium text-slate-900">Update status</h2>
        {updated ? <p className="text-sm text-sky-700">Owner updated.</p> : null}
        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="verificationStatus">
            Verification status
          </label>
          <select
            id="verificationStatus"
            name="verificationStatus"
            defaultValue={owner.verification_status}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          >
            {VERIFICATION_STATUSES.map((vs) => (
              <option key={vs} value={vs}>
                {verificationStatusLabel(vs)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="contactStatus">
            Contact status
          </label>
          <select
            id="contactStatus"
            name="contactStatus"
            defaultValue={owner.contact_status}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          >
            {CONTACT_STATUSES.map((cs) => (
              <option key={cs} value={cs}>
                {contactStatusLabel(cs)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="remarks">
            Remarks
          </label>
          <textarea
            id="remarks"
            name="remarks"
            defaultValue={owner.remarks ?? ""}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-sky-600 px-4 py-2 text-base font-medium text-white hover:bg-sky-700"
        >
          Save
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit` — no new errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/owners/[ownerId]/actions.ts" "src/app/(app)/owners/[ownerId]/page.tsx"
git commit -m "feat: add owner detail and status update"
```

---

### Task 7: Nav link from home page

**Files:**
- Modify: `src/app/(app)/page.tsx`

**Interfaces:**
- Consumes: `profile.role` (already available in this file)

- [ ] **Step 1: Add the Owners link**

The current file `src/app/(app)/page.tsx` is:

```tsx
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

export default async function HomePage() {
  const profile = await getCurrentProfile();

  return (
    <div className="space-y-2">
      <h1 className="text-lg font-semibold text-slate-900">Welcome to Bizlocate</h1>
      <p className="text-slate-600">
        Signed in successfully. Feature pages (Owners, Listings) land in later
        plans.
      </p>
      <div className="flex flex-col gap-1">
        {profile?.role === "area_admin" || profile?.role === "super_admin" ? (
          <a href="/units" className="text-sky-600">
            Units →
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
```

Replace the whole file with this (adds an "Owners" link for admin roles, updates the intro sentence since Owners no longer "lands in later plans"):

```tsx
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
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` — no new errors.
Run: `npm test` — still passing (Task 1 added 3 more tests).

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/page.tsx"
git commit -m "feat: link owners page from home"
```

---

## Manual Verification (controller-driven, after all tasks land)

1. As `super_admin`, go to `/admin/areas/<setapak-id>` → assign the existing `area_admin`-role test user (`testsp@bizlocate.com.my` is `sp`, not usable here — create or promote a dedicated `area_admin` test user first via `/admin/users` if one doesn't already exist) → confirm they appear under "Assigned admins", and confirm submitting the same assignment again shows "already assigned" rather than a generic failure.
2. Go to the `SET-DK-000001` unit detail page → "Add owner" → fill name + contact, leave Space as "Whole unit" → submit → confirm the owner appears in the Owners table on that page with default status "Unverified" / "Not Contacted".
3. Click into the owner → change Verification status to "Verified Owner" → Save → confirm the page shows an updated "Last verified" date (today) and the status persists on reload.
4. Go to `/owners` → confirm the owner appears in the list with the updated status.
5. Log in as the `area_admin` now assigned to Setapak → confirm they can reach `/owners` and see the same owner (RLS scoping via their unit); confirm a *different*, unassigned `area_admin` (or the same one before assignment) cannot see it.

## Self-Review Notes

- **Spec coverage:** Area Master admin assignment gap from the previous plan (closed here), Owner Database (spec §6) including the exact verification/contact status enums, Unit Ownership linking a unit or a specific space to an owner (spec §6 — "different owners for different floors"). Owner Search Queue automation (the design spec's Workflow section) and the SP-facing "Request Owner Contact" flow (spec §13-14) are explicitly separate later plans — this plan is the admin-direct Owner CRUD foundation only, same scoping pattern as the previous Units plan being admin-direct Unit CRUD.
- **Placeholder scan:** none found.
- **Type consistency:** `VerificationStatus`/`ContactStatus` types and the `VERIFICATION_STATUSES`/`CONTACT_STATUSES` arrays from Task 1 are consumed with matching literal values in Task 6's `<select>` options. `createOwnerForUnit`'s field names (`spaceId`, `primaryContact`, `otherContact`, `icOrCompanyNo`, `ownerType`) match what Task 4's form submits.
