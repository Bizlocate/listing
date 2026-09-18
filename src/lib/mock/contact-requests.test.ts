import { describe, it, expect } from "vitest";
import { getContactRequestById, countPendingContactRequests } from "./contact-requests";

describe("getContactRequestById", () => {
  it("finds a request that exists", () => {
    expect(getContactRequestById("cr-1")?.requesterName).toBe("Amirul Hakim");
  });

  it("returns undefined for an unknown id", () => {
    expect(getContactRequestById("does-not-exist")).toBeUndefined();
  });
});

describe("countPendingContactRequests", () => {
  it("counts only pending requests", () => {
    expect(countPendingContactRequests()).toBe(2);
  });
});
