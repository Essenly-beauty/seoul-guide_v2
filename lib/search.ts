/** Client-side unified search over the sample data layer. */

import { ARTICLES, PLACES, PRODUCTS, zoneShort, type Article, type Place, type Product } from "./data";

export type SearchResults = { places: Place[]; products: Product[]; articles: Article[]; total: number };

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Every query word must appear somewhere in the haystack (AND, substring). */
function matches(haystack: string, query: string): boolean {
  const h = norm(haystack);
  return norm(query).split(" ").every((w) => h.includes(w));
}

export function searchAll(query: string): SearchResults {
  if (!norm(query)) return { places: [], products: [], articles: [], total: 0 };

  const places = PLACES.filter((p) =>
    matches([p.name, p.nameKr, p.tags.join(" "), zoneShort(p.zone), p.type].join(" "), query),
  );
  const products = PRODUCTS.filter((p) =>
    matches([p.brand, p.name, p.nameKr, p.category].join(" "), query),
  );
  const articles = ARTICLES.filter((a) => matches([a.title, a.tags.join(" ")].join(" "), query));

  return { places, products, articles, total: places.length + products.length + articles.length };
}
