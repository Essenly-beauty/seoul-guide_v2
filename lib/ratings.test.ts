import { afterEach, describe, expect, it, vi } from "vitest";
import { canEditMyReview, parseRatings } from "./ratings";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

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

describe("guest review publication boundary", () => {
  it("saves a guest's public request privately and reports the actual result", async () => {
    const storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
    vi.resetModules();
    const { setReview } = await import("./ratings");

    expect(await setReview("place-a", 4, "Useful visit tip", true)).toBe("private");
    const stored = JSON.parse(storage.getItem("essenly.myrating") ?? "{}");
    expect(stored["place-a"]).toMatchObject({ rating: 4, body: "Useful visit tip" });
    expect(stored["place-a"].isPublic).not.toBe(true);
  });

  it("treats a legacy guest public flag as private before the next save", async () => {
    const storage = memoryStorage({
      "essenly.myrating": JSON.stringify({ "place-a": { rating: 4, body: "Old guest note", isPublic: true } }),
    });
    vi.stubGlobal("localStorage", storage);
    vi.resetModules();
    const { setReview } = await import("./ratings");

    await setReview("place-b", 5, "Another note", false);
    const stored = JSON.parse(storage.getItem("essenly.myrating") ?? "{}");
    expect(stored["place-a"].isPublic).not.toBe(true);
  });

  it("never marks a guest review public when preparing account merge rows", async () => {
    const ratings = await import("./ratings") as typeof import("./ratings") & {
      guestMergeRows?: (uid: string, local: Record<string, { rating: number; body?: string; isPublic?: boolean }>) => Array<{ is_public?: boolean }>;
    };
    const rows = ratings.guestMergeRows?.("member-a", {
      "place-a": { rating: 4, body: "Old guest note", isPublic: true },
    });
    expect(rows).toMatchObject([{ is_public: false }]);
  });
});
