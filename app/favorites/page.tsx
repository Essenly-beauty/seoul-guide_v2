"use client";

import { useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { Tabs } from "@/components/ui/tabs";
import { Icon } from "@/components/icon";
import { routes } from "@/lib/routes";
import { ARTICLES, MAP_CATEGORIES, PLACES, PRODUCTS, TYPE_LABEL, TYPE_ICON, zoneShort, type PlaceType } from "@/lib/data";

const favProducts = PRODUCTS.slice(0, 3);
const favPlaces = PLACES.filter((p) => ["juno-hair-gangnam", "colorlab-gangnam", "soothe-head-spa", "oy-gangnam-town"].includes(p.id));
const favArticles = ARTICLES.slice(0, 2);

function MapPanel() {
  const [cat, setCat] = useState<"all" | PlaceType>("all");
  const shown = cat === "all" ? favPlaces : favPlaces.filter((p) => p.type === cat);
  return (
    <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
      <div className="favrail" role="group" aria-label="Filter saved places">
        {MAP_CATEGORIES.map((c) => (
          <button key={c.key} className={cat === c.key ? "on" : ""} aria-pressed={cat === c.key} onClick={() => setCat(c.key)}>
            {c.key === "all" ? <Icon name="mark" size="sm" /> : <Icon name={TYPE_ICON[c.key as PlaceType]} size="sm" />}
            <span>{c.label}</span>
          </button>
        ))}
      </div>
      <div className="stack" style={{ flex: 1 }}>
        {shown.length === 0 && <div className="empty"><p>No saved places in this category.</p></div>}
        {shown.map((p) => (
          <div className="placecard" key={p.id} style={{ position: "relative" }}>
            <Link href={routes.place(p.id)} className="row" style={{ gap: 12, flex: 1, alignItems: "flex-start" }}>
              <div className="thumb hero-img" style={{ display: "grid", placeItems: "center" }}>
                <Icon name={TYPE_ICON[p.type]} style={{ color: "var(--accent)" }} />
              </div>
              <div style={{ flex: 1 }}>
                <span className="label">{TYPE_LABEL[p.type]} · {zoneShort(p.zone)}</span>
                <h3 style={{ fontSize: 17, margin: "2px 0" }}>{p.name}</h3>
                <div className="name-kr">{p.nameKr}</div>
                <div className="meta">{p.rating && <span className="stars">★ {p.rating}</span>} <span className="chip mono" style={{ padding: "3px 8px" }}>{p.priceRange}</span></div>
              </div>
            </Link>
            <div style={{ position: "absolute", top: 10, right: 10 }}><FavoriteButton initial /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductsPanel() {
  return (
    <>
      {favProducts.map((prod) => (
        <div className="prodcard" key={prod.id}>
          <Link href={routes.shopItem(prod.id)} className="row" style={{ gap: 12, flex: 1 }}>
            <div className="thumb hero-img" />
            <div style={{ flex: 1 }}>
              <b>{prod.name}</b>
              <div className="name-kr">{prod.nameKr}</div>
              <div className="caption muted" style={{ marginTop: 3 }}>{prod.brand} · {prod.priceRange}</div>
            </div>
          </Link>
          <FavoriteButton initial />
        </div>
      ))}
    </>
  );
}

function BlogPanel() {
  return (
    <>
      {favArticles.map((a) => (
        <div className="card tap row between" key={a.slug}>
          <Link href={routes.blogArticle(a.slug)} style={{ flex: 1 }}>
            <b>{a.title}</b>
            <div className="caption dim mono" style={{ marginTop: 4 }}>{a.date} · {a.readMin} min</div>
          </Link>
          <FavoriteButton initial />
        </div>
      ))}
    </>
  );
}

export default function FavoritesPage() {
  return (
    <>
      <TopBar title="Saved" />
      <div className="app-scroll pad stack">
        <div>
          <div className="label">Saved</div>
          <div className="h1">Your <span style={{ fontStyle: "italic", color: "var(--accent)" }}>K-beauty list.</span></div>
        </div>
        <Tabs
          panels={[
            { key: "map", label: `Map (${favPlaces.length})`, content: <MapPanel /> },
            { key: "products", label: `Products (${favProducts.length})`, content: <ProductsPanel /> },
            { key: "blog", label: `Blog (${favArticles.length})`, content: <BlogPanel /> },
          ]}
        />
      </div>
      <BottomNav active="saved" />
    </>
  );
}
