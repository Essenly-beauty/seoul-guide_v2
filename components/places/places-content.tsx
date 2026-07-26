"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { ImgPh } from "@/components/ui/img-ph";
import { ListRow } from "@/components/ui/list-row";
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
            <Chip selected={zone === "all"} className={zone === "all" ? "active" : undefined} onClick={() => { setZone("all"); setDistrict("all"); }}>All</Chip>
            {zoneChips.map((z) => (
              <Chip key={z} selected={zone === z} onClick={() => setZone(z)}>{zoneShort(z)}</Chip>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="label">District</div>
          <div className="chiprow" role="tablist">
            <Chip selected={district === "all"} onClick={() => setDistrict("all")}>All</Chip>
            {districtOptions.map((d) => (
              <Chip key={d} selected={district === d} onClick={() => setDistrict(d)}>{d}</Chip>
            ))}
          </div>
          <div className="label">Detail category</div>
          <div className="chiprow">
            {DETAIL_CATEGORIES.map((dc) => (
              <Chip key={dc.key} soft selected={detail === dc.key} onClick={() => setDetail(dc.key)}>{dc.label}</Chip>
            ))}
          </div>
        </>
      )}

      <div className="label">Price</div>
      <div className="chipwrap">
        <Chip soft selected={price === "all"} onClick={() => setPrice("all")}>All</Chip>
        {PRICE_OPTIONS.map((pr) => (
          <Chip key={pr} soft mono selected={price === pr} onClick={() => setPrice(pr)}>{pr}</Chip>
        ))}
      </div>

      <div className="countline">{filtered.length} result{filtered.length === 1 ? "" : "s"}</div>

      {filtered.length === 0 ? (
        <EmptyState>No matches yet. Try different filters.</EmptyState>
      ) : (
        filtered.map((p) => (
          <ListRow
            key={p.id}
            href={routes.place(p.id)}
            media={<ImgPh className="thumb56" />}
            titleAccessory={<CategoryBadge type={p.type} size={16} />}
            title={p.name}
            caption={`${TYPE_LABEL[p.type]} · ${placeDistrict(p)} · ${p.priceRange}`}
            meta={(
              <>
                <RatingLine rating={p.rating} plain />
                {p.badge && <Badge tone={p.badge.cls}>{p.badge.text}</Badge>}
              </>
            )}
            trailing={<FavoriteButton kind="place" id={p.id} variant="soft" size="xs" />}
          />
        ))
      )}

      <KitCta href={routes.kitSurvey} title="Get a free Essenly hair kit" subtitle="Pair your visit with our curated hair pack." />
    </>
  );
}
