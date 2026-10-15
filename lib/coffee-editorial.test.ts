import { describe, expect, it } from "vitest";
import { COFFEE_EDITORIAL_SERIES } from "./generated/coffee-editorial";

describe("coffee editorial preview data", () => {
  it("ships all eight six-place series", () => {
    expect(COFFEE_EDITORIAL_SERIES).toHaveLength(8);
    expect(COFFEE_EDITORIAL_SERIES.every((series) => series.places.length === 6)).toBe(true);
  });

  it("keeps route slugs and canonical place ids usable", () => {
    const slugs = COFFEE_EDITORIAL_SERIES.map((series) => series.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const series of COFFEE_EDITORIAL_SERIES) {
      expect(series.slug).toMatch(/^[a-z0-9-]+$/);
      for (const place of series.places) expect(place.canonicalPlaceId).toMatch(/^seoul:/);
    }
  });
});
