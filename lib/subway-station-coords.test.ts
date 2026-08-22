import { describe, it, expect, beforeAll } from "vitest";
import { STATIONS, stationExits, loadStationExits } from "./subway";
import { haversineKm } from "./geo";
import overrides from "../scripts/lib/station-coord-overrides.json";

/** KRIC's 위도/경도 column had two rows that pointed at a *neighbouring*
 *  station instead of their own: 이촌 landed 14 m from 신용산 and 마곡 landed
 *  7 m from 발산, each ~1 km from its own entrances. Nothing crashed — the map
 *  simply drew the station on the wrong block and every walking distance from
 *  it was wrong. scripts/lib/station-coord-overrides.json holds the OSM-derived
 *  fix and scripts/build-subway-data.mjs re-applies it on every rebuild; these
 *  tests fail if a rebuild ever drops it again.
 *
 *  Evidence and regeneration: scripts/audit-station-coords.mjs. */

const metres = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  haversineKm(a, b) * 1000;

const OVERRIDDEN = Object.entries(overrides) as [string, { lat: number; lng: number; note: string }][];

describe("corrected station coordinates", () => {
  beforeAll(async () => {
    await loadStationExits();
  });

  it("has an override for each station the OSM audit proved wrong", () => {
    expect(OVERRIDDEN.map(([id]) => id).sort()).toEqual(["ichon", "magok"]);
  });

  it("serves the corrected coordinates from STATIONS, not the bad KRIC row", () => {
    for (const [id, fix] of OVERRIDDEN) {
      expect(STATIONS[id], id).toBeDefined();
      expect(STATIONS[id].lat, id).toBeCloseTo(fix.lat, 6);
      expect(STATIONS[id].lng, id).toBeCloseTo(fix.lng, 6);
    }
  });

  it("places every corrected station on the centroid of its real OSM exits", () => {
    for (const [id] of OVERRIDDEN) {
      const exits = stationExits(id);
      // a centroid is only meaningful with entrances spread around the station
      expect(exits.length, id).toBeGreaterThanOrEqual(5);
      const centroid = {
        lat: exits.reduce((n, e) => n + e.lat, 0) / exits.length,
        lng: exits.reduce((n, e) => n + e.lng, 0) / exits.length,
      };
      expect(metres(STATIONS[id], centroid), id).toBeLessThan(150);
    }
  });

  it("keeps Ichon clear of Sinyongsan — they are different stations", () => {
    // pre-fix this was 14 m: Ichon was sitting on top of Sinyongsan
    expect(metres(STATIONS.ichon, STATIONS.sinyongsan)).toBeGreaterThan(500);
  });

  it("keeps Magok clear of Balsan — they are different stations", () => {
    // pre-fix this was 7 m
    expect(metres(STATIONS.magok, STATIONS.balsan)).toBeGreaterThan(500);
  });
});

describe("station coordinate sanity across the network", () => {
  it("never files two distinct stations at the same spot", () => {
    // The closest genuinely-adjacent pair in Seoul is 용산 ↔ 신용산 at ~288 m,
    // so anything under 150 m means a row copied its neighbour's coordinate —
    // the exact defect ichon and magok had.
    const list = Object.values(STATIONS);
    const tooClose: string[] = [];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (metres(list[i], list[j]) < 150) tooClose.push(`${list[i].id}/${list[j].id}`);
      }
    }
    expect(tooClose).toEqual([]);
  });

  it("keeps every station within the Seoul metropolitan bounding box", () => {
    for (const s of Object.values(STATIONS)) {
      expect(s.lat, s.id).toBeGreaterThan(36.5);
      expect(s.lat, s.id).toBeLessThan(38.3);
      expect(s.lng, s.id).toBeGreaterThan(126.3);
      expect(s.lng, s.id).toBeLessThan(127.9);
    }
  });
});
