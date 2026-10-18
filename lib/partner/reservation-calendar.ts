import { businessIntervals, type DateBlock, type MinuteInterval, type PartnerSchedule, type WeeklyPeriod } from './availability';
import { exactKeys, integer, record, scheduleValues, uuid } from './contracts';

export type DateOverride = { date: string; hours: MinuteInterval[]; breaks: MinuteInterval[] };
export type ReservationSchedule = PartnerSchedule & { overrides: DateOverride[] };

function exactRecord(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return record(value) && exactKeys(value, keys) && Reflect.ownKeys(value).length === keys.length;
}

function canonicalUuid(value: unknown): value is string {
  return uuid(value) && value.length === 36 && value === value.toLowerCase();
}

function calendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || value.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function snapshotList<T>(value: unknown, maximum: number, read: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const length = value.length;
  if (!integer(length) || length > maximum) return null;
  const items: T[] = [];
  // Copy only dense indexed entries; input methods and iterators cannot change validation or calculation.
  for (let index = 0; index < length; index++) {
    if (!Object.hasOwn(value, index)) return null;
    const item = read(value[index]);
    if (item === null) return null;
    items.push(item);
  }
  return items;
}

function minuteValues(value: Record<string, unknown>): MinuteInterval | null {
  const { startMinute, endMinute } = value;
  return integer(startMinute) && integer(endMinute) && startMinute < endMinute && endMinute <= 1440
    ? { startMinute, endMinute } : null;
}

function minuteInterval(value: unknown): MinuteInterval | null {
  return exactRecord(value, ['startMinute', 'endMinute']) ? minuteValues(value) : null;
}

function weeklyPeriod(value: unknown): WeeklyPeriod | null {
  if (!exactRecord(value, ['weekday', 'startMinute', 'endMinute'])) return null;
  const minutes = minuteValues(value);
  const weekday = value.weekday;
  return minutes && integer(weekday) && weekday <= 6 ? { ...minutes, weekday } : null;
}

function dateBlock(value: unknown): DateBlock | null {
  if (!exactRecord(value, ['date', 'startMinute', 'endMinute'])) return null;
  const minutes = minuteValues(value);
  const date = value.date;
  return minutes && calendarDate(date) ? { ...minutes, date } : null;
}

function dateOverride(value: unknown): DateOverride | null {
  if (!exactRecord(value, ['date', 'hours', 'breaks'])) return null;
  const date = value.date;
  const hours = snapshotList(value.hours, 128, minuteInterval);
  const breaks = snapshotList(value.breaks, 128, minuteInterval);
  if (!calendarDate(date) || !hours || !breaks || !scheduleValues({
    hours: hours.map((period) => ({ ...period, weekday: 0 })),
    breaks: breaks.map((period) => ({ ...period, weekday: 0 })), blocks: [],
  })) return null;
  return { date, hours, breaks };
}

function scheduleSnapshot(value: unknown): ReservationSchedule | null {
  try {
    if (!exactRecord(value, ['merchantId', 'hours', 'breaks', 'blocks', 'overrides'])) return null;
    const merchantId = value.merchantId;
    if (!canonicalUuid(merchantId)) return null;
    const hours = snapshotList(value.hours, 128, weeklyPeriod);
    const breaks = snapshotList(value.breaks, 128, weeklyPeriod);
    const blocks = snapshotList(value.blocks, 512, dateBlock);
    const overrides = snapshotList(value.overrides, 366, dateOverride);
    if (!hours || !breaks || !blocks || !overrides || !scheduleValues({ hours, breaks, blocks })) return null;
    const dates = new Set(overrides.map((override) => override.date));
    if (dates.size !== overrides.length) return null;
    const snapshot = { merchantId, hours, breaks, blocks, overrides };
    // Measure the exact validated data, without input-controlled toJSON methods or getters.
    if (new TextEncoder().encode(JSON.stringify(snapshot)).byteLength > 256 * 1024) return null;
    return snapshot;
  } catch { return null; }
}

export function reservationSchedule(value: unknown): value is ReservationSchedule {
  return scheduleSnapshot(value) !== null;
}

/** Opening/work hours only. Actual holds, bookings, service duration, and cleanup are checked separately. */
export function reservationIntervals(schedule: ReservationSchedule, merchantId: string, date: string): MinuteInterval[] {
  if (!canonicalUuid(merchantId)) throw new Error('merchant.invalid');
  if (!calendarDate(date)) throw new Error('date.invalid');
  const snapshot = scheduleSnapshot(schedule);
  if (!snapshot) throw new Error('schedule.invalid');
  if (snapshot.merchantId !== merchantId) throw new Error('merchant.mismatch');
  const override = snapshot.overrides.find((entry) => entry.date === date);
  if (!override) return businessIntervals(snapshot, merchantId, date);
  const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return businessIntervals({
    merchantId, hours: override.hours.map((period) => ({ ...period, weekday })),
    breaks: override.breaks.map((period) => ({ ...period, weekday })), blocks: snapshot.blocks,
  }, merchantId, date);
}
