// Sample data layer mirroring seoul-beauty-guide's Product/Place/Journal models.
// Filters in Shop and Spot operate over these in-memory arrays (client-side, single-select, AND-combined).

import type { IconName } from "@/components/icon";

// ── Taxonomy (matches real app enums) ─────────────────────
export type PlaceType = "salon" | "spa" | "headspa" | "clinic" | "spots";
export type PriceRange = "₩" | "₩₩" | "₩₩₩";
export type ProductCategory = "skincare" | "haircare" | "makeup" | "bodycare" | "tools" | "fragrance";
export type StepCategory =
  | "cleanser" | "toner" | "essence" | "serum" | "moisturizer" | "sunscreen" | "mask_pack"
  | "shampoo" | "conditioner" | "hair_treatment";
export type ProductChannel = "olive_young" | "korea_exclusive";

export type ZoneKey =
  | "myeongdong" | "hongdae" | "gangnam_station" | "apgujeong" | "cheongdam"
  | "sinsa" | "seongsu" | "samsung" | "jongno" | "hannam" | "itaewon" | "hangang";

// ── Zone metadata ─────────────────────────────────────────
export const ZONES: { key: ZoneKey; label: string; district: string }[] = [
  { key: "myeongdong", label: "Myeongdong · Chungmuro", district: "Jung-gu" },
  { key: "hongdae", label: "Hongdae · Hapjeong · Yeonnam", district: "Mapo-gu" },
  { key: "gangnam_station", label: "Gangnam · Yeoksam · Nonhyeon", district: "Gangnam-gu" },
  { key: "apgujeong", label: "Apgujeong-rodeo", district: "Gangnam-gu" },
  { key: "cheongdam", label: "Cheongdam", district: "Gangnam-gu" },
  { key: "sinsa", label: "Sinsa · Garosu-gil", district: "Gangnam-gu" },
  { key: "seongsu", label: "Seongsu · Seoul Forest", district: "Seongdong-gu" },
  { key: "samsung", label: "Samsung · COEX", district: "Gangnam-gu" },
  { key: "jongno", label: "Gyeongbokgung · Bukchon · Insadong", district: "Jongno-gu" },
  { key: "hannam", label: "Hannam", district: "Yongsan-gu" },
  { key: "itaewon", label: "Itaewon · Gyeongnidan-gil", district: "Yongsan-gu" },
  { key: "hangang", label: "Han River", district: "Multiple" },
];

export const ZONE_LABEL: Record<ZoneKey, string> = {
  myeongdong: "Myeongdong", hongdae: "Hongdae", gangnam_station: "Gangnam",
  apgujeong: "Apgujeong", cheongdam: "Cheongdam", sinsa: "Sinsa", seongsu: "Seongsu",
  samsung: "Samsung", jongno: "Jongno", hannam: "Hannam", itaewon: "Itaewon", hangang: "Han River",
};

export function zoneShort(key: string): string {
  return (ZONE_LABEL as Record<string, string>)[key] ?? key;
}
export function districtOf(zone: string): string {
  return ZONES.find((z) => z.key === zone)?.district ?? "Seoul";
}

// Per-category curated zone subsets (Zone filter chip sets)
export const CATEGORY_ZONES: Record<Exclude<PlaceType, "spots"> | "spots", ZoneKey[]> = {
  salon: ["gangnam_station", "apgujeong", "cheongdam", "hongdae", "myeongdong", "itaewon"],
  spa: ["gangnam_station", "apgujeong", "myeongdong", "hongdae", "jongno", "hannam"],
  headspa: ["apgujeong", "cheongdam", "gangnam_station", "hongdae", "myeongdong", "hannam"],
  clinic: ["gangnam_station", "apgujeong", "cheongdam", "myeongdong"],
  spots: ["jongno", "myeongdong", "hongdae", "seongsu", "gangnam_station", "itaewon", "hangang"],
};

export const TYPE_LABEL: Record<PlaceType, string> = {
  salon: "Salon", spa: "Spa", headspa: "Head Spa", clinic: "Clinic", spots: "Spot",
};
export const TYPE_ICON: Record<PlaceType, IconName> = {
  salon: "scissors", spa: "spa", headspa: "spa", clinic: "cross", spots: "pin",
};

// ── Places ────────────────────────────────────────────────
export type Place = {
  id: string;
  name: string;
  nameKr: string;
  type: PlaceType;
  zone: ZoneKey;
  district?: string;
  priceRange: PriceRange;
  rating?: number;
  ratingCount?: number;
  tags: string[];
  nearestStation?: string;
  address: string;
  lat: number;
  lng: number;
  englishOk?: boolean;
  badge?: { cls: "accent" | "warning" | "info"; text: string };
};

