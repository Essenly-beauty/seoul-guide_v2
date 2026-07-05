"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { BackButton } from "@/components/ui/back-button";
import { routes } from "@/lib/routes";
import { searchAll } from "@/lib/search";
import { TYPE_LABEL, zoneShort } from "@/lib/data";

const POPULAR = ["head spa", "Juno Hair", "sunscreen", "Hongdae", "호수"];

export default function SearchPage() {
  const [raw, setRaw] = useState("");
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const t = setTimeout(() => setQuery(raw), 150);
    return () => clearTimeout(t);
  }, [raw]);

  const r = useMemo(() => searchAll(query), [query]);

  return (
    <>
      <div className="topbar" style={{ gap: 8 }}>
        <BackButton fallback={routes.home} />
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
            <div className="label" style={{ marginTop: 8 }}>Browse instead</div>
            <div className="row" style={{ gap: 8 }}>
              <Link className="btn sm outline" href={routes.spot}>Places</Link>
              <Link className="btn sm outline" href={routes.shop}>Shop</Link>
              <Link className="btn sm outline" href={routes.journal}>Journal</Link>
            </div>
          </>
        )}

        {query && r.total === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <p className="muted">No matches for &quot;{query}&quot;.</p>
            <p className="caption dim" style={{ marginTop: 6 }}>Try a shorter word &mdash; &quot;spa&quot;, a district like &quot;Hongdae&quot;, or the Korean name.</p>
            <Link className="btn ghost" style={{ marginTop: 16 }} href={routes.spot}>Browse all places</Link>
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
            <div className="label">Journal · {r.articles.length}</div>
            {r.articles.map((a) => (
              <Link className="card tap" key={a.slug} href={routes.journalArticle(a.slug)}>
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
