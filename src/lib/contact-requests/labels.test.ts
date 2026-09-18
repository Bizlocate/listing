import { describe, it, expect } from "vitest";
import {
  contactRequestReasonLabel,
  contactRequestStatusLabel,
  contactRequestStatusTone,
  isContactAccessActive,
  CONTACT_REQUEST_REASONS,
} from "./labels";

describe("contactRequestReasonLabel", () => {
  it("labels every reason", () => {
    expect(contactRequestReasonLabel("have_tenant")).toBe("I have a tenant");
    expect(contactRequestReasonLabel("arrange_viewing")).toBe("Arrange viewing");
    expect(contactRequestReasonLabel("rental_negotiation")).toBe("Rental negotiation");
    expect(contactRequestReasonLabel("listing_verification")).toBe("Listing verification");
    expect(contactRequestReasonLabel("other")).toBe("Other");
  });

  it("has exactly the 5 DB enum values", () => {
    expect(CONTACT_REQUEST_REASONS).toEqual([
      "have_tenant",
      "arrange_viewing",
      "rental_negotiation",
      "listing_verification",
      "other",
    ]);
  });
});

describe("contactRequestStatusLabel / Tone", () => {
  it("labels and tones every status without throwing", () => {
    for (const status of ["pending", "approved", "rejected", "expired"] as const) {
      expect(typeof contactRequestStatusLabel(status)).toBe("string");
      expect(typeof contactRequestStatusTone(status)).toBe("string");
    }
  });
});

describe("isContactAccessActive", () => {
  it("is true for a future expiry that isn't revoked", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isContactAccessActive(future, false)).toBe(true);
  });

  it("is false once past expiry", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(isContactAccessActive(past, false)).toBe(false);
  });

  it("is false when revoked even with a future expiry", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isContactAccessActive(future, true)).toBe(false);
  });
});
