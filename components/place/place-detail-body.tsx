"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/ui/action-button";
import { AnchorTabs } from "@/components/ui/anchor-tabs";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Collapse } from "@/components/ui/collapse";
import { EmptyState } from "@/components/ui/empty-state";
import { HScroll } from "@/components/ui/h-scroll";
import { IconButton } from "@/components/ui/icon-button";
import { ImgPh } from "@/components/ui/img-ph";
import { LiveBadge } from "@/components/ui/live-badge";
import { Notice } from "@/components/ui/notice";
import { RatingLine } from "@/components/ui/rating-line";
import { SectionDivider } from "@/components/ui/section-divider";
import { SectionHeader } from "@/components/ui/section-header";
import { useToast } from "@/components/ui/toast";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";
import { Icon } from "@/components/icon";
import { useLocation } from "@/components/map/use-location";
import { useSigninNudge } from "@/components/auth/signin-nudge";
import { toggleFavorite, useFavorites } from "@/lib/favorites";
import { REVIEW_MAX_LEN, setRating, setReview, useMyRatings } from "@/lib/ratings";
import { fetchPlaceReviews, REPORT_REASONS, reportReview, timeAgo, type PublicReview } from "@/lib/reviews";
import { routes } from "@/lib/routes";
import { PLACES, PRODUCTS, TYPE_LABEL, zoneShort, type Place } from "@/lib/data";
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

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const starsFor = (rating?: number) => {
  const filled = Math.max(0, Math.min(5, Math.round(rating ?? 0)));
  return "★★★★★".slice(0, filled) + "☆☆☆☆☆".slice(filled);
};

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
        {/* curated rows carry synthetic ratings — show real (scraped) ones only */}
        {place.source !== "curated" && <RatingLine rating={place.rating} count={place.ratingCount} />}
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

// ── Kakao-style action strip: [Save][Share][Copy name] ─────
// Sits between the title header and the anchor tabs. Call/Website left the
// strip for launch — the prototype's shared sample phone/URL misrepresented
// real businesses (launch audit P0-2); they return per-place once verified
// contact data exists.
function PlaceActions({ place }: { place: Place }) {
  const favs = useFavorites();
  const { toast, share } = useToast();
  const { nudge, sheet } = useSigninNudge();
  const saved = favs.place.includes(place.id);
  return (
    <div className="place-actions">
      {sheet}
      {/* our own map first — external Google/Kakao/Naver live in the CTA bar
          (user report 2026-08-16: no in-app path from detail to the map) */}
      <Link href={`${routes.map}?place=${encodeURIComponent(place.id)}`} aria-label="View on the MYSEOULDROP map">
        <Icon name="pin" />
        <span className="lbl">Map</span>
      </Link>
      <button
        className={saved ? "saved" : undefined}
        aria-pressed={saved}
        aria-label={saved ? "Remove from favorites" : "Add to favorites"}
        onClick={() => {
          const next = toggleFavorite("place", place.id);
          toast(next ? "Saved to favorites" : "Removed");
          if (next) nudge("favorite"); // guest-only, once per device
        }}
      >
        <Icon name={saved ? "heart" : "heart-o"} />
        <span className="lbl">Save</span>
      </button>
      <button onClick={() => share(`${place.name} on MYSEOULDROP`)}>
        <Icon name="share" />
        <span className="lbl">Share</span>
      </button>
      <ActionButton copy={`${place.name} · ${place.nameKr}`} aria-label="Copy place name">
        <Icon name="copy" />
        <span className="lbl">Copy name</span>
      </ActionButton>
    </div>
  );
}

// ── Home (d-home): visit-decision summary + actions ───────
function HomeSection({ place }: { place: Place }) {
  const about = place.about || place.aboutKr;
  return (
    <section id="d-home" className="d-sec stack sm">
      {about && (
        <p className="small muted" style={{ margin: 0, lineHeight: 1.55 }}>{about}</p>
      )}
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
        <Link
          className="small chev"
          style={{ color: "var(--accent)", fontWeight: 600 }}
          href={`${routes.map}?place=${encodeURIComponent(place.id)}`}
          aria-label="View on the MYSEOULDROP map"
        >
          Map
        </Link>
        <ActionButton className="small" style={{ color: "var(--accent)", fontWeight: 600, flex: "none" }} copy={place.address} aria-label="Copy address">
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
      <TaxiCard place={place} />
      {/* Launch audit P0-1: the "welcome deal" coupon was a prototype
          fabrication — real per-place promotions return when partnerships
          exist. */}
    </section>
  );
}

