import type { Place } from '@/lib/data';
import { isApproximatePlace } from '@/lib/places';
import { publicStoreProfile } from '@/lib/partner/profile-contracts';
import { exactKeys, record } from '@/lib/partner/contracts';

export type BookingLocation = {
  placeId: string;
  name: string;
  nameKr: string;
  address: string;
  coordinates: { lat: number; lng: number } | null;
};
function coordinates(value: unknown): value is NonNullable<BookingLocation['coordinates']> {
  return record(value) && exactKeys(value, ['lat', 'lng']) && typeof value.lat === 'number' && Number.isFinite(value.lat) && Math.abs(value.lat) <= 85 && typeof value.lng === 'number' && Number.isFinite(value.lng) && Math.abs(value.lng) <= 180;
}
export function bookingLocation(value: unknown): value is BookingLocation {
  return record(value) && exactKeys(value, ['placeId', 'name', 'nameKr', 'address', 'coordinates']) &&
    typeof value.placeId === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,199}$/.test(value.placeId) &&
    [value.name, value.nameKr, value.address].every(text => typeof text === 'string' && text.length <= 1000) &&
    (value.coordinates === null || coordinates(value.coordinates));
}
/** Reviewed address changes invalidate the directory pin until its coordinates are verified. */
export function resolveBookingLocation(placeId: string, source: Place | undefined, published: unknown): BookingLocation | null {
  const place = source?.id === placeId ? source : undefined;
  const profile = publicStoreProfile(published) && published.placeId === placeId && published.status === 'published' ? published.profile : null;
  if (!place && !profile) return null;
  const address = profile?.address ?? place?.address ?? '';
  const point = place ? { lat: place.lat, lng: place.lng } : null;
  const exact = place && !isApproximatePlace(place) && coordinates(point) && address.trim() === place.address.trim();
  return {
    placeId, name: profile ? profile.nameEn || profile.nameKo : place!.name,
    nameKr: profile?.nameKo ?? place!.nameKr, address, coordinates: exact ? point : null,
  };
}
