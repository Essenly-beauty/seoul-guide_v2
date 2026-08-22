"use client";

import { MapLinkButtons } from "@/components/directions/map-link-buttons";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { Icon } from "@/components/icon";
import { useToast } from "@/components/ui/toast";
import { useLocation } from "@/components/map/use-location";
import type { Place } from "@/lib/data";

/** Bottom bar for the selected-pin sheet (owner request 2026-08-22, Kakao
    Map pattern): save and share on the left, the three route hand-offs on
    the right. It replaces the tab bar while a pin is active, so the card is
    never clipped by chrome the visitor cannot act on. */
export function SelectedPlaceActionBar({ place }: { place: Place }) {
  const { loc } = useLocation();
  const { share } = useToast();
  return (
    <div className="bookbar selected-place-actions">
      <div className="selected-place-actions-quick">
        <FavoriteButton kind="place" id={place.id} variant="soft" size="sm" />
        <button
          type="button"
          className="selected-place-action-icon"
          aria-label={`Share ${place.name}`}
          onClick={() => share({ title: place.name, text: `${place.name} on MYSEOULDROP`, url: `${window.location.origin}/place/${place.id}` })}
        >
          <Icon name="share" size="sm" aria-hidden="true" />
        </button>
      </div>
      <div className="selected-place-actions-routes">
        <MapLinkButtons place={place} origin={loc} />
      </div>
    </div>
  );
}
