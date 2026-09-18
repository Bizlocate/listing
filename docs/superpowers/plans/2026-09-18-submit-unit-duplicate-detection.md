# Submit Unit & Duplicate Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Any authenticated user (primarily Salesperson) can submit a discovered unit from a mobile-friendly form; the system flags likely duplicates against existing Units; Super Admin/Area Admin review pending submissions in a queue and either link a submission to an existing Unit or convert it into a new permanent Unit — which automatically creates an Owner Search task.

**Architecture:** Same pattern as every prior plan — Server Components read via RLS-gated Supabase queries, Server Actions handle writes with a UX-level role check backstopped by already-deployed RLS. Duplicate matching is a pure, tested function reused by both the submitter's informational badge and the admin's review page — no fuzzy-matching library, just normalized string comparison, matching this codebase's existing "simplest thing that works" bar (see `src/lib/auth/get-admin-area-ids.ts`, `src/lib/listings/status-labels.ts` for the established pure-helper pattern). No new migrations: `unit_submissions` and `owner_search_tasks` already exist from `0001_phase1_schema.sql` with RLS that already matches this plan's access rules exactly.

**Tech Stack:** Next.js Server Components/Actions, Supabase (`@supabase/ssr`), Tailwind, the shared `Badge` component, browser Geolocation API (progressive enhancement, best-effort — spec's "GPS if available").

## Important Context: This Plan Also Gives `sp` Its First Nav Entry

Every page built in the three prior plans (Areas/Units, Owners, Listings) is gated to `super_admin`/`area_admin` only, and `src/components/app-shell.tsx`'s sidebar has no nav section at all for a plain `sp` user — only "Dashboard". `unit_submissions` INSERT is the one place in the whole schema where RLS already allows any authenticated role (`unit_submissions_insert_self`, `with check (submitted_by = auth.uid())`, no role restriction) — this plan is the first real `sp` feature, and Task 5 adds the first nav entry visible to every role.

## Schema This Plan Assumes (already deployed — do not re-create)

- `unit_submissions(id uuid, submitted_by uuid not null, area_id uuid, sub_area_id uuid, jalan text, unit_no text, address text not null, lat double precision, lng double precision, discovery_type text not null check in ('vacant','banner','target_unit','other'), banner_phone text, remarks text, photo_url text, status text not null default 'pending' check in ('pending','linked','converted'), matched_unit_id uuid, created_at)`. RLS: INSERT by any authenticated user for their own row (`submitted_by = auth.uid()`); SELECT — own rows, or `super_admin`, or `area_admin` whose assigned area matches `area_id`; UPDATE — `super_admin` or that same `area_admin` scope (submitters cannot update their own submission once created).
- `owner_search_tasks(id uuid, unit_id uuid not null, space_id uuid, status text not null default 'need_search' check in (...), assigned_to uuid, found_contact text, remarks text, created_at, updated_at)`. RLS: admin-only (`super_admin` or the `area_admin` of the unit's area), matching every other admin-write table in this schema.
- `units`/`sub_areas`/`areas` — as established in the Areas/Units plan, including the `unit_code` auto-generation trigger (never insert `unit_code` yourself).
- `profiles` RLS only allows reading your own row or (if you're `super_admin`) any row — an `area_admin` cannot read another user's `profiles` row. This plan's admin queue therefore does **not** show who submitted each entry (see Global Constraints).

## Global Constraints

- Duplicate detection matches within the same sub-area, using exact-normalized `jalan`+`unit_no` OR a substring-overlap on `address` (spec §8) — implemented once as a pure function, reused by the submitter's own-submissions badge and the admin review page.
- "Never automatically merge records without Admin confirmation" (spec §8) — a submission is never auto-linked or auto-converted; only an explicit admin action (a button click on the review page) changes its status.
- "Then automatically create task in Owner Search Queue" (spec §7) — converting a submission into a new Unit must, in the same action, insert an `owner_search_tasks` row for that unit (status defaults to `need_search`, no need to set it explicitly).
- `unit_code` is never supplied by the app when creating a Unit (established convention) — the DB trigger fills it.
- **Deliberate Phase-1 simplification:** the admin review queue does not display who submitted each entry — showing it would require a broader RLS grant letting an `area_admin` read other users' `profiles` rows, which is out of scope for this plan. The submission's own property details (address, jalan, unit no, discovery type, remarks) are sufficient for the link/create decision. Note this for a future plan if the "who submitted" detail becomes needed.
- Light theme, white background, sky-blue accents, `Badge` component — match established conventions from every prior plan's pages.

---

## File Structure

- `src/lib/units/duplicate-detection.ts` — pure duplicate-matching function.
- `src/components/geolocation-fields.tsx` — tiny client component: hidden `lat`/`lng` inputs filled via `navigator.geolocation`, best-effort.
- `src/app/(app)/submit-unit/actions.ts` — new: `createUnitSubmission(formData)`.
- `src/app/(app)/submit-unit/page.tsx` — new: mobile-friendly submit form + "My submissions" list with a duplicate-warning badge.
- `src/app/(app)/unit-submissions/page.tsx` — new: admin review queue (pending submissions).
- `src/app/(app)/unit-submissions/[submissionId]/actions.ts` — new: `linkSubmissionToUnit(formData)`, `createUnitFromSubmission(formData)`.
- `src/app/(app)/unit-submissions/[submissionId]/page.tsx` — new: submission detail, duplicate candidates, link/create forms.
- `src/components/app-shell.tsx` — modify: add a "Submit Unit" link visible to every role, and "Unit submissions" to the admin nav.

---

### Task 1: Duplicate detection matching function

**Files:**
- Create: `src/lib/units/duplicate-detection.ts`
- Test: `src/lib/units/duplicate-detection.test.ts`

**Interfaces:**
- Produces: `export interface DuplicateCandidateInput { subAreaId: string; jalan: string; unitNo: string; address: string }`
- Produces: `export interface ExistingUnitForMatch { id: string; unitCode: string; subAreaId: string; jalan: string | null; unitNo: string | null; fullAddress: string }`
- Produces: `export function findDuplicateCandidates(target: DuplicateCandidateInput, existingUnits: ExistingUnitForMatch[]): ExistingUnitForMatch[]`

- [ ] **Step 1: Write the failing test**

Create `src/lib/units/duplicate-detection.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { findDuplicateCandidates, type ExistingUnitForMatch } from "./duplicate-detection";

const SUB_AREA_A = "sub-area-a";
const SUB_AREA_B = "sub-area-b";

function unit(overrides: Partial<ExistingUnitForMatch>): ExistingUnitForMatch {
  return {
    id: "unit-1",
    unitCode: "SET-DK-000001",
    subAreaId: SUB_AREA_A,
    jalan: "Jalan Genting Klang",
    unitNo: "45",
    fullAddress: "45 Jalan Genting Klang, Setapak",
    ...overrides,
  };
}

describe("findDuplicateCandidates", () => {
  it("matches when sub-area, jalan, and unit no are all the same (case/whitespace-insensitive)", () => {
    const result = findDuplicateCandidates(
      { subAreaId: SUB_AREA_A, jalan: "  JALAN Genting Klang ", unitNo: "45", address: "somewhere else" },
      [unit({})],
    );
    expect(result).toHaveLength(1);
  });

  it("matches when the submitted address overlaps an existing unit's full address", () => {
    const result = findDuplicateCandidates(
      { subAreaId: SUB_AREA_A, jalan: "", unitNo: "", address: "45 Jalan Genting Klang" },
      [unit({})],
    );
    expect(result).toHaveLength(1);
  });

  it("does not match across different sub-areas even with identical jalan/unit no", () => {
    const result = findDuplicateCandidates(
      { subAreaId: SUB_AREA_B, jalan: "Jalan Genting Klang", unitNo: "45", address: "unrelated" },
      [unit({ subAreaId: SUB_AREA_A })],
    );
    expect(result).toHaveLength(0);
  });

  it("does not match when nothing overlaps", () => {
    const result = findDuplicateCandidates(
      { subAreaId: SUB_AREA_A, jalan: "Jalan Lain", unitNo: "99", address: "completely different place" },
      [unit({})],
    );
    expect(result).toHaveLength(0);
  });

  it("returns an empty array when there are no existing units", () => {
    const result = findDuplicateCandidates(
      { subAreaId: SUB_AREA_A, jalan: "Jalan Genting Klang", unitNo: "45", address: "45 Jalan Genting Klang" },
      [],
    );
    expect(result).toEqual([]);
  });

  it("does not match on jalan alone without a matching unit no", () => {
    const result = findDuplicateCandidates(
      { subAreaId: SUB_AREA_A, jalan: "Jalan Genting Klang", unitNo: "99", address: "somewhere unrelated entirely" },
      [unit({})],
    );
    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './duplicate-detection'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/units/duplicate-detection.ts`:

```typescript
export interface DuplicateCandidateInput {
  subAreaId: string;
  jalan: string;
  unitNo: string;
  address: string;
}

export interface ExistingUnitForMatch {
  id: string;
  unitCode: string;
  subAreaId: string;
  jalan: string | null;
  unitNo: string | null;
  fullAddress: string;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function findDuplicateCandidates(
  target: DuplicateCandidateInput,
  existingUnits: ExistingUnitForMatch[],
): ExistingUnitForMatch[] {
  const targetJalan = normalize(target.jalan);
  const targetUnitNo = normalize(target.unitNo);
  const targetAddress = normalize(target.address);

  return existingUnits.filter((unit) => {
    if (unit.subAreaId !== target.subAreaId) return false;

    const unitJalan = normalize(unit.jalan ?? "");
    const unitUnitNo = normalize(unit.unitNo ?? "");
    const unitAddress = normalize(unit.fullAddress);

    const jalanAndUnitNoMatch =
      targetJalan.length > 0 &&
      targetUnitNo.length > 0 &&
      unitJalan === targetJalan &&
      unitUnitNo === targetUnitNo;

    const addressOverlaps =
      targetAddress.length > 0 &&
      unitAddress.length > 0 &&
      (unitAddress.includes(targetAddress) || targetAddress.includes(unitAddress));

    return jalanAndUnitNoMatch || addressOverlaps;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/units/duplicate-detection.ts src/lib/units/duplicate-detection.test.ts
git commit -m "feat: add duplicate unit detection matching"
```

---

### Task 2: Geolocation helper component

**Files:**
- Create: `src/components/geolocation-fields.tsx`

**Interfaces:**
- Produces: `export function GeolocationFields(): JSX.Element` — renders two hidden inputs, `name="lat"` and `name="lng"`, best-effort filled from `navigator.geolocation`.

- [ ] **Step 1: Create the component**

Create `src/components/geolocation-fields.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

export function GeolocationFields() {
  const [coords, setCoords] = useState<{ lat: string; lng: string } | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: String(pos.coords.latitude), lng: String(pos.coords.longitude) }),
      () => {
        // No permission or unavailable — lat/lng simply stay empty. Not an error state.
      },
      { timeout: 5000 },
    );
  }, []);

  return (
    <>
      <input type="hidden" name="lat" value={coords?.lat ?? ""} />
      <input type="hidden" name="lng" value={coords?.lng ?? ""} />
    </>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit` — no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/geolocation-fields.tsx
git commit -m "feat: add best-effort geolocation fields component"
```

---

### Task 3: Submit Unit form + own-submissions list

**Files:**
- Create: `src/app/(app)/submit-unit/actions.ts`
- Create: `src/app/(app)/submit-unit/page.tsx`

**Interfaces:**
- Consumes: `getCurrentProfile()`, `createClient()`, `findDuplicateCandidates` from `@/lib/units/duplicate-detection` (Task 1), `GeolocationFields` from `@/components/geolocation-fields` (Task 2), `Badge` from `@/components/badge`
- Produces: `export async function createUnitSubmission(formData: FormData): Promise<void>`

- [ ] **Step 1: Create the server action**

Create `src/app/(app)/submit-unit/actions.ts`:

```typescript
"use server";

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";

export async function createUnitSubmission(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor) {
    redirect("/login");
  }

  const subAreaId = String(formData.get("subAreaId"));
  const jalan = String(formData.get("jalan") ?? "");
  const unitNo = String(formData.get("unitNo") ?? "");
  const address = String(formData.get("address"));
  const discoveryType = String(formData.get("discoveryType"));
  const bannerPhone = String(formData.get("bannerPhone") ?? "");
  const remarks = String(formData.get("remarks") ?? "");
  const latRaw = String(formData.get("lat") ?? "");
  const lngRaw = String(formData.get("lng") ?? "");

  const supabase = await createClient();

  const { data: subArea } = await supabase
    .from("sub_areas")
    .select("id, area_id")
    .eq("id", subAreaId)
    .single();

  const { error } = await supabase.from("unit_submissions").insert({
    submitted_by: actor.id,
    area_id: subArea?.area_id ?? null,
    sub_area_id: subAreaId,
    jalan: jalan || null,
    unit_no: unitNo || null,
    address,
    lat: latRaw ? Number(latRaw) : null,
    lng: lngRaw ? Number(lngRaw) : null,
    discovery_type: discoveryType,
    banner_phone: bannerPhone || null,
    remarks: remarks || null,
  });

  if (error) {
    redirect("/submit-unit?error=create_failed");
  }

  redirect("/submit-unit?created=1");
}
```

- [ ] **Step 2: Create the page**

Create `src/app/(app)/submit-unit/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/badge";
import { GeolocationFields } from "@/components/geolocation-fields";
import { findDuplicateCandidates } from "@/lib/units/duplicate-detection";
import { createUnitSubmission } from "./actions";

const FIELD_CLASSES =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none";

const ERROR_MESSAGES: Record<string, string> = {
  create_failed: "Could not submit unit. Check the details and try again.",
};

const DISCOVERY_TYPES = [
  { value: "vacant", label: "Vacant" },
  { value: "banner", label: "Banner" },
  { value: "target_unit", label: "Target unit" },
  { value: "other", label: "Other" },
];

export default async function SubmitUnitPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  const { error, created } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  const supabase = await createClient();

  const { data: subAreas } = await supabase
    .from("sub_areas")
    .select("id, name, area_id, areas(name)")
    .order("name");

  const { data: submissions } = await supabase
    .from("unit_submissions")
    .select("id, sub_area_id, jalan, unit_no, address, discovery_type, status, created_at")
    .eq("submitted_by", profile.id)
    .order("created_at", { ascending: false });

  const submissionsWithDuplicates = await Promise.all(
    (submissions ?? []).map(async (s) => {
      if (s.status !== "pending" || !s.sub_area_id) {
        return { ...s, hasDuplicates: false };
      }
      const { data: existingUnits } = await supabase
        .from("units")
        .select("id, unit_code, jalan, unit_no, full_address")
        .eq("sub_area_id", s.sub_area_id);

      const candidates = findDuplicateCandidates(
        { subAreaId: s.sub_area_id, jalan: s.jalan ?? "", unitNo: s.unit_no ?? "", address: s.address },
        (existingUnits ?? []).map((u) => ({
          id: u.id,
          unitCode: u.unit_code,
          subAreaId: s.sub_area_id as string,
          jalan: u.jalan,
          unitNo: u.unit_no,
          fullAddress: u.full_address,
        })),
      );
      return { ...s, hasDuplicates: candidates.length > 0 };
    }),
  );

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Submit unit</h1>

      <form
        action={createUnitSubmission}
        className="space-y-4 rounded-2xl border border-sky-100 bg-white p-6 shadow-sm"
      >
        <GeolocationFields />
        {created ? <p className="text-sm text-sky-700">Submitted. An admin will review it.</p> : null}
        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="subAreaId">
            Sub-area
          </label>
          <select id="subAreaId" name="subAreaId" required className={FIELD_CLASSES}>
            <option value="">Select a sub-area</option>
            {(subAreas ?? []).map((sa) => (
              <option key={sa.id} value={sa.id}>
                {/* @ts-expect-error -- Supabase nested select typing */}
                {sa.areas?.name} / {sa.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="jalan">
            Jalan
          </label>
          <input id="jalan" name="jalan" className={FIELD_CLASSES} />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="unitNo">
            Unit no
          </label>
          <input id="unitNo" name="unitNo" className={FIELD_CLASSES} />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="address">
            Address
          </label>
          <input id="address" name="address" required className={FIELD_CLASSES} />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="discoveryType">
            Discovery type
          </label>
          <select id="discoveryType" name="discoveryType" defaultValue="vacant" className={FIELD_CLASSES}>
            {DISCOVERY_TYPES.map((dt) => (
              <option key={dt.value} value={dt.value}>
                {dt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="bannerPhone">
            Banner phone (if visible)
          </label>
          <input id="bannerPhone" name="bannerPhone" className={FIELD_CLASSES} />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="remarks">
            Remarks
          </label>
          <textarea id="remarks" name="remarks" className={FIELD_CLASSES} rows={3} />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-sky-600 px-4 py-2 text-base font-medium text-white hover:bg-sky-700"
        >
          Submit
        </button>
      </form>

      <div className="space-y-3">
        <h2 className="font-medium text-slate-900">My submissions</h2>
        {submissionsWithDuplicates.length === 0 ? (
          <p className="text-sm text-slate-600">No submissions yet.</p>
        ) : (
          submissionsWithDuplicates.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-xl bg-sky-50 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">
                  {s.jalan} {s.unit_no}
                </p>
                <p className="text-sm text-slate-600">{s.address}</p>
              </div>
              {s.status === "pending" && s.hasDuplicates ? <Badge tone="warn">Possible duplicate</Badge> : null}
              <Badge tone={s.status === "pending" ? "neutral" : s.status === "linked" ? "accent" : "ok"}>
                {s.status}
              </Badge>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify it compiles and the page loads for any authenticated user**

Run: `npx tsc --noEmit` — no new errors.
Run: `npm run dev` in the background, `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/submit-unit` — expect `307` (redirects to `/login`, unauthenticated — this route allows ANY logged-in role, but still requires being logged in). Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/submit-unit/actions.ts" "src/app/(app)/submit-unit/page.tsx"
git commit -m "feat: add submit-unit form with duplicate warning"
```

---

### Task 4: Admin review queue (pending submissions)

**Files:**
- Create: `src/app/(app)/unit-submissions/page.tsx`

**Interfaces:**
- Consumes: `getCurrentProfile()`, `createClient()`, `Badge` from `@/components/badge`

- [ ] **Step 1: Create the page**

Create `src/app/(app)/unit-submissions/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/badge";

export default async function UnitSubmissionsPage() {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "area_admin")) {
    redirect("/");
  }

  const supabase = await createClient();
  const { data: submissions } = await supabase
    .from("unit_submissions")
    .select("id, jalan, unit_no, address, discovery_type, status, created_at, sub_areas(name, areas(name))")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const rows = submissions ?? [];

  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Unit submissions</h1>

      <div className="rounded-2xl border border-sky-100 bg-white shadow-sm">
        {rows.map((s, i) => (
          <a
            key={s.id}
            href={`/unit-submissions/${s.id}`}
            className={`flex items-center gap-4 px-5 py-3.5 hover:bg-sky-50/60 ${
              i === rows.length - 1 ? "" : "border-b border-sky-100"
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">
                {s.jalan} {s.unit_no}
              </p>
              <p className="text-sm text-slate-600">
                {s.address} ·{" "}
                {/* @ts-expect-error -- Supabase nested select typing */}
                {s.sub_areas?.areas?.name} / {s.sub_areas?.name}
              </p>
            </div>
            <Badge tone="neutral">{s.discovery_type}</Badge>
          </a>
        ))}
        {rows.length === 0 ? <p className="px-5 py-4 text-sm text-slate-600">No pending submissions.</p> : null}
      </div>
    </div>
  );
}
```

Note: this page does NOT show who submitted each entry — see the plan's Global Constraints for why (RLS on `profiles` doesn't let an `area_admin` read other users' profile rows).

- [ ] **Step 2: Verify it compiles and the auth redirect works**

Run: `npx tsc --noEmit` — no new errors.
Run: `npm run dev` in the background, `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/unit-submissions` — expect `307`. Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/unit-submissions/page.tsx"
git commit -m "feat: add unit submissions review queue"
```

---

### Task 5: Submission detail — link to existing unit or create new unit

**Files:**
- Create: `src/app/(app)/unit-submissions/[submissionId]/actions.ts`
- Create: `src/app/(app)/unit-submissions/[submissionId]/page.tsx`

**Interfaces:**
- Consumes: `getCurrentProfile()`, `createClient()`, `findDuplicateCandidates` from `@/lib/units/duplicate-detection` (Task 1)
- Produces: `export async function linkSubmissionToUnit(formData: FormData): Promise<void>`, `export async function createUnitFromSubmission(formData: FormData): Promise<void>`

- [ ] **Step 1: Create the server actions**

Create `src/app/(app)/unit-submissions/[submissionId]/actions.ts`:

```typescript
"use server";

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";

export async function linkSubmissionToUnit(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor || (actor.role !== "super_admin" && actor.role !== "area_admin")) {
    redirect("/");
  }

  const submissionId = String(formData.get("submissionId"));
  const unitId = String(formData.get("unitId"));

  const supabase = await createClient();
  const { error } = await supabase
    .from("unit_submissions")
    .update({ status: "linked", matched_unit_id: unitId })
    .eq("id", submissionId);

  if (error) {
    redirect(`/unit-submissions/${submissionId}?error=link_failed`);
  }

  redirect("/unit-submissions?linked=1");
}

export async function createUnitFromSubmission(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor || (actor.role !== "super_admin" && actor.role !== "area_admin")) {
    redirect("/");
  }

  const submissionId = String(formData.get("submissionId"));
  const subAreaId = String(formData.get("subAreaId"));
  const jalan = String(formData.get("jalan") ?? "");
  const unitNo = String(formData.get("unitNo") ?? "");
  const address = String(formData.get("address"));

  const supabase = await createClient();

  const { data: unit, error: unitError } = await supabase
    .from("units")
    .insert({
      sub_area_id: subAreaId,
      jalan: jalan || null,
      unit_no: unitNo || null,
      full_address: address,
      created_by: actor.id,
      updated_by: actor.id,
    })
    .select("id")
    .single();

  if (unitError || !unit) {
    redirect(`/unit-submissions/${submissionId}?error=create_failed`);
  }

  const { error: searchTaskError } = await supabase
    .from("owner_search_tasks")
    .insert({ unit_id: unit!.id });

  if (searchTaskError) {
    redirect(`/unit-submissions/${submissionId}?error=search_task_failed`);
  }

  const { error: submissionError } = await supabase
    .from("unit_submissions")
    .update({ status: "converted", matched_unit_id: unit!.id })
    .eq("id", submissionId);

  if (submissionError) {
    redirect(`/unit-submissions/${submissionId}?error=update_failed`);
  }

  redirect(`/units/${unit!.id}?converted=1`);
}
```

- [ ] **Step 2: Create the page**

Create `src/app/(app)/unit-submissions/[submissionId]/page.tsx`:

```tsx
import { redirect, notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { findDuplicateCandidates } from "@/lib/units/duplicate-detection";
import { linkSubmissionToUnit, createUnitFromSubmission } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  link_failed: "Could not link submission. Try again.",
  create_failed: "Could not create unit. Try again.",
  search_task_failed: "Unit created, but the owner search task could not be created.",
  update_failed: "Unit created, but the submission status could not be updated.",
};

const FIELD_CLASSES =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none";

export default async function UnitSubmissionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ submissionId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "area_admin")) {
    redirect("/");
  }

  const { submissionId } = await params;
  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  const supabase = await createClient();
  const { data: submission } = await supabase
    .from("unit_submissions")
    .select(
      "id, sub_area_id, jalan, unit_no, address, discovery_type, banner_phone, remarks, status, sub_areas(name, areas(name))",
    )
    .eq("id", submissionId)
    .single();

  if (!submission) {
    notFound();
  }

  let candidates: {
    id: string;
    unitCode: string;
    jalan: string | null;
    unitNo: string | null;
    fullAddress: string;
  }[] = [];

  if (submission.sub_area_id) {
    const { data: existingUnits } = await supabase
      .from("units")
      .select("id, unit_code, jalan, unit_no, full_address")
      .eq("sub_area_id", submission.sub_area_id);

    candidates = findDuplicateCandidates(
      {
        subAreaId: submission.sub_area_id,
        jalan: submission.jalan ?? "",
        unitNo: submission.unit_no ?? "",
        address: submission.address,
      },
      (existingUnits ?? []).map((u) => ({
        id: u.id,
        unitCode: u.unit_code,
        subAreaId: submission.sub_area_id as string,
        jalan: u.jalan,
        unitNo: u.unit_no,
        fullAddress: u.full_address,
      })),
    );
  }

  return (
    <div className="max-w-2xl space-y-5">
      <a className="text-sm text-sky-600" href="/unit-submissions">
        ← Unit submissions
      </a>

      <div>
        <h1 className="text-lg font-semibold text-slate-900">
          {submission.jalan} {submission.unit_no}
        </h1>
        <p className="text-sm text-slate-600">
          {submission.address} ·{" "}
          {/* @ts-expect-error -- Supabase nested select typing */}
          {submission.sub_areas?.areas?.name} / {submission.sub_areas?.name}
        </p>
        <p className="text-sm text-slate-600">
          Discovery: {submission.discovery_type}
          {submission.banner_phone ? ` · Banner phone: ${submission.banner_phone}` : ""}
        </p>
        {submission.remarks ? <p className="mt-1 text-sm text-slate-600">{submission.remarks}</p> : null}
      </div>

      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      {submission.status !== "pending" ? (
        <p className="text-sm text-slate-600">This submission has already been {submission.status}.</p>
      ) : (
        <>
          {candidates.length > 0 ? (
            <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <h2 className="font-medium text-slate-900">Possible existing units</h2>
              {candidates.map((c) => (
                <form key={c.id} action={linkSubmissionToUnit} className="flex items-center gap-3">
                  <input type="hidden" name="submissionId" value={submission.id} />
                  <input type="hidden" name="unitId" value={c.id} />
                  <div className="min-w-0 flex-1 text-sm text-slate-700">
                    <a className="font-semibold text-sky-700" href={`/units/${c.id}`}>
                      {c.unitCode}
                    </a>{" "}
                    — {c.jalan} {c.unitNo}, {c.fullAddress}
                  </div>
                  <button
                    type="submit"
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Link to this unit
                  </button>
                </form>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600">No matching existing units found.</p>
          )}

          <form
            action={createUnitFromSubmission}
            className="space-y-4 rounded-2xl border border-sky-100 bg-white p-6 shadow-sm"
          >
            <input type="hidden" name="submissionId" value={submission.id} />
            <input type="hidden" name="subAreaId" value={submission.sub_area_id ?? ""} />
            <h2 className="font-medium text-slate-900">Create as new unit</h2>
            <p className="text-sm text-slate-600">
              {/* @ts-expect-error -- Supabase nested select typing */}
              Sub-area: {submission.sub_areas?.areas?.name} / {submission.sub_areas?.name}
            </p>
            <div className="space-y-1">
              <label className="text-sm text-slate-700" htmlFor="jalan">
                Jalan
              </label>
              <input id="jalan" name="jalan" defaultValue={submission.jalan ?? ""} className={FIELD_CLASSES} />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-700" htmlFor="unitNo">
                Unit no
              </label>
              <input id="unitNo" name="unitNo" defaultValue={submission.unit_no ?? ""} className={FIELD_CLASSES} />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-700" htmlFor="address">
                Full address
              </label>
              <input
                id="address"
                name="address"
                defaultValue={submission.address}
                required
                className={FIELD_CLASSES}
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-sky-600 px-4 py-2 text-base font-medium text-white hover:bg-sky-700"
            >
              Create unit
            </button>
          </form>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit` — no new errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/unit-submissions/[submissionId]/actions.ts" "src/app/(app)/unit-submissions/[submissionId]/page.tsx"
git commit -m "feat: add submission link/create-unit actions and detail page"
```

---

### Task 6: Nav links — Submit Unit (everyone) + Unit submissions (admin)

**Files:**
- Modify (full replacement of the top constant block): `src/components/app-shell.tsx`

**Interfaces:**
- Consumes: nothing new — pure nav-config change

- [ ] **Step 1: Update the nav constants and rendering**

The current top of `src/components/app-shell.tsx` (lines 1-22) is:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { canAccessAdminTools, canManageUsers, type Role } from "@/lib/auth/role";

const DASHBOARD_NAV = { href: "/", label: "Dashboard" };

const ADMIN_NAV = [
  { href: "/units", label: "Units" },
  { href: "/owners", label: "Owners" },
  { href: "/owner-search", label: "Owner search" },
  { href: "/listings", label: "Listings" },
  { href: "/contact-requests", label: "Contact requests" },
  { href: "/verification", label: "Verification" },
];

const USERS_AREAS_NAV = [
  { href: "/admin/areas", label: "Areas" },
  { href: "/admin/users", label: "Users" },
];
```

Replace lines 1-22 with (adds `GENERAL_NAV`, adds `"/unit-submissions"` to `ADMIN_NAV` — everything else unchanged):

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { canAccessAdminTools, canManageUsers, type Role } from "@/lib/auth/role";

const DASHBOARD_NAV = { href: "/", label: "Dashboard" };

const GENERAL_NAV = [{ href: "/submit-unit", label: "Submit Unit" }];

const ADMIN_NAV = [
  { href: "/units", label: "Units" },
  { href: "/owners", label: "Owners" },
  { href: "/owner-search", label: "Owner search" },
  { href: "/unit-submissions", label: "Unit submissions" },
  { href: "/listings", label: "Listings" },
  { href: "/contact-requests", label: "Contact requests" },
  { href: "/verification", label: "Verification" },
];

const USERS_AREAS_NAV = [
  { href: "/admin/areas", label: "Areas" },
  { href: "/admin/users", label: "Users" },
];
```

Then, further down the file, find this block (immediately after the `<NavLink href={DASHBOARD_NAV.href} ...>` element, before the `{showAdminNav ? ...}` conditional):

```tsx
          <NavLink href={DASHBOARD_NAV.href} active={pathname === DASHBOARD_NAV.href}>
            {DASHBOARD_NAV.label}
          </NavLink>
          {showAdminNav
```

Replace it with (adds unconditional rendering of `GENERAL_NAV` right after Dashboard, before the admin section):

```tsx
          <NavLink href={DASHBOARD_NAV.href} active={pathname === DASHBOARD_NAV.href}>
            {DASHBOARD_NAV.label}
          </NavLink>
          {GENERAL_NAV.map((item) => (
            <NavLink key={item.href} href={item.href} active={pathname === item.href}>
              {item.label}
            </NavLink>
          ))}
          {showAdminNav
```

Nothing else in the file changes — the `NavLink` component, the `showAdminNav`/`showUsersAreasNav` computations, and the rest of the layout are untouched.

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit` — no new errors.
Run: `npm test` — still passing (Task 1 added more tests).

- [ ] **Step 3: Commit**

```bash
git add src/components/app-shell.tsx
git commit -m "feat: add submit-unit and unit-submissions nav links"
```

---

## Manual Verification (controller-driven, after all tasks land)

1. Log in as any user (including a plain `sp` if one exists, or the `super_admin`/`area_admin` test accounts) → confirm "Submit Unit" appears in the sidebar for every role, but "Unit submissions" only appears for `super_admin`/`area_admin`.
2. Go to `/submit-unit` → fill in a sub-area, jalan, unit no, address that does NOT match the existing `SET-DK-000001` test unit → submit → confirm it appears in "My submissions" with status "pending" and no "Possible duplicate" badge.
3. Submit again with the SAME sub-area, jalan "Jalan Genting Klang", unit no "45" (matching the existing test unit) → confirm this one shows a "Possible duplicate" badge.
4. Log in as `super_admin` (or the assigned `area_admin`) → go to `/unit-submissions` → confirm both pending submissions are listed.
5. Click into the duplicate one → confirm "Possible existing units" shows `SET-DK-000001` → click "Link to this unit" → confirm redirect to `/unit-submissions` and the submission no longer appears in the pending list (status is now `linked`).
6. Click into the non-duplicate one → confirm "No matching existing units found." → submit "Create as new unit" → confirm redirect to the new unit's `/units/<id>` page, the unit has an auto-generated `unit_code`, and (check directly in Supabase Table Editor) an `owner_search_tasks` row exists for it with `status = 'need_search'`.

## Self-Review Notes

- **Spec coverage:** Unit Discovery Workflow (spec §7 — submit form, auto-record submitted_by/area, GPS if available, possible-existing-unit check, auto-create Owner Search task on conversion), Duplicate Detection (spec §8 — match on area/sub-area/jalan/unit-no/address, never auto-merge, link-or-create-new choice). Owner Search Queue *management* (spec §9, beyond just creating the initial task) and the actual photo upload (spec §7's "Photo" field, needs Supabase Storage) are explicitly out of scope — later plans. Noted as a deliberate cut in Global Constraints.
- **Placeholder scan:** none found.
- **Type consistency:** `DuplicateCandidateInput`/`ExistingUnitForMatch` from Task 1 are used with matching field names in both Task 3's and Task 5's calls to `findDuplicateCandidates`. `createUnitSubmission`'s field names match Task 3's form; `linkSubmissionToUnit`/`createUnitFromSubmission`'s field names match Task 5's forms.