// ── "Show to taxi driver" — tap opens a centered big-text modal ──
// (user request 2026-08-16: name + address in Korean, readable at
// arm's length for the driver.) 205 scraped rows carry an English-only
// nameKr — the Korean name line appears only when it actually helps.
function TaxiCard({ place }: { place: Place }) {
  const [open, setOpen] = useState(false);
  // portal to .app-shell — inline, the detail page's sticky/transform
  // ancestors trap the scrim in a lower stacking context (same reason
  // BottomSheet portals)
  const [host, setHost] = useState<Element | null>(null);
  useEffect(() => { setHost(document.querySelector(".app-shell")); }, []);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useDialogFocus<HTMLDivElement>(open, () => setOpen(false), closeRef);
  const krName = /[가-힣]/.test(place.nameKr) ? place.nameKr : null;
  return (
    <>
      <button className="taxicard" onClick={() => setOpen(true)}>
        <span className="ic"><Icon name="car" size="sm" /></span>
        <div>
          <b>Show to taxi driver</b>
          <div className="caption muted">{krName ?? place.name} · {place.address}</div>
        </div>
      </button>
      {open && host && createPortal(
        <div className="modal" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div
            ref={dialogRef}
            className="box taxi-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Show this screen to the taxi driver"
            tabIndex={-1}
          >
            <div className="taxi-modal-kicker">이 주소로 가주세요</div>
            <div className="caption muted">Please take me to this address</div>
            <div className="taxi-modal-name">{krName ?? place.name}</div>
            <div className="taxi-modal-addr">{place.address}</div>
            <div className="row" style={{ gap: 8, marginTop: 18 }}>
              <ActionButton variant="secondary" style={{ flex: 1 }} copy={`${krName ?? place.name}, ${place.address}`}>
                Copy
              </ActionButton>
              <Button buttonRef={closeRef} style={{ flex: 1 }} onClick={() => setOpen(false)}>Close</Button>
            </div>
          </div>
        </div>,
        host,
      )}
    </>
  );
}

// ── Olive Young stores: bestsellers instead of a service menu ──
// (user request 2026-08-16: the store page should route to the products
// sold there — the chart is chain-wide, so it's labeled honestly.)
function OliveYoungPicks() {
  const picks = PRODUCTS
    .filter((p) => p.channel === "olive_young" && p.salesRank !== undefined)
    .sort((a, b) => (a.salesRank ?? 99) - (b.salesRank ?? 99))
    .slice(0, 4);
  return (
    <>
      <div className="caption muted">Olive Young bestsellers — chain-wide chart, stock varies by branch.</div>
      <div>
        {picks.map((p, i) => (
          <Link key={p.id} className="listrow" href={routes.shopItem(p.id)}>
            <b className="mono num" style={{ width: 22, flex: "none", color: i === 0 ? "var(--accent)" : "var(--muted)" }}>{i + 1}</b>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ display: "block", fontSize: 13.5, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</b>
              <div className="caption muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.brand} · {p.nameKr}</div>
            </div>
            <Icon name="chev" size="xs" className="chev" style={{ color: "var(--dim)" }} />
          </Link>
        ))}
      </div>
      <Button variant="secondary" size="sm" href={routes.ranking}>
        See the full product ranking
      </Button>
    </>
  );
}

