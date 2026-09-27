import { describe, expect, it } from "vitest";
import {
  BEARING_SNAP_DEG,
  ROTATION_THRESHOLD_PX,
  angleDeg,
  createTwoFingerGesture,
  normalizeBearing,
  pivotCenter,
  rotatePoint,
  rotationThresholdDeg,
  shortestDelta,
  snapToNorth,
} from "./map-rotate";

/** Two-finger zoom + rotate, the maths only. The DOM handler in
 *  lib/map-touch-rotate.ts feeds it touch points and applies what comes back.
 *  Conventions follow MapLibre's two-finger handler (BSD): rotation arms only
 *  once the fingers have travelled ROTATION_THRESHOLD_PX along their circle,
 *  the sub-threshold angle is discarded so arming never jumps, and the
 *  smallest finger spread seen so far sets the threshold so a pinch-in does
 *  not turn into an accidental rotation. */

describe("angles", () => {
  it("measures the angle of the line between two fingers in degrees, screen y down", () => {
    expect(angleDeg({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(0);
    expect(angleDeg({ x: 0, y: 0 }, { x: 0, y: 10 })).toBe(90);
    expect(angleDeg({ x: 10, y: 10 }, { x: 0, y: 10 })).toBe(180);
  });

  it("takes the short way round between two angles", () => {
    expect(shortestDelta(350, 10)).toBe(20);
    expect(shortestDelta(10, 350)).toBe(-20);
    expect(shortestDelta(0, 180)).toBe(180);
    expect(shortestDelta(90, 90)).toBe(0);
  });

  it("keeps a bearing in (-180, 180]", () => {
    expect(normalizeBearing(270)).toBe(-90);
    expect(normalizeBearing(-180)).toBe(180);
    expect(normalizeBearing(180)).toBe(180);
    expect(normalizeBearing(725)).toBe(5);
  });
});

describe("rotation threshold", () => {
  it("is 25px along the circumference of the finger circle, so wider spreads arm sooner", () => {
    expect(ROTATION_THRESHOLD_PX).toBe(25);
    expect(rotationThresholdDeg(100)).toBeCloseTo(28.65, 1);
    expect(rotationThresholdDeg(200)).toBeCloseTo(14.32, 1);
    expect(rotationThresholdDeg(40)).toBeCloseTo(71.6, 0);
  });
});

describe("pivot", () => {
  it("rotates a screen vector clockwise on screen (y down)", () => {
    const r = rotatePoint({ x: 1, y: 0 }, 90);
    expect(r.x).toBeCloseTo(0, 9);
    expect(r.y).toBeCloseTo(1, 9);
  });

  it("puts the centre where the anchor lands exactly under the fingers' midpoint, at any bearing", () => {
    // forward model of the fork: container = centre + rotate(crs(anchor) - crs(centre), +bearing)
    const c = { x: 195, y: 422 };
    for (const bearing of [0, 37, 90, -120, 180]) {
      const anchor = { x: 1000, y: 2000 };
      const mid = { x: 100, y: 300 };
      const centre = pivotCenter(anchor, mid, c, bearing);
      const back = rotatePoint({ x: anchor.x - centre.x, y: anchor.y - centre.y }, bearing);
      expect(c.x + back.x).toBeCloseTo(mid.x, 6);
      expect(c.y + back.y).toBeCloseTo(mid.y, 6);
    }
  });
});

describe("snap to north", () => {
  it("settles within 7° of north onto north, and leaves larger bearings alone", () => {
    expect(BEARING_SNAP_DEG).toBe(7);
    expect(snapToNorth(5)).toBe(0);
    expect(snapToNorth(-6.9)).toBe(0);
    expect(snapToNorth(7.5)).toBe(7.5);
    expect(snapToNorth(178)).toBe(178);
  });
});

describe("two-finger gesture", () => {
  const spread = (d: number, deg: number, cx = 195, cy = 422): [{ x: number; y: number }, { x: number; y: number }] => {
    const a = (deg * Math.PI) / 180;
    return [
      { x: cx - (d / 2) * Math.cos(a), y: cy - (d / 2) * Math.sin(a) },
      { x: cx + (d / 2) * Math.cos(a), y: cy + (d / 2) * Math.sin(a) },
    ];
  };
  const start = (d: number, deg = 0, bearing = 0) =>
    createTwoFingerGesture({ touches: spread(d, deg), zoom: 15, bearing });

  it("a pure pinch zooms and never rotates", () => {
    const g = start(100);
    const out = g.update(spread(150, 0));
    expect(out.zoom).toBeCloseTo(15 + Math.log2(1.5), 6);
    expect(out.rotating).toBe(false);
    expect(out.bearing).toBe(0);
  });

  it("a small twist under the threshold does not rotate", () => {
    const g = start(100); // threshold ≈ 28.6°
    expect(g.update(spread(100, 20)).rotating).toBe(false);
    expect(g.update(spread(100, 20)).bearing).toBe(0);
  });

  it("arms without a jump: the frame that crosses the threshold keeps the old bearing", () => {
    const g = start(100);
    const arm = g.update(spread(100, 40));
    expect(arm.rotating).toBe(true);
    expect(arm.bearing).toBe(0);
    const next = g.update(spread(100, 50));
    expect(next.bearing).toBeCloseTo(10, 6);
  });

  it("fingers close together need a much bigger twist (accidental-rotation guard)", () => {
    const g = start(40); // threshold ≈ 71.6°
    expect(g.update(spread(40, 45)).rotating).toBe(false);
  });

  it("uses the smallest spread seen so far, so pinching in does not make rotation trigger-happy", () => {
    const g = start(200); // threshold 14.3° at 200px…
    g.update(spread(60, 0)); // …but the fingers came together: now 47.7°
    expect(g.update(spread(60, 20)).rotating).toBe(false);
  });

  it("accumulates past 180° and reports a normalised bearing", () => {
    const g = start(100);
    let out = g.update(spread(100, 40));
    for (const deg of [90, 140, 190, 240, 270]) out = g.update(spread(100, deg));
    expect(out.bearing).toBeCloseTo(-130, 6); // 270 - 40 = 230 → -130
  });

  it("starts from the map's current bearing", () => {
    const g = start(100, 0, 30);
    g.update(spread(100, 40));
    expect(g.update(spread(100, 55)).bearing).toBeCloseTo(45, 6);
  });

  it("reports the fingers' midpoint for the pivot", () => {
    const g = start(100, 0);
    expect(g.update(spread(100, 0, 120, 300)).midpoint).toEqual({ x: 120, y: 300 });
  });

  it("accepts a CRS-aware zoom scale function", () => {
    const g = createTwoFingerGesture({ touches: spread(100, 0), zoom: 15, bearing: 0, scaleZoom: (scale, from) => from + scale });
    expect(g.update(spread(200, 0)).zoom).toBe(17);
  });
});
