"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/ui/action-button";
import { AnchorTabs } from "@/components/ui/anchor-tabs";
import { Collapse } from "@/components/ui/collapse";
import { HScroll } from "@/components/ui/h-scroll";
import { ImgPh } from "@/components/ui/img-ph";
import { LiveBadge } from "@/components/ui/live-badge";
import { RatingBars } from "@/components/ui/rating-bars";
import { RatingLine } from "@/components/ui/rating-line";
import { SectionHeader } from "@/components/ui/section-header";
import { useToast } from "@/components/ui/toast";
import { BookingSheet } from "@/components/booking/booking-sheet";
import { ChannelSheet } from "@/components/booking/channel-sheet";
import { Icon } from "@/components/icon";
import { useLocation } from "@/components/map/use-location";
import { toggleFavorite, useFavorites } from "@/lib/favorites";
import { routes } from "@/lib/routes";
import { PLACES, TYPE_LABEL, zoneShort, type Place } from "@/lib/data";
import { GANGNAM_STATION, formatDistance, haversineKm } from "@/lib/geo";
import { isBookable, statusLabel } from "@/lib/places";

/** Anchor-tab targets (spec §4.6). Ids live on the sections below. */
const SECTIONS = [
  { id: "d-home", label: "Home" },
  { id: "d-services", label: "Services" },
  { id: "d-photos", label: "Photos" },
  { id: "d-reviews", label: "Reviews" },
  { id: "d-info", label: "Info" },
];
/** Sticky chrome height: compact bar 48 + anchor tabs ≈ 44 (§4.7). */
const STICKY_OFFSET = 96;

type Review = {
  a: string;
  who: string;
  country: string;
  date: string; // ISO — sortable
  stars: number;
  text: string;
  hasPhoto: boolean;
  helpful: number;
  verified: boolean;
  keywords: string[];
};

const REVIEWS: Review[] = [
  { a: "L", who: "Lena", country: "Germany", date: "2026-04-21", stars: 4, verified: true, helpful: 5, hasPhoto: true, keywords: ["Open late"], text: "Walked in at 9pm without a booking and they still took me. Great for jet-lagged evenings." },
  { a: "S", who: "Sarah", country: "United States", date: "2026-04-18", stars: 5, verified: true, helpful: 12, hasPhoto: true, keywords: ["English OK", "Clean facilities"], text: "Nailed my reference photo on the first try. English was good enough to walk through every step." },
  { a: "M", who: "Mei", country: "Singapore", date: "2026-04-11", stars: 4, verified: true, helpful: 8, hasPhoto: true, keywords: ["Clean facilities"], text: "Pricey but worth it. Booking via Essenly was smoother than calling — deposit confirmed everything." },
  { a: "A", who: "Aiko", country: "Japan", date: "2026-04-05", stars: 5, verified: false, helpful: 3, hasPhoto: false, keywords: ["Good for groups"], text: "아주 친절했어요. 일본어 메뉴는 없지만 직원이 번역앱으로 응대." },
  { a: "P", who: "Priya", country: "India", date: "2026-03-28", stars: 5, verified: true, helpful: 9, hasPhoto: false, keywords: ["Good for groups", "English OK"], text: "Came with three friends and they seated us all together. Staff explained aftercare in English." },
  { a: "T", who: "Tom", country: "Australia", date: "2026-03-19", stars: 3, verified: false, helpful: 2, hasPhoto: true, keywords: ["Open late", "Clean facilities"], text: "Spotless place and open till late, but I waited 20 minutes past my slot on a Friday night." },
];
const REVIEW_KEYWORDS = [
  { label: "Clean facilities", n: 41 },
  { label: "Open late", n: 27 },
  { label: "Good for groups", n: 18 },
  { label: "English OK", n: 9 },
];
/** Reviews shown before "More reviews (N)" expands the list. */
const REVIEWS_PREVIEW = 2;
/** Per-place my-rating persistence (JSON {placeId: n}). */
const RATING_KEY = "essenly.myrating";
/** Plausible 5→1 star share of ratingCount (§4.6 Reviews). */
const RATING_SHARES = [0.62, 0.24, 0.09, 0.03, 0.02];