export const PLACES: Place[] = [
  { id: "hosu-dosan", name: "HOSU DOSAN", nameKr: "호수 도산점", type: "headspa", zone: "apgujeong", priceRange: "₩₩₩", rating: 4.8, ratingCount: 132, tags: ["scalp", "aroma", "therapy"], nearestStation: "Apgujeong Rodeo", address: "서울 강남구 도산대로 123", lat: 37.5240, lng: 127.0380, englishOk: true, badge: { cls: "accent", text: "English OK" } },
  { id: "eden-headspa", name: "Eden Head Spa", nameKr: "에덴 헤드스파", type: "headspa", zone: "hongdae", priceRange: "₩₩", rating: 4.7, ratingCount: 88, tags: ["scalp", "therapy"], nearestStation: "Hongik Univ.", address: "서울 마포구 양화로 45", lat: 37.5537, lng: 126.9184, englishOk: true, badge: { cls: "accent", text: "English OK" } },
  { id: "la-beaute", name: "La Beauté Coréenne", nameKr: "라 보떼 꼬레엔느", type: "headspa", zone: "cheongdam", priceRange: "₩₩₩", rating: 4.6, ratingCount: 61, tags: ["aroma", "luxury"], nearestStation: "Cheongdam", address: "서울 강남구 청담동 21", lat: 37.5253, lng: 127.0476, badge: { cls: "warning", text: "Luxury" } },
  { id: "juno-hair-gangnam", name: "Juno Hair Gangnam", nameKr: "준오헤어 강남점", type: "salon", zone: "gangnam_station", priceRange: "₩₩", rating: 4.7, ratingCount: 210, tags: ["k-pop style", "color", "cut"], nearestStation: "Gangnam", address: "서울특별시 강남구 테헤란로 123", lat: 37.4995, lng: 127.0323, englishOk: true, badge: { cls: "accent", text: "English OK" } },
  { id: "chahong-apgujeong", name: "Chahong Ardor", nameKr: "차홍아르더 압구정", type: "salon", zone: "apgujeong", priceRange: "₩₩₩", rating: 4.6, ratingCount: 154, tags: ["color", "perm"], nearestStation: "Apgujeong", address: "서울 강남구 압구정로 200", lat: 37.5273, lng: 127.0287, englishOk: true },
  { id: "dragon-hill-spa", name: "Dragon Hill Spa", nameKr: "드래곤힐 스파", type: "spa", zone: "hangang", priceRange: "₩", rating: 4.4, ratingCount: 320, tags: ["jjimjilbang", "sauna"], nearestStation: "Yongsan", address: "서울 용산구 한강대로 21길 60", lat: 37.5299, lng: 126.9646 },
  { id: "sulwha-clinic", name: "Sulwha Skin Clinic", nameKr: "설화 피부과", type: "clinic", zone: "gangnam_station", priceRange: "₩₩₩", rating: 4.5, ratingCount: 96, tags: ["skin booster", "facial"], nearestStation: "Gangnam", address: "서울 강남구 강남대로 400", lat: 37.4970, lng: 127.0276, badge: { cls: "info", text: "Consult first" } },
  { id: "bukchon-hanok", name: "Bukchon Hanok Village", nameKr: "북촌한옥마을", type: "spots", zone: "jongno", priceRange: "₩", rating: 4.7, ratingCount: 1200, tags: ["photo spot", "hanok", "culture"], nearestStation: "Anguk", address: "서울 종로구 계동길", lat: 37.5814, lng: 126.9849 },
  { id: "seongsu-cafe", name: "Onion Seongsu", nameKr: "어니언 성수", type: "spots", zone: "seongsu", priceRange: "₩₩", rating: 4.6, ratingCount: 540, tags: ["cafe", "photo spot"], nearestStation: "Seongsu", address: "서울 성동구 아차산로9길 8", lat: 37.5444, lng: 127.0578 },
];

// ── Products ──────────────────────────────────────────────
export type Product = {
  id: string;
  brand: string;
  name: string;
  nameKr: string;
  category: ProductCategory;
  stepCategory?: StepCategory;
  channel: ProductChannel;
  priceRange?: PriceRange;
  isEditorsPick?: boolean;
  isTrending?: boolean;
  isEssenly?: boolean;
  skinTypes: string[];
  concerns: string[];
  zoneAvailability?: ZoneKey[];
};

