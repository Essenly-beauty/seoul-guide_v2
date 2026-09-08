import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { shouldUseRankingBrowserBack } from "@/lib/ranking-return-route";

const source = (path: string) => {
  const url = new URL(`../${path}`, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
};

const routeSource = source("app/ranking/page.tsx");
const clientSource = source("components/ranking/ranking-page-client.tsx");
const footerSource = source("components/ranking/ranking-footer.tsx");
const bottomNavSource = source("components/ui/bottom-nav.tsx");
const returnRouteSource = source("lib/ranking-return-route.ts");
const cssSource = source("app/globals.css");
const playwrightSource = source("playwright.config.ts");
const rankingE2eSource = source("e2e/ranking-retailers.spec.ts");
const qaRouteSource = source("app/ranking/qa/page.tsx");
const oliveYoungMarkSource = source("public/brands/olive-young-mark.svg");
const daisoMarkSource = source("public/brands/daiso-mark.svg");
const retailerLogoSources = source("docs/assets/retailer-logo-sources.md");

describe("ranking retailer server/client boundary", () => {
  it("validates and canonicalizes the retailer in the async server route", () => {
    expect(routeSource).not.toContain('"use client"');
    expect(routeSource).toContain("searchParams: Promise<{ retailer?: string | string[] }>");
    expect(routeSource).toContain("const params = await searchParams");
    expect(routeSource).toContain("parseRankingRetailer(params.retailer)");
    expect(routeSource).toContain("redirect(routes.rankingRetailer(\"olive_young\"))");
    expect(routeSource).toContain("<RankingPageClient initialRetailer={retailer} />");
    expect(routeSource).not.toContain("key={retailer}");
  });

  it("keeps URL search-param access out of the client component", () => {
    expect(clientSource).toContain('"use client"');
    expect(clientSource).not.toContain("useSearchParams");
    expect(clientSource).toContain("initialRetailer: RankingRetailer");
  });
});

describe("retailer-specific ranking presentation", () => {
  it("preserves the complete Olive Young ranking and brand flows", () => {
    expect(clientSource).toContain("const config = OLIVE_YOUNG_RANKING_CONFIG");
    expect(clientSource).toContain("config.tabs.map");
    expect(clientSource).toContain("config.categoriesForTab(tab).map");
    expect(clientSource).toContain("config.products");
    expect(clientSource).toContain("config.emptyMessage");
    expect(clientSource).toContain('<SectionHeader title="Trending now"');
    expect(clientSource).toContain('placeholder="Search brands"');
    expect(clientSource).toContain("href={routes.shopItem(p.id)}");
    expect(clientSource).not.toMatch(/import\s*\{[^}]*\bPRODUCTS\b[^}]*\}\s*from\s*["']@\/lib\/data["']/s);
    expect(clientSource).not.toContain("SHOP_CATEGORIES");
  });

  it("renders the real Daiso data with source ranks and internal detail links", () => {
    expect(clientSource).toContain("createDaisoRankingConfig(daisoProducts)");
    expect(clientSource).toContain("config.tabs.map");
    expect(clientSource).toContain('useState<DaisoRankKey>("daily")');
    expect(clientSource).toContain("config.categoriesForTab(nextTab)");
    expect(clientSource).toContain("selectDaisoRankingFromProducts(config.products");
    expect(clientSource).not.toContain("categoriesForDaisoRank");
    expect(clientSource).toContain("{row.rank}");
    expect(clientSource).toContain("<ImgPh className=\"thumb56\" />");
    expect(clientSource).toContain("{product.nameKr}");
    expect(clientSource).toContain("{product.subcategoryKr}");
    expect(clientSource).not.toContain("WON.format(product.priceWon)");
    expect(clientSource).not.toContain("product.rating !== null");
    expect(clientSource).not.toContain("product.reviewCountText");
    expect(clientSource).toContain("product.delivery");
    expect(clientSource).toContain("href={routes.daisoProduct(product.productNo)}");
    expect(clientSource).not.toContain('target="_blank"');
    expect(clientSource).not.toContain('rel="noopener noreferrer"');
    expect(clientSource).not.toContain('Source {collectedAt}');
    expect(clientSource).not.toContain('delivery.parcel ? "Parcel"');
    expect(clientSource).not.toContain("★");
    expect(clientSource).toContain('className="daiso-ranking-tags"');
  });

  it("treats an explicitly empty Daiso dataset as unavailable without fallback", () => {
    expect(clientSource).toContain("daisoProducts = DAISO_RANKING_CONFIG.products");
    expect(clientSource).toContain("config.products.length === 0");
    expect(clientSource).toContain("{config.emptyMessage}");
    expect(clientSource).not.toContain("Daiso ranking data is currently unavailable.");
    expect(clientSource).toContain("Clear filters");
    expect(clientSource).toMatch(
      /const clearFilters = \(\) => \{\s*setDaisoCategory\("all"\);\s*\};/,
    );
    expect(clientSource).not.toMatch(
      /const clearFilters = \(\) => \{[\s\S]*?setDaisoTab\(/,
    );
    expect(clientSource).not.toMatch(/daisoProducts\.length\s*\?[^:]+:\s*(?:PRODUCTS|OLIVE_YOUNG_RANKING_CONFIG\.products)/);
  });

  it("gives only the Daiso category filters a compact inner pill treatment", () => {
    expect(clientSource).toContain('className="chiprow daiso-category-row"');
    expect(clientSource).toContain('className="daiso-category-chip"');
    expect(clientSource).toContain('className="daiso-category-chip-visual"');
    expect(clientSource).toContain('<div className="chiprow" role="tablist" aria-label="Daiso ranking type">');
    expect(clientSource).not.toMatch(/className="daiso-category-chip"\s+soft/);
    expect(cssSource).toMatch(/\.chip\.daiso-category-chip\s*\{[\s\S]*?min-height:\s*44px;[\s\S]*?padding:\s*4px\s+0;/);
    expect(cssSource).toMatch(/\.daiso-category-chip-visual\s*\{[\s\S]*?min-height:\s*36px;[\s\S]*?padding:\s*0\s+12px;[\s\S]*?font-size:\s*12px;/);
    expect(cssSource).toContain(".chip.daiso-category-chip.selected .daiso-category-chip-visual");
    expect(cssSource).toContain("--daiso-category-text: #b83d00");
    expect(cssSource).toContain("--daiso-category-text: #ff8a5c");
    expect(cssSource).toContain("--daiso-category-focus-ring: #1c2431");
    expect(cssSource).toContain("--daiso-category-focus-ring: #f2f3f5");
    expect(cssSource).toContain("color: var(--daiso-category-text)");
    expect(cssSource).toContain(".chip.daiso-category-chip:focus-visible {\n    outline: none;");
    expect(cssSource).toContain(".chip.daiso-category-chip:focus-visible .daiso-category-chip-visual");
  });
});

describe("ranking-only retailer footer", () => {
  it("replaces the shared footer with exactly three ordered ranking controls", () => {
    expect(clientSource).toContain('import { RankingFooter } from "@/components/ranking/ranking-footer"');
    expect(clientSource).toContain("<RankingFooter retailer={initialRetailer} />");
    expect(clientSource).not.toContain("<BottomNav");

    const buttons = [...footerSource.matchAll(/<button\b[\s\S]*?<\/button>/g)].map(
      ([button]) => button,
    );
    expect(buttons).toHaveLength(3);
    expect(buttons[0]).toContain("Back");
    expect(buttons[1]).toContain("Olive Young");
    expect(buttons[2]).toContain("Daiso");
    expect(footerSource).toContain('aria-label="Ranking retailer"');
    expect(buttons[1]).toContain('src="/brands/olive-young-mark.svg"');
    expect(buttons[2]).toContain('src="/brands/daiso-mark.svg"');
    expect(buttons[1]).toContain('alt=""');
    expect(buttons[2]).toContain('alt=""');
    expect(buttons[1]).toContain('aria-hidden="true"');
    expect(buttons[2]).toContain('aria-hidden="true"');
    expect(footerSource).not.toContain("Selected");
    expect(footerSource).not.toContain("✓");
    expect(footerSource).not.toContain("ranking-footer-selection");
      });

  it("keeps original local navigation marks and documents their non-official provenance", () => {
    expect(oliveYoungMarkSource).toContain('stroke="#9bce26"');
    expect(daisoMarkSource).toContain('stroke="#d70011"');
    expect(retailerLogoSources).toContain("original, non-official in-app navigation marks");
    expect(retailerLogoSources).toContain("not retailer logos");
    expect(retailerLogoSources).toContain("does not trace or reproduce Daiso's official six-dot BI artwork");
    expect(retailerLogoSources).toContain("https://www.oliveyoung.co.kr");
    expect(retailerLogoSources).toContain("#9bce26");
    expect(retailerLogoSources).toContain("https://www.daiso.co.kr");
  });

  it("replaces retailer URLs and uses proven browser/app history with a map fallback", () => {
    expect(footerSource).toContain("useRouter");
    expect(footerSource).toMatch(/router\.replace\(routes\.rankingRetailer\(\w+\)\)/);
    expect(footerSource).not.toContain("router.push(routes.rankingRetailer");
    expect(footerSource).toContain("router.back()");
    expect(footerSource).toContain("useEffect");
    expect(footerSource).toContain("useRef");
    expect(footerSource).toContain("consumeRankingReturnRoute");
    expect(footerSource).toContain("returnRouteRef.current");
    expect(footerSource).toContain("chooseRankingBackAction");
    expect(footerSource).toContain("router.replace(action.href)");
    expect(footerSource).toContain("navigation.entries()");
    expect(footerSource).toContain("document.referrer");
    expect(footerSource).toContain("window.history.length");
    expect(returnRouteSource).toContain("previousEntry?.url");
    expect(returnRouteSource).toContain("sanitizeRankingReturnRoute");
  });

  it("uses Navigation API history only for a prior same-origin entry", () => {
    const base = {
      origin: "https://myseouldrop.example",
      historyLength: 4,
      referrer: "",
      navigationCurrentIndex: 3,
    };
    expect(shouldUseRankingBrowserBack({
      ...base,
      navigationEntries: [{ index: 2, url: "https://myseouldrop.example/map" }],
    })).toBe(true);
    expect(shouldUseRankingBrowserBack({
      ...base,
      navigationEntries: [{ index: 2, url: "https://myseouldrop.example/ranking?retailer=daiso" }],
    })).toBe(false);
    expect(shouldUseRankingBrowserBack({
      ...base,
      navigationEntries: [{ index: 2, url: null }],
    })).toBe(false);
    expect(shouldUseRankingBrowserBack({
      ...base,
      navigationCurrentIndex: 0,
      navigationEntries: [{ index: 0, url: "https://myseouldrop.example/ranking" }],
    })).toBe(false);
  });

  it("falls back safely when the Navigation API is unavailable", () => {
    const origin = "https://myseouldrop.example";
    expect(shouldUseRankingBrowserBack({ origin, historyLength: 1, referrer: "" })).toBe(false);
    expect(shouldUseRankingBrowserBack({
      origin,
      historyLength: 2,
      referrer: "https://myseouldrop.example/map",
    })).toBe(true);
    expect(shouldUseRankingBrowserBack({
      origin,
      historyLength: 2,
      referrer: "https://search.example/results",
    })).toBe(false);
    expect(shouldUseRankingBrowserBack({ origin, historyLength: 2, referrer: "" })).toBe(false);
  });

  it("keeps the shared five-item BottomNav independent and unchanged in purpose", () => {
    expect(bottomNavSource).toContain('aria-label="Main"');
    expect(bottomNavSource).toContain('{ key: "map", label: "Map"');
    expect(bottomNavSource).toContain('{ key: "blog", label: "Stories"');
    expect(bottomNavSource).toContain('{ key: "ranking", label: "Ranking"');
    expect(bottomNavSource).toContain('{ key: "saved", label: "Saved"');
    expect(bottomNavSource).toContain('{ key: "menu", label: "My"');
    expect(bottomNavSource).not.toContain("RankingFooter");
    expect(bottomNavSource).not.toContain("Olive Young");
    expect(bottomNavSource).not.toContain("Daiso");
    expect(bottomNavSource).toContain("rememberRankingReturnRoute");
  });

  it("inherits the flex footer safe area and distinguishes retailer state without selection copy", () => {
    expect(cssSource).toMatch(/\.bottomnav\s*\{[\s\S]*?flex:\s*none;[\s\S]*?env\(safe-area-inset-bottom\)/);
    expect(cssSource).toMatch(/\.bottomnav\s+\.nav\s*\{[\s\S]*?min-height:\s*48px;/);
    expect(cssSource).toMatch(/\.ranking-footer\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(cssSource).toContain("--ranking-retailer-active");
    expect(cssSource).toMatch(/\.ranking-footer-retailer\s*\{[^}]*color:\s*var\(--dim\)/);
    expect(cssSource).toMatch(/\.ranking-footer-mark\s*\{[^}]*filter:\s*grayscale\(1\)/);
    expect(cssSource).toMatch(/\.ranking-footer-olive-young\s*\{[^}]*--ranking-retailer-active:\s*#526c13/);
    expect(cssSource).toMatch(/\.ranking-footer-daiso\s*\{[^}]*--ranking-retailer-active:\s*#d70011/);
    expect(cssSource).toMatch(/\[data-theme="dark"\]\s+\.ranking-footer-olive-young,[\s\S]*?--ranking-retailer-active:\s*#9bce26/);
    expect(cssSource).toMatch(/\[data-theme="dark"\]\s+\.ranking-footer-daiso,[\s\S]*?--ranking-retailer-active:\s*#ff5d64/);
    expect(cssSource).toMatch(/\.ranking-footer-retailer\[aria-pressed="true"\]\s*\{[^}]*color:\s*var\(--ranking-retailer-active\)/);
    expect(cssSource).toMatch(/\.ranking-footer-retailer\[aria-pressed="true"\]\s+\.ranking-footer-mark\s*\{[^}]*filter:\s*grayscale\(0\)/);
    expect(cssSource).not.toMatch(/\.ranking-footer\s*\{[^}]*position:\s*fixed/);
  });

  it("uses a strict dedicated local QA server and keeps its fixture route guarded", () => {
    expect(playwrightSource).toContain('http://127.0.0.1:3001');
    expect(playwrightSource).toContain("reuseExistingServer: false");
    expect(playwrightSource).toContain('RANKING_E2E_HARNESS: "1"');
    expect(playwrightSource).toContain('process.env.E2E_WEBKIT === "1"');
    expect(playwrightSource).toContain('name: "webkit-ranking"');
    expect(playwrightSource).toContain('browserName: "webkit"');
    expect(qaRouteSource).toContain('process.env.RANKING_E2E_HARNESS !== "1"');
    expect(qaRouteSource).toContain("notFound()");
    expect(rankingE2eSource).not.toContain("fixtureResponse?.status() === 404");
    expect(rankingE2eSource).toContain('process.env.E2E_EXTERNAL_ONLY === "1"');
  });
});
