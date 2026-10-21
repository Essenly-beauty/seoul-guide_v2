import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

describe("track-1: the route ticket never grows past the sheet", () => {
  it("long endpoint names cannot size the summary column", () => {
    expect(css).toMatch(/\.subway-route-summary\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(css).toMatch(/\.subway-ticket-ends\s*\{[^}]*min-width:\s*0/);
  });
});

describe("lightbox-1: a full-screen photo is fitted, never cut off", () => {
  it("each figure is one definite cell the image's max-height resolves against", () => {
    const rule = css.match(/\.photo-lightbox-track > figure\s*\{[^}]*\}/)?.[0] ?? "";
    expect(rule).toMatch(/grid-template:\s*100%\s*\/\s*100%/);
    expect(rule).toMatch(/min-height:\s*0/);
    expect(css).toMatch(/\.photo-lightbox-track img\s*\{[^}]*max-height:\s*100%[^}]*object-fit:\s*contain/);
  });
});
