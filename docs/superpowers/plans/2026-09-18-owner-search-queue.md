# Owner Search Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Super Admin / Area Admin can work the Owner Search Queue — every `owner_search_task` auto-created when a Unit Submission is converted (previous plan) — updating status (Need Search → Number Found → Contacting → Owner Confirmed, or Wrong Number / Unable to Reach / Follow Up Later), recording a found contact number, and remarks.

**Architecture:** Same pattern as every prior plan — Server Components read via RLS-gated Supabase queries, Server Actions handle writes with a UX-level role check backstopped by already-deployed RLS. No new migrations: `owner_search_tasks` already exists from `0001_phase1_schema.sql` with RLS matching this plan's access exactly.

**Tech Stack:** Next.js Server Components/Actions, Supabase (`@supabase/ssr`), Tailwind, the shared `Badge` component.

## Important Context: Replacing a Mock Page, Same Policy as the Listings Plan

`src/app/(app)/owner-search/page.tsx` currently renders `OwnerSearchBoard` (`src/components/owner-search-board.tsx`) fed by `src/lib/mock/owner-search.ts` — a design-reference mockup from the same parallel UI-shell session the Listings plan wired up. That mock's `OwnerSearchStatus` type only has 4 of the real 7 DB status values, and its board is a client-side two-pane list+detail with non-functional (`type="button"`, no real action) outcome buttons — a different interaction pattern (client-side selection state) than every real page in this codebase (route-based list + detail page, server-action forms). This plan replaces `owner-search/page.tsx`'s content with the same route-based list+detail pattern used for Units/Owners/Listings, and does **not** delete or modify `src/lib/mock/owner-search.ts` or `src/components/owner-search-board.tsx` — same policy as the Listings plan: they stay in place, unused, as design-reference artifacts for future work, not wired into any real page after this plan lands.

The sidebar nav already has an `"/owner-search"` entry in `ADMIN_NAV` (`src/components/app-shell.tsx`) from that same earlier session — **no nav task is needed in this plan.**

## Schema This Plan Assumes (already deployed — do not re-create)

- `owner_search_tasks(id uuid, unit_id uuid not null, space_id uuid, status text not null default 'need_search' check in ('need_search','number_found','contacting','owner_confirmed','wrong_number','unable_to_reach','follow_up_later'), assigned_to uuid, found_contact text, remarks text, created_at, updated_at)`. RLS: admin-only (`super_admin` or the `area_admin` of the task's unit's area) for all operations, via the same `area_id_for_unit()` helper every other admin-write table in this schema uses.
- Rows are already being created automatically by the Submit-Unit plan's `createUnitFromSubmission` action when a submission is converted into a new Unit.

## Global Constraints