/** Contact mock — single source for the action strip and the Info section. */
const PHONE = "+82 2-555-0134";
const PHONE_DISPLAY = "02-555-0134";
const PHONE_TEL = `tel:${PHONE.replace(/[^+\d]/g, "")}`;
const websiteFor = (id: string) => `essenly.kr/${id}`;

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-04-18" → "Apr 18" (timezone-safe, no Date parsing). */
const formatReviewDate = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d}`;
};

const starsFor = (rating?: number) => {
  const filled = Math.max(0, Math.min(5, Math.round(rating ?? 0)));
  return "★★★★★".slice(0, filled) + "☆☆☆☆☆".slice(filled);
};

const Divider = () => <hr className="sec-divider" />;

/** SectionHeader variant whose action toggles between expand/collapse labels. */
function ToggleHeader({ title, count, expanded, expandLabel, collapseLabel, onToggle }: {
  title: string;
  count?: number;
  expanded: boolean;
  expandLabel: string;
  collapseLabel: string;
  onToggle: () => void;
}) {
  return (
    <div className="row between" style={{ alignItems: "baseline" }}>
      <h2 className="h2" style={{ fontFamily: "var(--sans)", fontSize: 16, fontWeight: 700 }}>
        {title}
        {count !== undefined && <span className="muted" style={{ fontWeight: 500, fontSize: 13 }}> · {count}</span>}
      </h2>
      <button className="small muted" aria-expanded={expanded} onClick={onToggle}>
        {expanded ? collapseLabel : expandLabel}
      </button>
    </div>
  );
}

// ── §4.6 · Title block (fixed, not a tab anchor) ──────────
// Kakao-style compact header: caption / name+type / rating line / address.
// The old header chips are gone — station walk already lives in the Home info
// rows, and "English OK" is a muted token on the rating line (less pill noise).
function TitleBlock({ place, km }: { place: Place; km: number }) {
  return (
    <div>
      <span className="t-caption">{place.nameKr}</span>
      <div className="row" style={{ gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
        <h1 className="h1" style={{ fontSize: 21, letterSpacing: "-0.01em", fontFamily: "var(--sans)", fontWeight: 700 }}>{place.name}</h1>
        <span className="small muted">{TYPE_LABEL[place.type]}</span>
      </div>
      <div className="row" style={{ gap: 8, marginTop: 8 }}>
        <RatingLine rating={place.rating} count={place.ratingCount} />
        <LiveBadge hours={place.hours} />
        {place.englishOk && <span className="t-caption" style={{ flex: "none" }}>· English OK</span>}
      </div>
      <div className="row" style={{ gap: 8, marginTop: 6 }}>
        <span className="t-caption" style={{ minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {formatDistance(km)} · {place.address}
        </span>
        <ActionButton className="t-caption" style={{ color: "var(--accent)", fontWeight: 600, flex: "none" }} copy={place.address} aria-label="Copy address">
          Copy
        </ActionButton>
      </div>
    </div>
  );
}

// ── Kakao-style action strip: [Call][Save][Share][Website] ─
// Sits between the title header and the anchor tabs (user decision 2026-07-25:
// this strip owns call/save/share/website; the bottom CTA bar is route-only).
// Save wires straight into the favorites store so hearts stay in sync with
// the Saved tab without touching FavoriteButton.
function PlaceActions({ place }: { place: Place }) {
  const favs = useFavorites();
  const { toast, share } = useToast();
  const saved = favs.place.includes(place.id);
  return (
    <div className="place-actions">
      <a href={PHONE_TEL}>
        <Icon name="call" />
        <span className="lbl">Call</span>
      </a>
      <button
        className={saved ? "saved" : undefined}
        aria-pressed={saved}
        aria-label={saved ? "Remove from favorites" : "Add to favorites"}
        onClick={() => toast(toggleFavorite("place", place.id) ? "Saved to favorites" : "Removed")}
      >
        <Icon name={saved ? "heart" : "heart-o"} />
        <span className="lbl">Save</span>
      </button>
      <button onClick={() => share(`${place.name} on Essenly`)}>
        <Icon name="share" />
        <span className="lbl">Share</span>
      </button>
      <a href={`https://${websiteFor(place.id)}`} target="_blank" rel="noopener noreferrer">
        <Icon name="ext" />
        <span className="lbl">Website</span>
      </a>
    </div>
  );
}

