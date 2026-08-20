import { describe, expect, it } from "vitest";
import { canEditMyReview, parseRatings } from "./ratings";

describe("parseRatings", () => {
  it("upgrades the legacy bare-number shape", () => {
    expect(parseRatings({ "juno-hair-gangnam": 4, "oy-학동중앙점": 5 })).toEqual({
      "juno-hair-gangnam": { rating: 4 },
      "oy-학동중앙점": { rating: 5 },
    });
  });

  it("keeps the current object shape with timestamps", () => {
    expect(parseRatings({ a: { rating: 3, at: "2026-08-11T00:00:00Z" } })).toEqual({
      a: { rating: 3, at: "2026-08-11T00:00:00Z" },
    });
  });

  it("keeps a valid review body, drops empty/oversized/non-string ones", () => {
    expect(parseRatings({ a: { rating: 4, body: "Great cut, English OK" } })).toEqual({
      a: { rating: 4, body: "Great cut, English OK" },
    });
    expect(parseRatings({
      b: { rating: 4, body: "" },
      c: { rating: 4, body: "x".repeat(2001) },
      d: { rating: 4, body: 7 },
    })).toEqual({ b: { rating: 4 }, c: { rating: 4 }, d: { rating: 4 } });
  });

  it("drops out-of-range, malformed, and non-object input", () => {
    expect(parseRatings({ a: 0, b: 6, c: "5", d: { rating: 9 }, e: null, f: { at: "x" } })).toEqual({});
    expect(parseRatings(null)).toEqual({});
    expect(parseRatings("junk")).toEqual({});
    expect(parseRatings([1, 2])).toEqual({});
  });

  it("mixes both shapes in one map", () => {
    expect(parseRatings({ old: 2, new: { rating: 5, at: "2026-08-11T09:00:00Z" }, bad: -1 })).toEqual({
      old: { rating: 2 },
      new: { rating: 5, at: "2026-08-11T09:00:00Z" },
    });
  });
});

describe("review edit policy", () => {
  it("only offers editing for an owned rating record", () => {
    expect(canEditMyReview({ rating: 4, body: "Careful consultation" })).toBe(true);
    expect(canEditMyReview({ rating: 2 })).toBe(true);
    expect(canEditMyReview(undefined)).toBe(false);
    expect(canEditMyReview(null)).toBe(false);
  });
});
