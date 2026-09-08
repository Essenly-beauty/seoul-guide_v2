import { describe, expect, expectTypeOf, it } from "vitest";

import { PRODUCTS, SHOP_CATEGORIES, type Product } from "./data";
import type { DaisoRankingProduct } from "./daiso-ranking";
import { DAISO_RANKING_DATA } from "./generated/daiso-ranking-products";
import {
  DAISO_RANKING_CONFIG,
  OLIVE_YOUNG_RANKING_CONFIG,
  createDaisoRankingConfig,
  getRankingConfig,
  parseRankingRetailer,
  type DaisoRankingConfig,
  type OliveYoungRankingConfig,
  type RankingConfig,
  type RankingItem,
  type RankingRetailer,
} from "./ranking";
import { routes } from "./routes";

describe("ranking retailer URL contract", () => {
  it.each<[string | string[] | undefined, RankingRetailer]>([
    [undefined, "olive_young"],
    ["olive_young", "olive_young"],
    ["daiso", "daiso"],
    [["daiso"], "olive_young"],
    [[], "olive_young"],
    ["", "olive_young"],
    ["Daiso", "olive_young"],
    ["unknown", "olive_young"],
    ["<script>", "olive_young"],
  ])("normalizes %j to %s", (input, expected) => {
    expect(parseRankingRetailer(input)).toBe(expected);
  });

  it("builds canonical encoded retailer routes", () => {
    expect(routes.rankingRetailer("olive_young")).toBe("/ranking?retailer=olive_young");
    expect(routes.rankingRetailer("daiso")).toBe("/ranking?retailer=daiso");
  });
});

