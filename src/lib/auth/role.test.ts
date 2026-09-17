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
