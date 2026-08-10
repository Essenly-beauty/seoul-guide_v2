"use client";

import Link from "next/link";
import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { RatingLine } from "@/components/ui/rating-line";
import { SectionHeader } from "@/components/ui/section-header";
import { SectionDivider } from "@/components/ui/section-divider";
import { CategoryBadge } from "@/components/category/category-badge";
import { Icon } from "@/components/icon";
import { routes } from "@/lib/routes";
import { getPlace } from "@/lib/data";
import { useMyRatings, useMyRatingsReady } from "@/lib/ratings";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** ISO timestamp → "Apr 18, 2026" (falls back to nothing for legacy entries). */
function formatAt(at?: string): string | null {
  if (!at) return null;
  const [date] = at.split("T");
  const [y, m, d] = (date ?? "").split("-").map(Number);
  if (!y || !m || !d) return null;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export default function MyReviewsPage() {
  // Live store — the same ratings set on each place page, synced to the
  // account when signed in.
  const ratings = useMyRatings();
  const ready = useMyRatingsReady();
  const rated = Object.entries(ratings)
    .map(([id, r]) => ({ place: getPlace(id), ...r }))
    .filter((r) => r.place)
    .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));

  return (
    <>
      <TopBar center left={<BackButton fallback={routes.menu} />} title="My reviews" />
      <div className="app-scroll pad stack pagev2">
        <section className="stack sm">
          <SectionHeader title="Your ratings" count={ready ? rated.length : undefined} />
          <p className="t-caption">Rate places you&apos;ve visited — ratings sync to your account and help future MYSEOULDROP travelers pick wisely.</p>
        </section>

        <SectionDivider />
        {!ready ? (
          <div role="status" aria-busy="true" aria-label="Loading your ratings" className="stack sm" style={{ animation: "pulse 1.6s ease-in-out infinite" }}>
            {[0, 1].map((i) => (
              <div key={i} className="row" style={{ gap: 12, padding: "10px 0" }}>
                <div style={{ width: 40, height: 40, flex: "none", borderRadius: 10, background: "var(--surface-hover)", border: "1px solid var(--border)" }} />
                <div style={{ width: `${58 - i * 14}%`, height: 13, borderRadius: 6, background: "var(--surface-hover)", border: "1px solid var(--border)" }} />
              </div>
            ))}
          </div>
        ) : rated.length === 0 ? (
          <section className="stack sm">
            <EmptyState>No ratings yet — open a place you&apos;ve visited and tap the stars.</EmptyState>
            <Button variant="secondary" href={routes.map} style={{ alignSelf: "center" }}>Browse the map</Button>
          </section>
        ) : (
          <section className="stack sm">
            <div>
              {rated.map(({ place, rating, at }) => (
                <Link key={place!.id} className="listrow v2 top" href={routes.place(place!.id)}>
                  <div className="stack" style={{ flex: 1, minWidth: 0, gap: 3 }}>
                    <div className="row" style={{ gap: 6 }}>
                      <CategoryBadge type={place!.type} size={16} />
                      <b className="t-label-md" style={{ fontSize: 14, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{place!.name}</b>
                      <RatingLine rating={rating} plain />
                    </div>
                    <div className="t-caption mono">{place!.nameKr}</div>
                    {formatAt(at) && <div className="t-caption num" style={{ color: "var(--dim)" }}>{formatAt(at)}</div>}
                  </div>
                  <Icon name="chev" size="xs" className="chev" />
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
      <BottomNav active="menu" />
    </>
  );
}
