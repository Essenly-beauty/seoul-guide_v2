import { describe, expect, it } from 'vitest';
import { reservationIntervals, reservationSchedule, type DateOverride, type ReservationSchedule } from './reservation-calendar';

const merchantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const foreignMerchantId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const schedule: ReservationSchedule = {
  merchantId,
  hours: [{ weekday: 0, startMinute: 540, endMinute: 1080 }],
  breaks: [{ weekday: 0, startMinute: 720, endMinute: 780 }],
  blocks: [{ date: '2026-10-18', startMinute: 900, endMinute: 960 }],
  overrides: [],
};
const special: DateOverride = {
  date: '2026-10-18', hours: [{ startMinute: 600, endMinute: 1020 }],
  breaks: [{ startMinute: 660, endMinute: 690 }],
};
const invalidDates = ['0000-01-01', '0000-02-29', '10000-01-01', '1900-02-29', '2025-02-29', '2026-02-30', '2026-04-31', '2026-13-01', '2026-00-01', '2026-01-00', '2026-01-32', '2026-1-01', '2026-01-1', '2026-10-18T00:00:00Z', '2026-10-18\n', null, 20261018];
const invalidIds = ['', 'merchant', merchantId.toUpperCase(), `${merchantId}\n`, null, 1];
const invalidLengths = [-1, 0.5, NaN, Infinity, undefined, '1', 4294967296];
const intervals = (length: number) => Array.from({ length }, (_, index) => ({ startMinute: index * 2, endMinute: index * 2 + 1 }));
const dateAt = (index: number) => new Date(Date.UTC(2024, 0, index + 1)).toISOString().slice(0, 10);

