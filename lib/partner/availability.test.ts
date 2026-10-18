import { describe, expect, it } from 'vitest';
import { businessIntervals, seoulDateKey, validateSchedule, type PartnerSchedule } from './availability';

const schedule: PartnerSchedule = {
  merchantId: 'merchant', hours: [{ weekday: 0, startMinute: 540, endMinute: 1080 }],
  breaks: [{ weekday: 0, startMinute: 720, endMinute: 780 }],
  blocks: [{ date: '2026-10-18', startMinute: 900, endMinute: 960 }],
};

describe('partner business hours', () => {
  it('subtracts weekly breaks and exact-date blocks without changing input', () => {
    const before = structuredClone(schedule);
    expect(validateSchedule(schedule)).toEqual([]);
    expect(businessIntervals(schedule, 'merchant', '2026-10-18')).toEqual([
      { startMinute: 540, endMinute: 720 }, { startMinute: 780, endMinute: 900 }, { startMinute: 960, endMinute: 1080 },
    ]);
    expect(schedule).toEqual(before);
  });

  it('does not apply another date’s block and returns no hours on a closed weekday', () => {
    expect(businessIntervals(schedule, 'merchant', '2026-10-25')).toEqual([
      { startMinute: 540, endMinute: 720 }, { startMinute: 780, endMinute: 1080 },
    ]);
    expect(businessIntervals(schedule, 'merchant', '2026-10-19')).toEqual([]);
  });

  it('permits full-day blocks', () => {
    const blocked = { ...schedule, blocks: [{ date: '2026-10-18', startMinute: 0, endMinute: 1440 }] };
    expect(validateSchedule(blocked)).toEqual([]);
    expect(businessIntervals(blocked, 'merchant', '2026-10-18')).toEqual([]);
  });

  it('rejects merchant mismatch, invalid dates, and invalid schedules', () => {
    expect(() => businessIntervals(schedule, 'foreign', '2026-10-18')).toThrow('merchant.mismatch');
    for (const date of ['2026-02-30', '2026-10-18T00:00:00Z', '2026-1-01', '2025-02-29', 'not a date']) {
      expect(() => businessIntervals(schedule, 'merchant', date)).toThrow('date.invalid');
    }
    expect(validateSchedule({ ...schedule, merchantId: ' ' })).toContain('merchant.invalid');
    expect(() => businessIntervals({ ...schedule, merchantId: ' ' }, ' ', '2026-10-18')).toThrow('merchant.invalid');
  });

  it('accepts adjacent openings and sorts results', () => {
    const adjacent = { ...schedule, breaks: [], blocks: [], hours: [
      { weekday: 0, startMinute: 720, endMinute: 900 }, { weekday: 0, startMinute: 540, endMinute: 720 },
    ] };
    expect(validateSchedule(adjacent)).toEqual([]);
    expect(businessIntervals(adjacent, 'merchant', '2026-10-18')).toEqual([
      { startMinute: 540, endMinute: 720 }, { startMinute: 720, endMinute: 900 },
    ]);
  });

  it.each(['hours', 'breaks', 'blocks'] as const)('rejects overlapping %s but allows adjacency and different groups', (field) => {
    const period = field === 'blocks' ? { date: '2026-10-18' } : { weekday: 0 };
    const entries = [{ ...period, startMinute: 600, endMinute: 700 }, { ...period, startMinute: 650, endMinute: 750 }];
    expect(validateSchedule({ ...schedule, [field]: entries })).toContain(`${field}.overlap`);
    expect(validateSchedule({ ...schedule, [field]: [{ ...entries[0] }, { ...entries[1], startMinute: 700 }] })).not.toContain(`${field}.overlap`);
    const otherGroup = field === 'blocks' ? { date: '2026-10-19' } : { weekday: 1 };
    expect(validateSchedule({ ...schedule, [field]: [entries[0], { ...entries[1], ...otherGroup }] })).not.toContain(`${field}.overlap`);
  });

  it.each(['hours', 'breaks', 'blocks'] as const)('validates %s collections and interval boundaries', (field) => {
    expect(validateSchedule({ ...schedule, [field]: null } as unknown as PartnerSchedule)).toContain(`${field}.invalid`);
    const period = field === 'blocks' ? { date: '2026-10-18' } : { weekday: 0 };
    for (const [startMinute, endMinute] of [[1080, 540], [540, 540], [540.5, 600], [-1, 600], [540, 1441], [0, Infinity], [NaN, 600]]) {
      expect(validateSchedule({ ...schedule, [field]: [{ ...period, startMinute, endMinute }] })).toContain(`${field}.invalid`);
    }
  });

  it.each(['hours', 'breaks'] as const)('validates weekday in %s', (field) => {
    for (const weekday of [-1, 7, 0.5, NaN]) {
      expect(validateSchedule({ ...schedule, [field]: [{ weekday, startMinute: 600, endMinute: 700 }] })).toContain(`${field}.invalid`);
    }
  });

  it('requires each break to fit inside one opening period', () => {
    expect(validateSchedule({ ...schedule, breaks: [{ weekday: 0, startMinute: 500, endMinute: 600 }] })).toContain('breaks.outside_hours');
    expect(validateSchedule({ ...schedule, breaks: [{ weekday: 1, startMinute: 600, endMinute: 700 }] })).toContain('breaks.outside_hours');
    const split = { ...schedule, hours: [{ weekday: 0, startMinute: 540, endMinute: 750 }, { weekday: 0, startMinute: 750, endMinute: 1080 }] };
    expect(validateSchedule(split)).toContain('breaks.outside_hours');
  });

  it('validates real calendar dates, including leap days and early years', () => {
    for (const date of ['2026-02-30', '2026-13-01', '2026-00-01', '2026-01-00', '2025-02-29', '2026-1-01']) {
      expect(validateSchedule({ ...schedule, blocks: [{ date, startMinute: 0, endMinute: 1440 }] })).toContain('blocks.invalid');
    }
    for (const date of ['2024-02-29', '0099-01-01']) {
      expect(validateSchedule({ ...schedule, blocks: [{ date, startMinute: 0, endMinute: 1440 }] })).toEqual([]);
    }
  });

  it('splits correctly for overlapping weekly and date exclusions and edge clipping', () => {
    const input = { ...schedule, blocks: [
      { date: '2026-10-18', startMinute: 0, endMinute: 600 },
      { date: '2026-10-18', startMinute: 700, endMinute: 800 },
      { date: '2026-10-18', startMinute: 1000, endMinute: 1440 },
    ] };
    expect(businessIntervals(input, 'merchant', '2026-10-18')).toEqual([
      { startMinute: 600, endMinute: 700 }, { startMinute: 800, endMinute: 1000 },
    ]);
  });

  it('uses the explicit Seoul day boundary', () => {
    expect(seoulDateKey(new Date('2026-10-18T14:59:59Z'))).toBe('2026-10-18');
    expect(seoulDateKey(new Date('2026-10-18T15:00:00Z'))).toBe('2026-10-19');
    expect(() => seoulDateKey(new Date(NaN))).toThrow('date.invalid');
  });
});