describe("retailer-specific ranking configuration", () => {
  it("keeps the complete existing product catalogue in Olive Young regardless of channel", () => {
    const config = getRankingConfig("olive_young");

    expect(config).toBe(OLIVE_YOUNG_RANKING_CONFIG);
    expect(config.products).toBe(PRODUCTS);
    expect(config.products).toHaveLength(PRODUCTS.length);
    expect(config.products.some((product) => product.channel === "korea_exclusive")).toBe(true);
    expect(config.tabs).toEqual(["sales", "review", "brands"]);
  });

  it("keeps only generated Daiso products and Daiso tabs in the Daiso config", () => {
    const config = getRankingConfig("daiso");

    expect(config).toBe(DAISO_RANKING_CONFIG);
    expect(config.products).toBe(DAISO_RANKING_DATA.products);
    expect(config.products).toHaveLength(38);
    expect(config.products.every((product) => product.retailer === "daiso")).toBe(true);
    expect(config.tabs).toEqual(["rising", "daily", "weekly"]);
  });

  it("does not fall back to generated categories for an empty Daiso config", () => {
    const config = createDaisoRankingConfig([]);

    expect(config.products).toEqual([]);
    expect(config.categoriesForTab("rising")).toEqual([{ key: "all", label: "All" }]);
    expect(config.categoriesForTab("daily")).toEqual([{ key: "all", label: "All" }]);
    expect(config.categoriesForTab("weekly")).toEqual([{ key: "all", label: "All" }]);
  });

  it("derives categories from only the exact custom Daiso product array", () => {
    const dailyProduct: DaisoRankingProduct = {
      retailer: "daiso",
      id: "daiso:test-product",
      productNo: "test-product",
      nameKr: "테스트 상품",
      brand: "테스트 브랜드",
      categoryKr: "스킨케어",
      subcategoryKr: "기초",
      priceWon: 1000,
      rating: null,
      reviewCountText: null,
      productUrl: "https://www.daisomall.co.kr/pd/pdr/SCR_PDR_0001?pdNo=test-product",
      collectedAt: "2026-08-31",
      ranks: { daily: 1 },
      delivery: { parcel: false, pickup: false, sameDay: false },
    };
    const products = [dailyProduct] as const;
    const config = createDaisoRankingConfig(products);

    expect(config.products).toBe(products);
    expect(config.categoriesForTab("daily")).toEqual([
      { key: "all", label: "All" },
      { key: dailyProduct.categoryKr, label: "Skincare" },
    ]);
    expect(config.categoriesForTab("rising")).toEqual([{ key: "all", label: "All" }]);
    expect(config.categoriesForTab("weekly")).toEqual([{ key: "all", label: "All" }]);
  });

  it("supplies categories from only the selected retailer and tab", () => {
    expect(OLIVE_YOUNG_RANKING_CONFIG.categoriesForTab("sales")).toBe(SHOP_CATEGORIES);
    expect(OLIVE_YOUNG_RANKING_CONFIG.categoriesForTab("review")).toBe(SHOP_CATEGORIES);
    expect(OLIVE_YOUNG_RANKING_CONFIG.categoriesForTab("brands")).toEqual([]);

    const dailyCategories = DAISO_RANKING_CONFIG.categoriesForTab("daily");
    expect(dailyCategories[0]).toEqual({ key: "all", label: "All" });
    expect(dailyCategories.length).toBeGreaterThan(1);
    expect(dailyCategories.every(({ key }) =>
      key === "all" || DAISO_RANKING_CONFIG.products.some((product) =>
        product.categoryKr === key && product.ranks.daily !== undefined && product.ranks.daily <= 20,
      ),
    )).toBe(true);
    expect(dailyCategories.some(({ key }) =>
      SHOP_CATEGORIES.some((category) => category.key === key && key !== "all"),
    )).toBe(false);
  });

  it("keeps retailer-specific empty copy and source-date behavior separate", () => {
    expect(OLIVE_YOUNG_RANKING_CONFIG.emptyMessage).toBe("No products in this category yet.");
    expect("collectedAt" in OLIVE_YOUNG_RANKING_CONFIG).toBe(false);

    expect(DAISO_RANKING_CONFIG.emptyMessage).toBe("Daiso ranking data is currently unavailable.");
    expect(DAISO_RANKING_CONFIG.collectedAt).toBe("2026-08-31");
    expect(DAISO_RANKING_CONFIG.products.every(
      (product) => product.collectedAt === DAISO_RANKING_CONFIG.collectedAt,
    )).toBe(true);
  });

  it("exposes a discriminated config and item boundary", () => {
    const configs: RankingConfig[] = [
      OLIVE_YOUNG_RANKING_CONFIG,
      DAISO_RANKING_CONFIG,
    ];
    const items: RankingItem[] = [
      { retailer: "olive_young", product: PRODUCTS[0] },
      { retailer: "daiso", product: DAISO_RANKING_DATA.products[0], sourceRank: 1 },
    ];

    expect(configs.map((config) => config.retailer)).toEqual(["olive_young", "daiso"]);
    expect(items.map((item) => item.retailer)).toEqual(["olive_young", "daiso"]);
    expectTypeOf(OLIVE_YOUNG_RANKING_CONFIG).toMatchTypeOf<OliveYoungRankingConfig>();
    expectTypeOf(DAISO_RANKING_CONFIG).toMatchTypeOf<DaisoRankingConfig>();
    expectTypeOf(items).toEqualTypeOf<RankingItem[]>();
    expectTypeOf(items[0].product).toMatchTypeOf<Product | DaisoRankingConfig["products"][number]>();

    for (const item of items) {
      if (item.retailer === "olive_young") {
        expectTypeOf(item.product).toEqualTypeOf<Product>();
        expect(item.product.channel).toBeDefined();
      } else {
        expectTypeOf(item.product).toEqualTypeOf<DaisoRankingProduct>();
        expect(item.product.retailer).toBe("daiso");
        expect(item.sourceRank).toBe(1);
      }
    }

    if (false) {
      // @ts-expect-error Daiso products cannot be associated with Olive Young items.
      const invalidOliveYoungItem: RankingItem = {
        retailer: "olive_young",
        product: DAISO_RANKING_DATA.products[0],
      };
      // @ts-expect-error Olive Young products cannot be associated with Daiso items.
      const invalidDaisoItem: RankingItem = {
        retailer: "daiso",
        product: PRODUCTS[0],
        sourceRank: 1,
      };
      // @ts-expect-error A Daiso config cannot be built from Olive Young products.
      createDaisoRankingConfig(PRODUCTS);
      void invalidOliveYoungItem;
      void invalidDaisoItem;
    }
  });
});
