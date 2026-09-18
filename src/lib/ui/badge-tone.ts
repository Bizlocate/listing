export type BadgeTone = "ok" | "warn" | "accent" | "neutral" | "dark";

const TONE_CLASSES: Record<BadgeTone, string> = {
  ok: "bg-emerald-50 text-emerald-700",
  warn: "bg-amber-50 text-amber-800",
  accent: "bg-sky-100 text-sky-800",
  neutral: "bg-slate-100 text-slate-700",
  dark: "bg-slate-900 text-white",
};

export function badgeToneClasses(tone: BadgeTone): string {
  return TONE_CLASSES[tone];
}
