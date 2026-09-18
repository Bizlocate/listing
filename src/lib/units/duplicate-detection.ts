export interface DuplicateCandidateInput {
  subAreaId: string;
  jalan: string;
  unitNo: string;
  address: string;
}

export interface ExistingUnitForMatch {
  id: string;
  unitCode: string;
  subAreaId: string;
  jalan: string | null;
  unitNo: string | null;
  fullAddress: string;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function findDuplicateCandidates(
  target: DuplicateCandidateInput,
  existingUnits: ExistingUnitForMatch[],
): ExistingUnitForMatch[] {
  const targetJalan = normalize(target.jalan);
  const targetUnitNo = normalize(target.unitNo);
  const targetAddress = normalize(target.address);

  return existingUnits.filter((unit) => {
    if (unit.subAreaId !== target.subAreaId) return false;

    const unitJalan = normalize(unit.jalan ?? "");
    const unitUnitNo = normalize(unit.unitNo ?? "");
    const unitAddress = normalize(unit.fullAddress);

    const jalanAndUnitNoMatch =
      targetJalan.length > 0 &&
      targetUnitNo.length > 0 &&
      unitJalan === targetJalan &&
      unitUnitNo === targetUnitNo;

    const addressOverlaps =
      targetAddress.length > 0 &&
      unitAddress.length > 0 &&
      (unitAddress.includes(targetAddress) || targetAddress.includes(unitAddress));

    return jalanAndUnitNoMatch || addressOverlaps;
  });
}