describe('reservation schedule contract', () => {
  it('accepts weekly schedules, dated replacements, and explicit closures', () => {
    expect(reservationSchedule(schedule)).toBe(true);
    expect(reservationSchedule({ ...schedule, overrides: [special] })).toBe(true);
    expect(reservationSchedule({ ...schedule, overrides: [{ ...special, hours: [], breaks: [] }] })).toBe(true);
    expect(reservationSchedule({ merchantId, hours: [], breaks: [], blocks: [], overrides: [] })).toBe(true);
    expect(reservationSchedule(Object.assign(Object.create(null), schedule))).toBe(true);
  });

  it.each([null, undefined, [], '', 1, true, new Date(), () => schedule, {}])('rejects non-records and incomplete records %#', (value) => {
    expect(reservationSchedule(value)).toBe(false);
  });

  it('requires exact own keys on the root, overrides, and every kind of interval', () => {
    const fixtures = [
      { value: schedule, wrap: (value: unknown) => value },
      { value: special, wrap: (value: unknown) => ({ ...schedule, overrides: [value] }) },
      { value: special.hours[0], wrap: (value: unknown) => ({ ...schedule, overrides: [{ ...special, hours: [value] }] }) },
      { value: special.breaks[0], wrap: (value: unknown) => ({ ...schedule, overrides: [{ ...special, breaks: [value] }] }) },
      ...(['hours', 'breaks', 'blocks'] as const).map((key) => ({ value: schedule[key][0], wrap: (value: unknown) => ({ ...schedule, [key]: [value] }) })),
    ];
    for (const { value, wrap } of fixtures) {
      for (const key of Object.keys(value)) {
        const missing: Record<string, unknown> = { ...value };
        delete missing[key];
        expect(reservationSchedule(wrap(missing))).toBe(false);
      }
      expect(reservationSchedule(wrap({ ...value, extra: true }))).toBe(false);
      expect(reservationSchedule(wrap({ ...value, [Symbol('extra')]: true }))).toBe(false);
      expect(reservationSchedule(wrap(Object.defineProperty({ ...value }, 'extra', { value: true })))).toBe(false);
      expect(reservationSchedule(wrap(Object.create(value)))).toBe(false);
    }
  });

  it.each(invalidIds)('requires a canonical lowercase merchant UUID %#', (merchantId) => {
    expect(reservationSchedule({ ...schedule, merchantId })).toBe(false);
  });

  it.each(['0001-01-01', '0099-12-31', '1600-02-29', '2000-02-29', '2024-02-29', '9999-12-31'])('accepts real calendar dates %s', (date) => {
    expect(reservationSchedule({ ...schedule, overrides: [{ ...special, date }], blocks: [{ ...schedule.blocks[0], date }] })).toBe(true);
  });

  it.each(invalidDates)('rejects invalid override and block dates %#', (date) => {
    expect(reservationSchedule({ ...schedule, overrides: [{ ...special, date }] })).toBe(false);
    expect(reservationSchedule({ ...schedule, blocks: [{ ...schedule.blocks[0], date }] })).toBe(false);
  });

  it('requires unique override dates even when one of the entries closes the day', () => {
    expect(reservationSchedule({ ...schedule, overrides: [special, { ...special, hours: [], breaks: [] }] })).toBe(false);
    expect(reservationSchedule({ ...schedule, overrides: [special, { ...special, date: '2026-10-19' }] })).toBe(true);
  });

  it.each([null, {}, 'hours', Array(1)])('rejects malformed or sparse collections %#', (value) => {
    for (const field of ['hours', 'breaks', 'blocks', 'overrides']) {
      expect(reservationSchedule({ ...schedule, [field]: value })).toBe(false);
    }
    for (const field of ['hours', 'breaks']) {
      expect(reservationSchedule({ ...schedule, overrides: [{ ...special, [field]: value }] })).toBe(false);
    }
  });

  it.each([[-1, 700], [600, 600], [700, 600], [600.5, 700], [600, 700.5], [0, 1441], [NaN, 700], [0, Infinity], ['600', 700], [600, null]])('rejects invalid interval boundaries %#', (startMinute, endMinute) => {
    for (const field of ['hours', 'breaks', 'blocks'] as const) {
      expect(reservationSchedule({ ...schedule, [field]: [{ ...schedule[field][0], startMinute, endMinute }] })).toBe(false);
    }
    for (const field of ['hours', 'breaks']) {
      expect(reservationSchedule({ ...schedule, overrides: [{ ...special, [field]: [{ startMinute, endMinute }] }] })).toBe(false);
    }
  });

  it.each([-1, 7, 0.5, NaN, '0', null])('rejects invalid weekly weekdays %#', (weekday) => {
    for (const field of ['hours', 'breaks'] as const) {
      expect(reservationSchedule({ ...schedule, [field]: [{ ...schedule[field][0], weekday }] })).toBe(false);
    }
  });

  it('accepts all-day openings and adjacent intervals, grouped by weekday or date', () => {
    const hours = [{ startMinute: 720, endMinute: 1440 }, { startMinute: 0, endMinute: 720 }];
    expect(reservationSchedule({ merchantId, hours: [0, 1].flatMap((weekday) => hours.map((hour) => ({ ...hour, weekday }))), breaks: [], blocks: [0, 1].map((index) => ({ date: dateAt(index), startMinute: 0, endMinute: 1440 })), overrides: [{ date: special.date, hours, breaks: [] }] })).toBe(true);
  });

  it('rejects overlapping weekly periods, blocks, and override periods', () => {
    const overlap = [{ startMinute: 600, endMinute: 700 }, { startMinute: 650, endMinute: 750 }];
    for (const field of ['hours', 'breaks', 'blocks'] as const) {
      expect(reservationSchedule({ ...schedule, [field]: overlap.map((period) => ({ ...schedule[field][0], ...period })) })).toBe(false);
    }
    for (const field of ['hours', 'breaks']) {
      expect(reservationSchedule({ ...schedule, overrides: [{ ...special, [field]: overlap }] })).toBe(false);
    }
  });

  it('requires breaks to fit one opening, including closures and adjacent split openings', () => {
    const pause = { startMinute: 700, endMinute: 800 };
    for (const hours of [[], [{ startMinute: 800, endMinute: 900 }], [{ startMinute: 600, endMinute: 750 }, { startMinute: 750, endMinute: 900 }]]) {
      expect(reservationSchedule({ ...schedule, overrides: [{ date: special.date, hours, breaks: [pause] }] })).toBe(false);
      expect(reservationSchedule({ ...schedule, hours: hours.map((hour) => ({ ...hour, weekday: 0 })), breaks: [{ ...pause, weekday: 0 }] })).toBe(false);
    }
  });

  it('enforces inclusive weekly, block, and override interval count limits', () => {
    const many = intervals(129);
    const weeklyHours = many.slice(0, 128).map((period) => ({ ...period, weekday: 0 }));
    expect(reservationSchedule({ ...schedule, hours: weeklyHours, breaks: [], blocks: [] })).toBe(true);
    expect(reservationSchedule({ ...schedule, hours: many.map((period) => ({ ...period, weekday: 0 })), breaks: [] })).toBe(false);
    expect(reservationSchedule({ ...schedule, hours: [{ weekday: 0, startMinute: 0, endMinute: 1440 }], breaks: weeklyHours })).toBe(true);
    expect(reservationSchedule({ ...schedule, hours: [{ weekday: 0, startMinute: 0, endMinute: 1440 }], breaks: many.map((period) => ({ ...period, weekday: 0 })) })).toBe(false);
    const blocks = intervals(513).map((period) => ({ ...period, date: special.date }));
    expect(reservationSchedule({ ...schedule, blocks: blocks.slice(0, 512) })).toBe(true);
    expect(reservationSchedule({ ...schedule, blocks })).toBe(false);
    for (const field of ['hours', 'breaks']) {
      const override = { date: special.date, hours: [{ startMinute: 0, endMinute: 1440 }], breaks: [], [field]: many.slice(0, 128) };
      expect(reservationSchedule({ ...schedule, overrides: [override] })).toBe(true);
      expect(reservationSchedule({ ...schedule, overrides: [{ ...override, [field]: many }] })).toBe(false);
    }
  });

  it('allows 366 unique override dates and rejects 367', () => {
    const overrides = Array.from({ length: 367 }, (_, index) => ({ date: dateAt(index), hours: [], breaks: [] }));
    expect(reservationSchedule({ ...schedule, overrides: overrides.slice(0, 366) })).toBe(true);
    expect(reservationSchedule({ ...schedule, overrides })).toBe(false);
  });

  it('limits the complete validated schedule to 256 KiB of UTF-8 JSON', () => {
    const overrides: DateOverride[] = [];
    let previous: ReservationSchedule = { ...schedule, overrides: [] };
    let input: ReservationSchedule = previous;
    while (new TextEncoder().encode(JSON.stringify(input)).byteLength <= 256 * 1024) {
      previous = input;
      overrides.push({ date: dateAt(overrides.length), hours: intervals(128), breaks: intervals(128) });
      input = { ...schedule, overrides: [...overrides] };
    }
    expect(overrides.length).toBeLessThanOrEqual(366);
    expect(reservationSchedule(previous)).toBe(true);
    expect(reservationSchedule(input)).toBe(false);
    Object.defineProperty(input.overrides, 'toJSON', { value: () => [] });
    expect(reservationSchedule(input)).toBe(false);
  });
});

