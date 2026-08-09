"use client";

import { useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { ImgPh } from "@/components/ui/img-ph";
import { SectionHeader } from "@/components/ui/section-header";
import { SectionDivider } from "@/components/ui/section-divider";
import { HScroll } from "@/components/ui/h-scroll";
import { routes } from "@/lib/routes";
import { ARTICLES, type Article } from "@/lib/data";

/** Extra mock stories revealed by "More ›" — slugs reuse published articles so links resolve
    (lib/data is owned by another workstream; local mock keeps the expansion demonstrable). */
const MORE_ARTICLES: Article[] = [
  { slug: "korean-glass-skin-routine", title: "Aqua Peel vs. Glass Skin Facial: Which One First?", tags: ["skincare", "clinic"], date: "Apr 2, 2026", readMin: 4 },
  { slug: "7-step-kbeauty-guide", title: "How to Book a Korean Hair Salon Without Speaking Korean", tags: ["hair", "booking"], date: "Apr 8, 2026", readMin: 5 },
  { slug: "seoul-beauty-hotspots-hongdae", title: "Personal Color Analysis in Seoul: What ₩120,000 Gets You", tags: ["personal-color"], date: "Apr 14, 2026", readMin: 6 },
  { slug: "korean-glass-skin-routine", title: "Head Spas Are Seoul's Best-Kept Jet Lag Cure", tags: ["head-spa"], date: "Apr 20, 2026", readMin: 4 },
];

export default function BlogListPage() {
  const [hero, ...rest] = ARTICLES;
  const [showAll, setShowAll] = useState(false);
  const topics = Array.from(new Set(ARTICLES.flatMap((a) => a.tags)));
  const stories = [...rest, ...MORE_ARTICLES];
  const visible = showAll ? stories : rest;
  return (
    <>
      <TopBar title="Blog" />
      <div className="app-scroll pad stack pagev2">
        {/* Top-level page title — the one serif moment on the page */}
        <div>
          <div className="label">Blog</div>
          <div className="h1">K-beauty <span style={{ fontStyle: "italic", color: "var(--accent)" }}>tips &amp; stories.</span></div>
        </div>

        {/* Featured story — big image card */}
        <section className="stack sm">
          <SectionHeader title="Featured" />
          <Link className="stack" href={routes.blogArticle(hero.slug)} style={{ gap: 8 }}>
            <ImgPh style={{ height: 170, borderRadius: 12 }} />
            <div>
              <div style={{ fontWeight: 650, fontSize: 16, lineHeight: 1.3 }}>{hero.title}</div>
              <div className="caption muted" style={{ marginTop: 4 }}>{hero.date} · {hero.readMin} min read</div>
            </div>
          </Link>
          <div className="chipwrap">
            {hero.tags.slice(0, 3).map((t) => <Chip key={t}>{t}</Chip>)}
          </div>
        </section>

        <SectionDivider />

        {/* Latest stories — thumb rows */}
        <section className="stack sm">
          <SectionHeader title="Latest stories" count={stories.length} />
          <div>
            {visible.map((a, i) => (
              <Link key={`${a.slug}-${i}`} className="listrow" href={routes.blogArticle(a.slug)}>
                <ImgPh style={{ width: 56, height: 56, flex: "none", borderRadius: 12 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ display: "block", fontWeight: 650, fontSize: 14, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</b>
                  <div className="caption muted">{a.date} · {a.readMin} min read</div>
                </div>
              </Link>
            ))}
          </div>
          {!showAll && (
            <Button variant="secondary" size="sm" style={{ alignSelf: "center" }} aria-expanded={false} onClick={() => setShowAll(true)}>
              More ›
            </Button>
          )}
        </section>

        <SectionDivider />

        {/* Browse by topic — horizontal chip rail */}
        <section className="stack sm">
          <SectionHeader title="Topics" />
          <HScroll ariaLabel="Topics">
            {topics.map((t) => <Chip key={t}>#{t}</Chip>)}
          </HScroll>
        </section>
      </div>
      <BottomNav active="blog" />
    </>
  );
}