// ── Home (d-home): visit-decision summary + actions ───────
function HomeSection({ place }: { place: Place }) {
  const [dealOpen, setDealOpen] = useState(false);
  return (
    <section id="d-home" className="d-sec stack sm">
      {place.hours && (
        <div className="inforow">
          <Icon name="cal" size="xs" />
          <LiveBadge hours={place.hours} showUntil={false} />
          <span className="caption muted chev">{place.hours.open} – {place.hours.close} today</span>
        </div>
      )}
      <div className="inforow">
        <Icon name="pin" size="xs" />
        <span style={{ minWidth: 0 }}>{place.address}</span>
        <ActionButton className="small chev" style={{ color: "var(--accent)", fontWeight: 600 }} copy={place.address} aria-label="Copy address">
          Copy
        </ActionButton>
      </div>
      {place.stationWalk && (
        <div className="inforow">
          <Icon name="locate" size="xs" />
          <span>
            {place.stationWalk.station} Stn.{place.stationWalk.exit ? ` Exit ${place.stationWalk.exit}` : ""}
          </span>
          <span className="caption muted chev">{place.stationWalk.minutes} min walk</span>
        </div>
      )}
      <ActionButton className="taxicard" copy={`${place.nameKr}, ${place.address}`}>
        <span className="ic"><Icon name="car" size="sm" /></span>
        <div><b>Show to taxi driver</b><div className="caption muted">{place.nameKr} · {place.address}</div></div>
      </ActionButton>
      {/* Event banner — borderless fill (§4.6 Home-③); tap toggles the coupon row */}
      <div style={{ background: "var(--surface-hover)", borderRadius: 12 }}>
        <button
          className="row"
          style={{ width: "100%", gap: 12, textAlign: "left", padding: "12px 14px" }}
          aria-expanded={dealOpen}
          onClick={() => setDealOpen((v) => !v)}
        >
          <span style={{ fontSize: 20 }} aria-hidden="true">🎟</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b style={{ fontSize: 14 }}>Foreigner welcome deal</b>
            <div className="caption muted">Show your passport — 10% off your first visit</div>
          </div>
          <Icon name="chev" size="xs" style={{ color: "var(--dim)", flex: "none", transform: dealOpen ? "rotate(90deg)" : undefined, transition: "transform .2s" }} />
        </button>
        {dealOpen && (
          <div className="stack" style={{ gap: 6, padding: "0 14px 12px" }}>
            <div className="row" style={{ gap: 10 }}>
              <b className="mono" style={{ fontSize: 15, letterSpacing: "0.06em" }}>ESSENLY10</b>
              <ActionButton className="small" style={{ color: "var(--accent)", fontWeight: 600, marginLeft: "auto" }} copy="ESSENLY10">
                Copy
              </ActionButton>
            </div>
            <span className="caption muted">Show this screen at the front desk.</span>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Services (d-services): menu rail ↔ full vertical menu ──
function ServicesSection({ place }: { place: Place }) {
  const [expanded, setExpanded] = useState(false);
  const services = place.services ?? [];
  return (
    <section id="d-services" className="d-sec stack sm">
      {services.length === 0 ? (
        <SectionHeader title="Services" />
      ) : (
        <ToggleHeader
          title="Services"
          count={services.length}
          expanded={expanded}
          expandLabel={`See all (${services.length}) ›`}
          collapseLabel="Collapse ‹"
          onToggle={() => setExpanded((v) => !v)}
        />
      )}
      {place.priceConfirmedDaysAgo !== undefined && (
        <div className="caption muted">
          <Icon name="check" size="xs" style={{ color: "var(--accent)" }} /> Prices confirmed {place.priceConfirmedDaysAgo === 0 ? "today" : `${place.priceConfirmedDaysAgo} day${place.priceConfirmedDaysAgo === 1 ? "" : "s"} ago`}
        </div>
      )}
      {services.length === 0 ? (
        <div className="empty"><p>Walk-in retail — no service menu.</p></div>
      ) : expanded ? (
        <div>
          {services.map((s) => (
            <div key={s.name} className="listrow">
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ display: "block", fontSize: 13.5, lineHeight: 1.25 }}>{s.name}</b>
                <div className="caption muted">
                  {s.nameKr}{s.nameKr && s.durationMin ? " · " : ""}{s.durationMin ? `${s.durationMin} min` : ""}
                </div>
              </div>
              <b style={{ fontSize: 14, flex: "none" }}>{s.price}</b>
            </div>
          ))}
        </div>
      ) : (
        <HScroll ariaLabel="Services">
          {services.map((s) => (
            <div key={s.name} style={{ width: 128 }}>
              <ImgPh style={{ height: 96, borderRadius: 12 }} />
              <div style={{ fontWeight: 650, fontSize: 13.5, marginTop: 6, lineHeight: 1.25 }}>{s.name}</div>
              {s.durationMin && <div className="caption muted">{s.durationMin} min</div>}
              <div style={{ fontWeight: 750, fontSize: 14, marginTop: 2 }}>{s.price}</div>
            </div>
          ))}
        </HScroll>
      )}
      {place.type === "skin_clinic" && (
        <div className="banner warning">
          <Icon name="cross" size="sm" />
          <span>Medical procedures require a consultation before booking. Essenly does not provide medical advice.</span>
        </div>
      )}
      {/* Booking moved out of the CTA bar (§4.6 keeps the bar to share/save/map links). */}
      {place.type === "skin_clinic" ? (
        <BookingSheet triggerStyle={{ width: "100%" }} />
      ) : isBookable(place) ? (
        <ChannelSheet place={place} triggerStyle={{ width: "100%" }} />
      ) : null}
    </section>
  );
}

// ── Photos (d-photos): grid + inline gallery expansion ────
function PhotosSection() {
  const [expanded, setExpanded] = useState(false);
  return (
    <section id="d-photos" className="d-sec stack sm">
      <ToggleHeader
        title="Photos"
        count={128}
        expanded={expanded}
        expandLabel="See all ›"
        collapseLabel="Show less"
        onToggle={() => setExpanded((v) => !v)}
      />
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gridTemplateRows: "73px 73px", gap: 6 }}>
        <ImgPh style={{ gridRow: "1 / 3" }} />
        <ImgPh />
        <button style={{ padding: 0, display: "block", height: "100%" }} aria-expanded={expanded} aria-label="See all photos" onClick={() => setExpanded(true)}>
          <ImgPh style={{ height: "100%" }}><b className="muted">+125</b></ImgPh>
        </button>
      </div>
      {expanded && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
            {Array.from({ length: 12 }, (_, i) => <ImgPh key={i} style={{ height: 96 }} />)}
          </div>
          <button className="btn ghost" onClick={() => setExpanded(false)}>Show less</button>
        </>
      )}
    </section>
  );
}

