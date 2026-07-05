"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { KitCta } from "@/components/cards";
import { routes } from "@/lib/routes";
import {
  type Place, type PlaceType, CATEGORY_ZONES, DETAIL_CATEGORIES, PRICE_OPTIONS,
  TYPE_LABEL, TYPE_ICON, zoneShort, districtOf,
} from "@/lib/data";

export function PlacesContent({ category, places }: { category: string; places: Place[] }) {
  const isSpotHub = category === "spot";
  const [zone, setZone] = useState("all");
  const [district, setDistrict] = useState("all");
  const [price, setPrice] = useState("all");
  const [detail, setDetail] = useState("all");

  const placeDistrict = (p: Place) => p.district ?? districtOf(p.zone);

  // Dynamic district options for the hub, count-sorted.
  const districtOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of places) {
      const d = placeDistrict(p);
      counts.set(d, (counts.get(d) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([d]) => d);
  }, [places]);

  const zoneChips = !isSpotHub ? (CATEGORY_ZONES[category as Exclude<PlaceType, "spots"> | "spots"] ?? []) : [];

  const filtered = useMemo(() => {
    return places.filter((p) => {
      if (!isSpotHub && zone !== "all" && p.zone !== zone) return false;
      if (isSpotHub && district !== "all" && placeDistrict(p) !== district) return false;
      if (price !== "all" && p.priceRange !== price) return false;
      if (isSpotHub && detail !== "all") {
        if (detail === "spa") { if (p.type !== "spa" && p.type !== "headspa") return false; }
        else if (detail === "nail") {
          const hay = (p.name + " " + p.tags.join(" ")).toLowerCase();
          if (!hay.includes("nail")) return false;
        } else if (p.type !== detail) return false;
      }
      return true;
    });
  }, [places, isSpotHub, zone, district, price, detail]);

  return (
    <>
      {/* Zone (specific categories) or District (hub) */}
      {!isSpotHub ? (
        <>
          <div className="label">Zone</div>
          <div className="chiprow" role="tablist">
            <button className={"chip" + (zone === "all" ? " active selected" : "")} aria-pressed={zone === "all"} onClick={() => { setZone("all"); setDistrict("all"); }}>All</button>
            {zoneChips.map((z) => (
              <button key={z} className={"chip" + (zone === z ? " selected" : "")} aria-pressed={zone === z} onClick={() => setZone(z)}>{zoneShort(z)}</button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="label">District</div>
          <div className="chiprow" role="tablist">
            <button className={"chip" + (district === "all" ? " selected" : "")} aria-pressed={district === "all"} onClick={() => setDistrict("all")}>All</button>
            {districtOptions.map((d) => (
              <button key={d} className={"chip" + (district === d ? " selected" : "")} aria-pressed={district === d} onClick={() => setDistrict(d)}>{d}</button>
            ))}
          </div>
          <div className="label">Detail category</div>
          <div className="chiprow">
            {DETAIL_CATEGORIES.map((dc) => (
              <button key={dc.key} className={"chip soft" + (detail === dc.key ? " selected" : "")} aria-pressed={detail === dc.key} onClick={() => setDetail(dc.key)}>{dc.label}</button>
            ))}
          </div>
        </>
      )}

      <div className="label">Price</div>
      <div className="chipwrap">
        <button className={"chip soft" + (price === "all" ? " selected" : "")} aria-pressed={price === "all"} onClick={() => setPrice("all")}>All</button>
        {PRICE_OPTIONS.map((pr) => (
          <button key={pr} className={"chip soft mono" + (price === pr ? " selected" : "")} aria-pressed={price === pr} onClick={() => setPrice(pr)}>{pr}</button>
        ))}
      </div>

      <div className="countline">{filtered.length} result{filtered.length === 1 ? "" : "s"}</div>

      {filtered.length === 0 ? (
        <div className="empty"><p>No matches yet. Try different filters.</p></div>
      ) : (
        filtered.map((p) => (
          <div className="placecard" key={p.id} style={{ position: "relative" }}>
            <Link href={routes.place(p.id)} className="row" style={{ gap: 12, flex: 1, alignItems: "flex-start" }}>
              <div className="thumb hero-img" style={{ display: "grid", placeItems: "center" }}>
                <Icon name={TYPE_ICON[p.type]} style={{ color: "var(--accent)" }} />
              </div>
              <div style={{ flex: 1 }}>
                <span className="label">{TYPE_LABEL[p.type]} · {placeDistrict(p)}</span>
                <h3 style={{ fontSize: 17, margin: "2px 0" }}>{p.name}</h3>
                <div className="name-kr">{p.nameKr}</div>
                <div className="meta">
                  {p.rating && <span className="stars">★ {p.rating}</span>}
                  <span className="chip mono" style={{ padding: "3px 8px" }}>{p.priceRange}</span>
                  {p.badge && <span className={"badge " + p.badge.cls}>{p.badge.text}</span>}
                </div>
              </div>
            </Link>
            <div style={{ position: "absolute", top: 10, right: 10 }}><FavoriteButton /></div>
          </div>
        ))
      )}

      {!isSpotHub && category === "spa" && (
        <Link className="card accent" href={routes.placesCategory("headspa")}>
          <b className="serif h3">Looking for a head spa?</b>
          <p className="small muted" style={{ marginTop: 4 }}>Curated head spas with scalp therapy menus →</p>
        </Link>
      )}

      <KitCta href={routes.kitSurvey} title="Get a free Essenly hair kit" subtitle="Pair your visit with our curated hair pack." />
    </>
  );
}
