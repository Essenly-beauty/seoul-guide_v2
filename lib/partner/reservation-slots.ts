import { publicMenu, type PartnerCategory, type PartnerMenu } from './catalog';
import { reservationRules, reservationStaff, type ReservationRules, type ReservationStaff } from './reservation-config';
import { reservationIntervals, type ReservationSchedule } from './reservation-calendar';
import { categoryValues, exactKeys, integer, record, timestamp, uuid } from './contracts';
import type { MinuteInterval } from './availability';

export type ReservationOccupancy = { id: string; merchantId: string; staffId: string | null; startAt: string; endAt: string; status: 'confirmed' | 'hold'; expiresAt: string | null };
export type ReservationSlot = { startAt: string; serviceEndAt: string; occupiedUntil: string; staffId: string | null };
export type ReservationSlotInput = {
  merchantId: string; merchantStatus: 'onboarding' | 'active' | 'suspended' | 'closed'; bookingEnabled: boolean;
  date: string; now: Date; rules: ReservationRules; schedule: ReservationSchedule;
  menu: PartnerMenu; categories: readonly PartnerCategory[]; staff: ReservationStaff | null;
  staffSchedule: ReservationSchedule | null; occupancies: readonly ReservationOccupancy[];
};

function canonicalUuid(value: unknown): value is string {
  return uuid(value) && value.length === 36 && value === value.toLowerCase();
}

function calendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || value.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function snapshotList<T>(value: unknown, error: string, read: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new Error(error);
  const length = value.length;
  if (!integer(length) || length > 4294967295) throw new Error(error);
  const result: T[] = [];
  for (let index = 0; index < length; index++) {
    if (!Object.hasOwn(value, index)) throw new Error(error);
    result.push(read(value[index]));
  }
  return result;
}

function sameMerchant(actual: string, expected: string): void {
  if (actual !== expected) throw new Error('merchant.mismatch');
}

type OccupiedInterval = { start: bigint; end: bigint; staffId: string | null; expiry: bigint | null };

function instant(value: string): bigint {
  const fraction = /\.(\d{1,6})/.exec(value)?.[1] ?? '';
  return BigInt(Date.parse(value)) * 1000n + BigInt(fraction.padEnd(6, '0').slice(3));
}

function occupancySnapshot(value: unknown, merchantId: string, seen: Set<string>): OccupiedInterval {
  const keys = ['id', 'merchantId', 'staffId', 'startAt', 'endAt', 'status', 'expiresAt'];
  if (!record(value) || !exactKeys(value, keys) || Reflect.ownKeys(value).length !== keys.length) throw new Error('occupancies.invalid');
  const { id, merchantId: owner, staffId, startAt, endAt, status, expiresAt } = value;
  if (!canonicalUuid(id) || !canonicalUuid(owner) || (staffId !== null && !canonicalUuid(staffId)) ||
    !timestamp(startAt) || !timestamp(endAt) ||
    !(status === 'confirmed' ? expiresAt === null : status === 'hold' && timestamp(expiresAt)) || seen.has(id)) throw new Error('occupancies.invalid');
  const start = instant(startAt);
  const end = instant(endAt);
  if (start >= end) throw new Error('occupancies.invalid');
  sameMerchant(owner, merchantId);
  seen.add(id);
  return { start, end, staffId, expiry: expiresAt === null ? null : instant(expiresAt as string) };
}

function mergeIntervals(intervals: MinuteInterval[]): MinuteInterval[] {
  const merged: MinuteInterval[] = [];
  for (const interval of intervals.sort((a, b) => a.startMinute - b.startMinute)) {
    const previous = merged[merged.length - 1];
    if (previous && interval.startMinute <= previous.endMinute) previous.endMinute = Math.max(previous.endMinute, interval.endMinute);
    else merged.push({ ...interval });
  }
  return merged;
}

function intersection(shop: MinuteInterval[], staff: MinuteInterval[]): MinuteInterval[] {
  const common: MinuteInterval[] = [];
  for (const opening of shop) for (const working of staff) {
    const startMinute = Math.max(opening.startMinute, working.startMinute);
    const endMinute = Math.min(opening.endMinute, working.endMinute);
    if (startMinute < endMinute) common.push({ startMinute, endMinute });
  }
  return mergeIntervals(common);
}

function fitsCapacity(occupancies: OccupiedInterval[], start: number, end: number, capacity: number, staffId: string | null): boolean {
  const startMicro = BigInt(start) * 1000n;
  const endMicro = BigInt(end) * 1000n;
  const events: { time: bigint; delta: number }[] = [];
  for (const occupied of occupancies) {
    if (occupied.start >= endMicro || occupied.end <= startMicro) continue;
    if (staffId !== null && occupied.staffId === staffId) return false;
    events.push({ time: occupied.start > startMicro ? occupied.start : startMicro, delta: 1 }, { time: occupied.end < endMicro ? occupied.end : endMicro, delta: -1 });
  }
  // Half-open intervals release capacity before another visit starts at the same instant.
  events.sort((a, b) => a.time < b.time ? -1 : a.time > b.time ? 1 : a.delta - b.delta);
  let concurrent = 0;
  for (const event of events) {
    concurrent += event.delta;
    if (concurrent >= capacity) return false;
  }
  return true;
}

