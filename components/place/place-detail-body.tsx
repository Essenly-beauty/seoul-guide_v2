"use client";

import { T, useLocale } from "@/lib/i18n/locale-provider";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/ui/action-button";
import { AnchorTabs } from "@/components/ui/anchor-tabs";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Collapse } from "@/components/ui/collapse";
import { HoursToday } from "@/components/ui/hours-today";
import { IconButton } from "@/components/ui/icon-button";
import { PlaceThumbnail } from "@/components/place/place-thumbnail";
import { ProductThumbnail } from "@/components/product/product-thumbnail";
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
import { PlaceCorrectionLauncher } from "@/components/place/place-correction-launcher";
import type { PublishedPlace } from "@/lib/place-profile";
import { PublicStoreContact, PublicStoreNotice } from "@/components/place/public-store-profile";
import { PublicServiceMenu } from "@/components/place/public-service-menu";
import { OliveYoungBrandHero } from "@/components/place/olive-young-brand-hero";
import { toggleFavorite, useFavorites } from "@/lib/favorites";
import { REVIEW_MAX_LEN, setReview, useMyRatings, useMyRatingsReady } from "@/lib/ratings";
import { useAuthUser } from "@/lib/auth/use-auth";
import { fetchPlaceReviews, REPORT_REASONS, reportReview, timeAgo, type PublicReview } from "@/lib/reviews";
import { routes } from "@/lib/routes";
import { PLACES, PRODUCTS, TYPE_LABEL, zoneShort, type Place } from "@/lib/data";
import { selectDaisoRanking } from "@/lib/daiso-ranking";
import { GANGNAM_STATION, formatCompactDistance, formatDistance, haversineKm } from "@/lib/geo";
import { hoursOn, isApproximatePlace, PLACE_SOURCE_LABEL, statusLabel } from "@/lib/places";
import { daisoBrandEn, daisoNameEn, daisoSubcategoryEn } from "@/lib/daiso-ranking-en";

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

// ── §4.6 · Title block (fixed, not a tab anchor) ──────────
// Name first; category and visit information stay in quieter, separate rows.
function TitleBlock({ place, km }: { place: Place; km: number }) {
  return (
    <div className="place-detail-heading">
        <div className="place-detail-name-stack">
          <h1 className="h1 place-detail-title">
            <span className="place-name-primary">{place.name}</span>
          </h1>
          {place.nameKr !== place.name && (
            <span className="place-name-secondary" lang="ko">{place.nameKr}</span>
          )}
        </div>
      <div className="place-detail-meta">
        <span><T text={TYPE_LABEL[place.type]} /></span>
        <LiveBadge hours={place.hours} showUntil={false} />
        {/* curated rows carry synthetic ratings — show real (scraped) ones only */}
        {place.source !== "curated" && <RatingLine plain rating={place.rating} count={place.ratingCount} />}
      </div>
      <PlaceAddressDisclosure place={place} km={km} />
    </div>
  );
}

function PlaceAddressDisclosure({ place, km }: { place: Place; km: number }) {
  const { t } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const approximate = isApproximatePlace(place);
  return (
    <div className="place-address-disclosure">
      {approximate && (
        <Notice tone="warning" icon="pin"><T text={"Approximate pin — neighborhood only. Search the place name in a map app to confirm the storefront before visiting."} /> </Notice>
      )}
      <button
        type="button"
        className="place-address-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        <Icon name="pin" size="xs" aria-hidden="true" />
        <span>
          {!approximate && <><span className="map-meta-token mono">{formatCompactDistance(km)}</span><span aria-hidden="true"> · </span></>}
          {/* upstream normalises the source's "not enough information"
              placeholder to empty — never print it to a visitor */}
          {place.address || t("Address not listed")}
        </span>
        <Icon
          name="down"
          size="xs"
          className="place-address-chevron"
          style={{ transform: expanded ? "rotate(180deg)" : undefined }}
          aria-hidden="true"
        />
      </button>
      {expanded && (
        <div className="place-address-panel">
          <div className="place-address-detail-row">
            <span><T text={"English name"} /></span>
            <b>{place.name}</b>
            <ActionButton copy={place.name} aria-label="Copy English name"><T text={"Copy"} /></ActionButton>
          </div>
          {/* 137 scraped rows carry the English name in the Korean field. A
              "Korean name" row that repeats the English one is worse than no
              row — it tells a taxi driver nothing (owner audit 2026-08-23). */}
          {/[가-힣]/.test(place.nameKr) && (
            <div className="place-address-detail-row">
              <span><T text={"Korean name"} /></span>
              <b lang="ko">{place.nameKr}</b>
              <ActionButton copy={place.nameKr} aria-label="Copy Korean name"><T text={"Copy"} /></ActionButton>
            </div>
          )}
          {place.address ? (
            <div className="place-address-detail-row">
              <span><T text={"Address"} /></span>
              <b lang="ko">{place.address}</b>
              <ActionButton copy={place.address} aria-label="Copy address"><T text={"Copy address"} /></ActionButton>
            </div>
          ) : (
            <div className="place-address-detail-row">
              <span><T text={"Address"} /></span>
              <b className="muted"><T text={"Not listed in our sources yet"} /></b>
            </div>
          )}
        </div>
      )}
      {!approximate && <TaxiCard place={place} />}
    </div>
  );
}

