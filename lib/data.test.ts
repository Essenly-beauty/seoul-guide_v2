import { describe, it, expect } from "vitest";
import { PLACES, PRODUCTS, MAP_CATEGORIES, TYPE_LABEL } from "./data";

describe("PLACES coordinates", () => {
  it("every place has coords inside the Seoul bounding box", () => {
    for (const p of PLACES) {
      expect(p.lat, `${p.id} lat`).toBeGreaterThan(37.4);
      expect(p.lat, `${p.id} lat`).toBeLessThan(37.7);
      expect(p.lng, `${p.id} lng`).toBeGreaterThan(126.8);
      expect(p.lng, `${p.id} lng`).toBeLessThan(127.2);
    }
  });
});

describe("category taxonomy", () => {
  it("chip order: All, Olive Young, Skin Clinic, Hair Salon, Nail & Lash, Personal Color, Head Spa, Etc", () => {
    expect(MAP_CATEGORIES.map((c) => c.key)).toEqual([
      "all", "olive_young", "skin_clinic", "hair_salon", "nail_lash", "personal_color", "head_spa", "etc",
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
