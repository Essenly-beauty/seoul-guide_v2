// Sample data layer mirroring seoul-beauty-guide's Product/Place/Journal models.
// Filters in Shop and Spot operate over these in-memory arrays (client-side, single-select, AND-combined).

import type { IconName } from "@/components/icon";
import { CREATRIP_PLACES } from "./generated/creatrip-places";
import { OLIVEYOUNG_PLACES } from "./generated/oliveyoung-places";
import { ADOS_PLACES } from "./generated/ados-places";

// ── Taxonomy (matches real app enums) ─────────────────────
export type PlaceType =
  | "olive_young" | "skin_clinic" | "hair_salon" | "nail_lash"
  | "personal_color" | "head_spa" | "mall" | "etc";
export type PriceRange = "₩" | "₩₩" | "₩₩₩";
export type ProductCategory = "skincare" | "haircare" | "makeup" | "nail" | "bodycare" | "tools" | "fragrance";
export type StepCategory =
  | "cleanser" | "toner" | "essence" | "serum" | "moisturizer" | "sunscreen" | "mask_pack"
  | "shampoo" | "conditioner" | "hair_treatment";
export type ProductChannel = "olive_young" | "korea_exclusive";

export type ZoneKey =
  | "myeongdong" | "hongdae" | "gangnam_station" | "apgujeong" | "cheongdam"
  | "sinsa" | "seongsu" | "samsung" | "jongno" | "hannam" | "itaewon" | "hangang"
  // Coarse zones for the Creatrip import — areas outside the original 12.
  | "jamsil" | "yeongdeungpo" | "seoul_etc" | "busan" | "gyeonggi";

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
  { key: "jamsil", label: "Jamsil · Songpa", district: "Songpa-gu" },
  { key: "yeongdeungpo", label: "Yeouido · Yeongdeungpo", district: "Yeongdeungpo-gu" },
  { key: "seoul_etc", label: "Other Seoul", district: "Seoul" },
  { key: "busan", label: "Busan", district: "Busan" },
  { key: "gyeonggi", label: "Gyeonggi (Seongnam · Suwon)", district: "Gyeonggi-do" },
];

export const ZONE_LABEL: Record<ZoneKey, string> = {
  myeongdong: "Myeongdong", hongdae: "Hongdae", gangnam_station: "Gangnam",
  apgujeong: "Apgujeong", cheongdam: "Cheongdam", sinsa: "Sinsa", seongsu: "Seongsu",
  samsung: "Samsung", jongno: "Jongno", hannam: "Hannam", itaewon: "Itaewon", hangang: "Han River",
  jamsil: "Jamsil", yeongdeungpo: "Yeouido", seoul_etc: "Seoul", busan: "Busan", gyeonggi: "Gyeonggi",
};

export function zoneShort(key: string): string {
  return (ZONE_LABEL as Record<string, string>)[key] ?? key;
}
export function districtOf(zone: string): string {
  return ZONES.find((z) => z.key === zone)?.district ?? "Seoul";
}

export const TYPE_LABEL: Record<PlaceType, string> = {
  olive_young: "Olive Young", skin_clinic: "Skin Clinic", hair_salon: "Hair Salon",
  nail_lash: "Nail & Lash", personal_color: "Personal Color", head_spa: "Head Spa",
  mall: "Mall & Gifts", etc: "Etc",
};
export const TYPE_ICON: Record<PlaceType, IconName> = {
  olive_young: "bag", skin_clinic: "cross", hair_salon: "scissors",
  nail_lash: "spa", personal_color: "mark", head_spa: "spa", mall: "gift", etc: "pin",
};

/** Olive Young's brand lime — used by the OY brand mark on chips and map pins. */
export const OY_BRAND_GREEN = "#9bce26";

/** Category accent colors (spec v2 §3.1) — shared by filter chips, map pins, and search rows.
 *  Mirrored as --c-* custom properties in globals.css for CSS-only consumers. */
export const TYPE_COLOR: Record<PlaceType, string> = {
  olive_young: "#3f9d4e", skin_clinic: "#4a7ddc", hair_salon: "#8e5bd8",
  nail_lash: "#e0559b", personal_color: "#dd9422", head_spa: "#2ba6a0",
  mall: "#a61e4d", etc: "#8b9098",
};

/** Map filter chip row (spec decision #5) — order matters. */
export const MAP_CATEGORIES: { key: "all" | PlaceType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "olive_young", label: "Olive Young" },
  { key: "skin_clinic", label: "Skin Clinic" },
  { key: "hair_salon", label: "Hair Salon" },
  { key: "nail_lash", label: "Nail & Lash" },
  { key: "personal_color", label: "Personal Color" },
  { key: "head_spa", label: "Head Spa" },
  { key: "mall", label: "Mall & Gifts" },
  { key: "etc", label: "Etc" },
];

/** Per-category detail-filter service tags (spec §4.2). Keys match Place.serviceTags. */
export const SERVICE_FILTERS: Partial<Record<PlaceType, { key: string; label: string }[]>> = {
  olive_young: [
    { key: "global", label: "Global (Tax-free)" }, { key: "late", label: "Open late" },
  ],
  skin_clinic: [
    { key: "aqua_peel", label: "Aqua Peel" }, { key: "skin_booster", label: "Skin Booster" },
    { key: "laser", label: "Laser Toning" }, { key: "lifting", label: "Lifting (HIFU)" },
    { key: "botox_filler", label: "Botox & Filler" }, { key: "facial", label: "Glass Skin Facial" },
  ],
  hair_salon: [
    { key: "cut", label: "Cut" }, { key: "perm", label: "Perm" },
    { key: "color", label: "Color" }, { key: "treatment", label: "Treatment" },
  ],
  nail_lash: [
    { key: "gel_art", label: "Gel Art" }, { key: "3d", label: "3D / Jewelry" },
    { key: "pedicure", label: "Pedicure" }, { key: "lash_ext", label: "Lash Extension" },
    { key: "lash_lift", label: "Lash Lift" },
  ],
  personal_color: [
    { key: "draping", label: "Draping Analysis" }, { key: "makeup", label: "+Makeup Package" },
    { key: "photoshoot", label: "Idol Photoshoot" },
  ],
  head_spa: [
    { key: "scalp", label: "Scalp Deep Cleansing" }, { key: "aroma", label: "Aroma Massage" },
    { key: "diagnosis", label: "Scalp Diagnosis" },
  ],
};

