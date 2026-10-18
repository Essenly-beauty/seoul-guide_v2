import { describe, expect, it } from 'vitest';
import { reservationSlots, type ReservationOccupancy, type ReservationSlotInput } from './reservation-slots';
import type { ReservationSchedule } from './reservation-calendar';

const merchantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const foreignId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const menuId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const categoryId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const staffId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const otherStaffId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
const date = '2026-10-18';
const at = (minute: number) => new Date(Date.parse(`${date}T00:00:00+09:00`) + minute * 60000).toISOString();
const schedule: ReservationSchedule = {
  merchantId, hours: [{ weekday: 0, startMinute: 540, endMinute: 660 }], breaks: [], blocks: [], overrides: [],
};
const base: ReservationSlotInput = {
  merchantId, merchantStatus: 'active', bookingEnabled: true, date, now: new Date(at(0)),
  rules: { merchantId, mode: 'shop', capacity: 1, startDate: date, endDate: date, minimumLeadMinutes: 0, slotIntervalMinutes: 30 },
  schedule,
  menu: { id: menuId, merchantId, categoryId, nameKo: '패키지', nameEn: 'Package', descriptionKo: '한 번 방문', descriptionEn: 'One visit', priceKrw: 100000, depositKrw: 10000, durationMinutes: 60, cleanupMinutes: 0, visibility: 'visible', sortOrder: 0 },
  categories: [{ id: categoryId, merchantId, nameKo: '메뉴', nameEn: 'Menu', visibility: 'visible', sortOrder: 0 }],
  staff: null, staffSchedule: null, occupancies: [],
};
const staffInput: ReservationSlotInput = {
  ...base, rules: { ...base.rules, mode: 'staff', capacity: 2 },
  staff: { id: staffId, merchantId, name: 'Kim', title: '', introduction: '', visibility: 'visible', sortOrder: 0, menuIds: [menuId] },
  staffSchedule: schedule,
};
const slot = (start: number, duration = 60, cleanup = 0, selectedStaff: string | null = null) => ({ startAt: at(start), serviceEndAt: at(start + duration), occupiedUntil: at(start + duration + cleanup), staffId: selectedStaff });
const occupancy = (start: number, end: number, index = 1): ReservationOccupancy => ({
  id: `00000000-0000-0000-0000-${String(index).padStart(12, '0')}`, merchantId, staffId: null,
  startAt: at(start), endAt: at(end), status: 'confirmed', expiresAt: null,
});
const run = (patch: Partial<ReservationSlotInput> = {}) => reservationSlots({ ...base, ...patch });