// ── Kakao-style action strip: [Save][Share][Copy name] ─────
// Sits between the title header and the anchor tabs. Call/Website left the
// strip for launch — the prototype's shared sample phone/URL misrepresented
// real businesses (launch audit P0-2); they return per-place once verified
// contact data exists.
function PlaceActions({ place }: { place: Place }) {
  const { t } = useLocale();
  const favs = useFavorites();
  const { toast, share } = useToast();
  const { nudge, sheet } = useSigninNudge();
  const saved = favs.place.includes(place.id);
  return (
    <div className="place-actions">
      {sheet}
      {/* our own map first — external Google/Kakao/Naver live in the CTA bar
          (user report 2026-08-16: no in-app path from detail to the map) */}
      <Link href={`${routes.map}?place=${encodeURIComponent(place.id)}`} aria-label={t("View on the MYSEOULDROP map")}>
        <Icon name="pin" />
        <span className="lbl"><T text={"Map"} /></span>
      </Link>
      <button
        className={saved ? "saved" : undefined}
        aria-pressed={saved}
        aria-label={t(saved ? "Remove from favorites" : "Add to favorites")}
        onClick={() => {
          const next = toggleFavorite("place", place.id);
          toast(t(next ? "Saved to favorites" : "Removed"));
          if (next) nudge("favorite", { savedPlace: { id: place.id, name: place.name } }); // guest-only, once per device
        }}
      >
        <Icon name={saved ? "heart" : "heart-o"} />
        <span className="lbl"><T text={"Save"} /></span>
      </button>
      <button onClick={() => share(`${place.name} on MYSEOULDROP`)}>
        <Icon name="share" />
        <span className="lbl"><T text={"Share"} /></span>
      </button>
      <ActionButton copy={`${place.name} · ${place.nameKr}`} aria-label="Copy place name">
        <Icon name="copy" />
        <span className="lbl"><T text={"Copy name"} /></span>
      </ActionButton>
    </div>
  );
}