describe('reservation opening intervals', () => {
  it('opens on a normally closed weekday using an override', () => {
    const input = { ...schedule, overrides: [{ ...special, date: '2026-10-19', breaks: [] }] };
    expect(reservationIntervals(input, merchantId, '2026-10-19')).toEqual(special.hours);
  });

  it('closes a normally open day with empty override hours and breaks', () => {
    expect(reservationIntervals({ ...schedule, overrides: [{ date: '2026-10-18', hours: [], breaks: [] }] }, merchantId, '2026-10-18')).toEqual([]);
  });

  it('replaces both weekly opening hours and weekly breaks while subtracting date blocks', () => {
    expect(reservationIntervals({ ...schedule, overrides: [special] }, merchantId, special.date)).toEqual([
      { startMinute: 600, endMinute: 660 }, { startMinute: 690, endMinute: 900 }, { startMinute: 960, endMinute: 1020 },
    ]);
  });

  it('clips special hours using blocks at both edges and a full-day block', () => {
    const input = { ...schedule, overrides: [{ ...special, breaks: [] }], blocks: [
      { date: special.date, startMinute: 0, endMinute: 700 }, { date: special.date, startMinute: 900, endMinute: 1440 },
    ] };
    expect(reservationIntervals(input, merchantId, special.date)).toEqual([{ startMinute: 700, endMinute: 900 }]);
    expect(reservationIntervals({ ...input, blocks: [{ date: special.date, startMinute: 0, endMinute: 1440 }] }, merchantId, special.date)).toEqual([]);
  });

  it('falls back to weekly hours and only applies matching date blocks', () => {
    const input = { ...schedule, overrides: [{ ...special, date: '2026-10-19' }] };
    expect(reservationIntervals(input, merchantId, '2026-10-18')).toEqual([
      { startMinute: 540, endMinute: 720 }, { startMinute: 780, endMinute: 900 }, { startMinute: 960, endMinute: 1080 },
    ]);
    expect(reservationIntervals(input, merchantId, '2026-10-25')).toEqual([
      { startMinute: 540, endMinute: 720 }, { startMinute: 780, endMinute: 1080 },
    ]);
    expect(reservationIntervals(input, merchantId, '2026-10-20')).toEqual([]);
  });

  it('sorts independent output intervals without mutating a frozen schedule', () => {
    const input = { ...schedule, overrides: [{ date: special.date, hours: [{ startMinute: 1000, endMinute: 1440 }, { startMinute: 0, endMinute: 600 }], breaks: [] }] };
    const before = structuredClone(input);
    const freeze = (value: object): void => {
      for (const child of Object.values(value)) if (child !== null && typeof child === 'object') freeze(child);
      Object.freeze(value);
    };
    freeze(input);
    const result = reservationIntervals(input, merchantId, special.date);
    expect(result).toEqual([{ startMinute: 0, endMinute: 600 }, { startMinute: 1000, endMinute: 1440 }]);
    result[0].startMinute = 1;
    result.push({ startMinute: 600, endMinute: 700 });
    expect(input).toEqual(before);
    expect(reservationIntervals(input, merchantId, special.date)).toEqual([{ startMinute: 0, endMinute: 600 }, { startMinute: 1000, endMinute: 1440 }]);
  });

  it.each(invalidDates)('rejects invalid query dates with date.invalid %#', (date) => {
    expect(() => reservationIntervals(schedule, merchantId, date as string)).toThrow('date.invalid');
  });

  it.each(invalidIds)('rejects invalid query merchant IDs with merchant.invalid %#', (id) => {
    expect(() => reservationIntervals(schedule, id as string, special.date)).toThrow('merchant.invalid');
  });

  it('rejects another merchant with merchant.mismatch', () => {
    expect(() => reservationIntervals(schedule, foreignMerchantId, special.date)).toThrow('merchant.mismatch');
  });

  it.each([null, {}, { ...schedule, overrides: undefined }, { ...schedule, merchantId: merchantId.toUpperCase() }, { ...schedule, overrides: [{ ...special, date: '0000-01-01' }] }])('rejects invalid schedules with schedule.invalid %#', (value) => {
    expect(() => reservationIntervals(value as ReservationSchedule, merchantId, special.date)).toThrow('schedule.invalid');
  });
});

