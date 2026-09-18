import { describe, it, expect } from "vitest";
import {
  ownerSearchStatusLabel,
  ownerSearchStatusTone,
  isOwnerSearchTaskOpen,
  OWNER_SEARCH_STATUSES,
} from "./status-labels";

describe("ownerSearchStatusLabel", () => {
  it("labels every owner search status", () => {
    expect(ownerSearchStatusLabel("need_search")).toBe("Need Search");
    expect(ownerSearchStatusLabel("number_found")).toBe("Number Found");
    expect(ownerSearchStatusLabel("contacting")).toBe("Contacting");
    expect(ownerSearchStatusLabel("owner_confirmed")).toBe("Owner Confirmed");
    expect(ownerSearchStatusLabel("wrong_number")).toBe("Wrong Number");
    expect(ownerSearchStatusLabel("unable_to_reach")).toBe("Unable to Reach");
    expect(ownerSearchStatusLabel("follow_up_later")).toBe("Follow Up Later");
  });
});

describe("ownerSearchStatusTone", () => {
  it("returns a tone for every status without throwing", () => {
    for (const status of OWNER_SEARCH_STATUSES) {
      expect(typeof ownerSearchStatusTone(status)).toBe("string");
    }
  });

  it("uses ok for owner_confirmed and dark for the two dead-end statuses", () => {
    expect(ownerSearchStatusTone("owner_confirmed")).toBe("ok");
    expect(ownerSearchStatusTone("wrong_number")).toBe("dark");
    expect(ownerSearchStatusTone("unable_to_reach")).toBe("dark");
  });
});

describe("isOwnerSearchTaskOpen", () => {
  it("is false for the three terminal statuses", () => {
    expect(isOwnerSearchTaskOpen("owner_confirmed")).toBe(false);
    expect(isOwnerSearchTaskOpen("wrong_number")).toBe(false);
    expect(isOwnerSearchTaskOpen("unable_to_reach")).toBe(false);
  });

  it("is true for the four in-progress statuses", () => {
    expect(isOwnerSearchTaskOpen("need_search")).toBe(true);
    expect(isOwnerSearchTaskOpen("number_found")).toBe(true);
    expect(isOwnerSearchTaskOpen("contacting")).toBe(true);
    expect(isOwnerSearchTaskOpen("follow_up_later")).toBe(true);
  });
});

describe("OWNER_SEARCH_STATUSES", () => {
  it("has exactly the 7 DB enum values", () => {
    expect(OWNER_SEARCH_STATUSES).toEqual([
      "need_search",
      "number_found",
      "contacting",
      "owner_confirmed",
      "wrong_number",
      "unable_to_reach",
      "follow_up_later",
    ]);
  });
});