// ── Home (d-home): visit-decision summary + actions ───────
function HomeSection({ place }: { place: PublishedPlace }) {
  const { t } = useLocale();
  const about = place.about || place.aboutKr;
  return (
    <section id="d-home" className="d-sec stack sm">
      <PublicStoreNotice contact={place.publishedContact} />
      {about && (
        <p className="small muted" style={{ margin: 0, lineHeight: 1.55 }}>{about}</p>
      )}
      {place.hours && (
        <div className="inforow">
          <Icon name="cal" size="xs" />
          <span><T text={"Today"} /></span>
          <HoursToday hours={place.hours} />
        </div>
      )}
      {place.stationWalk && !isApproximatePlace(place) && (
        <div className="inforow">
          <Icon name="locate" size="xs" />
          <span>
            <T text="{station} Stn." values={{ station: place.stationWalk.station }} />{place.stationWalk.exit ? ` ${t("Exit {exit}", { exit: place.stationWalk.exit })}` : ""}
          </span>
          <span className="caption muted chev"><T text="{minutes} min walk" values={{ minutes: place.stationWalk.minutes }} /></span>
        </div>
      )}
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
  const { t } = useLocale();
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
      <button type="button" className="taxicard" onClick={() => setOpen(true)}>
        <span className="ic"><Icon name="car" size="sm" /></span>
        <span><T text={"Show to taxi driver"} /></span>
        <Icon name="chev" size="xs" aria-hidden="true" />
      </button>
      {open && host && createPortal(
        <div className="modal" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div
            ref={dialogRef}
            className="box taxi-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t("Show this screen to the taxi driver")}
            tabIndex={-1}
          >
            <div className="taxi-modal-kicker">이 주소로 가주세요</div>
            <div className="caption muted"><T text={"Please take me to this address"} /></div>
            <div className="taxi-modal-name">{krName ?? place.name}</div>
            {place.address
              ? <div className="taxi-modal-addr">{place.address}</div>
              : <p className="small muted" style={{ marginTop: 8 }}><T text={"We don't have a street address for this place yet — show the name above and the map pin."} /> </p>}
            <div className="row" style={{ gap: 8, marginTop: 18 }}>
              <Button buttonRef={closeRef} variant="secondary" style={{ flex: 1 }} onClick={() => setOpen(false)}><T text={"Close"} /></Button>
              <ActionButton variant="primary" style={{ flex: 1 }} copy={[krName ?? place.name, place.address].filter(Boolean).join(", ")}><T text={"Copy"} /> </ActionButton>
            </div>
          </div>
        </div>,
        host,
      )}
    </>
  );
}

// ── Olive Young: a curated guide, with no branch inventory or ranking claim. ──
function OliveYoungPicks() {
  const picks = PRODUCTS
    .filter((p) => p.channel === "olive_young")
    .slice(0, 4);
  return (
    <>
      <div className="caption muted"><T text={"Curated product examples. Availability and prices are not verified for this branch."} /></div>
      <div>
        {picks.map((p) => (
          <Link key={p.id} className="listrow" href={routes.shopItem(p.id)}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ display: "block", fontSize: 13.5, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</b>
              <div className="caption muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.brand} · {p.nameKr}</div>
            </div>
            <Icon name="chev" size="xs" className="chev" style={{ color: "var(--dim)" }} />
          </Link>
        ))}
      </div>
      <Button variant="secondary" size="sm" href={routes.ranking}><T text={"Explore the product guide"} /> </Button>
    </>
  );
}

function DaisoPicks() {
  const picks = selectDaisoRanking("daily").slice(0, 4);
  return (
    <>
      <div className="caption muted"><T text={"Daiso Mall ranking — chain-wide chart, stock varies by branch."} /></div>
      <div>
        {picks.map(({ product: p, rank }) => (
          <Link key={p.id} className="listrow" href={routes.daisoProduct(p.productNo)}>
            <b className="mono num" style={{ width: 22, flex: "none", color: rank === 1 ? "var(--accent)" : "var(--muted)" }}>{rank}</b>
            <ProductThumbnail product={p} size={44} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ display: "block", fontSize: 13.5, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{daisoNameEn(p.productNo) || p.nameKr}</b>
              <div className="caption muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{daisoBrandEn(p.productNo) || p.brand} · {daisoSubcategoryEn(p.subcategoryKr)}</div>
            </div>
            <Icon name="chev" size="xs" className="chev" style={{ color: "var(--dim)" }} />
          </Link>
        ))}
      </div>
      <Button variant="secondary" size="sm" href={routes.rankingRetailer("daiso")}><T text={"See the full Daiso ranking"} /> </Button>
    </>
  );
}

function PlaceSourceNote({ place }: { place: Place }) {
  // Source records remain in the catalogue for attribution. Beauty booking
  // stays in MYSEOULDROP; never turn a competitor listing into a booking CTA.
  const label = place.source ? PLACE_SOURCE_LABEL[place.source] : "Source listing";
  return place.source ? <span className="caption muted"><T text="Source: {source}." values={{ source: label }} /></span> : null;
}

