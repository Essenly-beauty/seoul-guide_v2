"use client";

import { T, useLocale } from "@/lib/i18n/locale-provider";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { BrandIcon } from "@/components/brand/brand-icon";
import { Icon } from "@/components/icon";
import { RankingFooter } from "@/components/ranking/ranking-footer";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { ProductThumbnail } from "@/components/product/product-thumbnail";
import { SearchField } from "@/components/ui/search-field";
import { SectionHeader } from "@/components/ui/section-header";
import {
  brandSlug,
  type Product,
  type ProductCategory,
} from "@/lib/data";
import {
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
import styles from "./ranking-page.module.css";

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
    <Link className="listrow v2 ranking-product-row" data-testid="olive-young-ranking-row" href={routes.shopItem(p.id)}>
      <ProductThumbnail product={p} className="thumb56" />
      <div className="stack ranking-product-copy" style={{ flex: 1, minWidth: 0 }}>
        <b className="t-label-md">{p.name}</b>
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
  const { t } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? products : products.slice(0, RANK_PREVIEW);
  return (
    <section className={styles.results}>
      <div className={styles.resultHeading}><SectionHeader title={title} count={products.length} /></div>
      <div className={`app-scroll ${styles.resultsScroll}`} data-testid="ranking-scroll" tabIndex={0} aria-label={t(title)}>
      {description && <p className="caption muted"><T text={description} /></p>}
      {products.length === 0 ? (
        <EmptyState><T text={emptyMessage} /></EmptyState>
      ) : (
        <div>
          {shown.map((p) => <ProductGuideRow key={p.id} p={p} />)}
        </div>
      )}
      {products.length > shown.length && (
        <Button variant="secondary" size="sm" style={{ alignSelf: "center" }} onClick={() => setExpanded(true)}><T text={"More ›"} /> </Button>
      )}
      </div>
    </section>
  );
}

// ── Brands — search + icon-led rows ────────────────────────
export function BrandsPanel({ products }: { products: readonly Product[] }) {
  const { t } = useLocale();
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
    <section className={styles.results}>
      <div className={styles.searchControls}>
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
      </div>
      <div className={styles.resultHeading}><SectionHeader title="All brands" count={brands.length} /></div>
      <div key={q.trim().toLowerCase()} className={`app-scroll ${styles.resultsScroll}`} data-testid="ranking-scroll" tabIndex={0} aria-label={t("All brands")}>
      {brands.length === 0 ? (
        <EmptyState><T text="No brands match “{query}”." values={{ query: q }} /></EmptyState>
      ) : (
        <div>
          {brands.map(([brand, count]) => (
            <Link key={brand} className="listrow" href={routes.brand(brandSlug(brand))}>
              <BrandIcon brand={brand} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{brand}</b>
                <div className="caption muted"><T text={count === 1 ? "{count} product" : "{count} products"} values={{ count }} /></div>
              </div>
              <Icon name="chev" size="sm" className="chev" />
            </Link>
          ))}
        </div>
      )}
      </div>
    </section>
  );
}

