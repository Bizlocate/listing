# Admin UI Shell — Design

Date: 2026-09-18
Status: Approved
Related: [2026-09-17-bizlocate-core-design.md](2026-09-17-bizlocate-core-design.md)

## Context

Source: a claude.ai/design mockup (`Bizlocate Mockups.dc.html`, Modernist
design system, sky-blue/white theme, 15 screens covering the full admin +
salesperson lifecycle) exported and reviewed against this codebase.

**Revision note (2026-09-18):** this spec was originally written against
an earlier snapshot of the codebase (auth + a placeholder home page +
`admin/users` only). Between that snapshot and implementation, real
Phase 1 work landed on `main`: functional `units`, `units/[unitId]`,
`owners`, `owners/[ownerId]`, `admin/areas`, `admin/areas/[areaId]`
pages, all with real Supabase queries, real create forms (server
actions), and real role/area-scoped access checks (see
`docs/superpowers/plans/2026-09-17-areas-and-units.md` and
`2026-09-17-area-admin-assignment-and-owners.md`). The route table and
scope below are corrected for that reality — the earlier draft would
have replaced working functionality with mock-data stand-ins at the
same paths, which is wrong. The full Phase 1 DB schema
(`supabase/migrations/0001_phase1_schema.sql` through `0004_...sql`) is
migrated to a real Supabase project (`urexerwpcwbfhsyqdien
.supabase.co`) with 43 RLS policies.

This spec covers **Admin desktop screens only** (9 of the 15 mockup
screens). Salesperson mobile screens (Browse, Submit unit, Request
contact, Call outcome) are a separate follow-up spec — deliberately
excluded here to keep this round reviewable, and because the shared nav
shell should not link to routes that don't exist yet (dead links).

## Decision: mock data, not live Supabase, for this round

The schema already exists and is queryable, so wiring real queries was
considered. Decided against it for this round: the goal here is purely
visual — validating the mockup's layout/interaction against the real
codebase — not exercising RLS, role-scoping, or write paths. Mixing "new
visual shell" with "first real queries against a schema that's never been
exercised end-to-end" in one diff makes both harder to review. Real
Supabase wiring (including a seed script) is explicitly deferred to
Phase 1 build order steps 3–4 in the core design doc, as its own round.

Mock data field names mirror the real schema (`unit_code`, `listing_
status`, `contact_requests.reason` enum values, etc.) from
`2026-09-17-bizlocate-core-design.md` §2, so swapping mock arrays for
real Supabase queries later is a data-layer change only — page
components won't need to change shape.

## Decision: reimplement visuals in Tailwind, don't import the mockup's runtime

The exported mockup ships `_ds_bundle.js` / `support.js` / `styles.css` —
these are the claude.ai design tool's own preview runtime (a tiny
`x-dc`/`DCLogic` state-machine component and CSS custom properties), not
production-ready code. It is not React, has no routing, and every "screen"
is really the same DOM tree with a single `state.screen` switch.

Reimplemented as real Next.js routes/components using Tailwind (already
configured, already using a sky-blue palette that matches the mockup's
theme). Visual details (colors, spacing, radii, card/pill/row shapes)
are copied from the mockup's inline styles; the fake state-machine
navigation is replaced with real routing.

## Routes (all under `src/app/(app)/`)

