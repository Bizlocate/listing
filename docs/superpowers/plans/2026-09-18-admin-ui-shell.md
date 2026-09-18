# Admin UI Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the admin side of the app the sky-blue/card-based shell and 6 net-new screens from the `Bizlocate Mockups.dc.html` design import, while reskinning (not replacing) the Units/Unit-detail/Users pages that already ship real Supabase-backed functionality.

**Architecture:** A client-side `AppShell` component (collapsible sidebar + topbar) wraps `(app)/` routes via `layout.tsx`. Genuinely new screens (Dashboard's stats, Owner search, Listings, Contact requests, Verification) read from small typed mock-data modules under `src/lib/mock/` shaped like the real schema columns. Existing Units/Unit-detail/Users pages keep their exact Supabase queries and server actions — only their JSX/Tailwind classes change.

**Tech Stack:** Next.js 16 App Router (server components + one server action per existing form), React 19, Tailwind v4 (existing `sky`/`slate` palette, extended with `emerald`/`amber` for status tones), Vitest (node environment, no DOM — matches existing test suite, which only tests `.ts` logic modules, never components).

## Global Constraints

- Do not modify Supabase queries, server actions, or role/area-scoping logic in `units`, `units/[unitId]`, or `admin/users` — those are working, reviewed, real functionality (see `docs/superpowers/specs/2026-09-18-admin-ui-shell-design.md` revision note). Only their presentation changes.
- No new npm dependencies — Tailwind (already configured) covers every visual need in the mockup (pills, cards, tabs, collapsible sidebar). No icon library, no UI kit.
- Mock data lives only in `src/lib/mock/`, field names mirror the real schema columns documented in `docs/superpowers/specs/2026-09-17-bizlocate-core-design.md` §2, so a future swap to real Supabase queries is a data-layer change only.
- Every new pure-logic module (mock data lookups/counts, badge tone mapping) gets a Vitest `.test.ts` file, following the existing convention in `src/lib/owners/status-labels.test.ts` — plain `describe`/`it`/`expect`, no mocking framework, no DOM. Page/component JSX is not unit-tested (no test infra for that exists in this repo — consistent with current coverage).
- Salesperson routes/nav (`/browse`, `/submit`, `/contact`, `/outcome`) are out of scope. Do not add nav links to them.
- `/owners`, `/owners/[ownerId]`, `/admin/areas`, `/admin/areas/[areaId]` are untouched this round — link to them from the new sidebar, don't modify their pages.

---

### Task 1: Badge tone helper + Badge component

**Files:**
- Create: `src/lib/ui/badge-tone.ts`
- Test: `src/lib/ui/badge-tone.test.ts`
- Create: `src/components/badge.tsx`

**Interfaces:**
- Produces: `type BadgeTone = "ok" | "warn" | "accent" | "neutral" | "dark"`, `badgeToneClasses(tone: BadgeTone): string`, `<Badge tone={BadgeTone}>{children}</Badge>` (server-renderable, no `"use client"` needed). Every later task that renders a status pill imports `Badge` from `@/components/badge`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/ui/badge-tone.test.ts
import { describe, it, expect } from "vitest";
import { badgeToneClasses } from "./badge-tone";

describe("badgeToneClasses", () => {
  it("returns distinct classes for every tone", () => {
    expect(badgeToneClasses("ok")).toBe("bg-emerald-50 text-emerald-700");
    expect(badgeToneClasses("warn")).toBe("bg-amber-50 text-amber-800");
    expect(badgeToneClasses("accent")).toBe("bg-sky-100 text-sky-800");
    expect(badgeToneClasses("neutral")).toBe("bg-slate-100 text-slate-700");
    expect(badgeToneClasses("dark")).toBe("bg-slate-900 text-white");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ui/badge-tone.test.ts`
Expected: FAIL with "Cannot find module './badge-tone'" (or similar — file doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/ui/badge-tone.ts
export type BadgeTone = "ok" | "warn" | "accent" | "neutral" | "dark";

const TONE_CLASSES: Record<BadgeTone, string> = {
  ok: "bg-emerald-50 text-emerald-700",
  warn: "bg-amber-50 text-amber-800",
  accent: "bg-sky-100 text-sky-800",
  neutral: "bg-slate-100 text-slate-700",
  dark: "bg-slate-900 text-white",
};

export function badgeToneClasses(tone: BadgeTone): string {
  return TONE_CLASSES[tone];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ui/badge-tone.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Add the Badge component (no test — JSX component, matches repo's existing convention of not unit-testing components)**

```tsx
// src/components/badge.tsx
import { badgeToneClasses, type BadgeTone } from "@/lib/ui/badge-tone";

export function Badge({
  tone,
  children,
}: {
  tone: BadgeTone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex flex-none items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${badgeToneClasses(tone)}`}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/ui/badge-tone.ts src/lib/ui/badge-tone.test.ts src/components/badge.tsx
git commit -m "feat: add badge tone helper and Badge component"
```

---

### Task 2: Mock data layer (listings, owner-search, contact-requests, verification)

**Files:**
- Create: `src/lib/mock/listings.ts`, `src/lib/mock/listings.test.ts`
- Create: `src/lib/mock/owner-search.ts`, `src/lib/mock/owner-search.test.ts`
- Create: `src/lib/mock/contact-requests.ts`, `src/lib/mock/contact-requests.test.ts`
- Create: `src/lib/mock/verification.ts`, `src/lib/mock/verification.test.ts`

**Interfaces:**
- Consumes: `type BadgeTone` from `@/lib/ui/badge-tone` (Task 1).
- Produces (consumed by Tasks 4, 8, 9, 10, 11, 12, 13):
  - `MOCK_LISTINGS: MockListing[]`, `getListingById(id: string): MockListing | undefined`, `countListingsByStatus(status: ListingStatus): number`, `LISTING_STATUS_LABEL: Record<ListingStatus, string>`, `LISTING_STATUS_TONE: Record<ListingStatus, BadgeTone>` — defined once here so the listings list (Task 11) and listing detail (Task 12) pages can't drift apart on status→color/label mapping
  - `MOCK_OWNER_SEARCH_TASKS: MockOwnerSearchTask[]`, `getOwnerSearchTaskById(id: string): MockOwnerSearchTask | undefined`, `countOpenOwnerSearchTasks(): number`
  - `MOCK_CONTACT_REQUESTS: MockContactRequest[]`, `getContactRequestById(id: string): MockContactRequest | undefined`, `countPendingContactRequests(): number`
  - `MOCK_VERIFICATION_TASKS: MockVerificationTask[]`, `countAgingVerificationTasks(minDays: number): number`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/mock/listings.test.ts
import { describe, it, expect } from "vitest";
import {
  getListingById,
  countListingsByStatus,
  LISTING_STATUS_LABEL,
  LISTING_STATUS_TONE,
} from "./listings";

describe("getListingById", () => {
  it("finds a listing that exists", () => {
    expect(getListingById("lst-2431")?.code).toBe("LST-2431");
  });

  it("returns undefined for an unknown id", () => {
    expect(getListingById("does-not-exist")).toBeUndefined();
  });
});

describe("countListingsByStatus", () => {
  it("counts available listings", () => {
    expect(countListingsByStatus("available")).toBe(1);
  });

  it("counts reserved listings", () => {
    expect(countListingsByStatus("reserved")).toBe(2);
  });

  it("returns 0 for a status with no matches", () => {
    expect(countListingsByStatus("sold")).toBe(0);
  });
});

describe("LISTING_STATUS_LABEL / LISTING_STATUS_TONE", () => {
  it("has a label and tone for every listing status", () => {
    const statuses = ["draft", "pending_verification", "available", "reserved", "rented", "sold"] as const;
    for (const status of statuses) {
      expect(LISTING_STATUS_LABEL[status]).toBeTruthy();
      expect(LISTING_STATUS_TONE[status]).toBeTruthy();
    }
  });

  it("maps available to the ok tone", () => {
    expect(LISTING_STATUS_TONE.available).toBe("ok");
  });

  it("maps rented to the dark tone", () => {
    expect(LISTING_STATUS_TONE.rented).toBe("dark");
  });
});
```

```ts
// src/lib/mock/owner-search.test.ts
import { describe, it, expect } from "vitest";
import { getOwnerSearchTaskById, countOpenOwnerSearchTasks } from "./owner-search";

describe("getOwnerSearchTaskById", () => {
  it("finds a task that exists", () => {
    expect(getOwnerSearchTaskById("ost-1")?.address).toBe("12A, Jalan Genting Klang");
  });

  it("returns undefined for an unknown id", () => {
    expect(getOwnerSearchTaskById("does-not-exist")).toBeUndefined();
  });
});

describe("countOpenOwnerSearchTasks", () => {
  it("excludes wrong_number tasks", () => {
    expect(countOpenOwnerSearchTasks()).toBe(4);
  });
});
```

```ts
// src/lib/mock/contact-requests.test.ts
import { describe, it, expect } from "vitest";
import { getContactRequestById, countPendingContactRequests } from "./contact-requests";

describe("getContactRequestById", () => {
  it("finds a request that exists", () => {
    expect(getContactRequestById("cr-1")?.requesterName).toBe("Amirul Hakim");
  });

  it("returns undefined for an unknown id", () => {
    expect(getContactRequestById("does-not-exist")).toBeUndefined();
  });
});

describe("countPendingContactRequests", () => {
  it("counts only pending requests", () => {
    expect(countPendingContactRequests()).toBe(2);
  });
});
```

```ts
// src/lib/mock/verification.test.ts
import { describe, it, expect } from "vitest";
import { countAgingVerificationTasks } from "./verification";

describe("countAgingVerificationTasks", () => {
  it("counts tasks at or past the aging threshold", () => {
    expect(countAgingVerificationTasks(45)).toBe(3);
  });

  it("excludes tasks below the threshold", () => {
    expect(countAgingVerificationTasks(50)).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/mock`
Expected: FAIL — none of the modules exist yet.

- [ ] **Step 3: Write the implementations**

```ts
// src/lib/mock/listings.ts
import type { BadgeTone } from "@/lib/ui/badge-tone";

export type ListingStatus =
  | "draft"
  | "pending_verification"
  | "available"
  | "reserved"
  | "rented"
  | "sold";

export const LISTING_STATUS_LABEL: Record<ListingStatus, string> = {
  draft: "Draft",
  pending_verification: "Confirm",
  available: "Available",
  reserved: "Reserved",
  rented: "Rented",
  sold: "Sold",
};

export const LISTING_STATUS_TONE: Record<ListingStatus, BadgeTone> = {
  draft: "neutral",
  pending_verification: "warn",
  available: "ok",
  reserved: "neutral",
  rented: "dark",
  sold: "dark",
};

export interface MockListing {
  id: string;
  code: string;
  unitCode: string;
  address: string;
  spaceLabel: string;
  askingRental: number;
  status: ListingStatus;
  exclusive: boolean;
  availableFrom: string;
  lastVerified: string;
  ownerName: string;
  ownerContactMasked: string;
}

export const MOCK_LISTINGS: MockListing[] = [
  {
    id: "lst-2431",
    code: "LST-2431",
    unitCode: "SET-DK-000412",
    address: "26, Jalan Danau Niaga 3",
    spaceLabel: "Ground floor · 770 sf",
    askingRental: 4800,
    status: "available",
    exclusive: true,
    availableFrom: "1 Oct 2026",
    lastVerified: "2 days ago",
    ownerName: "Lim Wei Keong",
    ownerContactMasked: "+6012-••• ••89",
  },
  {
    id: "lst-2429",
    code: "LST-2429",
    unitCode: "SET-DK-000401",
    address: "8, Taman Bunga Raya 1",
    spaceLabel: "GF + 1st · 1,760 sf",
    askingRental: 7500,
    status: "reserved",
    exclusive: true,
    availableFrom: "15 Sep 2026",
    lastVerified: "6 days ago",
    ownerName: "Chan Yoke Lin",
    ownerContactMasked: "+6013-••• ••02",
  },
  {
    id: "lst-2419",
    code: "LST-2419",
    unitCode: "WM-S2-000188",
    address: "44, Wangsa Delima 5",
    spaceLabel: "1st floor · 820 sf",
    askingRental: 2400,
    status: "pending_verification",
    exclusive: false,
    availableFrom: "Reported rented",
    lastVerified: "1 day ago",
    ownerName: "Chan Y.L.",
    ownerContactMasked: "+6019-••• ••41",
  },
  {
    id: "lst-2402",
    code: "LST-2402",
    unitCode: "WM-S2-000174",
    address: "7, Metro Perdana 8",
    spaceLabel: "Ground floor · 1,980 sf",
    askingRental: 6800,
    status: "reserved",
    exclusive: false,
    availableFrom: "Verified 52 days ago",
    lastVerified: "52 days ago",
    ownerName: "Chan Y.L.",
    ownerContactMasked: "+6012-••• ••17",
  },
  {
    id: "lst-2280",
    code: "LST-2280",
    unitCode: "SET-DK-000407",
    address: "3-1, Jalan Danau Kota 2",
    spaceLabel: "Ground floor · 2,100 sf",
    askingRental: 6200,
    status: "rented",
    exclusive: false,
    availableFrom: "Closed 2 Sep",
    lastVerified: "closed",
    ownerName: "Tan Ah Kow",
    ownerContactMasked: "+6017-••• ••55",
  },
];

export function getListingById(id: string): MockListing | undefined {
  return MOCK_LISTINGS.find((listing) => listing.id === id);
}

export function countListingsByStatus(status: ListingStatus): number {
  return MOCK_LISTINGS.filter((listing) => listing.status === status).length;
}
```

```ts
// src/lib/mock/owner-search.ts
export type OwnerSearchStatus =
  | "need_search"
  | "contacting"
  | "follow_up_later"
  | "wrong_number";

export interface MockOwnerSearchTask {
  id: string;
  address: string;
  status: OwnerSearchStatus;
  note: string;
  assignedTo: string | null;
  foundContact: string | null;
}

export const MOCK_OWNER_SEARCH_TASKS: MockOwnerSearchTask[] = [
  {
    id: "ost-1",
    address: "12A, Jalan Genting Klang",
    status: "contacting",
    note: "Number found · Siti",
    assignedTo: "Siti",
    foundContact: "012-388 4471",
  },
  {
    id: "ost-2",
    address: "5, Jalan Danau Kota 7",
    status: "need_search",
    note: "No number yet · 2 days",
    assignedTo: null,
    foundContact: null,
  },
  {
    id: "ost-3",
    address: "18, Jalan Danau Niaga 2",
    status: "contacting",
    note: "Contacting · Siti",
    assignedTo: "Siti",
    foundContact: "013-772 1180",
  },
  {
    id: "ost-4",
    address: "31, Wangsa Delima 9",
    status: "follow_up_later",
    note: "Call back after 6pm · Chan",
    assignedTo: "Chan",
    foundContact: null,
  },
  {
    id: "ost-5",
    address: "2, Metro Perdana 4",
    status: "wrong_number",
    note: "Banner number is a contractor",
    assignedTo: null,
    foundContact: null,
  },
];

export function getOwnerSearchTaskById(id: string): MockOwnerSearchTask | undefined {
  return MOCK_OWNER_SEARCH_TASKS.find((task) => task.id === id);
}

export function countOpenOwnerSearchTasks(): number {
  return MOCK_OWNER_SEARCH_TASKS.filter((task) => task.status !== "wrong_number").length;
}
```

```ts
// src/lib/mock/contact-requests.ts
export type ContactRequestStatus = "pending" | "approved" | "expired";

export interface MockContactRequest {
  id: string;
  requesterName: string;
  requesterNote: string;
  listingAddress: string;
  reason: string;
  tenantOrCompany: string;
  budget: string;
  status: ContactRequestStatus;
  submittedAgo: string;
}

export const MOCK_CONTACT_REQUESTS: MockContactRequest[] = [
  {
    id: "cr-1",
    requesterName: "Amirul Hakim",
    requesterNote: "34 submissions",
    listingAddress: "Danau Niaga 3, GF",
    reason: "I have a tenant",
    tenantOrCompany: "Kopitiam Sri Danau · F&B",
    budget: "RM 4,500 · move in Oct",
    status: "pending",
    submittedAgo: "3h",
  },
  {
    id: "cr-2",
    requesterName: "Nadia Farhana",
    requesterNote: "joined Aug",
    listingAddress: "Wangsa Delima 5",
    reason: "Arrange viewing",
    tenantOrCompany: "—",
    budget: "—",
    status: "pending",
    submittedAgo: "5h",
  },
  {
    id: "cr-3",
    requesterName: "Jason Lee",
    requesterNote: "negotiation",
    listingAddress: "Metro Perdana 8",
    reason: "Rental negotiation",
    tenantOrCompany: "—",
    budget: "—",
    status: "approved",
    submittedAgo: "yesterday",
  },
  {
    id: "cr-4",
    requesterName: "Suresh Kumar",
    requesterNote: "verification",
    listingAddress: "Danau Kota 2",
    reason: "Listing verification",
    tenantOrCompany: "—",
    budget: "—",
    status: "expired",
    submittedAgo: "2d",
  },
];

export function getContactRequestById(id: string): MockContactRequest | undefined {
  return MOCK_CONTACT_REQUESTS.find((request) => request.id === id);
}

export function countPendingContactRequests(): number {
  return MOCK_CONTACT_REQUESTS.filter((request) => request.status === "pending").length;
}
```

```ts
// src/lib/mock/verification.ts
export interface MockVerificationTask {
  id: string;
  listingCode: string;
  address: string;
  askingRental: number;
  daysSinceVerified: number;
  assignedTo: string | null;
}

export const MOCK_VERIFICATION_TASKS: MockVerificationTask[] = [
  {
    id: "vt-1",
    listingCode: "LST-2402",
    address: "Metro Perdana 8 · GF",
    askingRental: 6800,
    daysSinceVerified: 52,
    assignedTo: "Chan Y.L.",
  },
  {
    id: "vt-2",
    listingCode: "LST-2390",
    address: "Danau Kota 7 · 1st",
    askingRental: 2100,
    daysSinceVerified: 48,
    assignedTo: "Amirul H.",
  },
  {
    id: "vt-3",
    listingCode: "LST-2361",
    address: "Wangsa Maju 2 · GF",
    askingRental: 3900,
    daysSinceVerified: 45,
    assignedTo: null,
  },
];

export function countAgingVerificationTasks(minDays: number): number {
  return MOCK_VERIFICATION_TASKS.filter((task) => task.daysSinceVerified >= minDays).length;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/mock`
Expected: PASS (16 tests across 4 files).

- [ ] **Step 5: Commit**

```bash
git add src/lib/mock
git commit -m "feat: add mock data layer for listings, owner search, contact requests, verification"
```

---

### Task 3: App shell (collapsible sidebar + topbar)

**Files:**
- Create: `src/components/app-shell.tsx`
- Modify: `src/app/(app)/layout.tsx` (replace whole file — current content is the plain header layout read at the start of this project's design-import work)

**Interfaces:**
- Consumes: `roleLabel(role: Role): string` from `@/lib/auth/role`, `getCurrentProfile()` from `@/lib/auth/get-current-profile`, `signOut` server action from `../(auth)/actions`.
- Produces: `<AppShell fullName={string} roleLabel={string} signOutAction={() => Promise<void>}>{children}</AppShell>`, a client component. Every `(app)/` page renders inside it via the layout — no other task needs to import `AppShell` directly.

- [ ] **Step 1: Create the shell component**

```tsx
// src/components/app-shell.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ADMIN_NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/units", label: "Units" },
  { href: "/owner-search", label: "Owner search" },
  { href: "/listings", label: "Listings" },
  { href: "/contact-requests", label: "Contact requests" },
  { href: "/verification", label: "Verification" },
];

const USERS_AREAS_NAV = [
  { href: "/admin/areas", label: "Areas" },
  { href: "/admin/users", label: "Users" },
];

export function AppShell({
  fullName,
  roleLabel,
  signOutAction,
  children,
}: {
  fullName: string;
  roleLabel: string;
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(true);
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen items-stretch bg-sky-50">
      {navOpen ? (
        <nav className="sticky top-0 flex h-screen w-60 flex-none flex-col overflow-auto border-r border-sky-100 bg-white pb-6">
          <div className="flex items-center gap-2 px-4 pb-3 pt-5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-sky-600 text-sm font-extrabold text-white">
              B
            </div>
            <div className="mr-auto text-base font-extrabold text-slate-900">Bizlocate</div>
            <button
              type="button"
              onClick={() => setNavOpen(false)}
              title="Hide menu"
              className="rounded p-1 text-slate-500 hover:bg-sky-50"
            >
              ⟨
            </button>
          </div>
          <div className="px-5 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Admin
          </div>
          {ADMIN_NAV.map((item) => (
            <NavLink key={item.href} href={item.href} active={pathname === item.href}>
              {item.label}
            </NavLink>
          ))}
          <div className="px-5 pb-2 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Users &amp; areas
          </div>
          {USERS_AREAS_NAV.map((item) => (
            <NavLink key={item.href} href={item.href} active={pathname.startsWith(item.href)}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      ) : null}

      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-10 flex items-center gap-4 border-b border-sky-100 bg-white px-6 py-3">
          {!navOpen ? (
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              ☰
            </button>
          ) : null}
          <input
            className="w-72 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
            placeholder="Search units or listings"
          />
          <div className="ml-auto flex items-center gap-3">
            <div className="text-sm leading-tight">
              <p className="font-semibold text-slate-900">{fullName}</p>
              <p className="text-slate-600">{roleLabel}</p>
            </div>
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`mx-2 my-0.5 rounded-full px-3.5 py-2 text-sm ${
        active ? "bg-sky-100 font-semibold text-sky-800" : "text-slate-900 hover:bg-sky-50"
      }`}
    >
      {children}
    </Link>
  );
}
```

- [ ] **Step 2: Wire it into the layout**

```tsx
// src/app/(app)/layout.tsx
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { roleLabel } from "@/lib/auth/role";
import { AppShell } from "@/components/app-shell";
import { signOut } from "../(auth)/actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  return (
    <AppShell fullName={profile.fullName} roleLabel={roleLabel(profile.role)} signOutAction={signOut}>
      {children}
    </AppShell>
  );
}
```

- [ ] **Step 3: Manual verification (no automated test — this is interactive layout, matches repo convention of not testing pages/components)**

Run: `npm run dev`, sign in, confirm: sidebar renders, ⟨ collapses it, ☰ brings it back, nav items route correctly, sign out still works.

- [ ] **Step 4: Commit**

```bash
git add src/components/app-shell.tsx "src/app/(app)/layout.tsx"
git commit -m "feat: add collapsible admin sidebar shell"
```

---

### Task 4: Dashboard page (`/`)

**Files:**
- Modify: `src/app/(app)/page.tsx` (replace whole file — current content is the placeholder-links home page)

**Interfaces:**
- Consumes: `getCurrentProfile()`, `countListingsByStatus` from `@/lib/mock/listings`, `countOpenOwnerSearchTasks` from `@/lib/mock/owner-search`, `countAgingVerificationTasks` from `@/lib/mock/verification`, `Badge` from `@/components/badge`.

- [ ] **Step 1: Replace the page**

```tsx
// src/app/(app)/page.tsx
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { countListingsByStatus } from "@/lib/mock/listings";
import { countOpenOwnerSearchTasks } from "@/lib/mock/owner-search";
import { countAgingVerificationTasks } from "@/lib/mock/verification";

export default async function HomePage() {
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "super_admin" || profile?.role === "area_admin";

  if (!profile || !isAdmin) {
    return (
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Welcome to Bizlocate</h1>
        <p className="mt-2 text-slate-600">Signed in successfully.</p>
      </div>
    );
  }

  const available = countListingsByStatus("available");
  const openOwnerSearch = countOpenOwnerSearchTasks();
  const aging = countAgingVerificationTasks(45);
  const firstName = profile.fullName.split(" ")[0];

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Good morning, {firstName}</h1>
        <p className="text-slate-600">{openOwnerSearch + aging} items need you today.</p>
      </div>

      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
        <StatTile label="Available" value={available} href="/listings" />
        <StatTile label="Owner search" value={openOwnerSearch} href="/owner-search" tone="accent" />
        <StatTile label="Aging 45d+" value={aging} href="/verification" tone="warn" />
      </div>

      <div>
        <h2 className="mb-3 font-medium text-slate-900">Work queue</h2>
        <div className="rounded-2xl border border-sky-100 bg-white shadow-sm">
          <WorkQueueRow
            label="Danau Niaga 3, GF"
            note="Amirul · has tenant · 3h"
            href="/contact-requests"
            action="Review"
          />
          <WorkQueueRow
            label="Genting Klang 12A"
            note="Number found · Siti · 1d"
            href="/owner-search"
            action="Open"
          />
          <WorkQueueRow
            label="Metro Perdana 8, GF"
            note="52 days unverified"
            href="/verification"
            action="Open"
            last
          />
        </div>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: number;
  href: string;
  tone?: "accent" | "warn";
}) {
  const toneClasses =
    tone === "accent"
      ? "bg-sky-50 border-sky-200 text-sky-800"
      : tone === "warn"
        ? "bg-amber-50 border-amber-200 text-amber-800"
        : "bg-white border-sky-100 text-slate-900";

  return (
    <Link href={href} className={`rounded-2xl border p-4 shadow-sm ${toneClasses}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-3xl font-extrabold leading-tight">{value}</div>
    </Link>
  );
}

function WorkQueueRow({
  label,
  note,
  href,
  action,
  last,
}: {
  label: string;
  note: string;
  href: string;
  action: string;
  last?: boolean;
}) {
  return (
    <div className={`flex items-center gap-4 px-5 py-3.5 ${last ? "" : "border-b border-sky-100"}`}>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900">{label}</p>
        <p className="text-sm text-slate-600">{note}</p>
      </div>
      <Link
        href={href}
        className="flex-none rounded-full border border-slate-300 px-3.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
      >
        {action}
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, sign in as an `area_admin` or `super_admin` seed user, confirm the dashboard renders with 3 stat tiles and a work queue; sign in (or check) as `sp` and confirm the plain welcome message still shows.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/page.tsx"
git commit -m "feat: add admin dashboard with stat tiles and work queue"
```

---

### Task 5: Reskin Units list page

**Files:**
- Modify: `src/app/(app)/units/page.tsx` (same Supabase query and fields as current file — only JSX/classes change)

**Interfaces:**
- Consumes: `Badge` from `@/components/badge`.

- [ ] **Step 1: Replace the page**

```tsx
// src/app/(app)/units/page.tsx
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/badge";

export default async function UnitsPage() {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data: units } = await supabase
    .from("units")
    .select(
      "id, unit_code, jalan, unit_no, full_address, property_type, status, sub_areas(name, areas(name))",
    )
    .order("created_at", { ascending: false });

  const canCreate = profile.role === "super_admin" || profile.role === "area_admin";

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Units</h1>
        {canCreate ? (
          <a
            href="/units/new"
            className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
          >
            + New unit
          </a>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(units ?? []).map((u) => (
          <a
            key={u.id}
            href={`/units/${u.id}`}
            className="block rounded-2xl border border-sky-100 bg-white p-4 shadow-sm hover:border-sky-300"
          >
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {u.unit_code}
            </div>
            <div className="mt-1 font-semibold text-slate-900">
              {u.jalan} {u.unit_no}
            </div>
            <div className="mt-1 text-sm text-slate-600">
              {/* @ts-expect-error -- Supabase nested select typing */}
              {u.sub_areas?.areas?.name} / {u.sub_areas?.name} · {u.property_type}
            </div>
            <div className="mt-3">
              <Badge tone={u.status === "active" ? "ok" : "neutral"}>
                {u.status === "active" ? "Active" : "Archived"}
              </Badge>
            </div>
          </a>
        ))}
      </div>

      {(units ?? []).length === 0 ? (
        <p className="text-sm text-slate-600">No units yet.</p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, open `/units` as an admin — confirm the same units that were in the table before now render as cards, `+ New unit` link still works, clicking a card still goes to `/units/[id]`.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/units/page.tsx"
git commit -m "style: reskin units list as card grid"
```

---

### Task 6: Reskin Unit detail page with tabs

**Files:**
- Create: `src/components/unit-detail-tabs.tsx`
- Modify: `src/app/(app)/units/[unitId]/page.tsx` (same query, same `createUnitSpace`/`createOwnerForUnit` actions, same `canManage` scoping as current file — only JSX/classes and tab grouping change)

**Interfaces:**
- Produces: `<UnitDetailTabs overview={ReactNode} spaces={ReactNode} owner={ReactNode} />`, a client component taking pre-rendered server content per tab (no client-side data fetching).

- [ ] **Step 1: Create the tabs component**

```tsx
// src/components/unit-detail-tabs.tsx
"use client";

import { useState } from "react";

const TABS = ["overview", "spaces", "owner"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABELS: Record<Tab, string> = {
  overview: "Overview",
  spaces: "Spaces",
  owner: "Owner",
};

export function UnitDetailTabs({
  overview,
  spaces,
  owner,
}: {
  overview: React.ReactNode;
  spaces: React.ReactNode;
  owner: React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const panels: Record<Tab, React.ReactNode> = { overview, spaces, owner };

  return (
    <div className="rounded-2xl border border-sky-100 bg-white shadow-sm">
      <div className="flex border-b border-sky-100 px-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`relative px-3 py-3 text-sm font-semibold ${
              tab === t ? "text-sky-800" : "text-slate-500"
            }`}
          >
            {TAB_LABELS[t]}
            {tab === t ? (
              <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-sky-600" />
            ) : null}
          </button>
        ))}
      </div>
      <div className="p-5">{panels[tab]}</div>
    </div>
  );
}
```

- [ ] **Step 2: Replace the page**

```tsx
// src/app/(app)/units/[unitId]/page.tsx
import { redirect, notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { canSeeAllAreas, getAdminAreaIds } from "@/lib/auth/get-admin-area-ids";
import { verificationStatusLabel, contactStatusLabel } from "@/lib/owners/status-labels";
import { Badge } from "@/components/badge";
import { UnitDetailTabs } from "@/components/unit-detail-tabs";
import { createUnitSpace, createOwnerForUnit } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  space_create_failed: "Could not add space. Check the details and try again.",
  owner_create_failed: "Could not create owner. Check the details and try again.",
  ownership_link_failed: "Could not link owner to this unit. The owner record was not saved.",
};

const FLOOR_TYPES = ["Ground", "Mezzanine", "1st", "2nd", "3rd", "Upper Floor", "Whole Building", "Custom"];

const FIELD_CLASSES =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none";

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
            "id, space_id, is_primary, unit_spaces(floor_label), owners(id, name, primary_contact, verification_status, contact_status)",
          )
          .eq("unit_id", unitId)
      ).data
    : null;

  const overviewContent = (
    <>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        <Field label="Facing" value={unit.facing} />
        <Field label="Property type" value={unit.property_type} />
        <Field label="Land type" value={unit.land_type} />
        <Field
          label="Tenure"
          value={unit.tenure ? `${unit.tenure}${unit.tenure_years ? ` (${unit.tenure_years} yrs)` : ""}` : null}
        />
        <Field
          label="Size"
          value={unit.unit_size ? `${unit.unit_size} ${unit.unit_size_type ?? ""}` : null}
        />
      </div>
      <p className="mt-4 text-sm text-slate-600">{unit.remarks ?? "No remarks."}</p>
    </>
  );

  const spacesContent = (
    <div className="grid gap-3">
      {(spaces ?? []).map((s) => (
        <div
          key={s.id}
          className="flex items-center gap-3 rounded-xl bg-sky-50 px-4 py-3"
        >
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-900">{s.floor_label}</p>
            <p className="text-sm text-slate-600">
              {s.size ? `${s.size} ${s.size_type ?? ""}` : "Size not set"}
            </p>
          </div>
          <Badge tone="neutral">{s.status}</Badge>
        </div>
      ))}
      {(spaces ?? []).length === 0 ? <p className="text-sm text-slate-600">No spaces yet.</p> : null}

      {canManage ? (
        <form
          action={createUnitSpace}
          className="mt-2 max-w-sm space-y-4 rounded-xl border border-sky-100 p-5"
        >
          <input type="hidden" name="unitId" value={unit.id} />
          <h3 className="font-medium text-slate-900">Add space</h3>
          {space_created ? <p className="text-sm text-sky-700">Space added.</p> : null}
          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
          <div className="space-y-1">
            <label className="text-sm text-slate-700" htmlFor="floorType">
              Floor type
            </label>
            <select id="floorType" name="floorType" required className={FIELD_CLASSES}>
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
            <input id="floorLabel" name="floorLabel" required className={FIELD_CLASSES} />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-700" htmlFor="size">
              Size
            </label>
            <input id="size" name="size" type="number" className={FIELD_CLASSES} />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-700" htmlFor="sizeType">
              Size type (e.g. sqft)
            </label>
            <input id="sizeType" name="sizeType" className={FIELD_CLASSES} />
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

  const ownerContent = canManage ? (
    <div className="space-y-4">
      {owner_added ? <p className="text-sm text-sky-700">Owner added.</p> : null}
      <div className="grid gap-3">
        {(ownerships ?? []).map((o) => (
          <div key={o.id} className="rounded-xl bg-sky-50 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <a
                className="font-semibold text-sky-700"
                // @ts-expect-error -- Supabase nested select typing
                href={`/owners/${o.owners?.id}`}
              >
                {/* @ts-expect-error -- Supabase nested select typing */}
                {o.owners?.name}
              </a>
              <span className="text-sm text-slate-600">
                {/* @ts-expect-error -- Supabase nested select typing */}
                · {o.unit_spaces?.floor_label ?? "Whole unit"}
              </span>
            </div>
            <div className="mt-1 text-sm text-slate-600">
              {/* @ts-expect-error -- Supabase nested select typing */}
              {o.owners?.primary_contact ?? "—"}
            </div>
            <div className="mt-2 flex gap-2">
              <Badge tone="accent">
                {/* @ts-expect-error -- Supabase nested select typing */}
                {verificationStatusLabel(o.owners?.verification_status)}
              </Badge>
              <Badge tone="neutral">
                {/* @ts-expect-error -- Supabase nested select typing */}
                {contactStatusLabel(o.owners?.contact_status)}
              </Badge>
            </div>
          </div>
        ))}
        {(ownerships ?? []).length === 0 ? (
          <p className="text-sm text-slate-600">No owner on record yet.</p>
        ) : null}
      </div>

      <form
        action={createOwnerForUnit}
        className="max-w-sm space-y-4 rounded-xl border border-sky-100 p-5"
      >
        <input type="hidden" name="unitId" value={unit.id} />
        <h3 className="font-medium text-slate-900">Add owner</h3>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="spaceId">
            Space (leave blank for whole unit)
          </label>
          <select id="spaceId" name="spaceId" className={FIELD_CLASSES}>
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
          <input id="name" name="name" required className={FIELD_CLASSES} />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="primaryContact">
            Primary contact
          </label>
          <input id="primaryContact" name="primaryContact" className={FIELD_CLASSES} />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="otherContact">
            Other contact
          </label>
          <input id="otherContact" name="otherContact" className={FIELD_CLASSES} />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="icOrCompanyNo">
            IC / Company No
          </label>
          <input id="icOrCompanyNo" name="icOrCompanyNo" className={FIELD_CLASSES} />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="ownerType">
            Owner type
          </label>
          <input id="ownerType" name="ownerType" className={FIELD_CLASSES} />
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
          Add owner
        </button>
      </form>
    </div>
  ) : (
    <p className="text-sm text-slate-600">Owner details are restricted to your assigned areas.</p>
  );

  return (
    <div className="max-w-4xl space-y-5">
      <a className="text-sm text-sky-600" href="/units">
        ← Units
      </a>

      <div className="flex flex-wrap items-center gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {unit.unit_code}
          </div>
          <h1 className="text-xl font-semibold text-slate-900">
            {unit.jalan} {unit.unit_no}
          </h1>
          <p className="text-sm text-slate-600">
            {/* @ts-expect-error -- Supabase nested select typing */}
            {unit.sub_areas?.areas?.name} / {unit.sub_areas?.name} · {unit.full_address}
          </p>
        </div>
        <Badge tone={unit.status === "active" ? "ok" : "neutral"}>
          {unit.status === "active" ? "Active" : "Archived"}
        </Badge>
      </div>

      <UnitDetailTabs overview={overviewContent} spaces={spacesContent} owner={ownerContent} />
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

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, open a unit detail page — confirm Overview/Spaces/Owner tabs switch correctly, "Add space" and "Add owner" forms still submit and show their success/error query-param messages exactly as before, and a non-owning `area_admin` still sees the "restricted" message instead of the owner form.

- [ ] **Step 4: Commit**

```bash
git add src/components/unit-detail-tabs.tsx "src/app/(app)/units/[unitId]/page.tsx"
git commit -m "style: reskin unit detail with Overview/Spaces/Owner tabs"
```

---

### Task 7: Reskin Admin Users page

**Files:**
- Modify: `src/app/(app)/admin/users/page.tsx` (same query, same `createUser` action, same super_admin gate as current file)

**Interfaces:**
- Consumes: `Badge` from `@/components/badge`, `roleLabel` from `@/lib/auth/role`.

- [ ] **Step 1: Replace the page**

```tsx
// src/app/(app)/admin/users/page.tsx
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";
import { roleLabel } from "@/lib/auth/role";
import { Badge } from "@/components/badge";
import { createUser } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  create_failed: "Could not create user. Check the details and try again.",
};

const FIELD_CLASSES =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "super_admin") {
    redirect("/");
  }

  const { error, created } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  const supabase = await createClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("id, full_name, role, status, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="grid max-w-4xl grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <h1 className="text-lg font-semibold text-slate-900">Users</h1>
        <div className="rounded-2xl border border-sky-100 bg-white shadow-sm">
          {(users ?? []).map((u, i) => (
            <div
              key={u.id}
              className={`flex items-center gap-4 px-5 py-3.5 ${
                i === (users ?? []).length - 1 ? "" : "border-b border-sky-100"
              }`}
            >
              <div className="grid h-9 w-9 flex-none place-items-center rounded-full bg-sky-100 text-xs font-bold text-sky-800">
                {initials(u.full_name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{u.full_name}</p>
                <p className="text-sm text-slate-600">{u.status}</p>
              </div>
              <Badge tone="accent">{roleLabel(u.role)}</Badge>
            </div>
          ))}
          {(users ?? []).length === 0 ? (
            <p className="px-5 py-4 text-sm text-slate-600">No users yet.</p>
          ) : null}
        </div>
      </div>

      <form
        action={createUser}
        className="h-fit space-y-4 rounded-2xl border border-sky-100 bg-white p-6 shadow-sm"
      >
        <h2 className="font-medium text-slate-900">Create user</h2>
        {created ? <p className="text-sm text-sky-700">User created.</p> : null}
        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="fullName">
            Full name
          </label>
          <input id="fullName" name="fullName" required className={FIELD_CLASSES} />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="email">
            Email
          </label>
          <input id="email" name="email" type="email" required className={FIELD_CLASSES} />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="password">
            Temporary password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            className={FIELD_CLASSES}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="role">
            Role
          </label>
          <select id="role" name="role" defaultValue="sp" className={FIELD_CLASSES}>
            <option value="sp">Salesperson</option>
            <option value="area_admin">Area Admin</option>
            <option value="super_admin">Super Admin</option>
          </select>
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-sky-600 px-4 py-2 text-base font-medium text-white hover:bg-sky-700"
        >
          Create user
        </button>
      </form>
    </div>
  );
}

function initials(fullName: string): string {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, open `/admin/users` as `super_admin` — confirm the user list renders as cards with initials + role badge, and the create-user form still works exactly as before (including error/success messages).

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/admin/users/page.tsx"
git commit -m "style: reskin admin users page as card list"
```

---

### Task 8: Owner search page (new, mock data)

**Files:**
- Create: `src/components/owner-search-board.tsx`
- Create: `src/app/(app)/owner-search/page.tsx`

**Interfaces:**
- Consumes: `MOCK_OWNER_SEARCH_TASKS`, `MockOwnerSearchTask` from `@/lib/mock/owner-search`, `Badge` from `@/components/badge`.
- Produces: `<OwnerSearchBoard tasks={MockOwnerSearchTask[]} />`, a client component owning the row-selection state (list + right detail panel, matching the mockup's single-page master/detail layout).

- [ ] **Step 1: Create the client board component**

```tsx
// src/components/owner-search-board.tsx
"use client";

import { useState } from "react";
import { Badge } from "@/components/badge";
import type { MockOwnerSearchTask, OwnerSearchStatus } from "@/lib/mock/owner-search";

const STATUS_LABEL: Record<OwnerSearchStatus, string> = {
  need_search: "Need search",
  contacting: "Contacting",
  follow_up_later: "Follow up",
  wrong_number: "Wrong number",
};

const STATUS_TONE: Record<OwnerSearchStatus, "accent" | "neutral" | "warn"> = {
  need_search: "neutral",
  contacting: "accent",
  follow_up_later: "warn",
  wrong_number: "neutral",
};

export function OwnerSearchBoard({ tasks }: { tasks: MockOwnerSearchTask[] }) {
  const [selectedId, setSelectedId] = useState(tasks[0]?.id);
  const selected = tasks.find((t) => t.id === selectedId) ?? tasks[0];

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_330px]">
      <div className="min-w-0 rounded-2xl border border-sky-100 bg-white shadow-sm">
        {tasks.map((task, i) => (
          <button
            key={task.id}
            type="button"
            onClick={() => setSelectedId(task.id)}
            className={`flex w-full items-center gap-4 px-5 py-3.5 text-left ${
              i === tasks.length - 1 ? "" : "border-b border-sky-100"
            } ${task.id === selected?.id ? "bg-sky-50" : "hover:bg-sky-50/60"}`}
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">{task.address}</p>
              <p className="text-sm text-slate-600">{task.note}</p>
            </div>
            <Badge tone={STATUS_TONE[task.status]}>{STATUS_LABEL[task.status]}</Badge>
          </button>
        ))}
      </div>

      {selected ? (
        <div className="h-fit rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Working on
          </div>
          <div className="text-base font-semibold text-slate-900">{selected.address}</div>
          <div className="mb-4 text-sm text-slate-600">{STATUS_LABEL[selected.status]}</div>

          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Contact
          </div>
          <input
            className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={selected.foundContact ?? ""}
            placeholder="No number yet"
            readOnly
          />

          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Outcome
          </div>
          <div className="grid gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-4 py-3 text-left text-sm font-semibold hover:border-sky-400 hover:bg-sky-50"
            >
              Owner confirmed
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-4 py-3 text-left text-sm font-semibold hover:border-sky-400 hover:bg-sky-50"
            >
              Follow up later
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-4 py-3 text-left text-sm font-semibold hover:border-sky-400 hover:bg-sky-50"
            >
              Wrong number
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Create the page**

```tsx
// src/app/(app)/owner-search/page.tsx
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

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, open `/owner-search` as an admin — confirm the list renders, clicking a row updates the right-side detail panel.

- [ ] **Step 4: Commit**

```bash
git add src/components/owner-search-board.tsx "src/app/(app)/owner-search/page.tsx"
git commit -m "feat: add owner search screen (mock data)"
```

---

### Task 9: Contact requests page (new, mock data)

**Files:**
- Create: `src/components/contact-request-board.tsx`
- Create: `src/app/(app)/contact-requests/page.tsx`

**Interfaces:**
- Consumes: `MOCK_CONTACT_REQUESTS`, `MockContactRequest` from `@/lib/mock/contact-requests`, `Badge` from `@/components/badge`.
- Produces: `<ContactRequestBoard requests={MockContactRequest[]} />`, same master/detail pattern as `OwnerSearchBoard` (Task 8) — not shared into one generic component since the detail panels show different fields (ladder: two call sites don't yet justify a shared abstraction; revisit if a third master/detail screen appears).

- [ ] **Step 1: Create the client board component**

```tsx
// src/components/contact-request-board.tsx
"use client";

import { useState } from "react";
import { Badge } from "@/components/badge";
import type { ContactRequestStatus, MockContactRequest } from "@/lib/mock/contact-requests";

const STATUS_LABEL: Record<ContactRequestStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  expired: "Expired",
};

const STATUS_TONE: Record<ContactRequestStatus, "warn" | "ok" | "neutral"> = {
  pending: "warn",
  approved: "ok",
  expired: "neutral",
};

export function ContactRequestBoard({ requests }: { requests: MockContactRequest[] }) {
  const [selectedId, setSelectedId] = useState(requests[0]?.id);
  const selected = requests.find((r) => r.id === selectedId) ?? requests[0];

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_330px]">
      <div className="min-w-0 rounded-2xl border border-sky-100 bg-white shadow-sm">
        {requests.map((request, i) => (
          <button
            key={request.id}
            type="button"
            onClick={() => setSelectedId(request.id)}
            className={`flex w-full items-center gap-4 px-5 py-3.5 text-left ${
              i === requests.length - 1 ? "" : "border-b border-sky-100"
            } ${request.id === selected?.id ? "bg-sky-50" : "hover:bg-sky-50/60"}`}
          >
            <div className="grid h-9 w-9 flex-none place-items-center rounded-full bg-sky-100 text-xs font-bold text-sky-800">
              {request.requesterName
                .split(" ")
                .slice(0, 2)
                .map((p) => p[0])
                .join("")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">{request.requesterName}</p>
              <p className="text-sm text-slate-600">
                {request.listingAddress} · {request.submittedAgo}
              </p>
            </div>
            <Badge tone={STATUS_TONE[request.status]}>{STATUS_LABEL[request.status]}</Badge>
          </button>
        ))}
      </div>

      {selected ? (
        <div className="h-fit rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Request
          </div>
          <div className="mb-4 text-base font-semibold text-slate-900">{selected.requesterName}</div>

          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Reason
              </dt>
              <dd className="text-slate-900">{selected.reason}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Tenant
              </dt>
              <dd className="text-slate-900">{selected.tenantOrCompany}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Budget
              </dt>
              <dd className="text-slate-900">{selected.budget}</dd>
            </div>
          </dl>

          <button
            type="button"
            className="mt-5 w-full rounded-full bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
          >
            Approve 48h
          </button>
          <button
            type="button"
            className="mt-2 w-full rounded-full border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Reject
          </button>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Create the page**

```tsx
// src/app/(app)/contact-requests/page.tsx
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { ContactRequestBoard } from "@/components/contact-request-board";
import { MOCK_CONTACT_REQUESTS, countPendingContactRequests } from "@/lib/mock/contact-requests";

export default async function ContactRequestsPage() {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "area_admin")) {
    redirect("/");
  }

  return (
    <div className="max-w-5xl space-y-1">
      <h1 className="text-lg font-semibold text-slate-900">Contact requests</h1>
      <p className="mb-4 text-sm text-slate-600">
        {countPendingContactRequests()} pending · sample data, approvals aren&apos;t persisted yet.
      </p>
      <ContactRequestBoard requests={MOCK_CONTACT_REQUESTS} />
    </div>
  );
}
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, open `/contact-requests` as an admin — confirm list + detail panel selection works.

- [ ] **Step 4: Commit**

```bash
git add src/components/contact-request-board.tsx "src/app/(app)/contact-requests/page.tsx"
git commit -m "feat: add contact requests screen (mock data)"
```

---

### Task 10: Verification page (new, mock data)

**Files:**
- Create: `src/app/(app)/verification/page.tsx`

**Interfaces:**
- Consumes: `MOCK_VERIFICATION_TASKS` from `@/lib/mock/verification`, `Badge` from `@/components/badge`.

- [ ] **Step 1: Create the page**

```tsx
// src/app/(app)/verification/page.tsx
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { Badge } from "@/components/badge";
import { MOCK_VERIFICATION_TASKS } from "@/lib/mock/verification";

export default async function VerificationPage() {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "area_admin")) {
    redirect("/");
  }

  return (
    <div className="max-w-5xl space-y-1">
      <h1 className="text-lg font-semibold text-slate-900">Verification</h1>
      <p className="mb-4 text-sm text-slate-600">
        Listings past 45 days queue themselves — sample data for now.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MOCK_VERIFICATION_TASKS.map((task) => (
          <div key={task.id} className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Badge tone="warn">{task.daysSinceVerified} days</Badge>
              <span className="ml-auto text-sm text-slate-600">{task.assignedTo ?? "Unassigned"}</span>
            </div>
            <div className="mt-2.5 font-semibold text-slate-900">{task.address}</div>
            <div className="text-sm text-slate-600">
              {task.listingCode} · RM {task.askingRental.toLocaleString()}
            </div>
            <div className="mt-3.5 flex gap-2">
              <button
                type="button"
                className="rounded-full bg-sky-600 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-sky-700"
              >
                Still available
              </button>
              <button
                type="button"
                className="rounded-full border border-slate-300 px-3.5 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Report
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, open `/verification` as an admin — confirm the 3 mock cards render.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/verification/page.tsx"
git commit -m "feat: add verification screen (mock data)"
```

---

### Task 11: Listings list page (new, mock data)

**Files:**
- Create: `src/app/(app)/listings/page.tsx`

**Interfaces:**
- Consumes: `MOCK_LISTINGS`, `countListingsByStatus`, `LISTING_STATUS_LABEL`, `LISTING_STATUS_TONE` from `@/lib/mock/listings` (Task 2), `Badge` from `@/components/badge` (Task 1).

- [ ] **Step 1: Create the page**

```tsx
// src/app/(app)/listings/page.tsx
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { Badge } from "@/components/badge";
import {
  MOCK_LISTINGS,
  countListingsByStatus,
  LISTING_STATUS_LABEL,
  LISTING_STATUS_TONE,
} from "@/lib/mock/listings";

export default async function ListingsPage() {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "area_admin")) {
    redirect("/");
  }

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-lg font-semibold text-slate-900">Listings</h1>
        <Badge tone="ok">Available {countListingsByStatus("available")}</Badge>
        <Badge tone="accent">Reserved {countListingsByStatus("reserved")}</Badge>
        <a
          href="/listings/new"
          className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
        >
          New listing
        </a>
      </div>

      <div className="rounded-2xl border border-sky-100 bg-white shadow-sm">
        {MOCK_LISTINGS.map((listing, i) => (
          <a
            key={listing.id}
            href={`/listings/${listing.id}`}
            className={`flex items-center gap-4 px-5 py-3.5 hover:bg-sky-50/60 ${
              i === MOCK_LISTINGS.length - 1 ? "" : "border-b border-sky-100"
            }`}
          >
            <div className="h-14 w-[74px] flex-none rounded-lg bg-slate-200" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">{listing.address}</p>
              <p className="text-sm text-slate-600">
                {listing.code} · {listing.spaceLabel}
              </p>
            </div>
            <Badge tone={LISTING_STATUS_TONE[listing.status]}>{LISTING_STATUS_LABEL[listing.status]}</Badge>
            <strong className="w-24 flex-none text-right text-slate-900">
              RM {listing.askingRental.toLocaleString()}
            </strong>
          </a>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, open `/listings` — confirm 5 mock listings render with status pills and price, `New listing` link works, clicking a row goes to `/listings/[id]`.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/listings/page.tsx"
git commit -m "feat: add listings screen (mock data)"
```

---

### Task 12: Listing detail page (new, mock data)

**Files:**
- Create: `src/app/(app)/listings/[listingId]/page.tsx`

**Interfaces:**
- Consumes: `getListingById`, `LISTING_STATUS_LABEL`, `LISTING_STATUS_TONE` from `@/lib/mock/listings` (Task 2), `Badge` from `@/components/badge` (Task 1).

- [ ] **Step 1: Create the page**

```tsx
// src/app/(app)/listings/[listingId]/page.tsx
import { redirect, notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { Badge } from "@/components/badge";
import { getListingById, LISTING_STATUS_LABEL, LISTING_STATUS_TONE } from "@/lib/mock/listings";

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "area_admin")) {
    redirect("/");
  }

  const { listingId } = await params;
  const listing = getListingById(listingId);
  if (!listing) {
    notFound();
  }

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <a href="/listings" className="rounded-full border border-slate-300 px-3.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
          ← Listings
        </a>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {listing.code} {listing.exclusive ? "· exclusive" : ""}
          </div>
          <h1 className="text-xl font-semibold text-slate-900">{listing.address}</h1>
        </div>
        <Badge tone={LISTING_STATUS_TONE[listing.status]}>{LISTING_STATUS_LABEL[listing.status]}</Badge>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
            <div className="flex items-baseline gap-3">
              <div className="text-3xl font-extrabold text-slate-900">
                RM {listing.askingRental.toLocaleString()}
              </div>
              <span className="text-slate-600">/ month</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Space" value={listing.spaceLabel} />
              <Field label="Available from" value={listing.availableFrom} />
              <Field label="Verified" value={listing.lastVerified} />
            </div>
          </div>
        </div>

        <div className="space-y-3.5">
          <div className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Owner · admin only
            </div>
            <div className="font-semibold text-slate-900">{listing.ownerName}</div>
            <div className="text-sm text-slate-600">{listing.ownerContactMasked}</div>
          </div>
          <div className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Unit</div>
            <div className="text-sky-700">{listing.unitCode}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-slate-900">{value}</div>
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, open `/listings/lst-2431` — confirm it renders that listing's details; open `/listings/does-not-exist` — confirm Next's 404 page renders.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/listings/[listingId]/page.tsx"
git commit -m "feat: add listing detail screen (mock data)"
```

---

### Task 13: New listing page (new, static form)

**Files:**
- Create: `src/app/(app)/listings/new/page.tsx`

**Interfaces:**
- Consumes: none beyond `getCurrentProfile`. Form has no `action` — submit is intentionally inert (per spec, no backend for listings this round).

- [ ] **Step 1: Create the page**

```tsx
// src/app/(app)/listings/new/page.tsx
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";

const FIELD_CLASSES =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none";

export default async function NewListingPage() {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "super_admin" && profile.role !== "area_admin")) {
    redirect("/");
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">New listing</h1>
      <p className="text-sm text-slate-600">
        Unit details are reused — you only price this cycle. (Sample form — not wired to a unit yet.)
      </p>

      <div className="space-y-5 rounded-2xl border border-sky-100 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm text-slate-700" htmlFor="space">
              Space
            </label>
            <select id="space" name="space" className={FIELD_CLASSES}>
              <option>Ground floor · 770 sf</option>
              <option>1st floor · 770 sf</option>
              <option>Whole unit</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-700" htmlFor="listingType">
              Listing type
            </label>
            <select id="listingType" name="listingType" className={FIELD_CLASSES}>
              <option>Rent</option>
              <option>Sale</option>
              <option>Rent or sale</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-700" htmlFor="askingRental">
              Asking rental (RM/month)
            </label>
            <input id="askingRental" name="askingRental" defaultValue="4,800" className={FIELD_CLASSES} />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-700" htmlFor="availableFrom">
              Available from
            </label>
            <input id="availableFrom" name="availableFrom" defaultValue="1 Oct 2026" className={FIELD_CLASSES} />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="remarks">
            Remarks for salespersons
          </label>
          <textarea
            id="remarks"
            name="remarks"
            defaultValue="Corner lot, high foot traffic. Owner prefers F&B."
            className={FIELD_CLASSES}
            rows={3}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-full bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700"
          >
            Send for verification
          </button>
          <button
            type="button"
            className="rounded-full border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Save draft
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, open `/listings/new` — confirm the form renders (buttons are inert, that's expected this round).

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/listings/new/page.tsx"
git commit -m "feat: add new listing form screen (static)"
```

---

## Final check (after all tasks)

- [ ] Run the full test suite: `npm test` — expect all existing tests plus the new `src/lib/ui` and `src/lib/mock` tests to pass.
- [ ] Run `npm run lint` — fix any ESLint findings (in particular, watch for the repo's existing `@ts-expect-error` comments on Supabase nested-select fields carrying over correctly in Task 6).
- [ ] Run `npm run build` — confirm the app builds with no type errors across all new/modified routes.
- [ ] Click through every nav item in the sidebar as a `super_admin` and as an `area_admin`; confirm no dead links, no console errors.
