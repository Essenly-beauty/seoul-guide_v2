import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

/** docs/research/gutter-alignment-2026-09.md — the canonical horizontal
 *  gutter is 16px. The owner reported the "Products to look for" header
 *  sitting hard against the screen edge while every sibling in the same
 *  scroller started at 16px. The scroller deliberately has no horizontal
 *  padding (2026-08-22 decision), so a child that zeroes its own lands on
 *  the panel edge. */
describe("horizontal gutter contracts", () => {
  it("the route-ready section header keeps the inherited 16px side padding", () => {
    const rule = css.slice(css.indexOf(".subway-controller.route-ready .subway-nearby-heading {"));
    const body = rule.slice(0, rule.indexOf("}"));
    expect(body).toBeTruthy();
    // A `padding` shorthand here re-zeroes the sides at higher specificity —
    // that was the regression. Either restrict it to the block axis or state
    // the 16px explicitly.
    expect(body).toMatch(/padding-block:|padding:\s*\d+px\s+16px/);
    expect(body).not.toMatch(/padding:\s*\d+px\s+0\b/);
  });

  it("keeps the base rule that supplies those 16px", () => {
    expect(css).toMatch(/\.subway-controller \.subway-nearby-heading\s*\{[^}]*padding:[^;]*16px/);
  });

  it("draws the product rows' divider to the same width as the station rows", () => {
    const rule = css.slice(css.indexOf(".subway-product-picks > a {"));
    const body = rule.slice(0, rule.indexOf("}"));
    expect(body).toMatch(/padding:\s*\d+px\s+16px/);
    expect(body).not.toMatch(/margin:\s*0\s+16px/);
  });

  it("aligns the floating map chrome as one family, not one member at a time", () => {
    // 14px was the shared corner of .map-top, .map-banner, .map-fab,
    // .map-rotation-reset and .metro-zoombtn: moving one alone re-creates the
    // reported defect on the overlay layer.
    for (const selector of ["\\.map-banner", "\\.map-fab", "\\.map-rotation-reset"]) {
      const m = new RegExp(`${selector}\\s*\\{[^}]*\\}`).exec(css);
      expect(m, selector).toBeTruthy();
      expect(m![0], selector).not.toMatch(/(?:left|right):\s*14px/);
    }
  });

  it("gives the product CTA bar the standard gutter", () => {
    const rule = css.slice(css.indexOf(".product-cta-bar {"));
    expect(rule.slice(0, rule.indexOf("}"))).toMatch(/padding:\s*\d+px\s+16px/);
  });
});
