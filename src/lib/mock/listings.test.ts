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
