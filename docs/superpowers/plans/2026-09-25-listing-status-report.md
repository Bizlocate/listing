# Listing Status Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After contacting an owner, an SP reports what they learned about a listing (still available / rented / sold / owner not renting / price changed / cannot contact / wrong contact / other). The report is queued `pending_review` and does NOT change the listing. An admin (Super Admin / Area Admin scoped to the listing's area) confirms or rejects it; confirming applies the effect (e.g. `rented` → `listings.listing_status = 'rented'`, which the existing `trg_listing_status_history` trigger logs, and the listing drops out of `available_listings` automatically).

**Architecture:** Same pattern as every prior plan — Server Components read via RLS-gated queries, Server Actions write with a UX-level role check backstopped by RLS. **No new migration:** `listing_status_reports` and its RLS (SP insert/select own; admin select/update scoped by listing area) already exist in `0001_phase1_schema.sql`, and `listings_update_admin` already allows the admin-side listing update.

**Tech Stack:** Next.js Server Components/Actions, Supabase (`@supabase/ssr`), Tailwind, shared `Badge`.

## Important Context

- Spec workflow: "SP: call outcome buttons … RENTED -> listing_status_reports(pending_review), NOT auto-closed. Area Admin: confirms report -> listing_status_history row + listings.listing_status updated -> disappears from Available Listing automatically."
- `src/app/(app)/verification/page.tsx` (mock, aging queue from `src/lib/mock/verification.ts`) is a Phase 2 automation surface (spec: aging → auto-queued verification tasks). It is **not touched** by this plan and stays mock, unused-by-this-plan.
- **PostgREST ambiguity lesson (real bug from the previous plan):** `listing_status_reports` has TWO foreign keys to `profiles` (`reported_by`, `reviewed_by`). Any embed of `profiles` MUST be qualified: `profiles!listing_status_reports_reported_by_fkey(full_name)`. A bare `profiles(...)` returns PGRST201 which the `.select()` call silently turns into `data: null` (an empty list, no error). Every task below uses the qualified form; also check `error` on any new list/detail query instead of ignoring it.

## Schema This Plan Assumes (already deployed — do not re-create)

- `listing_status_reports(id, listing_id not null, reported_by not null, report_type check in ('still_available','rented','sold','owner_not_renting','price_changed','cannot_contact','wrong_contact','other'), remarks, status default 'pending_review' check in ('pending_review','confirmed','rejected'), reviewed_by, reviewed_at, created_at)`. RLS: insert only as self; select own or admin-scoped; update admin-scoped.
- `listings.listing_status` (10 values, see `src/lib/listings/status-labels.ts`), `listings.last_verified_date date`. Admin update allowed by `listings_update_admin`.

## Global Constraints

- Report → effect mapping is fixed (pure function, Task 1): `still_available` → no status change, set `last_verified_date` to today (Malaysia date via `todayInMalaysia()` from `@/lib/owners/today-my`); `rented` → `rented`; `sold` → `sold`; `owner_not_renting` → `not_for_rent`; `price_changed`, `cannot_contact`, `wrong_contact`, `other` → no automatic effect (admin follows up manually; confirming just marks the report reviewed).
- Confirm/Reject use the atomic-claim pattern: the report update includes `.eq("status","pending_review")` and the action stops if no row was claimed. Claim FIRST, then apply the listing effect.
- The SP report form is on the existing `/available-listings/[listingId]` page (any authenticated role can submit; RLS pins `reported_by = auth.uid()`). No new SP route.
- Light theme, white background, sky-blue accents, `Badge` component.

---

## File Structure

- `src/lib/status-reports/labels.ts` (+ `labels.test.ts`) — report type/status labels, tones, `reportEffect()`.
- `src/app/(app)/available-listings/[listingId]/actions.ts` — modify: add `submitStatusReport`.
- `src/app/(app)/available-listings/[listingId]/page.tsx` — modify: add "Report status" form card + success/error messages.
- `src/app/(app)/status-reports/page.tsx` — new: admin queue.
- `src/app/(app)/status-reports/[reportId]/page.tsx` + `actions.ts` — new: admin detail, confirm/reject.
- `src/components/app-shell.tsx` — modify: add `/status-reports` to `ADMIN_NAV`.