// ── Reviews (d-reviews): prompt + summary + list ──────────
function ReviewsSection({ place }: { place: Place }) {
  const { toast } = useToast();
  const [myRating, setMyRating] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [sort, setSort] = useState<"latest" | "highest">("latest");
  const [photosOnly, setPhotosOnly] = useState(false);
  const [keyword, setKeyword] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [helpfulVotes, setHelpfulVotes] = useState<Record<string, boolean>>({});

  // Restore my rating for this place (guarded — localStorage only in effects/handlers).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RATING_KEY);
      if (!raw) return;
      const map = JSON.parse(raw) as Record<string, number>;
      const n = map[place.id];
      if (typeof n === "number" && n >= 1 && n <= 5) setMyRating(n);
    } catch { /* ignore */ }
  }, [place.id]);

  const rate = (n: number) => {
    setMyRating(n);
    setEditing(false);
    toast(`Thanks — you rated ${n} star${n === 1 ? "" : "s"}`);
    try {
      const raw = localStorage.getItem(RATING_KEY);
      const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
      map[place.id] = n;
      localStorage.setItem(RATING_KEY, JSON.stringify(map));
    } catch { /* ignore */ }
  };

  const total = place.ratingCount ?? 120;
  const dist = RATING_SHARES.map((s) => Math.round(total * s)) as [number, number, number, number, number];

  const filtered = REVIEWS
    .filter((r) => (keyword ? r.keywords.includes(keyword) : true))
    .filter((r) => (photosOnly ? r.hasPhoto : true))
    .sort((a, b) => (sort === "highest" ? b.stars - a.stars : b.date.localeCompare(a.date)));
  const visible = showAll ? filtered : filtered.slice(0, REVIEWS_PREVIEW);
  const remaining = filtered.length - visible.length;
  const canRate = myRating === null || editing;

  return (
    <section id="d-reviews" className="d-sec stack">
      {/* Rate prompt — tappable stars, persisted per place */}
      <div className="stack sm" style={{ alignItems: "center", textAlign: "center" }}>
        <b style={{ fontSize: 14.5 }}>Been here? Rate your visit</b>
        <div className="row" style={{ gap: 6, justifyContent: "center" }} role="group" aria-label={`Rate ${myRating ?? 0} of 5 stars`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              aria-label={`Rate ${n} stars`}
              disabled={!canRate}
              onClick={() => rate(n)}
              style={{ fontSize: 24, lineHeight: 1, padding: "0 2px", color: n <= (myRating ?? 0) ? "var(--warning)" : "var(--dim)" }}
            >
              {n <= (myRating ?? 0) ? "★" : "☆"}
            </button>
          ))}
        </div>
        {myRating !== null && !editing && (
          <span className="caption muted">
            You rated {myRating} star{myRating === 1 ? "" : "s"} ·{" "}
            <button className="caption" style={{ color: "var(--accent)", fontWeight: 600 }} onClick={() => setEditing(true)}>Edit</button>
          </span>
        )}
      </div>
      {/* Summary: big rating + 5→1 bars + keyword chips */}
      <div className="row" style={{ gap: 20 }}>
        <div style={{ textAlign: "center", flex: "none" }}>
          <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.15 }}>{place.rating?.toFixed(1) ?? "–"}</div>
          <div className="stars">{starsFor(place.rating)}</div>
          <div className="caption muted">{total} reviews</div>
        </div>
        <RatingBars dist={dist} />
      </div>
      <div className="chipwrap">
        {REVIEW_KEYWORDS.map((k) => (
          <button
            key={k.label}
            className={"chip" + (keyword === k.label ? " selected" : "")}
            aria-pressed={keyword === k.label}
            onClick={() => setKeyword((cur) => (cur === k.label ? null : k.label))}
          >
            {k.label} <span className={keyword === k.label ? undefined : "muted"}>{k.n}</span>
          </button>
        ))}
      </div>
      {/* Sort row + review list */}
      <div className="row" style={{ gap: 14 }}>
        <button className={"small" + (sort === "latest" ? "" : " muted")} style={sort === "latest" ? { fontWeight: 700 } : undefined} aria-pressed={sort === "latest"} onClick={() => setSort("latest")}>
          Latest
        </button>
        <button className={"small" + (sort === "highest" ? "" : " muted")} style={sort === "highest" ? { fontWeight: 700 } : undefined} aria-pressed={sort === "highest"} onClick={() => setSort("highest")}>
          Highest
        </button>
        <button className={"small" + (photosOnly ? "" : " muted")} style={photosOnly ? { fontWeight: 700 } : undefined} aria-pressed={photosOnly} onClick={() => setPhotosOnly((v) => !v)}>
          With photos
        </button>
        <span style={{ flex: 1 }} />
        <Link className="small" style={{ fontWeight: 600 }} href={routes.reviewNew}>✎ Write</Link>
      </div>
      <div>
        {visible.length === 0 && (
          <div className="empty"><p>No reviews match these filters.</p></div>
        )}
        {visible.map((r) => {
          const voted = !!helpfulVotes[r.who];
          return (
            <div className="review" key={r.who}>
              <div className="head">
                <span className="avatar">{r.a}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: 7, flexWrap: "wrap" }}>
                    <b>{r.who}</b>
                    <span className="stars">{starsFor(r.stars)}</span>
                    {r.verified && <span className="caption muted">✓ Verified</span>}
                    <span className="caption dim" style={{ marginLeft: "auto" }}>{formatReviewDate(r.date)}</span>
                  </div>
                  <div className="caption dim">{r.country}</div>
                </div>
              </div>
              <p className="muted small" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {r.text}
              </p>
              <div className="row" style={{ gap: 10, marginTop: 8 }}>
                {r.hasPhoto && <ImgPh style={{ width: 56, height: 56, flex: "none" }} />}
                <button
                  className="caption"
                  aria-pressed={voted}
                  style={voted ? { color: "var(--accent)", fontWeight: 600 } : { color: "var(--muted)" }}
                  onClick={() => setHelpfulVotes((v) => ({ ...v, [r.who]: !v[r.who] }))}
                >
                  Helpful {r.helpful + (voted ? 1 : 0)}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {remaining > 0 && (
        <button className="btn ghost" onClick={() => setShowAll(true)}>More reviews ({remaining})</button>
      )}
    </section>
  );
}

