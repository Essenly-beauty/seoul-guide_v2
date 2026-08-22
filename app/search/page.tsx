"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { IconButton } from "@/components/ui/icon-button";
import { SearchField } from "@/components/ui/search-field";
import { ImgPh } from "@/components/ui/img-ph";
import { BackButton } from "@/components/ui/back-button";
import { CategoryBadge } from "@/components/category/category-badge";
import { RatingLine } from "@/components/ui/rating-line";
import { useLocation } from "@/components/map/use-location";
import { routes } from "@/lib/routes";
import { matchRange, rankPlaces, searchAll, type RankedPlace } from "@/lib/search";
import { MAP_CATEGORIES, PLACES, TYPE_LABEL, ZONES, zoneShort, type Place, type PlaceType, type ZoneKey } from "@/lib/data";
import { GANGNAM_STATION, formatDistance, haversineKm } from "@/lib/geo";
import { LINE_META, lineTextColor, placesNearStation, stationDisplayName, type SubwayStation } from "@/lib/subway";

// ── Recent searches (spec v2 §4.3-2) — localStorage, max 10, most-recent first ──

const RECENT_KEY = "essenly.recentSearches";
const RECENT_MAX = 10;

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((t): t is string => typeof t === "string").slice(0, RECENT_MAX)
      : [];
  } catch {
    return [];
  }
}

function storeRecent(terms: string[]) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(terms));
  } catch {
    /* storage full / blocked — recents just won't persist */
  }
}

/** Wraps the first `query` occurrence in <b> (spec §4.4 match bolding). */
function Highlight({ text, query }: { text: string; query: string }) {
  const range = matchRange(text, query);
  if (!range) return <>{text}</>;
  const [start, end] = range;
  return (
    <>
      {text.slice(0, start)}
      <b>{text.slice(start, end)}</b>
      {text.slice(end)}
    </>
  );
}

/** Unstyled button that lays out like a row body (keeps ✕/↗ as separate siblings). */
const rowBtn: CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0,
  minHeight: 44,
  background: "none", border: "none", padding: 0, cursor: "pointer",
  font: "inherit", color: "inherit", textAlign: "left",
};

/** S-2 result row: [badge 17] name(match bold) · type / ★ · distance · address [↗ fill]. */
/** Station result — line badges, both names, and how many places sit inside the
    default 500 m browse radius, so the row answers "is this worth a trip?"
    before the tap. Opens the map in subway mode focused on that station. */
