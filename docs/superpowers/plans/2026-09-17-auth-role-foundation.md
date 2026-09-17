# Auth & Role Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users can sign up and log in via Supabase Auth, automatically get a `profiles` row with a role, and see a role-aware authenticated shell — the foundation every later Phase 1 subsystem (Units, Owners, Listings, etc.) builds on.

**Architecture:** Next.js App Router with a public `(auth)` route group (login/signup) and a protected `(app)` route group. Supabase session lives in cookies, refreshed by Next.js middleware on every request. Role comes from `public.profiles.role` (already created by the `handle_new_user` trigger in the deployed schema) — never trusted from the client, always re-read server-side.

**Tech Stack:** Next.js 15 (App Router, already scaffolded), `@supabase/ssr`, `@supabase/supabase-js` (already installed), Vitest for pure-function unit tests.

## Global Constraints

- Owner data / sensitive fields must never reach the SP browser (spec §36) — not relevant to this plan's files directly, but the role-check helpers built here are the pattern later plans reuse.
- Role must be re-verified server-side on every protected route — client-side role checks are UI convenience only, never the security boundary (spec §36). The real boundary is the RLS policies already deployed in `supabase/migrations/0001_phase1_schema.sql`.
- Light theme, white background, sky-blue accents, mobile-first (spec §39) — applies to the login/signup/shell UI in this plan.
- First user must be manually promoted to `super_admin` via SQL (documented in the migration file) — there is no self-serve admin promotion in Phase 1.

---

## File Structure

- `src/lib/supabase/middleware.ts` — creates a Supabase client bound to the request/response, used to refresh the session cookie.
- `middleware.ts` (project root) — Next.js middleware entrypoint, calls the helper above on every request.
- `src/lib/auth/role.ts` — pure functions: role labels and simple capability checks (UI convenience, not security).
- `src/lib/auth/role.test.ts` — Vitest tests for the above.
- `src/lib/auth/get-current-profile.ts` — server-only helper: reads the logged-in user's `profiles` row.
- `src/app/(auth)/login/page.tsx` — login form.
- `src/app/(auth)/signup/page.tsx` — signup form.
- `src/app/(auth)/actions.ts` — server actions: `signUp`, `signIn`, `signOut`.
- `src/app/(app)/layout.tsx` — protected layout: redirects to `/login` if unauthenticated, shows role + sign-out in a header.
- `src/app/(app)/page.tsx` — placeholder authenticated home page showing the user's name/role.
- `vitest.config.ts`, `package.json` (scripts) — test tooling.

---

### Task 1: Vitest setup + role helper functions

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/auth/role.ts`
- Test: `src/lib/auth/role.test.ts`
- Modify: `package.json` (add `test` script + devDependencies)

**Interfaces:**
- Produces: `export type Role = 'super_admin' | 'area_admin' | 'sp'`
- Produces: `export function roleLabel(role: Role): string`
- Produces: `export function canManageUsers(role: Role): boolean`
- Produces: `export function canAccessAdminTools(role: Role): boolean`

- [ ] **Step 1: Install Vitest**

Run: `npm install -D vitest`

- [ ] **Step 2: Add test script to package.json**

In `package.json`, inside `"scripts"`, add:

```json
"test": "vitest run"
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 4: Write the failing test**