describe('reservation slots', () => {
  it('calculates shop slots with service and cleanup endpoints', () => {
    expect(run()).toEqual([slot(540), slot(570), slot(600)]);
    expect(run({ menu: { ...base.menu, cleanupMinutes: 30 } })).toEqual([slot(540, 60, 30), slot(570, 60, 30)]);
  });

  it('requires a visible, assigned, explicit staff member and their schedule in staff mode', () => {
    expect(reservationSlots(staffInput)).toEqual([slot(540, 60, 0, staffId), slot(570, 60, 0, staffId), slot(600, 60, 0, staffId)]);
    for (const visibility of ['draft', 'hidden', 'archived'] as const) expect(reservationSlots({ ...staffInput, staff: { ...staffInput.staff!, visibility } })).toEqual([]);
    expect(reservationSlots({ ...staffInput, staff: { ...staffInput.staff!, menuIds: [] } })).toEqual([]);
    expect(reservationSlots({ ...staffInput, staff: null })).toEqual([]);
    expect(reservationSlots({ ...staffInput, staffSchedule: null })).toEqual([]);
  });

  it('intersects merchant weekly hours with staff special hours and exclusions', () => {
    expect(reservationSlots({ ...staffInput, menu: { ...base.menu, durationMinutes: 30 }, staffSchedule: {
      ...schedule, overrides: [{ date, hours: [{ startMinute: 570, endMinute: 720 }], breaks: [{ startMinute: 600, endMinute: 630 }] }],
    } })).toEqual([slot(570, 30, 0, staffId), slot(630, 30, 0, staffId)]);
    expect(reservationSlots({ ...staffInput, staffSchedule: { ...schedule, overrides: [{ date, hours: [], breaks: [] }] } })).toEqual([]);
    expect(run({ schedule: { ...schedule, overrides: [{ date, hours: [{ startMinute: 720, endMinute: 780 }], breaks: [] }] } })).toEqual([slot(720)]);
  });

  it('merges adjacent merchant and staff openings before fitting full duration', () => {
    const adjacent = { ...schedule, hours: [{ weekday: 0, startMinute: 540, endMinute: 570 }, { weekday: 0, startMinute: 570, endMinute: 660 }] };
    expect(run({ schedule: adjacent })).toEqual([slot(540), slot(570), slot(600)]);
    expect(reservationSlots({ ...staffInput, schedule: adjacent, staffSchedule: adjacent })).toEqual([slot(540, 60, 0, staffId), slot(570, 60, 0, staffId), slot(600, 60, 0, staffId)]);
  });

  it('anchors the grid to midnight and requires cleanup to fit without spilling into another day', () => {
    expect(run({ schedule: { ...schedule, hours: [{ weekday: 0, startMinute: 541, endMinute: 660 }] } })).toEqual([slot(570), slot(600)]);
    expect(run({ schedule: { ...schedule, hours: [{ weekday: 0, startMinute: 1380, endMinute: 1440 }] }, menu: { ...base.menu, durationMinutes: 30, cleanupMinutes: 30 } })).toEqual([slot(1380, 30, 30)]);
    expect(run({ menu: { ...base.menu, durationMinutes: Number.MAX_SAFE_INTEGER, cleanupMinutes: 1 } })).toEqual([]);
    expect(run({ menu: { ...base.menu, durationMinutes: 1441 } })).toEqual([]);
  });

  it('applies lead time at exact milliseconds and inclusive configured dates', () => {
    expect(run({ now: new Date(at(530)), rules: { ...base.rules, minimumLeadMinutes: 10 } })).toEqual(run());
    expect(run({ now: new Date(Date.parse(at(530)) + 1), rules: { ...base.rules, minimumLeadMinutes: 10 } })).toEqual([slot(570), slot(600)]);
    expect(run({ rules: { ...base.rules, startDate: '2026-10-19', endDate: '2026-10-20' } })).toEqual([]);
    expect(run({ rules: { ...base.rules, startDate: '2026-10-16', endDate: '2026-10-17' } })).toEqual([]);
  });

  it('uses fixed Seoul midnight with UTC output regardless of host timezone', () => {
    const before = process.env.TZ;
    try {
      for (const zone of ['UTC', 'America/Los_Angeles', 'Asia/Seoul']) {
        process.env.TZ = zone;
        expect(run({ schedule: { ...schedule, hours: [{ weekday: 0, startMinute: 0, endMinute: 60 }] } })).toEqual([
          { startAt: '2026-10-17T15:00:00.000Z', serviceEndAt: '2026-10-17T16:00:00.000Z', occupiedUntil: '2026-10-17T16:00:00.000Z', staffId: null },
        ]);
      }
    } finally { if (before === undefined) delete process.env.TZ; else process.env.TZ = before; }
  });

  it('blocks selected staff across menus even when store capacity remains', () => {
    expect(reservationSlots({ ...staffInput, occupancies: [{ ...occupancy(540, 570), staffId }] })).toEqual([slot(570, 60, 0, staffId), slot(600, 60, 0, staffId)]);
    expect(reservationSlots({ ...staffInput, occupancies: [{ ...occupancy(540, 570), staffId: otherStaffId }] })).toHaveLength(3);
  });

  it('counts other staff and unassigned occupancy against shared store capacity', () => {
    expect(reservationSlots({ ...staffInput, occupancies: [occupancy(540, 600), { ...occupancy(540, 600, 2), staffId: otherStaffId }] })).toEqual([slot(600, 60, 0, staffId)]);
    expect(run({ occupancies: [{ ...occupancy(540, 600), staffId: otherStaffId }] })).toEqual([slot(600)]);
  });

  it('counts peak simultaneous occupancy, allowing two sequential visits at capacity two', () => {
    expect(run({ rules: { ...base.rules, capacity: 2 }, occupancies: [occupancy(540, 570), occupancy(570, 600, 2)] })).toEqual(run());
    expect(run({ rules: { ...base.rules, capacity: 2 }, occupancies: [occupancy(540, 580), occupancy(570, 600, 2)] })).toEqual([slot(600)]);
  });

  it('uses half-open intervals and counts cleanup occupancy', () => {
    expect(run({ occupancies: [occupancy(480, 540), occupancy(660, 700, 2)] })).toEqual(run());
    expect(run({ menu: { ...base.menu, cleanupMinutes: 30 }, occupancies: [occupancy(610, 620)] })).toEqual([]);
    expect(run({ occupancies: [occupancy(600, 630)] })).toEqual([slot(540)]);
  });

  it('excludes holds only after expiry, including the exact expiry instant', () => {
    const hold = { ...occupancy(540, 600), status: 'hold' as const, expiresAt: at(1) };
    expect(run({ occupancies: [hold] })).toEqual([slot(600)]);
    for (const expiresAt of [at(0), at(-1)]) expect(run({ occupancies: [{ ...hold, expiresAt }] })).toEqual(run());
    expect(run({ occupancies: [occupancy(540, 600)] })).toEqual([slot(600)]);
  });

  it('retains PostgreSQL submillisecond expiry and occupied endpoints', () => {
    const micro = (minute: number, fraction: string) => at(minute).replace('.000Z', `.${fraction}Z`);
    expect(run({ occupancies: [{ ...occupancy(540, 600), status: 'hold', expiresAt: micro(0, '000001') }] })).toEqual([slot(600)]);
    expect(run({ occupancies: [{ ...occupancy(480, 540), endAt: micro(540, '000001') }] })).toEqual([slot(570), slot(600)]);
    expect(run({ occupancies: [{ ...occupancy(540, 600), startAt: micro(540, '000001'), endAt: micro(540, '000002') }] })).toEqual([slot(570), slot(600)]);
    expect(() => run({ occupancies: [{ ...occupancy(540, 600), startAt: micro(540, '000002'), endAt: micro(540, '000001') }] })).toThrow('occupancies.invalid');
  });

  it('preserves exact submillisecond adjacency when calculating store concurrency', () => {
    const boundary = at(570).replace('.000Z', '.000001Z');
    expect(run({ rules: { ...base.rules, capacity: 2 }, occupancies: [
      { ...occupancy(540, 570), endAt: boundary }, { ...occupancy(570, 600, 2), startAt: boundary },
    ] })).toEqual([slot(540), slot(570), slot(600)]);
  });

  it('returns no slots for disabled or inactive merchants and menus that are not public-ready', () => {
    expect(run({ bookingEnabled: false })).toEqual([]);
    for (const merchantStatus of ['onboarding', 'suspended', 'closed'] as const) expect(run({ merchantStatus })).toEqual([]);
    for (const visibility of ['draft', 'hidden', 'archived'] as const) expect(run({ menu: { ...base.menu, visibility } })).toEqual([]);
    expect(run({ categories: [{ ...base.categories[0], visibility: 'hidden' }] })).toEqual([]);
    for (const field of ['priceKrw', 'depositKrw', 'durationMinutes'] as const) expect(run({ menu: { ...base.menu, [field]: null } })).toEqual([]);
    expect(run({ menu: { ...base.menu, depositKrw: 0 } })).toEqual([]);
    expect(run({ categories: [] })).toEqual([]);
  });

  it('rejects merchant mismatches even when booking is disabled or staff hidden', () => {
    const mismatches = [
      { rules: { ...base.rules, merchantId: foreignId } }, { schedule: { ...schedule, merchantId: foreignId } },
      { menu: { ...base.menu, merchantId: foreignId } }, { categories: [{ ...base.categories[0], merchantId: foreignId }] },
      { staff: { ...staffInput.staff!, merchantId: foreignId, visibility: 'hidden' as const } },
      { staffSchedule: { ...schedule, merchantId: foreignId } }, { occupancies: [{ ...occupancy(540, 600), merchantId: foreignId }] },
    ];
    for (const patch of mismatches) expect(() => run({ ...patch, bookingEnabled: false })).toThrow('merchant.mismatch');
  });

  it('requires null staff and staff schedule in shop mode', () => {
    expect(() => run({ staff: staffInput.staff })).toThrow('staff.mode');
    expect(() => run({ staffSchedule: schedule })).toThrow('staff.mode');
  });

  it('rejects malformed or duplicate occupancy rows before filtering expired holds', () => {
    const valid = occupancy(540, 600);
    const malformed: unknown[] = [null, {}, { ...valid, extra: 1 }, { ...valid, id: valid.id.toUpperCase().replace('00000000', 'ABCDEF00') },
      { ...valid, id: 'bad' }, { ...valid, staffId: 'bad' }, { ...valid, startAt: '2026-02-30T00:00:00Z' },
      { ...valid, endAt: valid.startAt }, { ...valid, status: 'cancelled' }, { ...valid, expiresAt: at(1) },
      { ...valid, status: 'hold', expiresAt: null }, { ...valid, status: 'hold', expiresAt: 'bad' },
      { ...valid, status: 'hold', expiresAt: at(-1), startAt: 'bad' },
    ];
    for (const row of malformed) expect(() => run({ occupancies: [row] as ReservationOccupancy[] })).toThrow('occupancies.invalid');
    expect(() => run({ occupancies: [valid, valid] })).toThrow('occupancies.invalid');
    const missing = { ...valid } as Partial<ReservationOccupancy>; delete missing.expiresAt;
    expect(() => run({ occupancies: [missing] as ReservationOccupancy[] })).toThrow('occupancies.invalid');
    expect(() => run({ occupancies: [Object.defineProperty({ ...valid }, 'extra', { value: true })] })).toThrow('occupancies.invalid');
    expect(() => run({ occupancies: [{ ...valid, [Symbol('extra')]: true }] })).toThrow('occupancies.invalid');
  });

  it('rejects invalid runtime configuration, clock, date, identities, and staff', () => {
    const invalid: Partial<ReservationSlotInput>[] = [
      { merchantId: merchantId.toUpperCase() }, { date: '0000-01-01' }, { date: '2026-02-30' }, { date: '10000-01-01' },
      { now: new Date(NaN) }, { now: '2026-10-18' as unknown as Date }, { bookingEnabled: 1 as unknown as boolean },
      { merchantStatus: 'bad' as 'active' }, { rules: { ...base.rules, capacity: 0 } }, { rules: { ...base.rules, slotIntervalMinutes: 0 } },
      { rules: { ...base.rules, minimumLeadMinutes: -1 } }, { rules: { ...base.rules, extra: true } as typeof base.rules },
      { schedule: { ...schedule, hours: Array(1) } }, { staff: {} as typeof staffInput.staff },
      { staffSchedule: {} as ReservationSchedule }, { menu: { ...base.menu, id: 'bad' } },
      { categories: [{ ...base.categories[0], id: 'bad' }] },
    ];
    for (const patch of invalid) expect(() => run({ ...patch, bookingEnabled: patch.bookingEnabled ?? false })).toThrow();
  });

  it('accepts real lower and upper date bounds', () => {
    for (const day of ['0001-01-01', '9999-12-31']) {
      const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
      expect(run({ date: day, now: new Date(`${day}T00:00:00+09:00`), rules: { ...base.rules, startDate: day, endDate: day }, schedule: { ...schedule, hours: [{ weekday, startMinute: 0, endMinute: 60 }] } })[0].startAt).toBe(new Date(`${day}T00:00:00+09:00`).toISOString());
    }
  });

  it('reads dense indexed collections rather than input methods or iterators', () => {
    const occupied = [occupancy(540, 600)];
    occupied[Symbol.iterator] = function* () { return undefined; };
    occupied.filter = () => [];
    expect(run({ occupancies: occupied })).toEqual([slot(600)]);
    const categories = [...base.categories]; categories.some = () => false;
    expect(run({ categories })).toEqual(run());
    expect(() => run({ occupancies: Array(1) })).toThrow('occupancies.invalid');
    expect(() => run({ categories: Array(1) })).toThrow('categories.invalid');
    const hiddenBad = [occupancy(540, 600), { ...occupancy(540, 600, 2), merchantId: foreignId }];
    hiddenBad[Symbol.iterator] = function* () { yield hiddenBad[0]; return undefined; };
    expect(() => run({ occupancies: hiddenBad })).toThrow('merchant.mismatch');
  });

  it('does not mutate any input', () => {
    const input = structuredClone({ ...staffInput, occupancies: [{ ...occupancy(540, 570), staffId }] });
    const before = structuredClone(input);
    const freeze = (value: unknown) => { if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } };
    freeze(input);
    expect(reservationSlots(input)).toHaveLength(2);
    expect(input).toEqual(before);
  });
});
