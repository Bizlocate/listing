import { describe, it, expect } from "vitest";
import { todayInMalaysia } from "./today-my";

describe("todayInMalaysia", () => {
  it("returns a YYYY-MM-DD formatted date", () => {
    const result = todayInMalaysia();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("reflects Malaysia time, not UTC, near a day boundary", () => {
    // 2026-01-01T23:30:00Z is 2026-01-02T07:30:00 in Malaysia (UTC+8) —
    // UTC's own date (Jan 1) would be wrong; Malaysia's date (Jan 2) is correct.
    const fixed = new Date("2026-01-01T23:30:00.000Z");
    const originalDate = global.Date;
    // @ts-expect-error -- minimal Date mock for a fixed-instant test
    global.Date = class extends originalDate {
      constructor(...args: unknown[]) {
        if (args.length === 0) {
          super(fixed.getTime());
        } else {
          // @ts-expect-error -- forwarding constructor args
          super(...args);
        }
      }
    };
    try {
      expect(todayInMalaysia()).toBe("2026-01-02");
    } finally {
      global.Date = originalDate;
    }
  });
});
