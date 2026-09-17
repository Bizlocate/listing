import { describe, it, expect } from "vitest";
import {
  verificationStatusLabel,
  contactStatusLabel,
  VERIFICATION_STATUSES,
  CONTACT_STATUSES,
} from "./status-labels";

describe("verificationStatusLabel", () => {
  it("labels every verification status", () => {
    expect(verificationStatusLabel("unverified")).toBe("Unverified");
    expect(verificationStatusLabel("possible_owner")).toBe("Possible Owner");
    expect(verificationStatusLabel("verified_owner")).toBe("Verified Owner");
    expect(verificationStatusLabel("wrong_contact")).toBe("Wrong Contact");
  });
});

describe("contactStatusLabel", () => {
  it("labels every contact status", () => {
    expect(contactStatusLabel("not_contacted")).toBe("Not Contacted");
    expect(contactStatusLabel("no_answer")).toBe("No Answer");
    expect(contactStatusLabel("contacted")).toBe("Contacted");
    expect(contactStatusLabel("follow_up")).toBe("Follow Up");
    expect(contactStatusLabel("wrong_number")).toBe("Wrong Number");
    expect(contactStatusLabel("do_not_contact")).toBe("Do Not Contact");
  });
});

describe("status lists", () => {
  it("VERIFICATION_STATUSES has exactly the 4 DB enum values", () => {
    expect(VERIFICATION_STATUSES).toEqual([
      "unverified",
      "possible_owner",
      "verified_owner",
      "wrong_contact",
    ]);
  });

  it("CONTACT_STATUSES has exactly the 6 DB enum values", () => {
    expect(CONTACT_STATUSES).toEqual([
      "not_contacted",
      "no_answer",
      "contacted",
      "follow_up",
      "wrong_number",
      "do_not_contact",
    ]);
  });
});
