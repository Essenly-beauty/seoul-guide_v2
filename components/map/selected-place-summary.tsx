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
      <div className={`selected-place-summary-media-grid${place.photoUrl ? " has-photo" : " is-empty"}`}>
        {place.photoUrl ? (
          <div className="selected-place-summary-media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={place.photoUrl} alt={`${place.name} storefront`} />
          </div>
        ) : (
          <div className="selected-place-summary-media" role="img" aria-label={`${place.name} photos coming soon`}>
            <Icon name="pin" size="sm" aria-hidden="true" />
            <span>Photos coming soon</span>
          </div>
        )}
      </div>
    </article>
  );
}
