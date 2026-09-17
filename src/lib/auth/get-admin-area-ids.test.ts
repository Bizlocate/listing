import { describe, it, expect } from "vitest";
import { canSeeAllAreas } from "./get-admin-area-ids";

describe("canSeeAllAreas", () => {
  it("is true only for super_admin", () => {
    expect(canSeeAllAreas("super_admin")).toBe(true);
    expect(canSeeAllAreas("area_admin")).toBe(false);
    expect(canSeeAllAreas("sp")).toBe(false);
  });
});
