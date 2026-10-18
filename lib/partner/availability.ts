export type MinuteInterval = { startMinute: number; endMinute: number };
export type WeeklyPeriod = MinuteInterval & { weekday: number };
export type DateBlock = MinuteInterval & { date: string };
export type PartnerSchedule = { merchantId: string; hours: WeeklyPeriod[]; breaks: WeeklyPeriod[]; blocks: DateBlock[] };

function calendarDate(date: string): Date | null {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? parsed : null;
}

function validInterval(interval: MinuteInterval): boolean {
  return interval !== null && typeof interval === 'object' &&
    Number.isInteger(interval.startMinute) && Number.isInteger(interval.endMinute) &&
    interval.startMinute >= 0 && interval.startMinute < interval.endMinute && interval.endMinute <= 1440;
}

function validWeekly(period: WeeklyPeriod): boolean {
  return validInterval(period) && Number.isInteger(period.weekday) && period.weekday >= 0 && period.weekday <= 6;
}

function overlaps<T extends MinuteInterval>(intervals: T[], sameGroup: (a: T, b: T) => boolean): boolean {
  return intervals.some((a, index) => intervals.slice(index + 1).some((b) =>
    sameGroup(a, b) && a.startMinute < b.endMinute && b.startMinute < a.endMinute));
}

export function validateSchedule(schedule: PartnerSchedule): string[] {
  const errors: string[] = [];
  if (typeof schedule.merchantId !== 'string' || !schedule.merchantId.trim()) errors.push('merchant.invalid');
  const hoursValid = Array.isArray(schedule.hours) && schedule.hours.every(validWeekly);
  const breaksValid = Array.isArray(schedule.breaks) && schedule.breaks.every(validWeekly);
  const blocksValid = Array.isArray(schedule.blocks) && schedule.blocks.every((block) => validInterval(block) && calendarDate(block.date) !== null);
  if (!hoursValid) errors.push('hours.invalid');
  if (!breaksValid) errors.push('breaks.invalid');
  if (!blocksValid) errors.push('blocks.invalid');
  const sameWeekday = (a: WeeklyPeriod, b: WeeklyPeriod) => a.weekday === b.weekday;
  if (hoursValid && overlaps(schedule.hours, sameWeekday)) errors.push('hours.overlap');
  if (breaksValid && overlaps(schedule.breaks, sameWeekday)) errors.push('breaks.overlap');
  if (blocksValid && overlaps(schedule.blocks, (a, b) => a.date === b.date)) errors.push('blocks.overlap');
  if (hoursValid && breaksValid && schedule.breaks.some((pause) => !schedule.hours.some((open) =>
    sameWeekday(open, pause) && open.startMinute <= pause.startMinute && pause.endMinute <= open.endMinute))) errors.push('breaks.outside_hours');
  return errors;
}

export function seoulDateKey(date: Date): string {
  if (!Number.isFinite(date.getTime())) throw new Error('date.invalid');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((value) => value.type === type)!.value;
  return `${part('year').padStart(4, '0')}-${part('month')}-${part('day')}`;
}

/**
 * BUSINESS HOURS ONLY, not bookable availability. Booking must later subtract
 * actual holds/bookings and fit service duration plus cleanup into each interval.
 * Overnight opening periods are unsupported.
 */
export function businessIntervals(schedule: PartnerSchedule, merchantId: string, date: string): MinuteInterval[] {
  if (schedule.merchantId !== merchantId) throw new Error('merchant.mismatch');
  const parsed = calendarDate(date);
  if (!parsed) throw new Error('date.invalid');
  const errors = validateSchedule(schedule);
  if (errors.length) throw new Error(errors.join(', '));
  const weekday = parsed.getUTCDay();
  let intervals = schedule.hours.filter((period) => period.weekday === weekday)
    .map(({ startMinute, endMinute }) => ({ startMinute, endMinute }));
  const exclusions = [
    ...schedule.breaks.filter((period) => period.weekday === weekday),
    ...schedule.blocks.filter((block) => block.date === date),
  ];
  for (const exclusion of exclusions) {
    intervals = intervals.flatMap((interval) => {
      if (exclusion.endMinute <= interval.startMinute || exclusion.startMinute >= interval.endMinute) return [interval];
      const remaining: MinuteInterval[] = [];
      if (interval.startMinute < exclusion.startMinute) remaining.push({ startMinute: interval.startMinute, endMinute: exclusion.startMinute });
      if (exclusion.endMinute < interval.endMinute) remaining.push({ startMinute: exclusion.endMinute, endMinute: interval.endMinute });
      return remaining;
    });
  }
  return intervals.sort((a, b) => a.startMinute - b.startMinute);
}
