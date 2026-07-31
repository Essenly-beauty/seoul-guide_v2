import { describe, it, expect } from "vitest";
import { CREATRIP_PLACES } from "./generated/creatrip-places";
import { OLIVEYOUNG_PLACES } from "./generated/oliveyoung-places";
import { ADOS_PLACES } from "./generated/ados-places";
import { PLACES, ZONES, MAP_CATEGORIES } from "./data";

// Guards the generated Creatrip import (scripts/build-creatrip-places.mjs):
// a bad geocode or mapping regression should fail here, not render as a pin
// in the wrong city.

const ZONE_KEYS = new Set(ZONES.map((z) => z.key));
const TYPE_KEYS = new Set(MAP_CATEGORIES.map((c) => c.key));

describe("creatrip import integrity", () => {
  it("imports a substantial dataset", () => {
    expect(CREATRIP_PLACES.length).toBeGreaterThan(180);
  });

  it("ids are unique across the whole data layer", () => {
    const ids = PLACES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every place sits inside the Korea bounding box", () => {
    for (const p of CREATRIP_PLACES) {
      expect(p.lat, `${p.id} lat`).toBeGreaterThan(33);
      expect(p.lat, `${p.id} lat`).toBeLessThan(38.7);
      expect(p.lng, `${p.id} lng`).toBeGreaterThan(124.5);
      expect(p.lng, `${p.id} lng`).toBeLessThan(132);
    }
  });

  it("busan-zone places are actually in Busan (and Seoul zones in Seoul)", () => {
    for (const p of CREATRIP_PLACES) {
      if (p.zone === "busan") {
        expect(p.lat, `${p.id}`).toBeGreaterThan(35.0);
        expect(p.lat, `${p.id}`).toBeLessThan(35.4);
      } else if (p.zone !== "gyeonggi") {
        expect(p.lat, `${p.id} should be in Seoul`).toBeGreaterThan(37.4);
        expect(p.lat, `${p.id} should be in Seoul`).toBeLessThan(37.75);
      }
    }
  });

  it("zones and types come from the app taxonomy", () => {
    for (const p of CREATRIP_PLACES) {
      expect(ZONE_KEYS.has(p.zone), `${p.id} zone=${p.zone}`).toBe(true);
      expect(TYPE_KEYS.has(p.type), `${p.id} type=${p.type}`).toBe(true);
    }
  });

  it("ratings are plausible and every place has required display fields", () => {
    for (const p of CREATRIP_PLACES) {
      if (p.rating !== undefined) {
        expect(p.rating, p.id).toBeGreaterThanOrEqual(0);
        expect(p.rating, p.id).toBeLessThanOrEqual(5);
      }
      expect(p.name.length, p.id).toBeGreaterThan(0);
      expect(p.nameKr.length, p.id).toBeGreaterThan(0);
      expect(["₩", "₩₩", "₩₩₩"]).toContain(p.priceRange);
      expect(p.geoSource === "address" || p.geoSource === "area", `${p.id} geoSource`).toBe(true);
    }
  });

  it("most pins are address-accurate, not area fallbacks", () => {
    const addressHits = CREATRIP_PLACES.filter((p) => p.geoSource === "address").length;
    expect(addressHits / CREATRIP_PLACES.length).toBeGreaterThan(0.6);
  });
});

describe("olive young import integrity", () => {
  it("imports a substantial store list", () => {
    expect(OLIVEYOUNG_PLACES.length).toBeGreaterThan(60);
  });

  it("every store is an olive_young inside the Seoul bounding box", () => {
    for (const p of OLIVEYOUNG_PLACES) {
      expect(p.type, p.id).toBe("olive_young");
      expect(ZONE_KEYS.has(p.zone), `${p.id} zone=${p.zone}`).toBe(true);
      expect(p.lat, `${p.id} lat`).toBeGreaterThan(37.4);
      expect(p.lat, `${p.id} lat`).toBeLessThan(37.75);
      expect(p.lng, `${p.id} lng`).toBeGreaterThan(126.75);
      expect(p.lng, `${p.id} lng`).toBeLessThan(127.2);
    }
  });

  it("no store sits on top of another (dedupe holds)", () => {
    // ~15m — dense shopping streets legitimately host neighboring stores
    // within a block, so only flag pins that are effectively the same point.
    const seen: { lat: number; lng: number; id: string; geoSource?: string }[] = [];
    for (const p of OLIVEYOUNG_PLACES) {
      if (p.geoSource === "area") continue; // district-centroid fallbacks scatter, not real positions
      const twin = seen.find((q) => Math.abs(q.lat - p.lat) < 0.00014 && Math.abs(q.lng - p.lng) < 0.00017);
      expect(twin?.id, `${p.id} overlaps ${twin?.id}`).toBeUndefined();
      seen.push(p);
    }
  });

  it("no generated store duplicates a curated sample store", () => {
    const generated = new Set(OLIVEYOUNG_PLACES.map((p) => p.id));
    const curated = PLACES.filter((p) => p.type === "olive_young" && !generated.has(p.id));
    for (const p of OLIVEYOUNG_PLACES) {
      const twin = curated.find((q) => Math.abs(q.lat - p.lat) < 0.001 && Math.abs(q.lng - p.lng) < 0.0012);
      expect(twin?.id, `${p.id} duplicates curated ${twin?.id}`).toBeUndefined();
    }
  });
});

describe("a-drop-of-seoul import integrity", () => {
  it("imports both files' worth of attractions", () => {
    expect(ADOS_PLACES.length).toBeGreaterThan(90);
  });

  it("every place is a mall or etc inside the Seoul bounding box", () => {
    for (const p of ADOS_PLACES) {
      expect(["mall", "etc"], `${p.id} type=${p.type}`).toContain(p.type);
      expect(ZONE_KEYS.has(p.zone), `${p.id} zone=${p.zone}`).toBe(true);
      expect(p.lat, `${p.id} lat`).toBeGreaterThan(37.4);
      expect(p.lat, `${p.id} lat`).toBeLessThan(37.75);
      expect(p.lng, `${p.id} lng`).toBeGreaterThan(126.75);
      expect(p.lng, `${p.id} lng`).toBeLessThan(127.2);
    }
  });

  it("descriptions came through (the point of this import)", () => {
    const withAbout = ADOS_PLACES.filter((p) => p.about || p.aboutKr).length;
    expect(withAbout).toBe(ADOS_PLACES.length);
  });

  it("well-known landmarks are pinned address-accurately", () => {
    for (const id of ["ados-gyeongbokgung-palace", "ados-n-seoul-tower", "ados-mmca-seoul"]) {
      const p = ADOS_PLACES.find((x) => x.id === id);
      expect(p, id).toBeDefined();
      expect(p!.geoSource, id).toBe("address");
    }
  });
});
