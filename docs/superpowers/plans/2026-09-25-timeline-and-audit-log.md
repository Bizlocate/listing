# Timeline + Audit Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every meaningful change is recorded automatically. (1) A per-unit **Timeline** tab (activities: unit created, space added, owner linked, listing created / status changed, contact requested / access granted / revoked, status reported / reviewed, …) visible to admins. (2) A super_admin-only **Audit Log** page for sensitive changes (owner created/changed, contact access, listing status, user role, area-admin assignment) with previous/new values.

**Architecture:** Recording is done by **Postgres triggers** (security definer, same precedent as the existing `trg_listing_status_history`), not by app code — so nothing can be forgotten, no existing server action changes, and the client can no longer write fake log rows: the existing `activities_insert_self` / `audit_logs_insert_self` policies (which let any user insert rows claiming to be themselves) are dropped. One new migration `0008`; two small pure helpers (TDD); two UI surfaces.

**Tech Stack:** Postgres triggers/plpgsql, Next.js Server Components, Supabase, Tailwind, Vitest.

## Important Context

- Spec: "Every step -> activities row (unit timeline) + audit_logs row where sensitive/critical (owner created/changed, contact approved, status changed, permission changed, etc.)". `activities` = admin-browsable timeline; `audit_logs` = immutable, super_admin only (existing RLS: `audit_logs_select_super_admin`, no update/delete policy).
- Existing schema (already deployed): `activities(id, entity_type text not null, entity_id uuid not null, action text not null, actor_id uuid → profiles, created_at)`, `audit_logs(id, action text not null, user_id → profiles, entity_type text not null, entity_id uuid, previous_value jsonb, new_value jsonb, created_at)`. RLS: `activities_select_admin` (super_admin or role area_admin), `audit_logs_select_super_admin`. Nothing in `src/` writes to either table today (verified by grep).
- The migration adds two columns to `activities`: `unit_id uuid` (deliberately **no foreign key**, so history survives if a unit is ever deleted) and `detail text`.
- `profiles_select` currently lets an area_admin see only their own profile row, so actor names (and reporter/requester names on `/contact-requests`, `/status-reports`) come back blank for area admins. The migration widens it to `id = auth.uid() or is_super_admin() or current_role() = 'area_admin'` (admins can read all profiles; SPs still only their own). Implementer: confirm from `supabase/migrations/0001_phase1_schema.sql` that `profiles` holds no sensitive columns beyond id/full_name/role/created_at before keeping this; if it does, drop this one statement and report.
- **Blast radius warning:** these triggers fire on writes to core tables. A bug in trigger SQL would make unit/listing/owner writes fail. The SQL below was written against the actual column names; the reviewer must verify every `r->>'column'` exists on the table it applies to. The controller will exercise create/update flows in the browser immediately after the user runs the migration.
- PostgREST lesson: `activities.actor_id` and `audit_logs.user_id` each have a single FK to `profiles`, so the bare `profiles(full_name)` embed is unambiguous here. Surface query `error` on any new list page instead of ignoring it.

## Global Constraints

- Action strings are `<table>.<insert|update|delete>` (e.g. `listings.update`); status transitions put `old -> new` (ASCII arrow) in `detail`; access-log revocation puts `revoked` in `detail`.
- No-op updates (row unchanged) log nothing. `profiles` updates are audited only when `role` changed; `listings`, `contact_requests`, `listing_status_reports` updates are audited only when their status changed.
- Timestamps displayed in `Asia/Kuala_Lumpur`.
- Light theme, white background, sky-blue accents.

---

## File Structure

- `src/lib/activity/describe.ts` (+ `describe.test.ts`) — `describeActivity(action, detail)`, `changedKeys(prev, next)`.
- `supabase/migrations/0008_activity_and_audit_triggers.sql` — new.
- `src/components/unit-detail-tabs.tsx` — modify: add a 5th `timeline` tab.
- `src/app/(app)/units/[unitId]/page.tsx` — modify: fetch activities, pass `timeline` panel.
- `src/app/(app)/admin/audit-log/page.tsx` — new: super_admin audit log.
- `src/components/app-shell.tsx` — modify: add `/admin/audit-log` to `USERS_AREAS_NAV`.

---

### Task 1: Activity description helpers

**Files:**
- Create: `src/lib/activity/describe.ts`
- Test: `src/lib/activity/describe.test.ts`

