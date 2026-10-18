import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';
import { PartnerDashboardView } from '@/components/partner/partner-dashboard';
import { CategoryFields, MenuFields } from '@/components/partner/partner-services';
import { ScheduleFields } from '@/components/partner/partner-availability';
import { PartnerSettingsView } from '@/components/partner/partner-settings';
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
  it('renders category fields with labels', () => {
    const category = render(<CategoryFields value={{ nameKo: '', nameEn: '', visibility: 'draft', sortOrder: '0' }} onChange={() => {}} disabled />);
    expect(category('fieldset[disabled]').length).toBe(1);
    expect(category('label').text()).toContain('카테고리명 (영어)');
  });
  it('shows a semantic read-only profile with actual values, ownership and support', () => {
    const $ = render(<PartnerSettingsView snapshot={{ ...snapshot, merchant: { ...snapshot.merchant, displayName: '<script>shop</script>', contactEmail: 'owner@example.test', contactPhone: '02-1234-5678', address: '서울시 강남구', businessTypes: ['hair', 'hair', 'nail', 'head_spa'] } }} />);
    expect($('h1').text()).toBe('매장 정보');
    for (const value of ['<script>shop</script>', 'owner@example.test', '02-1234-5678', '서울시 강남구', '헤어 · 네일 · 헤드스파', '입점 준비 중', '예약 기능 연결 전']) expect($('dd').text()).toContain(value);
    expect($('script').length).toBe(0);
    expect($('dt').text()).toContain('상호명');
    expect($.text()).toMatch(/매장 정보와 사진.*운영자/);
    expect($('a[href="/support"]').text()).toContain('매장 정보 수정 요청 →');
    expect($('form,input,select,textarea,button').length).toBe(0);
    expect($.text()).toContain('예약금');
    expect($.text()).toContain('계정 삭제');
  });
  it('marks blank profile values unregistered and describes booking approval honestly', () => {
    const $ = render(<PartnerSettingsView snapshot={{ ...snapshot, merchant: { ...snapshot.merchant, displayName: ' ', businessTypes: [], bookingEnabled: true, status: 'active' } }} />);
    expect($('dd').filter((_, node) => $(node).text() === '미등록').length).toBe(5);
    expect($.text()).toContain('고객 예약·결제 연결은 별도 확인 필요');
    expect($('form,input,select,textarea,button').length).toBe(0);
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
