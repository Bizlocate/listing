import { badgeToneClasses, type BadgeTone } from "@/lib/ui/badge-tone";

export function Badge({
  tone,
  children,
}: {
  tone: BadgeTone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex flex-none items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${badgeToneClasses(tone)}`}
    >
      {children}
    </span>
  );
}
