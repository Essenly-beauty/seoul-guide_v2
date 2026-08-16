"use client";

import Link from "next/link";
import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { SectionHeader } from "@/components/ui/section-header";
import { SectionDivider } from "@/components/ui/section-divider";
import { MenuProfile } from "@/components/mypage/menu-profile";
import { Badge } from "@/components/ui/badge";
import { FeedbackLauncher } from "@/components/ui/feedback-sheet";
import { BrandMark, BrandWordmark } from "@/components/brand/brand-logo";
import { ProfileCard } from "@/components/mypage/profile-card";
import { Icon } from "@/components/icon";
import { routes } from "@/lib/routes";
import { ARTICLES, PLACES, PRODUCTS, getPlace } from "@/lib/data";
import { useFavorites, useFavoritesReady } from "@/lib/favorites";
import { useSigninNudge } from "@/components/auth/signin-nudge";
import { useAuthUser } from "@/lib/auth/use-auth";
import { useEffect } from "react";
import { useMyRatings, useMyRatingsReady } from "@/lib/ratings";

type MenuRow = { icon: Parameters<typeof Icon>[0]["name"]; title: string; value?: string; href: string; badge?: string };

// Launch scope (audit P0-1/P0-3): Reservations, My Trip, Beauty Kit, and
// Notifications are prototype flows with no backend — hidden from the public
// menu until each is real. Restore a row by adding it back here.
const GROUPS: { title: string; rows: MenuRow[] }[] = [
  {
    title: "My activity",
    rows: [
      { icon: "heart", title: "Saved", href: routes.favorites },
      { icon: "book", title: "My reviews", href: routes.reviews },
    ],
  },
  {
    title: "Preferences",
    rows: [
      { icon: "user", title: "Beauty profile", value: "Skin & hair type", href: routes.onboardingInterests },
      { icon: "mark", title: "Settings", href: routes.settings },
    ],
  },
  {
    title: "Support",
    rows: [
      { icon: "cross", title: "Help & support", href: routes.support },
      { icon: "lock", title: "Terms & privacy", href: routes.legalTerms },
    ],
  },
];

export default function MenuPage() {
  // Live favorites — the Saved count reflects the account (or guest list),
  // not a hardcoded demo number. Counted against the catalog so it always
  // matches exactly what the Saved page renders.
  const favs = useFavorites();
  const favsReady = useFavoritesReady();
  const savedCount =
    PLACES.filter((p) => favs.place.includes(p.id)).length +
    PRODUCTS.filter((p) => favs.product.includes(p.id)).length +
    ARTICLES.filter((a) => favs.article.includes(a.slug)).length;
  const savedLabel = favsReady ? String(savedCount) : "–";
  const ratings = useMyRatings();
  const ratingsReady = useMyRatingsReady();
  // guests entering My get the join sheet (user decision 2026-08-16) —
  // dismissible; the guest menu stays usable underneath
  const { user, loading: authLoading } = useAuthUser();
  const { nudge, sheet: joinSheet } = useSigninNudge();
  useEffect(() => {
    if (!authLoading && !user) nudge("menu");
  }, [authLoading, user, nudge]);
  const ratedCount = Object.keys(ratings).filter((id) => getPlace(id)).length;
  const ratedLabel = ratingsReady ? String(ratedCount) : "–";
  return (
    <>
      <TopBar title="Menu" />
      {joinSheet}
      <div className="app-scroll pad stack pagev2">
        {/* Profile header block — live session state */}
        <section className="stack">
          <MenuProfile />
          <div className="row between" style={{ textAlign: "center" }}>
            {[[savedLabel, "Saved"], [ratedLabel, "My reviews"]].map(([n, l]) => (
              <div key={l} style={{ flex: 1 }}>
                <div className="h2" style={{ color: "var(--accent)" }}>{n}</div>
                <div className="caption muted">{l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Progressive-profiling gauge + one-tap question (docs §4-1) */}
        <ProfileCard />

        {GROUPS.map((g) => (
          <div key={g.title} className="stack" style={{ gap: 12 }}>
            <SectionDivider />
            <section className="stack sm">
              <SectionHeader title={g.title} />
              {g.rows.map((m) => {
                const badge =
                  m.title === "Saved" ? (favsReady && savedCount > 0 ? String(savedCount) : undefined)
                  : m.title === "My reviews" ? (ratingsReady && ratedCount > 0 ? String(ratedCount) : undefined)
                  : m.badge;
                return (
                  <Link key={m.title} className="inforow" href={m.href}>
                    <Icon name={m.icon} size="xs" />
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.title}</span>
                    <span className="chev row" style={{ gap: 7 }}>
                      {m.value && <span className="caption muted">{m.value}</span>}
                      {badge && <Badge tone="dim">{badge}</Badge>}
                      <Icon name="chev" size="xs" style={{ color: "var(--dim)" }} />
                    </span>
                  </Link>
                );
              })}
              {g.title === "Support" && (
                <FeedbackLauncher className="inforow" style={{ width: "100%" }}>
                  <Icon name="ext" size="xs" />
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Send feedback</span>
                  <span className="chev row" style={{ gap: 7 }}>
                    <Icon name="chev" size="xs" style={{ color: "var(--dim)" }} />
                  </span>
                </FeedbackLauncher>
              )}
            </section>
          </div>
        ))}

        {/* Brand footer — mark + wordmark, the one place the app signs itself */}
        <div className="stack sm" style={{ alignItems: "center", padding: "20px 0 8px" }}>
          <BrandMark size={30} />
          <BrandWordmark size={13} />
          <span className="caption dim">Seoul beauty, mapped.</span>
        </div>
      </div>
      <BottomNav active="menu" />
    </>
  );
}
