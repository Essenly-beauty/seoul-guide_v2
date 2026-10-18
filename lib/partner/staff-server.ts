import type { SupabaseClient } from '@supabase/supabase-js';
import { record, timestamp, uuid } from './contracts';
import { reservationSchedule, type ReservationSchedule } from './reservation-calendar';
import { reservationStaff, type ReservationStaff } from './reservation-config';
import { getPartnerContext, PartnerError, partnerOperation, queryData, unavailable, type PartnerContext } from './server';

export const staffColumns = 'id,merchant_id,name,title,introduction,visibility,sort_order,updated_at';
export const staffMenuColumns = 'merchant_id,staff_id,service_id';
export const staffScheduleColumns = 'merchant_id,staff_id,hours,breaks,blocks,overrides,updated_at';
const serviceIdentityColumns = 'id,merchant_id';

export type StaffSummary = Omit<ReservationStaff, 'menuIds'> & { updatedAt: string };
export type StaffDetail = ReservationStaff & { updatedAt: string };
export type StaffCalendar = ReservationSchedule & { staffId: string; updatedAt: string };
export type StaffListSnapshot = { merchantId: string; staff: StaffSummary[]; readOnly: boolean; loadedAt: string };
export type StaffDetailSnapshot = { merchantId: string; staff: StaffDetail; schedule: StaffCalendar | null; readOnly: boolean; loadedAt: string };

function canonicalUuid(value: unknown): value is string {
  return uuid(value) && value === value.toLowerCase();
}

function decodeProfile(row: unknown, merchantId: string, menuIds: string[]): StaffDetail {
  if (!record(row) || row.merchant_id !== merchantId || !timestamp(row.updated_at)) return unavailable();
  const staff = {
    id: row.id, merchantId, name: row.name, title: row.title, introduction: row.introduction,
    visibility: row.visibility, sortOrder: row.sort_order, menuIds,
  };
  if (!reservationStaff(staff)) return unavailable();
  return { ...staff, updatedAt: row.updated_at };
}

function decodeLinks(rows: unknown, merchantId: string, staffId: string, previousId: string): string[] {
  if (!Array.isArray(rows) || rows.length > 1001) return unavailable();
  if (rows.length > 1000) throw new PartnerError(503, 'PARTNER_LIMIT_EXCEEDED');
  const menuIds: string[] = [];
  for (const row of rows) {
    if (!record(row) || row.merchant_id !== merchantId || row.staff_id !== staffId ||
      !canonicalUuid(row.service_id) || row.service_id <= previousId) return unavailable();
    previousId = row.service_id;
    menuIds.push(row.service_id);
  }
  return menuIds;
}

async function loadLinks(client: SupabaseClient, merchantId: string, staffId: string): Promise<string[]> {
  const menuIds: string[] = [];
  for (;;) {
    const previousId = menuIds.at(-1) ?? '';
    const pageSize = 1001 - menuIds.length;
    const query = client.from('merchant_staff_menus').select(staffMenuColumns)
      .eq('merchant_id', merchantId).eq('staff_id', staffId).order('service_id', { ascending: true });
    const page = queryData(await (previousId ? query.gt('service_id', previousId) : query).limit(pageSize));
    if (!Array.isArray(page) || page.length > pageSize) return unavailable();
    const ids = decodeLinks(page, merchantId, staffId, previousId);
    if (menuIds.length + ids.length > 1000) throw new PartnerError(503, 'PARTNER_LIMIT_EXCEEDED');
    if (ids.length === 0) return menuIds;
    menuIds.push(...ids);
  }
}

function decodeCalendar(row: unknown, merchantId: string, staffId: string): StaffCalendar | null {
  if (row === null) return null;
  if (!record(row) || row.merchant_id !== merchantId || row.staff_id !== staffId || !timestamp(row.updated_at)) return unavailable();
  const schedule = { merchantId, hours: row.hours, breaks: row.breaks, blocks: row.blocks, overrides: row.overrides };
  if (!reservationSchedule(schedule)) return unavailable();
  return { ...schedule, staffId, updatedAt: row.updated_at };
}

