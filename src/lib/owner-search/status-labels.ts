import type { BadgeTone } from "@/lib/ui/badge-tone";

export type OwnerSearchTaskStatus =
  | "need_search"
  | "number_found"
  | "contacting"
  | "owner_confirmed"
  | "wrong_number"
  | "unable_to_reach"
  | "follow_up_later";

export const OWNER_SEARCH_STATUSES: OwnerSearchTaskStatus[] = [
  "need_search",
  "number_found",
  "contacting",
  "owner_confirmed",
  "wrong_number",
  "unable_to_reach",
  "follow_up_later",
];

const STATUS_LABELS: Record<OwnerSearchTaskStatus, string> = {
  need_search: "Need Search",
  number_found: "Number Found",
  contacting: "Contacting",
  owner_confirmed: "Owner Confirmed",
  wrong_number: "Wrong Number",
  unable_to_reach: "Unable to Reach",
  follow_up_later: "Follow Up Later",
};

const STATUS_TONES: Record<OwnerSearchTaskStatus, BadgeTone> = {
  need_search: "neutral",
  number_found: "accent",
  contacting: "warn",
  owner_confirmed: "ok",
  wrong_number: "dark",
  unable_to_reach: "dark",
  follow_up_later: "warn",
};

export function ownerSearchStatusLabel(status: OwnerSearchTaskStatus): string {
  return STATUS_LABELS[status];
}

export function ownerSearchStatusTone(status: OwnerSearchTaskStatus): BadgeTone {
  return STATUS_TONES[status];
}

export function isOwnerSearchTaskOpen(status: OwnerSearchTaskStatus): boolean {
  return status !== "owner_confirmed" && status !== "wrong_number" && status !== "unable_to_reach";
}
