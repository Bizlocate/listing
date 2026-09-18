import { describe, it, expect } from "vitest";
import { badgeToneClasses } from "./badge-tone";

describe("badgeToneClasses", () => {
  it("returns distinct classes for every tone", () => {
    expect(badgeToneClasses("ok")).toBe("bg-emerald-50 text-emerald-700");
    expect(badgeToneClasses("warn")).toBe("bg-amber-50 text-amber-800");
    expect(badgeToneClasses("accent")).toBe("bg-sky-100 text-sky-800");
    expect(badgeToneClasses("neutral")).toBe("bg-slate-100 text-slate-700");
    expect(badgeToneClasses("dark")).toBe("bg-slate-900 text-white");
  });
});
