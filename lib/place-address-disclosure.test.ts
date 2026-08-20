import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const detailSource = readFileSync(new URL("../components/place/place-detail-body.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

describe("place address disclosure", () => {
  it("expands the title address into names, address, copy actions, and driver mode", () => {
    expect(detailSource).toContain("function PlaceAddressDisclosure");
    expect(detailSource).toContain("aria-expanded={expanded}");
    expect(detailSource).toContain("English name");
    expect(detailSource).toContain("Korean name");
    expect(detailSource).toContain("Copy address");
    expect(detailSource).toContain("<TaxiCard place={place}");
  });

  it("uses a clear expandable address row and grouped detail panel", () => {
    expect(css).toContain(".place-address-toggle");
    expect(css).toContain(".place-address-panel");
    expect(css).toContain(".place-address-detail-row");
    expect(css).toContain(".place-address-disclosure > .taxicard");
  });
});