export const CATEGORY_ZONES: Partial<Record<PlaceType, ZoneKey[]>> = {
  hair_salon: ["gangnam_station", "apgujeong", "cheongdam", "hongdae", "myeongdong", "itaewon", "seongsu", "sinsa", "samsung", "jongno", "jamsil", "yeongdeungpo", "busan"],
  skin_clinic: ["gangnam_station", "apgujeong", "cheongdam", "myeongdong"],
  head_spa: ["apgujeong", "cheongdam", "gangnam_station", "hongdae", "myeongdong", "hannam", "jongno"],
  nail_lash: ["gangnam_station", "hongdae", "myeongdong"],
  personal_color: ["gangnam_station", "hongdae"],
  mall: ["myeongdong", "jongno", "samsung", "gangnam_station", "hangang"],
  olive_young: ["gangnam_station", "myeongdong", "hongdae"],
  etc: ["jongno", "myeongdong", "hongdae", "seongsu", "gangnam_station", "itaewon", "hangang"],
};

// ── Places ────────────────────────────────────────────────
export type ServiceItem = { name: string; nameKr?: string; durationMin?: number; price: string };
export type BookingChannel = "naver" | "kakao" | "instagram";

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
  hours?: { open: string; close: string }; // "HH:MM" 24h
  stationWalk?: { station: string; exit?: string; minutes: number };
  services?: ServiceItem[];
  serviceTags?: string[];
  bookingChannels?: BookingChannel[];
  priceConfirmedDaysAgo?: number;
  // Creatrip import extras — kept so the CSV round-trips losslessly.
  priceFromUsd?: number;
  url?: string;
  geoSource?: "address" | "area"; // "area" = neighborhood-centroid fallback, pin is approximate
  // "A drop of Seoul" import — editorial descriptions shown on the detail page.
  about?: string;
  aboutKr?: string;
};

