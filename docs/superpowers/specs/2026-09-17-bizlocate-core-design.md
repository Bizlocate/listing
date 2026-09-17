# Bizlocate Listing Control & Property Inventory System — Core Design

Date: 2026-09-17
Status: Approved (Phase 1 scope)

## Context

Internal web app for Bizlocate (commercial shoplot property agency), replacing
Google Sheets + WhatsApp operations. Greenfield project — no existing code.
Full property lifecycle: Discover Unit → Find Owner → Verify Owner → Create
Listing → Distribute → Request Owner Contact → Contact Owner → Update Listing
→ Verify Status → Rented/Closed → Reactivate.

## 1. Architecture

- **Frontend/Backend**: Next.js (App Router), mobile-first responsive — one
  codebase for SP mobile workflow and Admin desktop workflow.
- **Data/Auth/Storage**: Supabase (Postgres, Auth, Storage, Row Level
  Security).
- **Hosting**: Netlify (may change later — no hosting-specific code lock-in,
  Next.js runs on Netlify via their Next.js runtime).
- **No message broker**: "queue-based workflow" implemented as DB status
  columns + filtered views/queries (`owner_search_tasks.status`,
  `verification_tasks.status`, etc.), not a separate queue service.
- Sensitive owner data (owners table, unit_documents, contact_access_logs)
  is only ever queried server-side (Next.js server actions / route handlers)
  gated by role + RLS. SP-facing queries hit views/selects that never
  include owner columns — enforced at the query level, not hidden via CSS.

## 2. Database ERD

```
areas ──< sub_areas ──< units ──< unit_spaces
                          │            │
                          │            └──< unit_ownerships >── owners
                          └──< unit_ownerships (space_id null = whole unit)
units ──< unit_photos
units ──< unit_documents (restricted: IC/hakmilik, not exposed to SP)
units ──< listings >── unit_spaces (space_id nullable)
listings ──< listing_status_history
listings ──< contact_requests ──< contact_access_logs
listings ──< verification_tasks
listings ──< listing_status_reports
listings ──< saved_listings >── profiles
units ──< unit_submissions (pre-unit intake, may link to existing unit)
units ──< owner_search_tasks
campaigns ──< campaign_targets >── owners, units
profiles ──< notifications
profiles ──< area_admins >── areas (multi-area assignment junction)
(any entity) ──< activities (human-readable timeline)
(any entity) ──< audit_logs (immutable, admin-only, compliance)
```

### Table definitions

**profiles** — 1:1 with `auth.users`. `id`, `full_name`, `phone`, `role`
enum(`super_admin`,`area_admin`,`sp`), `status`, `created_at`.

**area_admins** — junction for multi-area assignment. `profile_id`,
`area_id`.

**areas** — `id`, `name`, `status`.

**sub_areas** — `id`, `area_id`, `name`, `population`, `consumer_type`,
`commercial_profile`, `remarks`. Population/consumer_type live here only —
units inherit, never duplicated per-unit.

**units** — permanent property inventory, never deleted.
`id`, `unit_code` (e.g. `SET-DK-000001`), `sub_area_id`, `jalan`, `unit_no`,
`full_address`, `lat`, `lng`, `facing`, `property_type`, `land_type`,
`tenure`, `tenure_years`, `cf`, `iwk`, `hakmilik`, `unit_size`,
`unit_size_type`, `location_url`, `banner_status`, `remarks`, `status`
(active/archived), `created_by`, `created_at`, `updated_by`, `updated_at`.

**unit_spaces** — floor-level split, flexible (not hardcoded GF/1st/2nd).
`id`, `unit_id`, `floor_type`, `floor_label`, `size`, `size_type`,
`separate_owner` bool, `status`, `remarks`.

**unit_photos** — `id`, `unit_id`, `space_id` (nullable), `url`,
`photo_type` (cover/property/banner), `created_by`, `created_at`.

