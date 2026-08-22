"use client";

import { Icon } from "@/components/icon";
import { LiveBadge } from "@/components/ui/live-badge";
import { TYPE_LABEL, type Place } from "@/lib/data";
import { formatCompactDistance } from "@/lib/geo";

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

  // `photos` is the future shape; `photoUrl` is what the type carries today.
  const photos: string[] = (place.photos ?? (place.photoUrl ? [place.photoUrl] : [])).filter(Boolean);

  if (variant === "compact") {
    return (
      <article className="selected-place-summary compact" aria-labelledby={titleId}>
        <button
          type="button"
          className="selected-place-summary-main"
          onClick={onOpen}
          aria-label={`Open ${place.name}`}
        >
          <div className="selected-place-summary-copy">
            <div className="selected-place-summary-title-row">
              <h2 id={titleId} className="selected-place-summary-title">{place.name}</h2>
              <span className="selected-place-summary-category">{TYPE_LABEL[place.type]}</span>
            </div>
            <div className="selected-place-summary-meta" aria-label="Place summary">
              <LiveBadge hours={place.hours} />
              {place.rating !== undefined && (
                <span className="map-meta-token stars">
                  ★{place.rating}{place.ratingCount !== undefined ? ` (${place.ratingCount})` : ""}
                </span>
              )}
              <span className="map-meta-token mono">{place.priceRange}</span>
            </div>
            <div className="selected-place-summary-address">
              <span className="map-meta-token mono">{formatCompactDistance(km)}</span>
              <span aria-hidden="true">·</span>
              <span className="selected-place-summary-address-copy">{place.address}</span>
            </div>
          </div>
        </button>
        <button
          type="button"
          className="selected-place-summary-close"
          onClick={onDismiss}
          aria-label={`Close ${place.name}`}
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
            <h2 id={titleId} className="selected-place-summary-title">{place.name}</h2>
            <span className="selected-place-summary-category">{TYPE_LABEL[place.type]}</span>
          </div>
          {place.nameKr && place.nameKr !== place.name && (
            <div className="selected-place-summary-name-kr">{place.nameKr}</div>
          )}
          <div className="selected-place-summary-meta" aria-label="Place summary">
            <LiveBadge hours={place.hours} />
            {place.rating !== undefined && (
              <span className="map-meta-token stars">
                ★{place.rating}{place.ratingCount !== undefined ? ` (${place.ratingCount})` : ""}
              </span>
            )}
            <span className="map-meta-token mono">{place.priceRange}</span>
            {place.englishOk && <span>English OK</span>}
          </div>
          <div className="selected-place-summary-address">
            <Icon name="pin" size="xs" aria-hidden="true" />
            <span className="selected-place-summary-address-copy">
              <span className="map-meta-token mono">{formatCompactDistance(km)}</span>
              <span aria-hidden="true"> · </span>
              {place.address}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="selected-place-summary-close"
          onClick={onDismiss}
          aria-label={`Close ${place.name}`}
        >
          <Icon name="x" size="xs" aria-hidden="true" />
        </button>
      </div>
      {/* Two-up swipeable rail (owner request 2026-08-22). It renders only
          the photos a place actually has — no place in the dataset carries
          one yet, so today every card falls to the single honest empty
          state rather than padding the rail with decoy tiles. */}
      {photos.length > 0 ? (
        <div
          className="selected-place-summary-media-rail"
          role="group"
          aria-label={`${place.name} photos — swipe for more`}
        >
          {photos.map((src, i) => (
            <div key={src} className="selected-place-summary-media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`${place.name} photo ${i + 1} of ${photos.length}`} />
            </div>
          ))}
        </div>
      ) : (
        <div className="selected-place-summary-media-grid is-empty">
          <div className="selected-place-summary-media" role="img" aria-label={`${place.name} photos coming soon`}>
            <Icon name="pin" size="sm" aria-hidden="true" />
            <span>Photos coming soon</span>
          </div>
        </div>
      )}
    </article>
  );
}
