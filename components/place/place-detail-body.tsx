import type { ReactNode } from "react";
import { ActionButton } from "@/components/ui/action-button";
import { DirectionsLauncher } from "@/components/directions/directions-sheet";
import { Icon } from "@/components/icon";
import { KitCta } from "@/components/cards";
import { routes } from "@/lib/routes";
import { TYPE_LABEL, TYPE_ICON, zoneShort, type Place } from "@/lib/data";

const SERVICES = [
  { name: "Signature Cut + Color", meta: "90 min · K-pop styles", price: "₩220,000" },
  { name: "Premium Treatment", meta: "60 min · damage repair", price: "₩140,000" },
  { name: "Express Cut", meta: "45 min", price: "₩80,000" },
];

const REVIEWS = [
  { a: "S", who: "Sarah", meta: "· United States · Apr 18", stars: "★★★★★", text: "Nailed my reference photo on the first try. English was good enough to walk through every step." },
  { a: "M", who: "Mei", meta: "· Singapore · Apr 11", stars: "★★★★☆", text: "Pricey but worth it. Booking via Essenly was smoother than calling — deposit confirmed everything." },
  { a: "A", who: "Aiko", meta: "· Japan · Apr 5", stars: "★★★★★", text: "아주 친절했어요. 일본어 메뉴는 없지만 직원이 번역앱으로 응대." },
];

export function isBookable(place: Place): boolean {
  return place.type === "salon" || place.type === "spa" || place.type === "headspa" || place.type === "clinic";
}

/** Shared place-detail content: hero through KitCta. Renders in the /place page
    and inside the map drawer. Header chrome and the book bar stay with callers. */
export function PlaceDetailBody({ place, heroOverlay }: { place: Place; heroOverlay?: ReactNode }) {
  const bookable = isBookable(place);
  const zoneLabel = zoneShort(place.zone);

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
          <span className="label">{TYPE_LABEL[place.type]} · {zoneLabel}</span>
          <h1 className="h1" style={{ marginTop: 2 }}>{place.name}</h1>
          <div className="row" style={{ gap: 10, marginTop: 4 }}>
            <span className="muted mono" style={{ fontSize: 13 }}>{place.nameKr}</span>
          </div>
        </div>

        <ActionButton className="taxicard" copy={`${place.nameKr}, ${place.address}`}>
          <span className="ic"><Icon name="car" size="sm" /></span>
          <div><b>Show to taxi driver</b><div className="caption muted">Tap to copy Korean name + address.</div></div>
        </ActionButton>

        <div className="chiprow">
          <span className="chip mono">{place.priceRange}</span>
          <span className="chip mono">{zoneLabel}</span>
          {place.nearestStation && place.nearestStation !== zoneLabel && (
            <span className="chip mono">{place.nearestStation} Stn.</span>
          )}
        </div>

        {place.rating && (
          <div className="row" style={{ gap: 10 }}>
            <span className="rating">★ {place.rating}</span>
            <span className="small muted">{place.ratingCount} Essenly reviews</span>
          </div>
        )}

        <div className="chipwrap">
          {place.tags.map((t, i) => (
            <span key={t} className={"chip" + (i === 0 ? " soft" : "")} aria-pressed={i === 0 ? "true" : undefined}>{t}</span>
          ))}
        </div>

        {place.type === "clinic" && (
          <div className="banner warning">
            <Icon name="cross" size="sm" />
            <span>Medical procedures require a consultation before booking. Essenly does not provide medical advice.</span>
          </div>
        )}

        <ActionButton className="btn ghost" toast="Opening Google Reviews…">
          <Icon name="check" size="sm" style={{ color: "var(--warning)" }} /> View Reviews on Google <Icon name="ext" size="xs" />
        </ActionButton>

        <DirectionsLauncher
          className="btn"
          place={{ name: place.name, nameKr: place.nameKr, address: place.address, lat: place.lat, lng: place.lng }}
        />

        <ActionButton className="taxicard" toast="Opening Instagram…">
          <span className="ic"><Icon name="ig" size="sm" /></span>
          <div><b>See on Instagram</b><div className="caption muted">Latest looks from {place.name}</div></div>
        </ActionButton>

        {bookable && (
          <div>
            <h2 className="h2">Services</h2>
            {SERVICES.map((s) => (
              <div className="svc" key={s.name}>
                <div><b>{s.name}</b><div className="caption muted">{s.meta}</div></div>
                <span className="price">{s.price}</span>
              </div>
            ))}
          </div>
        )}

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

        <KitCta href={routes.kitSurvey} title="Get a free Essenly hair kit" subtitle="Pair your visit with our curated hair pack." />
      </div>
    </>
  );
}
