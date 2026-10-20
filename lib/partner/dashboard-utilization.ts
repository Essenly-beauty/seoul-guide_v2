import type { PartnerBooking } from '@/lib/booking/partner-contracts';
import type { MinuteInterval } from './availability';
import type { Schedule } from './contracts';
import { kstDate, periodBounds, shiftDate } from './dashboard';
import { reservationIntervals, type DateOverride } from './reservation-calendar';
import type { StaffCalendar } from './staff-server';

export type StaffDailyUtilization = {
  intervals: MinuteInterval[] | null;
  availableMinutes: number | null;
  occupiedMinutes: number | null;
  bookingCount: number | null;
  percentage: number | null;
  scheduleState: 'ready' | 'closed' | 'missing' | 'unknown';
};
function union(intervals: readonly MinuteInterval[]): MinuteInterval[] {
  const result: MinuteInterval[] = [];
  for (const interval of [...intervals].sort((a, b) => a.startMinute - b.startMinute)) {
    if (interval.endMinute <= interval.startMinute) continue;
    const previous = result.at(-1);
    if (previous && interval.startMinute <= previous.endMinute) previous.endMinute = Math.max(previous.endMinute, interval.endMinute);
    else result.push({ ...interval });
  }
  return result;
}
function intersection(first: readonly MinuteInterval[], second: readonly MinuteInterval[]): MinuteInterval[] {
  return union(first.flatMap(a => second.map(b => ({ startMinute: Math.max(a.startMinute, b.startMinute), endMinute: Math.min(a.endMinute, b.endMinute) }))));
}
function minutes(intervals: readonly MinuteInterval[]): number {
  return intervals.reduce((sum, item) => sum + item.endMinute - item.startMinute, 0);
}
/** Availability is the store/staff intersection before bookings. Only its occupied union contributes to the ratio. */
export function staffDailyUtilization({ date, merchantId, staffId, shopSchedule, shopOverrides, staffSchedule, bookings }: {
  date: string; merchantId: string; staffId: string; shopSchedule: Schedule | null; shopOverrides: DateOverride[];
  staffSchedule: StaffCalendar | null | undefined; bookings: readonly PartnerBooking[] | null;
}): StaffDailyUtilization {
  const live = bookings?.filter(booking => booking.staffId === staffId && booking.status !== 'cancelled') ?? null;
  const bookingCount = live ? live.filter(booking => kstDate(booking.startAt) === date).length : null;
  const unknown = { intervals: null, availableMinutes: null, occupiedMinutes: null, bookingCount, percentage: null };
  if (staffSchedule === undefined) return { ...unknown, scheduleState: 'unknown' };
  if (!shopSchedule || !staffSchedule) return { ...unknown, scheduleState: 'missing' };
  if (staffSchedule.staffId !== staffId || staffSchedule.merchantId !== merchantId || shopSchedule.merchantId !== merchantId) return { ...unknown, scheduleState: 'unknown' };
  let intervals: MinuteInterval[];
  try {
    // Strict calendar validation accepts schedule values, never DB version/identity metadata.
    const shop = reservationIntervals({ merchantId, hours: shopSchedule.hours, breaks: shopSchedule.breaks, blocks: shopSchedule.blocks, overrides: shopOverrides }, merchantId, date);
    const staff = reservationIntervals({ merchantId, hours: staffSchedule.hours, breaks: staffSchedule.breaks, blocks: staffSchedule.blocks, overrides: staffSchedule.overrides }, merchantId, date);
    intervals = intersection(shop, staff);
  } catch { return { ...unknown, scheduleState: 'unknown' }; }
  const availableMinutes = minutes(intervals);
  const midnight = Date.parse(`${date}T00:00:00+09:00`);
  // Keep carry-over cleanup from a previous KST day, while counts use the visit's start day.
  const occupied = live?.map(booking => ({ startMinute: (Date.parse(booking.startAt) - midnight) / 60000, endMinute: (Date.parse(booking.occupiedUntil) - midnight) / 60000 }));
  const occupiedMinutes = occupied ? minutes(intersection(intervals, union(occupied))) : null;
  return {
    intervals, availableMinutes, occupiedMinutes, bookingCount,
    percentage: availableMinutes > 0 && occupiedMinutes !== null ? Math.round(occupiedMinutes / availableMinutes * 100) : null,
    scheduleState: availableMinutes > 0 ? 'ready' : 'closed',
  };
}
export function utilizationTimeLabel(intervals: readonly MinuteInterval[]): string {
  const time = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
  return intervals.map(interval => `${time(interval.startMinute)}–${time(interval.endMinute)}`).join(' / ');
}
/** Monday–Sunday totals use real KST start dates; phone and walk-in share the secondary stack. */
export function dashboardWeekBookings(bookings: readonly PartnerBooking[] | null, today: string) {
  if (!bookings) return null;
  const [start, end] = periodBounds('week', today);
  const previousStart = shiftDate(start, -7), previousEnd = shiftDate(end, -7);
  const live = bookings.filter(booking => booking.status !== 'cancelled');
  const days = Array.from({ length: 7 }, (_, offset) => {
    const date = shiftDate(start, offset), items = live.filter(booking => kstDate(booking.startAt) === date);
    const app = items.filter(booking => booking.source === 'app').length;
    return { date, app, other: items.length - app, total: items.length };
  });
  return { days, total: days.reduce((sum, day) => sum + day.total, 0), previousTotal: live.filter(booking => { const date = kstDate(booking.startAt); return date >= previousStart && date <= previousEnd; }).length };
}
