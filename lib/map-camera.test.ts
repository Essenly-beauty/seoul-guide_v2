import { describe, expect, it } from "vitest";
import { visibleMapAnchor } from "./map-camera";

describe("visibleMapAnchor", () => {
  it("returns the full canvas center without overlays", () => {
    expect(visibleMapAnchor({ width: 390, height: 844 }, {})).toEqual({ x: 195, y: 422 });
  });

  it("centers between the top controls and collapsed place sheet", () => {
    expect(visibleMapAnchor(
      { width: 390, height: 844 },
      { top: 112, bottom: 72 },
    )).toEqual({ x: 195, y: 442 });
  });

  it("clamps invalid insets to the available canvas", () => {
    expect(visibleMapAnchor(
      { width: 390, height: 844 },
      { top: -20, right: 500, bottom: 900, left: -10 },
    )).toEqual({ x: 0, y: 0 });
  });
});