export const PLACES: Place[] = [
  // ── Gangnam Station cluster (persona home base) ──
  { id: "oy-gangnam-town", name: "Olive Young Gangnam Town", nameKr: "올리브영 강남타운점", type: "olive_young", zone: "gangnam_station", priceRange: "₩", rating: 4.6, ratingCount: 412, tags: ["flagship", "tax-free"], nearestStation: "Gangnam", address: "서울 강남구 강남대로 429", lat: 37.5006, lng: 127.0266, englishOk: true, hours: { open: "10:00", close: "22:30" }, stationWalk: { station: "Gangnam", exit: "10", minutes: 3 }, serviceTags: ["global", "late"], badge: { cls: "accent", text: "Tax-free" } },
  { id: "oy-gangnam-stn", name: "Olive Young Gangnam Stn.", nameKr: "올리브영 강남역점", type: "olive_young", zone: "gangnam_station", priceRange: "₩", rating: 4.5, ratingCount: 288, tags: ["k-beauty", "one-stop"], nearestStation: "Gangnam", address: "서울 강남구 강남대로 396", lat: 37.4972, lng: 127.0287, englishOk: true, hours: { open: "09:00", close: "22:00" }, stationWalk: { station: "Gangnam", exit: "11", minutes: 1 }, serviceTags: ["late"] },
  { id: "oy-myeongdong", name: "Olive Young Myeongdong Town", nameKr: "올리브영 명동타운점", type: "olive_young", zone: "myeongdong", priceRange: "₩", rating: 4.7, ratingCount: 1520, tags: ["flagship", "tax-free"], nearestStation: "Myeongdong", address: "서울 중구 명동길 53", lat: 37.5637, lng: 126.9847, englishOk: true, hours: { open: "10:00", close: "22:30" }, stationWalk: { station: "Myeongdong", exit: "6", minutes: 2 }, serviceTags: ["global", "late"], badge: { cls: "accent", text: "Tax-free" } },
  { id: "glow-skin-clinic", name: "Glow & Co. Skin Clinic", nameKr: "글로우앤코 피부과 강남", type: "skin_clinic", zone: "gangnam_station", priceRange: "₩₩", rating: 4.8, ratingCount: 176, tags: ["aqua peel", "glass skin"], nearestStation: "Gangnam", address: "서울 강남구 테헤란로 107", lat: 37.4991, lng: 127.0301, englishOk: true, hours: { open: "10:00", close: "20:00" }, stationWalk: { station: "Gangnam", exit: "1", minutes: 4 }, services: [ { name: "Aqua Peel Basic", nameKr: "아쿠아필 베이직", durationMin: 40, price: "₩90,000" }, { name: "Glass Skin Facial", nameKr: "물광 페이셜", durationMin: 60, price: "₩140,000" }, { name: "LED Calming Care", nameKr: "LED 진정 케어", durationMin: 20, price: "₩40,000" } ], serviceTags: ["aqua_peel", "facial"], bookingChannels: ["naver", "kakao"], priceConfirmedDaysAgo: 3, badge: { cls: "info", text: "Consult first" } },
  { id: "lumiere-derma", name: "Lumière Dermatology", nameKr: "뤼미에르 피부과", type: "skin_clinic", zone: "gangnam_station", priceRange: "₩₩₩", rating: 4.7, ratingCount: 203, tags: ["rejuran", "laser toning"], nearestStation: "Gangnam", address: "서울 강남구 강남대로 468", lat: 37.5041, lng: 127.0247, englishOk: true, hours: { open: "10:00", close: "19:00" }, stationWalk: { station: "Gangnam", exit: "9", minutes: 6 }, services: [ { name: "Rejuran Healer 2cc", nameKr: "리쥬란 힐러 2cc", durationMin: 50, price: "₩350,000" }, { name: "Laser Toning", nameKr: "레이저 토닝", durationMin: 30, price: "₩120,000" }, { name: "HIFU Lifting 300shot", nameKr: "슈링크 리프팅 300샷", durationMin: 45, price: "₩290,000" } ], serviceTags: ["skin_booster", "laser", "lifting"], bookingChannels: ["naver", "kakao"], priceConfirmedDaysAgo: 5, badge: { cls: "info", text: "Consult first" } },
  { id: "sulwha-clinic", name: "Sulwha Skin Clinic", nameKr: "설화 피부과", type: "skin_clinic", zone: "gangnam_station", priceRange: "₩₩₩", rating: 4.5, ratingCount: 96, tags: ["skin booster", "facial"], nearestStation: "Gangnam", address: "서울 강남구 강남대로 400", lat: 37.4970, lng: 127.0276, hours: { open: "10:00", close: "19:00" }, stationWalk: { station: "Gangnam", exit: "11", minutes: 2 }, services: [ { name: "Skin Booster Starter", nameKr: "스킨부스터 스타터", durationMin: 40, price: "₩190,000" }, { name: "Signature Facial", nameKr: "시그니처 페이셜", durationMin: 60, price: "₩110,000" } ], serviceTags: ["skin_booster", "facial", "botox_filler"], bookingChannels: ["naver"], priceConfirmedDaysAgo: 9, badge: { cls: "info", text: "Consult first" } },
  { id: "juno-hair-gangnam", name: "Juno Hair Gangnam", nameKr: "준오헤어 강남점", type: "hair_salon", zone: "gangnam_station", priceRange: "₩₩", rating: 4.7, ratingCount: 210, tags: ["k-pop style", "color", "cut"], nearestStation: "Gangnam", address: "서울특별시 강남구 테헤란로 123", lat: 37.4995, lng: 127.0323, englishOk: true, hours: { open: "10:00", close: "21:00" }, stationWalk: { station: "Gangnam", exit: "1", minutes: 5 }, services: [ { name: "Signature Cut + Color", nameKr: "시그니처 컷+컬러", durationMin: 90, price: "₩220,000" }, { name: "Korean C-curl Perm", nameKr: "C컬펌", durationMin: 120, price: "₩180,000" }, { name: "Express Cut", nameKr: "익스프레스 컷", durationMin: 45, price: "₩80,000" } ], serviceTags: ["cut", "perm", "color"], bookingChannels: ["naver", "instagram"], priceConfirmedDaysAgo: 2, badge: { cls: "accent", text: "English OK" } },
  { id: "chahong-apgujeong", name: "Chahong Ardor", nameKr: "차홍아르더 압구정", type: "hair_salon", zone: "apgujeong", priceRange: "₩₩₩", rating: 4.6, ratingCount: 154, tags: ["color", "perm"], nearestStation: "Apgujeong", address: "서울 강남구 압구정로 200", lat: 37.5273, lng: 127.0287, englishOk: true, hours: { open: "10:00", close: "20:00" }, stationWalk: { station: "Apgujeong", exit: "5", minutes: 4 }, services: [ { name: "Ash Color + Treatment", nameKr: "애쉬 컬러+트리트먼트", durationMin: 150, price: "₩280,000" }, { name: "Hippie Perm", nameKr: "히피펌", durationMin: 140, price: "₩230,000" } ], serviceTags: ["perm", "color", "treatment"], bookingChannels: ["naver", "instagram"], priceConfirmedDaysAgo: 6 },
  { id: "dalgona-nail", name: "Dalgona Nail Atelier", nameKr: "달고나 네일 아뜰리에", type: "nail_lash", zone: "gangnam_station", priceRange: "₩₩", rating: 4.9, ratingCount: 143, tags: ["gel art", "3d gems"], nearestStation: "Gangnam", address: "서울 강남구 강남대로102길 16", lat: 37.5012, lng: 127.0259, englishOk: true, hours: { open: "11:00", close: "21:00" }, stationWalk: { station: "Gangnam", exit: "11", minutes: 5 }, services: [ { name: "Gel Art (One-tone + 2 art)", nameKr: "젤 원톤+아트 2개", durationMin: 90, price: "₩75,000" }, { name: "3D Jewelry Set", nameKr: "3D 주얼리 세트", durationMin: 120, price: "₩120,000" }, { name: "Magnetic Cat-eye Gel", nameKr: "마그네틱 캣아이 젤", durationMin: 100, price: "₩95,000" } ], serviceTags: ["gel_art", "3d"], bookingChannels: ["naver", "kakao", "instagram"], priceConfirmedDaysAgo: 1, badge: { cls: "accent", text: "English OK" } },
  { id: "lash-and-more", name: "Lash & More Studio", nameKr: "래쉬앤모어 스튜디오", type: "nail_lash", zone: "gangnam_station", priceRange: "₩₩", rating: 4.6, ratingCount: 89, tags: ["lash lift", "extensions", "pedicure"], nearestStation: "Sinnonhyeon", address: "서울 서초구 강남대로 505", lat: 37.5046, lng: 127.0243, hours: { open: "10:30", close: "20:30" }, stationWalk: { station: "Sinnonhyeon", exit: "5", minutes: 3 }, services: [ { name: "Lash Lift + Tint", nameKr: "래쉬리프트+틴트", durationMin: 60, price: "₩60,000" }, { name: "Volume Extensions", nameKr: "볼륨 연장", durationMin: 100, price: "₩110,000" }, { name: "Care Pedicure", nameKr: "케어 페디큐어", durationMin: 70, price: "₩65,000" } ], serviceTags: ["lash_lift", "lash_ext", "pedicure"], bookingChannels: ["kakao", "instagram"], priceConfirmedDaysAgo: 4 },
  { id: "colorlab-gangnam", name: "ColorLab Seoul", nameKr: "컬러랩 서울 강남", type: "personal_color", zone: "gangnam_station", priceRange: "₩₩", rating: 4.9, ratingCount: 231, tags: ["draping", "makeup", "photoshoot"], nearestStation: "Gangnam", address: "서울 강남구 테헤란로4길 27", lat: 37.4988, lng: 127.0312, englishOk: true, hours: { open: "10:00", close: "19:00" }, stationWalk: { station: "Gangnam", exit: "2", minutes: 4 }, services: [ { name: "Personal Color Analysis", nameKr: "퍼스널컬러 진단", durationMin: 90, price: "₩120,000" }, { name: "Color + Makeup Package", nameKr: "컬러+메이크업 패키지", durationMin: 150, price: "₩220,000" }, { name: "Idol Photoshoot Add-on", nameKr: "아이돌 화보 애드온", durationMin: 60, price: "₩150,000" } ], serviceTags: ["draping", "makeup", "photoshoot"], bookingChannels: ["naver", "instagram"], priceConfirmedDaysAgo: 2, badge: { cls: "accent", text: "English OK" } },
  { id: "mood-palette", name: "Mood Palette Studio", nameKr: "무드팔레트 스튜디오", type: "personal_color", zone: "hongdae", priceRange: "₩₩", rating: 4.7, ratingCount: 118, tags: ["draping", "styling"], nearestStation: "Hongik Univ.", address: "서울 마포구 와우산로 94", lat: 37.5531, lng: 126.9241, englishOk: true, hours: { open: "11:00", close: "20:00" }, stationWalk: { station: "Hongik Univ.", exit: "9", minutes: 5 }, services: [ { name: "Personal Color Analysis", nameKr: "퍼스널컬러 진단", durationMin: 80, price: "₩99,000" }, { name: "Styling Consult", nameKr: "스타일링 컨설팅", durationMin: 60, price: "₩80,000" } ], serviceTags: ["draping"], bookingChannels: ["instagram"], priceConfirmedDaysAgo: 7 },
  { id: "soothe-head-spa", name: "Soothe Head Spa Gangnam", nameKr: "수드 헤드스파 강남", type: "head_spa", zone: "gangnam_station", priceRange: "₩₩", rating: 4.8, ratingCount: 97, tags: ["scalp", "aroma", "waterfall rinse"], nearestStation: "Yeoksam", address: "서울 강남구 논현로85길 26", lat: 37.5008, lng: 127.0355, englishOk: true, hours: { open: "10:00", close: "22:00" }, stationWalk: { station: "Yeoksam", exit: "3", minutes: 4 }, services: [ { name: "18-Step Head Spa", nameKr: "18단계 헤드스파", durationMin: 90, price: "₩110,000" }, { name: "Scalp Diagnosis + Deep Cleanse", nameKr: "두피진단+딥클렌징", durationMin: 60, price: "₩80,000" } ], serviceTags: ["scalp", "aroma", "diagnosis"], bookingChannels: ["naver", "kakao"], priceConfirmedDaysAgo: 3, badge: { cls: "accent", text: "English OK" } },
  // ── Migrated (existing places, new taxonomy) ──
  { id: "hosu-dosan", name: "HOSU DOSAN", nameKr: "호수 도산점", type: "head_spa", zone: "apgujeong", priceRange: "₩₩₩", rating: 4.8, ratingCount: 132, tags: ["scalp", "aroma", "therapy"], nearestStation: "Apgujeong Rodeo", address: "서울 강남구 도산대로 123", lat: 37.5240, lng: 127.0380, englishOk: true, hours: { open: "10:00", close: "21:00" }, stationWalk: { station: "Apgujeong Rodeo", exit: "5", minutes: 6 }, services: [ { name: "Signature Head Spa", nameKr: "시그니처 헤드스파", durationMin: 80, price: "₩150,000" }, { name: "Aroma Scalp Massage", nameKr: "아로마 두피 마사지", durationMin: 60, price: "₩110,000" } ], serviceTags: ["scalp", "aroma"], bookingChannels: ["naver", "instagram"], priceConfirmedDaysAgo: 4, badge: { cls: "accent", text: "English OK" } },
  { id: "eden-headspa", name: "Eden Head Spa", nameKr: "에덴 헤드스파", type: "head_spa", zone: "hongdae", priceRange: "₩₩", rating: 4.7, ratingCount: 88, tags: ["scalp", "therapy"], nearestStation: "Hongik Univ.", address: "서울 마포구 양화로 45", lat: 37.5537, lng: 126.9184, englishOk: true, hours: { open: "11:00", close: "21:00" }, stationWalk: { station: "Hongik Univ.", exit: "1", minutes: 4 }, services: [ { name: "Waterfall Rinse Spa", nameKr: "워터폴 린스 스파", durationMin: 70, price: "₩90,000" } ], serviceTags: ["scalp"], bookingChannels: ["kakao"], priceConfirmedDaysAgo: 8, badge: { cls: "accent", text: "English OK" } },
  { id: "la-beaute", name: "La Beauté Coréenne", nameKr: "라 보떼 꼬레엔느", type: "head_spa", zone: "cheongdam", priceRange: "₩₩₩", rating: 4.6, ratingCount: 61, tags: ["aroma", "luxury"], nearestStation: "Cheongdam", address: "서울 강남구 청담동 21", lat: 37.5253, lng: 127.0476, hours: { open: "10:00", close: "20:00" }, stationWalk: { station: "Cheongdam", exit: "9", minutes: 7 }, services: [ { name: "Luxury Aroma Course", nameKr: "럭셔리 아로마 코스", durationMin: 100, price: "₩190,000" } ], serviceTags: ["aroma"], bookingChannels: ["naver"], priceConfirmedDaysAgo: 12, badge: { cls: "warning", text: "Luxury" } },
  { id: "dragon-hill-spa", name: "Dragon Hill Spa", nameKr: "드래곤힐 스파", type: "etc", zone: "hangang", priceRange: "₩", rating: 4.4, ratingCount: 320, tags: ["jjimjilbang", "sauna"], nearestStation: "Yongsan", address: "서울 용산구 한강대로 21길 60", lat: 37.5299, lng: 126.9646, hours: { open: "09:00", close: "23:00" }, priceConfirmedDaysAgo: 6, services: [
    { name: "Day Pass (Jjimjilbang)", nameKr: "찜질방 종일권", price: "₩15,000" },
    { name: "Body Scrub", nameKr: "세신", durationMin: 60, price: "₩90,000" },
    { name: "Aroma Massage", nameKr: "아로마 마사지", durationMin: 60, price: "₩110,000" },
    { name: "Foot Care", nameKr: "발 관리", durationMin: 30, price: "₩45,000" },
  ] },
  { id: "bukchon-hanok", name: "Bukchon Hanok Village", nameKr: "북촌한옥마을", type: "etc", zone: "jongno", priceRange: "₩", rating: 4.7, ratingCount: 1200, tags: ["photo spot", "hanok", "culture"], nearestStation: "Anguk", address: "서울 종로구 계동길", lat: 37.5814, lng: 126.9849 },
  { id: "seongsu-cafe", name: "Onion Seongsu", nameKr: "어니언 성수", type: "etc", zone: "seongsu", priceRange: "₩₩", rating: 4.6, ratingCount: 540, tags: ["cafe", "photo spot"], nearestStation: "Seongsu", address: "서울 성동구 아차산로9길 8", lat: 37.5444, lng: 127.0578 },

  // ── Malls & gift shopping — real tourist landmarks (tax-refund / souvenir hubs) ──
  { id: "hyundai-seoul", name: "The Hyundai Seoul", nameKr: "더현대 서울", type: "mall", zone: "hangang", district: "Yeongdeungpo-gu", priceRange: "₩₩", rating: 4.6, ratingCount: 2100, tags: ["tax-refund", "souvenirs", "k-beauty hall", "food hall"], nearestStation: "Yeouinaru", address: "서울 영등포구 여의대로 108", lat: 37.5259, lng: 126.9285, englishOk: true, hours: { open: "10:30", close: "20:00" }, stationWalk: { station: "Yeouinaru", exit: "1", minutes: 5 }, badge: { cls: "accent", text: "Tax-free" } },
  { id: "lotte-dept-main", name: "Lotte Department Store Main", nameKr: "롯데백화점 본점", type: "mall", zone: "myeongdong", priceRange: "₩₩", rating: 4.5, ratingCount: 1850, tags: ["tax-refund", "souvenirs", "duty-free floor"], nearestStation: "Euljiro 1-ga", address: "서울 중구 남대문로 81", lat: 37.5649, lng: 126.9817, englishOk: true, hours: { open: "10:30", close: "20:00" }, stationWalk: { station: "Euljiro 1-ga", exit: "7", minutes: 2 }, badge: { cls: "accent", text: "Tax-free" } },
  { id: "shinsegae-main", name: "Shinsegae Main Store", nameKr: "신세계백화점 본점", type: "mall", zone: "myeongdong", priceRange: "₩₩₩", rating: 4.6, ratingCount: 1400, tags: ["tax-refund", "souvenirs", "luxury", "heritage building"], nearestStation: "Hoehyeon", address: "서울 중구 소공로 63", lat: 37.5606, lng: 126.9805, englishOk: true, hours: { open: "10:30", close: "20:00" }, stationWalk: { station: "Hoehyeon", exit: "7", minutes: 1 } },
  { id: "namdaemun-market", name: "Namdaemun Market", nameKr: "남대문시장", type: "mall", zone: "myeongdong", priceRange: "₩", rating: 4.4, ratingCount: 3200, tags: ["souvenirs", "street food", "ginseng", "bargain"], nearestStation: "Hoehyeon", address: "서울 중구 남대문시장4길 21", lat: 37.5594, lng: 126.9776, hours: { open: "09:00", close: "22:00" }, stationWalk: { station: "Hoehyeon", exit: "5", minutes: 1 } },
  { id: "ssamziegil", name: "Ssamziegil (Insadong)", nameKr: "쌈지길", type: "mall", zone: "jongno", priceRange: "₩", rating: 4.5, ratingCount: 980, tags: ["souvenirs", "crafts", "hanji", "gift shops"], nearestStation: "Anguk", address: "서울 종로구 인사동길 44", lat: 37.5744, lng: 126.9852, englishOk: true, hours: { open: "10:30", close: "20:30" }, stationWalk: { station: "Anguk", exit: "6", minutes: 3 } },
  { id: "doota-mall", name: "Doota Mall", nameKr: "두타몰", type: "mall", zone: "jongno", district: "Jung-gu", priceRange: "₩", rating: 4.3, ratingCount: 1100, tags: ["souvenirs", "fashion", "open late", "tax-refund"], nearestStation: "Dongdaemun", address: "서울 중구 장충단로 275", lat: 37.5687, lng: 127.0093, englishOk: true, hours: { open: "10:30", close: "24:00" }, stationWalk: { station: "Dongdaemun", exit: "8", minutes: 1 }, badge: { cls: "info", text: "Open late" } },
  { id: "starfield-coex", name: "Starfield COEX Mall", nameKr: "스타필드 코엑스몰", type: "mall", zone: "samsung", priceRange: "₩₩", rating: 4.5, ratingCount: 2600, tags: ["souvenirs", "starfield library", "k-pop merch", "tax-refund"], nearestStation: "Samseong", address: "서울 강남구 영동대로 513", lat: 37.5115, lng: 127.0590, englishOk: true, hours: { open: "10:30", close: "22:00" }, stationWalk: { station: "Samseong", exit: "6", minutes: 2 }, badge: { cls: "accent", text: "Tax-free" } },
  { id: "hyundai-trade", name: "Hyundai Dept. Trade Center", nameKr: "현대백화점 무역센터점", type: "mall", zone: "samsung", priceRange: "₩₩₩", rating: 4.4, ratingCount: 760, tags: ["tax-refund", "luxury", "souvenirs"], nearestStation: "Samseong", address: "서울 강남구 테헤란로 517", lat: 37.5088, lng: 127.0603, englishOk: true, hours: { open: "10:30", close: "20:00" }, stationWalk: { station: "Samseong", exit: "5", minutes: 1 } },
  { id: "shinsegae-gangnam", name: "Shinsegae Gangnam", nameKr: "신세계백화점 강남점", type: "mall", zone: "gangnam_station", district: "Seocho-gu", priceRange: "₩₩₩", rating: 4.5, ratingCount: 1500, tags: ["tax-refund", "souvenirs", "food hall"], nearestStation: "Express Bus Terminal", address: "서울 서초구 신반포로 176", lat: 37.5049, lng: 127.0043, englishOk: true, hours: { open: "10:30", close: "20:00" }, stationWalk: { station: "Express Bus Terminal", exit: "7", minutes: 1 }, badge: { cls: "accent", text: "Tax-free" } },
  { id: "lotte-world-mall", name: "Lotte World Mall", nameKr: "롯데월드몰", type: "mall", zone: "samsung", district: "Songpa-gu", priceRange: "₩₩", rating: 4.6, ratingCount: 2900, tags: ["souvenirs", "duty-free", "seoul sky", "k-pop merch"], nearestStation: "Jamsil", address: "서울 송파구 올림픽로 300", lat: 37.5125, lng: 127.1023, englishOk: true, hours: { open: "10:30", close: "22:00" }, stationWalk: { station: "Jamsil", exit: "1", minutes: 2 }, badge: { cls: "accent", text: "Tax-free" } },

  // ── Density pass — beauty places across zones (map felt sparse outside Gangnam) ──
  { id: "oy-hongdae", name: "Olive Young Hongdae Central", nameKr: "올리브영 홍대중앙점", type: "olive_young", zone: "hongdae", priceRange: "₩", rating: 4.5, ratingCount: 640, tags: ["tax-free", "k-beauty"], nearestStation: "Hongik Univ.", address: "서울 마포구 양화로 153", lat: 37.5563, lng: 126.9236, englishOk: true, hours: { open: "10:00", close: "22:30" }, stationWalk: { station: "Hongik Univ.", exit: "9", minutes: 2 }, serviceTags: ["global", "late"], badge: { cls: "accent", text: "Tax-free" } },
  { id: "oy-seongsu", name: "Olive Young Seongsu", nameKr: "올리브영 성수역점", type: "olive_young", zone: "seongsu", priceRange: "₩", rating: 4.4, ratingCount: 310, tags: ["k-beauty"], nearestStation: "Seongsu", address: "서울 성동구 왕십리로 115", lat: 37.5444, lng: 127.0561, englishOk: true, hours: { open: "10:00", close: "22:00" }, stationWalk: { station: "Seongsu", exit: "3", minutes: 1 }, serviceTags: ["late"] },
  { id: "oy-itaewon", name: "Olive Young Itaewon", nameKr: "올리브영 이태원점", type: "olive_young", zone: "itaewon", priceRange: "₩", rating: 4.3, ratingCount: 280, tags: ["k-beauty", "tax-free"], nearestStation: "Itaewon", address: "서울 용산구 이태원로 177", lat: 37.5346, lng: 126.9942, englishOk: true, hours: { open: "10:00", close: "22:30" }, stationWalk: { station: "Itaewon", exit: "2", minutes: 1 }, serviceTags: ["global"] },
  { id: "glow-myeongdong", name: "Glow Seoul Clinic Myeongdong", nameKr: "글로우서울의원 명동", type: "skin_clinic", zone: "myeongdong", priceRange: "₩₩", rating: 4.6, ratingCount: 240, tags: ["glass skin", "facial"], nearestStation: "Myeongdong", address: "서울 중구 명동길 43", lat: 37.5633, lng: 126.9838, englishOk: true, hours: { open: "10:00", close: "20:00" }, stationWalk: { station: "Myeongdong", exit: "8", minutes: 2 }, serviceTags: ["facial", "aqua_peel"], bookingChannels: ["naver"], priceConfirmedDaysAgo: 5 },
  { id: "hongdae-derma", name: "Hongdae Derma Lab", nameKr: "홍대 더마랩의원", type: "skin_clinic", zone: "hongdae", priceRange: "₩₩", rating: 4.5, ratingCount: 190, tags: ["laser", "skin booster"], nearestStation: "Hongik Univ.", address: "서울 마포구 홍익로 25", lat: 37.5559, lng: 126.9270, englishOk: true, hours: { open: "10:30", close: "20:30" }, stationWalk: { station: "Hongik Univ.", exit: "8", minutes: 3 }, serviceTags: ["laser", "skin_booster"], bookingChannels: ["naver", "kakao"], priceConfirmedDaysAgo: 9 },
  { id: "ari-hair-myeongdong", name: "Ari Hair Myeongdong", nameKr: "아리헤어 명동", type: "hair_salon", zone: "myeongdong", priceRange: "₩₩", rating: 4.6, ratingCount: 170, tags: ["k-pop cut", "color"], nearestStation: "Myeongdong", address: "서울 중구 명동8길 27", lat: 37.5641, lng: 126.9853, englishOk: true, hours: { open: "10:00", close: "21:00" }, stationWalk: { station: "Myeongdong", exit: "6", minutes: 2 }, serviceTags: ["cut", "color"], bookingChannels: ["naver"], priceConfirmedDaysAgo: 7 },
  { id: "mint-salon-seongsu", name: "Mint Salon Seongsu", nameKr: "민트살롱 성수", type: "hair_salon", zone: "seongsu", priceRange: "₩₩", rating: 4.7, ratingCount: 140, tags: ["perm", "treatment"], nearestStation: "Seongsu", address: "서울 성동구 연무장길 41", lat: 37.5427, lng: 127.0553, englishOk: true, hours: { open: "10:30", close: "20:30" }, stationWalk: { station: "Seongsu", exit: "4", minutes: 4 }, serviceTags: ["perm", "treatment"], bookingChannels: ["naver", "instagram"], priceConfirmedDaysAgo: 3 },
  { id: "blanc-hair-hongdae", name: "Blanc Hair Hongdae", nameKr: "블랑헤어 홍대", type: "hair_salon", zone: "hongdae", priceRange: "₩", rating: 4.4, ratingCount: 210, tags: ["cut", "color", "student"], nearestStation: "Hongik Univ.", address: "서울 마포구 와우산로 87", lat: 37.5540, lng: 126.9225, hours: { open: "10:00", close: "21:00" }, stationWalk: { station: "Hongik Univ.", exit: "9", minutes: 5 }, serviceTags: ["cut", "color"], bookingChannels: ["kakao"], priceConfirmedDaysAgo: 11 },
  { id: "petit-nail-myeongdong", name: "Petit Nail Myeongdong", nameKr: "쁘띠네일 명동", type: "nail_lash", zone: "myeongdong", priceRange: "₩₩", rating: 4.5, ratingCount: 130, tags: ["gel art", "walk-in"], nearestStation: "Myeongdong", address: "서울 중구 명동4길 18", lat: 37.5628, lng: 126.9862, englishOk: true, hours: { open: "11:00", close: "21:00" }, stationWalk: { station: "Myeongdong", exit: "6", minutes: 3 }, serviceTags: ["gel_art", "pedicure"], bookingChannels: ["naver"], priceConfirmedDaysAgo: 6 },
  { id: "moon-nail-hongdae", name: "Moon Nail Hongdae", nameKr: "문네일 홍대", type: "nail_lash", zone: "hongdae", priceRange: "₩", rating: 4.6, ratingCount: 160, tags: ["3d art", "lash"], nearestStation: "Hongik Univ.", address: "서울 마포구 어울마당로 65", lat: 37.5570, lng: 126.9245, englishOk: true, hours: { open: "11:00", close: "21:30" }, stationWalk: { station: "Hongik Univ.", exit: "9", minutes: 4 }, serviceTags: ["3d", "lash_ext"], bookingChannels: ["instagram"], priceConfirmedDaysAgo: 8 },
  { id: "tone-studio-hongdae", name: "Tone Studio Hongdae", nameKr: "톤스튜디오 홍대", type: "personal_color", zone: "hongdae", priceRange: "₩₩", rating: 4.8, ratingCount: 220, tags: ["draping", "photo"], nearestStation: "Hongik Univ.", address: "서울 마포구 잔다리로 32", lat: 37.5525, lng: 126.9218, englishOk: true, hours: { open: "11:00", close: "20:00" }, stationWalk: { station: "Hongik Univ.", exit: "9", minutes: 6 }, serviceTags: ["draping", "makeup"], bookingChannels: ["naver", "instagram"], priceConfirmedDaysAgo: 2 },
  { id: "palette-lab-seongsu", name: "Palette Lab Seongsu", nameKr: "팔레트랩 성수", type: "personal_color", zone: "seongsu", priceRange: "₩₩", rating: 4.7, ratingCount: 150, tags: ["draping", "idol photoshoot"], nearestStation: "Seongsu", address: "서울 성동구 서울숲2길 19", lat: 37.5449, lng: 127.0428, englishOk: true, hours: { open: "11:00", close: "20:00" }, stationWalk: { station: "Ttukseom", exit: "8", minutes: 5 }, serviceTags: ["draping", "photoshoot"], bookingChannels: ["naver"], priceConfirmedDaysAgo: 4 },
  { id: "cloud-headspa-cheongdam", name: "Cloud Head Spa Cheongdam", nameKr: "클라우드 헤드스파 청담", type: "head_spa", zone: "cheongdam", priceRange: "₩₩₩", rating: 4.7, ratingCount: 95, tags: ["scalp", "luxury"], nearestStation: "Cheongdam", address: "서울 강남구 도산대로 456", lat: 37.5252, lng: 127.0475, englishOk: true, hours: { open: "10:00", close: "21:00" }, stationWalk: { station: "Cheongdam", exit: "13", minutes: 5 }, serviceTags: ["scalp", "aroma"], bookingChannels: ["naver"], priceConfirmedDaysAgo: 5 },
  { id: "onda-scalp-myeongdong", name: "Onda Scalp Myeongdong", nameKr: "온다스캘프 명동", type: "head_spa", zone: "myeongdong", priceRange: "₩₩", rating: 4.5, ratingCount: 110, tags: ["scalp", "diagnosis"], nearestStation: "Myeongdong", address: "서울 중구 퇴계로 123", lat: 37.5622, lng: 126.9829, englishOk: true, hours: { open: "10:30", close: "21:00" }, stationWalk: { station: "Myeongdong", exit: "3", minutes: 2 }, serviceTags: ["scalp", "diagnosis"], bookingChannels: ["kakao"], priceConfirmedDaysAgo: 10 },
  { id: "siloam-sauna", name: "Siloam Sauna", nameKr: "실로암사우나", type: "etc", zone: "myeongdong", district: "Jung-gu", priceRange: "₩", rating: 4.2, ratingCount: 450, tags: ["jjimjilbang", "sauna", "24h"], nearestStation: "Seoul Station", address: "서울 중구 중림로 49", lat: 37.5554, lng: 126.9692, hours: { open: "00:00", close: "23:59" }, stationWalk: { station: "Seoul Station", exit: "15", minutes: 5 }, badge: { cls: "info", text: "24h" } },
  // Creatrip hair-salon import (206 rows → scripts/build-creatrip-places.mjs).
  ...CREATRIP_PLACES,
  // Seoul Olive Young stores from OpenStreetMap (scripts/build-oliveyoung-places.mjs).
  ...OLIVEYOUNG_PLACES,
  // "A drop of Seoul" attractions + towers & markets (scripts/build-ados-places.mjs).
  ...ADOS_PLACES,
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
  /** External retailer URL; only rendered when verification metadata is also present. */
  onlineUrl?: string;
  /** ISO date documenting when the retailer URL was last verified. */
  onlineUrlVerifiedAt?: string;
  salesRank: number;
  reviewRank: number;
};

