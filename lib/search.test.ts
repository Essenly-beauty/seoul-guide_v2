import { describe, it, expect } from "vitest";
import { searchAll } from "./search";

describe("searchAll", () => {
  it("returns empty results for blank query", () => {
    expect(searchAll("  ").total).toBe(0);
  });
  it("matches places by English name, case-insensitive", () => {
    const r = searchAll("juno");
    expect(r.places.map((p) => p.id)).toContain("juno-hair-gangnam");
  });
  it("matches places by Korean name (tourist pastes 한글 상호)", () => {
    const r = searchAll("호수");
    expect(r.places.map((p) => p.id)).toContain("hosu-dosan");
  });
  it("matches places by tag and zone label", () => {
    expect(searchAll("scalp").places.length).toBeGreaterThan(0);
    expect(searchAll("hongdae").places.length).toBeGreaterThan(0);
  });
  it("matches products by brand", () => {
    const r = searchAll("cosrx");
    expect(r.products.map((p) => p.id)).toContain("cosrx-snail-mucin");
  });
  it("matches articles by title word", () => {
    const r = searchAll("glass skin");
    expect(r.articles.map((a) => a.slug)).toContain("korean-glass-skin-routine");
  });
  it("total sums all groups", () => {
    const r = searchAll("hair");
    expect(r.total).toBe(r.places.length + r.products.length + r.articles.length);
  });
});