**unit_documents** — `id`, `unit_id`, `doc_type` (ic/hakmilik/other), `url`,
`uploaded_by`, `created_at`, `restricted` bool. Stricter RLS than
unit_photos — never exposed to SP role.

**owners** — sensitive PII, never sent to SP client.
`id`, `name`, `primary_contact`, `other_contact`, `ic_or_company_no`,
`owner_type`, `verification_status` (Unverified/Possible Owner/Verified
Owner/Wrong Contact), `contact_status` (Not Contacted/No Answer/Contacted/
Follow Up/Wrong Number/Do Not Contact), `remarks`, `created_by`,
`created_at`, `last_verified_date`.

**unit_ownerships** — owner↔unit/space link, supports per-floor different
owner and ownership history. `id`, `unit_id`, `space_id` (nullable = whole
unit), `owner_id`, `is_primary`, `start_date`, `end_date` (nullable).

**unit_submissions** — SP "discovered unit" intake (fast mobile form).
`id`, `submitted_by`, `area_id`, `sub_area_id`, `jalan`, `unit_no`,
`address`, `lat`, `lng`, `discovery_type` (Vacant/Banner/Target Unit/Other),
`banner_phone`, `remarks`, `photo_url`, `status` (pending/linked/converted),
`matched_unit_id` (nullable), `created_at`.

**owner_search_tasks** — replaces caller sheet.
`id`, `unit_id`, `space_id` (nullable), `status` (need_search →
number_found → contacting → owner_confirmed, alt: wrong_number /
unable_to_reach / follow_up_later), `assigned_to`, `found_contact`,
`remarks`, `created_at`, `updated_at`.

**listings** — one row per listing cycle; historical listings are never
overwritten, a new cycle = new row.
`id`, `unit_id`, `space_id` (nullable), `listing_type` (rent/sale/
rent_sale), `asking_rental`, `selling_price`, `rented_price`,
`availability`, `listing_status` enum (draft/pending_verification/
available/reserved/rented/sold/owner_occupied/not_for_rent/inactive/
archived), `exclusive` bool, `exclusive_date`, `exclusive_by`,
`banner_status`, `available_from`, `last_verified_date`, `created_by`,
`created_at`, `updated_by`, `updated_at`, `remarks`.

**listing_status_history** — append-only. `id`, `listing_id`,
`old_status`, `new_status`, `changed_by`, `changed_at`, `remarks`.

**price_ranges** — configurable buckets, rental range computed at query
time from `asking_rental`, never manually keyed. `id`, `label`, `min`,
`max`, `sort_order`.

**contact_requests** — `id`, `listing_id`, `requested_by`, `reason` enum
(I Have Tenant/Arrange Viewing/Rental Negotiation/Listing Verification/
Other), `tenant_company`, `business_type`, `budget`, `move_in_date`,
`remarks`, `status` (pending/approved/rejected/expired), `approved_by`,
`approved_at`, `created_at`.

**contact_access_logs** — time-boxed owner contact access, auto-masks
after expiry. `id`, `contact_request_id`, `user_id`, `owner_id`, `unit_id`,
`listing_id`, `reason`, `approved_by`, `approval_date`, `access_start`,
`access_expiry`, `revoked` bool.

**verification_tasks** — admin-assigned aging checks. `id`, `listing_id`,
`assigned_to`, `status` (pending/done), `due_date`, `created_at`,
`completed_at`.

**listing_status_reports** — SP-reported outcome, pending admin
confirmation before `listings.listing_status` changes. `id`, `listing_id`,
`reported_by`, `report_type` (still_available/rented/sold/
owner_not_renting/price_changed/cannot_contact/wrong_contact/other),
`remarks`, `status` (pending_review/confirmed/rejected), `reviewed_by`,
`reviewed_at`, `created_at`.

**activities** — human-readable unit/listing timeline, visible within role
scope. `id`, `entity_type`, `entity_id`, `action`, `actor_id`,
`created_at`.