- "Finding a phone number does NOT automatically mean it is a verified owner. Only mark Verified Owner after confirmation" (spec §9) — this plan's status update NEVER touches the `owners` table or `unit_ownerships`. Reaching `owner_confirmed` on a search task is purely a status label on the *task*; recording the actual Owner (with its own `verification_status`) remains the existing "Add owner" flow on the Unit detail page's Owner tab (already shipped in the Owners plan) — a manual follow-up step, not automated by this plan.
- `space_id`/`assigned_to` columns exist but are out of scope for this plan (per-space search tasks and admin task assignment are later refinements, spec §20's "assign verification tasks to SP" is explicitly a Phase 2 item) — this plan only reads/writes `status`, `found_contact`, `remarks`.
- `status` values are exactly the 7 DB CHECK literals — use these literal strings, matching the established `owners`/`listings` status-label-module pattern.
- Light theme, white background, sky-blue accents, `Badge` component — match established conventions.

---

## File Structure

- `src/lib/owner-search/status-labels.ts` — pure label/tone helpers for the 7-value `status` DB enum.
- `src/app/(app)/owner-search/page.tsx` — modify (full replacement): real queue list, admin-only.
- `src/app/(app)/owner-search/[taskId]/actions.ts` — new: `updateOwnerSearchTask(formData)`.
- `src/app/(app)/owner-search/[taskId]/page.tsx` — new: task detail + update form.

---

### Task 1: Owner search status label helpers

**Files:**
- Create: `src/lib/owner-search/status-labels.ts`
- Test: `src/lib/owner-search/status-labels.test.ts`

**Interfaces:**
- Produces: `export type OwnerSearchTaskStatus = "need_search" | "number_found" | "contacting" | "owner_confirmed" | "wrong_number" | "unable_to_reach" | "follow_up_later"`
- Produces: `export const OWNER_SEARCH_STATUSES: OwnerSearchTaskStatus[]`
- Produces: `export function ownerSearchStatusLabel(status: OwnerSearchTaskStatus): string`
- Produces: `export function ownerSearchStatusTone(status: OwnerSearchTaskStatus): BadgeTone` (imports `BadgeTone` from `@/lib/ui/badge-tone`)

- [ ] **Step 1: Write the failing test**

Create `src/lib/owner-search/status-labels.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  ownerSearchStatusLabel,
  ownerSearchStatusTone,
  OWNER_SEARCH_STATUSES,
} from "./status-labels";

describe("ownerSearchStatusLabel", () => {
  it("labels every owner search status", () => {
    expect(ownerSearchStatusLabel("need_search")).toBe("Need Search");
    expect(ownerSearchStatusLabel("number_found")).toBe("Number Found");
    expect(ownerSearchStatusLabel("contacting")).toBe("Contacting");
    expect(ownerSearchStatusLabel("owner_confirmed")).toBe("Owner Confirmed");
    expect(ownerSearchStatusLabel("wrong_number")).toBe("Wrong Number");
    expect(ownerSearchStatusLabel("unable_to_reach")).toBe("Unable to Reach");
    expect(ownerSearchStatusLabel("follow_up_later")).toBe("Follow Up Later");
  });
});

describe("ownerSearchStatusTone", () => {
  it("returns a tone for every status without throwing", () => {
    for (const status of OWNER_SEARCH_STATUSES) {
      expect(typeof ownerSearchStatusTone(status)).toBe("string");
    }
  });

  it("uses ok for owner_confirmed and dark for the two dead-end statuses", () => {
    expect(ownerSearchStatusTone("owner_confirmed")).toBe("ok");
    expect(ownerSearchStatusTone("wrong_number")).toBe("dark");
    expect(ownerSearchStatusTone("unable_to_reach")).toBe("dark");
  });
});

describe("OWNER_SEARCH_STATUSES", () => {
  it("has exactly the 7 DB enum values", () => {
    expect(OWNER_SEARCH_STATUSES).toEqual([
      "need_search",
      "number_found",
      "contacting",
      "owner_confirmed",
      "wrong_number",
      "unable_to_reach",
      "follow_up_later",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './status-labels'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/owner-search/status-labels.ts`:

```typescript
import type { BadgeTone } from "@/lib/ui/badge-tone";

export type OwnerSearchTaskStatus =
  | "need_search"
  | "number_found"
  | "contacting"
  | "owner_confirmed"
  | "wrong_number"
  | "unable_to_reach"
  | "follow_up_later";

export const OWNER_SEARCH_STATUSES: OwnerSearchTaskStatus[] = [
  "need_search",
  "number_found",
  "contacting",
  "owner_confirmed",
  "wrong_number",
  "unable_to_reach",
  "follow_up_later",
];

const STATUS_LABELS: Record<OwnerSearchTaskStatus, string> = {
  need_search: "Need Search",
  number_found: "Number Found",
  contacting: "Contacting",
  owner_confirmed: "Owner Confirmed",
  wrong_number: "Wrong Number",
  unable_to_reach: "Unable to Reach",
  follow_up_later: "Follow Up Later",
};

const STATUS_TONES: Record<OwnerSearchTaskStatus, BadgeTone> = {
  need_search: "neutral",
  number_found: "accent",
  contacting: "warn",
  owner_confirmed: "ok",
  wrong_number: "dark",
  unable_to_reach: "dark",
  follow_up_later: "warn",
};

export function ownerSearchStatusLabel(status: OwnerSearchTaskStatus): string {
  return STATUS_LABELS[status];
}

export function ownerSearchStatusTone(status: OwnerSearchTaskStatus): BadgeTone {
  return STATUS_TONES[status];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/owner-search/status-labels.ts src/lib/owner-search/status-labels.test.ts
git commit -m "feat: add owner search task status label helpers"
```

---

### Task 2: Owner Search Queue list page

**Files:**
- Modify (full replacement): `src/app/(app)/owner-search/page.tsx`

**Interfaces:**
- Consumes: `getCurrentProfile()`, `createClient()`, `ownerSearchStatusLabel`, `ownerSearchStatusTone` from `@/lib/owner-search/status-labels` (Task 1), `Badge` from `@/components/badge`

- [ ] **Step 1: Replace the page**

The current `src/app/(app)/owner-search/page.tsx` is:

```tsx
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
```

Replace the whole file with:

```tsx
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/badge";
import {
  ownerSearchStatusLabel,
  ownerSearchStatusTone,
  type OwnerSearchTaskStatus,
} from "@/lib/owner-search/status-labels";

export default async function OwnerSearchPage() {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "area_admin")) {
    redirect("/");
  }

  const supabase = await createClient();
  const { data: tasks } = await supabase
    .from("owner_search_tasks")
    .select(
      "id, status, found_contact, units(unit_code, jalan, unit_no, full_address, sub_areas(name, areas(name)))",
    )
    .order("created_at", { ascending: true });

  const rows = tasks ?? [];
  const openCount = rows.filter(
    (t) => t.status !== "owner_confirmed" && t.status !== "wrong_number" && t.status !== "unable_to_reach",
  ).length;
  const confirmedCount = rows.filter((t) => t.status === "owner_confirmed").length;

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-lg font-semibold text-slate-900">Owner search</h1>
        <Badge tone="warn">Open {openCount}</Badge>
        <Badge tone="ok">Confirmed {confirmedCount}</Badge>
      </div>

      <div className="rounded-2xl border border-sky-100 bg-white shadow-sm">
        {rows.map((task, i) => (
          <a
            key={task.id}
            href={`/owner-search/${task.id}`}
            className={`flex items-center gap-4 px-5 py-3.5 hover:bg-sky-50/60 ${
              i === rows.length - 1 ? "" : "border-b border-sky-100"
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">
                {/* @ts-expect-error -- Supabase nested select typing */}
                {task.units?.jalan} {task.units?.unit_no}
              </p>
              <p className="text-sm text-slate-600">
                {/* @ts-expect-error -- Supabase nested select typing */}
                {task.units?.unit_code} · {task.units?.sub_areas?.areas?.name} / {task.units?.sub_areas?.name}
              </p>
            </div>
            <span className="text-sm text-slate-600">{task.found_contact ?? "No contact yet"}</span>
            <Badge tone={ownerSearchStatusTone(task.status as OwnerSearchTaskStatus)}>
              {ownerSearchStatusLabel(task.status as OwnerSearchTaskStatus)}
            </Badge>
          </a>
        ))}
        {rows.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-600">No owner search tasks.</p>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles and the auth redirect works**

Run: `npx tsc --noEmit` — no new errors.
Run: `npm run dev` in the background, `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/owner-search` — expect `307`. Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/owner-search/page.tsx"
git commit -m "feat: wire owner search queue to real data"
```

---

### Task 3: Task detail — update status, found contact, remarks

**Files:**
- Create: `src/app/(app)/owner-search/[taskId]/actions.ts`
- Create: `src/app/(app)/owner-search/[taskId]/page.tsx`

**Interfaces:**
- Consumes: `getCurrentProfile()`, `createClient()`, `OWNER_SEARCH_STATUSES`, `ownerSearchStatusLabel`, `ownerSearchStatusTone` from `@/lib/owner-search/status-labels` (Task 1)
- Produces: `export async function updateOwnerSearchTask(formData: FormData): Promise<void>`

- [ ] **Step 1: Create the server action**

Create `src/app/(app)/owner-search/[taskId]/actions.ts`:

```typescript
"use server";

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";

export async function updateOwnerSearchTask(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor || (actor.role !== "super_admin" && actor.role !== "area_admin")) {
    redirect("/");
  }

  const taskId = String(formData.get("taskId"));
  const status = String(formData.get("status"));
  const foundContact = String(formData.get("foundContact") ?? "");
  const remarks = String(formData.get("remarks") ?? "");

  const supabase = await createClient();
  const { error } = await supabase
    .from("owner_search_tasks")
    .update({
      status,
      found_contact: foundContact || null,
      remarks: remarks || null,
    })
    .eq("id", taskId);

  if (error) {
    redirect(`/owner-search/${taskId}?error=update_failed`);
  }

  redirect(`/owner-search/${taskId}?updated=1`);
}
```

- [ ] **Step 2: Create the page**

Create `src/app/(app)/owner-search/[taskId]/page.tsx`:

```tsx
import { redirect, notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import {
  OWNER_SEARCH_STATUSES,
  ownerSearchStatusLabel,
  type OwnerSearchTaskStatus,
} from "@/lib/owner-search/status-labels";
import { updateOwnerSearchTask } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  update_failed: "Could not update task. Try again.",
};

