import { validateMenu, type PartnerCategory, type PartnerMenu, type Visibility } from './catalog';
import { validateSchedule, type PartnerSchedule } from './availability';
import type { DateOverride } from './reservation-calendar';
import type { ReservationRules } from './reservation-config';

export type BusinessType = 'hair' | 'nail' | 'head_spa';
export type Merchant = {
  id: string; displayName: string; contactEmail: string; contactPhone: string; address: string;
  businessTypes: BusinessType[]; status: 'onboarding' | 'active' | 'suspended' | 'closed';
  bookingEnabled: boolean; updatedAt: string;
};
export type Category = PartnerCategory & { updatedAt: string };
export type Menu = PartnerMenu & { updatedAt: string };
export type Schedule = PartnerSchedule & { updatedAt: string };
export type PartnerSnapshot = {
  merchant: Merchant; categories: Category[]; menus: Menu[]; schedule: Schedule | null;
  reservationRules: (ReservationRules & { updatedAt: string }) | null; dateOverrides: DateOverride[];
  readOnly: boolean; loadedAt: string;
};
export type CategoryValues = Pick<PartnerCategory, 'nameKo' | 'nameEn' | 'visibility' | 'sortOrder'>;
export type MenuValues = Omit<PartnerMenu, 'id' | 'merchantId' | 'depositKrw'>;
export type ScheduleValues = Omit<PartnerSchedule, 'merchantId'>;
export type MerchantProfile = Pick<Merchant, 'displayName' | 'contactEmail' | 'contactPhone' | 'address' | 'businessTypes'>;
type Version = { mode: 'create'; expectedUpdatedAt?: never } | { mode: 'update'; expectedUpdatedAt: string };
export type PartnerCommand =
  | ({ kind: 'category'; id: string; values: CategoryValues } & Version)
  | ({ kind: 'menu'; id: string; values: MenuValues } & Version)
  | ({ kind: 'schedule'; values: ScheduleValues } & Version);

export function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
export function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}
export function uuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
/** Validate the format, but preserve the exact Postgres timestamp for optimistic concurrency. */
export function timestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return false;
  const day = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === value.slice(0, 10) &&
    Number(value.slice(11, 13)) < 24 && Number(value.slice(14, 16)) < 60 && Number(value.slice(17, 19)) < 60 &&
    Number.isFinite(Date.parse(value));
}
export function boundedString(value: unknown, max: number): value is string {
  if (typeof value !== 'string') return false;
  const points = Array.from(value);
  // PostgreSQL text cannot contain NUL or lone UTF-16 surrogates. Array.from
  // keeps valid surrogate pairs together, preserving Unicode code-point limits.
  return points.length <= max && points.every((character) => {
    const point = character.codePointAt(0)!;
    return point !== 0 && (point < 0xD800 || point > 0xDFFF);
  });
}
export function integer(value: unknown, minimum = 0): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;
}
export function visibility(value: unknown): value is Visibility {
  return typeof value === 'string' && ['draft', 'visible', 'hidden', 'archived'].includes(value);
}
export function categoryValues(value: unknown): value is CategoryValues {
  return record(value) && exactKeys(value, ['nameKo', 'nameEn', 'visibility', 'sortOrder']) &&
    boundedString(value.nameKo, 120) && boundedString(value.nameEn, 120) && visibility(value.visibility) && integer(value.sortOrder);
}
export function menuValues(value: unknown): value is MenuValues {
  if (!record(value) || !exactKeys(value, ['categoryId', 'nameKo', 'nameEn', 'descriptionKo', 'descriptionEn', 'priceKrw', 'durationMinutes', 'cleanupMinutes', 'visibility', 'sortOrder']) ||
    !uuid(value.categoryId) || !boundedString(value.nameKo, 120) || !boundedString(value.nameEn, 120) ||
    !boundedString(value.descriptionKo, 4000) || !boundedString(value.descriptionEn, 4000) ||
    !(value.priceKrw === null || integer(value.priceKrw, 1)) || !(value.durationMinutes === null || integer(value.durationMinutes, 1)) ||
    !integer(value.cleanupMinutes) || !integer(value.sortOrder) || !visibility(value.visibility)) return false;
  // The shared validator runs only after runtime shape checks; ownership is checked against DB state at write time.
  return validateMenu({ ...(value as MenuValues), id: placeholder, merchantId: placeholder, depositKrw: null }, [{ id: value.categoryId, merchantId: placeholder, nameKo: '', nameEn: '', visibility: 'draft', sortOrder: 0 }]).length === 0;
}
const placeholder = '00000000-0000-0000-0000-000000000000';
export function scheduleValues(value: unknown): value is ScheduleValues {
  if (!record(value) || !exactKeys(value, ['hours', 'breaks', 'blocks'])) return false;
  for (const [key, max] of [['hours', 128], ['breaks', 128], ['blocks', 512]] as const) {
    const items = value[key];
    if (!Array.isArray(items) || items.length > max || !items.every((item: unknown) => record(item) &&
      exactKeys(item, key === 'blocks' ? ['date', 'startMinute', 'endMinute'] : ['weekday', 'startMinute', 'endMinute']) &&
      integer(item.startMinute) && integer(item.endMinute) && (key === 'blocks' ? typeof item.date === 'string' : integer(item.weekday)))) return false;
  }
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > 256 * 1024) return false;
  return validateSchedule({ ...(value as ScheduleValues), merchantId: placeholder }).length === 0;
}
export function merchantProfile(value: unknown): value is MerchantProfile {
  return record(value) && exactKeys(value, ['displayName', 'contactEmail', 'contactPhone', 'address', 'businessTypes']) &&
    boundedString(value.displayName, 120) && boundedString(value.contactEmail, 320) && boundedString(value.contactPhone, 80) &&
    boundedString(value.address, 500) && Array.isArray(value.businessTypes) &&
    value.businessTypes.every((type: unknown) => typeof type === 'string' && ['hair', 'nail', 'head_spa'].includes(type));
}
export function parsePartnerCommand(input: unknown): { ok: true; command: PartnerCommand } | { ok: false; errors: string[] } {
  const invalid = { ok: false as const, errors: ['command.invalid'] };
  try {
    if (!record(input)) return invalid;
    if (typeof input.kind !== 'string' || !['category', 'menu', 'schedule'].includes(input.kind) || typeof input.mode !== 'string' || !['create', 'update'].includes(input.mode)) return invalid;
    const keys = ['kind', 'mode', 'values', ...(input.kind === 'schedule' ? [] : ['id']), ...(input.mode === 'update' ? ['expectedUpdatedAt'] : [])];
    if (!exactKeys(input, keys) || (input.kind !== 'schedule' && !uuid(input.id)) || (input.mode === 'update' && !timestamp(input.expectedUpdatedAt))) return invalid;
    if (!(input.kind === 'category' ? categoryValues(input.values) : input.kind === 'menu' ? menuValues(input.values) : scheduleValues(input.values))) return invalid;
    return { ok: true, command: input as PartnerCommand };
  } catch { return invalid; }
}
