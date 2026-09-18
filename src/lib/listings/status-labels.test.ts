import { describe, it, expect } from "vitest";
import {
  listingStatusLabel,
  listingStatusTone,
  listingTypeLabel,
  LISTING_STATUSES,
  LISTING_TYPES,
} from "./status-labels";

describe("listingStatusLabel", () => {
  it("labels every listing status", () => {
    expect(listingStatusLabel("draft")).toBe("Draft");
    expect(listingStatusLabel("pending_verification")).toBe("Pending Verification");
    expect(listingStatusLabel("available")).toBe("Available");
    expect(listingStatusLabel("reserved")).toBe("Reserved");
    expect(listingStatusLabel("rented")).toBe("Rented");
    expect(listingStatusLabel("sold")).toBe("Sold");
    expect(listingStatusLabel("owner_occupied")).toBe("Owner Occupied");
    expect(listingStatusLabel("not_for_rent")).toBe("Not For Rent");
    expect(listingStatusLabel("inactive")).toBe("Inactive");
    expect(listingStatusLabel("archived")).toBe("Archived");
  });
});

describe("listingStatusTone", () => {
  it("returns a tone for every status without throwing", () => {
    for (const status of LISTING_STATUSES) {
      expect(typeof listingStatusTone(status)).toBe("string");
    }
  });

  it("uses ok for available and dark for closed-out statuses", () => {
    expect(listingStatusTone("available")).toBe("ok");
    expect(listingStatusTone("rented")).toBe("dark");
    expect(listingStatusTone("sold")).toBe("dark");
  });
});

describe("listingTypeLabel", () => {
  it("labels every listing type", () => {
    expect(listingTypeLabel("rent")).toBe("Rent");
    expect(listingTypeLabel("sale")).toBe("Sale");
    expect(listingTypeLabel("rent_sale")).toBe("Rent & Sale");
  });
});

describe("enum lists", () => {
  it("LISTING_STATUSES has exactly the 10 DB enum values", () => {
    expect(LISTING_STATUSES).toEqual([
      "draft",
      "pending_verification",
      "available",
      "reserved",
      "rented",
      "sold",
      "owner_occupied",
      "not_for_rent",
      "inactive",
      "archived",
    ]);
  });

  it("LISTING_TYPES has exactly the 3 DB enum values", () => {
    expect(LISTING_TYPES).toEqual(["rent", "sale", "rent_sale"]);
  });
});
