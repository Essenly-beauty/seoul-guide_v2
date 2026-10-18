import { describe, expect, it } from 'vitest';
import { parseMinute, formatMinute, parseOptionalInteger, categoryFormValues, menuFormValues, scheduleFormValues, reservationRulesDraft, reservationRulesFormValues, dateOverridesDraft, dateOverridesFormValues } from './form-values';
import { reservationJsonbBytes } from './reservation-jsonb';

describe('partner form conversions', () => {
  it('keeps blank, fractional and unsafe integers distinct from zero', () => {
    expect(parseOptionalInteger('')).toBeNull();
    expect(parseOptionalInteger('  ')).toBeNull();
    expect(parseOptionalInteger('0')).toBe(0);
    for (const value of ['1.5', '1e2', '-1', '9007199254740992', 'abc']) expect(parseOptionalInteger(value)).toBeUndefined();
  });
  it('allows midnight only as the end and rejects missing or invalid times', () => {
    expect(parseMinute('24:00', true)).toBe(1440);
    expect(parseMinute('24:00')).toBeNull();
    expect(parseMinute('09:05')).toBe(545);
    for (const value of ['', ' ', '25:00', '09:60', '9:5', '24:01']) expect(parseMinute(value, true)).toBeNull();
    expect(formatMinute(1440)).toBe('24:00');
  });
  it('permits a blank category draft but requires a whole sort position', () => {
    expect(categoryFormValues({ nameKo: '', nameEn: '', visibility: 'draft', sortOrder: '0' })).toEqual({ ok: true, values: { nameKo: '', nameEn: '', visibility: 'draft', sortOrder: 0 } });
    expect(categoryFormValues({ nameKo: '', nameEn: '', visibility: 'draft', sortOrder: '' }).ok).toBe(false);
  });
  it('keeps unconfigured menu fields null and validates approved deposit and category ownership', () => {
    const merchantId = '11111111-1111-4111-8111-111111111111';
    const categoryId = '22222222-2222-4222-8222-222222222222';
    const categories = [{ id: categoryId, merchantId, nameKo: '', nameEn: '', visibility: 'draft' as const, sortOrder: 0 }];
    const draft = { categoryId, nameKo: '', nameEn: '', descriptionKo: '', descriptionEn: '', priceKrw: '', durationMinutes: '', cleanupMinutes: '0', visibility: 'draft' as const, sortOrder: '0' };
    const parsed = menuFormValues(draft, merchantId, categories, null);
    expect(parsed.ok && parsed.values.priceKrw).toBeNull();
    expect(parsed.ok && Object.keys(parsed.values)).not.toContain('depositKrw');
    expect(menuFormValues({ ...draft, priceKrw: '500' }, merchantId, categories, 1000).ok).toBe(false);
    expect(menuFormValues(draft, 'other', categories, null).ok).toBe(false);
    expect(menuFormValues({ ...draft, durationMinutes: '0' }, merchantId, categories, null).ok).toBe(false);
  });
  it('rejects blank dates and times, overlap and breaks outside opening hours', () => {
    const row = { weekday: '1', start: '09:00', end: '24:00' };
    expect(scheduleFormValues({ hours: [row], breaks: [], blocks: [] }).ok).toBe(true);
    expect(scheduleFormValues({ hours: [{ ...row, start: '' }], breaks: [], blocks: [] }).ok).toBe(false);
    expect(scheduleFormValues({ hours: [row, row], breaks: [], blocks: [] }).ok).toBe(false);
    expect(scheduleFormValues({ hours: [row], breaks: [{ weekday: '2', start: '12:00', end: '13:00' }], blocks: [] }).ok).toBe(false);
    for (const date of ['', '2026-02-30']) expect(scheduleFormValues({ hours: [], breaks: [], blocks: [{ date, start: '00:00', end: '24:00' }] }).ok).toBe(false);
    expect(scheduleFormValues({ hours: Array(129).fill(row), breaks: [], blocks: [] }).ok).toBe(false);
  });
  it('starts reservation rules without invented business defaults and converts explicit inputs', () => {
    const merchantId = '11111111-1111-4111-8111-111111111111';
    const blank = reservationRulesDraft(null);
    expect(blank).toEqual({ mode: 'shop', capacity: '', startDate: '', endDate: '', minimumLeadMinutes: '', slotIntervalMinutes: '' });
    expect(reservationRulesFormValues(blank, merchantId).ok).toBe(false);
    const filled = { ...blank, capacity: '2', startDate: '2026-11-01', endDate: '2026-12-31', minimumLeadMinutes: '0', slotIntervalMinutes: '30' };
    expect(reservationRulesFormValues(filled, merchantId)).toEqual({ ok: true, values: { mode: 'shop', capacity: 2, startDate: '2026-11-01', endDate: '2026-12-31', minimumLeadMinutes: 0, slotIntervalMinutes: 30 } });
    for (const changed of [{ capacity: '' }, { capacity: '0' }, { capacity: '1.5' }, { capacity: '9007199254740992' }, { startDate: '2026-02-30' }, { endDate: '2026-10-31' }, { minimumLeadMinutes: '' }, { minimumLeadMinutes: '525601' }, { slotIntervalMinutes: '' }, { slotIntervalMinutes: '1441' }]) {
      expect(reservationRulesFormValues({ ...filled, ...changed }, merchantId).ok).toBe(false);
    }
    expect(reservationRulesDraft({ merchantId, ...filled, capacity: 2, minimumLeadMinutes: 0, slotIntervalMinutes: 30, updatedAt: '2026-10-18T00:00:00Z' })).toEqual(filled);
  });
  it('converts special opening, breaks, and full closure without losing stored date blocks', () => {
    const merchantId = '11111111-1111-4111-8111-111111111111';
    const schedule = { merchantId, hours: [{ weekday: 1, startMinute: 540, endMinute: 1080 }], breaks: [], blocks: [{ date: '2026-11-05', startMinute: 600, endMinute: 660 }] };
    const draft = [{ date: '2026-11-05', closed: false, hours: [{ start: '09:00', end: '18:00' }], breaks: [{ start: '12:00', end: '13:00' }] }, { date: '2026-11-06', closed: true, hours: [], breaks: [] }];
    const parsed = dateOverridesFormValues(draft, merchantId, schedule);
    expect(parsed).toEqual({ ok: true, values: { overrides: [{ date: '2026-11-05', hours: [{ startMinute: 540, endMinute: 1080 }], breaks: [{ startMinute: 720, endMinute: 780 }] }, { date: '2026-11-06', hours: [], breaks: [] }] } });
    expect(dateOverridesDraft(parsed.ok ? parsed.values.overrides : [])).toEqual(draft);
    expect(dateOverridesFormValues([{ ...draft[0], closed: true }], merchantId, schedule)).toEqual({ ok: true, values: { overrides: [{ date: '2026-11-05', hours: [], breaks: [] }] } });
    expect(dateOverridesFormValues([draft[0]], merchantId, { ...schedule, blocks: [{ date: '0000-12-31', startMinute: 0, endMinute: 1440 }] }).ok).toBe(true);
    for (const changed of [{ date: '2026-02-30' }, { date: '' }, { hours: [{ start: '24:00', end: '24:00' }] }, { hours: [{ start: '09:00', end: '10:00' }], breaks: [{ start: '11:00', end: '12:00' }] }, { hours: [] }]) {
      expect(dateOverridesFormValues([{ ...draft[0], ...changed }], merchantId, schedule).ok).toBe(false);
    }
    expect(dateOverridesFormValues([draft[0], { ...draft[0] }], merchantId, schedule).ok).toBe(false);
    expect(dateOverridesFormValues(Array(367).fill(draft[1]), merchantId, schedule).ok).toBe(false);
  });
  it('checks the PostgreSQL JSONB byte limit against current weekly schedule plus draft overrides', () => {
    const merchantId = '11111111-1111-4111-8111-111111111111';
    const intervals = Array.from({ length: 16 }, (_, index) => ({ start: formatMinute(index * 2), end: formatMinute(index * 2 + 1) }));
    const draft = Array.from({ length: 366 }, (_, index) => {
      const date = new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10);
      return { date, closed: false, hours: intervals, breaks: [] };
    });
    const blocks = Array.from({ length: 512 }, (_, index) => ({ date: new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10), startMinute: 0, endMinute: 1 }));
    const noBlocks = { merchantId, hours: [], breaks: [], blocks: [] };
    const withBlocks = { ...noBlocks, blocks };
    const alone = dateOverridesFormValues(draft, merchantId, noBlocks);
    expect(alone.ok).toBe(true);
    if (!alone.ok) return;
    expect(reservationJsonbBytes({ ...noBlocks, overrides: alone.values.overrides })).toBeLessThanOrEqual(262144);
    expect(reservationJsonbBytes({ ...withBlocks, overrides: alone.values.overrides })).toBeGreaterThan(262144);
    const combined = dateOverridesFormValues(draft, merchantId, withBlocks);
    expect(combined).toEqual({ ok: false, error: '전체 일정과 특별 영업일의 저장 크기가 256KB를 넘습니다. 기간을 줄여 주세요.' });
    const weekly = { hours: [], breaks: [], blocks: blocks.map(({ date }) => ({ date, start: '00:00', end: '00:01' })) };
    expect(scheduleFormValues(weekly, alone.values.overrides)).toEqual(combined);
  });
});