async function verifyServices(client: SupabaseClient, merchantId: string, menuIds: readonly string[]): Promise<void> {
  for (let offset = 0; offset < menuIds.length; offset += 100) {
    const batch = menuIds.slice(offset, offset + 100);
    const rows = queryData(await client.from('merchant_services').select(serviceIdentityColumns)
      .eq('merchant_id', merchantId).in('id', batch));
    if (!Array.isArray(rows) || rows.length !== batch.length) return unavailable();
    const expected = new Set(batch);
    for (const row of rows) {
      if (!record(row) || row.merchant_id !== merchantId || !canonicalUuid(row.id) || !expected.delete(row.id)) return unavailable();
    }
    if (expected.size !== 0) return unavailable();
  }
}

async function recheckContext(client: SupabaseClient, context: PartnerContext): Promise<PartnerContext> {
  const current = await getPartnerContext(client);
  if (current.userId !== context.userId || current.merchant.id !== context.merchant.id) {
    throw new PartnerError(403, 'PARTNER_UNASSIGNED');
  }
  return current;
}

export async function getStaffList(client: SupabaseClient, context: PartnerContext): Promise<StaffListSnapshot> {
  return partnerOperation(async () => {
    const merchantId = context.merchant.id;
    const staff: StaffSummary[] = [];
    let previousId = '';
    for (;;) {
      const pageSize = Math.min(200, 10000 - staff.length);
      const query = client.from('merchant_staff').select(staffColumns)
        .eq('merchant_id', merchantId).order('id', { ascending: true });
      const page = queryData(await (previousId ? query.gt('id', previousId) : query).range(0, pageSize - 1));
      if (!Array.isArray(page) || page.length > pageSize) return unavailable();
      for (const row of page) {
        const decoded = decodeProfile(row, merchantId, []);
        if (decoded.id <= previousId) return unavailable();
        previousId = decoded.id;
        const { menuIds: _unknownMenuIds, ...summary } = decoded;
        staff.push(summary);
      }
      if (page.length === 0) break;
      if (staff.length === 10000) {
        const sentinel = queryData(await client.from('merchant_staff').select('id')
          .eq('merchant_id', merchantId).gt('id', previousId).order('id', { ascending: true }).range(0, 0));
        if (!Array.isArray(sentinel) || sentinel.length > 1) return unavailable();
        if (sentinel.length === 1) throw new PartnerError(503, 'PARTNER_LIMIT_EXCEEDED');
        break;
      }
    }
    const current = await recheckContext(client, context);
    return { merchantId, staff, readOnly: current.readOnly, loadedAt: new Date().toISOString() };
  });
}

export async function getStaffDetail(client: SupabaseClient, context: PartnerContext, id: string): Promise<StaffDetailSnapshot> {
  return partnerOperation(async () => {
    if (!canonicalUuid(id)) throw new PartnerError(400, 'INVALID_STAFF_ID');
    const merchantId = context.merchant.id;
    const profile = queryData(await client.from('merchant_staff').select(staffColumns)
      .eq('merchant_id', merchantId).eq('id', id).maybeSingle());
    if (profile === null) {
      await recheckContext(client, context);
      throw new PartnerError(404, 'STAFF_NOT_FOUND');
    }
    const base = decodeProfile(profile, merchantId, []);
    if (base.id !== id) return unavailable();

    const menuIds = await loadLinks(client, merchantId, id);
    const schedule = decodeCalendar(queryData(await client.from('merchant_staff_schedules').select(staffScheduleColumns)
      .eq('merchant_id', merchantId).eq('staff_id', id).maybeSingle()), merchantId, id);
    const staff = decodeProfile(profile, merchantId, menuIds);
    await verifyServices(client, merchantId, menuIds);
    const current = await recheckContext(client, context);
    return { merchantId, staff, schedule, readOnly: current.readOnly, loadedAt: new Date().toISOString() };
  });
}
