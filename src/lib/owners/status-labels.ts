export type VerificationStatus =
  | "unverified"
  | "possible_owner"
  | "verified_owner"
  | "wrong_contact";

export type ContactStatus =
  | "not_contacted"
  | "no_answer"
  | "contacted"
  | "follow_up"
  | "wrong_number"
  | "do_not_contact";

export const VERIFICATION_STATUSES: VerificationStatus[] = [
  "unverified",
  "possible_owner",
  "verified_owner",
  "wrong_contact",
];

export const CONTACT_STATUSES: ContactStatus[] = [
  "not_contacted",
  "no_answer",
  "contacted",
  "follow_up",
  "wrong_number",
  "do_not_contact",
];

const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  unverified: "Unverified",
  possible_owner: "Possible Owner",
  verified_owner: "Verified Owner",
  wrong_contact: "Wrong Contact",
};

const CONTACT_LABELS: Record<ContactStatus, string> = {
  not_contacted: "Not Contacted",
  no_answer: "No Answer",
  contacted: "Contacted",
  follow_up: "Follow Up",
  wrong_number: "Wrong Number",
  do_not_contact: "Do Not Contact",
};

export function verificationStatusLabel(status: VerificationStatus): string {
  return VERIFICATION_LABELS[status];
}

export function contactStatusLabel(status: ContactStatus): string {
  return CONTACT_LABELS[status];
}