export const PRODUCTS: Product[] = [
  { id: "cosrx-snail-mucin", brand: "COSRX", name: "Advanced Snail 96 Mucin Power Essence", nameKr: "코스알엑스 달팽이 뮤신 96 에센스", category: "skincare", stepCategory: "essence", channel: "olive_young", priceRange: "₩₩", isEditorsPick: true, isTrending: true, skinTypes: ["Dry", "Sensitive"], concerns: ["Hydration", "Brightening"], zoneAvailability: ["myeongdong", "hongdae", "gangnam_station"] },
  { id: "anua-heartleaf-toner", brand: "Anua", name: "Heartleaf 77% Soothing Toner", nameKr: "아누아 어성초 77 토너", category: "skincare", stepCategory: "toner", channel: "olive_young", priceRange: "₩", isTrending: true, skinTypes: ["Oily", "Combo", "Sensitive"], concerns: ["Redness", "Pores"] },
  { id: "boj-glow-serum", brand: "Beauty of Joseon", name: "Glow Deep Serum: Rice + Alpha Arbutin", nameKr: "조선미녀 글로우 세럼", category: "skincare", stepCategory: "serum", channel: "olive_young", priceRange: "₩₩", isEditorsPick: true, skinTypes: ["Dry", "Combo"], concerns: ["Brightening", "Hydration"] },
  { id: "boj-relief-sun", brand: "Beauty of Joseon", name: "Relief Sun: Rice + Probiotics SPF50+", nameKr: "조선미녀 릴리프 선크림", category: "skincare", stepCategory: "sunscreen", channel: "olive_young", priceRange: "₩", isTrending: true, skinTypes: ["Dry", "Oily", "Combo", "Sensitive"], concerns: ["Hydration"] },
  { id: "klairs-cleansing-oil", brand: "Klairs", name: "Gentle Black Deep Cleansing Oil", nameKr: "클레어스 젠틀 블랙 클렌징 오일", category: "skincare", stepCategory: "cleanser", channel: "olive_young", priceRange: "₩₩", skinTypes: ["Dry", "Sensitive"], concerns: ["Hydration"] },
  { id: "illiyoon-cream", brand: "Illiyoon", name: "Ceramide Ato Concentrate Cream", nameKr: "일리윤 세라마이드 아토 크림", category: "skincare", stepCategory: "moisturizer", channel: "olive_young", priceRange: "₩", isEssenly: true, skinTypes: ["Dry", "Sensitive"], concerns: ["Hydration"] },
  { id: "mediheal-teatree", brand: "Mediheal", name: "Tea Tree Care Solution Mask (10pk)", nameKr: "메디힐 티트리 마스크팩", category: "skincare", stepCategory: "mask_pack", channel: "olive_young", priceRange: "₩", skinTypes: ["Oily", "Combo"], concerns: ["Acne", "Redness"] },
  { id: "mise-perfect-shampoo", brand: "Mise en Scène", name: "Perfect Serum Shampoo", nameKr: "미장센 퍼펙트 세럼 샴푸", category: "haircare", stepCategory: "shampoo", channel: "olive_young", priceRange: "₩", skinTypes: [], concerns: ["Damaged", "Frizz"] },
  { id: "tsubaki-treatment", brand: "Tsubaki", name: "Premium Repair Hair Treatment", nameKr: "츠바키 프리미엄 리페어 트리트먼트", category: "haircare", stepCategory: "hair_treatment", channel: "korea_exclusive", priceRange: "₩₩", skinTypes: [], concerns: ["Damaged"] },
  { id: "romand-tint", brand: "rom&nd", name: "Juicy Lasting Tint", nameKr: "롬앤 쥬시 래스팅 틴트", category: "makeup", channel: "olive_young", priceRange: "₩", isTrending: true, skinTypes: [], concerns: [] },
  { id: "round-lab-lotion", brand: "Round Lab", name: "1025 Dokdo Lotion", nameKr: "라운드랩 1025 독도 로션", category: "bodycare", channel: "olive_young", priceRange: "₩", skinTypes: ["Dry"], concerns: ["Hydration"] },
  { id: "tamburins-perfume", brand: "Tamburins", name: "Perfume Shot Hand Balm", nameKr: "탬버린즈 퍼퓸 핸드밤", category: "fragrance", channel: "korea_exclusive", priceRange: "₩₩", isEssenly: true, skinTypes: [], concerns: [] },
];

// ── Product filter taxonomy (Shop) ────────────────────────
export const SHOP_CATEGORIES: { key: "all" | ProductCategory; label: string }[] = [
  { key: "all", label: "All" },
  { key: "skincare", label: "Skincare" },
  { key: "haircare", label: "Haircare" },
  { key: "makeup", label: "Makeup" },
  { key: "bodycare", label: "Body" },
  { key: "tools", label: "Tools" },
  { key: "fragrance", label: "Fragrance" },
];

export const SUB_CATEGORIES: Partial<Record<ProductCategory, { key: "all" | StepCategory; label: string }[]>> = {
  skincare: [
    { key: "all", label: "All" }, { key: "cleanser", label: "Cleanser" }, { key: "toner", label: "Toner" },
    { key: "essence", label: "Essence" }, { key: "serum", label: "Serum" }, { key: "moisturizer", label: "Moisturizer" },
    { key: "sunscreen", label: "Sunscreen" }, { key: "mask_pack", label: "Mask Pack" },
  ],
  haircare: [
    { key: "all", label: "All" }, { key: "shampoo", label: "Shampoo" },
    { key: "conditioner", label: "Conditioner" }, { key: "hair_treatment", label: "Treatment" },
  ],
};

