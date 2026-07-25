import Link from "next/link";
import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { ImgPh } from "@/components/ui/img-ph";
import { RatingLine } from "@/components/ui/rating-line";
import { SectionHeader } from "@/components/ui/section-header";
import { CategoryBadge } from "@/components/category/category-badge";
import { Icon } from "@/components/icon";
import { routes, sample } from "@/lib/routes";
import type { PlaceType } from "@/lib/data";

const WRITTEN: { type: PlaceType; name: string; kr: string; rating: number; text: string; date: string }[] = [
  {
    type: "head_spa", name: "HOSU DOSAN", kr: "호수 도산점", rating: 5,
    text: "The scalp diagnosis was so thorough. They had a translator app ready and walked me through every step. Apgujeong vibes — premium but not snobby.",
    date: "Apr 18, 2026",
  },
  {
    type: "hair_salon", name: "Juno Hair Gangnam", kr: "준오헤어 강남점", rating: 4,
    text: "Got the K-pop layered cut. Stylist understood my reference photo immediately (showed via Essenly Style refs). Took 2 hours instead of 90min, but the result is exactly what I wanted.",
    date: "Apr 12, 2026",
  },
];

export default function MyReviewsPage() {
  return (
    <>
      <TopBar center left={<BackButton fallback={routes.menu} />} title="My reviews" />
      <div className="app-scroll pad stack pagev2">
        <section className="stack sm">
          <SectionHeader title="Your reviews" count={WRITTEN.length} />
          <p className="t-caption">Reviews show on each place&apos;s page and help future Essenly travelers pick wisely.</p>
        </section>

        <hr className="sec-divider" />
        <section className="stack sm">
          <SectionHeader title="Awaiting your review" count={1} />
          <div className="listrow v2">
            <span className="ic"><Icon name="cal" size="sm" /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b className="t-label-md" style={{ fontSize: 14, display: "block" }}>Eden Head Spa</b>
              <div className="t-caption mono num">Apr 22 · HS-8B14D2</div>
            </div>
            <Button variant="secondary" size="sm" href={routes.reviewNew}>Write review</Button>
          </div>
        </section>

        <hr className="sec-divider" />
        <section className="stack sm">
          <SectionHeader title="Written" count={WRITTEN.length} />
          <div>
            {WRITTEN.map((r) => (
              <Link key={r.name} className="listrow v2 top" href={routes.place(sample.place)}>
                <ImgPh className="thumb56" />
                <div className="stack" style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <CategoryBadge type={r.type} size={16} />
                    <b className="t-label-md" style={{ fontSize: 14, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</b>
                    <RatingLine rating={r.rating} plain />
                  </div>
                  <div className="t-caption mono">{r.kr}</div>
                  <p className="small muted" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {r.text}
                  </p>
                  <div className="t-caption num" style={{ color: "var(--dim)" }}>{r.date}</div>
                </div>
                <Icon name="chev" size="xs" className="chev" />
              </Link>
            ))}
          </div>
        </section>
      </div>
      <BottomNav active="menu" />
    </>
  );
}
