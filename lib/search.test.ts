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

describe("station results (station-first entry point)", () => {
  it("surfaces stations for an area query, capped so places still fit", async () => {
    const { searchAll, STATION_RESULT_LIMIT } = await import("./search");
    const r = searchAll("Gangnam");
    expect(r.stations.length).toBeGreaterThan(0);
    expect(r.stations.length).toBeLessThanOrEqual(STATION_RESULT_LIMIT);
    expect(r.stations[0].id).toBe("gangnam");
    // stations must not displace the other result groups
    expect(r.places.length).toBeGreaterThan(0);
    expect(r.total).toBe(r.stations.length + r.places.length + r.products.length + r.articles.length);
  });

  it("matches Korean station names too", async () => {
    const { searchAll } = await import("./search");
    expect(searchAll("홍대").stations.some((s) => s.id === "hongik_univ")).toBe(true);
  });

  it("stays empty for a blank query", async () => {
    const { searchAll } = await import("./search");
    expect(searchAll("   ").stations).toEqual([]);
  });
});
