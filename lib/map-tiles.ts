// CARTO Basemaps Terms (2026-08-26): requests must carry the customer's own
// API key. The key is public by design (it ships in tile URLs); configure it
// as NEXT_PUBLIC_CARTO_API_KEY in production AND local preview environments.
// Missing keys can return an HTTP 200 watermark image instead of map tiles.

export const MAP_TILE_URLS = {
  dark: 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
} as const;
export const MAP_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

export function withTileKey(template: string, key: string | undefined): string {
  const k = key?.trim();
  if (!k) return template;
  return `${template}${template.includes("?") ? "&" : "?"}key=${encodeURIComponent(k)}`;
}
