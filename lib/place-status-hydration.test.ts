import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("place status hydration", () => {
  it("reserves a stable status slot until client time is available", () => {
    const liveBadge = source("components/ui/live-badge.tsx");
    expect(liveBadge).toContain('useState<Date | null>(null)');
    expect(liveBadge).toContain('useEffect(() => setNow(new Date()), [])');
    expect(liveBadge).toContain('className="livebadge loading"');
    expect(liveBadge).toContain('placeStatus(hours, now)');
  });

  it("renders textual open, closed, and unknown variants in the same badge family", () => {
    const liveBadge = source("components/ui/live-badge.tsx");
    expect(liveBadge).toContain('className="livebadge open"');
    expect(liveBadge).toContain('className="livebadge closed"');
    expect(liveBadge).toContain('className="livebadge unknown"');
    expect(liveBadge).toContain("Hours unknown");
  });

  it("does not choose today's row or hours label during server render", () => {
    const detail = source("components/place/place-detail-body.tsx");
    expect(detail).toContain('useState<number | null>(null)');
    expect(detail).toContain('useEffect(() => setToday(new Date().getDay()), [])');
    expect(detail).not.toContain('const today = new Date().getDay()');
    expect(detail).toContain('today !== null && i === today');
  });

  it("resolves the 'until' time against the visitor's own day", () => {
    // With per-day hours the closing time itself is day-dependent, so a badge
    // that read hours.close directly would advertise the weekday close on a
    // Sunday. Both reads go through the same already-mounted `now`.
    const liveBadge = source("components/ui/live-badge.tsx");
    expect(liveBadge).toContain("hoursToday(hours, now)");
    expect(liveBadge).not.toMatch(/\{hours\.close\}/);
  });

  it("defers the 'today' hours line the same way the badge defers its status", () => {
    const hoursToday = source("components/ui/hours-today.tsx");
    expect(hoursToday).toContain('"use client"');
    expect(hoursToday).toContain("useState<Date | null>(null)");
    expect(hoursToday).toContain("useEffect(() => setNow(new Date()), [])");
    expect(hoursToday).toContain("hoursToday(hours, now)");
    // A day the place is shut says so instead of printing a range.
    expect(hoursToday).toContain("Closed today");
    // The detail page must use it rather than printing a fixed pair as "today".
    const detail = source("components/place/place-detail-body.tsx");
    expect(detail).toContain("<HoursToday hours={place.hours} />");
    expect(detail).not.toContain("today</span>");
  });

  it("prints each weekday's own hours, and marks a closed day closed", () => {
    const detail = source("components/place/place-detail-body.tsx");
    // The seven rows resolve per day instead of repeating one pair.
    expect(detail).toContain("hoursOn(place.hours, i)");
    expect(detail).toContain('dayHours ? `${dayHours.open} – ${dayHours.close}` : "Closed"');
    expect(detail).not.toMatch(/place\.hours!\.open\} – \{place\.hours!\.close/);
  });
});
