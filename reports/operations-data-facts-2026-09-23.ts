// Read-only evidence collector for the 2026-09-23 operations review.
import { PLACES, CATALOGUE_PLACES, PRODUCTS, ARTICLES } from "../lib/data";
import { placeStatus } from "../lib/places";
import oliveYoungSnapshot from "../data/sources/oliveyoung-seoul-2026-09-23.json";

const countBy = (values: readonly string[]) => values.reduce<Record<string, number>>((out, value) => {
  out[value] = (out[value] ?? 0) + 1;
  return out;
}, {});

console.log(JSON.stringify({
  catalogue: CATALOGUE_PLACES.length,
  publicPlaces: PLACES.length,
  publicCategories: countBy(PLACES.map((p) => p.type)),
  publicSources: countBy(PLACES.map((p) => p.source ?? "unspecified")),
  publicApproximate: PLACES.filter((p) => p.geoSource === "area").length,
  publicProvisionalLocation: PLACES.filter((p) => p.locationVerification === "provisional").length,
  publicMissingHours: PLACES.filter((p) => !p.hours).length,
  publicEnglishOK: PLACES.filter((p) => p.englishOk).length,
  oliveYoungSampleProducts: PRODUCTS.length,
  articles: ARTICLES.length,
}, null, 2));

// Hold the instant and Seoul business hours constant; vary only device timezone.
const originalTimezone = process.env.TZ;
const instant = new Date("2026-09-23T03:00:00Z"); // Noon in Seoul.
const timezoneEvidence = ["Asia/Seoul", "America/New_York"].map((timezone) => {
  process.env.TZ = timezone;
  return {
    timezone,
    instant: instant.toISOString(),
    deviceHour: instant.getHours(),
    result: placeStatus({ open: "10:00", close: "20:00" }, instant),
  };
});
if (originalTimezone === undefined) delete process.env.TZ;
else process.env.TZ = originalTimezone;
console.log(JSON.stringify({ timezoneEvidence }, null, 2));

const oliveYoungPlaces = PLACES.filter((p) => p.type === "olive_young");
const normalizeBranch = (name: string) => name.replace(/^올리브영\s*/, "").replace(/\s+/g, "");
const appNames = new Set(oliveYoungPlaces.map((p) => normalizeBranch(p.nameKr ?? p.name)));
const snapshotNames = new Set(oliveYoungSnapshot.stores.map((p) => normalizeBranch(p.name)));
console.log(JSON.stringify({
  snapshotComparison: {
    note: "Local snapshot, name-only comparison; not a live completeness or closure determination.",
    snapshotStores: oliveYoungSnapshot.stores.length,
    appStores: oliveYoungPlaces.length,
    snapshotNamesNotInApp: [...snapshotNames].filter((name) => !appNames.has(name)).length,
    appNamesNotInSnapshot: [...appNames].filter((name) => !snapshotNames.has(name)).length,
    appStoresWithPhotos: oliveYoungPlaces.filter((p) => p.photos?.length || p.photoUrl).length,
  },
}, null, 2));
