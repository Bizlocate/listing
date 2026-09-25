import { describe, it, expect } from "vitest";
import {
  STATUS_REPORT_TYPES,
  statusReportTypeLabel,
  statusReportStatusLabel,
  statusReportStatusTone,
  reportEffect,
} from "./labels";

describe("STATUS_REPORT_TYPES", () => {
  it("has exactly the 8 DB enum values", () => {
    expect(STATUS_REPORT_TYPES).toEqual([
      "still_available",
      "rented",
      "sold",
      "owner_not_renting",
      "price_changed",
      "cannot_contact",
      "wrong_contact",
      "other",
    ]);
  });
});

describe("statusReportTypeLabel", () => {
  it("labels every type", () => {
    expect(statusReportTypeLabel("still_available")).toBe("Still available");
    expect(statusReportTypeLabel("rented")).toBe("Rented");
    expect(statusReportTypeLabel("sold")).toBe("Sold");
    expect(statusReportTypeLabel("owner_not_renting")).toBe("Owner not renting");
    expect(statusReportTypeLabel("price_changed")).toBe("Price changed");
    expect(statusReportTypeLabel("cannot_contact")).toBe("Cannot contact owner");
    expect(statusReportTypeLabel("wrong_contact")).toBe("Wrong contact");
    expect(statusReportTypeLabel("other")).toBe("Other");
  });
});

describe("statusReportStatus label/tone", () => {
  it("maps each status exactly", () => {
    expect(statusReportStatusLabel("pending_review")).toBe("Pending review");
    expect(statusReportStatusLabel("confirmed")).toBe("Confirmed");
    expect(statusReportStatusLabel("rejected")).toBe("Rejected");
    expect(statusReportStatusTone("pending_review")).toBe("warn");
    expect(statusReportStatusTone("confirmed")).toBe("ok");
    expect(statusReportStatusTone("rejected")).toBe("dark");
  });
});

describe("reportEffect", () => {
  it("maps closing reports to a listing status", () => {
    expect(reportEffect("rented")).toEqual({ listingStatus: "rented", touchVerified: false });
    expect(reportEffect("sold")).toEqual({ listingStatus: "sold", touchVerified: false });
    expect(reportEffect("owner_not_renting")).toEqual({ listingStatus: "not_for_rent", touchVerified: false });
  });

  it("still_available only refreshes last_verified_date", () => {
    expect(reportEffect("still_available")).toEqual({ listingStatus: null, touchVerified: true });
  });

  it("has no automatic effect for the follow-up types", () => {
    for (const t of ["price_changed", "cannot_contact", "wrong_contact", "other"] as const) {
      expect(reportEffect(t)).toEqual({ listingStatus: null, touchVerified: false });
    }
  });
});
