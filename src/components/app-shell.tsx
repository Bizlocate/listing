"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { canAccessAdminTools, canManageUsers, type Role } from "@/lib/auth/role";

const DASHBOARD_NAV = { href: "/", label: "Dashboard" };

const GENERAL_NAV = [
  { href: "/submit-unit", label: "Submit Unit" },
  { href: "/available-listings", label: "Available Listings" },
];

const ADMIN_NAV = [
  { href: "/units", label: "Units" },
  { href: "/owners", label: "Owners" },
  { href: "/owner-search", label: "Owner search" },
  { href: "/unit-submissions", label: "Unit submissions" },
  { href: "/listings", label: "Listings" },
  { href: "/contact-requests", label: "Contact requests" },
  { href: "/status-reports", label: "Status reports" },
  { href: "/verification", label: "Verification" },
];

const USERS_AREAS_NAV = [
  { href: "/admin/areas", label: "Areas" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/audit-log", label: "Audit log" },
];

export function AppShell({
  fullName,
  roleLabel,
  role,
  signOutAction,
  children,
}: {
  fullName: string;
  roleLabel: string;
  role: Role;
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // mobileOpen is keyed to the pathname it was opened on, so navigating closes the drawer without an effect.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const mobileOpen = openedAt === pathname;
  const [desktopHidden, setDesktopHidden] = useState(false);
  const closeMobile = () => setOpenedAt(null);
  const showAdminNav = canAccessAdminTools(role);
  const showUsersAreasNav = canManageUsers(role);

  return (
    <div className="flex min-h-screen items-stretch bg-sky-50">
      {mobileOpen ? (
        <div className="fixed inset-0 z-20 bg-slate-900/40 md:hidden" onClick={closeMobile} />
      ) : null}
      <nav
        className={`fixed inset-y-0 left-0 z-30 flex w-60 flex-none flex-col overflow-auto border-r border-sky-100 bg-white pb-6 transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${desktopHidden ? "md:hidden" : ""}`}
      >
          <div className="flex items-center gap-2 px-4 pb-3 pt-5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-sky-600 text-sm font-extrabold text-white">
              B
            </div>
            <div className="mr-auto text-base font-extrabold text-slate-900">Bizlocate</div>
            <button
              type="button"
              onClick={() => {
                closeMobile();
                setDesktopHidden(true);
              }}
              title="Hide menu"
              className="rounded p-1 text-slate-500 hover:bg-sky-50"
            >
              ⟨
            </button>
          </div>
          {showAdminNav ? (
            <div className="px-5 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Admin
            </div>
          ) : null}
          <NavLink onNavigate={closeMobile} href={DASHBOARD_NAV.href} active={pathname === DASHBOARD_NAV.href}>
            {DASHBOARD_NAV.label}
          </NavLink>
          {GENERAL_NAV.map((item) => (
            <NavLink onNavigate={closeMobile} key={item.href} href={item.href} active={pathname === item.href}>
              {item.label}
            </NavLink>
          ))}
          {showAdminNav
            ? ADMIN_NAV.map((item) => (
                <NavLink onNavigate={closeMobile} key={item.href} href={item.href} active={pathname === item.href}>
                  {item.label}
                </NavLink>
              ))
            : null}
          {showUsersAreasNav ? (
            <>
              <div className="px-5 pb-2 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Users &amp; areas
              </div>
              {USERS_AREAS_NAV.map((item) => (
                <NavLink onNavigate={closeMobile} key={item.href} href={item.href} active={pathname.startsWith(item.href)}>
                  {item.label}
                </NavLink>
              ))}
            </>
          ) : null}
      </nav>

      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-sky-100 bg-white px-3 py-3 md:gap-4 md:px-6">
          <button
            type="button"
            onClick={() => setOpenedAt(pathname)}
            aria-label="Open menu"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 md:hidden"
          >
            ☰
          </button>
          {desktopHidden ? (
            <button
              type="button"
              onClick={() => setDesktopHidden(false)}
              aria-label="Show menu"
              className="hidden rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 md:block"
            >
              ☰
            </button>
          ) : null}
          <form action="/search" method="get" role="search" className="flex min-w-0 flex-1 md:flex-none">
            <input
              name="q"
              type="search"
              aria-label="Search units or listings"
              className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none md:w-72 md:flex-none"
              placeholder="Search units or listings"
            />
          </form>
          <div className="ml-auto flex flex-none items-center gap-2 md:gap-3">
            <div className="text-sm leading-tight">
              <p className="max-w-[8rem] truncate font-semibold text-slate-900">{fullName}</p>
              <p className="hidden text-slate-600 sm:block">{roleLabel}</p>
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
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

function NavLink({
  href,
  active,
  onNavigate,
  children,
}: {
  href: string;
  active: boolean;
  onNavigate: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`mx-2 my-0.5 rounded-full px-3.5 py-2 text-sm ${
        active ? "bg-sky-100 font-semibold text-sky-800" : "text-slate-900 hover:bg-sky-50"
      }`}
    >
      {children}
    </Link>
  );
}
