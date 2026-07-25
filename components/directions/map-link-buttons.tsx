import { googleDirectionsUrl, kakaoRouteUrl, naverRouteUrl, type LatLng } from "@/lib/geo";
import type { Place } from "@/lib/data";

/** Google / Kakao / Naver route buttons (spec v2 §6) — solid brand pills, reference-app style.
    With `origin` (my location) each link opens a start→destination route;
    without it, a destination-only link — the map service resolves the start itself. */
export function MapLinkButtons({ place, origin }: {
  place: Pick<Place, "nameKr" | "lat" | "lng">;
  origin?: LatLng | null;
}) {
  const dest = { lat: place.lat, lng: place.lng };
  const links = [
    { label: "Google", href: googleDirectionsUrl(dest, origin), bg: "#4285f4", fg: "#fff" },
    { label: "Kakao", href: kakaoRouteUrl(place.nameKr, dest, origin), bg: "#fae100", fg: "#3c1e1e" },
    { label: "Naver", href: naverRouteUrl(place.nameKr, dest, origin), bg: "#03c75a", fg: "#fff" },
  ];
  return (
    <>
      {links.map((l) => (
        <a
          key={l.label}
          className="btn sm"
          style={{ background: l.bg, color: l.fg, border: "none" }}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          {l.label}
        </a>
      ))}
    </>
  );
}
