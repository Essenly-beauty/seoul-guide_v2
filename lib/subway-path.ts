// Turns a computed route into an on-map polyline that follows real rails.
// Track geometry comes from OSM (scripts/build-subway-geometry.mjs); any hop
// we can't confidently slice falls back to a straight station-to-station leg.

import { LINE_PATHS } from "./generated/subway-geometry";
import { STATIONS, type SubwayRoute } from "./subway";
import { haversineKm, type LatLng } from "./geo";

const toLatLng = ([lat, lng]: [number, number]): LatLng => ({ lat, lng });

function nearestIndex(path: [number, number][], p: LatLng): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < path.length; i++) {
    const dLat = path[i][0] - p.lat;
    const dLng = (path[i][1] - p.lng) * 0.8; // rough cos(37.5°) flattening
    const d = dLat * dLat + dLng * dLng;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

function sliceLength(points: LatLng[]): number {
  let km = 0;
  for (let i = 1; i < points.length; i++) km += haversineKm(points[i - 1], points[i]);
  return km;
}

/** Track slice for one hop; falls back to a straight leg when the slice looks
    wrong (failed stitch, loop seam, station projected onto a far branch). */
function hopPath(line: string, a: LatLng, b: LatLng): LatLng[] {
  const path = LINE_PATHS[line];
  if (!path || path.length < 2) return [a, b];
  const ia = nearestIndex(path, a);
  const ib = nearestIndex(path, b);
  if (ia === ib) return [a, b];
  let idx: number[] = [];
  const lo = Math.min(ia, ib);
  const hi = Math.max(ia, ib);
  // Loop lines (Line 2): if the direct span covers more than half the ring,
  // the real track runs the other way around — wrap across the seam.
  const wraps = hi - lo > path.length / 2 && near(path[0], path[path.length - 1]);
  if (wraps) {
    for (let i = hi; i < path.length; i++) idx.push(i);
    for (let i = 0; i <= lo; i++) idx.push(i);
    if (ia < ib) idx.reverse();
  } else {
    for (let i = lo; i <= hi; i++) idx.push(i);
    if (ia > ib) idx.reverse();
  }
  const pts = idx.map((i) => toLatLng(path[i]));
  const straightKm = haversineKm(a, b);
  const trackKm = sliceLength(pts);
  if (trackKm > Math.max(straightKm * 2.6, straightKm + 1.2)) return [a, b];
  return [a, ...pts, b];
}

const near = (p: [number, number], q: [number, number]) =>
  Math.abs(p[0] - q[0]) < 0.002 && Math.abs(p[1] - q[1]) < 0.0025;

/** Full route polyline following the rails, one hop at a time. */
export function routeTrackPath(route: SubwayRoute): LatLng[] {
  const out: LatLng[] = [];
  for (const segment of route.segments) {
    for (let i = 0; i + 1 < segment.stations.length; i++) {
      const a = STATIONS[segment.stations[i]];
      const b = STATIONS[segment.stations[i + 1]];
      if (!a || !b) continue;
      const hop = hopPath(segment.line, a, b);
      // skip the duplicated joint point between consecutive hops
      out.push(...(out.length > 0 ? hop.slice(1) : hop));
    }
  }
  return out;
}
