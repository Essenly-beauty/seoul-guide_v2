import { describe, expect, it } from "vitest";
import { buildPlacePhotoImportPlan } from "./place-photo-import";

const places = [
  {
    id: "001",
    slug: "juno-hair-garosugil",
    nameEn: "JUNO HAIR Garosugil",
    nameKr: "준오헤어 가로수길점",
    verified: true,
  },
  {
    id: "002",
    slug: "color-place",
    nameEn: "Color Place (K-pop Celeb Personal Color)",
    nameKr: "컬러플레이스 (강남)",
    verified: true,
  },
  {
    id: "043",
    slug: "onyad-hair",
    nameEn: "ONYAD Hair",
    nameKr: "온야드 (압구정로데오)",
    verified: true,
  },
  {
    id: "128",
    slug: "j-olly-nail-art-hapjeong",
    nameEn: "J.Olly Nail Art (Hapjeong)",
    nameKr: "제이올리 네일아트 합정점",
    verified: true,
  },
  {
    id: "198",
    slug: "bamboo-therapy",
    nameEn: "Bamboo Therapy",
    nameKr: "뱀부테라피",
    verified: false,
  },
];

const folders = [
  { id: "drive-001", title: "001_JUNO HAIR Garosugil", url: "https://drive.example/001" },
  { id: "drive-002", title: "002_Color Place", url: "https://drive.example/002" },
  { id: "drive-043", title: "043_온야드 압구정로데오점", url: "https://drive.example/043" },
  { id: "drive-128", title: "128_제이올리 공덕점", url: "https://drive.example/128" },
  { id: "drive-198", title: "198_뱀부테라피", url: "https://drive.example/198" },
  { id: "drive-999", title: "999_Unknown", url: "https://drive.example/999" },
];

describe("place photo import planning", () => {
  it("accepts verified exact names and conservative catalogue-prefix labels", () => {
    const plan = buildPlacePhotoImportPlan(places, folders);

    expect(plan.ready).toEqual([
      expect.objectContaining({ numericId: "001", placeId: "ados-juno-hair-garosugil" }),
      expect.objectContaining({ numericId: "002", placeId: "ados-color-place" }),
    ]);
  });

  it("keeps unverified, unknown, mismatched, and overly-specific branch folders out of publication", () => {
    const plan = buildPlacePhotoImportPlan(places, folders);

    expect(plan.review.map(({ numericId, reason }) => [numericId, reason])).toEqual([
      ["043", "name_mismatch"],
      ["128", "name_mismatch"],
      ["198", "place_unverified"],
      ["999", "unknown_place_id"],
    ]);
  });
});
