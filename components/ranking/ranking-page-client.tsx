"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { BrandIcon } from "@/components/brand/brand-icon";
import { Icon } from "@/components/icon";
import { RankingFooter } from "@/components/ranking/ranking-footer";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { ImgPh } from "@/components/ui/img-ph";
import { SearchField } from "@/components/ui/search-field";
import { SectionDivider } from "@/components/ui/section-divider";
import { SectionHeader } from "@/components/ui/section-header";
import { TopBar } from "@/components/ui/top-bar";
import {
  brandSlug,
  type Product,
  type ProductCategory,
} from "@/lib/data";
import {
  optionalDaisoDeliveryTags,
  selectDaisoRankingFromProducts,
  type DaisoRankKey,
  type DaisoRankingProduct,
  type DaisoRankingRow,
} from "@/lib/daiso-ranking";
import { daisoBrandEn, daisoNameEn, daisoSubcategoryEn } from "@/lib/daiso-ranking-en";
import {
  DAISO_RANKING_CONFIG,
  OLIVE_YOUNG_RANKING_CONFIG,
  createDaisoRankingConfig,
  type DaisoRankingConfig,
  type OliveYoungRankTab,
  type RankingRetailer,
} from "@/lib/ranking";
import { routes } from "@/lib/routes";

const OLIVE_YOUNG_TAB_LABELS: Record<OliveYoungRankTab, string> = {
  products: "Products",
  brands: "Brands",
};

const DAISO_TAB_LABELS: Record<DaisoRankKey, string> = {
  rising: "Rising",
  daily: "Daily",
  weekly: "Weekly",
};

/** Rows shown before the "More ›" pill expands the full list. */
const RANK_PREVIEW = 10;

function nextTabIndex(
  event: KeyboardEvent<HTMLButtonElement>,
  index: number,
  tabCount: number,
): number | null {
  if (event.key === "ArrowRight" || event.key === "ArrowDown") return (index + 1) % tabCount;
  if (event.key === "ArrowLeft" || event.key === "ArrowUp") return (index - 1 + tabCount) % tabCount;
  if (event.key === "Home") return 0;
  if (event.key === "End") return tabCount - 1;
  return null;
}

