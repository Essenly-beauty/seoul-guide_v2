import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/** Fonts are self-hosted through next/font (downloaded at build time, served
 *  from /_next/static, size-adjusted fallbacks): no render-blocking CSS
 *  @import, no per-visitor request to Google, no layout shift on swap
 *  (Next.js Font docs; web.dev font best practices). */
describe("font delivery", () => {
  it("globals.css no longer @imports Google Fonts", () => {
    expect(read("app/globals.css")).not.toMatch(/@import url\("https:\/\/fonts\.googleapis/);
  });

  it("the family tokens resolve through next/font CSS variables in both theme blocks", () => {
    const css = read("app/globals.css");
    for (const [token, variable] of [["--serif", "--font-serif"], ["--sans", "--font-sans"], ["--mono", "--font-mono"], ["--brand-display", "--font-display"]]) {
      const matches = css.match(new RegExp(`${token}:\\s*var\\(${variable}\\)`, "g")) ?? [];
      expect(matches.length, `${token} → var(${variable})`).toBeGreaterThanOrEqual(2);
    }
  });

  it("app/fonts.ts declares the four families with those variables and the root layout applies them", () => {
    const fonts = read("app/fonts.ts");
    for (const v of ["--font-serif", "--font-sans", "--font-mono", "--font-display"]) expect(fonts).toContain(`variable: "${v}"`);
    expect(fonts).toMatch(/from "next\/font\/google"/);
    expect(read("app/layout.tsx")).toMatch(/<html[^>]*className=\{fontVariables\}/);
  });

  it("the CSP no longer needs Google Fonts origins", () => {
    const cfg = read("next.config.mjs");
    expect(cfg).not.toContain("fonts.googleapis.com");
    expect(cfg).not.toContain("fonts.gstatic.com");
  });
});