// Public service information requires an explicitly approved merchant/place link.
function ServicesSection({ place }: { place: Place }) {
  if (place.type === "olive_young") {
    return (
      <section id="d-services" className="d-sec stack sm">
        <SectionHeader title="Products" actionLabel="Product guide" href={routes.ranking} />
        <OliveYoungPicks />
      </section>
    );
  }
  if (place.type === "daiso") {
    return (
      <section id="d-services" className="d-sec stack sm">
        <SectionHeader title="Daiso Ranking" actionLabel="See all" href={routes.rankingRetailer("daiso")} />
        <DaisoPicks />
      </section>
    );
  }
  return (
    <section id="d-services" className="d-sec stack sm">
      <SectionHeader title="Services" />
      <PublicServiceMenu placeId={place.id} fallback={
        <p className="small muted"><T text={"Verified services and prices are not available yet."} /></p>
      } />
      {place.type === "skin_clinic" && (
        <Notice tone="warning" icon="cross"><T text={"Medical procedures require a consultation before booking. MYSEOULDROP does not provide medical advice."} /> </Notice>
      )}

    </section>
  );
}

function PlacePhotoCollage({ photos, placeName, brandFallback = false, media, fullGallery = false }: { photos: readonly string[]; placeName: string; brandFallback?: boolean; media?: PublishedPlace['publishedMedia']; fullGallery?: boolean }) {
  const visiblePhotos = fullGallery ? photos : photos.slice(0, 3);
  const hasThreePhotos = !fullGallery && visiblePhotos.length >= 3;

  if (visiblePhotos.length === 0) {
    const emptyMedia = (
      <div className="place-photo-empty">
        <span><T text={"No photos yet"} /></span>
      </div>
    );
    return brandFallback ? <OliveYoungBrandHero className="olive-young-detail-brand-hero" fallback={emptyMedia} /> : emptyMedia;
  }

  return (
    <div
      className="place-photo-collage"
      style={{
        display: "grid",
        gridTemplateColumns: visiblePhotos.length === 1 ? "1fr" : fullGallery ? "repeat(2, minmax(0, 1fr))" : "1.4fr 1fr",
        gridAutoRows: "170px",
        gridTemplateRows: hasThreePhotos ? "82px 82px" : "170px",
        gap: 6,
        overflow: "hidden",
        borderRadius: 14,
      }}
    >
      {visiblePhotos.map((src, index) => (
        // Owner-supplied photos are local, same-origin assets generated by
        // scripts/build-place-photos.mjs; browser-native img avoids remote-host config.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          width={media?.find(item => item.url === src)?.width}
          height={media?.find(item => item.url === src)?.height}
          alt={`${placeName} photo ${index + 1} of ${photos.length}`}
          style={{
            width: "100%",
            height: "100%",
            minWidth: 0,
            objectFit: "contain",
            gridRow: hasThreePhotos && index === 0 ? "1 / 3" : undefined,
            background: "var(--soft)",
          }}
        />
      ))}
    </div>
  );
}

// ── Photos (d-photos): verified gallery or honest empty state ────
function PhotosSection({ place }: { place: PublishedPlace }) {
  const { t } = useLocale();
  const photos = place.photos ?? [];
  return (
    <section id="d-photos" className="d-sec stack sm">
      <SectionHeader title={photos.length > 0 ? `${t("Photos")} · ${photos.length}` : "Photos"} />
      <PlacePhotoCollage fullGallery photos={photos} media={place.publishedMedia} placeName={place.name} />
      {photos.length === 0 && (
        <span className="caption muted"><T text={"Real photos are on the way — we're collecting them place by place."} /></span>
      )}
    </section>
  );
}

