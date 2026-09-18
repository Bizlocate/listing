import type { BadgeTone } from "@/lib/ui/badge-tone";

export type ListingStatus =
  | "draft"
  | "pending_verification"
  | "available"
  | "reserved"
  | "rented"
  | "sold"
  | "owner_occupied"
  | "not_for_rent"
  | "inactive"
  | "archived";

export type ListingType = "rent" | "sale" | "rent_sale";

export const LISTING_STATUSES: ListingStatus[] = [
  "draft",
  "pending_verification",
  "available",
  "reserved",
  "rented",
  "sold",
  "owner_occupied",
  "not_for_rent",
  "inactive",
  "archived",
];

export const LISTING_TYPES: ListingType[] = ["rent", "sale", "rent_sale"];

const STATUS_LABELS: Record<ListingStatus, string> = {
  draft: "Draft",
  pending_verification: "Pending Verification",
  available: "Available",
  reserved: "Reserved",
  rented: "Rented",
  sold: "Sold",
  owner_occupied: "Owner Occupied",
  not_for_rent: "Not For Rent",
  inactive: "Inactive",
  archived: "Archived",
};

const STATUS_TONES: Record<ListingStatus, BadgeTone> = {
  draft: "neutral",
  pending_verification: "warn",
  available: "ok",
  reserved: "accent",
  rented: "dark",
  sold: "dark",
  owner_occupied: "neutral",
  not_for_rent: "neutral",
  inactive: "neutral",
  archived: "neutral",
};

const TYPE_LABELS: Record<ListingType, string> = {
  rent: "Rent",
  sale: "Sale",
  rent_sale: "Rent & Sale",
};

export function listingStatusLabel(status: ListingStatus): string {
  return STATUS_LABELS[status];
}

export function listingStatusTone(status: ListingStatus): BadgeTone {
  return STATUS_TONES[status];
}

export function listingTypeLabel(type: ListingType): string {
  return TYPE_LABELS[type];
}
