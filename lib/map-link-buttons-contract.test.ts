import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../components/directions/map-link-buttons.tsx", import.meta.url), "utf8");

describe("MapLinkButtons", () => {
  it("opens the installed Naver Map app on mobile and keeps a web fallback on desktop", () => {
    expect(source).toContain('"use client"');
    expect(source).toContain("naverAndroidIntentUrl");
    expect(source).toContain("naverAppRouteUrl");
    expect(source).toContain("naverRouteUrl");
    expect(source).toContain("NAVER_MAP_IOS_APP_STORE_URL");
    expect(source).toContain("newTab={platform === null}");
  });
});
