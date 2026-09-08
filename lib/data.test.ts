import { describe, it, expect } from "vitest";
import {
  CATALOGUE_PLACES,
  CATEGORY_DEFINITIONS,
  CATEGORY_META,
  PLACES,
  PRODUCTS,
  MAP_CATEGORIES,
  TYPE_LABEL,
} from "./data";

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
  it("labels Daiso as Daiso", () => {
    expect(TYPE_LABEL.daiso).toBe("Daiso");
  });

  it("registers Daiso immediately after Olive Young", () => {
    const oliveYoungIndex = CATEGORY_DEFINITIONS.findIndex((category) => category.key === "olive_young");
    expect(CATEGORY_DEFINITIONS[oliveYoungIndex + 1]?.key).toBe("daiso");
  });

  it("begins the public map filters with All, Olive Young, and Daiso", () => {
    expect(MAP_CATEGORIES.slice(0, 3).map((category) => category.key)).toEqual([
      "all",
      "olive_young",
      "daiso",
    ]);
  });

  it("publishes data-backed categories in definition order", () => {
    const expectedKeys = CATEGORY_DEFINITIONS
      .filter((category) =>
        category.key === "all" || PLACES.some((place) => place.type === category.key))
      .map((category) => category.key);

    expect(MAP_CATEGORIES.map((category) => category.key)).toEqual(expectedKeys);
  });
  it("does not offer an empty category publicly", () => {
    for (const c of MAP_CATEGORIES.filter((c) => c.key !== "all")) {
      expect(PLACES.some((p) => p.type === c.key), `no place for ${c.key}`).toBe(true);
    }
  });
  it("every place type has a label", () => {
    for (const p of PLACES) expect(TYPE_LABEL[p.type], p.id).toBeTruthy();
  });
});

describe("Daiso publication", () => {
  it("publishes all 251 official stores through the public place boundary", () => {
    const daisoPlaces = PLACES.filter((place) => place.type === "daiso");

    expect(daisoPlaces).toHaveLength(251);
    expect(daisoPlaces.every((place) => place.source === "daiso")).toBe(true);
  });

  it("adds the 251 stores to catalogue and public totals without hardcoding unrelated counts", () => {
    const catalogueWithoutDaiso = CATALOGUE_PLACES.filter((place) => place.type !== "daiso");
    const publicWithoutDaiso = PLACES.filter((place) => place.type !== "daiso");

    expect(CATALOGUE_PLACES).toHaveLength(catalogueWithoutDaiso.length + 251);
    expect(PLACES).toHaveLength(publicWithoutDaiso.length + 251);
  });

  it("keeps the audited launch totals in sync with Daiso publication", () => {
    expect(CATALOGUE_PLACES).toHaveLength(851);
    expect(PLACES).toHaveLength(726);
  });

  it("describes provisional names as officially sourced instead of verified", () => {
    expect(CATEGORY_META.daiso.blurb).toContain("Officially sourced Seoul store listings");
    expect(CATEGORY_META.daiso.blurb).not.toMatch(/verified/i);
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
  it("does not publish hand-curated prototype rows before venue verification", () => {
    const curated = PLACES.filter((p) => p.source === "curated");
    const sourced = PLACES.filter((p) => p.source !== "curated" && p.rating !== undefined);

    expect(curated).toEqual([]);
    expect(sourced.length).toBeGreaterThan(0);
  });

  it("keeps unresolved and duplicate records out of public discovery", () => {
    const hiddenIds = [
      "ados-daelimjung-angsijang",
      "ados-seoul-bamdokkaebi-night-market-yeouido",
      "colorlab-gangnam",
      "dragon-hill-spa",
      "glow-skin-clinic",
      "lumiere-derma",
      "sulwha-clinic",
    ];

    expect(PLACES.filter((place) => hiddenIds.includes(place.id)).map((place) => place.id)).toEqual([]);
  });

  it("preserves regional and low-confidence source rows internally but pauses them publicly", () => {
    const outsideSeoul = (place: (typeof CATALOGUE_PLACES)[number]) =>
      place.zone === "busan" || place.zone === "gyeonggi" || /^(부산|경기)\s/.test(place.address);

    expect(CATALOGUE_PLACES.some(outsideSeoul)).toBe(true);
    expect(CATALOGUE_PLACES.some((place) => !place.address || place.geoSource === "area")).toBe(true);

    expect(PLACES.filter(outsideSeoul).map((place) => place.id))
      .toEqual([]);
    expect(PLACES.filter((place) => !place.address || place.geoSource === "area").map((place) => place.id))
      .toEqual([]);
  });

  it("publishes manually verified Korean listings at their corrected addresses and pins", () => {
    const expected = {
      "ados-daerim-central-market": ["대림중앙시장", "서울 영등포구 디지털로37나길 21", 37.4910328, 126.8993823],
      "ados-haebangchon-sinheungsijang": ["해방촌 신흥시장", "서울 용산구 신흥로 95-9 2층", 37.5454213, 126.9850088],
      "ados-jongmyo-shrine": ["종묘", "서울 종로구 종로 157", 37.5758018, 126.9939555],
      "ct-more-on-hair-seongsu-branch": ["모어온헤어 성수점", "서울 성동구 왕십리로 106 3층", 37.5470168, 127.0448258],
      "ct-onyad-hair-personalized-hair-consultation-stylin": ["온야드 서울숲본점", "서울 성동구 왕십리로 66-10 2층, 3층 온야드", 37.5432321, 127.0449469],
      "oy-동묘앞역점": ["올리브영 동묘앞역점", "서울 종로구 종로 346", 37.5729505, 127.0162282],
    } as const;

    for (const [id, [nameKr, address, lat, lng]] of Object.entries(expected)) {
      const place = PLACES.find((candidate) => candidate.id === id);
      expect(place, id).toBeDefined();
      expect(place?.nameKr, `${id} Korean name`).toBe(nameKr);
      expect(place?.address, `${id} address`).toBe(address);
      expect(place?.lat, `${id} latitude`).toBe(lat);
      expect(place?.lng, `${id} longitude`).toBe(lng);
    }
  });
});

describe("no source placeholders reach a visitor", () => {
  it("normalises the scraper's own 'not enough information' address away", async () => {
    const { PLACES } = await import("@/lib/data");
    // 48 ados rows carried "정보 부족" as their address. Rendering a source's
    // internal placeholder is worse than showing nothing (owner audit
    // 2026-08-23), so it is stripped at the data-layer boundary.
    const leaked = PLACES.filter((p) => /정보\s*부족/.test(p.address));
    expect(leaked.map((p) => p.id)).toEqual([]);
  });

  it("leaves real addresses untouched", async () => {
    const { PLACES, getPlace } = await import("@/lib/data");
    expect(getPlace("oy-동묘앞역점")?.address).toBe("서울 종로구 종로 346");
    expect(PLACES.every((place) => Boolean(place.address.trim()))).toBe(true);
    expect(PLACES.length).toBeGreaterThan(450);
  });
});
