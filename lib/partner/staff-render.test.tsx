import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';
import { StaffCalendarFields, StaffListView, StaffMenuAssignments, StaffModeNotice, StaffProfileFields } from '@/components/partner/partner-staff';
import { staffCalendarDraft, staffProfileDraft } from './staff-form-values';
import type { StaffSummary } from './staff-server';
import type { PartnerSnapshot } from './contracts';

const merchantId = '11111111-1111-4111-8111-111111111111';
const staffId = '22222222-2222-4222-8222-222222222222';
const snapshot: PartnerSnapshot = {
  merchant: { id: merchantId, displayName: '서울 살롱', contactEmail: '', contactPhone: '', address: '', businessTypes: ['hair'], status: 'active', bookingEnabled: false, updatedAt: '2026-10-18T00:00:00Z' },
  categories: [], menus: [], schedule: null, reservationRules: null, dateOverrides: [], readOnly: false, loadedAt: '2026-10-18T00:00:00Z',
};
const render = (element: React.ReactElement) => load(renderToStaticMarkup(element));

describe('staff editor visible states', () => {
  it('shows a truthful optional empty list and does not imply booking is active', () => {
    const $ = render(<><StaffModeNotice snapshot={snapshot} eligibleCount={0} /><StaffListView staff={[]} selectedId={null} loading={false} stale={false} onSelect={() => {}} /></>);
    expect($.text()).toContain('담당자 등록은 선택');
    expect($.text()).toContain('예약 방식을 아직 설정하지 않았습니다');
    expect($.text()).toContain('아직 등록된 담당자가 없습니다');
    expect($.text()).toContain('고객 예약은 아직 시작되지 않았습니다');
    expect($.text()).not.toMatch(/샘플|오늘 예약|매출/);
  });

  it('explains staff mode with no eligible linked public staff and distinguishes stale data', () => {
    const staff: StaffSummary[] = [{ id: staffId, merchantId, name: '민지', title: '', introduction: '', visibility: 'draft', sortOrder: 0, updatedAt: '2026-10-18T00:00:00Z' }];
    const $ = render(<><StaffModeNotice snapshot={{ ...snapshot, reservationRules: { merchantId, mode: 'staff', capacity: 1, startDate: '2026-11-01', endDate: '2026-12-01', minimumLeadMinutes: 60, slotIntervalMinutes: 30, updatedAt: '2026-10-18T00:00:00Z' } }} eligibleCount={0} /><StaffListView staff={staff} selectedId={staffId} loading={false} stale onSelect={() => {}} /></>);
    expect($.text()).toContain('공개 준비된 담당자와 제공 메뉴 연결이 없으면');
    expect($.text()).toContain('마지막으로 조회한 담당자');
    expect($('button[aria-current="true"]').length).toBe(1);
  });

  it('renders labeled profile, menu assignment and calendar controls, disabled when read-only', () => {
    const profile = render(<StaffProfileFields value={staffProfileDraft()} onChange={() => {}} disabled />);
    expect(profile('input[name="name"]').length).toBe(1);
    expect(profile('textarea[name="introduction"]').length).toBe(1);
    expect(profile('select[name="visibility"] option[value="archived"]').length).toBe(1);
    expect(profile('fieldset[disabled]').length).toBe(1);
    const menu = render(<StaffMenuAssignments menus={[]} menuIds={[]} busy={false} disabled onToggle={() => {}} />);
    expect(menu.text()).toContain('연결 가능한 메뉴가 없습니다');
    expect(menu('button').length).toBe(0);
    const calendar = render(<StaffCalendarFields value={staffCalendarDraft(null)} onChange={() => {}} disabled />);
    expect(calendar.text()).toContain('주간 근무');
    expect(calendar.text()).toContain('특별 날짜');
    expect(calendar('fieldset[disabled]').length).toBe(2);
  });

  it('calls staff special dates and accessible time controls 근무 rather than 영업', () => {
    const draft = staffCalendarDraft(null);
    draft.overrides.push({ date: '2026-11-05', closed: false, hours: [{ start: '09:00', end: '18:00' }], breaks: [] });
    const $ = render(<StaffCalendarFields value={draft} onChange={() => {}} disabled={false} />);
    expect($('fieldset legend').text()).toContain('특별 근무일과 휴무');
    expect($('section[aria-label="특별 근무일 1"]').length).toBe(1);
    expect($('input[aria-label="특별 근무일 1 날짜"]').length).toBe(1);
    expect($('input[aria-label="특별 근무일 1 근무 시작 시간 1"]').length).toBe(1);
    expect($('button[aria-label="특별 근무일 1 근무시간 1 삭제"]').length).toBe(1);
    expect($.text()).not.toContain('특별 영업');
  });
});
