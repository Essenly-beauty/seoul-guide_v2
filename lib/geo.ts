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

/** Dense map metadata keeps the numeric value and its unit as one visual token. */
export function formatCompactDistance(km: number): string {
  return formatDistance(km).replaceAll(" ", "");
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

// ── Route deep links (spec v2 §6): origin (my location) → destination.
//    origin is optional — without location permission each service falls back
//    to a destination-only link and resolves the start point itself.

/** A destination Google can name. With `name` set, the hand-off sends
 *  "<name>, <address>" as text instead of coordinates.
 *
 *  Owner report 2026-09-27, from the Google Maps app: both ends of the route
 *  read "핀 고정 위치" (dropped pin). Google's URL scheme has no label for a
 *  coordinate destination — a "(label)" after lat,lng is ignored, checked in
 *  a browser — so the only way to show the shop's name is to send text and
 *  let Google geocode it. The trade is exactness: the pin lands where Google
 *  puts the address, not on our coordinate. For a shop with a road address
 *  that is the same building. The floor is stripped off first ("1~2층", "B1")
 *  because it is noise to a geocoder. */
export type NamedDestination = LatLng & { name?: string; address?: string };

// No \b after the floor token: Hangul is not a "word" character to the
// regex engine, so a boundary between 층 and the end of the string never
// matches, and "703 1층" was going through untouched. The floor may also
// follow the parenthesised dong directly, as the store finder writes it:
// "(신림동)B1~2층".
const stripFloor = (address: string) =>
  address.replace(/\s*(?:B?\d+F|지하\s*\d*층?|B?[\d,~\-]+층|\d+호)(?:\s|$).*$/iu, "").replace(/\s*(?:B?\d+F|지하\s*\d*층?|B?[\d,~\-]+층|\d+호)$/iu, "").trim();

export function googleDirectionsUrl(
  dest: NamedDestination,
  origin?: LatLng | null,
  travelMode: "transit" | "walking" = "transit",
  /** Intermediate stops, in order. Google plans through them, so a hand-off
      carries the whole trip the visitor built rather than only its ends
      (owner decision 2026-08-22: Google owns timing and routing accuracy). */
  waypoints?: LatLng[],
): string {
  const named = Boolean(dest.name);
  const destination = named
    ? encodeURIComponent(dest.address ? `${dest.name}, ${stripFloor(dest.address)}` : dest.name!)
    : `${dest.lat},${dest.lng}`;
  const base = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=${travelMode}`;
  // A named hand-off is "take me there from where I am". Passing the device
  // fix as coordinates made the START a dropped pin as well; left out,
  // Google fills in "내 위치" / "Your location" itself. Station-to-station
  // routes still pass their origin, because there it is a place, not the
  // visitor.
  const withOrigin = origin && !named ? `${base}&origin=${origin.lat},${origin.lng}` : base;
  if (!waypoints || waypoints.length === 0) return withOrigin;
  const via = waypoints.map((p) => `${p.lat},${p.lng}`).join("|");
  return `${withOrigin}&waypoints=${encodeURIComponent(via)}`;
}

export function kakaoRouteUrl(nameKr: string, dest: LatLng, origin?: LatLng | null): string {
  const to = `${encodeURIComponent(nameKr)},${dest.lat},${dest.lng}`;
  return origin
    ? `https://map.kakao.com/link/from/${encodeURIComponent("내 위치")},${origin.lat},${origin.lng}/to/${to}`
    : `https://map.kakao.com/link/to/${to}`;
}

export function naverRouteUrl(nameKr: string, dest: LatLng, origin?: LatLng | null): string {
  if (!origin) return naverMapUrl(nameKr);
  // Naver web directions path: /p/directions/{lng},{lat},{name}/{lng},{lat},{name}/-/transit
  const start = `${origin.lng},${origin.lat},${encodeURIComponent("내 위치")}`;
  const goal = `${dest.lng},${dest.lat},${encodeURIComponent(nameKr)}`;
  return `https://map.naver.com/p/directions/${start}/${goal}/-/transit`;
}

/** App Store fallback used after an iOS browser attempts the NAVER Map URL scheme. */
export const NAVER_MAP_IOS_APP_STORE_URL = "http://itunes.apple.com/app/id311867728?mt=8";

/**
 * NAVER Map's documented native public-transit route scheme.
 *
 * `appname` is mandatory for a web page using the scheme. Callers should pass
 * their current origin so this keeps working when the production domain changes.
 * NAVER Map itself owns the UI language; its app setting determines English,
 * Korean, Simplified Chinese, or Japanese.
 */
export function naverAppRouteUrl(
  nameKr: string,
  dest: LatLng,
  origin: LatLng | null | undefined,
  appName: string,
): string {
  const params = [
    ["dlat", String(dest.lat)],
    ["dlng", String(dest.lng)],
    ["dname", nameKr],
    ["appname", appName],
  ];

  if (origin) {
    params.push(["slat", String(origin.lat)], ["slng", String(origin.lng)], ["sname", "My location"]);
  }

  return `nmap://route/public?${params.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&")}`;
}

/**
 * Android Chrome intent form of the NAVER Map scheme. Android opens the app
 * when installed and falls back to its Google Play listing otherwise.
 */
export function naverAndroidIntentUrl(
  nameKr: string,
  dest: LatLng,
  origin: LatLng | null | undefined,
  appName: string,
): string {
  const route = naverAppRouteUrl(nameKr, dest, origin, appName).replace("nmap://", "intent://");
  return `${route}#Intent;scheme=nmap;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.nhn.android.nmap;end`;
}
