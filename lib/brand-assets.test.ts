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
    const ranking = source("components/ranking/ranking-page-client.tsx");
    expect(ranking).not.toContain("BrandMark");
    expect(ranking).toContain(
      'const rankingTitle = initialRetailer === "daiso" ? "DAISO Ranking" : "OLIVE YOUNG Ranking"',
    );
    expect(ranking).toContain('<TopBar center title={rankingTitle} />');
    expect(ranking).not.toContain('<TopBar center title="Ranking" />');
    expect(ranking).not.toContain('BrandMark, Icon } from "@/components/icon"');
    expect(source("components/icon.tsx")).not.toContain("i-mark-brand");
  });

  it("uses a reusable brand icon in the ranking brand directory", () => {
    const ranking = source("components/ranking/ranking-page-client.tsx");
    const brandIcon = source("components/brand/brand-icon.tsx");

    expect(ranking).toContain('import { BrandIcon } from "@/components/brand/brand-icon"');
    expect(ranking).toContain("<BrandIcon brand={brand}");
    expect(brandIcon).toContain("BRAND_MONOGRAMS");
    expect(brandIcon).toContain("aria-label={`${brand} brand`}");
  });

  it("uses the owner's Olive Young logo for photo-less thumbnails and keeps a distinct brand hero", () => {
    const data = source("lib/data.ts");
    const heroSourcePath = new URL("../components/place/olive-young-brand-hero.tsx", import.meta.url);
    const hero = existsSync(heroSourcePath) ? source("components/place/olive-young-brand-hero.tsx") : "";
    const logoPath = new URL("../public/brands/olive-young-logo.jpeg", import.meta.url);
    const heroPath = new URL("../public/brands/olive-young-hero.avif", import.meta.url);

    expect(data).toContain('olive_young: "/brands/olive-young-logo.jpeg"');
    expect(existsSync(logoPath)).toBe(true);
    expect(readFileSync(logoPath).subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
    expect(existsSync(heroPath)).toBe(true);
    expect(readFileSync(heroPath).subarray(4, 12).toString()).toBe("ftypavif");
    expect(hero).toContain('src="/brands/olive-young-hero.avif"');
    expect(hero).toContain('alt="Olive Young brand image, not a photo of this store"');
    expect(hero).toContain("Brand image");
    expect(hero).toContain("onError");
  });
});
