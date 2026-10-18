import { describe, expect, it } from 'vitest';
import { parseStaffCommand } from './staff-contracts';
import { reservationSchedule } from './reservation-calendar';

const staffId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const menuId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const merchantId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const stamp = '2026-10-18T01:02:03.123456+00:00';
const profile = { name: ' 민지 ', title: '디자이너', introduction: '예약 소개', visibility: 'visible', sortOrder: 0 };
const calendar = {
  hours: [{ weekday: 0, startMinute: 540, endMinute: 1080 }],
  breaks: [{ weekday: 0, startMinute: 720, endMinute: 780 }],
  blocks: [{ date: '2026-10-18', startMinute: 900, endMinute: 960 }],
  overrides: [{ date: '2026-10-19', hours: [{ startMinute: 600, endMinute: 1020 }], breaks: [] }],
};
const createProfile = { kind: 'staff', mode: 'create', id: staffId, values: profile };
const updateProfile = { ...createProfile, mode: 'update', expectedUpdatedAt: stamp };
const addMenu = { kind: 'staffMenu', mode: 'add', staffId, menuId };
const removeMenu = { ...addMenu, mode: 'remove' };
const createSchedule = { kind: 'staffSchedule', mode: 'create', staffId, values: calendar };
const updateSchedule = { ...createSchedule, mode: 'update', expectedUpdatedAt: stamp };
const commands = [createProfile, updateProfile, addMenu, removeMenu, createSchedule, updateSchedule];
const invalid = { ok: false, errors: ['command.invalid'] };

function reject(input: unknown): void {
  const result = parseStaffCommand(input);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result).toEqual(invalid);
}

