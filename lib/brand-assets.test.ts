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
});