**audit_logs** — immutable, admin-only, compliance-grade. Kept separate
from `activities` because access rules differ (Super Admin / relevant Area
Admin only) and retention/edit rules are stricter. `id`, `action`,
`user_id`, `entity_type`, `entity_id`, `previous_value` (jsonb),
`new_value` (jsonb), `created_at`.

**campaigns** / **campaign_targets** — owner blasting.
`campaigns`: `id`, `name`, `area_id`, `sub_area_id`, `criteria` (jsonb),
`status`, `created_by`, `created_at`.
`campaign_targets`: `id`, `campaign_id`, `owner_id`, `unit_id`, `response`
(available/rented/maybe_soon/no_reply/wrong_number/do_not_contact),
`responded_at`, `converted_listing_id` (nullable).

**saved_listings** — `id`, `profile_id`, `listing_id`, `created_at`.

**notifications** — `id`, `profile_id`, `type`, `title`, `body`,
`entity_type`, `entity_id`, `read_at`, `created_at`.

**Available Listing** is a **view** (`where listing_status = 'available'`),
not a copied table — always in sync with `listings` automatically.

### RLS / Security notes

- Row Level Security enforced in Postgres, keyed off `profiles.role` and
  `area_admins` assignment — not just UI-level hiding.
- `owners`, `unit_documents`, `contact_access_logs`: no SELECT policy for
  `sp` role at all. Bulk export restricted to `super_admin` only.
- SP-facing listing queries select from a view/RPC that excludes owner
  columns entirely — nothing sensitive ever reaches the SP browser to hide.
- Global search: `sp` role can only search listing/unit identifiers, never
  owner name/phone (enforced server-side, not just UI filtering).

## 3. Role Permission Matrix

| Capability | Super Admin | Area Admin (own area) | SP |
|---|---|---|---|
| View all areas | Yes | No (own only) | No |
| View owner PII | Yes | Yes (own area) | No, never |
| Bulk export owner data | Yes, only role | No | No |
| Create/edit units | Yes | Yes (own area) | No (submit only) |
| Submit unit (discovery) | Yes | Yes | Yes |
| Manage owner search queue | Yes | Yes (own area) | No |
| Approve contact request | Yes | Yes (own area) | No |
| Request owner contact | Yes | Yes | Yes (time-boxed) |
| View available listings | Yes | Yes | Yes |
| Verify listing status | Yes | Yes | Reports only, admin confirms |
| Manage users / assign area admin | Yes, only role | No | No |
| View audit logs | Yes | No | No |
| Global search by owner name/phone | Yes | Yes (own area) | No |

## 4. End-to-End Workflow

```
SP: Submit Unit (photo, address, discovery_type)
  -> duplicate check (area/sub_area/jalan/unit_no/address/lat-lng)
     match found -> link to existing unit (confirm required, never auto-merge)
     no match -> create Pending Unit + auto-create owner_search_task(need_search)

Area Admin: Owner Search Queue
  need_search -> number_found -> contacting -> owner_confirmed (= Verified Owner)
  alt outcomes: wrong_number / unable_to_reach / follow_up_later
  -> create unit_ownership row

Area Admin: Create Listing (reuses existing unit/space, no re-key)
  status: draft -> pending_verification -> available
  -> auto-appears in Available Listing view

SP: browse Available Listings -> Request Owner Contact (reason required)
Area Admin: Approve/Reject -> contact_access_logs row, 24/48h expiry,
  phone auto-masks again after expiry

SP: call outcome buttons -> AVAILABLE / FOLLOW_UP / RENTED / NO_ANSWER /
  WRONG_NUMBER / OWNER_NOT_INTERESTED
  RENTED -> listing_status_reports(pending_review), NOT auto-closed

Area Admin: confirms report -> listing_status_history row +
  listings.listing_status updated -> disappears from Available Listing
  automatically

Aging: last_verified_date > 30/45 days (configurable) -> verification_tasks
  auto-queued, assignable to SP

Every step -> activities row (unit timeline) + audit_logs row where
  sensitive/critical (owner created/changed, contact approved, status
  changed, permission changed, etc.)

Reactivation: unit stays in `units` permanently even when rented. A future
  listing cycle = a new `listings` row against the same unit/space.
```

