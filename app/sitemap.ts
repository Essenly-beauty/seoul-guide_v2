import type { MetadataRoute } from "next";
import { ARTICLES, PLACES, PRODUCTS } from "@/lib/data";

const BASE = "https://seoul-guide-v2.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const statics: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, priority: 1 },
    { url: `${BASE}/map`, priority: 0.9 },
    { url: `${BASE}/ranking`, priority: 0.8 },
    { url: `${BASE}/blog`, priority: 0.7 },
  ];
  // ~240 Olive Young ids contain Hangul — <loc> URLs must be percent-encoded
  const places: MetadataRoute.Sitemap = PLACES.map((p) => ({
    url: `${BASE}/place/${encodeURIComponent(p.id)}`,
    priority: 0.6,
  }));
  const products: MetadataRoute.Sitemap = PRODUCTS.map((p) => ({
    url: `${BASE}/shop/${encodeURIComponent(p.id)}`,
    priority: 0.5,
  }));
  const articles: MetadataRoute.Sitemap = ARTICLES.map((a) => ({
    url: `${BASE}/blog/${encodeURIComponent(a.slug)}`,
    priority: 0.5,
  }));
  return [...statics, ...places, ...products, ...articles];
}