function OliveYoungProductGuide() {
  const { t } = useLocale();
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
    <div className={styles.guide}>
      <div className={styles.tabs}>
      <div className="chiprow" role="tablist" aria-label={t("Product guide")}>
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
      </div>

      <div
        id={`ranking-panel-${tab}`}
        className={styles.panel}
        role="tabpanel"
        aria-labelledby={`ranking-tab-${tab}`}
        tabIndex={0}
      >
        {tab !== "brands" ? (
          <>
            <div className={styles.filters}>
            <div className="chiprow" role="group" aria-label={t("Product category")}>
              {config.categoriesForTab(tab).map((c) => (
                <Chip key={c.key} selected={category === c.key} onClick={() => setCategory(c.key)}>
                  <span className={styles.categoryVisual}><T text={c.label} /></span>
                </Chip>
              ))}
            </div>
            </div>
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
    </div>
  );
}

function DaisoRankRow({ row }: { row: DaisoRankingRow }) {
  const { t } = useLocale();
  const { product } = row;
  return (
    <Link
      className="listrow v2 ranking-product-row"
      data-testid="daiso-ranking-row"
      data-source-rank={row.rank}
      data-product-no={product.productNo}
      href={routes.daisoProduct(product.productNo)}
      aria-label={t("{rank}. {product} — view product details", { rank: row.rank, product: daisoNameEn(product.productNo) || product.nameKr })}
    >
      <span className="ranking-position num">
        {row.rank}
      </span>
      <ProductThumbnail product={product} className="thumb56" />
      <div className="stack ranking-product-copy" style={{ flex: 1, minWidth: 0 }}>
        {/* Keep the scan list concise; Korean names and fulfillment details
            remain on the product detail page for use in store. */}
        <b className="t-label-md daiso-ranking-name">{daisoNameEn(product.productNo) || product.nameKr}</b>
        <div className="t-caption">{daisoBrandEn(product.productNo) || product.brand} · {daisoSubcategoryEn(product.subcategoryKr)}</div>
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
  const { t } = useLocale();
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
    return <div className={`app-scroll ${styles.resultsScroll}`} data-testid="ranking-scroll"><EmptyState><T text={config.emptyMessage} /></EmptyState></div>;
  }

  return (
    <div className={styles.guide}>
      <div className={styles.tabs}>
      <div className="chiprow" role="tablist" aria-label={t("Daiso ranking type")}>
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
      </div>

      <div
        id={`ranking-panel-${daisoTab}`}
        className={styles.panel}
        role="tabpanel"
        aria-labelledby={`ranking-tab-${daisoTab}`}
        tabIndex={0}
      >
        <div className={styles.filters}>
        <div className="chiprow daiso-category-row" role="group" aria-label={t("Daiso product category")}>
          {categories.map((category) => (
            <Chip
              key={category.key}
              className="daiso-category-chip"
              selected={daisoCategory === category.key}
              onClick={() => setDaisoCategory(category.key)}
            >
              <span className="daiso-category-chip-visual"><T text={category.label} /></span>
            </Chip>
          ))}
        </div>
        </div>
        <section className={styles.results}>
          <div className={styles.resultHeading}><SectionHeader title={t("{period} ranking", { period: t(selectedTabLabel) })} count={ranked.length} /></div>
          <div key={`${daisoTab}:${daisoCategory}`} className={`app-scroll ${styles.resultsScroll}`} data-testid="ranking-scroll" tabIndex={0} aria-label={t("{period} ranking", { period: t(selectedTabLabel) })}>
          {ranked.length === 0 ? (
            <EmptyState
              action={(
                <Button variant="secondary" size="sm" onClick={clearFilters}><T text={"Clear filters"} /> </Button>
              )}
            ><T text="No Daiso products match {period} · {category}." values={{ period: t(selectedTabLabel), category: t(selectedCategoryLabel) }} />
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
          </div>
        </section>
      </div>
    </div>
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
  const { t } = useLocale();
  const screenRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const screen = screenRef.current;
    const viewport = window.visualViewport;
    if (!screen || !viewport) return;
    let frame = 0;
    const resize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (viewport.scale !== 1) return;
        // iOS keyboards resize the visual viewport without always shrinking 100dvh.
        // Cap only this screen; the existing shell and sibling notices keep their layout.
        const top = Math.max(0, screen.getBoundingClientRect().top - viewport.offsetTop);
        screen.style.setProperty('--ranking-viewport-height', `${Math.max(0, viewport.height - top)}px`);
      });
    };
    resize();
    viewport.addEventListener('resize', resize);
    viewport.addEventListener('scroll', resize);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    if (screen.parentElement) observer?.observe(screen.parentElement);
    return () => { cancelAnimationFrame(frame); viewport.removeEventListener('resize', resize); viewport.removeEventListener('scroll', resize); observer?.disconnect(); };
  }, []);
  const daisoConfig = useMemo(
    () => createDaisoRankingConfig(daisoProducts),
    [daisoProducts],
  );
  const rankingTitle = initialRetailer === "daiso" ? "DAISO Ranking" : "OLIVE YOUNG Product Guide";

  return (
    <div ref={screenRef} className={styles.screen} data-testid="ranking-screen">
      <div className={`ranking-page ${styles.main}`}>
        <header className="ranking-retailer-heading" data-retailer={initialRetailer}>
          <Image src={initialRetailer === "daiso" ? "/brands/daiso-logo.jpeg" : "/brands/olive-young-logo.jpeg"} width={32} height={32} alt="" aria-hidden="true" style={{ objectFit: "contain", borderRadius: 5 }} />
          <h1 aria-label={t(rankingTitle)}>
            {initialRetailer === "daiso" ? "DAISO" : "OLIVE YOUNG"}
            <small><T text={initialRetailer === "daiso" ? "Rankings" : "Product guide"} /></small>
          </h1>
        </header>
        {initialRetailer === "daiso"
          ? <DaisoRanking config={daisoConfig} initialCategory={initialDaisoCategory} />
          : <OliveYoungProductGuide />}
      </div>
      <RankingFooter retailer={initialRetailer} />
    </div>
  );
}
