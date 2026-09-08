import { notFound } from "next/navigation";
import { RankingPageClient } from "@/components/ranking/ranking-page-client";

export const dynamic = "force-dynamic";

type RankingQaFixture = "empty" | "no-results";

function parseFixture(value: string | string[] | undefined): RankingQaFixture | null {
  return value === "empty" || value === "no-results" ? value : null;
}

/**
 * Browser-test support for otherwise unreachable defensive UI states.
 * The route is deliberately unavailable unless the Playwright-managed server
 * opts in with a server-only environment variable.
 */
export default async function RankingQaPage({
  searchParams,
}: {
  searchParams: Promise<{ fixture?: string | string[] }>;
}) {
  if (process.env.RANKING_E2E_HARNESS !== "1") notFound();

  const fixture = parseFixture((await searchParams).fixture);
  if (fixture === null) notFound();

  return (
    <RankingPageClient
      initialRetailer="daiso"
      daisoProducts={fixture === "empty" ? [] : undefined}
      initialDaisoCategory={fixture === "no-results" ? "unavailable-test-category" : "all"}
    />
  );
}
