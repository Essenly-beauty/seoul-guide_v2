"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { ImgPh } from "@/components/ui/img-ph";
import { RatingLine } from "@/components/ui/rating-line";
import { CategoryBadge } from "@/components/category/category-badge";
import { KitCta } from "@/components/cards";
import { routes } from "@/lib/routes";
import {
  type Place, type PlaceType, CATEGORY_ZONES, DETAIL_CATEGORIES, PRICE_OPTIONS,
  TYPE_LABEL, zoneShort, districtOf,
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

  const zoneChips = !isSpotHub ? (CATEGORY_ZONES[category as PlaceType] ?? []) : [];

  const filtered = useMemo(() => {
    return places.filter((p) => {
      if (!isSpotHub && zone !== "all" && p.zone !== zone) return false;
      if (isSpotHub && district !== "all" && placeDistrict(p) !== district) return false;
      if (price !== "all" && p.priceRange !== price) return false;
      if (isSpotHub && detail !== "all" && p.type !== detail) return false;
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
          <div className="listrow v2" key={p.id}>
            <Link href={routes.place(p.id)} className="row" style={{ gap: 12, flex: 1, minWidth: 0 }}>
              <ImgPh className="thumb56" />
              <div className="stack" style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <div className="row" style={{ gap: 6 }}>
                  <CategoryBadge type={p.type} size={16} />
                  <b className="t-label-md" style={{ fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</b>
                </div>
                <div className="t-caption" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {TYPE_LABEL[p.type]} · {placeDistrict(p)} · {p.priceRange}
                </div>
                <div className="row t-caption" style={{ gap: 6 }}>
                  <RatingLine rating={p.rating} plain />
                  {p.badge && <span className={"badge " + p.badge.cls}>{p.badge.text}</span>}
                </div>
              </div>
            </Link>
            <FavoriteButton kind="place" id={p.id} variant="soft" size="xs" />
          </div>
        ))
      )}

      <KitCta href={routes.kitSurvey} title="Get a free Essenly hair kit" subtitle="Pair your visit with our curated hair pack." />
    </>
  );
}