| Route | Mockup screen | Treatment |
|---|---|---|
| `/` | Dashboard | **New content**, replaces current placeholder `page.tsx` — stat tiles, work queue, activity feed, mock data. Only rendered for `super_admin`/`area_admin`; `sp` keeps a minimal placeholder (sp home is next round's problem, not this one's) |
| `/units` | Units | **Reskin only.** Same Supabase query, same data, same `+ New unit` link — table rows become the mockup's card grid |
| `/units/[unitId]` | Unit detail | **Reskin only.** Same query, same `createUnitSpace`/`createOwnerForUnit` server actions, same area-scoped `canManage` check. Wrapped in mockup-style tabs: Overview / Spaces / Owner (client component for tab state). **No Timeline tab** — there's no `activities` query wired up anywhere in the app yet; not adding one here, that's its own future feature, not a UI-shell task |
| `/owners`, `/owners/[ownerId]` | — | **Untouched.** Not one of the mockup's 9 screens (the mockup only shows owner info as a tab inside Unit detail, which links to this page already) |
| `/admin/areas`, `/admin/areas/[areaId]` | — | **Untouched.** The mockup's "Users & areas" screen shows a lightweight area summary card, but real Areas already has its own richer sub-area management flow — not collapsing that into the Users page. Sidebar just links to it from the same nav group as Users |
| `/owner-search` | Owner search | **New**, mock data. This is the `owner_search_tasks` call queue (need_search → number_found → contacting → confirmed) — genuinely unbuilt, no UI exists for this table yet. List + right-side detail panel, single page, client-side selection state |
| `/listings` | Listings | **New**, mock data. No `listings` UI exists yet |
| `/listings/[listingId]` | Listing detail | **New**, mock data. Real id lookup within the mock array, `notFound()` for unknown id |
| `/listings/new` | New listing | **New**, mock data. Static form, submit is a no-op (no backend this round) |
| `/contact-requests` | Contact requests | **New**, mock data. List + approval detail panel, same pattern as owner-search |
| `/verification` | Verification | **New**, mock data. Card grid, no detail view (matches mockup) |
| `/admin/users` | Users & areas | **Reskin only.** Same Supabase query, super_admin gate, `createUser` action — rows become cards/list style |

Salesperson routes (`/browse`, `/submit`, `/contact`, `/outcome`) and the
"Salesperson" nav group are **not** part of this round.

## Shared app shell

New `src/app/(app)/layout.tsx`:
- Left sidebar, collapsible (`⟨` to hide / `☰` to reopen), client
  component for open/closed state (no persistence — resets on reload,
  matches mockup, not worth localStorage for a v1 shell).
- Sidebar shows only the **Admin** nav group this round: Dashboard,
  Units, Owner search, Listings, Contact requests, Verification, Areas,
  Users. Detail pages (Unit detail, Listing detail) aren't separate nav
  items — reached by clicking a card/row, consistent with how real
  navigation should work. "Areas" and "Users" are two separate real
  pages (both untouched/reskinned respectively, see routes table) linked
  from the same nav group, not merged into one page.
- Top bar: search input (visual only, non-functional this round),
  area text, avatar + real `profile.fullName` / `roleLabel(profile.role)`
  (already available via `getCurrentProfile()`).
- Role gate unchanged: still redirects to `/login` if unauthenticated,
  same as current `(app)/layout.tsx`.

## Mock data

`src/lib/mock/` — one file per entity needed by the genuinely-new
screens only (`listings.ts`, `owner-search.ts`, `contact-requests.ts`,
`verification.ts` — Dashboard's work-queue/activity feed pulls from
these same files rather than a 5th file). Plain exported arrays/objects,
field names matching the real schema columns (`listings.listing_status`,
`contact_requests.reason` enum values, etc.) from
`2026-09-17-bizlocate-core-design.md` §2. Content is the same sample
Setapak/Wangsa Maju shoplot data as the mockup. No shared "mock DB"
abstraction, no fake query layer — just arrays and `.find()`, since this
is throwaway-by-design (replaced by real Supabase calls in a later
round, not extended). Units/Owners/Areas/Users pages keep using their
existing real Supabase queries — no mock data involved there.

## Out of scope (explicitly deferred)

- Salesperson mobile screens + nav group (next round).
- Any real Supabase read/write for units/listings/owner-search/contact-
  requests/verification (later round, per core design Phase 1 steps 3+).
- Search bar functionality, filters, "Load more" pagination — visual
  only for now.
- Dialog/approve flow side effects (the mockup's "Approve 48h" dialog is
  rendered but doesn't persist anything).
