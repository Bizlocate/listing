const DAY_MS = 86_400_000;

export function daysBetween(fromDate: string, toDate: string): number {
  return Math.round((Date.parse(toDate) - Date.parse(fromDate)) / DAY_MS);
}

export function isAging(
  lastVerifiedDate: string | null,
  createdAt: string,
  today: string,
  days = 45,
): boolean {
  const reference = lastVerifiedDate ?? createdAt.slice(0, 10);
  return daysBetween(reference, today) >= days;
}

export function timeAgo(iso: string, nowMs: number): string {
  const minutes = Math.floor((nowMs - Date.parse(iso)) / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
}
