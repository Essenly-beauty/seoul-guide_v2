import { describe, it, expect } from "vitest";
import { PLACES, PRODUCTS, MAP_CATEGORIES, TYPE_LABEL } from "./data";

describe("PLACES coordinates", () => {
  // The Creatrip import added Busan and Gyeonggi places; per-metro checks live
  // in creatrip-places.test.ts. Here: everything is at least inside Korea, and
  // places in a Seoul zone really are in Seoul.
  it("every place has coords inside the Korea bounding box", () => {
    for (const p of PLACES) {
      expect(p.lat, `${p.id} lat`).toBeGreaterThan(33);
      expect(p.lat, `${p.id} lat`).toBeLessThan(38.7);
      expect(p.lng, `${p.id} lng`).toBeGreaterThan(124.5);
      expect(p.lng, `${p.id} lng`).toBeLessThan(132);
    }
  });

  it("places in Seoul zones stay inside the Seoul bounding box", () => {
    for (const p of PLACES) {
      if (p.zone === "busan" || p.zone === "gyeonggi") continue;
      expect(p.lat, `${p.id} lat`).toBeGreaterThan(37.4);
      expect(p.lat, `${p.id} lat`).toBeLessThan(37.75);
      expect(p.lng, `${p.id} lng`).toBeGreaterThan(126.75);
      expect(p.lng, `${p.id} lng`).toBeLessThan(127.2);
    }
  });
});

describe("category taxonomy", () => {
  it("chip order: All, Olive Young, Skin Clinic, Hair Salon, Nail & Lash, Personal Color, Head Spa, Mall & Gifts, Etc", () => {
    expect(MAP_CATEGORIES.map((c) => c.key)).toEqual([
      "all", "olive_young", "skin_clinic", "hair_salon", "nail_lash", "personal_color", "head_spa", "mall", "etc",
    ]);
  });
  it("every non-all category has at least one place", () => {
    for (const c of MAP_CATEGORIES.filter((c) => c.key !== "all")) {
      expect(PLACES.some((p) => p.type === c.key), `no place for ${c.key}`).toBe(true);
    }
  });
  it("every place type has a label", () => {
    for (const p of PLACES) expect(TYPE_LABEL[p.type], p.id).toBeTruthy();
  });
});

describe("product ranking fields", () => {
  it("salesRank and reviewRank are unique 1..N", () => {
    const sales = PRODUCTS.map((p) => p.salesRank).sort((a, b) => a - b);
    const review = PRODUCTS.map((p) => p.reviewRank).sort((a, b) => a - b);
    const expected = PRODUCTS.map((_, i) => i + 1);
    expect(sales).toEqual(expected);
    expect(review).toEqual(expected);
  });
});

describe("place rating provenance", () => {
  it("does not expose seed ratings from curated rows", () => {
    const curated = PLACES.filter((p) => p.source === "curated");
    const sourced = PLACES.filter((p) => p.source !== "curated" && p.rating !== undefined);

    expect(curated.length).toBe(44);
    expect(curated.every((p) => p.rating === undefined && p.ratingCount === undefined)).toBe(true);
    expect(sourced.length).toBeGreaterThan(0);
  });
});
