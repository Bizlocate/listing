import { describe, it, expect } from "vitest";
import { sanitizeSearchTerm } from "./sanitize";

describe("sanitizeSearchTerm", () => {
  it("strips PostgREST and LIKE special characters", () => {
    expect(sanitizeSearchTerm('a%b_c,d(e)f*g"h\i`j;k')).toBe("abcdefghijk");
  });
  it("trims and collapses whitespace", () => {
    expect(sanitizeSearchTerm("  jalan   ss2 \t 12 ")).toBe("jalan ss2 12");
  });
  it("caps length at 50", () => {
    expect(sanitizeSearchTerm("a".repeat(80))).toHaveLength(50);
  });
  it("returns empty for whitespace-only or all-special input", () => {
    expect(sanitizeSearchTerm("   \n ")).toBe("");
    expect(sanitizeSearchTerm("%_,()")).toBe("");
  });
});
