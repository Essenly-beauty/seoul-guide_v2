import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Source contract in the style of lib/map-selection-wiring.test.ts: every
// selected-place surface of the map sheet should show the published overlay.
const sheet = readFileSync(new URL("../components/map/map-sheet.tsx", import.meta.url), "utf8");

function summaryProps(variant: "compact" | "half") {
  const end = sheet.indexOf(`variant="${variant}"`);
  const start = sheet.lastIndexOf("<SelectedPlaceSummary", end);
  return sheet.slice(start, end);
}

describe("map sheet published overlay wiring", () => {
  it("half summary, detail, CTA and action bar get the published place", () => {
    expect(summaryProps("half")).toContain("place={publishedPlace ?? selectedPlace}");
    expect(sheet).toContain("<PlaceDetailBody\n              place={publishedPlace ?? selectedPlace}");
    expect(sheet).toContain("<PlaceCtaBar place={publishedPlace ?? selectedPlace} />");
    expect(sheet).toContain("<SelectedPlaceActionBar place={publishedPlace ?? selectedPlace} />");
  });

  it("the compact (peek) summary shows the same published name/address as the half summary", () => {
    console.log("compact summary props:", JSON.stringify(summaryProps("compact").trim()));
    expect(summaryProps("compact")).toContain("publishedPlace");
  });
});