// ── Info (d-info): full details — Naver home/info split ───
function InfoSection({ place }: { place: Place }) {
  const { toast } = useToast();
  const today = new Date().getDay();
  return (
    <section id="d-info" className="d-sec stack sm">
      <h2 className="h2" style={{ fontFamily: "var(--sans)", fontSize: 16, fontWeight: 700 }}>Information</h2>
      {place.hours && (
        <Collapse summary={<b>Hours · {statusLabel(place.hours)}</b>}>
          <div className="stack" style={{ gap: 4, padding: "8px 4px" }}>
            {WEEKDAYS.map((d, i) => (
              <div key={d} className="row between small" style={{ fontWeight: i === today ? 700 : 400, color: i === today ? "var(--text)" : "var(--muted)" }}>
                <span>{d}{i === today ? " (today)" : ""}</span>
                <span className="mono">{place.hours!.open} – {place.hours!.close}</span>
              </div>
            ))}
          </div>
        </Collapse>
      )}
      {/* Contact & links */}
      <button className="inforow" onClick={() => toast("Opening website…")}>
        <Icon name="ext" size="xs" />
        <span>Website</span>
        <span className="caption muted chev">{websiteFor(place.id)}</span>
      </button>
      <ActionButton className="inforow" copy={PHONE} aria-label="Copy phone number">
        <Icon name="call" size="xs" />
        <span>{PHONE_DISPLAY}</span>
        <span className="caption muted chev">Copy</span>
      </ActionButton>
      <button className="inforow" onClick={() => toast("Opening Instagram…")}>
        <Icon name="ig" size="xs" />
        <span>Instagram</span>
        <span className="caption muted chev">@{place.id.replace(/-/g, "_")}</span>
      </button>
      {/* Facilities & payment */}
      <div className="inforow">
        <Icon name="car" size="xs" />
        <span>Parking</span>
        <span className="caption muted chev">Paid lot next door</span>
      </div>
      <div className="inforow">
        <Icon name="check" size="xs" />
        <span>Payment</span>
        <span className="caption muted chev">Card · GLN · Apple Pay</span>
      </div>
      <div className="inforow">
        <Icon name="mark" size="xs" />
        <span>English</span>
        <span className="caption muted chev">{place.englishOk ? "Staff can assist in English" : "Translation app recommended"}</span>
      </div>
      <div className="chipwrap">
        <span className="chip">Card OK</span>
        <span className="chip">Locker</span>
        <span className="chip">Towel rental</span>
        {place.englishOk && <span className="chip">English menu</span>}
      </div>
      <div className="inforow">
        <span className="muted" style={{ width: 20, textAlign: "center", flex: "none" }} aria-hidden="true">₩</span>
        <span>Price range</span>
        <span className="chev mono" style={{ fontWeight: 600 }}>{place.priceRange}</span>
      </div>
    </section>
  );
}