// ── Public traveler reviews — masked view + report flow ───
// (리뷰 공개 전환 2026-08-16.) Only reviews whose author ticked "Post
// publicly" appear; first names only; 3 distinct reports auto-hide a row.
function TravelerReviews({ placeId, refreshKey }: { placeId: string; refreshKey: number }) {
  const { t, locale } = useLocale();
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
      <b style={{ fontSize: 14.5 }}><T text={"Traveler reviews"} />{reviews.length > 0 ? ` · ${reviews.length}` : ""}</b>
      {reviews.length === 0 ? (
        <p className="caption muted" style={{ margin: 0 }}><T text={"No traveler reviews yet — rate your visit and be the first."} /></p>
      ) : reviews.map((r) => (
        <div key={r.id} className="stack" style={{ gap: 4, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 12px" }}>
          <div className="row" style={{ gap: 8 }}>
            <b style={{ fontSize: 13 }}>{r.displayName}{r.mine ? ` (${t("you")})` : ""}</b>
            <span className="stars" style={{ fontSize: 12 }}>{starsFor(r.rating)}</span>
            <span className="caption muted chev">{locale === "en" ? timeAgo(r.at) : new Date(r.at).toLocaleDateString(locale)}</span>
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
                    toast(t(res === "reported"
                      ? "Reported — our team will take a look"
                      : res === "already"
                        ? "You already reported this review"
                        : "Sign in to report reviews"));
                  }}
                >
                  <T text={reason.label} />
                </button>
              ))}
              <button className="caption muted" onClick={() => setReporting(null)}><T text={"Cancel"} /></button>
            </div>
          ) : (
            <button className="caption" style={{ color: "var(--dim)", alignSelf: "flex-start" }} onClick={() => setReporting(r.id)}><T text={"Report"} /> </button>
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
  const { t } = useLocale();
  const { toast } = useToast();
  // Shared store — persists per place, syncs to the account when signed in.
  const myRatings = useMyRatings();
  const ready = useMyRatingsReady();
  const { user, loading } = useAuthUser();
  const myRating = user ? myRatings[place.id]?.rating ?? null : null;
  const myReview = user ? myRatings[place.id]?.body ?? "" : "";
  const { nudge: nudgeRating, sheet: ratingNudgeSheet } = useSigninNudge();
  const [draftRating, setDraftRating] = useState(0);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");
  const [postPublic, setPostPublic] = useState(false);
  const [reviewBump, setReviewBump] = useState(0);
  const [savingReview, setSavingReview] = useState(false);

  useEffect(() => {
    setComposing(false);
    setDraft("");
    setDraftRating(0);
    setPostPublic(false);
  }, [user?.id, place.id]);

  const beginReview = (n = myRating ?? 0) => {
    if (loading || !ready) return;
    if (!user) { nudgeRating("rating"); return; }
    setDraftRating(n);
    setDraft(myReview);
    setPostPublic(myRatings[place.id]?.isPublic === true);
    setComposing(true);
  };

  const saveReview = async () => {
    if (!user) { nudgeRating("rating"); return; }
    if (draftRating < 1 || savingReview) return;
    setSavingReview(true);
    const saved = await setReview(place.id, draftRating, draft, postPublic);
    setSavingReview(false);
    if (saved === "auth-required") {
      toast(t("Please sign in again to save your rating and review."));
      nudgeRating("rating");
      return;
    }
    if (!saved) {
      toast(t("Couldn’t save your review. Your draft is still here — please try again."));
      return;
    }
    setComposing(false);
    toast(t(draft.trim()
      ? postPublic ? "Review posted — travelers can now see it" : "Review saved as a private note"
      : "Rating saved"));
    setReviewBump((b) => b + 1);
  };

  const selectedRating = composing && user ? draftRating : myRating ?? 0;

  return (
    <section id="d-reviews" className="d-sec stack">
      {ratingNudgeSheet}
      {/* Rate prompt — tappable stars, persisted per place */}
      <div className="stack sm" style={{ alignItems: "flex-start", textAlign: "left" }}>
        <b style={{ fontSize: 14.5 }}><T text={"Been here? Rate your visit"} /></b>
        <div className="row" style={{ gap: 6, justifyContent: "center" }} role="group" aria-label={t("Rate {rating} of 5 stars", { rating: selectedRating })}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              aria-label={t("Rate {rating} stars", { rating: n })}
              disabled={loading || !ready || savingReview}
              aria-pressed={selectedRating === n}
              onClick={() => composing && user ? setDraftRating(n) : beginReview(n)}
              style={{ fontSize: 24, lineHeight: 1, padding: "0 2px", color: n <= selectedRating ? "var(--warning)" : "var(--dim)" }}
            >
              {n <= selectedRating ? "★" : "☆"}
            </button>
          ))}
        </div>
        {myRating !== null && !composing && (
          <span className="caption muted"><T text={myRating === 1 ? "You rated {rating} star" : "You rated {rating} stars"} values={{ rating: myRating }} /> ·{" "}
            <button className="caption" style={{ color: "var(--accent)", fontWeight: 600 }} onClick={() => beginReview()}><T text={"Edit"} /></button>
          </span>
        )}

        {/* Stars and optional review text are saved together after sign-in. */}
        {!(composing && user) && (
          myReview ? (
            <div className="stack sm" style={{ width: "100%", textAlign: "left", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 12px" }}>
              <span className="t-caption"><T text="Your review · {visibility}" values={{ visibility: t(myRatings[place.id]?.isPublic ? "public" : "private note") }} /></span>
              <p className="small" style={{ whiteSpace: "pre-wrap" }}>{myReview}</p>
              <button className="caption" style={{ color: "var(--accent)", fontWeight: 600, alignSelf: "flex-start" }} onClick={() => beginReview()}><T text={"Edit review"} /> </button>
            </div>
          ) : (
            <button className="caption" disabled={loading || !ready} style={{ color: "var(--accent)", fontWeight: 600 }} onClick={() => beginReview()}><T text={"Write a review"} /> </button>
          )
        )}
        {composing && user && !loading && ready && (
          <div className="stack sm" style={{ width: "100%", textAlign: "left" }}>
            <span className="caption muted"><T text={"Choose your stars above. Add a review if you like."} /></span>
            <textarea
              className="input"
              aria-label={t("Your review")}
              placeholder={t("How was your visit? Tips for other travelers welcome.")}
              rows={4}
              maxLength={REVIEW_MAX_LEN}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              style={{ resize: "none", minHeight: 88, lineHeight: 1.45 }}
              autoFocus
            />
            {/* terms promise consent-first publishing — this checkbox IS the consent */}
            {draft.trim() && <label className="row caption" style={{ gap: 8, alignItems: "flex-start", cursor: "pointer" }}>
              <input type="checkbox" checked={postPublic} onChange={(e) => setPostPublic(e.target.checked)} style={{ marginTop: 1 }} />
              <span className="muted"><T text={"Post publicly — share this review with other travelers. Leave unchecked to keep it private."} /></span>
            </label>}
            <div className="row" style={{ gap: 8 }}>
              <Button variant="secondary" size="sm" style={{ flex: 1 }} onClick={() => setComposing(false)}><T text={"Cancel"} /></Button>
              <Button size="sm" style={{ flex: 1 }} disabled={savingReview || draftRating < 1} onClick={saveReview}>
                <T text={savingReview ? "Saving…" : draft.trim() ? "Save review" : "Save rating"} />
              </Button>
            </div>
          </div>
        )}
      </div>
      {/* Source-listing rating — the one review signal that's real data.
          Curated rows have synthetic numbers, so they show nothing here. */}
      {place.source !== "curated" && place.rating !== undefined && (
        <div className="stack sm">
          <span className="caption muted"><T text={"Imported listing rating"} /></span>
          <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
            <span style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.2 }}>{place.rating.toFixed(1)}</span>
            <span className="stars">{starsFor(place.rating)}</span>
            {place.ratingCount !== undefined && (
              <span className="caption muted"><T text="{count} ratings" values={{ count: place.ratingCount }} /></span>
            )}
          </div>
        </div>
      )}
      <TravelerReviews placeId={place.id} refreshKey={reviewBump} />
    </section>
  );
}

