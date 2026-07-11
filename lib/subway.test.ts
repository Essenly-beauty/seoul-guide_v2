import { describe, it, expect } from "vitest";
import { findRoute, placesNearStations, travelMinutes, STATIONS, LINE_META } from "./subway";
import type { Place } from "./data";
import data from "./subway-data.json";

describe("findRoute (metropolitan dataset)", () => {
  it("Nonhyeon → Konkuk Univ. stays on line 7 through Cheongdam (spec corridor)", () => {
    const r = findRoute("nonhyeon", "konkuk_univ")!;
    expect(r.segments).toHaveLength(1);
    expect(r.segments[0].line).toBe("7");
    expect(r.stations).toContain("cheongdam");
    expect(r.stations.indexOf("hakdong")).toBe(r.stations.indexOf("nonhyeon") + 1);
  });
  it("Gangnam → Apgujeong Rodeo transfers once (2 → suin_bundang at Seolleung)", () => {
    const r = findRoute("gangnam", "apgujeong_rodeo")!;
    expect(r.segments.length).toBe(2);
    expect(r.segments[0].line).toBe("2");
    expect(r.segments[0].stations.at(-1)).toBe(r.segments[1].stations[0]);
  });
  it("travel time is plausible (Gangnam→Hongik Univ. 20–60 min)", () => {
    const r = findRoute("gangnam", "hongik_univ")!;
    const min = travelMinutes(r);
    expect(min).toBeGreaterThan(20);
    expect(min).toBeLessThan(60);
  });
  it("same station / unknown id", () => {
    expect(findRoute("gangnam", "gangnam")!.stations).toEqual(["gangnam"]);
    expect(findRoute("gangnam", "nope")).toBeNull();
  });
  it("totalSeconds matches independent recomputation — single hop on a parallel-edge pair", () => {
    type RawEdge = [string, string, string, number];

    /** Line-aware edge lookup straight from the dataset — independent of lib/subway internals. */
    function edgeSeconds(a: string, b: string, line: string): number {
      const e = (data.edges as RawEdge[]).find(
        ([x, y, ln]) => ln === line && ((x === a && y === b) || (x === b && y === a)),
      );
      if (!e) throw new Error(`no ${line} edge ${a}~${b}`);
      return e[3];
    }

    /** Recompute a route's total from raw data: per-hop seconds on the CHOSEN line + 180s per transfer. */
    function recompute(r: { segments: { line: string; stations: string[] }[] }): number {
      let sec = 0;
      r.segments.forEach((seg, i) => {
        for (let j = 0; j < seg.stations.length - 1; j++) {
          sec += edgeSeconds(seg.stations[j], seg.stations[j + 1], seg.line);
        }
        if (i > 0) sec += 180; // transfer penalty
      });
      return sec;
    }

    const r = findRoute("jeongwang", "oido")!;
    expect(r.totalSeconds).toBe(recompute(r));
    expect(travelMinutes(r)).toBe(Math.round(recompute(r) / 60));
  });

  it("totalSeconds matches independent recomputation — transfer route incl. 180s penalty", () => {
    type RawEdge = [string, string, string, number];

    /** Line-aware edge lookup straight from the dataset — independent of lib/subway internals. */
    function edgeSeconds(a: string, b: string, line: string): number {
      const e = (data.edges as RawEdge[]).find(
        ([x, y, ln]) => ln === line && ((x === a && y === b) || (x === b && y === a)),
      );
      if (!e) throw new Error(`no ${line} edge ${a}~${b}`);
      return e[3];
    }

    /** Recompute a route's total from raw data: per-hop seconds on the CHOSEN line + 180s per transfer. */
    function recompute(r: { segments: { line: string; stations: string[] }[] }): number {
      let sec = 0;
      r.segments.forEach((seg, i) => {
        for (let j = 0; j < seg.stations.length - 1; j++) {
          sec += edgeSeconds(seg.stations[j], seg.stations[j + 1], seg.line);
        }
        if (i > 0) sec += 180; // transfer penalty
      });
      return sec;
    }

    const r = findRoute("gangnam", "apgujeong_rodeo")!;
    expect(r.segments.length).toBeGreaterThan(1);
    expect(r.totalSeconds).toBe(recompute(r));
  });
  it("every LINE_META entry has color and label", () => {
    for (const [id, m] of Object.entries(LINE_META)) {
      expect(m.color, id).toMatch(/^#/);
      expect(m.label, id).toBeTruthy();
    }
  });
});

describe("placesNearStations", () => {
  const mk = (id: string, lat: number, lng: number): Place => ({
    id, name: id, nameKr: id, type: "hair_salon", zone: "gangnam_station",
    priceRange: "₩", tags: [], address: "", lat, lng,
  });
  it("radius filter still works against real station coords", () => {
    const near = mk("near", STATIONS.gangnam.lat + 0.002, STATIONS.gangnam.lng);
    const far = mk("far", 37.60, 127.10);
    expect(placesNearStations([near, far], ["gangnam"]).map((p) => p.id)).toEqual(["near"]);
  });
});
