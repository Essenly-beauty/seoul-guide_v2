"use client";

import { useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { ImgPh } from "@/components/ui/img-ph";
import { LiveBadge } from "@/components/ui/live-badge";
import { RatingLine } from "@/components/ui/rating-line";
import { SectionHeader } from "@/components/ui/section-header";
import { CategoryBadge } from "@/components/category/category-badge";
import { CategoryChips, type MapCat } from "@/components/category/category-chips";
import { Icon } from "@/components/icon";
import { routes } from "@/lib/routes";
import { ARTICLES, PLACES, PRODUCTS, TYPE_LABEL, zoneShort, type Article, type Place, type Product } from "@/lib/data";
import { useFavorites } from "@/lib/favorites";

// ── Places — category filter + detail-page list rows ──────
function PlacesSection({ favPlaces }: { favPlaces: Place[] }) {
  const [cat, setCat] = useState<MapCat>("all");
  const shown = cat === "all" ? favPlaces : favPlaces.filter((p) => p.type === cat);
  return (
    <section className="stack sm">
      <SectionHeader title="Places" count={favPlaces.length} actionLabel="See all" href={routes.map} />
      <CategoryChips value={cat} onChange={setCat} />
      {shown.length === 0 ? (
        <div className="empty"><p>{favPlaces.length === 0 ? "Nothing saved yet — tap ♥ on any place." : "No saved places in this category."}</p></div>
      ) : (
        <div>
          {shown.map((p) => (
            <div className="listrow v2" key={p.id}>
              <Link href={routes.place(p.id)} className="row" style={{ gap: 12, flex: 1, minWidth: 0 }}>
                <ImgPh className="thumb56" />
                <div className="stack" style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <CategoryBadge type={p.type} size={16} />
                    <b className="t-label-md" style={{ fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</b>
                  </div>
                  <div className="t-caption" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {TYPE_LABEL[p.type]} · {zoneShort(p.zone)} · {p.priceRange}
                  </div>
                  <div className="row t-caption" style={{ gap: 6, overflow: "hidden", whiteSpace: "nowrap" }}>
                    <RatingLine rating={p.rating} count={p.ratingCount} plain />
                    <span aria-hidden="true">·</span>
                    <LiveBadge hours={p.hours} showUntil={false} />
                  </div>
                </div>
              </Link>
              <FavoriteButton kind="place" id={p.id} variant="soft" size="xs" />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Products — same row language as Ranking ────────────────
function ProductsSection({ favProducts }: { favProducts: Product[] }) {
  return (
    <section className="stack sm">
      <SectionHeader title="Products" count={favProducts.length} actionLabel="See all" href={routes.ranking} />
      {favProducts.length === 0 && <div className="empty"><p>No saved products yet.</p></div>}
      <div>
        {favProducts.map((prod) => (
          <div className="listrow v2" key={prod.id}>
            <Link href={routes.shopItem(prod.id)} className="row" style={{ gap: 12, flex: 1, minWidth: 0 }}>
              <ImgPh className="thumb56" />
              <div className="stack" style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <b className="t-label-md" style={{ fontSize: 14, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{prod.name}</b>
                <div className="t-caption" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {prod.brand} · {prod.nameKr}
                </div>
              </div>
              {prod.priceRange && <span className="mono num t-label-md" style={{ fontWeight: 700, flex: "none" }}>{prod.priceRange}</span>}
            </Link>
            <FavoriteButton kind="product" id={prod.id} variant="soft" size="xs" />
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Blog — icon-led rows ───────────────────────────────────
function ArticlesSection({ favArticles }: { favArticles: Article[] }) {
  return (
    <section className="stack sm">
      <SectionHeader title="Blog" count={favArticles.length} actionLabel="See all" href={routes.blog} />
      {favArticles.length === 0 && <div className="empty"><p>No saved stories yet.</p></div>}
      <div>
        {favArticles.map((a) => (
          <div className="listrow" key={a.slug}>
            <Link href={routes.blogArticle(a.slug)} className="row" style={{ gap: 12, flex: 1, minWidth: 0 }}>
              <span className="ic"><Icon name="book" size="sm" /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</b>
                <div className="caption muted">{a.date} · {a.readMin} min read</div>
              </div>
            </Link>
            <FavoriteButton kind="article" id={a.slug} variant="soft" size="xs" />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function FavoritesPage() {
  // Live store — rows appear/disappear as hearts toggle anywhere in the app.
  const favs = useFavorites();
  const favPlaces = PLACES.filter((p) => favs.place.includes(p.id));
  const favProducts = PRODUCTS.filter((p) => favs.product.includes(p.id));
  const favArticles = ARTICLES.filter((a) => favs.article.includes(a.slug));
  return (
    <>
      <TopBar title="Saved" />
      <div className="app-scroll pad stack pagev2">
        <div>
          <div className="label">Saved</div>
          <div className="h1">Your <span style={{ fontStyle: "italic", color: "var(--accent)" }}>K-beauty list.</span></div>
        </div>
        <PlacesSection favPlaces={favPlaces} />
        <hr className="sec-divider" />
        <ProductsSection favProducts={favProducts} />
        <hr className="sec-divider" />
        <ArticlesSection favArticles={favArticles} />
      </div>
      <BottomNav active="saved" />
    </>
  );
}
