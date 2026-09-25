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
    expect(describeActivity("profiles.update", null)).toBe("User role/status changed");
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
