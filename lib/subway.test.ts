import { describe, it, expect } from "vitest";
import { findRoute, placesNearStations, STATIONS, LINE_STATIONS } from "./subway";
import type { Place } from "./data";

describe("network integrity", () => {
  it("every station id in LINE_STATIONS exists in STATIONS with that line", () => {
    for (const [line, ids] of Object.entries(LINE_STATIONS)) {
      for (const id of ids) {
        expect(STATIONS[id], `${line}:${id}`).toBeDefined();
        expect(STATIONS[id].lines, `${line}:${id}`).toContain(line);
      }
    }
  });
});

describe("findRoute", () => {
  it("same line: Nonhyeon → Konkuk Univ. follows line 7 in order (spec example)", () => {
    const r = findRoute("nonhyeon", "konkuk_univ")!;
    expect(r.stations).toEqual(["nonhyeon", "hakdong", "gangnamgu_office", "cheongdam", "jayang", "konkuk_univ"]);
    expect(r.segments).toHaveLength(1);
    expect(r.segments[0].line).toBe("7");
  });
  it("transfer: Gangnam (2) → Apgujeong Rodeo (bundang) transfers once", () => {
    const r = findRoute("gangnam", "apgujeong_rodeo")!;
    expect(r.segments.length).toBe(2);
    expect(r.segments[0].line).toBe("2");
    expect(r.segments[1].line).toBe("suin_bundang");
    // transfer happens at Seolleung (2 ↔ suin_bundang)
    expect(r.segments[0].stations.at(-1)).toBe("seolleung");
    expect(r.segments[1].stations[0]).toBe("seolleung");
  });
  it("same station returns single-station route", () => {
    const r = findRoute("gangnam", "gangnam")!;
    expect(r.stations).toEqual(["gangnam"]);
  });
  it("unknown id returns null", () => {
    expect(findRoute("gangnam", "nope")).toBeNull();
  });
});

describe("placesNearStations", () => {
  const mk = (id: string, lat: number, lng: number): Place => ({
    id, name: id, nameKr: id, type: "hair_salon", zone: "gangnam_station",
    priceRange: "₩", tags: [], address: "", lat, lng,
  });
  it("keeps places within radius of any route station, drops the rest", () => {
    const near = mk("near", STATIONS.gangnam.lat + 0.002, STATIONS.gangnam.lng); // ~220m
    const far = mk("far", 37.60, 127.10);
    expect(placesNearStations([near, far], ["gangnam"]).map((p) => p.id)).toEqual(["near"]);
  });
});