**Interfaces:**
- Produces: `describeActivity(action: string, detail: string | null): string`
- Produces: `changedKeys(prev: Record<string, unknown> | null, next: Record<string, unknown> | null): string[]`

- [ ] **Step 1: Write the failing test**

Create `src/lib/activity/describe.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { describeActivity, changedKeys } from "./describe";

describe("describeActivity", () => {
  it("labels known actions", () => {
    expect(describeActivity("units.insert", null)).toBe("Unit created");
    expect(describeActivity("unit_spaces.insert", null)).toBe("Space added");
    expect(describeActivity("unit_ownerships.insert", null)).toBe("Owner linked");
    expect(describeActivity("listings.insert", null)).toBe("Listing created");
    expect(describeActivity("contact_requests.insert", null)).toBe("Owner contact requested");
    expect(describeActivity("contact_access_logs.insert", null)).toBe("Owner contact access granted");
    expect(describeActivity("listing_status_reports.insert", null)).toBe("Status reported");
    expect(describeActivity("owners.update", null)).toBe("Owner updated");
    expect(describeActivity("profiles.update", null)).toBe("User role changed");
    expect(describeActivity("area_admins.insert", null)).toBe("Area admin assigned");
  });

  it("appends detail when present", () => {
    expect(describeActivity("listings.update", "available -> rented")).toBe(
      "Listing updated: available -> rented",
    );
    expect(describeActivity("contact_access_logs.update", "revoked")).toBe(
      "Owner contact access changed: revoked",
    );
  });

  it("falls back to the raw action for unknown actions", () => {
    expect(describeActivity("mystery.insert", null)).toBe("mystery.insert");
  });
});

describe("changedKeys", () => {
  it("returns sorted keys whose values differ", () => {
    expect(changedKeys({ a: 1, b: 2, c: 3 }, { a: 1, b: 9, c: 4 })).toEqual(["b", "c"]);
  });

  it("treats nested objects by value", () => {
    expect(changedKeys({ a: { x: 1 } }, { a: { x: 1 } })).toEqual([]);
    expect(changedKeys({ a: { x: 1 } }, { a: { x: 2 } })).toEqual(["a"]);
  });

  it("handles inserts and deletes (one side null)", () => {
    expect(changedKeys(null, { b: 1, a: 2 })).toEqual(["a", "b"]);
    expect(changedKeys({ b: 1, a: 2 }, null)).toEqual(["a", "b"]);
    expect(changedKeys(null, null)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test` — Expected: FAIL, `Cannot find module './describe'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/activity/describe.ts`:

```typescript
const LABELS: Record<string, string> = {
  "units.insert": "Unit created",
  "units.update": "Unit updated",
  "units.delete": "Unit deleted",
  "unit_spaces.insert": "Space added",
  "unit_spaces.update": "Space updated",
  "unit_spaces.delete": "Space removed",
  "unit_ownerships.insert": "Owner linked",
  "unit_ownerships.update": "Owner link updated",
  "unit_ownerships.delete": "Owner unlinked",
  "listings.insert": "Listing created",
  "listings.update": "Listing updated",
  "listings.delete": "Listing deleted",
  "owner_search_tasks.insert": "Owner search started",
  "owner_search_tasks.update": "Owner search updated",
  "owner_search_tasks.delete": "Owner search removed",
  "unit_submissions.insert": "Unit submitted",
  "unit_submissions.update": "Submission reviewed",
  "contact_requests.insert": "Owner contact requested",
  "contact_requests.update": "Contact request updated",
  "contact_access_logs.insert": "Owner contact access granted",
  "contact_access_logs.update": "Owner contact access changed",
  "listing_status_reports.insert": "Status reported",
  "listing_status_reports.update": "Status report reviewed",
  "owners.insert": "Owner created",
  "owners.update": "Owner updated",
  "owners.delete": "Owner deleted",
  "profiles.insert": "User created",
  "profiles.update": "User role changed",
  "area_admins.insert": "Area admin assigned",
  "area_admins.delete": "Area admin removed",
};

export function describeActivity(action: string, detail: string | null): string {
  const base = LABELS[action] ?? action;
  return detail ? `${base}: ${detail}` : base;
}

export function changedKeys(
  prev: Record<string, unknown> | null,
  next: Record<string, unknown> | null,
): string[] {
  const keys = new Set([...Object.keys(prev ?? {}), ...Object.keys(next ?? {})]);
  return [...keys]
    .filter((k) => JSON.stringify(prev?.[k]) !== JSON.stringify(next?.[k]))
    .sort();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/activity/describe.ts src/lib/activity/describe.test.ts
git commit -m "feat: add activity description helpers"
```

