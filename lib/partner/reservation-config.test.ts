import { describe, expect, it } from 'vitest';
import { eligibleStaff, reservationRules, reservationStaff, type ReservationRules, type ReservationStaff } from './reservation-config';

const merchantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const foreignMerchantId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const menuId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const otherMenuId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
const rules: ReservationRules = {
  merchantId, mode: 'shop', capacity: 1, startDate: '2026-10-18', endDate: '2027-10-18',
  minimumLeadMinutes: 0, slotIntervalMinutes: 30,
};
const staff: ReservationStaff = {
  id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', merchantId, name: '민지', title: '디자이너',
  introduction: '', visibility: 'visible', sortOrder: 0, menuIds: [menuId],
};
const foreignStaff: ReservationStaff = { ...staff, id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', merchantId: foreignMerchantId };
const invalidIds = ['', 'not-a-uuid', merchantId.toUpperCase(), `A${merchantId.slice(1)}`, `${merchantId}\n`, `${merchantId}\u0000`, null, 1];
const invalidNumbers = [-1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, '1', null, undefined];

describe('reservation configuration shape', () => {
  it.each([null, undefined, [], '', 1, true, new Date(), () => rules, {}])('rejects non-records and incomplete records %#', (value) => {
    expect(reservationRules(value)).toBe(false);
    expect(reservationStaff(value)).toBe(false);
  });

  it('requires every key and rejects unknown keys', () => {
    for (const [validate, fixture] of [[reservationRules, rules], [reservationStaff, staff]] as const) {
      for (const key of Object.keys(fixture)) {
        const missing: Record<string, unknown> = { ...fixture };
        delete missing[key];
        expect(validate(missing)).toBe(false);
      }
      for (const key of ['extra', 'userId', 'imageUrl', 'permissions']) {
        expect(validate({ ...fixture, [key]: true })).toBe(false);
      }
      expect(validate({ ...fixture, [Symbol('extra')]: true })).toBe(false);
      expect(validate(Object.defineProperty({ ...fixture }, 'extra', { value: true }))).toBe(false);
      expect(validate(Object.create(fixture))).toBe(false);
    }
  });
});

describe('reservation rules', () => {
  it.each(['shop', 'staff'] as const)('accepts explicit %s settings', (mode) => {
    expect(reservationRules({ ...rules, mode })).toBe(true);
  });

  it.each(['', 'all', 'SHOP', null, {}, { toString: () => 'shop' }])('rejects an invalid mode %#', (mode) => {
    expect(reservationRules({ ...rules, mode })).toBe(false);
  });

  it.each(invalidIds)('requires a canonical lowercase merchant UUID %#', (merchantId) => {
    expect(reservationRules({ ...rules, merchantId })).toBe(false);
  });

  it.each(invalidNumbers)('rejects invalid numeric settings %#', (value) => {
    for (const field of ['capacity', 'minimumLeadMinutes', 'slotIntervalMinutes']) {
      expect(reservationRules({ ...rules, [field]: value })).toBe(false);
    }
  });

  it('enforces capacity and minute boundaries without defaults', () => {
    expect(reservationRules({ ...rules, capacity: Number.MAX_SAFE_INTEGER, minimumLeadMinutes: 525600, slotIntervalMinutes: 1440 })).toBe(true);
    expect(reservationRules({ ...rules, capacity: 1, minimumLeadMinutes: 0, slotIntervalMinutes: 1 })).toBe(true);
    for (const patch of [{ capacity: 0 }, { minimumLeadMinutes: 525601 }, { slotIntervalMinutes: 0 }, { slotIntervalMinutes: 1441 }]) {
      expect(reservationRules({ ...rules, ...patch })).toBe(false);
    }
  });

  it.each(['0001-01-01', '0099-12-31', '1600-02-29', '2000-02-29', '2024-02-29', '9999-12-31'])('accepts real inclusive calendar date %s', (date) => {
    expect(reservationRules({ ...rules, startDate: date, endDate: date })).toBe(true);
  });

  it.each(['0000-01-01', '0000-02-29', '10000-01-01', '1900-02-29', '2025-02-29', '2026-02-30', '2026-04-31', '2026-13-01', '2026-00-01', '2026-01-00', '2026-01-32', '2026-1-01', '2026-01-1', '2026-10-18T00:00:00Z', '2026-10-18\n', '\uD800', null, 20261018])('rejects invalid date %#', (date) => {
    expect(reservationRules({ ...rules, startDate: date })).toBe(false);
    expect(reservationRules({ ...rules, endDate: date })).toBe(false);
  });

  it('rejects a reversed date range', () => {
    expect(reservationRules({ ...rules, startDate: rules.endDate, endDate: rules.startDate })).toBe(false);
    expect(reservationRules({ ...rules, startDate: '0001-01-01', endDate: '9999-12-31' })).toBe(true);
  });
});

describe('reservation staff', () => {
  it('accepts explicit menu assignments and leaves an empty assignment empty', () => {
    expect(reservationStaff(staff)).toBe(true);
    expect(reservationStaff(foreignStaff)).toBe(true);
    expect(reservationStaff({ ...staff, menuIds: [menuId, otherMenuId] })).toBe(true);
    const unassigned = { ...staff, menuIds: [] };
    expect(reservationStaff(unassigned)).toBe(true);
    expect(unassigned.menuIds).toEqual([]);
  });

  it.each(invalidIds)('requires canonical lowercase staff, merchant, and menu UUIDs %#', (value) => {
    expect(reservationStaff({ ...staff, id: value })).toBe(false);
    expect(reservationStaff({ ...staff, merchantId: value })).toBe(false);
    expect(reservationStaff({ ...staff, menuIds: [value] })).toBe(false);
  });

  it.each(['draft', 'hidden', 'archived'] as const)('allows blank names for %s staff', (visibility) => {
    expect(reservationStaff({ ...staff, visibility, name: '', title: '', introduction: '' })).toBe(true);
    expect(reservationStaff({ ...staff, visibility, name: ' \t\n' })).toBe(true);
  });

  it.each(['', ' ', '\t\n', '\u3000'])('requires a trimmed nonempty visible name %#', (name) => {
    expect(reservationStaff({ ...staff, name })).toBe(false);
  });

  it('preserves valid text without trimming or coercion', () => {
    const input = { ...staff, name: ' 민지 ', title: '', introduction: '' };
    expect(reservationStaff(input)).toBe(true);
    expect(input.name).toBe(' 민지 ');
    for (const field of ['name', 'title', 'introduction']) {
      for (const value of [null, 1, {}, { toString: () => '민지' }]) {
        expect(reservationStaff({ ...staff, [field]: value })).toBe(false);
      }
    }
  });

  it.each(['name', 'title', 'introduction'] as const)('counts Unicode code points in %s', (field) => {
    const maximum = field === 'introduction' ? 1000 : 120;
    for (const character of ['가', '😀']) {
      expect(reservationStaff({ ...staff, [field]: character.repeat(maximum) })).toBe(true);
      expect(reservationStaff({ ...staff, [field]: character.repeat(maximum + 1) })).toBe(false);
    }
  });

  it.each(['\u0000', 'before\u0000after', '\uD800', '\uDC00', '\uD800x\uDC00', '\uD800\uD800\uDC00'])('rejects NUL and malformed UTF-16 %#', (value) => {
    for (const field of ['name', 'title', 'introduction']) {
      expect(reservationStaff({ ...staff, [field]: value })).toBe(false);
    }
  });

  it.each(['', 'VISIBLE', 'deleted', null, 1, {}])('rejects invalid visibility %#', (visibility) => {
    expect(reservationStaff({ ...staff, visibility })).toBe(false);
  });

  it.each(invalidNumbers)('rejects invalid sort order %#', (sortOrder) => {
    expect(reservationStaff({ ...staff, sortOrder })).toBe(false);
  });

  it('accepts safe sort order boundaries', () => {
    expect(reservationStaff({ ...staff, sortOrder: 0 })).toBe(true);
    expect(reservationStaff({ ...staff, sortOrder: Number.MAX_SAFE_INTEGER })).toBe(true);
  });

  it.each([null, menuId, {}, [menuId, menuId], [menuId, otherMenuId, menuId], Array(1)])('rejects malformed or duplicate menu assignments %#', (menuIds) => {
    expect(reservationStaff({ ...staff, menuIds })).toBe(false);
  });

  it('limits explicit menu assignments to 1000', () => {
    const menuIds = Array.from({ length: 1001 }, (_, index) => `00000000-0000-0000-0000-${index.toString(16).padStart(12, '0')}`);
    expect(reservationStaff({ ...staff, menuIds: menuIds.slice(0, 1000) })).toBe(true);
    expect(reservationStaff({ ...staff, menuIds })).toBe(false);
  });
});

describe('eligible reservation staff', () => {
  it('requires the same merchant, visible status, and explicit menu membership', () => {
    const hiddenStaff = { ...staff, visibility: 'hidden' as const };
    expect(eligibleStaff([foreignStaff, hiddenStaff, staff], merchantId, menuId)).toEqual([staff]);
    const otherMenuStaff = { ...staff, menuIds: [otherMenuId] };
    const unassignedStaff = { ...staff, menuIds: [] };
    const draftStaff = { ...staff, visibility: 'draft' as const };
    const archivedStaff = { ...staff, visibility: 'archived' as const };
    expect(eligibleStaff([otherMenuStaff, unassignedStaff, draftStaff, archivedStaff, staff], merchantId, menuId)).toEqual([staff]);
    expect(eligibleStaff([staff, otherMenuStaff], merchantId, otherMenuId)).toEqual([otherMenuStaff]);
    expect(eligibleStaff([staff, foreignStaff], foreignMerchantId, menuId)).toEqual([foreignStaff]);
    expect(eligibleStaff([], merchantId, menuId)).toEqual([]);
  });

  it('sorts by sortOrder then ID without mutating the input array or records', () => {
    const laterId = { ...staff, id: 'dddddddd-dddd-dddd-dddd-dddddddddddd' };
    const laterOrder = { ...staff, id: '11111111-1111-1111-1111-111111111111', sortOrder: 1 };
    const input = [laterOrder, laterId, staff];
    const before = structuredClone(input);
    for (const entry of input) {
      Object.freeze(entry.menuIds);
      Object.freeze(entry);
    }
    Object.freeze(input);
    const result = eligibleStaff(input, merchantId, menuId);
    expect(result).toEqual([staff, laterId, laterOrder]);
    expect(result).not.toBe(input);
    expect(input).toEqual(before);
  });

  it.each(invalidIds)('fails with explicit codes on invalid query IDs %#', (value) => {
    expect(() => eligibleStaff([], value as string, menuId)).toThrow('merchant.invalid');
    expect(() => eligibleStaff([], merchantId, value as string)).toThrow('menu.invalid');
  });

  it.each([null, undefined, {}, 'staff', Array(1), [null], [staff, { ...staff, name: '' }], [{ ...foreignStaff, menuIds: [menuId, menuId] }], [{ ...staff, visibility: 'hidden', sortOrder: -1 }]])('fails on malformed collections and rows before filtering %#', (value) => {
    expect(() => eligibleStaff(value as readonly ReservationStaff[], merchantId, menuId)).toThrow('staff.invalid');
  });
});
