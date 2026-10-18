import { describe, expect, it } from 'vitest';
import { parseMinute, formatMinute, parseOptionalInteger, categoryFormValues, menuFormValues, scheduleFormValues } from './form-values';

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
});