---

### Task 2: Activity + audit triggers migration

**Files:**
- Create: `supabase/migrations/0008_activity_and_audit_triggers.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0008_activity_and_audit_triggers.sql` (match the header-comment style of `0005_*.sql`; the user runs it manually in the Supabase SQL Editor — do NOT try to run it):

```sql
-- Timeline (activities) + Audit Log written by triggers, not by app code.
-- Clients can no longer insert rows into either table (the old *_insert_self
-- policies let any user log fake entries); security-definer triggers write them.

alter table public.activities add column unit_id uuid;  -- no FK: history outlives a deleted unit
alter table public.activities add column detail text;
create index on public.activities (unit_id, created_at desc);

drop policy "activities_insert_self" on public.activities;
drop policy "audit_logs_insert_self" on public.audit_logs;

-- admins need to see names of other users (timeline actor, requester, reporter)
drop policy "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select
  using (id = auth.uid() or public.is_super_admin() or public.current_role() = 'area_admin');

create or replace function public.log_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  n jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  o jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  r jsonb := coalesce(n, o);
  status_col text := case tg_table_name
    when 'listings' then 'listing_status'
    when 'units' then 'status'
    when 'owner_search_tasks' then 'status'
    when 'contact_requests' then 'status'
    when 'listing_status_reports' then 'status'
    when 'unit_submissions' then 'status'
  end;
  v_unit uuid;
  v_detail text;
begin
  if tg_op = 'UPDATE' and n = o then
    return null;
  end if;

  v_unit := case tg_table_name
    when 'units' then (r->>'id')::uuid
    when 'unit_submissions' then (r->>'matched_unit_id')::uuid
    when 'contact_requests' then (select l.unit_id from public.listings l where l.id = (r->>'listing_id')::uuid)
    when 'listing_status_reports' then (select l.unit_id from public.listings l where l.id = (r->>'listing_id')::uuid)
    else (r->>'unit_id')::uuid
  end;

  if tg_op = 'UPDATE' and status_col is not null and o->>status_col is distinct from n->>status_col then
    v_detail := (o->>status_col) || ' -> ' || (n->>status_col);
  elsif tg_op = 'UPDATE' and tg_table_name = 'contact_access_logs'
        and n->>'revoked' = 'true' and o->>'revoked' <> 'true' then
    v_detail := 'revoked';
  end if;

  insert into public.activities (entity_type, entity_id, action, actor_id, unit_id, detail)
  values (tg_table_name, (r->>'id')::uuid, tg_table_name || '.' || lower(tg_op), auth.uid(), v_unit, v_detail);
  return null;
end;
$$;

create or replace function public.log_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  n jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  o jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  r jsonb := coalesce(n, o);
begin
  if tg_op = 'UPDATE' then
    if n = o then return null; end if;
    if tg_table_name = 'profiles' and o->>'role' is not distinct from n->>'role' then return null; end if;
    if tg_table_name = 'listings' and o->>'listing_status' is not distinct from n->>'listing_status' then return null; end if;
    if tg_table_name in ('contact_requests', 'listing_status_reports')
       and o->>'status' is not distinct from n->>'status' then return null; end if;
  end if;

  insert into public.audit_logs (action, user_id, entity_type, entity_id, previous_value, new_value)
  values (tg_table_name || '.' || lower(tg_op), auth.uid(), tg_table_name, (r->>'id')::uuid, o, n);
  return null;
end;
$$;

create trigger trg_log_activity after insert or update or delete on public.units
  for each row execute function public.log_activity();
create trigger trg_log_activity after insert or update or delete on public.unit_spaces
  for each row execute function public.log_activity();
create trigger trg_log_activity after insert or update or delete on public.unit_ownerships
  for each row execute function public.log_activity();
create trigger trg_log_activity after insert or update or delete on public.listings
  for each row execute function public.log_activity();
create trigger trg_log_activity after insert or update or delete on public.owner_search_tasks
  for each row execute function public.log_activity();
create trigger trg_log_activity after insert or update or delete on public.unit_submissions
  for each row execute function public.log_activity();
create trigger trg_log_activity after insert or update or delete on public.contact_requests
  for each row execute function public.log_activity();
create trigger trg_log_activity after insert or update or delete on public.contact_access_logs
  for each row execute function public.log_activity();
create trigger trg_log_activity after insert or update or delete on public.listing_status_reports
  for each row execute function public.log_activity();

create trigger trg_log_audit after insert or update or delete on public.owners
  for each row execute function public.log_audit();
create trigger trg_log_audit after insert or update or delete on public.unit_ownerships
  for each row execute function public.log_audit();
create trigger trg_log_audit after insert or update or delete on public.contact_access_logs
  for each row execute function public.log_audit();
create trigger trg_log_audit after insert or update or delete on public.contact_requests
  for each row execute function public.log_audit();
create trigger trg_log_audit after insert or update or delete on public.listings
  for each row execute function public.log_audit();
create trigger trg_log_audit after insert or update or delete on public.listing_status_reports
  for each row execute function public.log_audit();
create trigger trg_log_audit after insert or update or delete on public.profiles
  for each row execute function public.log_audit();
create trigger trg_log_audit after insert or update or delete on public.area_admins
  for each row execute function public.log_audit();
```

