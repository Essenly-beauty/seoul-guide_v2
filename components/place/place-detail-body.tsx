"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ActionButton } from "@/components/ui/action-button";
import { Tabs } from "@/components/ui/tabs";
import { Icon } from "@/components/icon";
import { routes } from "@/lib/routes";
import { PLACES, TYPE_LABEL, TYPE_ICON, zoneShort, type Place } from "@/lib/data";
import { statusLabel } from "@/lib/places";

const REVIEWS = [
  { a: "S", who: "Sarah", meta: "· United States · Apr 18", stars: "★★★★★", text: "Nailed my reference photo on the first try. English was good enough to walk through every step." },
  { a: "M", who: "Mei", meta: "· Singapore · Apr 11", stars: "★★★★☆", text: "Pricey but worth it. Booking via Essenly was smoother than calling — deposit confirmed everything." },
  { a: "A", who: "Aiko", meta: "· Japan · Apr 5", stars: "★★★★★", text: "아주 친절했어요. 일본어 메뉴는 없지만 직원이 번역앱으로 응대." },
];
const REVIEW_KEYWORDS = ["English-friendly", "Gentle", "Clean", "On time"];

function InfoPanel({ place }: { place: Place }) {
  const similar = PLACES.filter((p) => p.type === place.type && p.id !== place.id).slice(0, 2);
  return (
    <>
      <div className="hero-img" style={{ aspectRatio: "16 / 8", display: "grid", placeItems: "center" }} aria-label="Mini map">
        <Icon name="pin" style={{ color: "var(--accent)" }} />
      </div>
      <ActionButton className="taxicard" copy={`${place.nameKr}, ${place.address}`}>
        <span className="ic"><Icon name="car" size="sm" /></span>
        <div><b>Show to taxi driver</b><div className="caption muted">{place.nameKr} · {place.address}</div></div>
      </ActionButton>
      <div className="card" style={{ padding: "4px 16px" }}>
        {place.stationWalk && (
          <div className="listrow">
            <span className="ic"><Icon name="pin" size="sm" /></span>
            <div><b>{place.stationWalk.station} Stn.{place.stationWalk.exit ? ` Exit ${place.stationWalk.exit}` : ""}</b>
              <div className="caption muted">{place.stationWalk.minutes} min walk</div></div>
          </div>
        )}
        {place.hours && (
          <div className="listrow">
            <span className="ic"><Icon name="cal" size="sm" /></span>
            <div><b>{statusLabel(place.hours)}</b><div className="caption muted">{place.hours.open} – {place.hours.close} daily</div></div>
          </div>
        )}
        <div className="listrow">
          <span className="ic"><Icon name="check" size="sm" /></span>
          <div><b>{place.englishOk ? "English OK" : "Korean only"}</b><div className="caption muted">{place.englishOk ? "Staff can assist in English" : "Use a translation app or the taxi card"}</div></div>
        </div>
        <ActionButton className="listrow" toast="Opening Instagram…">
          <span className="ic"><Icon name="ig" size="sm" /></span>
          <div><b>See on Instagram</b><div className="caption muted">Latest looks from {place.name}</div></div>
        </ActionButton>
      </div>
      {similar.length > 0 && (
        <div>
          <h2 className="h2">Similar shops nearby</h2>
          {similar.map((p) => (
            <Link key={p.id} className="placecard" href={routes.place(p.id)}>
              <div className="thumb hero-img" style={{ display: "grid", placeItems: "center" }}>
                <Icon name={TYPE_ICON[p.type]} style={{ color: "var(--accent)" }} />
              </div>
              <div style={{ flex: 1 }}>
                <span className="label">{TYPE_LABEL[p.type]} · {zoneShort(p.zone)}</span>
                <h3 style={{ fontSize: 16, margin: "2px 0" }}>{p.name}</h3>
                <div className="caption muted">{p.rating ? `★ ${p.rating} · ` : ""}{p.priceRange}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function MenuPanel({ place }: { place: Place }) {
  if (!place.services?.length) {
    return <div className="empty"><p>Walk-in retail — no service menu.</p></div>;
  }
  return (
    <>
      {place.priceConfirmedDaysAgo !== undefined && (
        <div className="caption muted">
          <Icon name="check" size="xs" style={{ color: "var(--accent)" }} /> Prices confirmed {place.priceConfirmedDaysAgo === 0 ? "today" : `${place.priceConfirmedDaysAgo} day${place.priceConfirmedDaysAgo === 1 ? "" : "s"} ago`}
        </div>
      )}
      <div>
        {place.services.map((s) => (
          <div className="svc" key={s.name}>
            <div>
              <b>{s.name}</b>
              <div className="caption muted">
                {s.nameKr && <span>{s.nameKr} · </span>}
                {s.durationMin && <span>{s.durationMin} min</span>}
              </div>
            </div>
            <span className="price">{s.price}</span>
          </div>
        ))}
      </div>
      {place.type === "skin_clinic" && (
        <div className="banner warning">
          <Icon name="cross" size="sm" />
          <span>Medical procedures require a consultation before booking. Essenly does not provide medical advice.</span>
        </div>
      )}
    </>
  );
}

function ReviewsPanel({ place }: { place: Place }) {
  return (
    <>
      <div className="row" style={{ gap: 8, overflowX: "auto" }} aria-label="Review photos">
        {[0, 1, 2, 3].map((i) => <div key={i} className="thumb hero-img" style={{ flex: "none", width: 84, height: 84 }} />)}
      </div>
      <div className="chipwrap">
        {REVIEW_KEYWORDS.map((k, i) => <span key={k} className={"chip" + (i === 0 ? " soft" : "")}>{k}</span>)}
      </div>
      <div>
        <div className="row between"><h2 className="h2">Reviews</h2><span className="caption muted">Latest 3 of {place.ratingCount ?? 0}</span></div>
        {REVIEWS.map((r) => (
          <div className="review" key={r.who}>
            <div className="head">
              <span className="avatar">{r.a}</span>
              <div><b>{r.who}</b> <span className="caption dim">{r.meta}</span><div className="stars">{r.stars}</div></div>
            </div>
            <p className="muted small">{r.text}</p>
          </div>
        ))}
      </div>
      <Link className="btn ghost" href={routes.reviewNew}>Write a review</Link>
    </>
  );
}

/** Shared place-detail content: hero + header + Info|Menu|Reviews tabs.
    Header chrome and the CTA bar stay with callers. */
export function PlaceDetailBody({ place, heroOverlay }: { place: Place; heroOverlay?: ReactNode }) {
  return (
    <>
      <div style={{ position: "relative" }}>
        <div className="hero-img tall" style={{ borderRadius: 0, aspectRatio: "4 / 3.2" }}>
          <Icon name={TYPE_ICON[place.type]} style={{ width: 60, height: 60, color: "var(--accent)" }} />
        </div>
        {heroOverlay}
      </div>

      <div className="pad stack">
        <div>
          <span className="label">{TYPE_LABEL[place.type]} · {zoneShort(place.zone)}</span>
          <h1 className="h1" style={{ marginTop: 2 }}>{place.name}</h1>
          <div className="row" style={{ gap: 10, marginTop: 4 }}>
            <span className="muted mono" style={{ fontSize: 13 }}>{place.nameKr}</span>
          </div>
          <div className="row" style={{ gap: 10, marginTop: 6 }}>
            {place.rating && <span className="rating">★ {place.rating}</span>}
            <span className="chip mono" style={{ padding: "2px 8px" }}>{place.priceRange}</span>
            {place.hours && <span className="small muted">{statusLabel(place.hours)}</span>}
          </div>
        </div>

        <Tabs
          panels={[
            { key: "info", label: "Info", content: <InfoPanel place={place} /> },
            { key: "menu", label: "Menu", content: <MenuPanel place={place} /> },
            { key: "reviews", label: "Reviews", content: <ReviewsPanel place={place} /> },
          ]}
        />
      </div>
    </>
  );
}
