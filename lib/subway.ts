/** Simplified Seoul subway network for beauty-zone route discovery.
 *  Corridors through beauty zones keep real station order; long stretches
 *  elsewhere are condensed (schematic, not survey-accurate). */

import { haversineKm } from "./geo";
import type { Place } from "./data";

export type LineId = "2" | "3" | "4" | "7" | "suin_bundang";

export const LINE_META: Record<LineId, { label: string; shortLabel: string; color: string }> = {
  "2": { label: "Line 2", shortLabel: "2", color: "#00A84D" },
  "3": { label: "Line 3", shortLabel: "3", color: "#EF7C1C" },
  "4": { label: "Line 4", shortLabel: "4", color: "#00A5DE" },
  "7": { label: "Line 7", shortLabel: "7", color: "#747F00" },
  suin_bundang: { label: "Suin–Bundang", shortLabel: "SB", color: "#F5A200" },
};

export type SubwayStation = {
  id: string; name: string; nameKr: string;
  lat: number; lng: number;
  /** Schematic coords for the SVG map (viewBox 0 0 720 560). */
  x: number; y: number;
  lines: LineId[];
};

const S = (id: string, name: string, nameKr: string, lat: number, lng: number, x: number, y: number, lines: LineId[]): SubwayStation =>
  ({ id, name, nameKr, lat, lng, x, y, lines });

export const STATIONS: Record<string, SubwayStation> = Object.fromEntries([
  // Line 2 (simplified loop, clockwise from City Hall)
  S("city_hall", "City Hall", "시청", 37.5657, 126.9769, 300, 90, ["2"]),
  S("euljiro1", "Euljiro 1(il)-ga", "을지로입구", 37.5660, 126.9827, 360, 90, ["2"]),
  S("euljiro3", "Euljiro 3(sam)-ga", "을지로3가", 37.5663, 126.9919, 420, 90, ["2", "3"]),
  S("wangsimni", "Wangsimni", "왕십리", 37.5612, 127.0374, 540, 110, ["2"]),
  S("seongsu", "Seongsu", "성수", 37.5446, 127.0559, 600, 150, ["2"]),
  S("konkuk_univ", "Konkuk Univ.", "건대입구", 37.5403, 127.0703, 640, 200, ["2", "7"]),
  S("samseong", "Samseong (World Trade Center)", "삼성", 37.5088, 127.0631, 600, 380, ["2"]),
  S("seolleung", "Seolleung", "선릉", 37.5045, 127.0490, 540, 400, ["2", "suin_bundang"]),
  S("yeoksam", "Yeoksam", "역삼", 37.5006, 127.0364, 480, 410, ["2"]),
  S("gangnam", "Gangnam", "강남", 37.4979, 127.0276, 420, 420, ["2"]),
  S("gyodae", "Seoul Nat'l Univ. of Education", "교대", 37.4934, 127.0140, 340, 420, ["2", "3"]),
  S("sadang", "Sadang", "사당", 37.4766, 126.9816, 240, 430, ["2"]),
  S("sindorim", "Sindorim", "신도림", 37.5089, 126.8913, 120, 330, ["2"]),
  S("hongik_univ", "Hongik Univ.", "홍대입구", 37.5573, 126.9236, 130, 160, ["2"]),
  S("hapjeong", "Hapjeong", "합정", 37.5497, 126.9139, 110, 200, ["2"]),
  S("sinchon", "Sinchon", "신촌", 37.5551, 126.9368, 200, 130, ["2"]),
  // Line 3
  S("anguk", "Anguk", "안국", 37.5763, 126.9852, 400, 40, ["3"]),
  S("chungmuro", "Chungmuro", "충무로", 37.5613, 126.9941, 450, 120, ["3", "4"]),
  S("apgujeong", "Apgujeong", "압구정", 37.5270, 127.0286, 430, 270, ["3"]),
  S("sinsa", "Sinsa", "신사", 37.5164, 127.0203, 400, 310, ["3"]),
  S("jamwon", "Jamwon", "잠원", 37.5128, 127.0113, 375, 345, ["3"]),
  S("express_bus", "Express Bus Terminal", "고속터미널", 37.5049, 127.0049, 350, 380, ["3", "7"]),
  // Line 4
  S("hoehyeon", "Hoehyeon", "회현", 37.5586, 126.9784, 380, 150, ["4"]),
  S("myeongdong", "Myeongdong", "명동", 37.5609, 126.9863, 415, 135, ["4"]),
  // Line 7
  S("banpo", "Banpo", "반포", 37.5081, 127.0114, 390, 365, ["7"]),
  S("nonhyeon", "Nonhyeon", "논현", 37.5110, 127.0214, 430, 350, ["7"]),
  S("hakdong", "Hakdong", "학동", 37.5144, 127.0316, 470, 335, ["7"]),
  S("gangnamgu_office", "Gangnam-gu Office", "강남구청", 37.5172, 127.0414, 510, 320, ["7", "suin_bundang"]),
  S("cheongdam", "Cheongdam", "청담", 37.5195, 127.0537, 555, 300, ["7"]),
  S("jayang", "Jayang (Ttukseom Hangang Park)", "자양", 37.5310, 127.0668, 610, 250, ["7"]),
  // Suin–Bundang
  S("seoul_forest", "Seoul Forest", "서울숲", 37.5435, 127.0447, 560, 180, ["suin_bundang"]),
  S("apgujeong_rodeo", "Apgujeong Rodeo", "압구정로데오", 37.5273, 127.0403, 500, 260, ["suin_bundang"]),
  S("seonjeongneung", "Seonjeongneung", "선정릉", 37.5104, 127.0435, 525, 360, ["suin_bundang"]),
].map((s) => [s.id, s]));

