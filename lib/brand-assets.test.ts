import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("brand asset contract", () => {
  it("uses the supplied Seoul mark everywhere the web app exposes an app icon", () => {
    expect(source("components/brand/brand-logo.tsx")).toContain('src="/icon.svg"');
    expect(source("app/icon.svg")).toContain("M203.5 78.3301H147.27");
    expect(source("app/icon.svg")).toContain('fill="#FF5018"');
    expect(source("public/manifest.json")).toContain('"src": "/icon.svg"');
    expect(source("app/opengraph-image.tsx")).toContain("M203.5 78.3301H147.27");
    expect(existsSync(new URL("../app/apple-icon.tsx", import.meta.url))).toBe(true);
    expect(source("app/apple-icon.tsx")).toContain("M203.5 78.3301H147.27");
  });

  it("keeps the supplied SVG for app identity without repeating it in quiet page headers", () => {
    const ranking = source("app/ranking/page.tsx");
    expect(ranking).not.toContain("BrandMark");
    expect(ranking).toContain('<TopBar center title="Ranking" />');
    expect(ranking).not.toContain('BrandMark, Icon } from "@/components/icon"');
    expect(source("components/icon.tsx")).not.toContain("i-mark-brand");
  });

  it("uses a reusable brand icon in the ranking brand directory", () => {
    const ranking = source("app/ranking/page.tsx");
    const brandIcon = source("components/brand/brand-icon.tsx");

    expect(ranking).toContain('import { BrandIcon } from "@/components/brand/brand-icon"');
    expect(ranking).toContain("<BrandIcon brand={brand}");
    expect(brandIcon).toContain("BRAND_MONOGRAMS");
    expect(brandIcon).toContain("aria-label={`${brand} brand`}");
  });
});
