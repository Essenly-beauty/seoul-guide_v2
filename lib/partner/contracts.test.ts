import { describe, expect, it } from 'vitest';
import { parsePartnerCommand } from './contracts';

const id = '12345678-1234-1234-1234-123456789abc';
const stamp = '2026-10-18T01:02:03.123456+00:00';
const category = { kind: 'category', mode: 'create', id, values: { nameKo: '', nameEn: 'Hair', visibility: 'draft', sortOrder: 0 } };
const menu = { kind: 'menu', mode: 'create', id, values: { categoryId: id, nameKo: '', nameEn: '', descriptionKo: '', descriptionEn: '', priceKrw: null, durationMinutes: null, cleanupMinutes: 0, visibility: 'draft', sortOrder: 0 } };
const schedule = { kind: 'schedule', mode: 'create', values: { hours: [{ weekday: 0, startMinute: 540, endMinute: 1080 }], breaks: [{ weekday: 0, startMinute: 720, endMinute: 780 }], blocks: [{ date: '2028-02-29', startMinute: 600, endMinute: 660 }] } };
const settings = { kind: 'settings', expectedUpdatedAt: stamp, values: { displayName: '', contactEmail: '', contactPhone: '', address: '', businessTypes: ['hair', 'nail', 'head_spa'] } };

