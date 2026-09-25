const SPECIAL = /[%_,()*"\`;]/g;

export function sanitizeSearchTerm(raw: string): string {
  return raw.replace(SPECIAL, "").replace(/\s+/g, " ").trim().slice(0, 50).trim();
}