describe('staff command boundary', () => {
  it.each(commands)('accepts only the six narrow command shapes %#', (command) => {
    expect(parseStaffCommand(command)).toEqual({ ok: true, command });
    expect(Object.keys(command)).toEqual(command.kind === 'staffMenu'
      ? ['kind', 'mode', 'staffId', 'menuId']
      : command.mode === 'update'
        ? ['kind', 'mode', command.kind === 'staff' ? 'id' : 'staffId', 'values', 'expectedUpdatedAt']
        : ['kind', 'mode', command.kind === 'staff' ? 'id' : 'staffId', 'values']);
  });

  it.each([null, undefined, [], '', 1, true, new Date(), () => createProfile, {}])('rejects non-record or incomplete input %#', reject);

  it.each(commands)('rejects additional, hidden, symbol, or inherited command keys %#', (command) => {
    reject({ ...command, merchantId });
    reject({ ...command, bookingEnabled: true });
    reject({ ...command, [Symbol('privileged')]: true });
    reject(Object.defineProperty({ ...command }, 'extra', { value: true }));
    reject(Object.create(command));
  });

  it('requires the exact modes and version field for each family', () => {
    for (const create of [createProfile, createSchedule]) {
      reject({ ...create, expectedUpdatedAt: stamp });
      reject({ ...create, mode: 'update' });
      reject({ ...create, mode: 'archive' });
    }
    for (const update of [updateProfile, updateSchedule]) {
      reject({ ...update, expectedUpdatedAt: null });
      reject({ ...update, expectedUpdatedAt: '2026-02-30T01:02:03Z' });
      reject({ ...update, mode: 'create' });
    }
    for (const link of [addMenu, removeMenu]) {
      reject({ ...link, expectedUpdatedAt: stamp });
      reject({ ...link, values: { menuIds: [menuId] } });
      reject({ ...link, menuIds: [menuId] });
      reject({ ...link, mode: 'replace' });
    }
    reject({ ...createProfile, kind: 'merchant' });
  });

  it('requires canonical lowercase UUIDs in the id and single-link positions', () => {
    for (const candidate of ['', 'not-a-uuid', staffId.toUpperCase(), `${staffId}\n`, null, 1]) {
      reject({ ...createProfile, id: candidate });
      reject({ ...updateProfile, id: candidate });
      reject({ ...addMenu, staffId: candidate });
      reject({ ...addMenu, menuId: candidate });
      reject({ ...createSchedule, staffId: candidate });
    }
  });

  it('accepts every known visibility and exact Unicode code-point limits', () => {
    for (const visibility of ['draft', 'visible', 'hidden', 'archived']) {
      expect(parseStaffCommand({ ...createProfile, values: { ...profile, visibility } }).ok).toBe(true);
    }
    for (const [field, maximum] of [['name', 120], ['title', 120], ['introduction', 1000]] as const) {
      expect(parseStaffCommand({ ...createProfile, values: { ...profile, [field]: '😀'.repeat(maximum) } }).ok).toBe(true);
      reject({ ...createProfile, values: { ...profile, [field]: '😀'.repeat(maximum + 1) } });
    }
    expect(parseStaffCommand({ ...createProfile, values: { ...profile, sortOrder: Number.MAX_SAFE_INTEGER } }).ok).toBe(true);
  });

  it('requires a JavaScript-trimmed nonempty visible name and preserves accepted text', () => {
    for (const name of ['', ' \t\n', '\u3000', '\uFEFF\u2028']) reject({ ...createProfile, values: { ...profile, name } });
    expect(parseStaffCommand(createProfile)).toEqual({ ok: true, command: createProfile });
    expect(profile.name).toBe(' 민지 ');
    for (const visibility of ['draft', 'hidden', 'archived']) {
      expect(parseStaffCommand({ ...createProfile, values: { ...profile, name: '', visibility } }).ok).toBe(true);
    }
  });

  it('rejects unknown profile keys, invalid text, visibility and integers', () => {
    for (const value of [
      { ...profile, merchantId }, { ...profile, menuIds: [menuId] },
      { ...profile, imageUrl: '/staff.jpg' }, { ...profile, [Symbol('extra')]: true },
      Object.defineProperty({ ...profile }, 'extra', { value: true }), Object.create(profile),
      { ...profile, name: '\u0000' }, { ...profile, title: '\uD800' }, { ...profile, introduction: '\uDC00' },
      { ...profile, visibility: 'deleted' }, { ...profile, sortOrder: -1 }, { ...profile, sortOrder: 0.5 },
      { ...profile, sortOrder: Number.MAX_SAFE_INTEGER + 1 }, { ...profile, sortOrder: '1' },
    ]) reject({ ...createProfile, values: value });
    for (const field of ['name', 'title', 'introduction']) reject({ ...createProfile, values: { ...profile, [field]: 1 } });
    reject({ ...createProfile, values: { name: profile.name, title: profile.title, introduction: profile.introduction, visibility: profile.visibility } });
  });

  it('accepts weekly periods, date blocks, special dates and an explicit closure', () => {
    expect(parseStaffCommand(createSchedule)).toEqual({ ok: true, command: createSchedule });
    const closed = { ...calendar, overrides: [{ date: '2026-10-18', hours: [], breaks: [] }] };
    expect(parseStaffCommand({ ...createSchedule, values: closed })).toEqual({ ok: true, command: { ...createSchedule, values: closed } });
    expect(parseStaffCommand({ ...createSchedule, values: { hours: [], breaks: [], blocks: [], overrides: [] } }).ok).toBe(true);
  });

  it('rejects foreign identity and extra or inherited calendar keys at every level', () => {
    reject({ ...createSchedule, values: { ...calendar, merchantId } });
    reject({ ...createSchedule, values: { ...calendar, [Symbol('extra')]: true } });
    reject({ ...createSchedule, values: Object.defineProperty({ ...calendar }, 'extra', { value: true }) });
    reject({ ...createSchedule, values: Object.create(calendar) });
    const nested = [
      { ...calendar, hours: [{ ...calendar.hours[0], extra: true }] },
      { ...calendar, breaks: [Object.create(calendar.breaks[0])] },
      { ...calendar, blocks: [{ ...calendar.blocks[0], [Symbol('extra')]: true }] },
      { ...calendar, overrides: [{ ...calendar.overrides[0], merchantId }] },
      { ...calendar, overrides: [{ ...calendar.overrides[0], hours: [{ startMinute: 600, endMinute: 1020, extra: true }] }] },
    ];
    for (const values of nested) reject({ ...createSchedule, values });
  });

  it('rejects malformed dates, intervals, overlaps, breaks outside hours and duplicate overrides', () => {
    const invalidCalendars = [
      { ...calendar, hours: [{ ...calendar.hours[0], weekday: 7 }] },
      { ...calendar, breaks: [{ ...calendar.breaks[0], endMinute: 1441 }] },
      { ...calendar, blocks: [{ ...calendar.blocks[0], date: '0000-01-01' }] },
      { ...calendar, overrides: [{ ...calendar.overrides[0], date: '2026-02-30' }] },
      { ...calendar, hours: [calendar.hours[0], calendar.hours[0]] },
      { ...calendar, breaks: [{ weekday: 0, startMinute: 0, endMinute: 100 }] },
      { ...calendar, overrides: [calendar.overrides[0], calendar.overrides[0]] },
      { ...calendar, overrides: [{ date: '2026-10-19', hours: [], breaks: [{ startMinute: 600, endMinute: 700 }] }] },
    ];
    for (const values of invalidCalendars) reject({ ...createSchedule, values });
  });

  it('rejects sparse, cyclic and oversized calendar collections', () => {
    for (const field of ['hours', 'breaks', 'blocks', 'overrides']) reject({ ...createSchedule, values: { ...calendar, [field]: Array(1) } });
    const cycle: unknown[] = []; cycle.push(cycle);
    reject({ ...createSchedule, values: { ...calendar, overrides: cycle } });
    const tooMany = Array.from({ length: 367 }, (_, index) => ({
      date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10), hours: [], breaks: [],
    }));
    reject({ ...createSchedule, values: { ...calendar, overrides: tooMany } });
  });

  it('rejects a JSONB-expanded calendar over 256 KiB even when compact R1 validation passes', () => {
    const periods = Array.from({ length: 128 }, (_, startMinute) => ({ startMinute, endMinute: startMinute + 1 }));
    const overrides = Array.from({ length: 53 }, (_, index) => ({
      date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10), hours: periods, breaks: [],
    }));
    const values = { hours: [], breaks: [], blocks: [], overrides };
    expect(reservationSchedule({ ...values, merchantId: '00000000-0000-0000-0000-000000000000' })).toBe(true);
    reject({ ...createSchedule, values });
  });

  it('measures validated calendar data even when an array has a custom toJSON', () => {
    const periods = Array.from({ length: 128 }, (_, startMinute) => ({ startMinute, endMinute: startMinute + 1 }));
    const overrides = Array.from({ length: 53 }, (_, index) => ({
      date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10), hours: periods, breaks: [],
    }));
    Object.defineProperty(overrides, 'toJSON', { value: () => [] });
    const values = { hours: [], breaks: [], blocks: [], overrides };
    expect(reservationSchedule({ ...values, merchantId: '00000000-0000-0000-0000-000000000000' })).toBe(true);
    reject({ ...createSchedule, values });
  });

  it('returns the validated calendar as a plain serializable command', () => {
    const values = structuredClone(calendar);
    Object.defineProperty(values.overrides, 'toJSON', { value: () => [] });
    const input = { ...createSchedule, values };
    const result = parseStaffCommand(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.command).not.toBe(input);
    expect(JSON.parse(JSON.stringify(result.command))).toEqual(createSchedule);
    values.overrides[0].hours[0].startMinute = 700;
    expect(JSON.parse(JSON.stringify(result.command))).toEqual(createSchedule);
  });

  it('does not return mutable profile getters after validation', () => {
    let name = '민지';
    const values = Object.defineProperty({ ...profile }, 'name', {
      enumerable: true, get: () => name,
    });
    const result = parseStaffCommand({ ...createProfile, values });
    name = ' \t';
    if (!result.ok) {
      expect(result).toEqual(invalid);
      return;
    }
    expect(result.command.kind).toBe('staff');
    if (result.command.kind !== 'staff') return;
    expect(result.command.values.name).toBe('민지');
    expect(JSON.parse(JSON.stringify(result.command)).values.name).toBe('민지');
  });

  it('returns a stable single-menu link when an input getter changes', () => {
    let linkedId = menuId;
    const input = Object.defineProperty({ ...addMenu }, 'menuId', {
      enumerable: true, get: () => linkedId,
    });
    const result = parseStaffCommand(input);
    linkedId = 'invalid';
    if (!result.ok) {
      expect(result).toEqual(invalid);
      return;
    }
    expect(result.command).toEqual(addMenu);
    expect(JSON.parse(JSON.stringify(result.command))).toEqual(addMenu);
  });

  it('contains hostile inspection failures and cyclic commands as invalid', () => {
    const fail = () => { throw new Error('hostile'); };
    reject(new Proxy(createProfile, { getPrototypeOf: fail }));
    reject(new Proxy(createProfile, { ownKeys: fail }));
    reject(Object.defineProperty({ ...createProfile }, 'kind', { get: fail }));
    reject({ ...createProfile, values: new Proxy(profile, { getPrototypeOf: fail }) });
    reject({ ...createSchedule, values: { ...calendar, hours: new Proxy(calendar.hours, { get: fail }) } });
    const cyclic: Record<string, unknown> = { ...createProfile }; cyclic.values = cyclic;
    reject(cyclic);
  });
});