- [ ] **Step 2: Self-check against the schema**

For each table with `trg_log_activity`, confirm from `supabase/migrations/0001_phase1_schema.sql` (and 0002/0004 which alter it) that: it has an `id uuid` column; the `else (r->>'unit_id')::uuid` branch applies only to tables that actually have `unit_id` (`unit_spaces`, `unit_ownerships`, `listings`, `owner_search_tasks`, `contact_access_logs`); `unit_submissions` has `matched_unit_id`; `units`, `owner_search_tasks`, `contact_requests`, `listing_status_reports`, `unit_submissions` each have a `status` column and `listings` has `listing_status`. For `trg_log_audit` tables, `area_admins` has no `id` (the `->>'id'` is then null, which `entity_id` allows). Report anything that does not match instead of guessing.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0008_activity_and_audit_triggers.sql
git commit -m "feat: record activities and audit log via triggers"
```

---

### Task 3: Unit Timeline tab

**Files:**
- Modify: `src/components/unit-detail-tabs.tsx`
- Modify: `src/app/(app)/units/[unitId]/page.tsx`

**Interfaces:**
- Consumes: `describeActivity` from `@/lib/activity/describe` (Task 1)

- [ ] **Step 1: Add the tab**

In `src/components/unit-detail-tabs.tsx`: extend `TABS` with `"timeline"`, `TAB_LABELS` with `timeline: "Timeline"`, add a `timeline: React.ReactNode` prop, and include it in the `panels` record.

- [ ] **Step 2: Fetch and render**

In `src/app/(app)/units/[unitId]/page.tsx`, after the existing data fetches, add:

```typescript
const { data: activities, error: activitiesError } = await supabase
  .from("activities")
  .select("id, action, detail, created_at, profiles(full_name)")
  .eq("unit_id", unitId)
  .order("created_at", { ascending: false })
  .limit(50);