/** What the retailer's own store finder says this branch can do.
 *
 *  These decide a visit for a foreign visitor — whether the branch does a tax
 *  refund, sells a SIM, or refuses cash — and until 2026-09-23 the app held
 *  every one of them and showed none. "Card only" leads because it is the one
 *  that turns someone away at the till. */
const STORE_FACT_LABELS: Record<string, string> = {
  "cashless-store": "Card only, no cash",
  "tax-refund": "Tax refund",
  "sim-card": "SIM cards",
  "store-pickup": "Store pickup",
  "photo-sticker": "Photo booth",
  "name-sticker": "Name stickers",
  parking: "Parking",
  elevator: "Elevator",
  "entrance-ramp": "Step-free entrance",
};
const STORE_FACT_ORDER = Object.keys(STORE_FACT_LABELS);

function StoreFactsRow({ place }: { place: Place }) {
  const facts = [...new Set([...(place.serviceTags ?? []), ...(place.facilities ?? [])])]
    .filter((key) => key in STORE_FACT_LABELS)
    .sort((a, b) => STORE_FACT_ORDER.indexOf(a) - STORE_FACT_ORDER.indexOf(b));
  if (facts.length === 0) return null;
  return (
    <div className="inforow store-facts">
      <Icon name="mark" size="xs" />
      <span className="store-facts-label"><T text={"In store"} /></span>
      <span className="store-facts-values">
        {facts.map((key) => (
          <span
            key={key}
            className={key === "cashless-store" ? "store-fact is-important" : "store-fact"}
          >
            <T text={STORE_FACT_LABELS[key]} />
          </span>
        ))}
      </span>
    </div>
  );
}

