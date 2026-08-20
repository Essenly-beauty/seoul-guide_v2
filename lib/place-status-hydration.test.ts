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
});
