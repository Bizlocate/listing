import type { BadgeTone } from "@/lib/ui/badge-tone";
import type { ListingStatus } from "@/lib/listings/status-labels";

export type StatusReportType =
  | "still_available"
  | "rented"
  | "sold"
  | "owner_not_renting"
  | "price_changed"
  | "cannot_contact"
  | "wrong_contact"
  | "other";

export const STATUS_REPORT_TYPES: StatusReportType[] = [
  "still_available",
  "rented",
  "sold",
  "owner_not_renting",
  "price_changed",
  "cannot_contact",
  "wrong_contact",
  "other",
];

const TYPE_LABELS: Record<StatusReportType, string> = {
  still_available: "Still available",
  rented: "Rented",
  sold: "Sold",
  owner_not_renting: "Owner not renting",
  price_changed: "Price changed",
  cannot_contact: "Cannot contact owner",
  wrong_contact: "Wrong contact",
  other: "Other",
};

export function statusReportTypeLabel(type: StatusReportType): string {
  return TYPE_LABELS[type];
}

export type StatusReportStatus = "pending_review" | "confirmed" | "rejected";

const STATUS_LABELS: Record<StatusReportStatus, string> = {
  pending_review: "Pending review",
  confirmed: "Confirmed",
  rejected: "Rejected",
};

const STATUS_TONES: Record<StatusReportStatus, BadgeTone> = {
  pending_review: "warn",
  confirmed: "ok",
  rejected: "dark",
};

export function statusReportStatusLabel(status: StatusReportStatus): string {
  return STATUS_LABELS[status];
}

export function statusReportStatusTone(status: StatusReportStatus): BadgeTone {
  return STATUS_TONES[status];
}

const EFFECTS: Record<StatusReportType, { listingStatus: ListingStatus | null; touchVerified: boolean }> = {
  still_available: { listingStatus: null, touchVerified: true },
  rented: { listingStatus: "rented", touchVerified: false },
  sold: { listingStatus: "sold", touchVerified: false },
  owner_not_renting: { listingStatus: "not_for_rent", touchVerified: false },
  price_changed: { listingStatus: null, touchVerified: false },
  cannot_contact: { listingStatus: null, touchVerified: false },
  wrong_contact: { listingStatus: null, touchVerified: false },
  other: { listingStatus: null, touchVerified: false },
};

export function reportEffect(type: StatusReportType) {
  return EFFECTS[type];
}
