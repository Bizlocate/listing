const LABELS: Record<string, string> = {
  "units.insert": "Unit created",
  "units.update": "Unit updated",
  "units.delete": "Unit deleted",
  "unit_spaces.insert": "Space added",
  "unit_spaces.update": "Space updated",
  "unit_spaces.delete": "Space removed",
  "unit_ownerships.insert": "Owner linked",
  "unit_ownerships.update": "Owner link updated",
  "unit_ownerships.delete": "Owner unlinked",
  "listings.insert": "Listing created",
  "listings.update": "Listing updated",
  "listings.delete": "Listing deleted",
  "owner_search_tasks.insert": "Owner search started",
  "owner_search_tasks.update": "Owner search updated",
  "owner_search_tasks.delete": "Owner search removed",
  "unit_submissions.insert": "Unit submitted",
  "unit_submissions.update": "Submission reviewed",
  "contact_requests.insert": "Owner contact requested",
  "contact_requests.update": "Contact request updated",
  "contact_access_logs.insert": "Owner contact access granted",
  "contact_access_logs.update": "Owner contact access changed",
  "listing_status_reports.insert": "Status reported",
  "listing_status_reports.update": "Status report reviewed",
  "owners.insert": "Owner created",
  "owners.update": "Owner updated",
  "owners.delete": "Owner deleted",
  "profiles.insert": "User created",
  "profiles.update": "User role changed",
  "area_admins.insert": "Area admin assigned",
  "area_admins.delete": "Area admin removed",
};

export function describeActivity(action: string, detail: string | null): string {
  const base = LABELS[action] ?? action;
  return detail ? `${base}: ${detail}` : base;
}

export function changedKeys(
  prev: Record<string, unknown> | null,
  next: Record<string, unknown> | null,
): string[] {
  const keys = new Set([...Object.keys(prev ?? {}), ...Object.keys(next ?? {})]);
  return [...keys]
    .filter((k) => JSON.stringify(prev?.[k]) !== JSON.stringify(next?.[k]))
    .sort();
}
