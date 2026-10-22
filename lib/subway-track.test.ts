import { describe, expect, it } from "vitest";
import { routeTrackDensity, stopOffset } from "./subway-track";

describe("route track geometry", () => {
  it("places stops at even fractions of the rail", () => {
    expect(stopOffset(0, 16)).toBe("0%");
    expect(stopOffset(15, 16)).toBe("100%");
    expect(stopOffset(1, 5)).toBe("25%");
    expect(stopOffset(1, 1)).toBe("100%"); // a one-stop route never divides by zero
  });

  it("picks density from the measured spacing, so a 48-stop trip fits a 320px phone", () => {
    expect(routeTrackDensity(48, 262)).toBe("2"); // 5.6px per stop: ends, transfers and the active stop only
    expect(routeTrackDensity(48, 400)).toBe("1"); // 8.5px: small dots
    expect(routeTrackDensity(16, 262)).toBe("0"); // 17px: full dots
    expect(routeTrackDensity(39, 342)).toBe("1"); // the 2026-10-20 owner report, 342px sheet
  });

  it("falls back to the stop count before the rail is measured", () => {
    expect(routeTrackDensity(16, 0)).toBe("0");
    expect(routeTrackDensity(39, 0)).toBe("1");
    expect(routeTrackDensity(60, 0)).toBe("2");
  });
});
