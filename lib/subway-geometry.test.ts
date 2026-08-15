import { describe, expect, it } from "vitest";
import { LINE_PATHS } from "./generated/subway-geometry";
import { LINE_META } from "./subway";

// Guards the OSM track-geometry build (scripts/build-subway-geometry.mjs):
// every line the app knows must ship a real polyline — a regression here
// silently downgrades routes to straight-line fallbacks.

// Full metro-rail extent: Line 1 reaches Sinchang (36.77), Gyeongui-Jungang
// reaches Imjingang (37.94), Gyeongchun reaches Chuncheon (127.73), and the
// airport line reaches Incheon Int'l (126.45).
const BBOX = { south: 36.7, west: 126.3, north: 38.1, east: 127.85 };

describe("subway line geometry", () => {
  it("covers every line in LINE_META (20/20 as of 2026-08-16)", () => {
    const missing = Object.keys(LINE_META).filter((id) => !LINE_PATHS[id]);
    expect(missing).toEqual([]);
  });

  it("each path is a plausible polyline inside greater Seoul", () => {
    for (const [id, path] of Object.entries(LINE_PATHS)) {
      expect(path.length, `${id} point count`).toBeGreaterThanOrEqual(30);
      for (const [lat, lng] of path) {
        expect(lat, `${id} lat`).toBeGreaterThan(BBOX.south);
        expect(lat, `${id} lat`).toBeLessThan(BBOX.north);
        expect(lng, `${id} lng`).toBeGreaterThan(BBOX.west);
        expect(lng, `${id} lng`).toBeLessThan(BBOX.east);
      }
    }
  });

  it("paths are continuous (no jumps larger than ~8km between points)", () => {
    const km = (a: [number, number], b: [number, number]) => {
      const dLat = ((b[0] - a[0]) * Math.PI) / 180;
      const dLng = ((b[1] - a[1]) * Math.PI) / 180;
      const s = Math.sin(dLat / 2) ** 2 + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
      return 6371 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
    };
    for (const [id, path] of Object.entries(LINE_PATHS)) {
      for (let i = 1; i < path.length; i++) {
        expect(km(path[i - 1], path[i]), `${id} gap at ${i}`).toBeLessThan(8);
      }
    }
  });
});
