import { describe, expect, it } from "vitest";
import { keyboardInset } from "./keyboard-inset";

/** R3 (docs/research/ux-interaction-review-2026-09.md): with the software
 *  keyboard up, only one of six station results was fully visible — the panel
 *  bottom sat 56px below the visual viewport. The OSK shrinks the VISUAL
 *  viewport while leaving the layout viewport alone (MDN VisualViewport), so
 *  the app has to read that difference itself. */
describe("keyboardInset", () => {
  it("is the height the keyboard takes from the visual viewport", () => {
    expect(keyboardInset({ innerHeight: 844, viewportHeight: 430, offsetTop: 0, scale: 1 })).toBe(414);
  });

  it("is zero when no keyboard is up", () => {
    expect(keyboardInset({ innerHeight: 844, viewportHeight: 844, offsetTop: 0, scale: 1 })).toBe(0);
  });

  it("accounts for a scrolled visual viewport, which iOS uses to keep the caret visible", () => {
    expect(keyboardInset({ innerHeight: 844, viewportHeight: 430, offsetTop: 100, scale: 1 })).toBe(314);
  });

  it("never goes negative, so a taller visual viewport cannot push the panel off screen", () => {
    expect(keyboardInset({ innerHeight: 844, viewportHeight: 900, offsetTop: 0, scale: 1 })).toBe(0);
  });

  it("reports no inset while the user is pinch-zoomed, where the shrunken viewport is not a keyboard", () => {
    expect(keyboardInset({ innerHeight: 844, viewportHeight: 300, offsetTop: 40, scale: 2.5 })).toBe(0);
  });

  it("ignores sub-pixel noise so a resize storm cannot thrash the custom property", () => {
    expect(keyboardInset({ innerHeight: 844, viewportHeight: 843.6, offsetTop: 0, scale: 1 })).toBe(0);
  });
});

describe("keyboard inset wiring", () => {
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  const { join } = require("node:path") as typeof import("node:path");
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("the hook is a client module that only touches visualViewport inside an effect", () => {
    const hook = read("components/ui/use-keyboard-inset.ts");
    expect(hook).toMatch(/^"use client";/);
    expect(hook).toMatch(/useEffect\(/);
    expect(hook).toMatch(/requestAnimationFrame/);
    expect(hook).toMatch(/--kb/);
    // recomputed when focus leaves, because iOS does not always reset offsetTop
    expect(hook).toMatch(/focusout/);
  });

  it("the subway panel is mounted with the hook", () => {
    expect(read("components/subway/subway-route-controller.tsx")).toMatch(/useKeyboardInset\(\)/);
  });

  it("the panel SHRINKS by the inset instead of being pushed up", () => {
    // Moving it with `bottom` alone clips the input fields, because
    // .map-screen sets overflow:hidden — the panel has to lose height.
    const css = read("app/globals.css");
    expect(css).toMatch(/\.subway-controller\s*\{[^}]*max-height:\s*calc\([^)]*var\(--kb/);
    expect(css).toMatch(/\.station-search-results[^{]*\{[^}]*var\(--kb/);
  });
});