---

### Task 1: Status report label + effect helpers

**Files:**
- Create: `src/lib/status-reports/labels.ts`
- Test: `src/lib/status-reports/labels.test.ts`

**Interfaces:**
- Produces: `type StatusReportType`, `STATUS_REPORT_TYPES: StatusReportType[]`, `statusReportTypeLabel(t)`
- Produces: `type StatusReportStatus = "pending_review" | "confirmed" | "rejected"`, `statusReportStatusLabel(s)`, `statusReportStatusTone(s): BadgeTone`
- Produces: `reportEffect(t: StatusReportType): { listingStatus: ListingStatus | null; touchVerified: boolean }`

- [ ] **Step 1: Write the failing test**

Create `src/lib/status-reports/labels.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  STATUS_REPORT_TYPES,
  statusReportTypeLabel,
  statusReportStatusLabel,
  statusReportStatusTone,
  reportEffect,
} from "./labels";

describe("STATUS_REPORT_TYPES", () => {
  it("has exactly the 8 DB enum values", () => {
    expect(STATUS_REPORT_TYPES).toEqual([
      "still_available",
      "rented",
      "sold",
      "owner_not_renting",
      "price_changed",
      "cannot_contact",
      "wrong_contact",
      "other",
    ]);
  });
});

describe("statusReportTypeLabel", () => {
  it("labels every type", () => {
    expect(statusReportTypeLabel("still_available")).toBe("Still available");
    expect(statusReportTypeLabel("rented")).toBe("Rented");
    expect(statusReportTypeLabel("sold")).toBe("Sold");
    expect(statusReportTypeLabel("owner_not_renting")).toBe("Owner not renting");
    expect(statusReportTypeLabel("price_changed")).toBe("Price changed");
    expect(statusReportTypeLabel("cannot_contact")).toBe("Cannot contact owner");
    expect(statusReportTypeLabel("wrong_contact")).toBe("Wrong contact");
    expect(statusReportTypeLabel("other")).toBe("Other");
  });
});

describe("statusReportStatus label/tone", () => {
  it("maps each status exactly", () => {
    expect(statusReportStatusLabel("pending_review")).toBe("Pending review");
    expect(statusReportStatusLabel("confirmed")).toBe("Confirmed");
    expect(statusReportStatusLabel("rejected")).toBe("Rejected");
    expect(statusReportStatusTone("pending_review")).toBe("warn");
    expect(statusReportStatusTone("confirmed")).toBe("ok");
    expect(statusReportStatusTone("rejected")).toBe("dark");
  });
});

describe("reportEffect", () => {
  it("maps closing reports to a listing status", () => {
    expect(reportEffect("rented")).toEqual({ listingStatus: "rented", touchVerified: false });
    expect(reportEffect("sold")).toEqual({ listingStatus: "sold", touchVerified: false });
    expect(reportEffect("owner_not_renting")).toEqual({ listingStatus: "not_for_rent", touchVerified: false });
  });

  it("still_available only refreshes last_verified_date", () => {
    expect(reportEffect("still_available")).toEqual({ listingStatus: null, touchVerified: true });
  });

  it("has no automatic effect for the follow-up types", () => {
    for (const t of ["price_changed", "cannot_contact", "wrong_contact", "other"] as const) {
      expect(reportEffect(t)).toEqual({ listingStatus: null, touchVerified: false });
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './labels'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/status-reports/labels.ts`:

