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