// ── Curated product examples; catalogue order carries no rank claim. ──
function ProductGuideRow({ p }: { p: Product }) {
  return (
    <Link className="listrow v2" data-testid="olive-young-ranking-row" href={routes.shopItem(p.id)}>
      <ImgPh className="thumb56" />
      <div className="stack" style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <b className="t-label-md" style={{ fontSize: 14, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</b>
        <div className="t-caption" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {p.brand}
        </div>
      </div>
    </Link>
  );
}

function ProductGuideSection({
  title,
  description,
  products,
  emptyMessage,
}: {
  title: string;
  description?: string;
  products: readonly Product[];
  emptyMessage: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? products : products.slice(0, RANK_PREVIEW);
  return (
    <section className="stack sm">
      <SectionHeader title={title} count={products.length} />
      {description && <p className="caption muted">{description}</p>}
      {products.length === 0 ? (
        <EmptyState>{emptyMessage}</EmptyState>
      ) : (
        <div>
          {shown.map((p) => <ProductGuideRow key={p.id} p={p} />)}
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

// ── Brands — search + icon-led rows ────────────────────────
function BrandsPanel({ products }: { products: readonly Product[] }) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const brands = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) m.set(p.brand, (m.get(p.brand) ?? 0) + 1);
    return [...m.entries()]
      .filter(([b]) => b.toLowerCase().includes(q.toLowerCase().trim()))
      .sort((a, b) => a[0].localeCompare(b[0]));
  }, [products, q]);
  const clearSearch = () => {
    setQ("");
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <section className="stack sm">
      <SearchField
        inputRef={inputRef}
        value={q}
        onChange={setQ}
        placeholder="Search brands"
        label="Search brands"
        onClear={clearSearch}
        clearLabel="Clear brand search"
        clearVariant="soft"
      />
      {/* extra air between the search field and the list header (2026-08-02) */}
      <div style={{ marginTop: 14 }}>
        <SectionHeader title="All brands" count={brands.length} />
      </div>
      {brands.length === 0 ? (
        <EmptyState>No brands match &quot;{q}&quot;.</EmptyState>
      ) : (
        <div>
          {brands.map(([brand, count]) => (
            <Link key={brand} className="listrow" href={routes.brand(brandSlug(brand))}>
              <BrandIcon brand={brand} />
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

function OliveYoungProductGuide() {
  const config = OLIVE_YOUNG_RANKING_CONFIG;
  const [tab, setTab] = useState<OliveYoungRankTab>("products");
  const [category, setCategory] = useState<"all" | ProductCategory>("all");

  const products = useMemo(() => category === "all"
    ? config.products
    : config.products.filter((p) => p.category === category), [category, config.products]);

  const selectTab = (nextTab: OliveYoungRankTab) => setTab(nextTab);
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = nextTabIndex(event, index, config.tabs.length);
    if (next === null) return;
    event.preventDefault();
    const nextTab = config.tabs[next];
    selectTab(nextTab);
    requestAnimationFrame(() => document.getElementById(`ranking-tab-${nextTab}`)?.focus());
  };

  return (
    <>
      <div className="chiprow" role="tablist" aria-label="Product guide">
        {config.tabs.map((tabKey, index) => (
          <Chip
            key={tabKey}
            id={`ranking-tab-${tabKey}`}
            role="tab"
            selected={tab === tabKey}
            aria-selected={tab === tabKey}
            aria-controls={`ranking-panel-${tabKey}`}
            tabIndex={tab === tabKey ? 0 : -1}
            onClick={() => selectTab(tabKey)}
            onKeyDown={(event) => onTabKeyDown(event, index)}
          >
            {OLIVE_YOUNG_TAB_LABELS[tabKey]}
          </Chip>
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
              {config.categoriesForTab(tab).map((c) => (
                <Chip key={c.key} soft selected={category === c.key} onClick={() => setCategory(c.key)}>
                  {c.label}
                </Chip>
              ))}
            </div>
            <SectionDivider />
            {/* Reset the expanded list when the category changes. */}
            <ProductGuideSection
              key={`${tab}:${category}`}
              title="Product guide"
              description="Curated product examples. Availability and prices are not verified; check the retailer before shopping."
              products={products}
              emptyMessage={config.emptyMessage}
            />
          </>
        ) : (
          <BrandsPanel products={config.products} />
        )}
      </div>
    </>
  );
}

function DaisoRankRow({ row }: { row: DaisoRankingRow }) {
  const { product } = row;
  const deliveryTags = optionalDaisoDeliveryTags(product.delivery);
  return (
    <Link
      className="listrow v2"
      data-testid="daiso-ranking-row"
      data-source-rank={row.rank}
      data-product-no={product.productNo}
      href={routes.daisoProduct(product.productNo)}
      aria-label={`${row.rank}. ${daisoNameEn(product.productNo) || product.nameKr} — view product details`}
    >
      <span className="mono num" style={{ width: 24, fontSize: 15, fontWeight: 700, flex: "none", textAlign: "center", color: row.rank <= 3 ? "var(--accent)" : "var(--dim)" }}>
        {row.rank}
      </span>
      <ImgPh className="thumb56" />
      <div className="stack" style={{ flex: 1, minWidth: 0, gap: 2 }}>
        {/* English leads for the visitor; the Korean original stays so it
            can be shown to a shop assistant (same rule as place names). */}
        <b className="t-label-md daiso-ranking-name">{daisoNameEn(product.productNo) || product.nameKr}</b>
        <div className="t-caption" lang="ko">{product.nameKr}</div>
        <div className="t-caption">{daisoBrandEn(product.productNo) || product.brand} · {daisoSubcategoryEn(product.subcategoryKr)}</div>
        {deliveryTags.length > 0 && (
          <div className="daiso-ranking-tags" aria-label="Available fulfillment options">
            {deliveryTags.map((tag) => <span key={tag}>{tag}</span>)}
          </div>
        )}
      </div>
    </Link>
  );
}

function DaisoRanking({
  config,
  initialCategory = "all",
}: {
  config: DaisoRankingConfig;
  initialCategory?: string;
}) {
  const [daisoTab, setDaisoTab] = useState<DaisoRankKey>("daily");
  const [daisoCategory, setDaisoCategory] = useState(initialCategory);

  const categories = useMemo(
    () => config.categoriesForTab(daisoTab),
    [config, daisoTab],
  );
  const ranked = useMemo(
    () => selectDaisoRankingFromProducts(config.products, daisoTab, daisoCategory),
    [config, daisoCategory, daisoTab],
  );

  const selectDaisoTab = (nextTab: DaisoRankKey) => {
    const nextCategories = config.categoriesForTab(nextTab);
    setDaisoTab(nextTab);
    setDaisoCategory((current) =>
      nextCategories.some(({ key }) => key === current) ? current : "all",
    );
  };
  const clearFilters = () => {
    setDaisoCategory("all");
  };
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = nextTabIndex(event, index, config.tabs.length);
    if (next === null) return;
    event.preventDefault();
    const nextTab = config.tabs[next];
    selectDaisoTab(nextTab);
    requestAnimationFrame(() => document.getElementById(`ranking-tab-${nextTab}`)?.focus());
  };
  const selectedCategoryLabel = categories.find(({ key }) => key === daisoCategory)?.label ?? daisoCategory;
  const selectedTabLabel = DAISO_TAB_LABELS[daisoTab];

  if (config.products.length === 0) {
    return <EmptyState>{config.emptyMessage}</EmptyState>;
  }

  return (
    <>
      <div className="chiprow" role="tablist" aria-label="Daiso ranking type">
        {config.tabs.map((tabKey, index) => (
          <Chip
            key={tabKey}
            id={`ranking-tab-${tabKey}`}
            role="tab"
            selected={daisoTab === tabKey}
            aria-selected={daisoTab === tabKey}
            aria-controls={`ranking-panel-${tabKey}`}
            tabIndex={daisoTab === tabKey ? 0 : -1}
            onClick={() => selectDaisoTab(tabKey)}
            onKeyDown={(event) => onTabKeyDown(event, index)}
          >
            {DAISO_TAB_LABELS[tabKey]}
          </Chip>
        ))}
      </div>

      <div
        id={`ranking-panel-${daisoTab}`}
        className="stack"
        role="tabpanel"
        aria-labelledby={`ranking-tab-${daisoTab}`}
        tabIndex={0}
      >
        <div className="chiprow daiso-category-row" role="group" aria-label="Daiso product category">
          {categories.map((category) => (
            <Chip
              key={category.key}
              className="daiso-category-chip"
              selected={daisoCategory === category.key}
              onClick={() => setDaisoCategory(category.key)}
            >
              <span className="daiso-category-chip-visual">{category.label}</span>
            </Chip>
          ))}
        </div>
        <SectionDivider />
        <section className="stack sm">
          <SectionHeader title={`${selectedTabLabel} ranking`} count={ranked.length} />
          {ranked.length === 0 ? (
            <EmptyState
              action={(
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            >
              No Daiso products match {selectedTabLabel} · {selectedCategoryLabel}.
            </EmptyState>
          ) : (
            <div>
              {ranked.map((row) => (
                <DaisoRankRow
                  key={row.product.id}
                  row={row}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export function RankingPageClient({
  initialRetailer,
  daisoProducts = DAISO_RANKING_CONFIG.products,
  initialDaisoCategory = "all",
}: {
  initialRetailer: RankingRetailer;
  daisoProducts?: readonly DaisoRankingProduct[];
  /** QA/test-support only: production entry points always use the All category. */
  initialDaisoCategory?: string;
}) {
  const daisoConfig = useMemo(
    () => createDaisoRankingConfig(daisoProducts),
    [daisoProducts],
  );
  const rankingTitle = initialRetailer === "daiso" ? "DAISO Ranking" : "OLIVE YOUNG Product Guide";

  return (
    <>
      <TopBar center title={rankingTitle} />
      <div className="app-scroll pad stack pagev2" data-testid="ranking-scroll">
        {initialRetailer === "daiso"
          ? <DaisoRanking config={daisoConfig} initialCategory={initialDaisoCategory} />
          : <OliveYoungProductGuide />}
      </div>
      <RankingFooter retailer={initialRetailer} />
    </>
  );
}
