import { describe, expect, it } from "vitest";
import { matchRange, rankPlaces } from "./search";
import { googleDirectionsUrl, kakaoRouteUrl, naverRouteUrl } from "./geo";
import { MAP_CATEGORIES, TYPE_COLOR, type PlaceType } from "./data";

const ORIGIN = { lat: 37.53, lng: 126.96 }; // near Yongsan

describe("rankPlaces (spec v2 §4.4)", () => {
  it("returns nothing for an empty query", () => {
    expect(rankPlaces("").results).toHaveLength(0);
    expect(rankPlaces("   ").similar).toHaveLength(0);
  });

  it("puts an exact name match first", () => {
    const { results } = rankPlaces("Dragon Hill Spa", ORIGIN);
    expect(results[0]?.place.id).toBe("dragon-hill-spa");
    expect(results[0]?.score).toBe(100);
  });

  it("ranks prefix matches above substring/tag matches", () => {
    const { results } = rankPlaces("dragon", ORIGIN);
    expect(results[0]?.place.id).toBe("dragon-hill-spa");
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it("suggests same-category places as similar, excluding direct hits", () => {
    const { results, similar } = rankPlaces("dragon hill", ORIGIN);
    const topType = results[0].place.type;
    const hitIds = new Set(results.map((r) => r.place.id));
    for (const s of similar) {
      expect(s.place.type).toBe(topType);
      expect(hitIds.has(s.place.id)).toBe(false);
    }
    expect(similar.length).toBeLessThanOrEqual(3);
  });

  it("breaks score ties by distance (closest first)", () => {
    const { results } = rankPlaces("olive young", ORIGIN);
    const tied = results.filter((r) => r.score === results[0].score);
    for (let i = 1; i < tied.length; i++) {
      expect(tied[i - 1].km).toBeLessThanOrEqual(tied[i].km);
    }
  });
});

describe("matchRange", () => {
  it("finds the first case-insensitive occurrence", () => {
    expect(matchRange("Dragon Hill Spa", "dragon")).toEqual([0, 6]);
    expect(matchRange("Olive Young Myeongdong", "young")).toEqual([6, 11]);
    expect(matchRange("Dragon Hill Spa", "zzz")).toBeNull();
  });
});

describe("route deep links (spec v2 §6)", () => {
  const dest = { lat: 37.5299, lng: 126.9646 };
  const origin = { lat: 37.5, lng: 127.0 };

  it("google: origin+destination when origin is known, destination-only otherwise", () => {
    expect(googleDirectionsUrl(dest, origin)).toContain("origin=37.5,127");
    expect(googleDirectionsUrl(dest, origin)).toContain("destination=37.5299,126.9646");
    expect(googleDirectionsUrl(dest)).not.toContain("origin=");
    expect(googleDirectionsUrl(dest, origin, "walking")).toContain("travelmode=walking");
  });

  it("kakao: from/to route with origin, to-link without", () => {
    expect(kakaoRouteUrl("드래곤힐", dest, origin)).toContain("/link/from/");
    expect(kakaoRouteUrl("드래곤힐", dest)).toContain("/link/to/");
  });

  it("naver: directions path with origin, search fallback without", () => {
    expect(naverRouteUrl("드래곤힐", dest, origin)).toContain("/p/directions/");
    expect(naverRouteUrl("드래곤힐", dest)).toContain("/p/search/");
  });
});

describe("TYPE_COLOR", () => {
  it("covers every map category", () => {
    for (const c of MAP_CATEGORIES) {
      if (c.key === "all") continue;
      expect(TYPE_COLOR[c.key as PlaceType]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
