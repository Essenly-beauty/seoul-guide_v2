import { describe, expect, it } from "vitest";
import type { Place } from "./data";
import { placeCanonicalPath, placeDescription, placeJsonLd, placeMetadata, placeTitle } from "./place-seo";

const base: Place = {
  id: "올리브영 명동본점", name: "Olive Young Myeongdong Main", nameKr: "올리브영 명동본점",
  type: "olive_young", zone: "myeongdong", tags: [], address: "서울 중구 명동길 53",
  lat: 37.5636, lng: 126.9851, rating: 4.4, ratingCount: 120,
  hours: { open: "10:00", close: "22:30" }, stationWalk: { station: "Myeongdong", exit: "6", minutes: 3 },
  englishOk: true, photos: ["/places/oy-myeongdong/1.webp"], source: "kakao",
};

/** Google Search Central: unique, descriptive <title>/description per page;
 *  ogp.me: og:url is the canonical id; LocalBusiness structured data uses the
 *  most specific sub-type, and aggregateRating is only for reviews of OTHER
 *  businesses that are actually shown on the page — we never emit it. */
describe("place SEO", () => {
  it("title carries the English and Korean names, category and area", () => {
    expect(placeTitle(base)).toBe("Olive Young Myeongdong Main (올리브영 명동본점) — Olive Young in Myeongdong | MYSEOULDROP");
  });

  it("title drops the Korean name when it is not distinct (creatrip rows keep the English name in nameKr)", () => {
    expect(placeTitle({ ...base, nameKr: "Olive Young Myeongdong Main" }))
      .toBe("Olive Young Myeongdong Main — Olive Young in Myeongdong | MYSEOULDROP");
  });

  it("canonical path percent-encodes Hangul ids", () => {
    expect(placeCanonicalPath(base)).toBe(`/place/${encodeURIComponent("올리브영 명동본점")}`);
  });

  it("description is a single ≤160-char sentence with area, address and walk time", () => {
    const d = placeDescription(base);
    expect(d.length).toBeLessThanOrEqual(160);
    expect(d).toContain("Myeongdong");
    expect(d).toContain("서울 중구 명동길 53");
    expect(d).toContain("3 min walk from Myeongdong Station");
  });

  it("metadata points og:url and canonical at the same path", () => {
    const m = placeMetadata(base);
    expect(m.alternates?.canonical).toBe(placeCanonicalPath(base));
    expect((m.openGraph as { url?: string }).url).toBe(placeCanonicalPath(base));
    expect(m.title).toBe(placeTitle(base));
  });

  it("uses the most specific schema.org type per category", () => {
    expect(placeJsonLd(base)["@type"]).toBe("Store");
    expect(placeJsonLd({ ...base, type: "hair_salon" })["@type"]).toBe("HairSalon");
    expect(placeJsonLd({ ...base, type: "skin_clinic" })["@type"]).toBe("MedicalClinic");
    expect(placeJsonLd({ ...base, type: "etc" })["@type"]).toBe("TouristAttraction");
  });

  it("never emits aggregateRating, even when a source rating exists", () => {
    expect(placeJsonLd(base)).not.toHaveProperty("aggregateRating");
  });

  it("emits absolute url/image and a Korean postal address with coordinates", () => {
    const ld = placeJsonLd(base) as Record<string, unknown>;
    expect(ld.url).toBe(`https://myseouldrop.app${placeCanonicalPath(base)}`);
    expect(ld.image).toBe("https://myseouldrop.app/places/oy-myeongdong/1.webp");
    expect(ld.address).toEqual({ "@type": "PostalAddress", streetAddress: "서울 중구 명동길 53", addressLocality: "Seoul", addressCountry: "KR" });
    expect(ld.geo).toEqual({ "@type": "GeoCoordinates", latitude: 37.5636, longitude: 126.9851 });
    expect(ld.alternateName).toBe("올리브영 명동본점");
  });

  it("expands uniform hours to all seven days and skips closed days of a varying week", () => {
    const uniform = placeJsonLd(base).openingHoursSpecification as Array<{ dayOfWeek: string[]; opens: string; closes: string }>;
    expect(uniform).toHaveLength(1);
    expect(uniform[0].dayOfWeek).toHaveLength(7);
    expect(uniform[0]).toMatchObject({ opens: "10:00", closes: "22:30" });

    const week = placeJsonLd({ ...base, hours: { week: [null, { open: "09:00", close: "21:00" }, { open: "09:00", close: "21:00" }, null, null, null, { open: "10:00", close: "24:00" }] } })
      .openingHoursSpecification as Array<{ dayOfWeek: string; opens: string; closes: string }>;
    expect(week.map((w) => w.dayOfWeek)).toEqual(["Monday", "Tuesday", "Saturday"]);
    expect(week[2].closes).toBe("23:59");
  });

  it("omits hours, image and alternateName when the row has none", () => {
    const ld = placeJsonLd({ ...base, hours: undefined, photos: undefined, nameKr: base.name });
    expect(ld).not.toHaveProperty("openingHoursSpecification");
    expect(ld).not.toHaveProperty("image");
    expect(ld).not.toHaveProperty("alternateName");
  });
});

describe("place page wiring", () => {
  const { readFileSync, existsSync } = require("node:fs") as typeof import("node:fs");
  const { join } = require("node:path") as typeof import("node:path");
  it("the detail route exports generateMetadata and renders the JSON-LD block", () => {
    const src = readFileSync(join(process.cwd(), "app/place/[id]/page.tsx"), "utf8");
    expect(src).toMatch(/export async function generateMetadata/);
    expect(src).toMatch(/placeMetadata\(/);
    expect(src).toMatch(/application\/ld\+json/);
    expect(src).toMatch(/placeJsonLd\(/);
  });
  it("the detail route has its own Open Graph image", () => {
    expect(existsSync(join(process.cwd(), "app/place/[id]/opengraph-image.tsx"))).toBe(true);
  });
});