// ── Info (d-info): full details — Naver home/info split ───
function InfoSection({ place }: { place: PublishedPlace }) {
  const { t } = useLocale();
  const { toast } = useToast();
  // A Vercel server's date can differ from the visitor's local date. Delay
  // today/open-state decoration until hydration has completed on the device.
  const [today, setToday] = useState<number | null>(null);
  useEffect(() => setToday(new Date().getDay()), []);
  return (
    <section id="d-info" className="d-sec stack sm">
      <h2 className="h2" style={{ fontFamily: "var(--sans)", fontSize: 16, fontWeight: 700 }}><T text={"Information"} /></h2>
      {place.hours && (
        <Collapse summary={<b><T text={"Hours"} />{today !== null ? ` · ${t(statusLabel(place.hours))}` : ""}</b>}>
          <div className="stack" style={{ gap: 4, padding: "8px 4px" }}>
            {WEEKDAYS.map((d, i) => {
              // Each row reads its own day. A uniform week answers the same
              // seven times; a per-day week gives Saturday its real opening and
              // marks a closed day closed instead of repeating a time.
              const dayHours = hoursOn(place.hours, i);
              const isToday = today !== null && i === today;
              return (
                <div key={d} className="row between small" style={{ fontWeight: isToday ? 700 : 400, color: isToday ? "var(--text)" : "var(--muted)" }}>
                  <span>{t(d)}{isToday ? ` (${t("today")})` : ""}</span>
                  <span className="mono">{dayHours ? `${dayHours.open} – ${dayHours.close}` : t("Closed")}</span>
                </div>
              );
            })}
          </div>
        </Collapse>
      )}
      <PublicStoreContact contact={place.publishedContact} />
      <div className="inforow">
        <Icon name="languages" size="xs" />
        <span><T text={"English"} /></span>
        <span className="caption muted chev"><T text={place.englishOk ? "Staff can assist in English" : "Translation app recommended"} /></span>
      </div>
      {/* The facility chips pulled in the launch audit were one invented
          sample repeated on every place. These are per-place and come from the
          retailer's own store finder, which is the condition that removal was
          waiting on. Nothing renders when a place has no such data. */}
      <StoreFactsRow place={place} />
      {place.priceRange && (
        <div className="inforow">
          <span className="muted" style={{ width: 20, textAlign: "center", flex: "none" }} aria-hidden="true">₩</span>
          <span><T text={"Price range"} /></span>
          <span className="chev mono" style={{ fontWeight: 600 }}>{place.priceRange}</span>
        </div>
      )}
      {/* provenance disclosure (data-ledger slice) */}
      <p className="caption muted" style={{ marginTop: 4 }}>
        <T text={place.publishedContact
          ? "Store information provided by the venue. Other listing details come from our sources."
          : place.source === "daiso"
          ? place.nameVerification === "provisional"
            ? "Official Daiso store listing — the English display name is provisional and has not yet been verified on Naver Map or Google. Confirm important details before visiting."
            : place.nameVerification === "derived"
              ? "Official Daiso store listing — the English display name comes from the official station name or the chain's own English branding, not from the store's own sign. Confirm important details before visiting."
              : "Official Daiso store listing — details can change. Confirm important ones before visiting."
          : place.source === "curated"
            ? "Curated pick — details compiled by our team and not yet venue-verified. Confirm before visiting."
            : place.source === "olive_young"
              ? "Listed on Olive Young's own store finder — the English display name is ours, not the store's sign. Details can change; confirm important ones before visiting."
              : "Listed from public sources — details can change. Confirm important ones before visiting."} />
        <T text={isApproximatePlace(place)
          ? place.locationVerification === "provisional"
            ? " Provisional location — the map pin is neighborhood-level; use the map-service button to confirm the storefront before visiting."
            : " Map pin is approximate (neighborhood-level)."
          : ""} />
      </p>
      <PlaceSourceNote place={place} />
      <PlaceCorrectionLauncher place={place} />
    </section>
  );
}

