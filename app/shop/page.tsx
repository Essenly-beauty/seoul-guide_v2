"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BottomNav } from "@/components/ui/bottom-nav";
import { HamburgerMenu } from "@/components/ui/hamburger-menu";
import { BrandMark } from "@/components/icon";
import { routes } from "@/lib/routes";
import {
  PRODUCTS, SHOP_CATEGORIES, SUB_CATEGORIES, ALL_FILTERS, STEP_MAP,
  type ProductCategory, type StepCategory, type Product,
} from "@/lib/data";

type AllFilter = "all" | "essenly" | "3step" | "5step" | "7step";

// Ranking: editor's picks first, then trending, then alphabetical (no-profile behavior).
const ranked: Product[] = [...PRODUCTS].sort((a, b) => {
  if (!!b.isEditorsPick !== !!a.isEditorsPick) return b.isEditorsPick ? 1 : -1;
  if (!!b.isTrending !== !!a.isTrending) return b.isTrending ? 1 : -1;
  return a.name.localeCompare(b.name);
});

export default function ShopPage() {
  const [category, setCategory] = useState<"all" | ProductCategory>("all");
  const [subCategory, setSubCategory] = useState<"all" | StepCategory>("all");
  const [allFilter, setAllFilter] = useState<AllFilter>("all");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: ranked.length };
    for (const p of ranked) c[p.category] = (c[p.category] ?? 0) + 1;
    return c;
  }, []);

  const subOptions = category !== "all" ? SUB_CATEGORIES[category] : undefined;

  const filtered = useMemo(() => {
    let list = ranked;
    if (category !== "all") list = list.filter((p) => p.category === category);
    if (subCategory !== "all") list = list.filter((p) => p.stepCategory === subCategory);
    if (category === "all" && allFilter !== "all") {
      if (allFilter === "essenly") list = list.filter((p) => p.isEssenly);
      else {
        const n = allFilter === "3step" ? 3 : allFilter === "5step" ? 5 : 7;
        const set = new Set<StepCategory>(STEP_MAP[n]);
        list = list.filter((p) => p.stepCategory && set.has(p.stepCategory));
      }
    }
    return list;
  }, [category, subCategory, allFilter]);

  function pickCategory(key: "all" | ProductCategory) {
    setCategory(key);
    setSubCategory("all");
    setAllFilter("all");
  }

  return (
    <>
      <div className="topbar center">
        <HamburgerMenu />
        <span className="row" style={{ flex: 1, gap: 8, justifyContent: "center" }}>
          <BrandMark size={20} />
          <span className="title" style={{ flex: "none" }}>Shop</span>
        </span>
        <span style={{ width: 40 }} />
      </div>

      <div className="app-scroll pad stack">
        <div>
          <div className="label">Catalog</div>
          <div className="h1">
            K-beauty <span style={{ fontStyle: "italic", color: "var(--accent)" }}>ranked for you.</span>
          </div>
          <p className="muted" style={{ marginTop: 6 }}>Curated picks from Olive Young and Korea-exclusive brands.</p>
        </div>

        {/* Primary category tabs with counts */}
        <div className="chiprow" role="tablist">
          {SHOP_CATEGORIES.map((c) => {
            const on = category === c.key;
            const n = counts[c.key] ?? 0;
            return (
              <button key={c.key} className={"chip" + (on ? " selected" : "")} aria-pressed={on} onClick={() => pickCategory(c.key)}>
                {c.label}
                {n > 0 && <span className="mono" style={{ opacity: 0.7, marginLeft: 4 }}>{n}</span>}
              </button>
            );
          })}
        </div>

        {/* All-view filter (only when category === all) */}
        {category === "all" && (
          <div className="chiprow">
            {ALL_FILTERS.map((f) => {
              const on = allFilter === f.key;
              return (
                <button key={f.key} className={"chip soft" + (on ? " selected" : "")} aria-pressed={on} onClick={() => setAllFilter(f.key)}>
                  {f.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Sub-category (only for skincare/haircare) */}
        {subOptions && (
          <div className="chiprow">
            {subOptions.map((s) => {
              const on = subCategory === s.key;
              return (
                <button key={s.key} className={"chip soft" + (on ? " selected" : "")} aria-pressed={on} onClick={() => setSubCategory(s.key)}>
                  {s.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="countline">{filtered.length} product{filtered.length === 1 ? "" : "s"} · updated 2026.07.04</div>

        {filtered.length === 0 ? (
          <div className="empty"><p>No products match these filters.</p></div>
        ) : (
          <ol className="ranklist">
            {filtered.map((p, i) => (
              <li key={p.id}>
                <Link className="rankrow" href={routes.shopItem(p.id)}>
                  <span className={"rankbadge" + (i < 3 ? " top" : "") + (i === 0 ? " first" : "")}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="thumb hero-img" />
                  <div style={{ flex: 1 }}>
                    <div className="caption muted">{p.brand}</div>
                    <b style={{ display: "block", lineHeight: 1.3 }}>{p.name}</b>
                    <div className="row" style={{ gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                      {p.priceRange && <span className="chip mono" style={{ padding: "2px 7px" }}>{p.priceRange}</span>}
                      {p.isEditorsPick && <span className="badge accent">Editor&apos;s Pick</span>}
                      {p.isTrending && <span className="badge warning">Trending</span>}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
      <BottomNav active="shop" />
    </>
  );
}
