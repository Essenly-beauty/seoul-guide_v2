import type { SupabaseClient } from '@supabase/supabase-js';
import { boundedString, categoryValues, integer, menuValues, record, scheduleValues, merchantProfile, timestamp, uuid, type Category, type Menu, type Merchant, type PartnerSnapshot, type Schedule } from './contracts';
import { validateMenu } from './catalog';
import { reservationSchedule, type DateOverride } from './reservation-calendar';
import { reservationRules, type ReservationRules } from './reservation-config';
import { reservationJsonbBytes } from './reservation-jsonb';

export class PartnerError extends Error {
  constructor(public readonly status: number, public readonly code: string) { super(code); }
}
export function unavailable(): never { throw new PartnerError(503, 'PARTNER_UNAVAILABLE'); }
export async function partnerOperation<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); } catch (error) {
    if (error instanceof PartnerError) throw error;
    return unavailable();
  }
}
export function queryData(result: unknown): unknown {
  if (!record(result) || !Object.hasOwn(result, 'data') || result.error !== null) return unavailable();
  return result.data;
}

export const merchantColumns = 'id,display_name,contact_email,contact_phone,address,business_types,status,booking_enabled,updated_at';
export const categoryColumns = 'id,merchant_id,name_ko,name_en,visibility,sort_order,updated_at';
export const menuColumns = 'id,merchant_id,category_id,name_ko,name_en,description_ko,description_en,price_krw,deposit_krw,duration_minutes,cleanup_minutes,visibility,sort_order,updated_at';
export const scheduleColumns = 'merchant_id,hours,breaks,blocks,overrides,updated_at';
export const reservationRulesColumns = 'merchant_id,mode,capacity,start_date,end_date,minimum_lead_minutes,slot_interval_minutes,updated_at';

function decodeMerchant(row: unknown, merchantId: string): Merchant {
  if (!record(row) || row.id !== merchantId || !uuid(row.id) || !timestamp(row.updated_at) ||
    typeof row.booking_enabled !== 'boolean' || !boundedString(row.status, 20) || !['onboarding', 'active', 'suspended', 'closed'].includes(row.status)) return unavailable();
  const values = { displayName: row.display_name, contactEmail: row.contact_email, contactPhone: row.contact_phone, address: row.address, businessTypes: row.business_types };
  if (!merchantProfile(values)) return unavailable();
  return { id: row.id, ...values, status: row.status as Merchant['status'], bookingEnabled: row.booking_enabled, updatedAt: row.updated_at };
}
export function decodeCategory(row: unknown, merchantId: string): Category {
  if (!record(row) || !uuid(row.id) || row.merchant_id !== merchantId || !timestamp(row.updated_at)) return unavailable();
  const values = { nameKo: row.name_ko, nameEn: row.name_en, visibility: row.visibility, sortOrder: row.sort_order };
  if (!categoryValues(values)) return unavailable();
  return { id: row.id, merchantId, ...values, updatedAt: row.updated_at };
}
export function decodeMenu(row: unknown, merchantId: string, categories: readonly Category[]): Menu {
  if (!record(row) || !uuid(row.id) || row.merchant_id !== merchantId || !timestamp(row.updated_at) || !(row.deposit_krw === null || integer(row.deposit_krw, 1))) return unavailable();
  const values = { categoryId: row.category_id, nameKo: row.name_ko, nameEn: row.name_en, descriptionKo: row.description_ko, descriptionEn: row.description_en, priceKrw: row.price_krw, durationMinutes: row.duration_minutes, cleanupMinutes: row.cleanup_minutes, visibility: row.visibility, sortOrder: row.sort_order };
  if (!menuValues(values)) return unavailable();
  const menu = { id: row.id, merchantId, ...values, depositKrw: row.deposit_krw, updatedAt: row.updated_at };
  if (validateMenu(menu, categories).length) return unavailable();
  return menu;
}
function decodeSchedule(row: unknown, merchantId: string): { schedule: Schedule | null; dateOverrides: DateOverride[] } {
  if (row === null) return { schedule: null, dateOverrides: [] };
  if (!record(row) || row.merchant_id !== merchantId || !timestamp(row.updated_at)) return unavailable();
  const values = { hours: row.hours, breaks: row.breaks, blocks: row.blocks };
  if (!scheduleValues(values)) return unavailable();
  // Historical admin closure blocks can use year 0000, which the newer
  // customer-booking contract intentionally forbids. Keep those blocks in the
  // admin DTO, but never pass them to the booking validator.
  const bookableBlocks = values.blocks.filter((block) => !block.date.startsWith('0000-'));
  const combined: unknown = { merchantId, hours: values.hours, breaks: values.breaks, blocks: bookableBlocks, overrides: row.overrides };
  if (!reservationSchedule(combined) || reservationJsonbBytes({ ...values, overrides: combined.overrides }) > 256 * 1024) return unavailable();
  return { schedule: { merchantId, ...values, updatedAt: row.updated_at }, dateOverrides: combined.overrides };
}
function decodeReservationRules(row: unknown, merchantId: string): (ReservationRules & { updatedAt: string }) | null {
  if (row === null) return null;
  if (!record(row) || row.merchant_id !== merchantId || !timestamp(row.updated_at)) return unavailable();
  const values = { merchantId, mode: row.mode, capacity: row.capacity, startDate: row.start_date, endDate: row.end_date,
    minimumLeadMinutes: row.minimum_lead_minutes, slotIntervalMinutes: row.slot_interval_minutes };
  if (!reservationRules(values)) return unavailable();
  return { ...values, updatedAt: row.updated_at };
}

