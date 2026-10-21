"use client";

import { T, useLocale } from "@/lib/i18n/locale-provider";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import type { RankingRetailer } from "@/lib/ranking";
import {
  chooseRankingBackAction,
  consumeRankingReturnRoute,
  shouldUseRankingBrowserBack,
} from "@/lib/ranking-return-route";
import { routes } from "@/lib/routes";

type NavigationEntryLike = {
  index: number;
  url?: string | null;
};

type NavigationLike = {
  currentEntry?: NavigationEntryLike | null;
  entries(): NavigationEntryLike[];
};

/**
 * Prefer the Navigation API because it exposes only same-origin history URLs.
 * In browsers without that API, only an explicit same-origin referrer is
 * enough evidence to go back; the caller can still use app-owned return-route
 * evidence before falling back to Map.
 */
export function hasMeaningfulRankingHistory(): boolean {
  const navigation = (window as Window & { navigation?: NavigationLike }).navigation;
  const currentEntry = navigation?.currentEntry;

  return shouldUseRankingBrowserBack({
    origin: window.location.origin,
    historyLength: window.history.length,
    referrer: document.referrer,
    navigationCurrentIndex: currentEntry?.index,
    navigationEntries: navigation && currentEntry ? navigation.entries() : undefined,
  });
}

export function RankingFooter({ retailer }: { retailer: RankingRetailer }) {
  const { t } = useLocale();
  const router = useRouter();
  const returnRouteRef = useRef<string | null>(null);
  const didConsumeReturnRouteRef = useRef(false);

  useEffect(() => {
    // Move one-shot evidence out of sessionStorage as soon as Ranking mounts.
    // This prevents browser Back or another departure from leaving a stale
    // route that a later direct Ranking entry could accidentally reuse.
    if (didConsumeReturnRouteRef.current) return;
    didConsumeReturnRouteRef.current = true;
    returnRouteRef.current = consumeRankingReturnRoute(
      window.sessionStorage,
      window.location.origin,
    );
  }, []);

  const goBack = () => {
    const action = chooseRankingBackAction(
      hasMeaningfulRankingHistory(),
      returnRouteRef.current,
      routes.map,
    );
    if (action.kind === "back") {
      router.back();
      return;
    }
    router.replace(action.href);
  };

  const selectRetailer = (nextRetailer: RankingRetailer) => {
    if (nextRetailer !== retailer) {
      router.replace(routes.rankingRetailer(nextRetailer));
    }
  };

  return (
    <nav
      className="bottomnav ranking-footer"
      aria-label={t("Ranking retailer")}
      data-testid="ranking-footer"
    >
      <button type="button" className="nav" onClick={goBack}>
        <Icon name="back" />
        <span><T text={"Back"} /></span>
      </button>
      <button
        type="button"
        className="nav ranking-footer-retailer ranking-footer-olive-young"
        aria-label="Olive Young"
        aria-pressed={retailer === "olive_young"}
        onClick={() => selectRetailer("olive_young")}
      >
        <Image
          className="ranking-footer-mark"
          src="/brands/olive-young-logo.jpeg"
          width={24}
          height={24}
          style={{ objectFit: "contain", borderRadius: 4 }}
          alt=""
          aria-hidden="true"
        />
        <span>Olive Young</span>
      </button>
      <button
        type="button"
        className="nav ranking-footer-retailer ranking-footer-daiso"
        aria-label="Daiso"
        aria-pressed={retailer === "daiso"}
        onClick={() => selectRetailer("daiso")}
      >
        <Image
          className="ranking-footer-mark"
          src="/brands/daiso-logo.jpeg"
          width={24}
          height={24}
          style={{ objectFit: "contain", borderRadius: 4 }}
          alt=""
          aria-hidden="true"
        />
        <span>Daiso</span>
      </button>
    </nav>
  );
}
