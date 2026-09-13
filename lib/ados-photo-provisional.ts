import type { Place, PlaceType, ZoneKey } from "./data";

export type AdosPhotoSourceRow = {
  id: string;
  slug: string;
  category: string;
  entryType: string;
  type: string;
  region: string;
  nameEn: string;
  nameKr: string;
  address: string;
  naverMap?: string | null;
  googleMaps?: string | null;
  website?: string | null;
  verified: boolean;
};

const REGION_RULES: { pattern: RegExp; zone: ZoneKey; lat: number; lng: number }[] = [
  { pattern: /성수|서울숲|왕십리|성동/, zone: "seongsu", lat: 37.5444, lng: 127.0548 },
  { pattern: /압구정/, zone: "apgujeong", lat: 37.5274, lng: 127.0362 },
  { pattern: /청담|강남구청|도산/, zone: "cheongdam", lat: 37.5248, lng: 127.0443 },
  { pattern: /가로수길|신사/, zone: "sinsa", lat: 37.5182, lng: 127.0221 },
  { pattern: /강남|선릉|서초/, zone: "gangnam_station", lat: 37.5012, lng: 127.0352 },
  { pattern: /명동|중구/, zone: "myeongdong", lat: 37.5629, lng: 126.9852 },
  { pattern: /홍대|연남|합정|서교|마포|망원|공덕|애오개|아현|도화|상암/, zone: "hongdae", lat: 37.5545, lng: 126.9248 },
  { pattern: /북촌|경복궁|광화문|종로|인사동|동묘|대학로|동대문/, zone: "jongno", lat: 37.5747, lng: 126.9892 },
  { pattern: /이태원|해방촌/, zone: "itaewon", lat: 37.5360, lng: 126.9905 },
  { pattern: /용산|한남/, zone: "hannam", lat: 37.5328, lng: 127.0004 },
  { pattern: /잠실|송파/, zone: "jamsil", lat: 37.5133, lng: 127.1012 },
  { pattern: /영등포/, zone: "yeongdeungpo", lat: 37.5171, lng: 126.9078 },
  { pattern: /강변|광진|강동/, zone: "seoul_etc", lat: 37.5385, lng: 127.0837 },
  { pattern: /강서/, zone: "seoul_etc", lat: 37.5510, lng: 126.8496 },
  { pattern: /서대문/, zone: "seoul_etc", lat: 37.5791, lng: 126.9368 },
  { pattern: /노원/, zone: "seoul_etc", lat: 37.6542, lng: 127.0568 },
  { pattern: /동작/, zone: "seoul_etc", lat: 37.5124, lng: 126.9393 },
];

function classifyType(value: string): PlaceType {
  if (/퍼스널컬러/.test(value)) return "personal_color";
  if (/네일|속눈썹|래쉬/.test(value)) return "nail_lash";
  if (/헤드스파|두피|탈모/.test(value)) return "head_spa";
  if (/헤어|메이크업|살롱|펌|붙임머리/.test(value)) return "hair_salon";
  if (/몰|시장|플래그십|쇼룸|편집숍|카페|티하우스/.test(value)) return "mall";
  return "etc";
}

function stableUnit(value: string, salt: number): number {
  let hash = 2166136261 ^ salt;
  for (const char of value) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) / 0xffffffff) * 2 - 1;
}

function approximateLocation(region: string, id: string): Pick<Place, "zone" | "lat" | "lng"> {
  const match = REGION_RULES.find((rule) => rule.pattern.test(region)) ?? {
    zone: "seoul_etc" as const,
    lat: 37.5665,
    lng: 126.9780,
  };
  return {
    zone: match.zone,
    lat: match.lat + stableUnit(id, 17) * 0.0022,
    lng: match.lng + stableUnit(id, 29) * 0.0027,
  };
}

export function buildProvisionalPhotoPlaces({
  sourceRows,
  sourcePlaceIds,
  existingPlaceIds,
  aliases,
}: {
  sourceRows: readonly AdosPhotoSourceRow[];
  sourcePlaceIds: readonly string[];
  existingPlaceIds: ReadonlySet<string>;
  aliases: ReadonlyMap<string, string>;
}): Place[] {
  const rowsById = new Map(sourceRows.map((row) => [`ados-${row.slug}`, row]));

  return [...sourcePlaceIds]
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }))
    .filter((sourcePlaceId) => !existingPlaceIds.has(sourcePlaceId) && !aliases.has(sourcePlaceId))
    .map((sourcePlaceId) => {
      const row = rowsById.get(sourcePlaceId);
      if (!row) throw new Error(`Missing ADOS source row for photo folder: ${sourcePlaceId}`);
      if (!row.verified) throw new Error(`Unverified ADOS source row cannot be auto-published: ${sourcePlaceId}`);
      const location = approximateLocation(row.region, sourcePlaceId);
      const url = row.naverMap || row.website || row.googleMaps || undefined;
      return {
        id: sourcePlaceId,
        name: row.nameEn,
        nameKr: row.nameKr,
        type: classifyType(row.type),
        ...location,
        tags: [...new Set([row.type, row.category].filter(Boolean))],
        address: row.address,
        ...(url ? { url } : {}),
        geoSource: "area",
        locationVerification: "provisional",
        nameVerification: "provisional",
      };
    });
}
