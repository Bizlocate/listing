export interface MockVerificationTask {
  id: string;
  listingCode: string;
  address: string;
  askingRental: number;
  daysSinceVerified: number;
  assignedTo: string | null;
}

export const MOCK_VERIFICATION_TASKS: MockVerificationTask[] = [
  {
    id: "vt-1",
    listingCode: "LST-2402",
    address: "Metro Perdana 8 · GF",
    askingRental: 6800,
    daysSinceVerified: 52,
    assignedTo: "Chan Y.L.",
  },
  {
    id: "vt-2",
    listingCode: "LST-2390",
    address: "Danau Kota 7 · 1st",
    askingRental: 2100,
    daysSinceVerified: 48,
    assignedTo: "Amirul H.",
  },
  {
    id: "vt-3",
    listingCode: "LST-2361",
    address: "Wangsa Maju 2 · GF",
    askingRental: 3900,
    daysSinceVerified: 45,
    assignedTo: null,
  },
];

export function countAgingVerificationTasks(minDays: number): number {
  return MOCK_VERIFICATION_TASKS.filter((task) => task.daysSinceVerified >= minDays).length;
}
