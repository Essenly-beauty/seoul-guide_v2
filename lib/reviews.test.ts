import { describe, expect, it } from "vitest";
import { REPORT_REASONS, timeAgo } from "@/lib/reviews";

describe("timeAgo", () => {
  const now = new Date("2026-08-16T12:00:00Z");
  it("buckets minutes, hours, days, months, years", () => {
    expect(timeAgo("2026-08-16T11:59:40Z", now)).toBe("just now");
    expect(timeAgo("2026-08-16T11:15:00Z", now)).toBe("45m ago");
    expect(timeAgo("2026-08-16T04:00:00Z", now)).toBe("8h ago");
    expect(timeAgo("2026-08-13T12:00:00Z", now)).toBe("3d ago");
    expect(timeAgo("2026-06-10T12:00:00Z", now)).toBe("2mo ago");
    expect(timeAgo("2024-08-16T12:00:00Z", now)).toBe("2y ago");
  });
  it("never goes negative on clock skew and swallows junk", () => {
    expect(timeAgo("2026-08-16T12:05:00Z", now)).toBe("just now");
    expect(timeAgo("not-a-date", now)).toBe("");
  });
});

describe("report reasons", () => {
  it("match the DB check constraint", () => {
    expect(REPORT_REASONS.map((r) => r.key)).toEqual(["spam", "offensive", "off_topic", "other"]);
  });
});
