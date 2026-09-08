import { DAISO_RANKING_DATA } from "@/lib/generated/daiso-ranking-products";
import type { DaisoRankingProduct } from "@/lib/daiso-ranking";

const DAISO_ROUTE_ID = /^daiso:([1-9]\d*)$/;

export function parseDaisoProductRouteId(routeId: string): string | null {
  return DAISO_ROUTE_ID.exec(routeId)?.[1] ?? null;
}

export function getDaisoProduct(productNo: string): DaisoRankingProduct | null {
  if (!/^[1-9]\d*$/.test(productNo)) return null;
  return DAISO_RANKING_DATA.products.find(
    (product) => product.productNo === productNo,
  ) as DaisoRankingProduct | undefined ?? null;
}
