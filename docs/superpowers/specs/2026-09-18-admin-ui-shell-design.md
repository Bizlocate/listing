# Admin UI Shell — Design

Date: 2026-09-18
Status: Approved
Related: [2026-09-17-bizlocate-core-design.md](2026-09-17-bizlocate-core-design.md)

## Context

Source: a claude.ai/design mockup (`Bizlocate Mockups.dc.html`, Modernist
design system, sky-blue/white theme, 15 screens covering the full admin +
salesperson lifecycle) exported and reviewed against this codebase.

Current codebase state: auth (login, roles, profiles) is built. `(app)/`
has only a placeholder home page and a functional `admin/users` page
(real Supabase data, no visual polish). The full Phase 1 DB schema
(`supabase/migrations/0001_phase1_schema.sql` through `0004_...sql`) is
already migrated to a real Supabase project (`urexerwpcwbfhsyqdien
.supabase.co`) with 43 RLS policies — but every table is empty and no
admin/listing UI exists yet.

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

| Route | Mockup screen | Notes |
|---|---|---|
| `/` | Dashboard | Replaces current placeholder `page.tsx` |
| `/units` | Units | Card grid, mock list |
| `/units/[unitId]` | Unit detail | Tabs (Overview/Spaces/Owner/Timeline) as client component; 404 via `notFound()` for unknown id |
| `/owner-search` | Owner search | List + right-side detail panel, single page, client-side selection state |
| `/listings` | Listings | List |
| `/listings/[listingId]` | Listing detail | Real id lookup, `notFound()` for unknown id |
| `/listings/new` | New listing | Static form, submit is a no-op (no backend this round) |
| `/contact-requests` | Contact requests | List + approval detail panel, same pattern as owner-search |
| `/verification` | Verification | Card grid, no detail view (matches mockup) |
| `/admin/users` | Users & areas | **Existing page kept as-is functionally** (real Supabase query, super_admin gate, create-user form) — only re-skinned to sit inside the new shell and use card/row visual style instead of a bare `<table>` |

Salesperson routes (`/browse`, `/submit`, `/contact`, `/outcome`) and the
"Salesperson" nav group are **not** part of this round.

## Shared app shell

New `src/app/(app)/layout.tsx`:
- Left sidebar, collapsible (`⟨` to hide / `☰` to reopen), client
  component for open/closed state (no persistence — resets on reload,
  matches mockup, not worth localStorage for a v1 shell).
- Sidebar shows only the **Admin** nav group this round (Dashboard,
  Units, Unit detail, Owner search, Listings, Listing detail, New
  listing, Contact requests, Verification, Users & areas). "Unit detail"
  and "Listing detail" are non-navigable in the mockup (they only appear
  once you're on a specific record) — real version: the sidebar links
  to the list pages only; detail pages are reached by clicking a
  card/row, consistent with how real navigation should work.
- Top bar: search input (visual only, non-functional this round),
  area text, avatar + real `profile.fullName` / `roleLabel(profile.role)`
  (already available via `getCurrentProfile()`).
- Role gate unchanged: still redirects to `/login` if unauthenticated,
  same as current `(app)/layout.tsx`.

## Mock data

`src/lib/mock/` — one file per entity (`units.ts`, `listings.ts`,
`owner-search.ts`, `contact-requests.ts`, `verification.ts`), plain
exported arrays/objects, field names matching the real schema columns.
Content is the same sample Setapak/Wangsa Maju shoplot data as the
mockup. No shared "mock DB" abstraction, no fake query layer — just
arrays and `.find()`, since this is throwaway-by-design (replaced by
real Supabase calls in a later round, not extended).

## Out of scope (explicitly deferred)

- Salesperson mobile screens + nav group (next round).
- Any real Supabase read/write for units/listings/owner-search/contact-
  requests/verification (later round, per core design Phase 1 steps 3+).
- Search bar functionality, filters, "Load more" pagination — visual
  only for now.
- Dialog/approve flow side effects (the mockup's "Approve 48h" dialog is
  rendered but doesn't persist anything).