// ── Nearby places — distance order is not a quality ranking. ───────
function NearbySection({ place }: { place: Place }) {
  const { t } = useLocale();
  const nearby = PLACES
    .filter((p) => p.type === place.type && p.id !== place.id)
    .map((p) => ({ p, km: haversineKm({ lat: place.lat, lng: place.lng }, { lat: p.lat, lng: p.lng }) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, 4);
  if (nearby.length === 0) return null;
  return (
    <section className="stack sm">
      <SectionHeader title={`${t("Nearby places")} · ${t(TYPE_LABEL[place.type])}`} />
      <div>
        {nearby.map(({ p, km }) => (
          <Link key={p.id} className="listrow" href={routes.place(p.id)}>
            <PlaceThumbnail place={p} size={44} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</b>
              <div className="caption muted">
                {zoneShort(p.zone)}
                {isApproximatePlace(p) ? ` · ${t("Approximate pin")}` : !isApproximatePlace(place) ? ` · ${formatDistance(km)}` : ""}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Compact-bar ⋮ menu — closes on outside tap / Escape. */
function MoreMenu({ place }: { place: Place }) {
  const { t } = useLocale();
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
        <div className="detail-menucard" role="menu" aria-label={t("Place actions")} onKeyDown={onMenuKeyDown}>
          <button ref={(node) => { menuItemRefs.current[0] = node; }} type="button" role="menuitem" tabIndex={-1} onClick={pick(() => copy(window.location.href))}><T text={"Copy link"} /></button>
          <button ref={(node) => { menuItemRefs.current[1] = node; }} type="button" role="menuitem" tabIndex={-1} onClick={pick(() => share(`${place.name} on MYSEOULDROP`))}><T text={"Share"} /></button>
          {/* codex cross-check #5: the old thank-you toast faked a report —
              route to the real feedback channel instead */}
          <button ref={(node) => { menuItemRefs.current[2] = node; }} type="button" role="menuitem" tabIndex={-1} onClick={pick(() => router.push(routes.support))}><T text={"Report an issue"} /></button>
        </div>
      )}
    </div>
  );
}

/** Place detail D-1 (spec §4.6): photo collage + title block + sticky anchor tabs
    over a single scroll of divided sections, plus the D-2 compact bar (§4.7) that
    fades in once the photo header scrolls out. Header chrome (back/share/favorite)
    and the CTA bar stay with callers. */
export function PlaceDetailBody({ place, heroOverlay, onCollapse }: {
  place: PublishedPlace;
  heroOverlay?: ReactNode;
  onCollapse?: () => void;
}) {
  const { t } = useLocale();
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
          <IconButton name="down" label="Collapse" onClick={onCollapse ?? (() => router.back())} />
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
        <PlacePhotoCollage photos={place.photos ?? (place.photoUrl ? [place.photoUrl] : [])} media={place.publishedMedia} placeName={place.name} brandFallback={place.type === "olive_young"} />
        {onCollapse && (
          <IconButton
            name="down"
            label="Collapse place details"
            variant="overlay"
            size={44}
            className="place-detail-collapse"
            onClick={onCollapse}
          />
        )}
        {heroOverlay}
      </div>

      <div className="pad place-detail-intro">
        <TitleBlock place={place} km={km} />
      </div>

      {/* Kakao-style action strip — under the title header, above the tabs */}
      <PlaceActions place={place} />

      {/* §4.6 sticky anchor tabs with scroll-spy */}
      <AnchorTabs sections={SECTIONS.map(section => ({ ...section, label: t(section.label) }))} offset={STICKY_OFFSET} />

      <div className="pad stack">
        <HomeSection place={place} />
        <SectionDivider />
        <ServicesSection place={place} />
        <SectionDivider />
        <PhotosSection place={place} />
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
