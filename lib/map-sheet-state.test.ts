import { describe, expect, it } from "vitest";

describe("map sheet selected-place state", () => {
  it("resolves each snap to exactly one selected-place presentation", async () => {
    const modulePath = "./map-sheet-state";
    const stateModule = await import(modulePath).catch(() => ({}));
    const resolveSelectedPlaceView = (stateModule as {
      resolveSelectedPlaceView?: (snap: "peek" | "half" | "full") => string;
    }).resolveSelectedPlaceView;

    expect(resolveSelectedPlaceView).toBeTypeOf("function");
    expect([
      resolveSelectedPlaceView?.("peek"),
      resolveSelectedPlaceView?.("half"),
      resolveSelectedPlaceView?.("full"),
    ]).toEqual(["compact", "summary", "detail"]);
  });

  it("cycles through the three stable snaps in map-tab order", async () => {
    const modulePath = "./map-sheet-state";
    const stateModule = await import(modulePath).catch(() => ({}));
    const nextMapSheetSnap = (stateModule as {
      nextMapSheetSnap?: (snap: "peek" | "half" | "full") => string;
    }).nextMapSheetSnap;

    expect(nextMapSheetSnap).toBeTypeOf("function");
    expect([
      nextMapSheetSnap?.("half"),
      nextMapSheetSnap?.("full"),
      nextMapSheetSnap?.("peek"),
    ]).toEqual(["full", "peek", "half"]);
  });

  it("keeps the selected half sheet at the same visual top after stabilizing its height", async () => {
    const modulePath = "./map-sheet-state";
    const stateModule = await import(modulePath);
    const getMapSheetHalfOffsetRatio = (stateModule as {
      getMapSheetHalfOffsetRatio?: (hasSelection: boolean) => number;
    }).getMapSheetHalfOffsetRatio;

    expect(getMapSheetHalfOffsetRatio).toBeTypeOf("function");
    expect(getMapSheetHalfOffsetRatio?.(true)).toBe(0.52);
    expect(getMapSheetHalfOffsetRatio?.(false)).toBe(0.42);
  });
});

describe("map sheet drag physics", () => {
  const offsets = { full: 0, half: 440, peek: 610 };

  it("lets a slow release settle to the nearest snap", async () => {
    const { resolveReleaseSnap } = await import("./map-sheet-state");
    expect(resolveReleaseSnap({ offsets, position: 400, velocity: 0 })).toBe("half");
    expect(resolveReleaseSnap({ offsets, position: 150, velocity: 0 })).toBe("full");
    expect(resolveReleaseSnap({ offsets, position: 560, velocity: 0 })).toBe("peek");
  });

  it("lets gentle momentum tip a release that sits near the midpoint", async () => {
    const { resolveReleaseSnap } = await import("./map-sheet-state");
    // 215px is 5px short of the full/half midpoint; drifting down at 0.2px/ms carries it past.
    expect(resolveReleaseSnap({ offsets, position: 215, velocity: 0.2 })).toBe("half");
    expect(resolveReleaseSnap({ offsets, position: 225, velocity: -0.2 })).toBe("full");
  });

  it("always advances a flick to a snap ahead of the finger", async () => {
    const { resolveReleaseSnap, FLICK_VELOCITY } = await import("./map-sheet-state");
    // Flick down from half after barely moving: never bounces back to half.
    expect(resolveReleaseSnap({ offsets, position: 450, velocity: FLICK_VELOCITY })).toBe("peek");
    // Flick up from just below half: half is "here", so it goes on to full.
    expect(resolveReleaseSnap({ offsets, position: 445, velocity: -0.6 })).toBe("full");
    // Moderate flick up from peek lands on half; a hard one clears it to full.
    expect(resolveReleaseSnap({ offsets, position: 600, velocity: -0.8 })).toBe("half");
    expect(resolveReleaseSnap({ offsets, position: 600, velocity: -3 })).toBe("full");
    // Flicking past the last snap stays on it.
    expect(resolveReleaseSnap({ offsets, position: 612, velocity: 1.2 })).toBe("peek");
    expect(resolveReleaseSnap({ offsets, position: 0, velocity: -1.2 })).toBe("full");
  });

  it("resists past the bounds without ever exceeding the sheet height", async () => {
    const { rubberBand } = await import("./map-sheet-state");
    expect(rubberBand(300, 0, 610, 800)).toBe(300);
    expect(rubberBand(0, 0, 610, 800)).toBe(0);
    const a = rubberBand(-50, 0, 610, 800);
    const b = rubberBand(-200, 0, 610, 800);
    expect(a).toBeLessThan(0);
    expect(a).toBeGreaterThan(-50);
    expect(b).toBeLessThan(a);
    expect(b).toBeGreaterThan(-800);
    expect(rubberBand(700, 0, 610, 800)).toBeGreaterThan(610);
    expect(rubberBand(700, 0, 610, 800)).toBeLessThan(700);
  });

  it("produces a per-frame spring that ends exactly on the target", async () => {
    const { springKeyframes } = await import("./map-sheet-state");
    const settle = springKeyframes({ from: 440, to: 0, velocity: -1.5 });
    expect(settle.frames[0]).toBe(440);
    expect(settle.frames[settle.frames.length - 1]).toBe(0);
    expect(settle.duration).toBeGreaterThan(150);
    expect(settle.duration).toBeLessThanOrEqual(700);
    expect(settle.duration).toBeCloseTo((settle.frames.length - 1) * (1000 / 60), 5);
    // Barely under-damped: any overshoot stays a few px, never a bounce.
    expect(Math.min(...settle.frames)).toBeGreaterThan(-12);
    // With no velocity it still travels the whole way and stops.
    const still = springKeyframes({ from: 100, to: 400, velocity: 0 });
    expect(still.frames[still.frames.length - 1]).toBe(400);
    expect(still.frames[1]).toBeGreaterThan(100);
  });
});
