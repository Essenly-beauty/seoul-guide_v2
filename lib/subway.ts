/** Seoul metropolitan subway network (600 stations, 706 undirected edges) for
 *  beauty-zone route discovery. Sourced from lib/subway-data.json (Task S1);
 *  geometry (x/y schematic coords) now lives in the map SVG asset, not here. */

import raw from "./subway-data.json";
import { haversineKm, type LatLng } from "./geo";
import type { Place } from "./data";

type RawLineMeta = { label: string; labelKr: string; color: string };
type RawStation = { name: string; nameKr: string; lat: number; lng: number; lines: string[]; transfer: boolean };
type RawEdge = [string, string, string, number];

const data = raw as unknown as { lines: Record<string, RawLineMeta>; stations: Record<string, RawStation>; edges: RawEdge[] };

/** Abbreviations (≤3 chars) for non-numbered lines; numbered lines use the number itself. */
const SHORT_LABELS: Record<string, string> = {
  suin_bundang: "SB",
  seohae: "SH",
  gyeongui_jungang: "GJ",
  gyeongchun: "GC",
  ui_sinseol: "UI",
  gimpo_gold: "GG",
  incheon1: "I1",
  incheon2: "I2",
  airport: "A",
  sinbundang: "SBD",
  sillim: "SL",
};

export type LineId = string;

export const LINE_META: Record<LineId, { label: string; shortLabel: string; color: string }> = Object.fromEntries(
  Object.entries(data.lines).map(([id, meta]) => [
    id,
    { label: meta.label, shortLabel: SHORT_LABELS[id] ?? id, color: meta.color },
  ]),
);

export type SubwayStation = {
  id: string;
  name: string;
  nameKr: string;
  lat: number;
  lng: number;
  lines: LineId[];
};

export const STATIONS: Record<string, SubwayStation> = Object.fromEntries(
  Object.entries(data.stations).map(([id, s]) => [
    id,
    { id, name: s.name, nameKr: s.nameKr, lat: s.lat, lng: s.lng, lines: s.lines },
  ]),
);

const STATION_DISPLAY_NAME_OVERRIDES: Partial<Record<string, string>> = {
  incheon_int_l_airport_cargo_terminal: "Airport Cargo Terminal",
  dongdaemun_history_culture_park: "Dongdaemun H&C Park",
  seoul_regional_office_of_millitary_manpower: "Seoul Military Manpower Office",
  seoul_national_univ_venture_town: "Seoul Nat'l Univ. Venture Town",
};

/** Compact label for the route controller; search and accessible names keep the official full name. */
export function stationDisplayName(station: SubwayStation): string {
  return STATION_DISPLAY_NAME_OVERRIDES[station.id]
    ?? station.name.replace(/\s*\([^)]*\)\s*$/u, "").trim();
}

const STATION_LIST = Object.values(STATIONS);

const STATION_ALIASES: Partial<Record<string, string[]>> = {
  hongik_univ: ["Hongdae", "홍대"],
  gimpo_int_l_airport: ["Gimpo Airport", "김포공항"],
  seoul: ["Seoul Station", "서울역"],
};

const POPULAR_STATION_IDS = [
  "gangnam",
  "myeongdong",
  "hongik_univ",
  "seoul",
  "jamsil_songpa_gu_office",
  "sinsa",
  "seongsu",
  "apgujeong_rodeo",
];
const POPULAR_STATION_RANK = new Map(POPULAR_STATION_IDS.map((id, index) => [id, index]));

