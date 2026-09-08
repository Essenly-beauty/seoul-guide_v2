import { PRODUCTS, SHOP_CATEGORIES, type Product, type ProductCategory } from "./data";
import {
  categoriesForDaisoRank,
  type DaisoRankKey,
  type DaisoRankingProduct,
} from "./daiso-ranking";
import { DAISO_RANKING_DATA } from "./generated/daiso-ranking-products";

export type RankingRetailer = "olive_young" | "daiso";
export type OliveYoungRankTab = "sales" | "review" | "brands";

export type RankingItem =
  | Readonly<{ retailer: "olive_young"; product: Product }>
  | Readonly<{ retailer: "daiso"; product: DaisoRankingProduct; sourceRank: number }>;

export type RankingCategoryOption<Key extends string = string> = Readonly<{
  key: Key;
  label: string;
}>;

export type OliveYoungRankingConfig = Readonly<{
  retailer: "olive_young";
  tabs: readonly ["sales", "review", "brands"];
  products: readonly Product[];
  categoriesForTab: (
    tab: OliveYoungRankTab,
  ) => readonly RankingCategoryOption<"all" | ProductCategory>[];
  emptyMessage: string;
}>;

export type DaisoRankingConfig = Readonly<{
  retailer: "daiso";
  tabs: readonly ["rising", "daily", "weekly"];
  products: readonly DaisoRankingProduct[];
  categoriesForTab: (tab: DaisoRankKey) => readonly RankingCategoryOption[];
  collectedAt: "2026-08-31";
  emptyMessage: string;
}>;

export type RankingConfig = OliveYoungRankingConfig | DaisoRankingConfig;

export function parseRankingRetailer(
  value: string | string[] | undefined,
): RankingRetailer {
  return value === "daiso" ? "daiso" : "olive_young";
}

export const OLIVE_YOUNG_RANKING_CONFIG: OliveYoungRankingConfig = {
  retailer: "olive_young",
  tabs: ["sales", "review", "brands"],
  products: PRODUCTS,
  categoriesForTab: (tab) => tab === "brands" ? [] : SHOP_CATEGORIES,
  emptyMessage: "No products in this category yet.",
};

export function createDaisoRankingConfig(
  products: readonly DaisoRankingProduct[],
): DaisoRankingConfig {
  return {
    retailer: "daiso",
    tabs: ["rising", "daily", "weekly"],
    products,
    categoriesForTab: (tab) => categoriesForDaisoRank(tab, products),
    collectedAt: DAISO_RANKING_DATA.source.collectedAt,
    emptyMessage: "Daiso ranking data is currently unavailable.",
  };
}

export const DAISO_RANKING_CONFIG = createDaisoRankingConfig(
  DAISO_RANKING_DATA.products,
);

export function getRankingConfig(retailer: "olive_young"): OliveYoungRankingConfig;
export function getRankingConfig(retailer: "daiso"): DaisoRankingConfig;
export function getRankingConfig(retailer: RankingRetailer): RankingConfig;
export function getRankingConfig(retailer: RankingRetailer): RankingConfig {
  return retailer === "daiso" ? DAISO_RANKING_CONFIG : OLIVE_YOUNG_RANKING_CONFIG;
}