```

Build `timelineContent` the same way the other panels are built, and pass `timeline={timelineContent}` to `<UnitDetailTabs>`:

```tsx
const timelineContent = (
  <div>
    {activitiesError ? <p className="text-sm text-red-600">Could not load timeline: {activitiesError.message}</p> : null}
    <ol className="space-y-3">
      {(activities ?? []).map((a) => (
        <li key={a.id} className="border-b border-sky-100 pb-3 last:border-0">
          <p className="font-semibold text-slate-900">{describeActivity(a.action, a.detail)}</p>
          <p className="text-sm text-slate-600">
            {/* @ts-expect-error -- Supabase nested select typing */}
            {a.profiles?.full_name ?? "System"} ·{" "}
            {new Date(a.created_at).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" })}
          </p>
        </li>
      ))}
    </ol>
    {(activities ?? []).length === 0 ? <p className="text-sm text-slate-600">No activity yet.</p> : null}
  </div>
);
```

Add the `describeActivity` import. Keep all other tabs and the `?tab=` deep-link handling unchanged (extend its allowed-values check to include `timeline` if it validates against a list).

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` — clean. Run: `npm test` — passing.

- [ ] **Step 4: Commit**

```bash
git add src/components/unit-detail-tabs.tsx "src/app/(app)/units/[unitId]/page.tsx"
git commit -m "feat: add unit timeline tab"
```

---

### Task 4: Audit Log page (super_admin)

**Files:**
- Create: `src/app/(app)/admin/audit-log/page.tsx`
- Modify: `src/components/app-shell.tsx`

**Interfaces:**
- Consumes: `describeActivity`, `changedKeys` (Task 1); `canManageUsers` from `@/lib/auth/role`

- [ ] **Step 1: Nav entry**

In `src/components/app-shell.tsx`, add `{ href: "/admin/audit-log", label: "Audit log" }` to `USERS_AREAS_NAV`.

- [ ] **Step 2: Page**

Create `src/app/(app)/admin/audit-log/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { canManageUsers } from "@/lib/auth/role";
import { createClient } from "@/lib/supabase/server";
import { describeActivity, changedKeys } from "@/lib/activity/describe";

export default async function AuditLogPage() {
  const profile = await getCurrentProfile();
  if (!profile || !canManageUsers(profile.role)) {
    redirect("/");
  }

  const supabase = await createClient();
  const { data: entries, error } = await supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, previous_value, new_value, created_at, profiles(full_name)")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="max-w-5xl space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Audit log</h1>
      {error ? <p className="text-sm text-red-600">Could not load audit log: {error.message}</p> : null}

      <div className="rounded-2xl border border-sky-100 bg-white shadow-sm">
        {(entries ?? []).map((e, i, all) => {
          const keys = changedKeys(e.previous_value, e.new_value);
          return (
            <div key={e.id} className={`px-5 py-3.5 ${i === all.length - 1 ? "" : "border-b border-sky-100"}`}>
              <p className="font-semibold text-slate-900">{describeActivity(e.action, null)}</p>
              <p className="text-sm text-slate-600">
                {/* @ts-expect-error -- Supabase nested select typing */}
                {e.profiles?.full_name ?? "System"} ·{" "}
                {new Date(e.created_at).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" })} ·{" "}
                {e.entity_type} {e.entity_id ? String(e.entity_id).slice(0, 8) : ""}
              </p>
              {e.action.endsWith(".update") && keys.length > 0 ? (
                <p className="text-sm text-slate-500">Changed: {keys.join(", ")}</p>
              ) : null}
            </div>
          );
        })}
        {(entries ?? []).length === 0 ? <p className="px-5 py-4 text-sm text-slate-600">No audit entries yet.</p> : null}
      </div>
    </div>
  );
}
```

`canManageUsers` is the existing super_admin-only predicate in `src/lib/auth/role.ts` (used for the Users/Areas nav) — verify its signature (`(role: Role) => boolean`) and adapt the call if it differs.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` — clean. Run: `npm test` — passing.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/admin/audit-log" src/components/app-shell.tsx
git commit -m "feat: add super admin audit log page"
```

---

## Manual Verification (controller-driven, after the user runs 0008)

1. Immediately after 0008: create a space on a unit, update a listing status, add an owner — confirm none of these writes error (trigger blast-radius check).
2. Open that unit's Timeline tab — confirm entries appear with correct labels, actor name, Malaysia time, and `old -> new` detail for the status change.
3. `/admin/audit-log` (super_admin): confirm owner insert, listing status change appear with a "Changed:" line on updates; confirm no entry for a plain non-status listing edit.
4. Verify over REST as the test admin that a direct `POST /rest/v1/activities` and `/audit_logs` insert is now rejected (RLS), and `GET /rest/v1/profiles` still works.
5. Confirm area-admin-visible names are no longer blank (profiles policy) if an area_admin session is available; otherwise verify the policy text only.

## Self-Review Notes

- **Spec coverage:** "Every step -> activities row (unit timeline) + audit_logs row where sensitive/critical". Historical events before this migration are not backfilled (out of scope). SP-facing timeline, timeline for owners (no unit_id), and per-entity audit views are out of scope.
- **Accepted:** `audit_logs.new_value/previous_value` for `owners` includes IC/company number — readable by super_admin only (existing RLS); an `unit_submissions` row appears on a unit timeline only once `matched_unit_id` is set.
- **Type consistency:** action strings emitted by SQL (`<table>.<op>`) are exactly the keys in `LABELS`.