// ── Services (d-services): menu rail ↔ full vertical menu ──
function ServicesSection({ place }: { place: Place }) {
  const [expanded, setExpanded] = useState(false);
  const services = place.services ?? [];
  if (place.type === "olive_young") {
    return (
      <section id="d-services" className="d-sec stack sm">
        <SectionHeader title="Products" actionLabel="Ranking" href={routes.ranking} />
        <OliveYoungPicks />
      </section>
    );
  }
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
      {/* Honest framing: no scraped place carries a service menu, so any
          menu shown is curated/illustrative — never present it as venue-
          confirmed (codex cross-check #1). */}
      <div className="caption muted">Example menu for this category — confirm services and prices at the venue.</div>
      {services.length === 0 ? (
        <EmptyState>Walk-in retail — no service menu.</EmptyState>
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
        <Notice tone="warning" icon="cross">
          Medical procedures require a consultation before booking. MYSEOULDROP does not provide medical advice.
        </Notice>
      )}
      {/* Launch scope: in-app booking (and its demo payment) is disabled
          until real availability + payments exist (audit P0-1). Discovery
          stays honest — save the place and book on site. */}
      {(place.type === "skin_clinic" || isBookable(place)) && (
        <Notice icon="cal">
          In-app booking is coming soon — save this place and book at the
          venue or through its official channels.
        </Notice>
      )}
    </section>
  );
}

// ── Photos (d-photos): grid + inline gallery expansion ────
function PhotosSection() {
  // Launch audit P0-2: the fake "128 photos" count is gone — placeholders
  // stay as layout language, honestly labeled until real photos land.
  return (
    <section id="d-photos" className="d-sec stack sm">
      <SectionHeader title="Photos" />
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gridTemplateRows: "73px 73px", gap: 6 }}>
        <ImgPh style={{ gridRow: "1 / 3" }} />
        <ImgPh />
        <ImgPh />
      </div>
      <span className="caption muted">Real photos are on the way — we&apos;re collecting them place by place.</span>
    </section>
  );
}

