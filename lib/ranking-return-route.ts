export const RANKING_RETURN_ROUTE_KEY = "myseouldrop.ranking.returnRoute";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type LocationLike = Readonly<{
  origin: string;
  pathname: string;
  search: string;
  hash: string;
}>;

export type RankingHistoryContext = Readonly<{
  origin: string;
  historyLength: number;
  referrer: string;
  navigationCurrentIndex?: number;
  navigationEntries?: readonly { index: number; url?: string | null }[];
}>;

export type RankingBackAction =
  | Readonly<{ kind: "back" }>
  | Readonly<{ kind: "replace"; href: string }>;

export function shouldUseRankingBrowserBack({
  origin,
  historyLength,
  referrer,
  navigationCurrentIndex,
  navigationEntries,
}: RankingHistoryContext): boolean {
  if (navigationCurrentIndex !== undefined && navigationEntries) {
    if (navigationCurrentIndex === 0) return false;
    const previousEntry = navigationEntries.find(
      (entry) => entry.index === navigationCurrentIndex - 1,
    );
    return Boolean(
      previousEntry?.url && sanitizeRankingReturnRoute(previousEntry.url, origin),
    );
  }

  if (historyLength <= 1) return false;
  if (referrer) return Boolean(sanitizeRankingReturnRoute(referrer, origin));
  return false;
}

/**
 * Convert trusted same-origin evidence to a relative path before navigation.
 * Ranking routes are intentionally rejected so retailer replace operations can
 * never become the destination of the Back control.
 */
export function sanitizeRankingReturnRoute(
  candidate: string,
  origin: string,
): string | null {
  try {
    const url = new URL(candidate, origin);
    if (url.origin !== origin) return null;
    if (url.pathname === "/ranking" || url.pathname.startsWith("/ranking/")) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function rememberRankingReturnRoute(
  storage: StorageLike,
  location: LocationLike,
): void {
  const route = sanitizeRankingReturnRoute(
    `${location.pathname}${location.search}${location.hash}`,
    location.origin,
  );
  try {
    if (route) storage.setItem(RANKING_RETURN_ROUTE_KEY, route);
    else storage.removeItem(RANKING_RETURN_ROUTE_KEY);
  } catch {
    // Safari private-mode/storage failures must not block navigation.
  }
}

export function consumeRankingReturnRoute(
  storage: StorageLike,
  origin: string,
): string | null {
  try {
    const candidate = storage.getItem(RANKING_RETURN_ROUTE_KEY);
    storage.removeItem(RANKING_RETURN_ROUTE_KEY);
    return candidate ? sanitizeRankingReturnRoute(candidate, origin) : null;
  } catch {
    return null;
  }
}

export function chooseRankingBackAction(
  browserBackSafe: boolean,
  storedReturnRoute: string | null,
  fallback: string,
): RankingBackAction {
  if (browserBackSafe) return { kind: "back" };
  return { kind: "replace", href: storedReturnRoute ?? fallback };
}
