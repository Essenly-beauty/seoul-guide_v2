import { existsSync, readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { describe, expect, it } from "vitest";
import { CategoryBadge } from "@/components/category/category-badge";
import { PlaceThumbnail } from "@/components/place/place-thumbnail";
import { ProductThumbnail } from "@/components/product/product-thumbnail";
import { firstAvailableImage, placeImageSources } from "./place-images";
import { BRAND_MARK_SRC, TYPE_ICON, type Place } from "./data";

const place: Place = {
  id: "photo-test", name: "Test Salon", nameKr: "테스트", type: "hair_salon",
  zone: "gangnam_station", tags: [], address: "Test street", lat: 37.5, lng: 127.03,
};

describe("verified list images", () => {
  it("prefers the small verified photo and retries gallery photos before the retailer logo", () => {
    const sources = placeImageSources({ ...place, type: "daiso", photoThumbnail: "/thumb.webp", photos: ["/first.webp", "", "/second.webp"], photoUrl: "/first.webp" });
    expect(sources.map(({ src }) => src)).toEqual(["/thumb.webp", "/first.webp", "/second.webp", "/brands/daiso-logo.jpeg"]);
    expect(firstAvailableImage(sources, ["/thumb.webp"])).toMatchObject({ src: "/first.webp", kind: "photo" });
    expect(firstAvailableImage(sources, ["/thumb.webp", "/first.webp", "/second.webp"])).toMatchObject({ kind: "brand" });
    expect(firstAvailableImage(sources, sources.map(({ src }) => src))).toBeUndefined();
  });

  it("supports the legacy photo URL and ignores blank candidates", () => {
    expect(placeImageSources({ ...place, photos: [""], photoThumbnail: " ", photoUrl: "/legacy.jpg" })).toEqual([
      { src: "/legacy.jpg", alt: "Test Salon photo", kind: "photo" },
    ]);
    expect(placeImageSources(place)).toEqual([]);
  });

  it("stays out of a row's accessible name: rows are named by their own text (tests-1)", () => {
    const photo = load(renderToStaticMarkup(<PlaceThumbnail place={{ ...place, photos: ["/approved.webp"] }} size={44} />));
    expect(photo("img").attr("alt")).toBe("");
    expect(photo("[data-image-kind=photo]").attr("aria-hidden")).toBe("true");
    const empty = load(renderToStaticMarkup(<PlaceThumbnail place={place} />));
    expect(empty("[role=img]")).toHaveLength(0);
    expect(empty("[aria-label]")).toHaveLength(0);
    expect(empty("[data-image-kind=fallback]").attr("aria-hidden")).toBe("true");
    const product = load(renderToStaticMarkup(<ProductThumbnail product={{ name: "Row product", imageUrl: "/product.webp" }} />));
    expect(product("img").attr("alt")).toBe("");
  });

  it("fills the box with an available place photo and uses a small semantic fallback otherwise", () => {
    const photo = load(renderToStaticMarkup(<PlaceThumbnail place={{ ...place, photos: ["/approved.webp"] }} size={44} decorative={false} />));
    expect(photo("img").attr("src")).toBe("/approved.webp");
    expect(photo("img").attr("loading")).toBe("lazy");
    expect(photo("img").attr("alt")).toBe("Test Salon photo");
    expect(photo("img").attr("style")).toContain("object-fit:cover");
    expect(photo("[data-image-kind=photo]").attr("style")).toContain("width:44px");
    const empty = load(renderToStaticMarkup(<PlaceThumbnail place={place} decorative={false} />));
    expect(empty("img")).toHaveLength(0);
    expect(empty("use").attr("href")).toBe("#i-scissors");
    expect(empty("svg").attr("style")).toContain("width:22px");
    expect(empty("[role=img]").attr("aria-label")).toBe("Hair Salon · photo unavailable");
  });

  it("labels a chain logo as a brand image rather than as a branch photo", () => {
    const $ = load(renderToStaticMarkup(<PlaceThumbnail place={{ ...place, type: "olive_young" }} decorative={false} />));
    expect($("img").attr("src")).toBe("/brands/olive-young-logo.jpeg");
    expect($("img").attr("alt")).toBe("Olive Young logo");
    expect($("img").attr("style")).toContain("object-fit:contain");
    expect($("[data-image-kind=brand]")).toHaveLength(1);
  });

  it("shows a verified product image when supplied and a quiet product icon otherwise", () => {
    const photo = load(renderToStaticMarkup(<ProductThumbnail product={{ name: "Verified product", imageUrl: "/product.webp" }} />));
    expect(photo("img").attr("src")).toBe("/product.webp");
    expect(photo("img").attr("style")).toContain("object-fit:contain");
    const empty = load(renderToStaticMarkup(<ProductThumbnail product={{ nameKr: "상품" }} />));
    expect(empty("img")).toHaveLength(0);
    expect(empty("use").attr("href")).toBe("#i-bag");
  });
});

describe("category and retailer identity", () => {
  it("uses shower, hand and storefront symbols for the matching services", () => {
    expect(TYPE_ICON).toMatchObject({ head_spa: "shower", nail_lash: "hand", mall: "store", hair_salon: "scissors" });
  });

  it.each(["olive_young", "daiso"] as const)("uses the owner-provided real %s logo in category chips", (type) => {
    const filename = type === "olive_young" ? "olive-young-logo.jpeg" : "daiso-logo.jpeg";
    expect(BRAND_MARK_SRC[type]).toBe(`/brands/${filename}`);
    const asset = new URL(`../public/brands/${filename}`, import.meta.url);
    expect(existsSync(asset)).toBe(true);
    expect(readFileSync(asset).subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
    const $ = load(renderToStaticMarkup(<CategoryBadge type={type} size={20} />));
    expect($("img").attr("src")).toBe(`/brands/${filename}`);
    expect($("img").attr("style")).toContain("object-fit:contain");
  });
});
