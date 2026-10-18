import { describe, expect, it } from 'vitest';
import { parseReservationCommand } from './reservation-commands';
import { reservationSchedule } from './reservation-calendar';

const stamp = '2026-10-18T01:02:03.123456+00:00';
const rules = { kind: 'reservationRules', mode: 'create', values: {
  mode: 'shop', capacity: 1, startDate: '2026-11-01', endDate: '2026-12-31',
  minimumLeadMinutes: 60, slotIntervalMinutes: 30,
} };
const overrides = { kind: 'dateOverrides', mode: 'create', values: {
  overrides: [{ date: '2026-11-05', hours: [{ startMinute: 540, endMinute: 1020 }], breaks: [{ startMinute: 720, endMinute: 780 }] }],
} };

describe('reservation command boundary', () => {
  it.each([rules, overrides])('accepts exact create and stamped update %#', (input) => {
    expect(parseReservationCommand(input)).toEqual({ ok: true, command: input });
    const update = { ...input, mode: 'update', expectedUpdatedAt: stamp };
    expect(parseReservationCommand(update)).toEqual({ ok: true, command: update });
  });
  it.each([rules, overrides])('rejects privileged or malformed envelopes %#', (input) => {
    for (const candidate of [
      { ...input, merchantId: '11111111-1111-1111-1111-111111111111' },
      { ...input, mode: 'update' },
      { ...input, expectedUpdatedAt: stamp },
      { ...input, mode: 'delete' },
      { ...input, values: { ...input.values, bookingEnabled: true } },
      { ...input, values: { ...input.values, depositKrw: 1000 } },
    ]) expect(parseReservationCommand(candidate).ok).toBe(false);
  });
  it.each([
    { capacity: 0 }, { capacity: Number.MAX_SAFE_INTEGER + 1 }, { capacity: '2' },
    { startDate: '2026-02-30' }, { endDate: '2026-10-31' },
    { minimumLeadMinutes: 525601 }, { slotIntervalMinutes: 0 }, { slotIntervalMinutes: 1441 },
  ])('rejects invalid rule values %#', (values) => {
    expect(parseReservationCommand({ ...rules, values: { ...rules.values, ...values } }).ok).toBe(false);
  });
  it('rejects invalid override rows', () => {
    for (const value of [
    [{ date: '2026-02-30', hours: [], breaks: [] }],
    [{ date: '2026-11-05', hours: [], breaks: [] }, { date: '2026-11-05', hours: [], breaks: [] }],
    [{ date: '2026-11-05', hours: [{ startMinute: 600, endMinute: 500 }], breaks: [] }],
    [{ date: '2026-11-05', hours: [], breaks: [{ startMinute: 600, endMinute: 700 }] }],
    [{ date: '2026-11-05', hours: [], breaks: [], extra: 'bad' }],
    ]) expect(parseReservationCommand({ ...overrides, values: { overrides: value } }).ok).toBe(false);
  });
  it('allows empty closure and rejects oversized schedules', () => {
    expect(parseReservationCommand({ ...overrides, values: { overrides: [{ date: '2026-11-05', hours: [], breaks: [] }] } }).ok).toBe(true);
    const many = Array.from({ length: 367 }, (_, index) => ({ date: `2026-11-${String(index + 1).padStart(2, '0')}`, hours: [], breaks: [] }));
    expect(parseReservationCommand({ ...overrides, values: { overrides: many } }).ok).toBe(false);
  });
  it('rejects an otherwise valid combined special-date payload above 256 KiB', () => {
    const periods = Array.from({ length: 128 }, (_, startMinute) => ({ startMinute, endMinute: startMinute + 1 }));
    const days = Array.from({ length: 100 }, (_, index) => ({
      date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10), hours: periods, breaks: [],
    }));
    expect(new TextEncoder().encode(JSON.stringify(days)).byteLength).toBeGreaterThan(256 * 1024);
    expect(parseReservationCommand({ ...overrides, values: { overrides: days } }).ok).toBe(false);
  });
  it('rejects DB-expanded JSONB that passes the compact R1 limit', () => {
    const periods = Array.from({ length: 128 }, (_, startMinute) => ({ startMinute, endMinute: startMinute + 1 }));
    const days = Array.from({ length: 53 }, (_, index) => ({
      date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10), hours: periods, breaks: [],
    }));
    expect(reservationSchedule({ merchantId: '00000000-0000-0000-0000-000000000000', hours: [], breaks: [], blocks: [], overrides: days })).toBe(true);
    expect(parseReservationCommand({ ...overrides, values: { overrides: days } }).ok).toBe(false);
  });
  it('returns invalid without executing malformed object behavior outside the guard', () => {
    const throwing = new Proxy({}, { get() { throw new Error('hostile'); } });
    expect(parseReservationCommand(throwing).ok).toBe(false);
    expect(parseReservationCommand({ ...rules, values: throwing }).ok).toBe(false);
  });
});
