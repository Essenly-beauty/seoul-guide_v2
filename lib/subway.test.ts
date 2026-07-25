import { describe, it, expect } from "vitest";
import {
  findRoute,
  exactStationMatch,
  lineTextColor,
  nearestStation,
  placesNearStation,
  placesNearStations,
  searchStations,
  stationDisplayName,
  travelMinutes,
  STATIONS,
  LINE_META,
} from "./subway";
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

  it("uses a 1 km default for a single active station", () => {
    const withinOneKm = mk("within", STATIONS.gangnam.lat + 0.0075, STATIONS.gangnam.lng);
    const outsideOneKm = mk("outside", STATIONS.gangnam.lat + 0.011, STATIONS.gangnam.lng);

    expect(placesNearStation([withinOneKm, outsideOneKm], "gangnam").map((p) => p.id)).toEqual(["within"]);
    expect(placesNearStation([withinOneKm], "unknown")).toEqual([]);
  });
});

describe("searchStations", () => {
  it("ranks English exact and prefix matches before substring matches", () => {
    expect(searchStations("gangnam", 4)[0].id).toBe("gangnam");
    expect(searchStations("gang", 4)[0].id).toBe("gangnam");
  });

  it("matches Korean station names and ignores spacing and punctuation", () => {
    expect(searchStations("강남", 4)[0].id).toBe("gangnam");
    expect(searchStations("Apgujeong Rodeo", 4)[0].id).toBe("apgujeong_rodeo");
  });

  it("understands common station suffixes, English expansions, and tourist aliases", () => {
    expect(searchStations("Gangnam Station", 4)[0].id).toBe("gangnam");
    expect(searchStations("강남역", 4)[0].id).toBe("gangnam");
    expect(searchStations("Hongik University", 4)[0].id).toBe("hongik_univ");
    expect(searchStations("Hongdae", 4)[0].id).toBe("hongik_univ");
    expect(searchStations("홍대", 4)[0].id).toBe("hongik_univ");
    expect(searchStations("Gimpo Airport", 4)[0].id).toBe("gimpo_int_l_airport");
  });

  it("matches the common hyphenated spelling of Jongno 3-ga", () => {
    expect(searchStations("Jongno 3-ga", 4)[0].id).toBe("jongno_3_sam_ga");
  });

  it("returns no matches for a blank query and respects the limit", () => {
    expect(searchStations("   ")).toEqual([]);
    expect(searchStations("univ", 3)).toHaveLength(3);
  });
});

describe("exactStationMatch", () => {
  it("commits exact official names and tourist aliases but not prefixes", () => {
    expect(exactStationMatch("Gangnam")?.id).toBe("gangnam");
    expect(exactStationMatch("강남역")?.id).toBe("gangnam");
    expect(exactStationMatch("Hongdae")?.id).toBe("hongik_univ");
    expect(exactStationMatch("Gang")).toBeNull();
    expect(exactStationMatch("Yangpyeong")).toBeNull();
  });
});

describe("stationDisplayName", () => {
  it("keeps official names searchable while shortening controller labels", () => {
    const education = STATIONS.seoul_nat_l_univ_of_education_court_public_prosecutor_s_office;
    const cargo = STATIONS.incheon_int_l_airport_cargo_terminal;

    expect(stationDisplayName(education)).toBe("Seoul Nat'l Univ. of Education");
    expect(stationDisplayName(cargo)).toBe("Airport Cargo Terminal");
    expect(education.name).toContain("Court & Public Prosecutor's Office");
  });
});

describe("lineTextColor", () => {
  it("chooses readable text for light and dark subway colors", () => {
    expect(lineTextColor("#F5A200")).toBe("#000000");
    expect(lineTextColor("#0052A4")).toBe("#FFFFFF");
  });

  it("keeps every official line badge at WCAG AA contrast", () => {
    const luminance = (hex: string) => {
      const channels = hex.match(/[\da-f]{2}/giu)!.map((channel) => {
        const value = Number.parseInt(channel, 16) / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };

    for (const line of Object.values(LINE_META)) {
      const background = luminance(line.color);
      const foreground = lineTextColor(line.color) === "#FFFFFF" ? 1 : 0;
      const ratio = (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05);
      expect(ratio, line.label).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("nearestStation", () => {
  it("finds the closest station to a map location", () => {
    expect(nearestStation({ lat: STATIONS.gangnam.lat, lng: STATIONS.gangnam.lng })?.id).toBe("gangnam");
  });
});

describe("route data regressions", () => {
  it("does not connect Hanam Pungsan directly to Ilsan", () => {
    const route = findRoute("misa", "ilsan")!;
    expect(travelMinutes(route)).toBeGreaterThan(30);
    expect(route.stations.some((id, index) => id === "hanam_pungsan" && route.stations[index + 1] === "ilsan")).toBe(false);
  });

  it.each([
    ["yangchon", "gimpo_int_l_airport"],
    ["jinjeop", "gangnam"],
    ["wonsi", "gangnam"],
    ["seoul_national_univ_venture_town", "gangnam"],
  ])("keeps the renamed-station corridor connected: %s to %s", (fromId, toId) => {
    const route = findRoute(fromId, toId);

    expect(route).not.toBeNull();
    expect(route?.stations[0]).toBe(fromId);
    expect(route?.stations.at(-1)).toBe(toId);
  });
});