export const ALL_FILTERS: { key: "all" | "essenly" | "3step" | "5step" | "7step"; label: string }[] = [
  { key: "all", label: "All" }, { key: "essenly", label: "Essenly Pick" },
  { key: "3step", label: "3-step" }, { key: "5step", label: "5-step" }, { key: "7step", label: "7-step" },
];

export const STEP_MAP: Record<3 | 5 | 7, StepCategory[]> = {
  3: ["cleanser", "moisturizer", "sunscreen"],
  5: ["cleanser", "toner", "essence", "moisturizer", "sunscreen"],
  7: ["cleanser", "toner", "essence", "serum", "moisturizer", "sunscreen", "mask_pack"],
};

export const STEP_LABEL: Record<StepCategory, string> = {
  cleanser: "Cleanser", toner: "Toner", essence: "Essence", serum: "Serum",
  moisturizer: "Moisturizer", sunscreen: "Sunscreen", mask_pack: "Mask Pack",
  shampoo: "Shampoo", conditioner: "Conditioner", hair_treatment: "Treatment",
};

export const CHANNEL_LABEL: Record<ProductChannel, string> = {
  olive_young: "Olive Young", korea_exclusive: "Korea Exclusive",
};

export const DETAIL_CATEGORIES: { key: string; label: string }[] = [
  { key: "all", label: "All" }, { key: "salon", label: "Hair" }, { key: "spa", label: "Spa" },
  { key: "headspa", label: "Head Spa" }, { key: "clinic", label: "Clinic" },
  { key: "nail", label: "Nail Art" }, { key: "spots", label: "Local Spots" },
];

export const PRICE_OPTIONS: PriceRange[] = ["₩", "₩₩", "₩₩₩"];

// ── Journal ───────────────────────────────────────────────
export type Article = {
  slug: string;
  title: string;
  tags: string[];
  date: string;
  readMin: number;
};

export const ARTICLES: Article[] = [
  { slug: "korean-glass-skin-routine", title: "Korean Glass Skin Routine — The Secret to Dewy Skin", tags: ["skincare", "routine", "glass-skin"], date: "Mar 15, 2026", readMin: 5 },
  { slug: "7-step-kbeauty-guide", title: "7-Step K-Beauty Routine for First-Time Seoul Visitors", tags: ["skincare", "routine", "olive-young", "shopping"], date: "Mar 20, 2026", readMin: 6 },
  { slug: "seoul-beauty-hotspots-hongdae", title: "Seoul Beauty Hot Spots: A Local's Guide to Hongdae & Sinsa", tags: ["travel", "hongdae", "sinsa", "spots"], date: "Mar 25, 2026", readMin: 7 },
];

// ── Lookups ───────────────────────────────────────────────
export const getProduct = (id: string) => PRODUCTS.find((p) => p.id === id);
export const getPlace = (id: string) => PLACES.find((p) => p.id === id);
export const getArticle = (slug: string) => ARTICLES.find((a) => a.slug === slug);

export const CATEGORY_META: Record<string, { title: string; eyebrow: string; line1: string; line2: string; blurb: string; types: PlaceType[] }> = {
  spot: { title: "Spot", eyebrow: "SEOUL BEAUTY", line1: "Beauty spots", line2: "by district.", blurb: "Browse Seoul by district first, then narrow into hair, spa, clinic, nail art, and local spots.", types: ["salon", "spa", "headspa", "clinic", "spots"] },
  salon: { title: "Hair Salon", eyebrow: "HAIR", line1: "Hair", line2: "Salon", blurb: "K-pop styles, color, and signature cuts. English-friendly stylists curated for visitors.", types: ["salon"] },
  spa: { title: "Spa & Wellness", eyebrow: "SPA", line1: "Spa &", line2: "Wellness", blurb: "Head spa, scalp therapy, foot care, and traditional Korean massage.", types: ["spa", "headspa"] },
  headspa: { title: "Head Spa", eyebrow: "HEAD SPA", line1: "Head", line2: "Spa", blurb: "Korean head spa, curated. Scalp diagnosis, aroma massage, and hair therapy.", types: ["headspa"] },
  clinic: { title: "Skin Clinic", eyebrow: "CLINIC", line1: "Skin", line2: "Clinic", blurb: "Dermatology, skin booster, facials, and non-surgical aesthetic treatments.", types: ["clinic"] },
  spots: { title: "Hip Spots", eyebrow: "SPOTS", line1: "Hip", line2: "Spots", blurb: "Hidden cafés, photo spots, and cultural gems across Seoul's neighborhoods.", types: ["spots"] },
};