```typescript
import type { BadgeTone } from "@/lib/ui/badge-tone";
import type { ListingStatus } from "@/lib/listings/status-labels";

export type StatusReportType =
  | "still_available"
  | "rented"
  | "sold"
  | "owner_not_renting"
  | "price_changed"
  | "cannot_contact"
  | "wrong_contact"
  | "other";

export const STATUS_REPORT_TYPES: StatusReportType[] = [
  "still_available",
  "rented",
  "sold",
  "owner_not_renting",
  "price_changed",
  "cannot_contact",
  "wrong_contact",
  "other",
];

const TYPE_LABELS: Record<StatusReportType, string> = {
  still_available: "Still available",
  rented: "Rented",
  sold: "Sold",
  owner_not_renting: "Owner not renting",
  price_changed: "Price changed",
  cannot_contact: "Cannot contact owner",
  wrong_contact: "Wrong contact",
  other: "Other",
};

export function statusReportTypeLabel(type: StatusReportType): string {
  return TYPE_LABELS[type];
}

export type StatusReportStatus = "pending_review" | "confirmed" | "rejected";

const STATUS_LABELS: Record<StatusReportStatus, string> = {
  pending_review: "Pending review",
  confirmed: "Confirmed",
  rejected: "Rejected",
};

const STATUS_TONES: Record<StatusReportStatus, BadgeTone> = {
  pending_review: "warn",
  confirmed: "ok",
  rejected: "dark",
};

export function statusReportStatusLabel(status: StatusReportStatus): string {
  return STATUS_LABELS[status];
}

export function statusReportStatusTone(status: StatusReportStatus): BadgeTone {
  return STATUS_TONES[status];
}

const EFFECTS: Record<StatusReportType, { listingStatus: ListingStatus | null; touchVerified: boolean }> = {
  still_available: { listingStatus: null, touchVerified: true },
  rented: { listingStatus: "rented", touchVerified: false },
  sold: { listingStatus: "sold", touchVerified: false },
  owner_not_renting: { listingStatus: "not_for_rent", touchVerified: false },
  price_changed: { listingStatus: null, touchVerified: false },
  cannot_contact: { listingStatus: null, touchVerified: false },
  wrong_contact: { listingStatus: null, touchVerified: false },
  other: { listingStatus: null, touchVerified: false },
};

export function reportEffect(type: StatusReportType) {
  return EFFECTS[type];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/status-reports/labels.ts src/lib/status-reports/labels.test.ts
git commit -m "feat: add listing status report label and effect helpers"
```

---

### Task 2: SP submits a status report

**Files:**
- Modify: `src/app/(app)/available-listings/[listingId]/actions.ts`
- Modify: `src/app/(app)/available-listings/[listingId]/page.tsx`

**Interfaces:**
- Consumes: `STATUS_REPORT_TYPES`, `statusReportTypeLabel`, `statusReportStatusLabel`, `statusReportStatusTone`, types from `@/lib/status-reports/labels` (Task 1)
- Produces: `export async function submitStatusReport(formData: FormData): Promise<void>`

- [ ] **Step 1: Add the action**

Append to `src/app/(app)/available-listings/[listingId]/actions.ts`:

```typescript
export async function submitStatusReport(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  const listingId = String(formData.get("listingId"));
  const reportType = String(formData.get("reportType"));
  const remarks = String(formData.get("remarks") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.from("listing_status_reports").insert({
    listing_id: listingId,
    reported_by: profile.id,
    report_type: reportType,
    remarks: remarks || null,
  });

  if (error) {
    redirect(`/available-listings/${listingId}?error=report_failed`);
  }

  redirect(`/available-listings/${listingId}?reported=1`);
}
```

- [ ] **Step 2: Add the form card to the detail page**

In `src/app/(app)/available-listings/[listingId]/page.tsx`:

1. Add imports: `STATUS_REPORT_TYPES`, `statusReportTypeLabel`, `type StatusReportType` from `@/lib/status-reports/labels`; and `submitStatusReport` alongside `requestOwnerContact` from `./actions`.
2. Extend `ERROR_MESSAGES` with `report_failed: "Could not send report. Try again."` and `searchParams` type with `reported?: string`; destructure `reported`.
3. Immediately after the closing `</div>` of the "Owner contact" card (the last child of the outer `<div className="max-w-2xl space-y-5">`), add:

```tsx
      <form
        action={submitStatusReport}
        className="space-y-3 rounded-2xl border border-sky-100 bg-white p-5 shadow-sm"
      >
        <input type="hidden" name="listingId" value={listing.id} />
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Report status
        </div>
        {reported ? <p className="text-sm text-sky-700">Report sent — an admin will review it.</p> : null}
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="reportType">
            What did you find?
          </label>
          <select id="reportType" name="reportType" className={FIELD_CLASSES} defaultValue="still_available">
            {STATUS_REPORT_TYPES.map((t) => (
              <option key={t} value={t}>
                {statusReportTypeLabel(t as StatusReportType)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="reportRemarks">
            Remarks
          </label>
          <textarea id="reportRemarks" name="remarks" className={FIELD_CLASSES} />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-sky-600 px-4 py-2 text-base font-medium text-white hover:bg-sky-700"
        >
          Send report
        </button>
      </form>
```

The existing `errorMessage` line inside the owner-contact form branch stays; additionally render `{errorMessage && error === "report_failed" ? ... }` is NOT needed — instead show the report error inside the new card: add `{error === "report_failed" && errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}` directly under the `reported` line, and change the existing owner-contact `errorMessage` display to render only when `error === "request_failed"`.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` — clean. Run: `npm test` — passing.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/available-listings/[listingId]"
git commit -m "feat: let SP submit a listing status report"
```

---

### Task 3: Admin review queue — confirm / reject

**Files:**
- Create: `src/app/(app)/status-reports/page.tsx`
- Create: `src/app/(app)/status-reports/[reportId]/page.tsx`
- Create: `src/app/(app)/status-reports/[reportId]/actions.ts`
- Modify: `src/components/app-shell.tsx`

**Interfaces:**
- Consumes: Task 1 helpers, `todayInMalaysia` from `@/lib/owners/today-my`, `listingStatusLabel`/`listingStatusTone`/`ListingStatus` from `@/lib/listings/status-labels`
- Produces: `confirmStatusReport(formData)`, `rejectStatusReport(formData)`

- [ ] **Step 1: Nav entry**

In `src/components/app-shell.tsx` add to `ADMIN_NAV` after the `/contact-requests` entry: `{ href: "/status-reports", label: "Status reports" },`

- [ ] **Step 2: Actions**

Create `src/app/(app)/status-reports/[reportId]/actions.ts`:

```typescript
"use server";

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { reportEffect, type StatusReportType } from "@/lib/status-reports/labels";
import { todayInMalaysia } from "@/lib/owners/today-my";

export async function confirmStatusReport(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor || (actor.role !== "super_admin" && actor.role !== "area_admin")) {
    redirect("/");
  }

  const reportId = String(formData.get("reportId"));
  const supabase = await createClient();

  const { data: claimed } = await supabase
    .from("listing_status_reports")
    .update({ status: "confirmed", reviewed_by: actor.id, reviewed_at: new Date().toISOString() })
    .eq("id", reportId)
    .eq("status", "pending_review")
    .select("listing_id, report_type")
    .maybeSingle();

  if (!claimed) {
    redirect(`/status-reports/${reportId}?error=already_handled`);
  }

  const effect = reportEffect(claimed.report_type as StatusReportType);
  if (effect.listingStatus || effect.touchVerified) {
    const patch: Record<string, string> = { updated_by: actor.id, updated_at: new Date().toISOString() };
    if (effect.listingStatus) patch.listing_status = effect.listingStatus;
    if (effect.touchVerified) patch.last_verified_date = todayInMalaysia();

    const { error } = await supabase.from("listings").update(patch).eq("id", claimed.listing_id);
    if (error) {
      redirect(`/status-reports/${reportId}?error=apply_failed`);
    }
  }

  redirect(`/status-reports/${reportId}?confirmed=1`);
}

export async function rejectStatusReport(formData: FormData) {
  const actor = await getCurrentProfile();
  if (!actor || (actor.role !== "super_admin" && actor.role !== "area_admin")) {
    redirect("/");
  }

  const reportId = String(formData.get("reportId"));
  const supabase = await createClient();

  const { data: claimed } = await supabase
    .from("listing_status_reports")
    .update({ status: "rejected", reviewed_by: actor.id, reviewed_at: new Date().toISOString() })
    .eq("id", reportId)
    .eq("status", "pending_review")
    .select("id")
    .maybeSingle();

  if (!claimed) {
    redirect(`/status-reports/${reportId}?error=already_handled`);
  }

  redirect(`/status-reports/${reportId}?rejected=1`);
}
```