export const LINE_STATIONS: Record<LineId, string[]> = {
  "2": ["city_hall", "euljiro1", "euljiro3", "wangsimni", "seongsu", "konkuk_univ", "samseong", "seolleung", "yeoksam", "gangnam", "gyodae", "sadang", "sindorim", "hapjeong", "hongik_univ", "sinchon", "city_hall"],
  "3": ["anguk", "euljiro3", "chungmuro", "apgujeong", "sinsa", "jamwon", "express_bus", "gyodae"],
  "4": ["hoehyeon", "myeongdong", "chungmuro"],
  "7": ["express_bus", "banpo", "nonhyeon", "hakdong", "gangnamgu_office", "cheongdam", "jayang", "konkuk_univ"],
  suin_bundang: ["seoul_forest", "apgujeong_rodeo", "gangnamgu_office", "seonjeongneung", "seolleung"],
};

export type RouteSegment = { line: LineId; stations: string[] };
export type SubwayRoute = { stations: string[]; segments: RouteSegment[] };

/** Lines on which stations a,b are adjacent. */
function linesBetween(a: string, b: string): LineId[] {
  const out: LineId[] = [];
  for (const [line, ids] of Object.entries(LINE_STATIONS) as [LineId, string[]][]) {
    for (let i = 0; i < ids.length - 1; i++) {
      if ((ids[i] === a && ids[i + 1] === b) || (ids[i] === b && ids[i + 1] === a)) { out.push(line); break; }
    }
  }
  return out;
}

/** BFS by station count over the schematic network. */
export function findRoute(fromId: string, toId: string): SubwayRoute | null {
  if (!STATIONS[fromId] || !STATIONS[toId]) return null;
  if (fromId === toId) return { stations: [fromId], segments: [{ line: STATIONS[fromId].lines[0], stations: [fromId] }] };

  const adj = new Map<string, string[]>();
  for (const ids of Object.values(LINE_STATIONS)) {
    for (let i = 0; i < ids.length - 1; i++) {
      const [a, b] = [ids[i], ids[i + 1]];
      if (!adj.get(a)?.includes(b)) adj.set(a, [...(adj.get(a) ?? []), b]);
      if (!adj.get(b)?.includes(a)) adj.set(b, [...(adj.get(b) ?? []), a]);
    }
  }

  const prev = new Map<string, string>();
  const queue = [fromId];
  const seen = new Set([fromId]);
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === toId) break;
    for (const nxt of adj.get(cur) ?? []) {
      if (seen.has(nxt)) continue;
      seen.add(nxt);
      prev.set(nxt, cur);
      queue.push(nxt);
    }
  }
  if (!seen.has(toId)) return null;

  const stations: string[] = [toId];
  while (stations[0] !== fromId) stations.unshift(prev.get(stations[0])!);

  // Assign a line to each hop, preferring to stay on the current line (fewer transfers).
  const segments: RouteSegment[] = [];
  let curLine: LineId | null = null;
  for (let i = 0; i < stations.length - 1; i++) {
    const options = linesBetween(stations[i], stations[i + 1]);
    const line: LineId = curLine && options.includes(curLine) ? curLine : options[0];
    if (line !== curLine) {
      segments.push({ line, stations: [stations[i], stations[i + 1]] });
      curLine = line;
    } else {
      segments[segments.length - 1].stations.push(stations[i + 1]);
    }
  }
  return { stations, segments };
}

/** Shops within walking radius (~7 min) of ANY station on the route. */
export function placesNearStations(places: Place[], stationIds: string[], radiusKm = 0.55): Place[] {
  const pts = stationIds.map((id) => STATIONS[id]).filter(Boolean);
  return places.filter((p) => pts.some((s) => haversineKm({ lat: p.lat, lng: p.lng }, { lat: s.lat, lng: s.lng }) <= radiusKm));
}

export function shopCount(places: Place[], stationId: string): number {
  return placesNearStations(places, [stationId]).length;
}
