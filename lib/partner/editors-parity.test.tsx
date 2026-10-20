import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';
import { copyWeekdaySchedule, DateOverridesFields, ScheduleFields } from '@/components/partner/partner-availability';
import { filterPartnerMenus } from '@/components/partner/partner-services';
import { rebaseStaffEnglishDraft, rosterDayState, StaffCalendarFields, StaffEnglishFields } from '@/components/partner/partner-staff';
import type { Menu } from './contracts';
import type { ScheduleDraft } from './form-values';
import type { ReservationSchedule } from './reservation-calendar';

const merchantId = '11111111-1111-4111-8111-111111111111';
const render = (element: React.ReactElement) => load(renderToStaticMarkup(element));
const emptySchedule = (): ReservationSchedule => ({ merchantId, hours: [], breaks: [], blocks: [], overrides: [] });

describe('admin demo editor interactions backed by existing data', () => {
  it('copies every Monday work and break period while preserving weekends and date blocks', () => {
    const value: ScheduleDraft = {
      hours: [{ weekday: '1', start: '09:00', end: '12:00' }, { weekday: '1', start: '14:00', end: '24:00' }, { weekday: '2', start: '10:00', end: '15:00' }, { weekday: '0', start: '10:00', end: '12:00' }],
      breaks: [{ weekday: '1', start: '18:00', end: '19:00' }],
      blocks: [{ date: '2026-11-01', start: '10:00', end: '12:00' }],
    };
    const before = structuredClone(value);
    const copied = copyWeekdaySchedule(value, '1', ['2', '3', '4', '5']);
    expect(copied).not.toBeNull();
    expect(copied!.hours.filter((row) => row.weekday === '2')).toEqual([{ weekday: '2', start: '09:00', end: '12:00' }, { weekday: '2', start: '14:00', end: '24:00' }]);
    expect(copied!.breaks.filter((row) => row.weekday === '5')).toEqual([{ weekday: '5', start: '18:00', end: '19:00' }]);
    expect(copied!.hours.find((row) => row.weekday === '0')).toEqual(value.hours[3]);
    expect(copied!.blocks).toEqual(value.blocks);
    expect(value).toEqual(before);
  });

  it('copies a closed weekday without inventing hours and rejects copies beyond storage limits', () => {
    const value: ScheduleDraft = { hours: [{ weekday: '2', start: '10:00', end: '19:00' }], breaks: [], blocks: [] };
    expect(copyWeekdaySchedule(value, '1', ['2', '3', '4', '5'])!.hours).toEqual([]);
    const large: ScheduleDraft = { ...value, hours: Array.from({ length: 30 }, (_, index) => ({ weekday: '1', start: `00:${String(index).padStart(2, '0')}`, end: '01:00' })) };
    expect(copyWeekdaySchedule(large, '1', ['2', '3', '4', '5'])).toBeNull();
    expect(large.hours).toHaveLength(30);
  });

  it('filters real menus by Korean or English name, category and visibility without mutating their order', () => {
    const menu = (id: string, nameKo: string, nameEn: string, categoryId: string, visibility: Menu['visibility'], sortOrder: number): Menu => ({ id, merchantId, categoryId, nameKo, nameEn, descriptionKo: '', descriptionEn: '', priceKrw: null, durationMinutes: null, depositKrw: null, cleanupMinutes: 0, sortOrder, visibility, updatedAt: '2026-10-20T00:00:00Z' });
    const menus = [menu('b', '커트', 'Hair Cut', 'hair', 'visible', 2), menu('a', '커트 패키지', 'Hair Cut Package', 'bundle', 'hidden', 1)];
    expect(filterPartnerMenus(menus, '  HAIR CUT ', '', 'all').map((item) => item.id)).toEqual(['a', 'b']);
    expect(filterPartnerMenus(menus, '커트', 'hair', 'visible').map((item) => item.id)).toEqual(['b']);
    expect(filterPartnerMenus(menus, '', 'bundle', 'visible')).toEqual([]);
    expect(menus.map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('distinguishes missing and unread roster schedules from a real day off', () => {
    const shop = { ...emptySchedule(), hours: [{ weekday: 1, startMinute: 600, endMinute: 1140 }] };
    const staff = { ...emptySchedule(), hours: [{ weekday: 1, startMinute: 1080, endMinute: 1200 }] };
    expect(rosterDayState(shop, undefined, '2026-10-19')).toBe('unknown');
    expect(rosterDayState(shop, null, '2026-10-19')).toBe('unset');
    expect(rosterDayState(shop, staff, '2026-10-19')).toBe('on');
    expect(rosterDayState(shop, { ...staff, hours: [{ weekday: 1, startMinute: 1140, endMinute: 1200 }] }, '2026-10-19')).toBe('off');
    expect(rosterDayState(shop, staff, '2026-10-20')).toBe('shopoff');
    expect(rosterDayState(shop, { ...staff, merchantId: '22222222-2222-4222-8222-222222222222' }, '2026-10-19')).toBe('unknown');
  });

  it('uses date overrides and blocks when displaying roster attendance', () => {
    const shop = { ...emptySchedule(), hours: [{ weekday: 1, startMinute: 600, endMinute: 1140 }] };
    const staff = { ...emptySchedule(), overrides: [{ date: '2026-10-19', hours: [{ startMinute: 600, endMinute: 660 }], breaks: [] }] };
    expect(rosterDayState(shop, staff, '2026-10-19')).toBe('on');
    expect(rosterDayState(shop, { ...staff, blocks: [{ date: '2026-10-19', startMinute: 600, endMinute: 660 }] }, '2026-10-19')).toBe('off');
    expect(rosterDayState({ ...shop, overrides: [{ date: '2026-10-19', hours: [], breaks: [] }] }, staff, '2026-10-19')).toBe('shopoff');
  });

  it('renders all seven weekdays and keeps multi-period midnight hours intact', () => {
    const $ = render(<ScheduleFields value={{ hours: [{ weekday: '1', start: '09:00', end: '12:00' }, { weekday: '1', start: '14:00', end: '24:00' }], breaks: [], blocks: [] }} disabled={false} onChange={() => {}} />);
    expect($('button[aria-label$="요일 시간 편집"]')).toHaveLength(7);
    expect($('input[aria-label="영업시간 2 종료 시간"]').val()).toBe('24:00');
    expect($.text()).toContain('월요일을 평일에 복사');
  });

  it('opens the chosen roster date in the real special-date editor, with no fabricated exception', () => {
    const $ = render(<StaffCalendarFields initialDate="2028-02-29" value={{ weekly: { hours: [], breaks: [], blocks: [] }, overrides: [] }} disabled={false} onChange={() => {}} />);
    expect($('button[aria-pressed="true"]').text()).toContain('특정 날짜');
    expect($('button[aria-label="2028-02-29"][aria-pressed="true"]')).toHaveLength(1);
    expect($('input[aria-label="특별 근무일 1 날짜"]')).toHaveLength(0);
    expect($.text()).toContain('하루 휴무 추가');
    expect($.text()).not.toContain('저장했습니다');
    const readonly = render(<DateOverridesFields initialDate="2028-02-29" value={[]} disabled onChange={() => {}} />);
    expect(readonly('button:not([disabled])')).toHaveLength(0);
  });

  it('renders editable English fields with no automatic translation or invented names', () => {
    const $ = render(<StaffEnglishFields value={{ nameEn: '', introductionEn: '' }} disabled onChange={() => {}} />);
    expect($('input[name="nameEn"]').val()).toBe('');
    expect($('textarea[name="introductionEn"]').val()).toBe('');
    expect($('fieldset[disabled]')).toHaveLength(1);
    expect($.text()).toContain('기존 이름과 소개');
  });

  it('preserves an English draft when the base profile is saved and refuses to overwrite a concurrent English edit', () => {
    const values = { name: '지우', title: '디자이너', introduction: '', visibility: 'visible' as const, sortOrder: 0, nameEn: '', introductionEn: '' };
    const baseline = { values, updatedAt: '2026-10-20T01:00:00Z' };
    const previous = { token: Symbol('english'), baseline, draft: { ...baseline, values: { ...values, nameEn: 'Jiu' } }, state: { kind: 'idle' as const } };
    const incoming = { id: merchantId, ...values, title: '실장', updatedAt: '2026-10-20T02:00:00Z' };
    const rebased = rebaseStaffEnglishDraft(previous, incoming);
    expect(rebased?.draft.values.nameEn).toBe('Jiu');
    expect(rebased?.draft.values.title).toBe('실장');
    expect(rebased?.draft.updatedAt).toBe(incoming.updatedAt);
    expect(rebased?.baseline.values.nameEn).toBe('');
    expect(rebaseStaffEnglishDraft(previous, { ...incoming, nameEn: 'Jiwoo' })).toBeNull();
    expect(rebaseStaffEnglishDraft({ ...previous, state: { kind: 'unconfirmed' } }, incoming)).toBeNull();
  });
});
