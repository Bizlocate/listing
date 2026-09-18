import { describe, it, expect } from "vitest";
import { findDuplicateCandidates, type ExistingUnitForMatch } from "./duplicate-detection";

const SUB_AREA_A = "sub-area-a";
const SUB_AREA_B = "sub-area-b";

function unit(overrides: Partial<ExistingUnitForMatch>): ExistingUnitForMatch {
  return {
    id: "unit-1",
    unitCode: "SET-DK-000001",
    subAreaId: SUB_AREA_A,
    jalan: "Jalan Genting Klang",
    unitNo: "45",
    fullAddress: "45 Jalan Genting Klang, Setapak",
    ...overrides,
  };
}

describe("findDuplicateCandidates", () => {
  it("matches when sub-area, jalan, and unit no are all the same (case/whitespace-insensitive)", () => {
    const result = findDuplicateCandidates(
      { subAreaId: SUB_AREA_A, jalan: "  JALAN Genting Klang ", unitNo: "45", address: "somewhere else" },
      [unit({})],
    );
    expect(result).toHaveLength(1);
  });

  it("matches when the submitted address overlaps an existing unit's full address", () => {
    const result = findDuplicateCandidates(
      { subAreaId: SUB_AREA_A, jalan: "", unitNo: "", address: "45 Jalan Genting Klang" },
      [unit({})],
    );
    expect(result).toHaveLength(1);
  });

  it("does not match across different sub-areas even with identical jalan/unit no", () => {
    const result = findDuplicateCandidates(
      { subAreaId: SUB_AREA_B, jalan: "Jalan Genting Klang", unitNo: "45", address: "unrelated" },
      [unit({ subAreaId: SUB_AREA_A })],
    );
    expect(result).toHaveLength(0);
  });

  it("does not match when nothing overlaps", () => {
    const result = findDuplicateCandidates(
      { subAreaId: SUB_AREA_A, jalan: "Jalan Lain", unitNo: "99", address: "completely different place" },
      [unit({})],
    );
    expect(result).toHaveLength(0);
  });

  it("returns an empty array when there are no existing units", () => {
    const result = findDuplicateCandidates(
      { subAreaId: SUB_AREA_A, jalan: "Jalan Genting Klang", unitNo: "45", address: "45 Jalan Genting Klang" },
      [],
    );
    expect(result).toEqual([]);
  });

  it("does not match on jalan alone without a matching unit no", () => {
    const result = findDuplicateCandidates(
      { subAreaId: SUB_AREA_A, jalan: "Jalan Genting Klang", unitNo: "99", address: "somewhere unrelated entirely" },
      [unit({})],
    );
    expect(result).toHaveLength(0);
  });
});
