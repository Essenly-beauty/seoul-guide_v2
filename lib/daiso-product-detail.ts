import { DAISO_RANKING_DATA } from "@/lib/generated/daiso-ranking-products";
import type { DaisoRankingProduct } from "@/lib/daiso-ranking";

const DAISO_ROUTE_ID = /^daiso:([1-9]\d*)$/;

// The App Router hands dynamic params to pages percent-encoded (Next 15.5
// getDynamicParam), so /shop/daiso%3A123 and /shop/daiso:123 both arrive as
// "daiso%3A123". Decode once, as lib/data.ts decodedFind does, then match.
export function parseDaisoProductRouteId(routeId: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(routeId);
  } catch {
    return null;
  }
  return DAISO_ROUTE_ID.exec(decoded)?.[1] ?? null;
}

export function getDaisoProduct(productNo: string): DaisoRankingProduct | null {
  if (!/^[1-9]\d*$/.test(productNo)) return null;
  return DAISO_RANKING_DATA.products.find(
    (product) => product.productNo === productNo,
  ) as DaisoRankingProduct | undefined ?? null;
}