Create `src/lib/auth/role.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { roleLabel, canManageUsers, canAccessAdminTools } from "./role";

describe("roleLabel", () => {
  it("labels super_admin", () => {
    expect(roleLabel("super_admin")).toBe("Super Admin");
  });
  it("labels area_admin", () => {
    expect(roleLabel("area_admin")).toBe("Area Admin");
  });
  it("labels sp", () => {
    expect(roleLabel("sp")).toBe("Salesperson");
  });
});

describe("canManageUsers", () => {
  it("only super_admin can manage users", () => {
    expect(canManageUsers("super_admin")).toBe(true);
    expect(canManageUsers("area_admin")).toBe(false);
    expect(canManageUsers("sp")).toBe(false);
  });
});

describe("canAccessAdminTools", () => {
  it("super_admin and area_admin can access admin tools", () => {
    expect(canAccessAdminTools("super_admin")).toBe(true);
    expect(canAccessAdminTools("area_admin")).toBe(true);
    expect(canAccessAdminTools("sp")).toBe(false);
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './role'` (file doesn't exist yet)

- [ ] **Step 6: Write minimal implementation**

Create `src/lib/auth/role.ts`:

```typescript
export type Role = "super_admin" | "area_admin" | "sp";

const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  area_admin: "Area Admin",
  sp: "Salesperson",
};

export function roleLabel(role: Role): string {
  return ROLE_LABELS[role];
}

export function canManageUsers(role: Role): boolean {
  return role === "super_admin";
}

export function canAccessAdminTools(role: Role): boolean {
  return role === "super_admin" || role === "area_admin";
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test`
Expected: PASS (7 tests)

- [ ] **Step 8: Commit**

```bash
git add vitest.config.ts package.json package-lock.json src/lib/auth/role.ts src/lib/auth/role.test.ts
git commit -m "test: add role helper functions with vitest coverage"
```

---

### Task 2: Session refresh middleware

**Files:**
- Create: `src/lib/supabase/middleware.ts`
- Create: `middleware.ts`

**Interfaces:**
- Consumes: `process.env.NEXT_PUBLIC_SUPABASE_URL`, `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY` (already in `.env.local`)
- Produces: `export async function updateSession(request: NextRequest): Promise<NextResponse>` — used by root `middleware.ts`

- [ ] **Step 1: Create the Supabase middleware helper**

Create `src/lib/supabase/middleware.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Touching getUser() is required — it refreshes the session cookie if expired.
  await supabase.auth.getUser();

  return response;
}
```

- [ ] **Step 2: Wire it into root middleware**

Create `middleware.ts` in the project root (same level as `package.json`):

```typescript
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 3: Verify the app still boots**

Run: `npm run dev` then open `http://localhost:3000` in a browser.
Expected: default Next.js page loads with no errors in the terminal.

- [ ] **Step 4: Commit**

```bash
git add middleware.ts src/lib/supabase/middleware.ts
git commit -m "feat: refresh Supabase session in middleware"
```

---

### Task 3: Signup page + server action

**Files:**
- Create: `src/app/(auth)/actions.ts`
- Create: `src/app/(auth)/signup/page.tsx`

**Interfaces:**
- Consumes: `createClient()` from `src/lib/supabase/server.ts` (already exists, signature `async function createClient(): Promise<SupabaseClient>`)
- Produces: `export async function signUp(formData: FormData): Promise<void>` (redirects on success/failure via `redirect()`)

- [ ] **Step 1: Create the server actions file**

Create `src/app/(auth)/actions.ts`:

```typescript
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signUp(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));
  const fullName = String(formData.get("fullName"));

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/login?message=Check your email to confirm your account");
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
```

- [ ] **Step 2: Create the signup page**

Create `src/app/(auth)/signup/page.tsx`:

```tsx
import { signUp } from "../actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4">
      <form
        action={signUp}
        className="w-full max-w-sm space-y-4 rounded-lg border border-sky-100 p-6 shadow-sm"
      >
        <h1 className="text-xl font-semibold text-slate-900">Create account</h1>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="fullName">
            Full name
          </label>
          <input
            id="fullName"
            name="fullName"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-sky-600 px-4 py-2 text-base font-medium text-white hover:bg-sky-700"
        >
          Sign up
        </button>
        <p className="text-sm text-slate-600">
          Already have an account? <a className="text-sky-600" href="/login">Log in</a>
        </p>
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, open `http://localhost:3000/signup`.
Fill the form with a real email you can access + a password, submit.
Expected: redirected to `/login?message=...` (the `/login` page doesn't exist yet, so this will 404 until Task 4 — that's expected at this step).
Then in Supabase Dashboard → Table Editor → `profiles`: confirm a new row exists with `role = 'sp'`.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(auth)/actions.ts" "src/app/(auth)/signup/page.tsx"
git commit -m "feat: add signup page and auth server actions"
```

---

### Task 4: Login page

**Files:**
- Create: `src/app/(auth)/login/page.tsx`

**Interfaces:**
- Consumes: `signIn(formData: FormData)` from `../actions` (Task 3)

- [ ] **Step 1: Create the login page**

Create `src/app/(auth)/login/page.tsx`:

```tsx
import { signIn } from "../actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4">
      <form
        action={signIn}
        className="w-full max-w-sm space-y-4 rounded-lg border border-sky-100 p-6 shadow-sm"
      >
        <h1 className="text-xl font-semibold text-slate-900">Log in</h1>
        {message ? <p className="text-sm text-sky-700">{message}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-700" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-sky-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-sky-600 px-4 py-2 text-base font-medium text-white hover:bg-sky-700"
        >
          Log in
        </button>
        <p className="text-sm text-slate-600">
          No account? <a className="text-sky-600" href="/signup">Sign up</a>
        </p>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Manual verification**

With `npm run dev` running, open `http://localhost:3000/login`, log in with the account created in Task 3.
Expected: redirected to `/` (still the default Next.js placeholder page until Task 6 — that's expected here).

- [ ] **Step 3: Commit**

```bash
git add "src/app/(auth)/login/page.tsx"
git commit -m "feat: add login page"
```

---

### Task 5: Server-side profile lookup helper

**Files:**
- Create: `src/lib/auth/get-current-profile.ts`

**Interfaces:**
- Consumes: `createClient()` from `src/lib/supabase/server.ts`, `Role` from `src/lib/auth/role.ts`
- Produces: `export async function getCurrentProfile(): Promise<{ id: string; fullName: string; role: Role } | null>`

- [ ] **Step 1: Write the helper**

Create `src/lib/auth/get-current-profile.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/auth/role";

export async function getCurrentProfile(): Promise<{
  id: string;
  fullName: string;
  role: Role;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return { id: profile.id, fullName: profile.full_name, role: profile.role as Role };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/auth/get-current-profile.ts
git commit -m "feat: add server-side current-profile lookup"
```

(No isolated unit test here — this function only does anything meaningful against a live Supabase session/DB. It's exercised end-to-end in Task 6.)

---

### Task 6: Protected app shell

**Files:**
- Create: `src/app/(app)/layout.tsx`
- Create: `src/app/(app)/page.tsx`
- Modify: `src/app/page.tsx:1` (delete — replaced by the `(app)` route group's home page)

**Interfaces:**
- Consumes: `getCurrentProfile()` (Task 5), `roleLabel(role)` (Task 1), `signOut()` (Task 3)

- [ ] **Step 1: Delete the default scaffold home page**

Run: `rm "src/app/page.tsx"`

- [ ] **Step 2: Create the protected layout**

Create `src/app/(app)/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { roleLabel } from "@/lib/auth/role";
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
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between border-b border-sky-100 px-4 py-3">
        <div>
          <p className="font-semibold text-slate-900">{profile.fullName}</p>
          <p className="text-sm text-sky-700">{roleLabel(profile.role)}</p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Sign out
          </button>
        </form>
      </header>
      <main className="p-4">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Create the placeholder home page**

Create `src/app/(app)/page.tsx`:

```tsx
export default function HomePage() {
  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900">Welcome to Bizlocate</h1>
      <p className="mt-2 text-slate-600">
        Signed in successfully. Feature pages (Units, Owners, Listings) land in
        later plans.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Manual verification — full loop**

Run: `npm run dev`.
1. Open `http://localhost:3000/` while logged out → expect redirect to `/login`.
2. Log in with the account from Task 3 → expect redirect to `/`, header shows the user's name and "Salesperson".
3. Click "Sign out" → expect redirect to `/login`.

- [ ] **Step 5: Promote the first user to super_admin**

In Supabase Dashboard → SQL Editor, find the user's id from Table Editor → `profiles`, then run:

```sql
update public.profiles set role = 'super_admin' where id = '<paste-the-id-here>';
```

Log in again in the browser → header should now show "Super Admin".

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: protected app shell with role-aware header"
```

---

## Self-Review Notes

- **Spec coverage:** This plan covers spec §1 (roles exist and are read server-side) and the auth prerequisite implied by every other section. Units/Owners/Listings/etc. are explicitly out of scope — separate plans per the Phase 1 build order in the design doc.
- **Placeholder scan:** none found — every step has runnable code or an exact manual-check procedure.
- **Type consistency:** `Role` type from Task 1 is reused verbatim in Tasks 5 and 6; `getCurrentProfile()` return shape matches what `AppLayout` destructures.
