import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { routeTrackDensity, segmentIndexForHop, stopIndexAt, stopOffset, trackKeyTarget } from "./subway-track";
import { findRoute, routeSegmentStartIndices, STATIONS } from "./subway";

describe("track-3: density thresholds sit exactly at 7px / 12px spacing and 22 / 48 stops", () => {
  it("pins the spacing boundaries", () => {
    expect(routeTrackDensity(13, 84)).toBe("1");   // exactly 7px
    expect(routeTrackDensity(13, 83.9)).toBe("2");
    expect(routeTrackDensity(13, 144)).toBe("0");  // exactly 12px
    expect(routeTrackDensity(13, 143.9)).toBe("1");
    expect(routeTrackDensity(48, 268)).toBe("2");  // a 320px phone: 320 - 2*16 padding - 2*10 rail inset
  });
  it("pins the unmeasured fallback boundaries", () => {
    expect(routeTrackDensity(22, 0)).toBe("0");
    expect(routeTrackDensity(23, 0)).toBe("1");
    expect(routeTrackDensity(48, 0)).toBe("1");
    expect(routeTrackDensity(49, 0)).toBe("2");
  });
});

describe("tests-6: pointer scrub maps onto the drawn dots", () => {
  it("both end dots and every stop between map to their own index on the rail", () => {
    const rail = { left: 26, width: 300 };
    for (const count of [2, 16, 39, 49]) {
      for (let i = 0; i < count; i++) {
        const x = rail.left + (parseFloat(stopOffset(i, count)) / 100) * rail.width;
        expect(stopIndexAt(x, rail, count)).toBe(i);
      }
    }
    expect(stopIndexAt(0, rail, 39)).toBe(0);      // left of the rail clamps to the departure
    expect(stopIndexAt(9999, rail, 39)).toBe(38);  // right of it to the arrival
    expect(stopIndexAt(100, { left: 0, width: 0 }, 39)).toBeNull();
  });
  it("the controller scrubs against the rail, not the wider track", () => {
    const src = readFileSync(new URL("../components/subway/subway-route-controller.tsx", import.meta.url), "utf8");
    expect(src).toContain("stopIndexAt(clientX, (railEl.current ?? el).getBoundingClientRect()");
    expect(src).toContain("routeTrackDensity(readyRoute?.stations.length ?? 0, railWidth)");
  });
});

describe("track-4: slider keys", () => {
  it("follows the APG slider pattern and clamps", () => {
    expect(trackKeyTarget("ArrowRight", 3, 10)).toBe(4);
    expect(trackKeyTarget("ArrowUp", 3, 10)).toBe(4);
    expect(trackKeyTarget("ArrowLeft", 3, 10)).toBe(2);
    expect(trackKeyTarget("ArrowDown", 0, 10)).toBe(0);
    expect(trackKeyTarget("Home", 7, 10)).toBe(0);
    expect(trackKeyTarget("End", 2, 10)).toBe(9);
    expect(trackKeyTarget("PageUp", 7, 10)).toBe(9);
    expect(trackKeyTarget("Tab", 3, 10)).toBeNull();
  });
});

describe("track-2: the leg into a transfer station keeps the line it was ridden on", () => {
  it("the controller colours each leg by the hop's segment, the stop by its own", () => {
    const src = readFileSync(new URL("../components/subway/subway-route-controller.tsx", import.meta.url), "utf8");
    expect(src).toContain("segmentIndexForHop(segmentStarts, index - 1)");
    expect(src).toMatch(/subway-track-leg" style=\{\{ background: legColor,/);
  });

  it("Gangnam -> Myeongdong", () => {
    const route = findRoute("gangnam", "myeongdong")!;
    const starts = routeSegmentStartIndices(route);
    for (let index = 1; index < route.stations.length; index++) {
      const segment = route.segments[segmentIndexForHop(starts, index - 1)];
      const from = route.stations[index - 1];
      const to = route.stations[index];
      expect(segment.stations, `${STATIONS[from].name} -> ${STATIONS[to].name}`).toEqual(expect.arrayContaining([from, to]));
    }
  });
});