const FIELD_CLASSES =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none";

export default async function OwnerSearchTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ taskId: string }>;
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "area_admin")) {
    redirect("/");
  }

  const { taskId } = await params;
  const { error, updated } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  const supabase = await createClient();
  const { data: task } = await supabase
    .from("owner_search_tasks")
    .select(
      "id, unit_id, status, found_contact, remarks, units(unit_code, jalan, unit_no, full_address, sub_areas(name, areas(name)))",
    )
    .eq("id", taskId)
    .single();

  if (!task) {
    notFound();
  }

  return (
    <div className="max-w-2xl space-y-5">
      <a className="text-sm text-sky-600" href="/owner-search">
        ← Owner search
      </a>

      <div>
        <h1 className="text-lg font-semibold text-slate-900">
          {/* @ts-expect-error -- Supabase nested select typing */}
          {task.units?.jalan} {task.units?.unit_no}
        </h1>
        <p className="text-sm text-slate-600">
          {/* @ts-expect-error -- Supabase nested select typing */}
          {task.units?.full_address} · {task.units?.sub_areas?.areas?.name} / {task.units?.sub_areas?.name}
        </p>
        <a className="text-sm text-sky-600" href={`/units/${task.unit_id}`}>
          View unit →
        </a>
      </div>

      {task.status === "owner_confirmed" ? (
        <p className="rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-800">
          Once confirmed, record the owner's details on the unit's Owner tab — this task's status alone
          doesn't create an Owner record.
        </p>
      ) : null}

      <form
        action={updateOwnerSearchTask}
        className="space-y-4 rounded-2xl border border-sky-100 bg-white p-6 shadow-sm"
      >
        <input type="hidden" name="taskId" value={task.id} />
        <h2 className="font-medium text-slate-900">Update</h2>
        {updated ? <p className="text-sm text-sky-700">Task updated.</p> : null}
        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={task.status}
            className={FIELD_CLASSES}
          >
            {OWNER_SEARCH_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ownerSearchStatusLabel(s as OwnerSearchTaskStatus)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="foundContact">
            Found contact
          </label>
          <input
            id="foundContact"
            name="foundContact"
            defaultValue={task.found_contact ?? ""}
            className={FIELD_CLASSES}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="remarks">
            Remarks
          </label>
          <textarea
            id="remarks"
            name="remarks"
            defaultValue={task.remarks ?? ""}
            className={FIELD_CLASSES}
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
Run: `npm test` — still passing (Task 1 added more tests).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/owner-search/[taskId]/actions.ts" "src/app/(app)/owner-search/[taskId]/page.tsx"
git commit -m "feat: add owner search task update"
```

---

## Manual Verification (controller-driven, after all tasks land)

1. As `super_admin`, confirm the `owner_search_tasks` row auto-created by the previous plan's "Create as new unit" flow (for `SET-DK-000002`) appears in `/owner-search` with status "Need Search".
2. Click into it → confirm the unit's address/area render correctly and "View unit →" links to `/units/<id>`.
3. Set Found contact to a phone number, change Status to "Number Found" → Save → confirm the badge on the list updates and "Task updated." shows.
4. Change Status to "Owner Confirmed" → Save → confirm the reminder message about recording the Owner on the unit's Owner tab appears.
5. Go to that unit's page, Owner tab → confirm nothing was auto-created there (still shows "No owner on record yet." unless you add one manually) — this is the Global Constraint holding: task status and Owner records stay independent.

## Self-Review Notes

- **Spec coverage:** Owner Search Queue (spec §9 — status workflow, found-contact recording, explicit non-automatic Owner-verification boundary). The Admin Work Queue dashboard (spec §10, cross-entity "today's work" counts) and per-SP task assignment (spec §20, Phase 2) are explicitly out of scope — this plan is the queue-working page itself, not the dashboard that surfaces it.
- **Placeholder scan:** none found.
- **Type consistency:** `OwnerSearchTaskStatus`/`OWNER_SEARCH_STATUSES` from Task 1 are used identically in Task 2 and Task 3. `updateOwnerSearchTask`'s field names (`taskId`, `status`, `foundContact`, `remarks`) match Task 3's form exactly.