describe('safe runtime inspection', () => {
  it('rejects invalid indexed entries even when custom array methods and iterators hide them', () => {
    for (const field of ['hours', 'breaks', 'blocks', 'overrides']) {
      const items = [null];
      Object.defineProperties(items, { every: { value: () => true }, map: { value: () => [] }, [Symbol.iterator]: { value: function* () { return undefined; } } });
      expect(reservationSchedule({ ...schedule, [field]: items })).toBe(false);
    }
  });

  it('calculates the indexed values without invoking input array methods or iterators', () => {
    const input = structuredClone({ ...schedule, overrides: [special] });
    for (const items of [input.hours, input.breaks, input.blocks, input.overrides, input.overrides[0].hours, input.overrides[0].breaks]) {
      const fail = () => { throw new Error('array.method.used'); };
      Object.defineProperties(items, { every: { value: fail }, map: { value: fail }, filter: { value: fail }, [Symbol.iterator]: { value: fail } });
    }
    expect(reservationSchedule(input)).toBe(true);
    expect(reservationIntervals(input, merchantId, special.date)).toEqual([
      { startMinute: 600, endMinute: 660 }, { startMinute: 690, endMinute: 900 }, { startMinute: 960, endMinute: 1020 },
    ]);
  });

  it.each(invalidLengths)('rejects invalid reported array lengths %#', (length) => {
    for (const field of ['hours', 'breaks', 'blocks', 'overrides'] as const) {
      const items = new Proxy(schedule[field], { get: (target, key, receiver) => key === 'length' ? length : Reflect.get(target, key, receiver) });
      expect(reservationSchedule({ ...schedule, [field]: items })).toBe(false);
    }
  });

  it('captures each collection length, indexed item, and period value once for calculation', () => {
    const once = <T extends object>(value: T): T => {
      const reads = new Set<PropertyKey>();
      return new Proxy(value, {
        get(target, key, receiver) {
          if (reads.has(key)) throw new Error(`property.read.twice:${String(key)}`);
          reads.add(key);
          return Reflect.get(target, key, receiver);
        },
      });
    };
    const input = once({
      merchantId, hours: once([once(schedule.hours[0])]), breaks: once([once(schedule.breaks[0])]), blocks: once([once(schedule.blocks[0])]),
      overrides: once([once({ date: special.date, hours: once([once(special.hours[0])]), breaks: once([once(special.breaks[0])]) })]),
    });
    expect(reservationIntervals(input, merchantId, special.date)).toEqual([
      { startMinute: 600, endMinute: 660 }, { startMinute: 690, endMinute: 900 }, { startMinute: 960, endMinute: 1020 },
    ]);
  });

  it('rejects inherited entries in otherwise sparse arrays', () => {
    const hours = Array(1);
    Object.setPrototypeOf(hours, Object.assign(Object.create(Array.prototype), { 0: schedule.hours[0] }));
    expect(reservationSchedule({ ...schedule, hours })).toBe(false);
  });

  it.each(['property', 'prototype', 'keys', 'index'])('contains %s inspection exceptions', (kind) => {
    const fail = () => { throw new Error('inspection.failure'); };
    const input = kind === 'property' ? Object.defineProperty({ ...schedule }, 'merchantId', { get: fail })
      : kind === 'prototype' ? new Proxy(schedule, { getPrototypeOf: fail })
        : kind === 'keys' ? new Proxy(schedule, { ownKeys: fail })
          : { ...schedule, hours: new Proxy(schedule.hours, { get: fail }) };
    expect(reservationSchedule(input)).toBe(false);
    expect(() => reservationIntervals(input, merchantId, special.date)).toThrow('schedule.invalid');
  });
});