function StationRow({ station, onOpen }: { station: SubwayStation; onOpen: () => void }) {
  const nearby = useMemo(() => placesNearStation(PLACES, station.id, 0.5).length, [station.id]);
  return (
    <Link className="listrow v2" href={routes.subwayStation(station.id)} onClick={onOpen}>
      <span className="row" style={{ gap: 4, flex: "none" }}>
        {station.lines.slice(0, 3).map((line) => {
          const color = LINE_META[line]?.color ?? "var(--dim)";
          return (
            <span
              key={line}
              className="linebadge"
              style={{ background: color, color: lineTextColor(color) }}
              title={LINE_META[line]?.label ?? line}
            >
              {LINE_META[line]?.shortLabel ?? line}
            </span>
          );
        })}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <b className="t-label-md" style={{ fontSize: 14, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {stationDisplayName(station)}
        </b>
        <div className="t-caption">
          {station.nameKr}
          {nearby > 0 && <> · {nearby} nearby</>}
        </div>
      </div>
      <Icon name="chev" size="sm" style={{ color: "var(--dim)" }} />
    </Link>
  );
}

function PlaceRow({ r, query, onOpen, onFill }: {
  r: RankedPlace;
  query: string;
  onOpen: () => void;
  onFill: () => void;
}) {
  const p = r.place;
  // Flat list row — divider-only, no card box (Saved/Ranking row language).
  return (
    <div className="listrow v2">
      <button style={rowBtn} onClick={onOpen}>
        <CategoryBadge type={p.type} size={17} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14.5 }}>
            <Highlight text={p.name} query={query} />
            <span className="muted" style={{ fontWeight: 500 }}> · {TYPE_LABEL[p.type]}</span>
          </div>
          <div className="t-caption" style={{ marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {p.rating !== undefined && <><RatingLine rating={p.rating} count={p.ratingCount} plain />{" · "}</>}
            {formatDistance(r.km)} · {p.address}
          </div>
        </div>
      </button>
      <IconButton
        name="ext"
        label={`Fill search with ${p.name}`}
        variant="soft"
        iconSize="xs"
        onClick={(e) => { e.stopPropagation(); onFill(); }}
      />
    </div>
  );
}

function SearchPageInner() {
  const router = useRouter();
  const { loc } = useLocation();
  const [raw, setRaw] = useState("");
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const t = setTimeout(() => setQuery(raw), 150);
    return () => clearTimeout(t);
  }, [raw]);
  useEffect(() => { setRecent(loadRecent()); }, []); // lazy init — avoids SSR/hydration mismatch

  const saveRecent = (term: string) => {
    const t = term.trim();
    if (!t) return;
    const next = [t, ...recent.filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(0, RECENT_MAX);
    setRecent(next);
    storeRecent(next);
  };
  const removeRecent = (term: string) => {
    const next = recent.filter((r) => r !== term);
    setRecent(next);
    storeRecent(next);
  };
  const clearRecent = () => { setRecent([]); storeRecent([]); };

  /** Shared result-click handler: persist the term, return to the map with the sheet open. */
  const openPlace = (p: Place) => {
    saveRecent(raw);
    router.push(`${routes.map}?place=${p.id}`);
  };
  const fillQuery = (name: string) => {
    setRaw(name);
    requestAnimationFrame(() => inputRef.current?.focus());
  };
  const clearSearch = () => {
    setRaw("");
    setQuery("");
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  // ── S-1 · Trending near you (nearest place's zone; Seoul fallback) ──
  const trendingZone: ZoneKey | null = useMemo(() => {
    if (!loc) return null;
    let best: Place | null = null;
    let bestKm = Infinity;
    for (const p of PLACES) {
      const km = haversineKm(loc, { lat: p.lat, lng: p.lng });
      if (km < bestKm) { bestKm = km; best = p; }
    }
    return best?.zone ?? null;
  }, [loc]);

  const trending = useMemo(() => {
    const pool = trendingZone ? PLACES.filter((p) => p.zone === trendingZone) : PLACES;
    return [...pool]
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.ratingCount ?? 0) - (a.ratingCount ?? 0))
      .slice(0, 3);
  }, [trendingZone]);

  // ── S-2 · Relevance-ranked places + products/articles ──
  const origin = loc ?? GANGNAM_STATION;
  const ranked = useMemo(() => rankPlaces(query, origin), [query, origin]);
  const extra = useMemo(() => searchAll(query), [query]);
  const noResults = query && ranked.results.length === 0 && extra.products.length === 0 && extra.articles.length === 0;

  return (
    <>
      <div className="topbar" style={{ gap: 8 }}>
        <BackButton fallback={routes.map} />
        <SearchField
          inputRef={inputRef}
          style={{ flex: 1 }}
          placeholder="Salons, products, districts… (EN or 한글)"
          label="Search MYSEOULDROP"
          value={raw}
          onChange={setRaw}
          onClear={clearSearch}
        />
      </div>

      <main className="app-scroll pad stack">
        {!query && (
          <>
            {recent.length > 0 && (
              <section className="stack sm">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="label">Recent</span>
                  <button
                    type="button"
                    className="caption muted section-action"
                    onClick={clearRecent}
                  >
                    Clear
                  </button>
                </div>
                {recent.map((term) => (
                  <div key={term} className="row" style={{ gap: 10, padding: "4px 0" }}>
                    <button type="button" style={rowBtn} onClick={() => fillQuery(term)}>
                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{term}</span>
                    </button>
                    <IconButton name="x" label={`Remove ${term}`} iconSize="xs" onClick={() => removeRecent(term)} />
                  </div>
                ))}
              </section>
            )}

            <div className="label" style={{ marginTop: recent.length ? 8 : 0 }}>
              {trendingZone ? <>Trending near you · {zoneShort(trendingZone)}</> : <>Trending in Seoul</>}
            </div>
            <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {trending.map((p, i) => (
                <li key={p.id}>
                  <button className="listrow v2" style={{ cursor: "pointer", font: "inherit", color: "inherit" }} onClick={() => openPlace(p)}>
                    <span className="mono num" style={{ width: 24, fontSize: 15, fontWeight: 700, flex: "none", textAlign: "center", color: i === 0 ? "var(--accent)" : "var(--dim)" }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                      <div style={{ fontWeight: 600, fontSize: 14.5 }}>{p.name}</div>
                      <div className="t-caption" style={{ marginTop: 2 }}>
                        <RatingLine rating={p.rating} count={p.ratingCount} plain />
                      </div>
                    </div>
                    <CategoryBadge type={p.type} size={17} />
                  </button>
                </li>
              ))}
            </ol>

            <div className="label" style={{ marginTop: 8 }}>Browse by category</div>
            <div className="chipwrap">
              {MAP_CATEGORIES.filter((c) => c.key !== "all").map((c) => (
                <Chip key={c.key} onClick={() => router.push(`${routes.map}?cat=${c.key}`)}>
                  <CategoryBadge type={c.key as PlaceType} size={16} />
                  {c.label}
                </Chip>
              ))}
            </div>

            <div className="label" style={{ marginTop: 8 }}>Popular areas</div>
            <div className="chipwrap">
              {ZONES.map((z) => (
                <Chip key={z.key} onClick={() => router.push(`${routes.map}?zone=${z.key}`)}>
                  {zoneShort(z.key)}
                </Chip>
              ))}
            </div>
          </>
        )}

        {noResults && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <p className="muted">No matches for &quot;{query}&quot;.</p>
            <p className="caption dim" style={{ marginTop: 6 }}>Try a shorter word &mdash; &quot;spa&quot;, a district like &quot;Hongdae&quot;, or the Korean name.</p>
            <Button variant="secondary" style={{ marginTop: 16 }} href={routes.map}>Browse all places</Button>
          </div>
        )}

        {extra.stations.length > 0 && (
          <section className="stack sm">
            <div className="label">Stations · {extra.stations.length}</div>
            {extra.stations.map((st) => (
              <StationRow key={st.id} station={st} onOpen={() => saveRecent(raw)} />
            ))}
          </section>
        )}

        {ranked.results.length > 0 && (
          <section className="stack sm">
            <div className="label">Places · {ranked.results.length}</div>
            {ranked.results.map((r) => (
              <PlaceRow key={r.place.id} r={r} query={query} onOpen={() => openPlace(r.place)} onFill={() => fillQuery(r.place.name)} />
            ))}
            {ranked.similar.length > 0 && (
              <>
                <div className="label" style={{ marginTop: 8 }}>Similar nearby</div>
                {ranked.similar.map((r) => (
                  <PlaceRow key={r.place.id} r={r} query={query} onOpen={() => openPlace(r.place)} onFill={() => fillQuery(r.place.name)} />
                ))}
              </>
            )}
          </section>
        )}

        {extra.products.length > 0 && (
          <section>
            <div className="label">Products · {extra.products.length}</div>
            {extra.products.map((p) => (
              <Link className="listrow v2" key={p.id} href={routes.shopItem(p.id)}>
                <ImgPh className="thumb56" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b className="t-label-md" style={{ fontSize: 14, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</b>
                  <div className="t-caption">{p.brand}</div>
                </div>
                <Icon name="chev" size="sm" style={{ color: "var(--dim)" }} />
              </Link>
            ))}
          </section>
        )}

        {extra.articles.length > 0 && (
          <section>
            <div className="label">Blog · {extra.articles.length}</div>
            {extra.articles.map((a) => (
              <Link className="listrow v2" key={a.slug} href={routes.blogArticle(a.slug)}>
                <span className="ic"><Icon name="book" size="sm" /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b className="t-label-md" style={{ fontSize: 14, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</b>
                  <div className="t-caption num">{a.date} · {a.readMin} min read</div>
                </div>
                <Icon name="chev" size="sm" style={{ color: "var(--dim)" }} />
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
