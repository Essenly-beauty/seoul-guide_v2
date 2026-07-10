"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/icon";
import { BackButton } from "@/components/ui/back-button";
import { routes } from "@/lib/routes";
import { searchAll } from "@/lib/search";
import { TYPE_LABEL, zoneShort, MAP_CATEGORIES, PLACES, type PlaceType } from "@/lib/data";
import { GANGNAM_STATION, formatDistance, haversineKm } from "@/lib/geo";

const POPULAR = ["head spa", "Juno Hair", "sunscreen", "Hongdae", "호수"];

function SearchPageInner() {
  const [raw, setRaw] = useState("");
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const t = setTimeout(() => setQuery(raw), 150);
    return () => clearTimeout(t);
  }, [raw]);

  const r = useMemo(() => searchAll(query), [query]);

  const catParam = useSearchParams().get("cat");
  const cat: "all" | PlaceType = MAP_CATEGORIES.some((c) => c.key === catParam) ? (catParam as "all" | PlaceType) : "all";
  const topPicks = useMemo(() => {
    const list = cat === "all" ? PLACES : PLACES.filter((p) => p.type === cat);
    return [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 5);
  }, [cat]);

  return (
    <>
      <div className="topbar" style={{ gap: 8 }}>
        <BackButton fallback={routes.map} />
        <div className="row" style={{ flex: 1, gap: 8, background: "var(--surface-hover)", borderRadius: "var(--r-full)", padding: "10px 14px" }}>
          <Icon name="search" size="sm" style={{ color: "var(--muted)" }} aria-hidden="true" />
          <input
            ref={inputRef}
            className="small"
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 16 }}
            placeholder="Salons, products, districts… (EN or 한글)"
            aria-label="Search Essenly"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
          />
          {raw && (
            <button className="iconbtn" style={{ width: 28, height: 28 }} aria-label="Clear search" onClick={() => setRaw("")}>
              <Icon name="x" size="xs" />
            </button>
          )}
        </div>
      </div>

      <main className="app-scroll pad stack">
        {!query && (
          <>
            <div className="label">Popular right now</div>
            <div className="chipwrap">
              {POPULAR.map((q) => (
                <button key={q} className="chip" onClick={() => setRaw(q)}>{q}</button>
              ))}
            </div>
            <div className="label" style={{ marginTop: 8 }}>
              Top picks · {cat === "all" ? "all categories" : TYPE_LABEL[cat]}
            </div>
            <ol className="ranklist">
              {topPicks.map((p, i) => (
                <li key={p.id}>
                  <Link className="rankrow" href={routes.place(p.id)}>
                    <span className={"rankbadge" + (i < 3 ? " top" : "") + (i === 0 ? " first" : "")}>{String(i + 1).padStart(2, "0")}</span>
                    <div style={{ flex: 1 }}>
                      <span className="label">{TYPE_LABEL[p.type]} · {zoneShort(p.zone)}</span>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      <div className="caption muted">
                        {p.rating && <span className="stars">★ {p.rating}</span>}
                        {" · "}{formatDistance(haversineKm(GANGNAM_STATION, { lat: p.lat, lng: p.lng }))} from Gangnam Stn.
                      </div>
                    </div>
                    <span className="chip mono" style={{ alignSelf: "center" }}>{p.priceRange}</span>
                  </Link>
                </li>
              ))}
            </ol>

            <div className="label" style={{ marginTop: 8 }}>Browse instead</div>
            <div className="row" style={{ gap: 8 }}>
              <Link className="btn sm outline" href={routes.map}>Map</Link>
              <Link className="btn sm outline" href={routes.ranking}>Ranking</Link>
              <Link className="btn sm outline" href={routes.blog}>Blog</Link>
            </div>
          </>
        )}

        {query && r.total === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <p className="muted">No matches for &quot;{query}&quot;.</p>
            <p className="caption dim" style={{ marginTop: 6 }}>Try a shorter word &mdash; &quot;spa&quot;, a district like &quot;Hongdae&quot;, or the Korean name.</p>
            <Link className="btn ghost" style={{ marginTop: 16 }} href={routes.map}>Browse all places</Link>
          </div>
        )}

        {r.places.length > 0 && (
          <section>
            <div className="label">Places · {r.places.length}</div>
            {r.places.map((p) => (
              <Link className="placecard" key={p.id} href={routes.place(p.id)}>
                <div className="thumb hero-img" style={{ display: "grid", placeItems: "center" }}>
                  <Icon name="pin" style={{ color: "var(--accent)" }} aria-hidden="true" />
                </div>
                <div style={{ flex: 1 }}>
                  <span className="label">{TYPE_LABEL[p.type]} · {zoneShort(p.zone)}</span>
                  <h3 style={{ fontSize: 16, margin: "2px 0" }}>{p.name}</h3>
                  <div className="caption muted">{p.nameKr}</div>
                </div>
              </Link>
            ))}
          </section>
        )}

        {r.products.length > 0 && (
          <section>
            <div className="label">Products · {r.products.length}</div>
            {r.products.map((p) => (
              <Link className="prodcard" key={p.id} href={routes.shopItem(p.id)}>
                <div className="thumb hero-img" />
                <div style={{ flex: 1 }}>
                  <span className="caption muted">{p.brand}</span>
                  <b style={{ display: "block" }}>{p.name}</b>
                </div>
              </Link>
            ))}
          </section>
        )}

        {r.articles.length > 0 && (
          <section>
            <div className="label">Blog · {r.articles.length}</div>
            {r.articles.map((a) => (
              <Link className="card tap" key={a.slug} href={routes.blogArticle(a.slug)}>
                <b>{a.title}</b>
                <div className="caption dim mono" style={{ marginTop: 4 }}>{a.date} · {a.readMin} min</div>
              </Link>
            ))}
          </section>
        )}
      </main>
    </>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchPageInner />
    </Suspense>
  );
}
