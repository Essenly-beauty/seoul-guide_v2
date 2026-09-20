import { describe, expect, it } from "vitest";
import { withTileKey } from "./map-tiles";

/** CARTO Basemaps Terms (updated 2026-08-26) require every request to carry
 *  the customer's own API key; keyless tiles may be watermarked. The key is
 *  public by nature (it ships to the browser) and lives in
 *  NEXT_PUBLIC_CARTO_API_KEY — absent locally, tiles keep working unkeyed. */
describe("withTileKey", () => {
  const template = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

  it("appends the key as a query parameter after the Leaflet placeholders", () => {
    expect(withTileKey(template, "abc123")).toBe(`${template}?key=abc123`);
  });

  it("leaves the template unchanged when no key is configured", () => {
    expect(withTileKey(template, undefined)).toBe(template);
    expect(withTileKey(template, "")).toBe(template);
    expect(withTileKey(template, "   ")).toBe(template);
  });

  it("joins with & when the template already carries a query string", () => {
    expect(withTileKey(`${template}?foo=1`, "k")).toBe(`${template}?foo=1&key=k`);
  });

  it("URL-encodes the key", () => {
    expect(withTileKey(template, "a b&c")).toBe(`${template}?key=a%20b%26c`);
  });
});

describe("tile URL callers stay in step", () => {
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  const { join } = require("node:path") as typeof import("node:path");
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  /** The first-screen tiles are preloaded by hand so they download in
   *  parallel with the Leaflet chunk. That only works while the preloaded URL
   *  is byte-identical to the one Leaflet later requests — the moment the key
   *  was added to one and not the other, the browser fetched six tiles it
   *  never used and then fetched them again. Every builder of a CARTO URL
   *  must go through withTileKey. */
  it("preloads the first tiles through the same key helper the tile layer uses", () => {
    const screen = read("components/map/map-screen.tsx");
    expect(screen).toMatch(/withTileKey\(/);
    expect(screen).toMatch(/NEXT_PUBLIC_CARTO_API_KEY/);
  });

  it("has no CARTO tile URL built outside the helper", () => {
    for (const path of ["components/map/map-screen.tsx", "components/map/map-view.tsx"]) {
      const src = read(path).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      // Every tile-path URL in these files must sit inside a withTileKey call
      // or be the TILE_URLS template that the tile layer passes to it.
      for (const m of src.matchAll(/rastertiles/g)) {
        const before = src.slice(Math.max(0, m.index! - 260), m.index!);
        expect(
          /withTileKey\(\s*$|withTileKey\([^)]*$|TILE_URLS\s*=\s*\{[\s\S]*$/.test(before),
          `${path}: tile URL at offset ${m.index} is not built through withTileKey`,
        ).toBe(true);
      }
    }
  });
});