/**
 * Pure candidate calculation from trusted configuration and a COMPLETE tenant-bound
 * occupancy snapshot whose endAt includes existing cleanup. Never pass [] after
 * a failed or partial storage query. The
 * caller must bind staffSchedule to the selected staff record (the schedule type
 * itself carries only merchantId). This is not authorization, a lock, hold creation,
 * or a booking guarantee. A storage transaction must recheck both store capacity
 * and selected-staff occupancy atomically before claiming resources.
 * Menus/packages use one visit's normal duration; unsafe or >1440-minute total
 * duration yields no candidates. No HTTP input parsing or live booking activation.
 * PostgreSQL's six fractional digits are compared as exact epoch microseconds,
 * preserving hold expiry and half-open adjacency without rounding away occupancy.
 */
export function reservationSlots(input: ReservationSlotInput): ReservationSlot[] {
  const { merchantId, merchantStatus, bookingEnabled, date } = input;
  if (!canonicalUuid(merchantId)) throw new Error('merchant.invalid');
  if (!calendarDate(date)) throw new Error('date.invalid');
  if (!(input.now instanceof Date) || !Number.isFinite(Date.prototype.getTime.call(input.now))) throw new Error('clock.invalid');
  const now = Date.prototype.getTime.call(input.now);
  const nowMicro = BigInt(now) * 1000n;
  if (typeof bookingEnabled !== 'boolean' || !['onboarding', 'active', 'suspended', 'closed'].includes(merchantStatus)) throw new Error('merchant.invalid');
  if (!reservationRules(input.rules)) throw new Error('rules.invalid');
  const rules = { ...input.rules };
  sameMerchant(rules.merchantId, merchantId);
  const shopIntervals = mergeIntervals(reservationIntervals(input.schedule, merchantId, date));

  if (!record(input.menu) || !canonicalUuid(input.menu.id) || !canonicalUuid(input.menu.merchantId) || !canonicalUuid(input.menu.categoryId)) throw new Error('menu.invalid');
  const menu = { ...input.menu };
  sameMerchant(menu.merchantId, merchantId);
  const categories = snapshotList(input.categories, 'categories.invalid', (value): PartnerCategory => {
    if (!record(value) || !canonicalUuid(value.id) || !canonicalUuid(value.merchantId) ||
      !categoryValues({ nameKo: value.nameKo, nameEn: value.nameEn, visibility: value.visibility, sortOrder: value.sortOrder })) throw new Error('categories.invalid');
    sameMerchant(value.merchantId, merchantId);
    return { id: value.id, merchantId: value.merchantId, nameKo: value.nameKo as string, nameEn: value.nameEn as string, visibility: value.visibility as PartnerCategory['visibility'], sortOrder: value.sortOrder as number };
  });

  let staff: ReservationStaff | null = null;
  if (input.staff !== null) {
    if (!reservationStaff(input.staff)) throw new Error('staff.invalid');
    staff = { ...input.staff, menuIds: snapshotList(input.staff.menuIds, 'staff.invalid', (id) => id as string) };
    sameMerchant(staff.merchantId, merchantId);
  }
  const staffIntervals = input.staffSchedule === null ? null : mergeIntervals(reservationIntervals(input.staffSchedule, merchantId, date));
  const seen = new Set<string>();
  const occupancies = snapshotList(input.occupancies, 'occupancies.invalid', (row) => occupancySnapshot(row, merchantId, seen))
    .filter((row) => row.expiry === null || row.expiry > nowMicro);
  if (rules.mode === 'shop' && (staff !== null || staffIntervals !== null)) throw new Error('staff.mode');

  if (!bookingEnabled || merchantStatus !== 'active' || date < rules.startDate || date > rules.endDate) return [];
  const service = publicMenu(menu, categories, merchantId, bookingEnabled);
  if (!service) return [];
  if (rules.mode === 'staff' && (!staff || !staffIntervals || staff.visibility !== 'visible' || !staff.menuIds.includes(service.id))) return [];
  const duration = service.durationMinutes + service.cleanupMinutes;
  if (!integer(duration, 1) || duration > 1440) return [];
  const intervals = rules.mode === 'staff' ? intersection(shopIntervals, staffIntervals!) : shopIntervals;
  const midnight = Date.parse(`${date}T00:00:00+09:00`);
  const earliest = now + rules.minimumLeadMinutes * 60000;
  const selectedStaffId = rules.mode === 'staff' ? staff!.id : null;
  const slots: ReservationSlot[] = [];
  for (const interval of intervals) {
    for (let minute = Math.ceil(interval.startMinute / rules.slotIntervalMinutes) * rules.slotIntervalMinutes;
      minute + duration <= interval.endMinute; minute += rules.slotIntervalMinutes) {
      const start = midnight + minute * 60000;
      const end = start + duration * 60000;
      if (start < earliest || !fitsCapacity(occupancies, start, end, rules.capacity, selectedStaffId)) continue;
      slots.push({ startAt: new Date(start).toISOString(), serviceEndAt: new Date(start + service.durationMinutes * 60000).toISOString(), occupiedUntil: new Date(end).toISOString(), staffId: selectedStaffId });
    }
  }
  return slots;
}