describe('strict partner command boundary', () => {
  it.each([category, menu, schedule, settings])('accepts valid draft command %# without coercing', (command) => {
    expect(parsePartnerCommand(command)).toEqual({ ok: true, command });
  });
  it.each([category, menu, schedule])('preserves an opaque microsecond update stamp %#', (command) => {
    const update = { ...command, mode: 'update', expectedUpdatedAt: stamp };
    expect(parsePartnerCommand(update)).toEqual({ ok: true, command: update });
  });
  it.each([null, [], '', 1, true, undefined, { ...category, merchantId: id }, { ...category, values: { ...category.values, depositKrw: null } }, { ...menu, values: { ...menu.values, depositKrw: null } }, { ...menu, values: { ...menu.values, merchantId: id } }, { ...settings, values: { ...settings.values, status: 'active' } }, { ...settings, values: { ...settings.values, bookingEnabled: true } }, { kind: 'membership', values: {} }, { ...category, mode: 'delete' }, { ...category, expectedUpdatedAt: stamp }, { ...category, mode: 'update' }, { ...category, id: '123' }, { ...category, id: '12345678123412341234123456789abc' }, { ...category, values: null }, { ...category, values: [] }, { ...menu, values: { ...menu.values, categoryId: 'bad' } }])('rejects malformed or privileged input %#', (input) => {
    const result = parsePartnerCommand(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.length).toBeGreaterThan(0);
  });
  it.each([NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, 1.2, '12', -1])('rejects invalid integer %s', (value) => {
    expect(parsePartnerCommand({ ...category, values: { ...category.values, sortOrder: value } }).ok).toBe(false);
    expect(parsePartnerCommand({ ...menu, values: { ...menu.values, cleanupMinutes: value } }).ok).toBe(false);
    expect(parsePartnerCommand({ ...menu, values: { ...menu.values, priceKrw: value } }).ok).toBe(false);
  });
  it('counts Unicode code points rather than UTF-16 units', () => {
    expect(parsePartnerCommand({ ...category, values: { ...category.values, nameKo: '😀'.repeat(120) } }).ok).toBe(true);
    expect(parsePartnerCommand({ ...category, values: { ...category.values, nameKo: '😀'.repeat(121) } }).ok).toBe(false);
    expect(parsePartnerCommand({ ...menu, values: { ...menu.values, descriptionEn: '😀'.repeat(4001) } }).ok).toBe(false);
  });
  it.each(['', 'yesterday', '2026-02-30T01:00:00Z', '2026-10-18', '2026-10-18T25:00:00Z'])('rejects invalid update stamp %s', (expectedUpdatedAt) => {
    expect(parsePartnerCommand({ ...category, mode: 'update', expectedUpdatedAt }).ok).toBe(false);
  });
  it.each([
    { hours: null }, { hours: [null] }, { hours: [{ weekday: '0', startMinute: 540, endMinute: 600 }] },
    { hours: [{ weekday: 0, startMinute: 600, endMinute: 600 }] },
    { hours: [{ weekday: 0, startMinute: 540, endMinute: 1080, merchantId: id }] },
    { hours: [...schedule.values.hours, { weekday: 0, startMinute: 600, endMinute: 900 }] },
    { breaks: [{ weekday: 1, startMinute: 720, endMinute: 780 }] },
    { blocks: [{ date: '2026-02-29', startMinute: 600, endMinute: 660 }] },
    { blocks: [{ date: '2026-10-18', startMinute: 600, endMinute: Infinity }] },
    { hours: Array.from({ length: 129 }, () => schedule.values.hours[0]) },
    { breaks: Array.from({ length: 129 }, () => schedule.values.breaks[0]) },
    { blocks: Array.from({ length: 513 }, () => schedule.values.blocks[0]) },
  ])('rejects invalid schedule %#', (values) => {
    expect(parsePartnerCommand({ ...schedule, values: { ...schedule.values, ...values } }).ok).toBe(false);
  });
  it('rejects unknown settings fields/types and oversized strings', () => {
    for (const values of [{ ...settings.values, businessTypes: ['other'] }, { ...settings.values, businessTypes: [null] }, { ...settings.values, address: 'a'.repeat(501) }, { ...settings.values, contactEmail: null }]) {
      expect(parsePartnerCommand({ ...settings, values }).ok).toBe(false);
    }
  });
  it('never coerces objects into command discriminators', () => {
    expect(parsePartnerCommand({ ...schedule, id, kind: { toString: () => 'schedule' } }).ok).toBe(false);
  });
  it.each([
    { breaks: [...schedule.values.breaks, { weekday: 0, startMinute: 750, endMinute: 800 }] },
    { blocks: [...schedule.values.blocks, { date: '2028-02-29', startMinute: 630, endMinute: 690 }] },
    { hours: [{ weekday: 7, startMinute: 540, endMinute: 1080 }] },
    { hours: [{ weekday: 0, startMinute: 540.5, endMinute: 1080 }] },
    { hours: [{ weekday: 0, startMinute: 540, endMinute: 1441 }] },
  ])('rejects overlapping or out-of-range schedule intervals %#', (values) => {
    expect(parsePartnerCommand({ ...schedule, values: { ...schedule.values, ...values } }).ok).toBe(false);
  });
  it('rejects zero nullable-positive values and unsafe duration/sort order', () => {
    for (const values of [{ ...menu.values, priceKrw: 0 }, { ...menu.values, durationMinutes: 0 }, { ...menu.values, durationMinutes: Number.MAX_SAFE_INTEGER + 1 }, { ...menu.values, sortOrder: 0.5 }]) {
      expect(parsePartnerCommand({ ...menu, values }).ok).toBe(false);
    }
  });
  it('enforces schedule collection bounds even for otherwise valid non-overlapping intervals', () => {
    const periods = Array.from({ length: 129 }, (_, startMinute) => ({ weekday: 0, startMinute, endMinute: startMinute + 1 }));
    const blocks = Array.from({ length: 513 }, (_, startMinute) => ({ date: '2026-10-18', startMinute, endMinute: startMinute + 1 }));
    for (const values of [
      { hours: periods, breaks: [], blocks: [] },
      { hours: [{ weekday: 0, startMinute: 0, endMinute: 1440 }], breaks: periods, blocks: [] },
      { hours: [], breaks: [], blocks },
    ]) expect(parsePartnerCommand({ ...schedule, values }).ok).toBe(false);
    expect(parsePartnerCommand({ ...schedule, values: { hours: periods.slice(0, 128), breaks: [], blocks: blocks.slice(0, 512) } }).ok).toBe(true);
  });
});