/** Search-key normalization shared by English, Korean, and station ids. */
function stationSearchKey(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/\b(?:station|stn)\b/gu, "")
    .replace(/\buniversity\b/gu, "univ")
    .replace(/\bnational\b/gu, "natl")
    .replace(/\binternational\b/gu, "intl")
    .replace(/int[‘’']?l/gu, "intl")
    .replace(/(\d)\s*\([^)]*\)/gu, "$1")
    .replace(/역$/u, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

/**
 * Deterministic local station search for the route comboboxes. Exact matches
 * win over prefixes, which win over word-prefixes and general substrings.
 */
export function searchStations(query: string, limit = 8): SubwayStation[] {
  const needle = stationSearchKey(query);
  if (!needle || limit <= 0) return [];

  return STATION_LIST
    .map((station) => {
      const terms = [station.name, station.nameKr, station.id, ...(STATION_ALIASES[station.id] ?? [])];
      const keys = terms.map(stationSearchKey).filter(Boolean);
      const words = station.name
        .split(/[^\p{L}\p{N}]+/u)
        .map(stationSearchKey)
        .filter(Boolean);
      let score = Number.POSITIVE_INFINITY;
      if (keys.some((candidate) => candidate === needle)) score = 0;
      else if (keys.some((candidate) => candidate.startsWith(needle))) score = 1;
      else if (words.some((word) => word.startsWith(needle))) score = 2;
      else if (keys.some((candidate) => candidate.includes(needle))) score = 3;
      return { station, score };
    })
    .filter(({ score }) => Number.isFinite(score))
    .sort((a, b) =>
      a.score - b.score ||
      (POPULAR_STATION_RANK.get(a.station.id) ?? Number.MAX_SAFE_INTEGER) -
        (POPULAR_STATION_RANK.get(b.station.id) ?? Number.MAX_SAFE_INTEGER) ||
      a.station.name.length - b.station.name.length ||
      a.station.id.localeCompare(b.station.id),
    )
    .slice(0, limit)
    .map(({ station }) => station);
}

/** Resolve only a complete station name/alias, for safe combobox blur commits. */
export function exactStationMatch(query: string): SubwayStation | null {
  const needle = stationSearchKey(query);
  if (!needle) return null;

  const matches = STATION_LIST.filter((station) =>
    [station.name, station.nameKr, station.id, ...(STATION_ALIASES[station.id] ?? [])]
      .map(stationSearchKey)
      .some((candidate) => candidate === needle),
  );
  return matches.length === 1 ? matches[0] : null;
}

/** Pick a readable foreground for official line colors, including light lines. */
export function lineTextColor(hex: string): "#000000" | "#FFFFFF" {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/iu.exec(hex);
  if (!match) return "#FFFFFF";

  const linear = (channel: string) => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * linear(match[1]) + 0.7152 * linear(match[2]) + 0.0722 * linear(match[3]);
  const darkContrast = (luminance + 0.05) / 0.05;
  const lightContrast = 1.05 / (luminance + 0.05);
  return darkContrast >= lightContrast ? "#000000" : "#FFFFFF";
}

export function nearestStation(origin: LatLng): SubwayStation | null {
  let closest: SubwayStation | null = null;
  let closestKm = Number.POSITIVE_INFINITY;
  for (const station of STATION_LIST) {
    const km = haversineKm(origin, station);
    if (km < closestKm) {
      closest = station;
      closestKm = km;
    }
  }
  return closest;
}

export type RouteSegment = { line: LineId; stations: string[] };
export type SubwayRoute = { stations: string[]; segments: RouteSegment[]; totalSeconds: number };

/**
 * Absolute route index where each line segment begins. Transfer stations
 * belong to both adjacent segments but occupy one step in route.stations.
 */
export function routeSegmentStartIndices(route: SubwayRoute): number[] {
  let start = 0;
  return route.segments.map((segment) => {
    const current = start;
    start += Math.max(0, segment.stations.length - 1);
    return current;
  });
}

/** Move one selected waypoint by one position while keeping the caller's order immutable. */
export function moveRouteWaypoint(
  waypoints: string[],
  fromIndex: number,
  direction: -1 | 1,
): string[] {
  const next = [...waypoints];
  const toIndex = fromIndex + direction;
  if (
    fromIndex < 0
    || fromIndex >= next.length
    || toIndex < 0
    || toIndex >= next.length
  ) {
    return next;
  }
  [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
  return next;
}

/** Adjacency built once at module scope: stationId -> [{ to, line, sec }]. */
const ADJ = new Map<string, { to: string; line: LineId; sec: number }[]>();
for (const [a, b, line, sec] of data.edges) {
  if (!ADJ.has(a)) ADJ.set(a, []);
  if (!ADJ.has(b)) ADJ.set(b, []);
  ADJ.get(a)!.push({ to: b, line, sec });
  ADJ.get(b)!.push({ to: a, line, sec });
}

/** Realistic transfer cost added whenever the arrival line changes mid-route. */
const TRANSFER_PENALTY_SEC = 180;

type SearchState = string; // `${stationId}|${line}`
const key = (station: string, line: LineId | null): SearchState => `${station}|${line ?? ""}`;

/**
 * Dijkstra over edge seconds with a transfer penalty. Search state is
 * (stationId, arrivalLine) rather than just stationId, so the penalty is
 * only applied when consecutive hops actually switch lines — arriving at a
 * transfer station on line 2 and continuing on line 2 costs nothing extra.
 * A plain array is used as the "priority queue": at this scale (≤700 nodes)
 * a binary heap buys nothing but implementation risk.
 */
export function findRoute(fromId: string, toId: string): SubwayRoute | null {
  if (!STATIONS[fromId] || !STATIONS[toId]) return null;
  if (fromId === toId) return { stations: [fromId], segments: [{ line: STATIONS[fromId].lines[0], stations: [fromId] }], totalSeconds: 0 };

  type Frontier = { state: SearchState; station: string; line: LineId | null; cost: number };
  type Step = { prevState: SearchState | null; station: string; line: LineId | null; hopSec: number };

  const dist = new Map<SearchState, number>();
  const prev = new Map<SearchState, Step>();
  const startKey = key(fromId, null);
  dist.set(startKey, 0);
  prev.set(startKey, { prevState: null, station: fromId, line: null, hopSec: 0 });

  // frontier: re-sorted each pop (fine at this scale, ≤700 nodes — no heap needed).
  let frontier: Frontier[] = [{ state: startKey, station: fromId, line: null, cost: 0 }];
  const settled = new Set<SearchState>();
  let goalState: SearchState | null = null;

  while (frontier.length) {
    frontier.sort((a, b) => a.cost - b.cost);
    const cur = frontier.shift()!;
    if (settled.has(cur.state)) continue;
    settled.add(cur.state);

    if (cur.station === toId) {
      goalState = cur.state;
      break;
    }

    for (const edge of ADJ.get(cur.station) ?? []) {
      const penalty = cur.line !== null && cur.line !== edge.line ? TRANSFER_PENALTY_SEC : 0;
      const nextCost = cur.cost + edge.sec + penalty;
      const nextState = key(edge.to, edge.line);
      if (settled.has(nextState)) continue;
      const known = dist.get(nextState);
      if (known === undefined || nextCost < known) {
        dist.set(nextState, nextCost);
        prev.set(nextState, { prevState: cur.state, station: edge.to, line: edge.line, hopSec: edge.sec });
        frontier.push({ state: nextState, station: edge.to, line: edge.line, cost: nextCost });
      }
    }
  }

  if (!goalState) return null;

  // Reconstruct: walk prev-links from the goal back to the start, then reverse.
  const chain: { station: string; line: LineId | null; hopSec: number }[] = [];
  let state: SearchState | null = goalState;
  while (state) {
    const step: Step = prev.get(state)!;
    chain.unshift({ station: step.station, line: step.line, hopSec: step.hopSec });
    state = step.prevState;
  }

  const stations = chain.map((c) => c.station);

  // Accumulate total seconds from the path: edge seconds + transfer penalty for each line switch.
  let totalSeconds = 0;
  for (let i = 1; i < chain.length; i++) {
    totalSeconds += chain[i].hopSec;
    const prevLine = chain[i - 1].line;
    const currLine = chain[i].line;
    if (prevLine !== null && prevLine !== currLine) {
      totalSeconds += TRANSFER_PENALTY_SEC;
    }
  }

  // Merge consecutive same-line hops into segments; each hop's line comes
  // straight from the edge (edges carry lineId), so no extra lookup needed.
  const segments: RouteSegment[] = [];
  for (let i = 1; i < chain.length; i++) {
    const line = chain[i].line!;
    const last = segments[segments.length - 1];
    if (last && last.line === line) {
      last.stations.push(chain[i].station);
    } else {
      segments.push({ line, stations: [chain[i - 1].station, chain[i].station] });
    }
  }

  return { stations, segments, totalSeconds };
}

/**
 * Route through intermediate waypoints (경유역): chains findRoute leg by leg,
 * concatenating stations while dropping the duplicated junction station
 * between legs. A line change at a via boundary receives the same transfer
 * penalty as a line change within one leg. Adjacent same-line segments across
 * a junction are merged so the transfer count stays honest when a via sits on
 * the line the route already rides. Returns null when any waypoint id repeats
 * or any leg is unroutable.
 */
export function findRouteVia(fromId: string, viaIds: string[], toId: string): SubwayRoute | null {
  const waypoints = [fromId, ...viaIds, toId];
  if (new Set(waypoints).size !== waypoints.length) return null;
  if (viaIds.length === 0) return findRoute(fromId, toId);

  const stations: string[] = [];
  const segments: RouteSegment[] = [];
  let totalSeconds = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const leg = findRoute(waypoints[i], waypoints[i + 1]);
    if (!leg) return null;
    const previousLine = segments[segments.length - 1]?.line;
    const nextLine = leg.segments[0]?.line;
    if (previousLine && nextLine && previousLine !== nextLine) {
      totalSeconds += TRANSFER_PENALTY_SEC;
    }
    stations.push(...(i === 0 ? leg.stations : leg.stations.slice(1)));
    for (const segment of leg.segments) {
      const last = segments[segments.length - 1];
      if (last && last.line === segment.line && last.stations[last.stations.length - 1] === segment.stations[0]) {
        last.stations.push(...segment.stations.slice(1));
      } else {
        // Copy so merging never mutates the leg findRoute returned.
        segments.push({ line: segment.line, stations: [...segment.stations] });
      }
    }
    totalSeconds += leg.totalSeconds;
  }

  return { stations, segments, totalSeconds };
}

/**
 * Total travel time in minutes, derived from the chosen path's accumulated
 * seconds (edge seconds + transfer penalty). Transfer time is included because
 * it makes the displayed ETA honest door-to-door, even though the search already
 * applies the same penalty internally to steer away from excessive line-changes.
 */
export function travelMinutes(route: SubwayRoute): number {
  return Math.round(route.totalSeconds / 60);
}

/** Shops within walking radius (~7 min) of ANY station on the route. */
export type StationExit = { no: number; lat: number; lng: number };

/** Real exit coordinates from OpenStreetMap (owner decision 2026-08-22 — the
    synthetic ring this used to generate was a fiction the map presented as
    fact). 2805 exits across 584 stations; see scripts/build-station-exits.mjs.
    The table is ~200KB and only renders at EXIT_ZOOM, so it loads on demand —
    same split as lib/subway-path, keeping it off the map's first paint. */
let exitTable: Record<string, StationExit[]> | null = null;

/** Fetch the exit table once. Resolves immediately when already loaded. */
export async function loadStationExits(): Promise<void> {
  if (exitTable) return;
  const mod = await import("@/lib/generated/station-exits");
  exitTable = mod.STATION_EXITS;
}

/** Exits for a station, or [] when unloaded or unmapped upstream — callers
    render nothing rather than inventing a substitute. */
export function stationExits(stationId: string): StationExit[] {
  return exitTable?.[stationId] ?? [];
}

export function placesNearStations(places: Place[], stationIds: string[], radiusKm = 0.55): Place[] {
  const pts = stationIds.map((id) => STATIONS[id]).filter(Boolean);
  return places.filter((p) => pts.some((s) => haversineKm({ lat: p.lat, lng: p.lng }, { lat: s.lat, lng: s.lng }) <= radiusKm));
}

/** Places around one selected station. The station explorer defaults to 1 km. */
export function placesNearStation(places: Place[], stationId: string, radiusKm = 1): Place[] {
  if (!STATIONS[stationId]) return [];
  return placesNearStations(places, [stationId], radiusKm);
}

export function shopCount(places: Place[], stationId: string): number {
  return placesNearStations(places, [stationId]).length;
}
