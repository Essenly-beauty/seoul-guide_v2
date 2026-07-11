/** Seoul metropolitan subway network (592 stations, 693 undirected edges) for
 *  beauty-zone route discovery. Sourced from lib/subway-data.json (Task S1);
 *  geometry (x/y schematic coords) now lives in the map SVG asset, not here. */

import raw from "./subway-data.json";
import { haversineKm } from "./geo";
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

export type RouteSegment = { line: LineId; stations: string[] };
export type SubwayRoute = { stations: string[]; segments: RouteSegment[] };

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
  if (fromId === toId) return { stations: [fromId], segments: [{ line: STATIONS[fromId].lines[0], stations: [fromId] }] };

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

  return { stations, segments };
}

/**
 * Total travel time in minutes: sum of the route's edge seconds (re-walked
 * from the adjacency index — the path is at most a few dozen hops, so this
 * is trivial) plus a ~3 min (180s) allowance per transfer. Transfer time is
 * included because it makes the displayed ETA honest door-to-door, even
 * though the search already applies the same penalty internally to steer
 * away from excessive line-changes.
 */
export function travelMinutes(route: SubwayRoute): number {
  let totalSec = 0;
  for (let i = 0; i < route.stations.length - 1; i++) {
    const edge = ADJ.get(route.stations[i])?.find((e) => e.to === route.stations[i + 1]);
    if (edge) totalSec += edge.sec;
  }
  const transfers = Math.max(0, route.segments.length - 1);
  return Math.round((totalSec + transfers * TRANSFER_PENALTY_SEC) / 60);
}

/** Shops within walking radius (~7 min) of ANY station on the route. */
export function placesNearStations(places: Place[], stationIds: string[], radiusKm = 0.55): Place[] {
  const pts = stationIds.map((id) => STATIONS[id]).filter(Boolean);
  return places.filter((p) => pts.some((s) => haversineKm({ lat: p.lat, lng: p.lng }, { lat: s.lat, lng: s.lng }) <= radiusKm));
}

export function shopCount(places: Place[], stationId: string): number {
  return placesNearStations(places, [stationId]).length;
}
