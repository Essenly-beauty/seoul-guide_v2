// CARTO Basemaps Terms (2026-08-26): requests must carry the customer's own
// API key. The key is public by design (it ships in tile URLs); configure it
// as NEXT_PUBLIC_CARTO_API_KEY. Without one the template is used as-is.

export function withTileKey(template: string, key: string | undefined): string {
  const k = key?.trim();
  if (!k) return template;
  return `${template}${template.includes("?") ? "&" : "?"}key=${encodeURIComponent(k)}`;
}