export const PRODUCTS: Product[] = [
  { id: "cosrx-snail-mucin", brand: "COSRX", name: "Advanced Snail 96 Mucin Power Essence", nameKr: "코스알엑스 달팽이 뮤신 96 에센스", category: "skincare", stepCategory: "essence", channel: "olive_young", priceRange: "₩₩", isEditorsPick: true, isTrending: true, skinTypes: ["Dry", "Sensitive"], concerns: ["Hydration", "Brightening"], zoneAvailability: ["myeongdong", "hongdae", "gangnam_station"], salesRank: 1, reviewRank: 2 },
  { id: "anua-heartleaf-toner", brand: "Anua", name: "Heartleaf 77% Soothing Toner", nameKr: "아누아 어성초 77 토너", category: "skincare", stepCategory: "toner", channel: "olive_young", priceRange: "₩", isTrending: true, skinTypes: ["Oily", "Combo", "Sensitive"], concerns: ["Redness", "Pores"], salesRank: 2, reviewRank: 1 },
  { id: "boj-glow-serum", brand: "Beauty of Joseon", name: "Glow Deep Serum: Rice + Alpha Arbutin", nameKr: "조선미녀 글로우 세럼", category: "skincare", stepCategory: "serum", channel: "olive_young", priceRange: "₩₩", isEditorsPick: true, skinTypes: ["Dry", "Combo"], concerns: ["Brightening", "Hydration"], salesRank: 4, reviewRank: 3 },
  { id: "boj-relief-sun", brand: "Beauty of Joseon", name: "Relief Sun: Rice + Probiotics SPF50+", nameKr: "조선미녀 릴리프 선크림", category: "skincare", stepCategory: "sunscreen", channel: "olive_young", priceRange: "₩", isTrending: true, skinTypes: ["Dry", "Oily", "Combo", "Sensitive"], concerns: ["Hydration"], salesRank: 3, reviewRank: 4 },
  { id: "klairs-cleansing-oil", brand: "Klairs", name: "Gentle Black Deep Cleansing Oil", nameKr: "클레어스 젠틀 블랙 클렌징 오일", category: "skincare", stepCategory: "cleanser", channel: "olive_young", priceRange: "₩₩", skinTypes: ["Dry", "Sensitive"], concerns: ["Hydration"], salesRank: 8, reviewRank: 9 },
  { id: "illiyoon-cream", brand: "Illiyoon", name: "Ceramide Ato Concentrate Cream", nameKr: "일리윤 세라마이드 아토 크림", category: "skincare", stepCategory: "moisturizer", channel: "olive_young", priceRange: "₩", isEssenly: true, skinTypes: ["Dry", "Sensitive"], concerns: ["Hydration"], salesRank: 7, reviewRank: 6 },
  { id: "mediheal-teatree", brand: "Mediheal", name: "Tea Tree Care Solution Mask (10pk)", nameKr: "메디힐 티트리 마스크팩", category: "skincare", stepCategory: "mask_pack", channel: "olive_young", priceRange: "₩", skinTypes: ["Oily", "Combo"], concerns: ["Acne", "Redness"], salesRank: 6, reviewRank: 5 },
  { id: "mise-perfect-shampoo", brand: "Mise en Scène", name: "Perfect Serum Shampoo", nameKr: "미장센 퍼펙트 세럼 샴푸", category: "haircare", stepCategory: "shampoo", channel: "olive_young", priceRange: "₩", skinTypes: [], concerns: ["Damaged", "Frizz"], salesRank: 10, reviewRank: 11 },
  { id: "tsubaki-treatment", brand: "Tsubaki", name: "Premium Repair Hair Treatment", nameKr: "츠바키 프리미엄 리페어 트리트먼트", category: "haircare", stepCategory: "hair_treatment", channel: "korea_exclusive", priceRange: "₩₩", skinTypes: [], concerns: ["Damaged"], salesRank: 11, reviewRank: 12 },
  { id: "romand-tint", brand: "rom&nd", name: "Juicy Lasting Tint", nameKr: "롬앤 쥬시 래스팅 틴트", category: "makeup", channel: "olive_young", priceRange: "₩", isTrending: true, skinTypes: [], concerns: [], salesRank: 5, reviewRank: 8 },
  { id: "round-lab-lotion", brand: "Round Lab", name: "1025 Dokdo Lotion", nameKr: "라운드랩 1025 독도 로션", category: "bodycare", channel: "olive_young", priceRange: "₩", skinTypes: ["Dry"], concerns: ["Hydration"], salesRank: 9, reviewRank: 7 },
  { id: "tamburins-perfume", brand: "Tamburins", name: "Perfume Shot Hand Balm", nameKr: "탬버린즈 퍼퓸 핸드밤", category: "fragrance", channel: "korea_exclusive", priceRange: "₩₩", isEssenly: true, skinTypes: [], concerns: [], salesRank: 12, reviewRank: 10 },
  { id: "dashing-diva-gel", brand: "Dashing Diva", name: "Magic Press Premium Gel Nails", nameKr: "대싱디바 매직프레스 프리미엄", category: "nail", channel: "olive_young", priceRange: "₩", isTrending: true, skinTypes: [], concerns: [], salesRank: 13, reviewRank: 13 },
  { id: "ohora-semicure", brand: "ohora", name: "Semi-cure Gel Nail Strips", nameKr: "오호라 세미큐어 젤네일", category: "nail", channel: "olive_young", priceRange: "₩₩", skinTypes: [], concerns: [], salesRank: 14, reviewRank: 14 },
];

