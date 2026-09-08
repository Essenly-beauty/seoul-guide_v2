import { DAISO_RANKING_DATA } from "./generated/daiso-ranking-products";

export type DaisoRankKey = "rising" | "daily" | "weekly";

export type DaisoRankingProduct = Readonly<{
  retailer: "daiso";
  id: `daiso:${string}`;
  productNo: string;
  nameKr: string;
  brand: string;
  categoryKr: string;
  subcategoryKr: string;
  priceWon: number;
  rating: number | null;
  reviewCountText: string | null;
  productUrl: string;
  collectedAt: "2026-08-31";
  ranks: Readonly<{ rising?: number; daily?: number; weekly?: number }>;
  delivery: Readonly<{ parcel: boolean; pickup: boolean; sameDay: boolean }>;
}>;

export type DaisoRankingRow = Readonly<{
  product: DaisoRankingProduct;
  rank: number;
}>;

export function optionalDaisoDeliveryTags(
  delivery: DaisoRankingProduct["delivery"],
): string[] {
  return [
    delivery.pickup ? "Pickup" : null,
    delivery.sameDay ? "Same-day" : null,
  ].filter((label): label is string => label !== null);
}

export const DAISO_CATEGORY_LABELS = {
  스킨케어: "Skincare",
  마스크팩: "Masks",
  클렌징: "Cleansing",
  선케어: "Sun Care",
  메이크업: "Makeup",
  네일: "Nail",
  뷰티소품: "Beauty Tools",
  헤어케어: "Hair Care",
  바디케어: "Body Care",
  맨즈케어: "Men's Care",
  향수: "Fragrance",
  "뷰티/위생": "Beauty & Hygiene",
  위생용품: "Hygiene",
} as const;

const DAISO_RANKING_PRODUCTS: readonly DaisoRankingProduct[] = DAISO_RANKING_DATA.products;

export function selectDaisoRankingFromProducts(
  products: readonly DaisoRankingProduct[],
  rank: DaisoRankKey,
  categoryKr: string = "all",
): DaisoRankingRow[] {
  return products
    .flatMap((product) => {
      const sourceRank = product.ranks[rank];
      return sourceRank !== undefined && sourceRank >= 1 && sourceRank <= 20
        ? [{ product, rank: sourceRank }]
        : [];
    })
    .sort((left, right) => left.rank - right.rank)
    .filter(({ product }) => categoryKr === "all" || product.categoryKr === categoryKr);
}

export function selectDaisoRanking(
  rank: DaisoRankKey,
  categoryKr: string = "all",
): DaisoRankingRow[] {
  return selectDaisoRankingFromProducts(DAISO_RANKING_PRODUCTS, rank, categoryKr);
}

export function categoriesForDaisoRank(
  rank: DaisoRankKey,
  products: readonly DaisoRankingProduct[] = DAISO_RANKING_PRODUCTS,
): Array<{ key: string; label: string }> {
  const presentCategories = new Set(
    selectDaisoRankingFromProducts(products, rank, "all").map(({ product }) => product.categoryKr),
  );

  return [
    { key: "all", label: "All" },
    ...Object.entries(DAISO_CATEGORY_LABELS)
      .filter(([categoryKr]) => presentCategories.has(categoryKr))
      .map(([key, label]) => ({ key, label })),
  ];
}
