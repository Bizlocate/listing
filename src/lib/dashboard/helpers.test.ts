import { describe, it, expect } from "vitest";
import { daysBetween, isAging, timeAgo } from "./helpers";

describe("daysBetween", () => {
  it("returns 0 for the same day", () => {
    expect(daysBetween("2026-03-01", "2026-03-01")).toBe(0);
  });
  it("counts whole days", () => {
    expect(daysBetween("2026-03-01", "2026-03-11")).toBe(10);
  });
  it("crosses month and year boundaries", () => {
    expect(daysBetween("2025-12-31", "2026-01-01")).toBe(1);
    expect(daysBetween("2026-02-28", "2026-03-01")).toBe(1);
  });
  it("is negative when to is before from", () => {
    expect(daysBetween("2026-03-11", "2026-03-01")).toBe(-10);
  });
});

describe("isAging", () => {
  it("is not aging at 44 days", () => {
    expect(isAging("2026-01-01", "2025-01-01T00:00:00Z", "2026-02-14")).toBe(false);
  });
  it("is aging at exactly 45 days", () => {
    expect(isAging("2026-01-01", "2025-01-01T00:00:00Z", "2026-02-15")).toBe(true);
  });
  it("falls back to createdAt date when never verified", () => {
    expect(isAging(null, "2026-01-01T10:00:00Z", "2026-02-14")).toBe(false);
    expect(isAging(null, "2026-01-01T10:00:00Z", "2026-02-15")).toBe(true);
  });
  it("derives the createdAt date in Malaysia time, not UTC", () => {
    // 2026-01-01T20:00Z is 2026-01-02 in MYT: 44 days to 02-15 (UTC slice would say 45)
    expect(isAging(null, "2026-01-01T20:00:00Z", "2026-02-15")).toBe(false);
    expect(isAging(null, "2026-01-01T20:00:00Z", "2026-02-16")).toBe(true);
  });
  it("prefers lastVerifiedDate over createdAt", () => {
    expect(isAging("2026-02-10", "2025-01-01T00:00:00Z", "2026-02-15")).toBe(false);
  });
  it("honours a custom days threshold", () => {
    expect(isAging("2026-01-01", "2025-01-01T00:00:00Z", "2026-01-31", 30)).toBe(true);
    expect(isAging("2026-01-01", "2025-01-01T00:00:00Z", "2026-01-30", 30)).toBe(false);
  });
});

describe("timeAgo", () => {
  const now = Date.parse("2026-03-10T12:00:00Z");
  const ago = (ms: number) => new Date(now - ms).toISOString();
  const MIN = 60_000;
  const HOUR = 60 * MIN;

  it("is a minimum of 1m", () => {
    expect(timeAgo(ago(0), now)).toBe("1m");
    expect(timeAgo(ago(30_000), now)).toBe("1m");
  });
  it("uses minutes below an hour", () => {
    expect(timeAgo(ago(5 * MIN), now)).toBe("5m");
    expect(timeAgo(ago(59 * MIN), now)).toBe("59m");
  });
  it("switches to hours at 60m", () => {
    expect(timeAgo(ago(60 * MIN), now)).toBe("1h");
    expect(timeAgo(ago(23 * HOUR), now)).toBe("23h");
  });
  it("switches to days at 24h", () => {
    expect(timeAgo(ago(24 * HOUR), now)).toBe("1d");
    expect(timeAgo(ago(72 * HOUR), now)).toBe("3d");
  });
});
