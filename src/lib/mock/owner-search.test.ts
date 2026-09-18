import { describe, it, expect } from "vitest";
import { getOwnerSearchTaskById, countOpenOwnerSearchTasks } from "./owner-search";

describe("getOwnerSearchTaskById", () => {
  it("finds a task that exists", () => {
    expect(getOwnerSearchTaskById("ost-1")?.address).toBe("12A, Jalan Genting Klang");
  });

  it("returns undefined for an unknown id", () => {
    expect(getOwnerSearchTaskById("does-not-exist")).toBeUndefined();
  });
});

describe("countOpenOwnerSearchTasks", () => {
  it("excludes wrong_number tasks", () => {
    expect(countOpenOwnerSearchTasks()).toBe(4);
  });
});
