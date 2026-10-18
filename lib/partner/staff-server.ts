import type { SupabaseClient } from '@supabase/supabase-js';
import { record, timestamp, uuid } from './contracts';
import { reservationSchedule, type ReservationSchedule } from './reservation-calendar';
import { reservationStaff, type ReservationStaff } from './reservation-config';
import { PartnerError, partnerOperation, queryData, unavailable, type PartnerContext } from './server';

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

function decodeLinks(rows: unknown, merchantId: string, staffId: string): string[] {
  if (!Array.isArray(rows) || rows.length > 1001) return unavailable();
  if (rows.length > 1000) throw new PartnerError(503, 'PARTNER_LIMIT_EXCEEDED');
  const menuIds: string[] = [];
  let previousId = '';
  for (const row of rows) {
    if (!record(row) || row.merchant_id !== merchantId || row.staff_id !== staffId ||
      !canonicalUuid(row.service_id) || row.service_id <= previousId) return unavailable();
    previousId = row.service_id;
    menuIds.push(row.service_id);
  }
  return menuIds;
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

export async function getStaffList(client: SupabaseClient, context: PartnerContext): Promise<StaffListSnapshot> {
  return partnerOperation(async () => {
    const merchantId = context.merchant.id;
    const staff: StaffSummary[] = [];
    let previousId = '';
    for (let offset = 0; offset <= 10000; offset += 200) {
      const page = queryData(await client.from('merchant_staff').select(staffColumns)
        .eq('merchant_id', merchantId).order('id', { ascending: true }).range(offset, offset + 199));
      if (!Array.isArray(page) || page.length > 200) return unavailable();
      if (staff.length + page.length > 10000) throw new PartnerError(503, 'PARTNER_LIMIT_EXCEEDED');
      for (const row of page) {
        const decoded = decodeProfile(row, merchantId, []);
        if (decoded.id <= previousId) return unavailable();
        previousId = decoded.id;
        const { menuIds: _unknownMenuIds, ...summary } = decoded;
        staff.push(summary);
      }
      if (page.length < 200) return { merchantId, staff, readOnly: context.readOnly, loadedAt: new Date().toISOString() };
    }
    return unavailable();
  });
}

export async function getStaffDetail(client: SupabaseClient, context: PartnerContext, id: string): Promise<StaffDetailSnapshot> {
  return partnerOperation(async () => {
    if (!canonicalUuid(id)) throw new PartnerError(400, 'INVALID_STAFF_ID');
    const merchantId = context.merchant.id;
    const profile = queryData(await client.from('merchant_staff').select(staffColumns)
      .eq('merchant_id', merchantId).eq('id', id).maybeSingle());
    if (profile === null) throw new PartnerError(404, 'STAFF_NOT_FOUND');
    const base = decodeProfile(profile, merchantId, []);
    if (base.id !== id) return unavailable();

    const menuIds = decodeLinks(queryData(await client.from('merchant_staff_menus').select(staffMenuColumns)
      .eq('merchant_id', merchantId).eq('staff_id', id).order('service_id', { ascending: true }).limit(1001)), merchantId, id);
    // PostgREST may cap a requested 1,001 rows at 1,000. Probe the next
    // ordered position instead of mistaking a truncated response for complete data.
    if (menuIds.length === 1000) {
      const overflow = queryData(await client.from('merchant_staff_menus').select(staffMenuColumns)
        .eq('merchant_id', merchantId).eq('staff_id', id).order('service_id', { ascending: true }).range(1000, 1000));
      if (!Array.isArray(overflow) || overflow.length > 1) return unavailable();
      if (overflow.length === 1) throw new PartnerError(503, 'PARTNER_LIMIT_EXCEEDED');
    }
    const schedule = decodeCalendar(queryData(await client.from('merchant_staff_schedules').select(staffScheduleColumns)
      .eq('merchant_id', merchantId).eq('staff_id', id).maybeSingle()), merchantId, id);
    const staff = decodeProfile(profile, merchantId, menuIds);
    await verifyServices(client, merchantId, menuIds);
    return { merchantId, staff, schedule, readOnly: context.readOnly, loadedAt: new Date().toISOString() };
  });
}
