import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const view = source("components/map/map-view.tsx");
const handler = source("lib/map-touch-rotate.ts");
const config = source("next.config.mjs");
const css = source("app/globals.css");

/** Two-finger rotation, for real (owner request 2026-09-27). Leaflet cannot
 *  rotate, so the map runs leaflet-rotate-map — a BSD Leaflet 1.9.4 build
 *  with the rotate branch merged — and a handler of our own drives it. The
 *  2026-08-20 proof of concept that CSS-rotated the pane behind an env flag
 *  is gone: it rotated pixels, not Leaflet's coordinate system. */
describe("map rotation runs on a rotation-aware engine", () => {
  it("aliases the bare leaflet specifier to the fork for webpack and Turbopack, leaving deep imports alone", () => {
    // react-leaflet imports "leaflet"; both must resolve to the same instance
    // or MapContainer builds a plain Leaflet map that ignores rotate:true.
    expect(config).toMatch(/leaflet\$["']?\s*:\s*["']leaflet-rotate-map["']/);
    expect(config).toMatch(/resolveAlias:\s*\{[^}]*leaflet:\s*["']leaflet-rotate-map["']/);
    expect(source("package.json")).toContain('"leaflet-rotate-map"');
    expect(source("types/leaflet-rotate.d.ts")).toContain("setBearing(theta: number): void");
  });

  it("turns rotation on and hands the two-finger gesture to our handler, not Leaflet's pinch", () => {
    expect(view).toMatch(/<MapContainer[^>]*\brotate\b/);
    expect(view).toMatch(/<MapContainer[^>]*touchZoom=\{false\}/);
    expect(view).toContain("new TouchZoomRotate(map)");
    expect(view).not.toContain("style.rotate");
    expect(view).not.toContain("NEXT_PUBLIC_ENABLE_EXPERIMENTAL_MAP_ROTATION");
  });

  it("keeps the page from pinch-zooming while the map owns two fingers", () => {
    // Leaflet only sets touch-action:none when its own touchZoom is on.
    expect(handler).toContain('"leaflet-touch-zoom"');
    expect(handler).toMatch(/preventDefault/);
  });

  it("pivots around the fingers and honours the gesture maths module", () => {
    expect(handler).toContain("createTwoFingerGesture(");
    expect(handler).toContain("pivotCenter(");
    expect(handler).toContain("snapToNorth(");
    expect(handler).toContain("map.setBearing(");
    expect(handler).toMatch(/_move\(/);
  });

  it("decides what is on screen from the rotated viewport, not the unrotated box", () => {
    // culling, hero placement, transit layer and the area-search getter all
    // asked getBounds(); on a rotated map that misses the corners.
    expect(view).not.toMatch(/map\.getBounds\(\)/);
    expect(view.match(/visibleBounds\(map\)/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(handler).toContain("getCircumscribedBounds");
  });

  it("rotates the screen-space focus offset into map space before flying to a pin", () => {
    // focusTarget shifts the target by a pixel offset so the pin clears the
    // sheet; that offset is in screen space and must turn with the map.
    expect(view).toMatch(/L\.point\(size\.x \/ 2 - anchor\.x, size\.y \/ 2 - anchor\.y\)\.rotate\(/);
  });

  it("points the heading arrow at true north on a rotated map", () => {
    // marker icons stay screen-upright in the fork, so the device heading
    // must have the map bearing taken out of it.
    expect(view).toMatch(/meIconForHeading\([^)]*bearing/);
  });

  it("shows a compass only while rotated, and it puts the map back north", () => {
    expect(view).toContain('aria-label="Point map north"');
    expect(view).toContain("map-compass");
    expect(css).toMatch(/\.map-compass\s*\{/);
    expect(css).toMatch(/\.map-compass\[hidden\]|\.map-compass\.hidden|\.map-compass:not\(\.on\)/);
  });

  it("arms the north snap before Leaflet can end the zoom synchronously, and disarms it on the next gesture", () => {
    // Leaflet's zoom-animation proxy ends the animation *inside* _animateZoom
    // when the transform did not change (issue #4149) — exactly what a pure
    // rotation about the centre produces — so moveend fires before a listener
    // attached afterwards, which then snapped the *next* rotation to north.
    expect(handler).toContain("this.armSnap(");
    expect(handler.indexOf("this.armSnap(")).toBeLessThan(handler.indexOf("map._animateZoom("));
    const start = handler.indexOf("private onStart(");
    const move = handler.indexOf("private onMove(");
    expect(handler.slice(start, move)).toContain("this.disarmSnap()");
  });

  it("flushes the last frame before deciding how the gesture ended", () => {
    // A quick pinch can end before its animation frame ran; the frame must
    // still be applied and the gesture must still finish (zoom snap, moveend),
    // or the map is left at a fractional zoom with no moveend for the app.
    const end = handler.slice(handler.indexOf("private onEnd("), handler.indexOf("private armSnap("));
    expect(end.indexOf("this.apply()")).toBeGreaterThan(-1);
    expect(end.indexOf("this.apply()")).toBeLessThan(end.indexOf("const last = this.last"));
  });

  it("lets a new gesture cut a running north animation short without losing its moveend", () => {
    // The frames of the ease are quiet; the moveend they withhold is what
    // loads tiles and re-culls. Cancelling must fire it.
    expect(handler).toContain("stopBearingAnimation(");
    expect(handler).toMatch(/private onStart\(e: TouchEvent\) \{[\s\S]*?stopBearingAnimation\(map/);
    expect(handler).toMatch(/function stopBearingAnimation[\s\S]*?fire\("moveend"\)/);
  });

  it("never leaves the map drawn through the fork's 0.1° stand-in for north", () => {
    // The fork stores (theta || 0.1): a bearing of exactly 0 becomes 0.1°, and
    // every tile and label is then resampled through a rotate transform on a
    // map nobody turned. A sub-pixel epsilon keeps the fork's truthy checks
    // happy and the raster pixel-aligned.
    expect(handler).toContain("NORTH_EPS");
    expect(handler).toMatch(/settleNorth/);
    expect(view).toContain("settleNorth(map)");
  });

  it("keeps the bearing out of MapView state so a rotate frame re-renders only the compass and the heading marker", () => {
    expect(view).toContain("function useMapBearing(");
    expect(view).toMatch(/function MeMarker\(/);
    const mapView = view.indexOf("function MapView(");
    expect(mapView).toBeGreaterThan(-1);
    expect(view.slice(mapView)).not.toMatch(/\bbearing\b|setBearing|useMapBearing\(/);
  });

  it("renders the compass beside the other floating controls, not trapped under the map's stacking context", () => {
    // .map-canvas is z-index:0; anything inside it paints under the top bar
    // and the banners. The button portals out to the screen wrapper.
    expect(view).toMatch(/createPortal\([\s\S]*?map-compass/);
    expect(css).toMatch(/\.map-compass\s*\{[^}]*z-index:\s*900/);
  });

  it("respects reduced motion for the compass reset and the north snap", () => {
    expect(handler).toContain("reducedMotion");
  });
});
