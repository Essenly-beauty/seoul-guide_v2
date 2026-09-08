import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const categoryPageSource = readFileSync(
  new URL("../app/places/[category]/page.tsx", import.meta.url),
  "utf8",
);
const globalCssSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const placesContentSource = readFileSync(
  new URL("../components/places/places-content.tsx", import.meta.url),
  "utf8",
);

describe("category publication routes", () => {
  it("404s category metadata that has no public places", () => {
    expect(categoryPageSource).toContain("const places = PLACES.filter");
    expect(categoryPageSource).toMatch(/if \(places\.length === 0\) notFound\(\);/);

    const guardIndex = categoryPageSource.indexOf("if (places.length === 0) notFound();");
    expect(guardIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeLessThan(categoryPageSource.indexOf("<PlacesContent"));
  });
});

describe("category accent tokens", () => {
  it("mirrors the Daiso category color for CSS consumers", () => {
    expect(globalCssSource).toMatch(/--c-daiso:\s*#d64b5f;/i);
  });
});

describe("category place-name hierarchy", () => {
  it("shows the English name first and official Korean name second, including Daiso rows", () => {
    expect(categoryPageSource).toContain('<PlacesContent category={params.category} places={places} />');
    expect(placesContentSource).toContain('className="place-name-primary"');
    expect(placesContentSource).toContain("{p.name}");
    expect(placesContentSource).toContain('className="place-name-secondary"');
    expect(placesContentSource).toContain("{p.nameKr}");
    expect(placesContentSource).toContain('lang="ko"');
    expect(placesContentSource.indexOf("{p.name}")).toBeLessThan(placesContentSource.indexOf("{p.nameKr}"));
  });

  it("styles the two names as distinct ellipsized lines", () => {
    expect(globalCssSource).toMatch(/\.place-name-primary\s*\{[^}]*display:\s*block;[^}]*text-overflow:\s*ellipsis;/s);
    expect(globalCssSource).toMatch(/\.place-name-secondary\s*\{[^}]*display:\s*block;[^}]*text-overflow:\s*ellipsis;/s);
  });
});