- [ ] **Step 3: List page**

Create `src/app/(app)/status-reports/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/badge";
import {
  statusReportTypeLabel,
  statusReportStatusLabel,
  statusReportStatusTone,
  type StatusReportType,
  type StatusReportStatus,
} from "@/lib/status-reports/labels";

export default async function StatusReportsPage() {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "area_admin")) {
    redirect("/");
  }

  const supabase = await createClient();
  const { data: reports, error } = await supabase
    .from("listing_status_reports")
    .select(
      "id, report_type, status, created_at, profiles!listing_status_reports_reported_by_fkey(full_name), listings(units(jalan, unit_no, unit_code))",
    )
    .order("created_at", { ascending: false });

  const allRows = reports ?? [];
  const rows = [
    ...allRows.filter((r) => r.status === "pending_review"),
    ...allRows.filter((r) => r.status !== "pending_review"),
  ];
  const pendingCount = allRows.filter((r) => r.status === "pending_review").length;

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-lg font-semibold text-slate-900">Status reports</h1>
        <Badge tone="warn">Pending {pendingCount}</Badge>
      </div>
      {error ? <p className="text-sm text-red-600">Could not load reports: {error.message}</p> : null}

      <div className="rounded-2xl border border-sky-100 bg-white shadow-sm">
        {rows.map((report, i) => (
          <Link
            key={report.id}
            href={`/status-reports/${report.id}`}
            className={`flex items-center gap-4 px-5 py-3.5 hover:bg-sky-50/60 ${
              i === rows.length - 1 ? "" : "border-b border-sky-100"
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">
                {/* @ts-expect-error -- Supabase nested select typing */}
                {report.listings?.units?.jalan} {report.listings?.units?.unit_no} ·{" "}
                {statusReportTypeLabel(report.report_type as StatusReportType)}
              </p>
              <p className="text-sm text-slate-600">
                {/* @ts-expect-error -- Supabase nested select typing */}
                {report.profiles?.full_name} · {report.listings?.units?.unit_code}
              </p>
            </div>
            <Badge tone={statusReportStatusTone(report.status as StatusReportStatus)}>
              {statusReportStatusLabel(report.status as StatusReportStatus)}
            </Badge>
          </Link>
        ))}
        {rows.length === 0 ? <p className="px-5 py-4 text-sm text-slate-600">No status reports.</p> : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Detail page**

Create `src/app/(app)/status-reports/[reportId]/page.tsx`:

```tsx
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/badge";
import {
  statusReportTypeLabel,
  statusReportStatusLabel,
  statusReportStatusTone,
  reportEffect,
  type StatusReportType,
  type StatusReportStatus,
} from "@/lib/status-reports/labels";
import { listingStatusLabel } from "@/lib/listings/status-labels";
import { confirmStatusReport, rejectStatusReport } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  already_handled: "This report was already confirmed or rejected.",
  apply_failed: "Report marked confirmed but the listing could not be updated. Update the listing manually.",
};

export default async function StatusReportDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<{ error?: string; confirmed?: string; rejected?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "area_admin")) {
    redirect("/");
  }

  const { reportId } = await params;
  const { error, confirmed, rejected } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  const supabase = await createClient();
  const { data: report } = await supabase
    .from("listing_status_reports")
    .select(
      "id, listing_id, report_type, remarks, status, profiles!listing_status_reports_reported_by_fkey(full_name), listings(listing_status, units(jalan, unit_no, unit_code))",
    )
    .eq("id", reportId)
    .single();

  if (!report) {
    notFound();
  }

  const effect = reportEffect(report.report_type as StatusReportType);
  const effectText = effect.listingStatus
    ? `Confirming will set the listing to "${listingStatusLabel(effect.listingStatus)}".`
    : effect.touchVerified
      ? "Confirming will refresh the listing's last verified date."
      : "Confirming only marks this report reviewed — follow up on the listing manually.";

  return (
    <div className="max-w-2xl space-y-5">
      <Link className="text-sm text-sky-600" href="/status-reports">
        ← Status reports
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-lg font-semibold text-slate-900">
          {statusReportTypeLabel(report.report_type as StatusReportType)}
        </h1>
        <Badge tone={statusReportStatusTone(report.status as StatusReportStatus)}>
          {statusReportStatusLabel(report.status as StatusReportStatus)}
        </Badge>
      </div>

      <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-600">
          {/* @ts-expect-error -- Supabase nested select typing */}
          {report.listings?.units?.jalan} {report.listings?.units?.unit_no} · {report.listings?.units?.unit_code}
        </p>
        <p className="text-sm text-slate-600">
          {/* @ts-expect-error -- Supabase nested select typing */}
          Reported by {report.profiles?.full_name} · listing is currently {report.listings?.listing_status}
        </p>
        <p className="mt-3 text-slate-900">{report.remarks ?? "No remarks."}</p>

        {confirmed ? <p className="mt-4 text-sm text-sky-700">Confirmed.</p> : null}
        {rejected ? <p className="mt-4 text-sm text-slate-600">Rejected.</p> : null}
        {errorMessage ? <p className="mt-4 text-sm text-red-600">{errorMessage}</p> : null}

        {report.status === "pending_review" ? (
          <>
            <p className="mt-4 text-sm text-slate-600">{effectText}</p>
            <div className="mt-3 flex gap-2">
              <form action={confirmStatusReport}>
                <input type="hidden" name="reportId" value={report.id} />
                <button
                  type="submit"
                  className="rounded-full bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
                >
                  Confirm
                </button>
              </form>
              <form action={rejectStatusReport}>
                <input type="hidden" name="reportId" value={report.id} />
                <button
                  type="submit"
                  className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Reject
                </button>
              </form>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` — clean. Run: `npm test` — passing.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/status-reports" src/components/app-shell.tsx
git commit -m "feat: add admin review queue for listing status reports"
```

---

## Manual Verification (controller-driven, against the live DB)

1. Query the embed used by the admin list directly over REST as the test admin (qualified `profiles!listing_status_reports_reported_by_fkey`) — expect HTTP 200, not PGRST201.
2. In the browser, on `/available-listings/<id>`, submit "Rented" with remarks → "Report sent" message.
3. `/status-reports` lists it Pending; open it → effect text says it will set the listing to Rented.
4. Confirm → "Confirmed."; the listing's `listing_status` is `rented`, a `listing_status_history` row exists, and `/available-listings` no longer lists it.
5. Restore the test listing to `available` via `/listings/<id>` so later tests keep working.
6. Submit a `price_changed` report → confirm → listing status unchanged; submit another → Reject → status `rejected`.

## Self-Review Notes

- **Spec coverage:** spec workflow "RENTED -> listing_status_reports(pending_review), NOT auto-closed" and "Area Admin confirms report -> listing_status_history row + listings.listing_status updated -> disappears from Available Listing automatically". SP call-outcome buttons beyond the 8 DB report types (FOLLOW_UP / NO_ANSWER / OWNER_NOT_INTERESTED) and the aging verification queue are out of scope (Phase 2).
- **Known limitation (accepted, same as contact approval):** if the listing update fails after the claim succeeds, the report stays `confirmed` and the admin sees `apply_failed`.
- **Type consistency:** field names `listingId`/`reportType`/`remarks` (Task 2 form ↔ action) and `reportId` (Task 3 forms ↔ actions) match.
