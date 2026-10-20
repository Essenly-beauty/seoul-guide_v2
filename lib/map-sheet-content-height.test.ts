import { describe, expect, it } from "vitest";
import { selectedSheetVisibleHeight } from "./map-sheet-state";

describe("selected sheet content height", () => {
  it("fits a short photo-free summary without leaving a viewport-sized gap", () => {
    expect(selectedSheetVisibleHeight(800, 148, 44, 68, 210)).toBe(260);
  });
  it("keeps a wrapped title and photos above the fixed actions", () => {
    expect(selectedSheetVisibleHeight(800, 340, 44, 68, 236)).toBe(452);
  });
  it("caps tall content while preserving map context and a larger half than peek", () => {
    expect(selectedSheetVisibleHeight(800, 900, 44, 68, 236)).toBe(544);
    expect(selectedSheetVisibleHeight(800, 80, 44, 68, 236)).toBe(252);
  });
  it("stays within short viewports", () => {
    expect(selectedSheetVisibleHeight(200, 340, 44, 68, 236)).toBe(200);
    expect(selectedSheetVisibleHeight(0, 340, 44, 68, 236)).toBe(0);
  });
});
