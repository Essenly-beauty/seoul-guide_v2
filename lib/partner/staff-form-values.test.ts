import { describe, expect, it } from 'vitest';
import { staffCalendarDraft, staffCalendarFormValues, staffProfileDraft, staffProfileFormValues } from './staff-form-values';

const merchantId = '11111111-1111-4111-8111-111111111111';

describe('staff form conversion', () => {
  it('starts an optional profile blank and rejects public visibility without a name', () => {
    const draft = staffProfileDraft();
    expect(draft).toEqual({ name: '', title: '', introduction: '', visibility: 'draft', sortOrder: '0' });
    expect(staffProfileFormValues({ ...draft, visibility: 'visible' }).ok).toBe(false);
    expect(staffProfileFormValues({ ...draft, name: '민지', visibility: 'visible' })).toEqual({ ok: true, values: { name: '민지', title: '', introduction: '', visibility: 'visible', sortOrder: 0 } });
  });

  it('keeps invalid sort order and overlong text out of commands', () => {
    expect(staffProfileFormValues({ ...staffProfileDraft(), sortOrder: '-1' }).ok).toBe(false);
    expect(staffProfileFormValues({ ...staffProfileDraft(), title: '가'.repeat(121) }).ok).toBe(false);
  });

  it('converts labeled hours and special-date closure to the shared calendar contract', () => {
    const draft = staffCalendarDraft(null);
    draft.weekly.hours.push({ weekday: '1', start: '09:00', end: '18:00' });
    draft.overrides.push({ date: '2026-11-05', closed: true, hours: [], breaks: [] });
    const parsed = staffCalendarFormValues(draft, merchantId);
    expect(parsed).toEqual({ ok: true, values: {
      hours: [{ weekday: 1, startMinute: 540, endMinute: 1080 }], breaks: [], blocks: [],
      overrides: [{ date: '2026-11-05', hours: [], breaks: [] }],
    } });
  });

  it('rejects invalid calendar overlap and malformed dates locally', () => {
    const draft = staffCalendarDraft(null);
    draft.weekly.hours.push({ weekday: '1', start: '09:00', end: '18:00' }, { weekday: '1', start: '17:00', end: '19:00' });
    expect(staffCalendarFormValues(draft, merchantId).ok).toBe(false);
    draft.weekly.hours.pop();
    draft.overrides.push({ date: '2026-02-30', closed: true, hours: [], breaks: [] });
    expect(staffCalendarFormValues(draft, merchantId).ok).toBe(false);
  });
});
