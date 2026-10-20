"use client";

import { T } from "@/lib/i18n/locale-provider";
import { Icon } from "@/components/icon";
import { OliveYoungBrandHero } from "@/components/place/olive-young-brand-hero";
import { LiveBadge } from "@/components/ui/live-badge";
import { TYPE_LABEL, type Place } from "@/lib/data";
import { formatCompactDistance } from "@/lib/geo";
import { isApproximatePlace } from "@/lib/places";

export function SelectedPlaceSummary({
  place,
  km,
  variant,
  onOpen,
  onDismiss,
}: {
  place: Place;
  km: number;
  variant: "half" | "compact";
  onOpen?: () => void;
  onDismiss?: () => void;
}) {
  const titleId = `selected-place-summary-${variant}-${place.id}`;
  const approximate = isApproximatePlace(place);
  const accessibleName = place.nameKr && place.nameKr !== place.name
    ? `${place.name}, ${place.nameKr}`
    : place.name;

  // `photos` is the future shape; `photoUrl` is what the type carries today.
  const photos: string[] = (place.photos ?? (place.photoUrl ? [place.photoUrl] : [])).filter(Boolean);
  const emptyMedia = (
    <div className="selected-place-summary-no-photo">
      <span><T text={"No photos yet"} /></span>
    </div>
  );

  if (variant === "compact") {
    return (
      <article className="selected-place-summary compact" aria-labelledby={titleId}>
        <button
          type="button"
          className="selected-place-summary-main"
          onClick={onOpen}
          aria-label={`Open ${accessibleName}`}
        >
          <div className="selected-place-summary-copy">
            <div className="selected-place-summary-title-row">
              <h2 id={titleId} className="selected-place-summary-title">
                <span className="place-name-primary">{place.name}</span>
              </h2>
              <span className="selected-place-summary-category"><T text={TYPE_LABEL[place.type]} /></span>
            </div>
            {place.nameKr && place.nameKr !== place.name && (
              <div className="place-name-secondary" lang="ko">{place.nameKr}</div>
            )}
            <div className="selected-place-summary-meta" aria-label="Place summary">
              <LiveBadge hours={place.hours} />
              {place.source !== "curated" && place.rating !== undefined && (
                <span className="map-meta-token stars">
                  ★{place.rating}{place.ratingCount !== undefined ? ` (${place.ratingCount})` : ""}
                </span>
              )}
              {place.priceRange && <span className="map-meta-token mono">{place.priceRange}</span>}
              {approximate && (
                <span className="map-meta-token"><T text={"Approximate pin"} /></span>
              )}
            </div>
            <div className="selected-place-summary-address">
              {!approximate && <span className="map-meta-token mono">{formatCompactDistance(km)}</span>}
              {place.address && <>{!approximate && <span aria-hidden="true">·</span>}
              <span className="selected-place-summary-address-copy">{place.address}</span></>}
              {!place.address && <span className="selected-place-summary-address-copy"><T text={"Address not listed"} /></span>}
            </div>
          </div>
        </button>
        <button
          type="button"
          className="selected-place-summary-close"
          onClick={onDismiss}
          aria-label={`Close ${accessibleName}`}
        >
          <Icon name="x" size="xs" aria-hidden="true" />
        </button>
      </article>
    );
  }

  return (
    <article className="selected-place-summary half" aria-labelledby={titleId}>
      <div className="selected-place-summary-header">
        <div className="selected-place-summary-copy">
          <div className="selected-place-summary-title-row">
            <h2 id={titleId} className="selected-place-summary-title">
              <span className="place-name-primary">{place.name}</span>
            </h2>
            <span className="selected-place-summary-category"><T text={TYPE_LABEL[place.type]} /></span>
          </div>
          {place.nameKr && place.nameKr !== place.name && (
            <div className="place-name-secondary" lang="ko">{place.nameKr}</div>
          )}
          <div className="selected-place-summary-meta" aria-label="Place summary">
            <LiveBadge hours={place.hours} />
            {place.source !== "curated" && place.rating !== undefined && (
              <span className="map-meta-token stars">
                ★{place.rating}{place.ratingCount !== undefined ? ` (${place.ratingCount})` : ""}
              </span>
            )}
            {place.priceRange && <span className="map-meta-token mono">{place.priceRange}</span>}
            {place.englishOk && <span><T text={"English OK"} /></span>}
            {approximate && (
              <span className="map-meta-token"><T text={"Approximate pin"} /></span>
            )}
          </div>
          <div className="selected-place-summary-address">
            <Icon name="pin" size="xs" aria-hidden="true" />
            <span className="selected-place-summary-address-copy">
              {!approximate && <><span className="map-meta-token mono">{formatCompactDistance(km)}</span><span aria-hidden="true"> · </span></>}
              {/* the source's own "not enough information" placeholder is
                  normalised to empty upstream — say so plainly instead */}
              {place.address || <T text="Address not listed" />}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="selected-place-summary-close"
          onClick={onDismiss}
          aria-label={`Close ${accessibleName}`}
        >
          <Icon name="x" size="xs" aria-hidden="true" />
        </button>
      </div>
      {/* Verified store photos always take precedence over a chain image. */}
      {photos.length > 0 ? (
        <div
          className="selected-place-summary-media-rail"
          role="group"
          aria-label={`${place.name} photos — swipe for more`}
        >
          {photos.map((src, i) => (
            <div key={src} className="selected-place-summary-media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`${place.name} photo ${i + 1} of ${photos.length}`}
                loading={i < 2 ? "eager" : "lazy"}
                decoding="async"
              />
            </div>
          ))}
        </div>
      ) : place.type === "olive_young" && photos.length === 0 ? (
        <div className="selected-place-summary-media-grid">
          <OliveYoungBrandHero className="selected-place-summary-media" fallback={emptyMedia} />
        </div>
      ) : emptyMedia}
    </article>
  );
}
