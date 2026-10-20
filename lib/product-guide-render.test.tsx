import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { describe, expect, it, vi } from "vitest";
import { RankingPageClient } from "@/components/ranking/ranking-page-client";
import { PRODUCTS } from "./data";
import { routes } from "./routes";

vi.mock("next/navigation", () => ({ useRouter: () => ({ back() {}, push() {} }), usePathname: () => "/ranking" }));

describe("curated product guide", () => {
  it("labels Olive Young as a product guide with Products and Brands tabs", () => {
    const $ = load(renderToStaticMarkup(<RankingPageClient initialRetailer="olive_young" />));
    expect($("h1").attr("aria-label")).toBe("OLIVE YOUNG Product Guide");
    expect($("h1 small").text()).toBe("Product guide");
    expect($("[role=tab]").map((_, el) => $(el).text()).get()).toEqual(["Products", "Brands"]);
    expect($.text()).toContain("Curated product examples");
    expect($.text()).not.toMatch(/Sales|Review Best|Trending|Highest-rated|Also popular/i);
    const rows = $('[data-testid="olive-young-ranking-row"]');
    expect(rows.children("span.num").length).toBe(0);
    expect(rows.map((_, el) => $(el).attr("href")).get()).toEqual(PRODUCTS.slice(0, 10).map(p => routes.shopItem(p.id)));
  });

  it("preserves sourced Daiso ordinal ranks", () => {
    const $ = load(renderToStaticMarkup(<RankingPageClient initialRetailer="daiso" />));
    expect($("h1").attr("aria-label")).toBe("DAISO Ranking");
    expect($("h1 small").text()).toBe("Rankings");
    expect($('[data-testid="daiso-ranking-row"]').first().attr("data-source-rank")).toBe("1");
  });
});
