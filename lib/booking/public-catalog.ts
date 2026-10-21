/** Safe customer-facing menu data. It is not a quote or an availability promise. */
export type PublicService = { id: string; category: string; name: string; description: string; priceKrw: number; durationMinutes: number };
export type PublicCatalog = { status: 'published' | 'unpublished'; services: PublicService[] };
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid public catalog');
  return value as Record<string, unknown>;
};
const text = (value: unknown, max: number): string => {
  if (typeof value !== 'string' || !value.trim() || Array.from(value).length > max) throw new Error('Invalid public catalog text');
  return value.trim();
};
const positive = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) throw new Error('Invalid public catalog amount');
  return value;
};
export function decodePublicCatalog(value: unknown, placeId: string): PublicCatalog {
  if (value === null) return { status: 'unpublished', services: [] };
  const row = object(value);
  if (row.place_id !== placeId || !Array.isArray(row.services)) throw new Error('Invalid public catalog place');
  const seen = new Set<string>();
  const services = row.services.map((value): PublicService => {
    const item = object(value);
    const id = text(item.id, 36);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || seen.has(id)) throw new Error('Invalid public catalog ID');
    seen.add(id);
    return { id, category: text(item.category, 120), name: text(item.name, 120), description: text(item.description, 4000), priceKrw: positive(item.priceKrw), durationMinutes: positive(item.durationMinutes) };
  });
  return { status: 'published', services };
}
