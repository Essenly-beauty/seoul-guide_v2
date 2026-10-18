import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';
import { PartnerDashboardView } from '@/components/partner/partner-dashboard';
import { CategoryFields, MenuFields } from '@/components/partner/partner-services';
import { ScheduleFields } from '@/components/partner/partner-availability';
import { SettingsFields } from '@/components/partner/partner-settings';
import { SaveStatus } from '@/components/partner/partner-form';
import type { PartnerSnapshot } from './contracts';

const snapshot: PartnerSnapshot = {
  merchant: { id: '11111111-1111-4111-8111-111111111111', displayName: '서울 살롱', contactEmail: '', contactPhone: '', address: '', businessTypes: ['hair'], status: 'onboarding', bookingEnabled: false, updatedAt: '2026-10-18T00:00:00.123456+00:00' },
  categories: [], menus: [], schedule: null, readOnly: false, loadedAt: '2026-10-18T00:00:00Z',
};
const render = (element: React.ReactElement) => load(renderToStaticMarkup(element));
describe('merchant admin actual markup', () => {
  it('shows real setup data without fabricated revenue or booking metrics', () => {
    const $ = render(<PartnerDashboardView snapshot={snapshot} />);
    expect($('h1').text()).toContain('서울 살롱');
    expect($.text()).toContain('예약 기능 연결 전');
    expect($.text()).toContain('등록된 메뉴 0개');
    expect($.text()).toContain('입점 준비 중');
    expect($.text()).not.toMatch(/매출|오늘 예약|예약 0건/);
    expect($('a[href="/partner/services"]').length).toBeGreaterThan(0);
  });
  it('uses optional draft fields, explicit visibility and read-only approved deposit', () => {
    const $ = render(<MenuFields value={{ categoryId: '', nameKo: '', nameEn: '', descriptionKo: '', descriptionEn: '', priceKrw: '', durationMinutes: '', cleanupMinutes: '0', visibility: 'draft', sortOrder: '0' }} onChange={() => {}} categories={[]} depositKrw={null} disabled />);
    expect($.text()).toContain('운영자 승인 대기');
    expect($.text()).toContain('공개 준비 (예약 연결 후 적용)');
    expect($('input[name="depositKrw"]').length).toBe(0);
    expect($('[required]').length).toBe(0);
    expect($('fieldset[disabled]').length).toBe(1);
    for (const label of ['메뉴명 (한국어)', '총 금액 (원)', '시술 시간 (분)', '정리 시간 (분)']) expect($('label').text()).toContain(label);
  });
  it('renders category and business settings with labelled fields and protected status', () => {
    const category = render(<CategoryFields value={{ nameKo: '', nameEn: '', visibility: 'draft', sortOrder: '0' }} onChange={() => {}} disabled />);
    expect(category('fieldset[disabled]').length).toBe(1);
    expect(category('label').text()).toContain('카테고리명 (영어)');
    const settings = render(<SettingsFields value={snapshot.merchant} onChange={() => {}} disabled />);
    expect(settings('input[type="checkbox"]').length).toBe(3);
    expect(settings('input[name="bookingEnabled"]').length).toBe(0);
    expect(settings('fieldset[disabled]').length).toBe(1);
  });
  it('labels every schedule row and disables add/remove in read-only mode', () => {
    const $ = render(<ScheduleFields value={{ hours: [{ weekday: '1', start: '09:00', end: '18:00' }], breaks: [], blocks: [{ date: '', start: '00:00', end: '24:00' }] }} onChange={() => {}} disabled />);
    expect($.text()).toContain('Asia/Seoul');
    expect($.text()).toContain('128');
    expect($.text()).toContain('512');
    expect($('input[aria-label="영업시간 1 시작 시간"]').length).toBe(1);
    expect($('input[aria-label="날짜별 휴무 1 날짜"]').length).toBe(1);
    expect($('button:not([disabled])').length).toBe(0);
  });
  it('distinguishes committed data from a failed reload and exposes conflict recovery', () => {
    const stale = render(<SaveStatus state={{ kind: 'committed-stale' }} onReload={() => {}} />);
    expect(stale('[role="status"]').text()).toContain('저장은 완료됐지만 최신 정보 조회 실패');
    const conflict = render(<SaveStatus state={{ kind: 'conflict', message: '다른 곳에서 변경되었습니다.' }} onReload={() => {}} />);
    expect(conflict('button').text()).toContain('변경사항 버리고 다시 불러오기');
  });
  it('announces a reload without claiming that a new save is in progress', () => {
    const $ = render(<SaveStatus state={{ kind: 'reloading' }} onReload={() => {}} />);
    expect($('[role="status"]').text()).toContain('최신 정보를 불러오는 중');
    expect($.text()).not.toContain('저장 중');
  });
});
