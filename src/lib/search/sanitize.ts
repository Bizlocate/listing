// Strips PostgREST filter / LIKE specials (% _ , ( ) * " \ ` ;) and control characters.
const SPECIAL = /[%_,()*"\\`;\p{C}]/gu;

export function sanitizeSearchTerm(raw: string): string {
  // Collapse whitespace first so tabs/newlines become spaces rather than being stripped as control chars.
  return raw.replace(/\s+/g, " ").replace(SPECIAL, "").trim().slice(0, 50).trim();
}