// ── Nearby ranking — independent section after Info ───────
function NearbySection({ place }: { place: Place }) {
  const nearby = PLACES
    .filter((p) => p.type === place.type && p.id !== place.id)
    .map((p) => ({ p, km: haversineKm({ lat: place.lat, lng: place.lng }, { lat: p.lat, lng: p.lng }) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, 4)
    .sort((a, b) => (b.p.rating ?? 0) - (a.p.rating ?? 0));
  if (nearby.length === 0) return null;
  return (
    <section className="stack sm">
      <SectionHeader title={`Top rated nearby · ${TYPE_LABEL[place.type]}`} />
      <div>
        {nearby.map(({ p, km }, i) => (
          <Link key={p.id} className="listrow" href={routes.place(p.id)}>
            <span className="mono" style={{ width: 16, fontWeight: 700, flex: "none", textAlign: "center" }}>{i + 1}</span>
            <ImgPh style={{ width: 44, height: 44, flex: "none" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</b>
              <div className="caption muted">{zoneShort(p.zone)} · {formatDistance(km)}</div>
            </div>
            <RatingLine rating={p.rating} plain />
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Compact-bar ⋮ menu — closes on outside tap / Escape. */
function MoreMenu({ place }: { place: Place }) {
  const { toast, copy, share } = useToast();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuItemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) return;
    const focusFrame = requestAnimationFrame(() => menuItemRefs.current[0]?.focus());
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const pick = (action: () => void) => () => {
    action();
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };
  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = menuItemRefs.current.filter((item): item is HTMLButtonElement => Boolean(item));
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    let next: number | null = null;
    if (event.key === "ArrowDown") next = current < items.length - 1 ? current + 1 : 0;
    if (event.key === "ArrowUp") next = current > 0 ? current - 1 : items.length - 1;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = items.length - 1;
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      requestAnimationFrame(() => triggerRef.current?.focus());
      return;
    }
    if (next === null) return;
    event.preventDefault();
    items[next]?.focus();
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", flex: "none" }}>
      <button ref={triggerRef} type="button" className="iconbtn" aria-label="More options" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span style={{ fontSize: 17, fontWeight: 700 }} aria-hidden="true">⋮</span>
      </button>
      {open && (
        <div className="detail-menucard" role="menu" aria-label="Place actions" onKeyDown={onMenuKeyDown}>
          <button ref={(node) => { menuItemRefs.current[0] = node; }} type="button" role="menuitem" tabIndex={-1} onClick={pick(() => copy(window.location.href))}>Copy link</button>
          <button ref={(node) => { menuItemRefs.current[1] = node; }} type="button" role="menuitem" tabIndex={-1} onClick={pick(() => share(`${place.name} on Essenly`))}>Share</button>
          <button ref={(node) => { menuItemRefs.current[2] = node; }} type="button" role="menuitem" tabIndex={-1} onClick={pick(() => toast("Thanks — we'll take a look"))}>Report an issue</button>
        </div>
      )}
    </div>
  );
}

/** Place detail D-1 (spec §4.6): photo collage + title block + sticky anchor tabs
    over a single scroll of divided sections, plus the D-2 compact bar (§4.7) that
    fades in once the photo header scrolls out. Header chrome (back/share/favorite)
    and the CTA bar stay with callers. */
export function PlaceDetailBody({ place, heroOverlay }: { place: Place; heroOverlay?: ReactNode }) {
  const router = useRouter();
  const heroRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const { loc } = useLocation();
  const km = haversineKm(loc ?? GANGNAM_STATION, { lat: place.lat, lng: place.lng });

  // D-2 trigger: compact bar shows while the photo header is fully scrolled out
  // (clipped by .app-scroll → isIntersecting false).
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setCompact(!e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="detail-scroll">
      {/* D-2 compact bar — zero-height sticky wrapper so mounting never shifts layout;
          the anchor tabs stick at top:48 directly beneath it (globals.css Track B block). */}
      <div className={"detail-compactwrap" + (compact ? " on" : "")}>
        <div className="detail-compactbar">
          <button className="iconbtn" aria-label="Collapse" onClick={() => router.back()}>
            <Icon name="chev" size="sm" style={{ transform: "rotate(90deg)" }} />
          </button>
          <b>{place.name}</b>
          <ActionButton className="iconbtn" aria-label="Share" share={`${place.name} on Essenly`}>
            <Icon name="share" size="sm" />
          </ActionButton>
          <MoreMenu place={place} />
        </div>
      </div>

      {/* §4.6 photo header collage */}
      <div ref={heroRef} style={{ position: "relative", padding: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gridTemplateRows: "82px 82px", gap: 6 }}>
          <ImgPh style={{ gridRow: "1 / 3" }} />
          <ImgPh />
          <ImgPh><b className="muted">+12</b></ImgPh>
        </div>
        {heroOverlay}
      </div>

      <div className="pad" style={{ paddingTop: 8, paddingBottom: 12 }}>
        <TitleBlock place={place} km={km} />
      </div>

      {/* Kakao-style action strip — under the title header, above the tabs */}
      <PlaceActions place={place} />

      {/* §4.6 sticky anchor tabs with scroll-spy */}
      <AnchorTabs sections={SECTIONS} offset={STICKY_OFFSET} />

      <div className="pad stack">
        <HomeSection place={place} />
        <Divider />
        <ServicesSection place={place} />
        <Divider />
        <PhotosSection />
        <Divider />
        <ReviewsSection place={place} />
        <Divider />
        <InfoSection place={place} />
        <Divider />
        <NearbySection place={place} />
      </div>
    </div>
  );
}
