"use client";

import { Icon } from "@/components/icon";
import { DirectionsLauncher } from "@/components/directions/directions-sheet";
import { BookingSheet } from "@/components/booking/booking-sheet";
import { ChannelSheet } from "@/components/booking/channel-sheet";
import { isBookable, statusLabel } from "@/lib/places";
import { naverMapUrl } from "@/lib/geo";
import type { Place } from "@/lib/data";

/** Sticky bottom CTA: Naver-direct directions + per-category booking (spec §4.4). */
export function PlaceCtaBar({ place }: { place: Place }) {
  return (
    <div className="bookbar" style={{ gap: 8 }}>
      <a className="btn ghost" style={{ flex: 1 }} href={naverMapUrl(place.nameKr)} target="_blank" rel="noopener noreferrer">
        <Icon name="pin" size="sm" /> Directions
      </a>
      <DirectionsLauncher
        className="iconbtn bordered"
        place={{ name: place.name, nameKr: place.nameKr, address: place.address, lat: place.lat, lng: place.lng }}
      >
        <Icon name="ext" size="sm" aria-label="Other maps" />
      </DirectionsLauncher>
      {place.type === "skin_clinic" && <BookingSheet triggerStyle={{ flex: 1 }} />}
      {place.type !== "skin_clinic" && isBookable(place) && <ChannelSheet place={place} triggerStyle={{ flex: 1 }} />}
      {!isBookable(place) && place.hours && (
        <span className="small muted" style={{ flex: 1, textAlign: "center" }}>{statusLabel(place.hours)}</span>
      )}
    </div>
  );
}
