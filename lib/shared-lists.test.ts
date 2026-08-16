import { describe, expect, it } from "vitest";
import { PLACES } from "@/lib/data";
import {
  LIST_PLACES_MAX,
  LIST_TITLE_MAX,
  looksLikeListId,
  sanitizeListPlaceIds,
  sanitizeListTitle,
  sharedListUrl,
} from "@/lib/shared-lists";

describe("shared list sanitizers", () => {
  it("trims, collapses whitespace, and falls back on empty titles", () => {
    expect(sanitizeListTitle("  Seoul   weekend  ")).toBe("Seoul weekend");
    expect(sanitizeListTitle("")).toBe("My Seoul list");
    expect(sanitizeListTitle("   ")).toBe("My Seoul list");
    expect(sanitizeListTitle(null)).toBe("My Seoul list");
    expect(sanitizeListTitle("x".repeat(200))).toHaveLength(LIST_TITLE_MAX);
  });

  it("keeps only real place ids, deduped and capped", () => {
    const real = PLACES.slice(0, 3).map((p) => p.id);
    expect(sanitizeListPlaceIds([real[0], "nope", real[0], real[1], real[2]])).toEqual(real);
    const flood = PLACES.map((p) => p.id);
    expect(sanitizeListPlaceIds(flood).length).toBeLessThanOrEqual(LIST_PLACES_MAX);
  });

  it("builds the /map?list= capability URL", () => {
    expect(sharedListUrl("https://myseouldrop.app", "abc-123")).toBe("https://myseouldrop.app/map?list=abc-123");
  });

  it("recognizes uuid-shaped list ids only", () => {
    expect(looksLikeListId("2f9c1a34-9c1d-4e7a-b1f2-3d4e5f607182")).toBe(true);
    expect(looksLikeListId("hello")).toBe(false);
    expect(looksLikeListId("")).toBe(false);
    expect(looksLikeListId("2f9c1a34-9c1d-4e7a-b1f2-3d4e5f60718g")).toBe(false);
  });
});
