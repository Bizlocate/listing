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