// ── Product filter taxonomy (Shop) ────────────────────────
export const SHOP_CATEGORIES: { key: "all" | ProductCategory; label: string }[] = [
  { key: "all", label: "All" },
  { key: "skincare", label: "Skincare" },
  { key: "haircare", label: "Haircare" },
  { key: "makeup", label: "Makeup" },
  { key: "nail", label: "Nail" },
  { key: "bodycare", label: "Body" },
  { key: "tools", label: "Tools" },
  { key: "fragrance", label: "Fragrance" },
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
  { key: "all", label: "All" },
  ...MAP_CATEGORIES.filter((c) => c.key !== "all").map((c) => ({ key: c.key as string, label: c.label })),
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
export const brandSlug = (brand: string) => brand.toLowerCase().replace(/\s+/g, "-");

export const CATEGORY_META: Record<string, { title: string; eyebrow: string; line1: string; line2: string; blurb: string; types: PlaceType[] }> = {
  spot: { title: "Browse", eyebrow: "SEOUL BEAUTY", line1: "Beauty spots", line2: "by district.", blurb: "Browse Seoul by district first, then narrow into clinics, salons, nail and color studios.", types: ["olive_young", "skin_clinic", "hair_salon", "nail_lash", "personal_color", "head_spa", "etc"] },
  hair_salon: { title: "Hair Salon", eyebrow: "HAIR", line1: "Hair", line2: "Salon", blurb: "K-pop styles, color, and signature cuts. English-friendly stylists curated for visitors.", types: ["hair_salon"] },
  skin_clinic: { title: "Skin Clinic", eyebrow: "CLINIC", line1: "Skin", line2: "Clinic", blurb: "Dermatology, skin boosters, facials, and non-surgical aesthetic treatments.", types: ["skin_clinic"] },
  nail_lash: { title: "Nail & Lash", eyebrow: "NAIL · LASH", line1: "Nail &", line2: "Lash", blurb: "K-nail art, 3D gems, pedicure, lash lifts and extensions.", types: ["nail_lash"] },
  personal_color: { title: "Personal Color", eyebrow: "COLOR", line1: "Personal", line2: "Color", blurb: "Draping analysis, makeup packages, and idol photoshoots.", types: ["personal_color"] },
  head_spa: { title: "Head Spa", eyebrow: "HEAD SPA", line1: "Head", line2: "Spa", blurb: "Korean head spa, curated. Scalp diagnosis, aroma massage, and hair therapy.", types: ["head_spa"] },
  etc: { title: "More", eyebrow: "ETC", line1: "Spas &", line2: "local spots", blurb: "Jjimjilbang, body spas, cafés and photo spots worth a detour.", types: ["etc"] },
};
