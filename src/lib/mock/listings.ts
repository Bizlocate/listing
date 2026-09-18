import type { BadgeTone } from "@/lib/ui/badge-tone";

export type ListingStatus =
  | "draft"
  | "pending_verification"
  | "available"
  | "reserved"
  | "rented"
  | "sold";

export const LISTING_STATUS_LABEL: Record<ListingStatus, string> = {
  draft: "Draft",
  pending_verification: "Confirm",
  available: "Available",
  reserved: "Reserved",
  rented: "Rented",
  sold: "Sold",
};

export const LISTING_STATUS_TONE: Record<ListingStatus, BadgeTone> = {
  draft: "neutral",
  pending_verification: "warn",
  available: "ok",
  reserved: "neutral",
  rented: "dark",
  sold: "dark",
};

export interface MockListing {
  id: string;
  code: string;
  unitCode: string;
  address: string;
  spaceLabel: string;
  askingRental: number;
  status: ListingStatus;
  exclusive: boolean;
  availableFrom: string;
  lastVerified: string;
  ownerName: string;
  ownerContactMasked: string;
}

export const MOCK_LISTINGS: MockListing[] = [
  {
    id: "lst-2431",
    code: "LST-2431",
    unitCode: "SET-DK-000412",
    address: "26, Jalan Danau Niaga 3",
    spaceLabel: "Ground floor · 770 sf",
    askingRental: 4800,
    status: "available",
    exclusive: true,
    availableFrom: "1 Oct 2026",
    lastVerified: "2 days ago",
    ownerName: "Lim Wei Keong",
    ownerContactMasked: "+6012-••• ••89",
  },
  {
    id: "lst-2429",
    code: "LST-2429",
    unitCode: "SET-DK-000401",
    address: "8, Taman Bunga Raya 1",
    spaceLabel: "GF + 1st · 1,760 sf",
    askingRental: 7500,
    status: "reserved",
    exclusive: true,
    availableFrom: "15 Sep 2026",
    lastVerified: "6 days ago",
    ownerName: "Chan Yoke Lin",
    ownerContactMasked: "+6013-••• ••02",
  },
  {
    id: "lst-2419",
    code: "LST-2419",
    unitCode: "WM-S2-000188",
    address: "44, Wangsa Delima 5",
    spaceLabel: "1st floor · 820 sf",
    askingRental: 2400,
    status: "pending_verification",
    exclusive: false,
    availableFrom: "Reported rented",
    lastVerified: "1 day ago",
    ownerName: "Chan Y.L.",
    ownerContactMasked: "+6019-••• ••41",
  },
  {
    id: "lst-2402",
    code: "LST-2402",
    unitCode: "WM-S2-000174",
    address: "7, Metro Perdana 8",
    spaceLabel: "Ground floor · 1,980 sf",
    askingRental: 6800,
    status: "reserved",
    exclusive: false,
    availableFrom: "Verified 52 days ago",
    lastVerified: "52 days ago",
    ownerName: "Chan Y.L.",
    ownerContactMasked: "+6012-••• ••17",
  },
  {
    id: "lst-2280",
    code: "LST-2280",
    unitCode: "SET-DK-000407",
    address: "3-1, Jalan Danau Kota 2",
    spaceLabel: "Ground floor · 2,100 sf",
    askingRental: 6200,
    status: "rented",
    exclusive: false,
    availableFrom: "Closed 2 Sep",
    lastVerified: "closed",
    ownerName: "Tan Ah Kow",
    ownerContactMasked: "+6017-••• ••55",
  },
];

export function getListingById(id: string): MockListing | undefined {
  return MOCK_LISTINGS.find((listing) => listing.id === id);
}

export function countListingsByStatus(status: ListingStatus): number {
  return MOCK_LISTINGS.filter((listing) => listing.status === status).length;
}