// ── Public traveler reviews — masked view + report flow ───
// (리뷰 공개 전환 2026-08-16.) Only reviews whose author ticked "Post
// publicly" appear; first names only; 3 distinct reports auto-hide a row.
function TravelerReviews({ placeId, refreshKey }: { placeId: string; refreshKey: number }) {
  const { toast } = useToast();
  const [reviews, setReviews] = useState<PublicReview[] | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void fetchPlaceReviews(placeId).then((r) => { if (alive) setReviews(r); });
    return () => { alive = false; };
  }, [placeId, refreshKey]);
  if (reviews === null) return null; // quiet while loading
  return (
    <div className="stack sm">
      <b style={{ fontSize: 14.5 }}>Traveler reviews{reviews.length > 0 ? ` · ${reviews.length}` : ""}</b>
      {reviews.length === 0 ? (
        <p className="caption muted" style={{ margin: 0 }}>No traveler reviews yet — rate your visit and be the first.</p>
      ) : reviews.map((r) => (
        <div key={r.id} className="stack" style={{ gap: 4, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 12px" }}>
          <div className="row" style={{ gap: 8 }}>
            <b style={{ fontSize: 13 }}>{r.displayName}{r.mine ? " (you)" : ""}</b>
            <span className="stars" style={{ fontSize: 12 }}>{starsFor(r.rating)}</span>
            <span className="caption muted chev">{timeAgo(r.at)}</span>
          </div>
          <p className="small" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{r.body}</p>
          {!r.mine && (reporting === r.id ? (
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              {REPORT_REASONS.map((reason) => (
                <button
                  key={reason.key}
                  className="caption"
                  style={{ color: "var(--muted)", border: "1px solid var(--border)", borderRadius: 999, padding: "3px 10px" }}
                  onClick={async () => {
                    setReporting(null);
                    const res = await reportReview(r.id, reason.key);
                    toast(res === "reported"
                      ? "Reported — our team will take a look"
                      : res === "already"
                        ? "You already reported this review"
                        : "Sign in to report reviews");
                  }}
                >
                  {reason.label}
                </button>
              ))}
              <button className="caption muted" onClick={() => setReporting(null)}>Cancel</button>
            </div>
          ) : (
            <button className="caption" style={{ color: "var(--dim)", alignSelf: "flex-start" }} onClick={() => setReporting(r.id)}>
              Report
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Reviews (d-reviews): my rating + traveler reviews ─────
// Launch audit P0-2: the six sample reviews (with Verified badges, helpful
// counts, and keyword chips) rendered identically on every place — removed.
// What shows is real: the source listing's rating, the visitor's own
// rating/review, and consented public traveler reviews.
function ReviewsSection({ place }: { place: Place }) {
  const { toast } = useToast();
  // Shared store — persists per place, syncs to the account when signed in.
  const myRatings = useMyRatings();
  const myRating = myRatings[place.id]?.rating ?? null;
  const myReview = myRatings[place.id]?.body ?? "";
  const { nudge: nudgeRating, sheet: ratingNudgeSheet } = useSigninNudge();
  const [editing, setEditing] = useState(false);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  // consent default: new reviews public, an existing note keeps its choice
  const [postPublic, setPostPublic] = useState(true);
  const [reviewBump, setReviewBump] = useState(0);

  const rate = (n: number) => {
    setRating(place.id, n);
    setEditing(false);
    toast(`Thanks — you rated ${n} star${n === 1 ? "" : "s"}`);
    nudgeRating("rating"); // guest-only, once per device
  };

  const saveReview = () => {
    if (myRating === null) return;
    setReview(place.id, myRating, draft, postPublic);
    setComposing(false);
    toast(draft.trim()
      ? postPublic ? "Review posted — travelers can now see it" : "Review saved as a private note"
      : "Review removed");
    // the upsert is fire-and-forget — refresh the public list after it lands
    setTimeout(() => setReviewBump((b) => b + 1), 1500);
  };

  const canRate = myRating === null || editing;

  return (
    <section id="d-reviews" className="d-sec stack">
      {ratingNudgeSheet}
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

        {/* Review text — private-first: synced to the account, shown only to
            the author until public reviews (with moderation) ship. */}
        {myRating !== null && !composing && (
          myReview ? (
            <div className="stack sm" style={{ width: "100%", textAlign: "left", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 12px" }}>
              <span className="t-caption">Your review · {myRatings[place.id]?.isPublic ? "public" : "private note"}</span>
              <p className="small" style={{ whiteSpace: "pre-wrap" }}>{myReview}</p>
              <button className="caption" style={{ color: "var(--accent)", fontWeight: 600, alignSelf: "flex-start" }} onClick={() => { setDraft(myReview); setPostPublic(myRatings[place.id]?.isPublic === true); setComposing(true); }}>
                Edit review
              </button>
            </div>
          ) : (
            <button className="caption" style={{ color: "var(--accent)", fontWeight: 600 }} onClick={() => { setDraft(""); setPostPublic(true); setComposing(true); }}>
              Write a review
            </button>
          )
        )}
        {composing && (
          <div className="stack sm" style={{ width: "100%", textAlign: "left" }}>
            <textarea
              className="input"
              aria-label="Your review"
              placeholder="How was your visit? Tips for other travelers welcome."
              rows={4}
              maxLength={REVIEW_MAX_LEN}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              style={{ resize: "none", minHeight: 88, lineHeight: 1.45 }}
              autoFocus
            />
            {/* terms promise consent-first publishing — this checkbox IS the consent */}
            <label className="row caption" style={{ gap: 8, alignItems: "flex-start", cursor: "pointer" }}>
              <input type="checkbox" checked={postPublic} onChange={(e) => setPostPublic(e.target.checked)} style={{ marginTop: 1 }} />
              <span className="muted">Post publicly — travelers see it with your first name. Uncheck to keep it as a private note.</span>
            </label>
            <div className="row" style={{ gap: 8 }}>
              <Button variant="secondary" size="sm" style={{ flex: 1 }} onClick={() => setComposing(false)}>Cancel</Button>
              <Button size="sm" style={{ flex: 1 }} onClick={saveReview}>Save review</Button>
            </div>
          </div>
        )}
      </div>
      {/* Source-listing rating — the one review signal that's real data.
          Curated rows have synthetic numbers, so they show nothing here. */}
      {place.source !== "curated" && place.rating !== undefined && (
        <div className="row" style={{ gap: 12, justifyContent: "center", alignItems: "baseline" }}>
          <span style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.15 }}>{place.rating.toFixed(1)}</span>
          <span className="stars">{starsFor(place.rating)}</span>
          {place.ratingCount !== undefined && (
            <span className="caption muted">{place.ratingCount} ratings</span>
          )}
        </div>
      )}
      <TravelerReviews placeId={place.id} refreshKey={reviewBump} />
    </section>
  );
}

// ── Info (d-info): full details — Naver home/info split ───
function InfoSection({ place }: { place: Place }) {
  const { toast } = useToast();
  // A Vercel server's date can differ from the visitor's local date. Delay
  // today/open-state decoration until hydration has completed on the device.
  const [today, setToday] = useState<number | null>(null);
  useEffect(() => setToday(new Date().getDay()), []);
  return (
    <section id="d-info" className="d-sec stack sm">
      <h2 className="h2" style={{ fontFamily: "var(--sans)", fontSize: 16, fontWeight: 700 }}>Information</h2>
      {place.hours && (
        <Collapse summary={<b>Hours{today !== null ? ` · ${statusLabel(place.hours)}` : ""}</b>}>
          <div className="stack" style={{ gap: 4, padding: "8px 4px" }}>
            {WEEKDAYS.map((d, i) => (
              <div key={d} className="row between small" style={{ fontWeight: today !== null && i === today ? 700 : 400, color: today !== null && i === today ? "var(--text)" : "var(--muted)" }}>
                <span>{d}{today !== null && i === today ? " (today)" : ""}</span>
                <span className="mono">{place.hours!.open} – {place.hours!.close}</span>
              </div>
            ))}
          </div>
        </Collapse>
      )}
      {/* Launch audit P0-2: contact (website/phone/Instagram) and facility
          rows (parking/payment) were shared samples shown on every place —
          removed until per-place verified data exists. */}
      <div className="inforow">
        <Icon name="mark" size="xs" />
        <span>English</span>
        <span className="caption muted chev">{place.englishOk ? "Staff can assist in English" : "Translation app recommended"}</span>
      </div>
      {/* facility chips (Card OK / Locker / Towel rental) were invented
          shared samples — removed until per-place verified data exists */}
      <div className="inforow">
        <span className="muted" style={{ width: 20, textAlign: "center", flex: "none" }} aria-hidden="true">₩</span>
        <span>Price range</span>
        <span className="chev mono" style={{ fontWeight: 600 }}>{place.priceRange}</span>
      </div>
      {/* provenance disclosure (data-ledger slice) */}
      <p className="caption muted" style={{ marginTop: 4 }}>
        {place.source === "curated"
          ? "Curated pick — details compiled by our team and not yet venue-verified. Confirm before visiting."
          : "Listed from public sources — details can change. Confirm important ones before visiting."}
        {place.geoSource === "area" && " Map pin is approximate (neighborhood-level)."}
      </p>
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
  const router = useRouter();
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
      <IconButton
        buttonRef={triggerRef}
        name="more"
        label="More options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <div className="detail-menucard" role="menu" aria-label="Place actions" onKeyDown={onMenuKeyDown}>
          <button ref={(node) => { menuItemRefs.current[0] = node; }} type="button" role="menuitem" tabIndex={-1} onClick={pick(() => copy(window.location.href))}>Copy link</button>
          <button ref={(node) => { menuItemRefs.current[1] = node; }} type="button" role="menuitem" tabIndex={-1} onClick={pick(() => share(`${place.name} on MYSEOULDROP`))}>Share</button>
          {/* codex cross-check #5: the old thank-you toast faked a report —
              route to the real feedback channel instead */}
          <button ref={(node) => { menuItemRefs.current[2] = node; }} type="button" role="menuitem" tabIndex={-1} onClick={pick(() => router.push(routes.support))}>Report an issue</button>
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
          <IconButton name="down" label="Collapse" onClick={() => router.back()} />
          <b>{place.name}</b>
          <ActionButton
            iconAction={{ name: "share", label: "Share" }}
            share={`${place.name} on MYSEOULDROP`}
          />
          <MoreMenu place={place} />
        </div>
      </div>

      {/* §4.6 photo header collage */}
      <div ref={heroRef} style={{ position: "relative", padding: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gridTemplateRows: "82px 82px", gap: 6 }}>
          <ImgPh style={{ gridRow: "1 / 3" }} />
          <ImgPh />
          <ImgPh />
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
        <SectionDivider />
        <ServicesSection place={place} />
        <SectionDivider />
        <PhotosSection />
        <SectionDivider />
        <ReviewsSection place={place} />
        <SectionDivider />
        <InfoSection place={place} />
        <SectionDivider />
        <NearbySection place={place} />
      </div>
    </div>
  );
}
