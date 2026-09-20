import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

/** Rule blocks only: the older contracts used `[\s\S]*?`, which happily
 *  matches across a closing brace into a later rule — a mutation test showed
 *  it passing against un-fixed CSS. `[^}]*` cannot leave the block. */
const block = (selector: string, declaration: string) =>
  new RegExp(`${selector}\\s*\\{[^}]*${declaration}`);

/** R1 (docs/research/ux-interaction-review-2026-09.md): 6,400 lines of CSS
 *  carried exactly two `:active` rules, so nothing acknowledged a finger on a
 *  touch screen, where `:hover` never fires. NN/g puts the "feels instant"
 *  bar at 0.1 s, which only a pressed state can meet — the network cannot. */
describe("touch feedback contracts", () => {
  it("gives the shared tappable surfaces a pressed state", () => {
    for (const selector of ["\\.maprow:active", "\\.chip:active", "\\.sfchip:active", "\\.bottomnav \\.nav:active", "\\.selected-place-summary-main:active"]) {
      expect(css, selector).toMatch(new RegExp(`${selector}[^{]*\\{[^}]*background:`));
    }
  });

  it("presses with a compositor-only transform and a sub-100ms curve", () => {
    expect(css).toMatch(/\.maprow:active[^{]*\{[^}]*transform:\s*scale\(0?\.9\d\)/);
    expect(css).toMatch(/\.maprow:active[^{]*\{[^}]*transition:[^};]*9\dms/);
  });

  it("presses full-width buttons with brightness, since their own transition shorthand drops the base one", () => {
    expect(css).toMatch(block("\\.btn:active", "filter:\\s*brightness"));
    expect(css).toMatch(block("\\.btn", "transition:[^};]*filter"));
  });

  it("does not repaint the selected station row's background, which aria-selected already owns", () => {
    expect(css).toMatch(/\.station-result-options\s*>\s*button:active[^{]*\{[^}]*filter:\s*brightness/);
  });

  it("removes the grey tap flash on real interactive elements only", () => {
    expect(css).toMatch(/-webkit-tap-highlight-color:\s*transparent/);
    expect(css).toMatch(block('\\[role="button"\\]', "touch-action:\\s*manipulation"));
  });

  it("keeps the draggable handles on touch-action: none so the gesture is not stolen", () => {
    expect(css).toMatch(block("\\.mapsheet-handle", "touch-action:\\s*none"));
    expect(css).toMatch(block("\\.subway-snap-handle", "touch-action:\\s*none"));
  });

  it("neutralises the pressed transform under reduced motion, where transition:none would leave a hard jump", () => {
    const rm = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(rm).toMatch(/:active[^{]*\{[^}]*transform:\s*none\s*!important/);
  });
});

/** R8: five control families sat under the 44px floor this project documents
 *  for itself (2026-08-22 spec:105; Apple HIG Layout 44×44pt, WCAG 2.5.5 AAA).
 *  Each of these selectors overrode a compliant base rule, so the base
 *  contract tests never saw them. Every declaration counts, including the
 *  narrow-width media queries. */
describe("touch target floor", () => {
  /** Every `min-height` declared for a selector, anywhere in the file. */
  function minHeights(selector: string): number[] {
    const out: number[] = [];
    const re = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`, "g");
    for (const m of css.matchAll(re)) {
      for (const d of m[1].matchAll(/min-height:\s*(\d+(?:\.\d+)?)px/g)) out.push(Number(d[1]));
    }
    return out;
  }

  const FLOOR = 44;
  for (const selector of [
    ".subway-station-focus > button",
    ".map-top .chip",
    ".filtersheet .chip",
    ".subway-route-steps > span",
    ".daiso-category-chip-visual",
  ]) {
    it(`keeps every ${selector} at ${FLOOR}px or more`, () => {
      const found = minHeights(selector);
      expect(found.length, `${selector} declares no min-height`).toBeGreaterThan(0);
      for (const value of found) expect(value, `${selector} declares ${value}px`).toBeGreaterThanOrEqual(FLOOR);
    });
  }

  it("lets the station filter chip inherit the 44px base instead of shrinking it", () => {
    for (const value of minHeights(".station-filter-rail .sfchip")) expect(value).toBeGreaterThanOrEqual(FLOOR);
  });

  it("gives the snap handle a 44px hit area without growing the chrome budget", () => {
    // The visible strip stays thin (the half-snap budget reserves ~20px for
    // it, 2026-08-22 spec:93/206), so the target is widened with a pseudo
    // element rather than by making the element itself taller.
    expect(css).toMatch(/\.subway-snap-handle::before\s*\{[^}]*height:\s*44px/);
    expect(css).toMatch(/\.subway-snap-handle\s*\{[^}]*position:\s*relative/);
  });
});
