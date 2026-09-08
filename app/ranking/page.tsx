import { redirect } from "next/navigation";
import { RankingPageClient } from "@/components/ranking/ranking-page-client";
import { parseRankingRetailer } from "@/lib/ranking";
import { routes } from "@/lib/routes";

export default async function RankingPage({
  searchParams,
}: {
  searchParams: Promise<{ retailer?: string | string[] }>;
}) {
  const params = await searchParams;
  const retailer = parseRankingRetailer(params.retailer);

  if (params.retailer !== undefined && params.retailer !== retailer) {
    redirect(routes.rankingRetailer("olive_young"));
  }

  return <RankingPageClient initialRetailer={retailer} />;
}
