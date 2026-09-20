// Per-place SEO: <title>/description, canonical + Open Graph metadata and a
// schema.org LocalBusiness JSON-LD block. Google Search Central asks for a
// unique title/description per page and the most specific LocalBusiness
// sub-type; aggregateRating is deliberately never emitted (review-snippet
// policy: only for third-party reviews actually shown on the page).

import type { Metadata } from "next";
import { TYPE_LABEL, ZONE_LABEL, type Place, type PlaceType } from "./data";
import { hoursOn } from "./places";

export const SITE_URL = "https://myseouldrop.app";
const SITE_NAME = "MYSEOULDROP";
const DESCRIPTION_MAX = 160;

const SCHEMA_TYPE: Record<PlaceType, string> = {
  hair_salon: "HairSalon",
  skin_clinic: "MedicalClinic",
  nail_lash: "NailSalon",
  head_spa: "DaySpa",
  personal_color: "BeautySalon",
  olive_young: "Store",
  daiso: "Store",
  mall: "Store",
  etc: "TouristAttraction",
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function hasDistinctKoreanName(place: Place): boolean {
  const kr = place.nameKr?.trim();
  return Boolean(kr) && kr.toLowerCase() !== place.name.trim().toLowerCase();
}

export function placeCanonicalPath(place: Place): string {
  return `/place/${encodeURIComponent(place.id)}`;
}

export function placeTitle(place: Place): string {
  const name = hasDistinctKoreanName(place) ? `${place.name} (${place.nameKr})` : place.name;
  return `${name} — ${TYPE_LABEL[place.type]} in ${ZONE_LABEL[place.zone]} | ${SITE_NAME}`;
}

export function placeDescription(place: Place): string {
  const parts: string[] = [`${TYPE_LABEL[place.type]} in ${ZONE_LABEL[place.zone]}, Seoul.`];
  if (place.stationWalk) {
    const { station, exit, minutes } = place.stationWalk;
    parts.push(`${minutes} min walk from ${station} Station${exit ? ` exit ${exit}` : ""}.`);
  }
  if (place.englishOk) parts.push("English OK.");
  if (place.address) parts.push(`${place.address}.`);
  let text = "";
  for (const part of parts) {
    const next = text ? `${text} ${part}` : part;
    if (next.length > DESCRIPTION_MAX) break;
    text = next;
  }
  return text;
}

export function placeMetadata(place: Place): Metadata {
  const title = placeTitle(place);
  const description = placeDescription(place);
  const path = placeCanonicalPath(place);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: SITE_NAME, title, description, url: path, locale: "en_US" },
    twitter: { card: "summary_large_image", title, description },
  };
}

function clockForSchema(hhmm: string): string {
  // Kakao writes "24:00" for end-of-day; schema.org/Time wants a valid HH:MM.
  return hhmm === "24:00" ? "23:59" : hhmm;
}

function openingHours(place: Place): Array<Record<string, unknown>> | null {
  const hours = place.hours;
  if (!hours) return null;
  if (!("week" in hours)) {
    return [{ "@type": "OpeningHoursSpecification", dayOfWeek: DAYS, opens: clockForSchema(hours.open), closes: clockForSchema(hours.close) }];
  }
  const specs = DAYS.flatMap((day, i) => {
    const h = hoursOn(hours, i);
    return h ? [{ "@type": "OpeningHoursSpecification", dayOfWeek: day, opens: clockForSchema(h.open), closes: clockForSchema(h.close) }] : [];
  });
  return specs.length ? specs : null;
}

export function placeJsonLd(place: Place): Record<string, unknown> {
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": SCHEMA_TYPE[place.type],
    name: place.name,
    url: `${SITE_URL}${placeCanonicalPath(place)}`,
    address: { "@type": "PostalAddress", streetAddress: place.address, addressLocality: "Seoul", addressCountry: "KR" },
    geo: { "@type": "GeoCoordinates", latitude: place.lat, longitude: place.lng },
  };
  if (hasDistinctKoreanName(place)) ld.alternateName = place.nameKr;
  const photo = place.photos?.[0] ?? place.photoUrl;
  if (photo) ld.image = photo.startsWith("http") ? photo : `${SITE_URL}${photo}`;
  const hours = openingHours(place);
  if (hours) ld.openingHoursSpecification = hours;
  if (place.priceRange) ld.priceRange = place.priceRange;
  if (place.url) ld.sameAs = place.url;
  return ld;
}