export type PartnerContext = { userId: string; merchant: Merchant; readOnly: boolean };
export async function getPartnerContext(client: SupabaseClient): Promise<PartnerContext> {
  return partnerOperation(async () => {
    const auth: unknown = await client.auth.getUser();
    if (!record(auth)) return unavailable();
    if (auth.error !== null) {
      // Auth errors are SDK Error subclasses, unlike plain PostgREST response objects.
      const error = auth.error as { name?: unknown; status?: unknown; code?: unknown } | null | undefined;
      if (error && typeof error === 'object' && (error.name === 'AuthSessionMissingError' || error.status === 401 || error.status === 403 ||
        (typeof error.code === 'string' && ['bad_jwt', 'session_not_found', 'user_not_found', 'refresh_token_not_found', 'refresh_token_already_used'].includes(error.code)))) throw new PartnerError(401, 'UNAUTHENTICATED');
      return unavailable();
    }
    if (!record(auth.data) || !Object.hasOwn(auth.data, 'user')) return unavailable();
    if (auth.data.user === null) throw new PartnerError(401, 'UNAUTHENTICATED');
    if (!record(auth.data.user) || !uuid(auth.data.user.id)) return unavailable();
    const userId = auth.data.user.id;
    const membership = queryData(await client.from('merchant_memberships').select('merchant_id,user_id,revoked_at').eq('user_id', userId).is('revoked_at', null).maybeSingle());
    if (membership === null) throw new PartnerError(403, 'PARTNER_UNASSIGNED');
    if (!record(membership) || !uuid(membership.merchant_id) || membership.user_id !== userId || !Object.hasOwn(membership, 'revoked_at')) return unavailable();
    if (membership.revoked_at !== null) {
      if (!timestamp(membership.revoked_at)) return unavailable();
      throw new PartnerError(403, 'PARTNER_UNASSIGNED');
    }
    const merchant = decodeMerchant(queryData(await client.from('merchants').select(merchantColumns).eq('id', membership.merchant_id).maybeSingle()), membership.merchant_id);
    return { userId, merchant, readOnly: merchant.status === 'suspended' || merchant.status === 'closed' };
  });
}

async function allRows(client: SupabaseClient, table: string, columns: string, merchantId: string): Promise<unknown[]> {
  const rows: unknown[] = [];
  let previousId = '';
  for (let offset = 0; offset <= 10000; offset += 200) {
    const page = queryData(await client.from(table).select(columns).eq('merchant_id', merchantId).order('id', { ascending: true }).range(offset, offset + 199));
    if (!Array.isArray(page) || page.length > 200) return unavailable();
    if (rows.length + page.length > 10000) throw new PartnerError(503, 'PARTNER_LIMIT_EXCEEDED');
    for (const row of page) {
      if (!record(row) || !uuid(row.id) || row.id <= previousId) return unavailable();
      previousId = row.id;
      rows.push(row);
    }
    if (page.length < 200) return rows;
  }
  return unavailable();
}
export async function getPartnerSnapshot(client: SupabaseClient, context: PartnerContext): Promise<PartnerSnapshot> {
  return partnerOperation(async () => {
    const merchantId = context.merchant.id;
    const categories = (await allRows(client, 'merchant_categories', categoryColumns, merchantId)).map((row) => decodeCategory(row, merchantId));
    const menus = (await allRows(client, 'merchant_services', menuColumns, merchantId)).map((row) => decodeMenu(row, merchantId, categories));
    const { schedule, dateOverrides } = decodeSchedule(queryData(await client.from('merchant_schedules').select(scheduleColumns).eq('merchant_id', merchantId).maybeSingle()), merchantId);
    const rules = decodeReservationRules(queryData(await client.from('merchant_reservation_rules').select(reservationRulesColumns).eq('merchant_id', merchantId).maybeSingle()), merchantId);
    const sort = (a: Category | Menu, b: Category | Menu) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id);
    return { merchant: context.merchant, categories: categories.sort(sort), menus: menus.sort(sort), schedule, reservationRules: rules, dateOverrides, readOnly: context.readOnly, loadedAt: new Date().toISOString() };
  });
}
