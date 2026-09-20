import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const css = read("app/globals.css");
const ruleBody = (selector: string) => {
  const i = css.indexOf(selector + " {");
  if (i < 0) throw new Error(`no rule for ${selector}`);
  return css.slice(i, css.indexOf("}", i));
};

/** docs/research/long-title-policy-2026-09.md — a 23-character unbreakable
 *  token inflated the selected-place card to 441.8px inside a 358px slot and
 *  pushed the 44px close button to x=413.8, past the 390px viewport, where
 *  overflow-x:hidden clipped it: the button was unreachable, not merely
 *  misaligned. 112 of 878 published places carry a token that long or longer
 *  (worst: 35 characters). */
describe("long name overflow contracts", () => {
  it("lets the selected-place card shrink below its content's min-content width", () => {
    // A row-flex item defaults to min-width:auto, which resolves to
    // min-content — so the nowrap title's full width became the card's floor.
    expect(ruleBody(".selected-place-summary")).toMatch(/min-width:\s*0/);
  });

  it("wraps the place name and clamps it where the clamp can actually fire", () => {
    // On the h2 the clamp is inert: it is a flex item, so display:-webkit-box
    // blockifies to flow-root. The span is not a flex item.
    const scoped = css.slice(css.indexOf(".selected-place-summary.half .place-name-primary"));
    const body = scoped.slice(0, scoped.indexOf("}"));
    expect(body).toMatch(/white-space:\s*normal/);
    expect(body).toMatch(/overflow-wrap:\s*anywhere/);
    expect(body).toMatch(/-webkit-line-clamp:\s*2/);
  });

  it("uses overflow-wrap:anywhere rather than break-word, which cannot lower min-content", () => {
    const scoped = css.slice(css.indexOf(".selected-place-summary.half .place-name-primary"));
    expect(scoped.slice(0, scoped.indexOf("}"))).not.toMatch(/overflow-wrap:\s*break-word/);
  });

  it("keeps the compact card on one line, where a wrapped clamp collapses it", () => {
    // The unscoped version of this fix turned the peek card into "Daiso …".
    const base = ruleBody(".place-name-primary");
    expect(base).toMatch(/white-space:\s*nowrap/);
  });

  it("gives the map sheet's selected-place wrapper an explicit column direction", () => {
    expect(ruleBody(".mapsheet.half.has-selection .mapsheet-view-enter")).toMatch(/flex-direction:\s*column/);
  });

  it("stops the place-detail h1 flooring its grid track", () => {
    expect(ruleBody(".place-detail-name-stack > h1")).toMatch(/min-width:\s*0/);
  });

  it("stops search result names painting over the trailing tap target", () => {
    const src = read("app/search/page.tsx");
    const clamps = src.match(/WebkitLineClamp:\s*2/g) ?? [];
    expect(clamps.length).toBeGreaterThanOrEqual(2);
    expect(src).toMatch(/overflowWrap:\s*"anywhere"/);
  });

  it("never lets a settings row title paint outside its box onto the value beside it", () => {
    // At 320px the box is narrower than the word "preferences", and with
    // overflow visible the word painted over the value and chevron. Breaking
    // as a last resort is the documented policy for a squeezed label.
    expect(ruleBody(".settings-row-title")).toMatch(/overflow-wrap:\s*anywhere/);
  });
});
