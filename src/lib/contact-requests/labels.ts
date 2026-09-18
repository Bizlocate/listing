import type { BadgeTone } from "@/lib/ui/badge-tone";

export type ContactRequestReason =
  | "have_tenant"
  | "arrange_viewing"
  | "rental_negotiation"
  | "listing_verification"
  | "other";

export const CONTACT_REQUEST_REASONS: ContactRequestReason[] = [
  "have_tenant",
  "arrange_viewing",
  "rental_negotiation",
  "listing_verification",
  "other",
];

const REASON_LABELS: Record<ContactRequestReason, string> = {
  have_tenant: "I have a tenant",
  arrange_viewing: "Arrange viewing",
  rental_negotiation: "Rental negotiation",
  listing_verification: "Listing verification",
  other: "Other",
};

export function contactRequestReasonLabel(reason: ContactRequestReason): string {
  return REASON_LABELS[reason];
}

export type ContactRequestStatus = "pending" | "approved" | "rejected" | "expired";

const STATUS_LABELS: Record<ContactRequestStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  expired: "Expired",
};

const STATUS_TONES: Record<ContactRequestStatus, BadgeTone> = {
  pending: "warn",
  approved: "ok",
  rejected: "dark",
  expired: "neutral",
};

export function contactRequestStatusLabel(status: ContactRequestStatus): string {
  return STATUS_LABELS[status];
}

export function contactRequestStatusTone(status: ContactRequestStatus): BadgeTone {
  return STATUS_TONES[status];
}

export function isContactAccessActive(accessExpiry: string, revoked: boolean): boolean {
  return !revoked && new Date(accessExpiry).getTime() > Date.now();
}