## 5. Google Sheet → New Schema Migration Mapping

No data migrated yet — mapping only, for future reference.

| Old Column | New Table.Field |
|---|---|
| ID | `units.unit_code` (regenerated, e.g. SET-DK-000001) |
| Area | `areas.name` (via `sub_areas.area_id`) |
| Sub Area | `sub_areas.name` |
| Jalan | `units.jalan` |
| Unit No | `units.unit_no` |
| GF / Ground/1st / 1st Rental / 2nd Rental | `unit_spaces` rows (one per floor) + `listings.asking_rental` per space |
| Price Range | computed from `price_ranges` config at query time, not stored per-unit |
| Selling Price | `listings.selling_price` |
| Rented Price | `listings.rented_price` |
| ROI | computed (Annual Gross Rental Yield = Monthly Rental × 12 / Selling Price × 100), not stored |
| Facing | `units.facing` |
| Type | `units.property_type` |
| Size / Unit Size Type | `units.unit_size` / `units.unit_size_type` (or `unit_spaces.size` if per-floor) |
| Area Population / Consumer Type | `sub_areas.population` / `sub_areas.consumer_type` (deduped, inherited) |
| Tenure / Years | `units.tenure` / `units.tenure_years` |
| CF / IWK / HAKMILIK | `units.cf` / `units.iwk` / `units.hakmilik` |
| Land Type | `units.land_type` |
| Status | `listings.listing_status` (listing-level, not unit-level) |
| Contact / Name / IC No / Other Contact | `owners.primary_contact` / `owners.name` / `owners.ic_or_company_no` / `owners.other_contact` |
| Remark | split by context: `units.remarks` / `owners.remarks` / `listings.remarks` |
| Unit's Photo | `unit_photos` |
| Unit's Location | `units.lat` / `units.lng` + `units.location_url` |
| Banner Status | `units.banner_status` (or `listings.banner_status` if listing-specific) |
| Exclusive Date / By | `listings.exclusive_date` / `listings.exclusive_by` |
| Update Date / By | `units.updated_at`/`updated_by` or `listings.updated_at`/`updated_by`, whichever changed |

## 6. Phase 1 Implementation Plan

Build order (each step usable/testable before moving to the next):

1. Supabase project setup — full schema + RLS policies for all tables above.
2. Auth + `profiles` + role system + `area_admins` assignment.
3. Areas / Sub-areas CRUD (Super Admin).
4. Units + Unit Spaces CRUD (Area Admin, scoped to assigned areas).
5. Owners + Unit Ownerships (Area Admin only, RLS-locked from SP).
6. Submit Unit (SP mobile form) + duplicate-check logic.
7. Owner Search Queue (Area Admin).
8. Listings + Available Listing view (auto-derived, SP-safe columns only).
9. Contact Request -> Approval -> time-boxed Contact Access (+ auto-expiry
   mask, access log).
10. Call outcome buttons + Listing Status Report -> Admin confirm ->
    `listing_status_history`.
11. Unit Timeline (`activities`) + `audit_logs` wiring on every write above.
12. SP mobile nav (Home/Available/Submit/Tasks/Saved/Notifications) + Admin
    desktop nav (Dashboard/Work Queue/Units/Owner Search/Listings/Contact
    Requests/Verification/Campaigns/Users/Reports).

Phase 1 complete = fully usable without WhatsApp/Sheets for the core
lifecycle. Phase 2 (Admin Work Queue, Listing Aging, Data Health,
Notifications, Approval Rules) and Phase 3 (Campaigns, WhatsApp
integration, Tenant matching, analytics) deferred per spec — do not build
before Phase 1 core is stable.

## UI

Light theme, white background, sky-blue accents, professional internal
SaaS look. Minimal animation, prioritize speed/clarity. Status badges
visually distinct. Desktop (Admin) and mobile (SP) both first-class.
