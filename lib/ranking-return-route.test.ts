import { describe, expect, it } from "vitest";
import {
  RANKING_RETURN_ROUTE_KEY,
  chooseRankingBackAction,
  consumeRankingReturnRoute,
  rememberRankingReturnRoute,
  sanitizeRankingReturnRoute,
  shouldUseRankingBrowserBack,
} from "./ranking-return-route";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe("ranking return-route evidence", () => {
  const origin = "https://myseouldrop.example";

  it("accepts only same-origin non-ranking routes and normalizes them to relative URLs", () => {
    expect(sanitizeRankingReturnRoute("/blog?tag=skin#latest", origin)).toBe("/blog?tag=skin#latest");
    expect(sanitizeRankingReturnRoute(`${origin}/map?saved=1`, origin)).toBe("/map?saved=1");
    expect(sanitizeRankingReturnRoute("https://evil.example/phish", origin)).toBeNull();
    expect(sanitizeRankingReturnRoute("//evil.example/phish", origin)).toBeNull();
    expect(sanitizeRankingReturnRoute("javascript:alert(1)", origin)).toBeNull();
    expect(sanitizeRankingReturnRoute("/ranking", origin)).toBeNull();
    expect(sanitizeRankingReturnRoute("/ranking?retailer=daiso", origin)).toBeNull();
    expect(sanitizeRankingReturnRoute("/ranking/qa?fixture=empty", origin)).toBeNull();
  });

  it("remembers the current internal route and consumes it exactly once", () => {
    const storage = new MemoryStorage();
    rememberRankingReturnRoute(storage, {
      origin,
      pathname: "/places/daiso",
      search: "?sort=nearby",
      hash: "#results",
    });

    expect(storage.getItem(RANKING_RETURN_ROUTE_KEY)).toBe("/places/daiso?sort=nearby#results");
    expect(consumeRankingReturnRoute(storage, origin)).toBe("/places/daiso?sort=nearby#results");
    expect(consumeRankingReturnRoute(storage, origin)).toBeNull();
  });

  it("drops tampered storage instead of creating an open redirect", () => {
    const storage = new MemoryStorage();
    storage.setItem(RANKING_RETURN_ROUTE_KEY, "https://evil.example/phish");

    expect(consumeRankingReturnRoute(storage, origin)).toBeNull();
    expect(storage.getItem(RANKING_RETURN_ROUTE_KEY)).toBeNull();
  });

  it("uses app-owned evidence on Safari-style history without Navigation API or referrer", () => {
    const browserBackSafe = shouldUseRankingBrowserBack({
      origin,
      historyLength: 5,
      referrer: "",
    });

    expect(browserBackSafe).toBe(false);
    expect(chooseRankingBackAction(browserBackSafe, "/blog?tag=beauty", "/map")).toEqual({
      kind: "replace",
      href: "/blog?tag=beauty",
    });
  });

  it("uses browser Back only with proof and otherwise falls back to Map", () => {
    expect(chooseRankingBackAction(true, "/blog", "/map")).toEqual({ kind: "back" });
    expect(chooseRankingBackAction(false, null, "/map")).toEqual({
      kind: "replace",
      href: "/map",
    });
  });

  it("never treats a prior Ranking URL as safe Back evidence", () => {
    expect(shouldUseRankingBrowserBack({
      origin,
      historyLength: 4,
      referrer: "",
      navigationCurrentIndex: 3,
      navigationEntries: [{ index: 2, url: `${origin}/ranking?retailer=daiso` }],
    })).toBe(false);
    expect(shouldUseRankingBrowserBack({
      origin,
      historyLength: 2,
      referrer: `${origin}/ranking?retailer=olive_young`,
    })).toBe(false);
  });
});
