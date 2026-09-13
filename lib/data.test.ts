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
    expect(CATALOGUE_PLACES).toHaveLength(962);
    expect(PLACES).toHaveLength(845);
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
  it("publishes only explicitly verified curated rows and strips their prototype ratings", () => {
    const curated = PLACES.filter((p) => p.source === "curated");
    const sourced = PLACES.filter((p) => p.source !== "curated" && p.rating !== undefined);

    expect(curated.map((place) => place.id).sort()).toEqual([
      "namdaemun-market",
      "seongsu-cafe",
      "ssamziegil",
      "starfield-coex",
    ]);
    expect(curated.every((place) => place.rating === undefined && place.ratingCount === undefined)).toBe(true);
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
    expect(PLACES.filter((place) =>
      !place.address ||
      (place.geoSource === "area" && place.locationVerification !== "provisional")
    ).map((place) => place.id))
      .toEqual([]);
  });

  it("publishes manually verified Korean listings at their corrected addresses and pins", () => {
    const expected = {
      "ados-cultural-complex-j-bug": ["Hangang Play Place", "한강플플", "서울 광진구 강변북로 2202 뚝섬 자벌레 1·3층", 37.5309294, 127.0659973939],
      "ados-chaeseokjang-observatory": ["Changsin-Sungin Quarry Observatory", "채석장 전망대", "서울 종로구 낙산5길 51", 37.578309028, 127.0116121139],
      "ados-jongno-3-ga-stalls-alley": ["Jongno 3-ga Pojangmacha Street", "종로3가 포장마차 거리", "서울 종로구 종로 132", 37.5696013025, 126.989097746],
      "ados-gimpo-int-l-airport-observatory-deck": ["Gimpo Airport Observatory", "김포공항 전망대", "서울 강서구 하늘길 78 한국공항공사 본사 6층", 37.560748, 126.798851],
      "ssamziegil": ["Ssamzigil", "쌈지길", "서울 종로구 인사동길 44", 37.5743062352, 126.9848674428],
      "starfield-coex": ["Starfield COEX Mall", "스타필드 코엑스몰", "서울 강남구 영동대로 513", 37.5119175967, 127.059217995],
      "ados-daerim-central-market": ["Daerim Central Market", "대림중앙시장", "서울 영등포구 디지털로37나길 21", 37.4910328, 126.8993823],
      "ados-haebangchon-sinheungsijang": ["Haebangchon Sinheung Market", "해방촌 신흥시장", "서울 용산구 신흥로 95-9 2층", 37.5454213, 126.9850088],
      "ados-jongmyo-shrine": ["Jongmyo Shrine", "종묘", "서울 종로구 종로 157", 37.5758018, 126.9939555],
      "ct-more-on-hair-seongsu-branch": ["More On Hair Seongsu", "모어온헤어 성수점", "서울 성동구 왕십리로 106 3층", 37.5470168, 127.0448258],
      "ct-onyad-hair-personalized-hair-consultation-stylin": ["ONYAD Seoul Forest", "온야드 서울숲본점", "서울 성동구 왕십리로 66-10 2층, 3층 온야드", 37.5432321, 127.0449469],
      "oy-동묘앞역점": ["Olive Young Dongmyo Station", "올리브영 동묘앞역점", "서울 종로구 종로 346", 37.5729505, 127.0162282],
    } as const;

    for (const [id, [name, nameKr, address, lat, lng]] of Object.entries(expected)) {
      const place = PLACES.find((candidate) => candidate.id === id);
      expect(place, id).toBeDefined();
      expect(place?.name, `${id} English name`).toBe(name);
      expect(place?.nameKr, `${id} Korean name`).toBe(nameKr);
      expect(place?.address, `${id} address`).toBe(address);
      expect(place?.lat, `${id} latitude`).toBe(lat);
      expect(place?.lng, `${id} longitude`).toBe(lng);
    }

    expect(PLACES.find((place) => place.id === "ados-gimpo-int-l-airport-observatory-deck")?.aboutKr)
      .not.toContain("국내선 청사 4층");
  });

  it("publishes every approved owner-photo folder on a public place", () => {
    const placesWithPhotos = PLACES.filter((place) => place.photos?.length);
    const photoCount = placesWithPhotos.reduce(
      (total, place) => total + (place.photos?.length ?? 0),
      0,
    );

    expect(placesWithPhotos).toHaveLength(159);
    expect(photoCount).toBe(613);
  });

  it("publishes only explicitly labeled provisional area pins", () => {
    const provisional = PLACES.filter((place) => place.locationVerification === "provisional");
    const approximate = PLACES.filter((place) => place.geoSource === "area");

    expect(provisional).toHaveLength(99);
    expect(approximate.map((place) => place.id).sort())
      .toEqual(provisional.map((place) => place.id).sort());
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
