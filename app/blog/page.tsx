"use client";

import Link from "next/link";
import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { TopicTag } from "@/components/ui/topic-tag";
import { ImgPh } from "@/components/ui/img-ph";
import { SectionHeader } from "@/components/ui/section-header";
import { SectionDivider } from "@/components/ui/section-divider";
import { HScroll } from "@/components/ui/h-scroll";
import { routes } from "@/lib/routes";
import { ARTICLES } from "@/lib/data";

export default function BlogListPage() {
  const [hero, ...rest] = ARTICLES;
  const topics = Array.from(new Set(ARTICLES.flatMap((a) => a.tags)));
  const stories = rest;
  return (
    <>
      <TopBar center title="Blog" />
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
            {hero.tags.slice(0, 3).map((t) => <TopicTag key={t}>{t}</TopicTag>)}
          </div>
        </section>

        <SectionDivider />

        {/* Latest stories — thumb rows */}
        <section className="stack sm">
          <SectionHeader title="Latest stories" count={stories.length} />
          <div>
            {stories.map((a, i) => (
              <Link key={`${a.slug}-${i}`} className="listrow" href={routes.blogArticle(a.slug)}>
                <ImgPh style={{ width: 56, height: 56, flex: "none", borderRadius: 12 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ display: "block", fontWeight: 650, fontSize: 14, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</b>
                  <div className="caption muted">{a.date} · {a.readMin} min read</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <SectionDivider />

        {/* Browse by topic — static editorial metadata until filtering exists */}
        <section className="stack sm">
          <SectionHeader title="Topics" />
          <HScroll ariaLabel="Topics">
            {topics.map((t) => <TopicTag key={t}>{t}</TopicTag>)}
          </HScroll>
        </section>
      </div>
      <BottomNav active="blog" />
    </>
  );
}
