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
