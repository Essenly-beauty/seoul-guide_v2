"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import { HScroll } from "@/components/ui/h-scroll";
import { ImgPh } from "@/components/ui/img-ph";
import { SectionHeader } from "@/components/ui/section-header";
import { BrandMark, Icon } from "@/components/icon";
import { routes } from "@/lib/routes";
import { PRODUCTS, SHOP_CATEGORIES, brandSlug, type Product, type ProductCategory } from "@/lib/data";

type RankTab = "sales" | "review" | "brands";

const TABS: { key: RankTab; label: string }[] = [
  { key: "sales", label: "Sales" },
  { key: "review", label: "Review Best" },
  { key: "brands", label: "Brands" },
];

/** Rows shown before the "More ›" pill expands the full list. */
const RANK_PREVIEW = 10;

// ── Ranked rows — detail-page "Top rated nearby" language ──
function RankRow({ p, rank }: { p: Product; rank: number }) {
  return (
    <Link className="listrow v2" href={routes.shopItem(p.id)}>
      <span className="mono num" style={{ width: 24, fontSize: 15, fontWeight: 700, flex: "none", textAlign: "center", color: rank <= 3 ? "var(--accent)" : "var(--dim)" }}>
        {rank}
      </span>
      <ImgPh className="thumb56" />
      <div className="stack" style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <b className="t-label-md" style={{ fontSize: 14, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</b>
        <div className="t-caption" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {p.brand}
          {p.isTrending && <span className="t-label-sm" style={{ color: "var(--accent)" }}> · Trending</span>}
        </div>
      </div>
      {p.priceRange && <span className="mono num t-label-md" style={{ fontWeight: 700, flex: "none" }}>{p.priceRange}</span>}
    </Link>
  );
}

function RankSection({ title, products }: { title: string; products: Product[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? products : products.slice(0, RANK_PREVIEW);
  return (
    <section className="stack sm">
      <SectionHeader title={title} count={products.length} />
      {products.length === 0 ? (
        <div className="empty"><p>No products in this category yet.</p></div>
      ) : (
        <div>
          {shown.map((p, i) => <RankRow key={p.id} p={p} rank={i + 1} />)}
        </div>
      )}
      {products.length > shown.length && (
        <Button variant="secondary" size="sm" style={{ alignSelf: "center" }} onClick={() => setExpanded(true)}>
          More ›
        </Button>
      )}
    </section>
  );
}

// ── Trending rail — v2 horizontal card rail ────────────────
const TRENDING = PRODUCTS.filter((p) => p.isTrending).sort((a, b) => a.salesRank - b.salesRank);

function TrendingSection() {
  if (TRENDING.length === 0) return null;
  return (
    <section className="stack sm">
      <SectionHeader title="Trending now" count={TRENDING.length} />
      <HScroll ariaLabel="Trending products">
        {TRENDING.map((p) => (
          <Link key={p.id} href={routes.shopItem(p.id)} style={{ width: 128 }}>
            <ImgPh style={{ height: 96, borderRadius: 12 }} />
            <div style={{ fontWeight: 650, fontSize: 13.5, marginTop: 6, lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {p.name}
            </div>
            <div className="caption muted">{p.brand}</div>
            {p.priceRange && <div style={{ fontWeight: 750, fontSize: 14, marginTop: 2 }}>{p.priceRange}</div>}
          </Link>
        ))}
      </HScroll>
    </section>
  );
}

// ── Brands — search + icon-led rows ────────────────────────
function BrandsPanel() {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const brands = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of PRODUCTS) m.set(p.brand, (m.get(p.brand) ?? 0) + 1);
    return [...m.entries()]
      .filter(([b]) => b.toLowerCase().includes(q.toLowerCase().trim()))
      .sort((a, b) => a[0].localeCompare(b[0]));
  }, [q]);
  const clearSearch = () => {
    setQ("");
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <section className="stack sm">
      <div className="mobile-search-field">
        <Icon name="search" size="sm" style={{ color: "var(--muted)" }} aria-hidden="true" />
        <input
          ref={inputRef}
          className="small" style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 16 }}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          placeholder="Search brands" aria-label="Search brands"
          value={q} onChange={(e) => setQ(e.target.value)}
        />
        {q && <IconButton name="x" label="Clear brand search" variant="soft" iconSize="xs" onClick={clearSearch} />}
      </div>
      <SectionHeader title="All brands" count={brands.length} />
      {brands.length === 0 ? (
        <div className="empty"><p>No brands match &quot;{q}&quot;.</p></div>
      ) : (
        <div>
          {brands.map(([brand, count]) => (
            <Link key={brand} className="listrow" href={routes.brand(brandSlug(brand))}>
              <span className="ic"><b>{brand[0]}</b></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{brand}</b>
                <div className="caption muted">{count} product{count === 1 ? "" : "s"}</div>
              </div>
              <Icon name="chev" size="sm" className="chev" />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export default function RankingPage() {
  const [tab, setTab] = useState<RankTab>("sales");
  const [category, setCategory] = useState<"all" | ProductCategory>("all");

  const ranked = useMemo(() => {
    let list = [...PRODUCTS].sort((a, b) =>
      tab === "review" ? a.reviewRank - b.reviewRank : a.salesRank - b.salesRank,
    );
    if (category !== "all") list = list.filter((p) => p.category === category);
    return list;
  }, [tab, category]);
  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % TABS.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + TABS.length) % TABS.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = TABS.length - 1;
    if (next === null) return;
    event.preventDefault();
    const nextTab = TABS[next].key;
    setTab(nextTab);
    requestAnimationFrame(() => document.getElementById(`ranking-tab-${nextTab}`)?.focus());
  };

  return (
    <>
      <div className="topbar center">
        <span aria-hidden="true" style={{ width: 44 }} />
        <span className="row" style={{ flex: 1, gap: 8, justifyContent: "center" }}>
          <BrandMark size={20} />
          <span className="title" style={{ flex: "none" }}>Ranking</span>
        </span>
        <span aria-hidden="true" style={{ width: 44 }} />
      </div>

      <div className="app-scroll pad stack pagev2">
        {/* raw chip buttons kept: <Chip> has no role/tabIndex/onKeyDown passthrough for the
            tablist keyboard contract (lib/navigation-a11y.test.ts) — design-system migration, 2026-07-25 */}
        <div className="chiprow" role="tablist" aria-label="Ranking type">
          {TABS.map((t) => (
            <button
              key={t.key}
              id={`ranking-tab-${t.key}`}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              aria-controls={`ranking-panel-${t.key}`}
              tabIndex={tab === t.key ? 0 : -1}
              className={"chip" + (tab === t.key ? " selected" : "")}
              onClick={() => setTab(t.key)}
              onKeyDown={(event) => onTabKeyDown(event, TABS.indexOf(t))}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div
          id={`ranking-panel-${tab}`}
          className="stack"
          role="tabpanel"
          aria-labelledby={`ranking-tab-${tab}`}
          tabIndex={0}
        >
          {tab !== "brands" ? (
            <>
              <div className="chiprow" role="group" aria-label="Product category">
                {SHOP_CATEGORIES.map((c) => (
                  <Chip key={c.key} soft selected={category === c.key} onClick={() => setCategory(c.key)}>
                    {c.label}
                  </Chip>
                ))}
              </div>
              <hr className="sec-divider" />
              {/* key resets the "More ›" expansion when the ranking scope changes */}
              <RankSection
                key={`${tab}:${category}`}
                title={tab === "sales" ? "Today's sales ranking" : "Highest-rated by reviews"}
                products={ranked}
              />
              <hr className="sec-divider" />
              <TrendingSection />
            </>
          ) : (
            <BrandsPanel />
          )}
        </div>
      </div>
      <BottomNav active="ranking" />
    </>
  );
}
