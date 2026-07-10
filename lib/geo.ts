/** Pure geo helpers: distance math + keyless map deep links. */

export type LatLng = { lat: number; lng: number };

/** Fallback center when geolocation is denied/unavailable (Myeongdong). */
export const MYEONGDONG: LatLng = { lat: 37.5636, lng: 126.9838 };

/** Fallback center when geolocation is denied/unavailable (Gangnam Station). */
export const GANGNAM_STATION: LatLng = { lat: 37.4979, lng: 127.0276 };

const EARTH_KM = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(s));
}

export function formatDistance(km: number): string {
  if (km < 1) {
    const m = Math.round((km * 1000) / 10) * 10;
    // Rounding can push meters up to (or past) 1000 (e.g. 0.996 → 1000m) — render as km instead.
    if (m < 1000) return `${m} m`;
  }
  return `${km.toFixed(1)} km`;
}

/** Walking time at ~67 m/min (casual pace), minimum 1 minute. */
export function walkMinutes(km: number): number {
  return Math.max(1, Math.round((km * 1000) / 67));
}

// ── Keyless map links (web URLs; mobile OS hands off to the installed app) ──

export function kakaoMapUrl(name: string, lat: number, lng: number): string {
  return `https://map.kakao.com/link/map/${encodeURIComponent(name)},${lat},${lng}`;
}

export function naverMapUrl(nameKr: string): string {
  return `https://map.naver.com/p/search/${encodeURIComponent(nameKr)}`;
}

export function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}
