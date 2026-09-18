import { describe, it, expect } from "vitest";
import { countAgingVerificationTasks } from "./verification";

describe("countAgingVerificationTasks", () => {
  it("counts tasks at or past the aging threshold", () => {
    expect(countAgingVerificationTasks(45)).toBe(3);
  });

  it("excludes tasks below the threshold", () => {
    expect(countAgingVerificationTasks(50)).toBe(1);
  });
});
