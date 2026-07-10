"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BottomNav } from "@/components/ui/bottom-nav";
import { BrandMark, Icon } from "@/components/icon";
import { routes } from "@/lib/routes";
import { PRODUCTS, SHOP_CATEGORIES, brandSlug, type Product, type ProductCategory } from "@/lib/data";

type RankTab = "sales" | "review" | "brands";

const TABS: { key: RankTab; label: string }[] = [
  { key: "sales", label: "Sales" },
  { key: "review", label: "Review Best" },
  { key: "brands", label: "Brands" },
];

function RankList({ products }: { products: Product[] }) {
  if (products.length === 0) return <div className="empty"><p>No products in this category yet.</p></div>;
  return (
    <ol className="ranklist">
      {products.map((p, i) => (
        <li key={p.id}>
          <Link className="rankrow" href={routes.shopItem(p.id)}>
            <span className={"rankbadge" + (i < 3 ? " top" : "") + (i === 0 ? " first" : "")}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="thumb hero-img" />
            <div style={{ flex: 1 }}>
              <div className="caption muted">{p.brand}</div>
              <b style={{ display: "block", lineHeight: 1.3 }}>{p.name}</b>
              <div className="name-kr">{p.nameKr}</div>
              <div className="row" style={{ gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                {p.priceRange && <span className="chip mono" style={{ padding: "2px 7px" }}>{p.priceRange}</span>}
                {p.isTrending && <span className="badge warning">Trending</span>}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ol>
  );
}

function BrandsPanel() {
  const [q, setQ] = useState("");
  const brands = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of PRODUCTS) m.set(p.brand, (m.get(p.brand) ?? 0) + 1);
    return [...m.entries()]
      .filter(([b]) => b.toLowerCase().includes(q.toLowerCase().trim()))
      .sort((a, b) => a[0].localeCompare(b[0]));
  }, [q]);

  return (
    <>
      <div className="row" style={{ gap: 8, background: "var(--surface-hover)", borderRadius: "var(--r-full)", padding: "10px 14px" }}>
        <Icon name="search" size="sm" style={{ color: "var(--muted)" }} aria-hidden="true" />
        <input
          className="small" style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 16 }}
          placeholder="Search brands" aria-label="Search brands"
          value={q} onChange={(e) => setQ(e.target.value)}
        />
        {q && <button className="iconbtn" style={{ width: 28, height: 28 }} aria-label="Clear" onClick={() => setQ("")}><Icon name="x" size="xs" /></button>}
      </div>
      {brands.length === 0 && <div className="empty"><p>No brands match &quot;{q}&quot;.</p></div>}
      <div className="card" style={{ padding: "4px 16px" }}>
        {brands.map(([brand, count]) => (
          <Link key={brand} className="listrow" href={routes.brand(brandSlug(brand))}>
            <div><b>{brand}</b><div className="caption muted">{count} product{count === 1 ? "" : "s"}</div></div>
            <Icon name="chev" size="sm" className="chev" style={{ marginLeft: "auto" }} />
          </Link>
        ))}
      </div>
    </>
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

  return (
    <>
      <div className="topbar center">
        <span style={{ width: 40 }} />
        <span className="row" style={{ flex: 1, gap: 8, justifyContent: "center" }}>
          <BrandMark size={20} />
          <span className="title" style={{ flex: "none" }}>Ranking</span>
        </span>
        <span style={{ width: 40 }} />
      </div>

      <div className="app-scroll pad stack">
        <div className="chiprow" role="tablist" aria-label="Ranking type">
          {TABS.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} className={"chip" + (tab === t.key ? " selected" : "")} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {tab !== "brands" && (
          <>
            <div className="chiprow">
              {SHOP_CATEGORIES.map((c) => (
                <button key={c.key} className={"chip soft" + (category === c.key ? " selected" : "")} aria-pressed={category === c.key} onClick={() => setCategory(c.key)}>
                  {c.label}
                </button>
              ))}
            </div>
            <div className="countline">
              {tab === "sales" ? "Today's sales ranking" : "Highest-rated by reviews"} · TOP {ranked.length}
            </div>
            <RankList products={ranked} />
          </>
        )}

        {tab === "brands" && <BrandsPanel />}
      </div>
      <BottomNav active="ranking" />
    </>
  );
}
