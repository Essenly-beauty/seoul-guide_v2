import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import type { PartnerBooking } from '@/lib/booking/partner-contracts';
import { PartnerDashboardView } from '@/components/partner/partner-dashboard';
import type { PartnerSnapshot, Schedule } from './contracts';
import type { StaffCalendar, StaffSummary } from './staff-server';
import { dashboardWeekBookings, staffDailyUtilization, utilizationTimeLabel } from './dashboard-utilization';

const merchantId = '11111111-1111-4111-8111-111111111111';
const staffId = '22222222-2222-4222-8222-222222222222';
const otherId = '33333333-3333-4333-8333-333333333333';
const date = '2026-10-20', updatedAt = '2026-10-19T00:00:00Z';
const period = (startMinute: number, endMinute: number) => ({ weekday: 2, startMinute, endMinute });
const shopSchedule: Schedule = { merchantId, hours: [period(540, 1080)], breaks: [period(720, 780)], blocks: [{ date, startMinute: 840, endMinute: 870 }], updatedAt };
const staffSchedule: StaffCalendar = { merchantId, staffId, hours: [period(600, 1140)], breaks: [period(900, 960)], blocks: [{ date, startMinute: 630, endMinute: 660 }], overrides: [], updatedAt };
const staff: StaffSummary = { id: staffId, merchantId, name: '실제 담당자', title: '디자이너', introduction: '', visibility: 'visible', sortOrder: 0, updatedAt };
const snapshot: PartnerSnapshot = { merchant: { id: merchantId, displayName: '실제 매장', contactPhone: '', contactEmail: '', address: '', businessTypes: ['hair'], status: 'active', bookingEnabled: true, updatedAt }, categories: [], menus: [], schedule: shopSchedule, reservationRules: { merchantId, mode: 'staff', capacity: 2, startDate: date, endDate: '2026-11-20', slotIntervalMinutes: 30, minimumLeadMinutes: 0, updatedAt }, dateOverrides: [], readOnly: false, loadedAt: updatedAt };
const booking = (id: string, changes: Partial<PartnerBooking> = {}): PartnerBooking => ({ id, placeId: 'studio', merchantName: '실제 매장', serviceName: 'Cut', staffName: staff.name, staffId, serviceId: otherId, customerId: otherId, startAt: `${date}T10:00:00+09:00`, serviceEndAt: `${date}T11:00:00+09:00`, occupiedUntil: `${date}T11:15:00+09:00`, source: 'app', totalKrw: 60000, status: 'confirmed', paymentMode: 'pay_at_venue', customerName: 'Local test', phone: '', notes: '', createdAt: updatedAt, updatedAt, cancelledBy: null, cancelReason: '', ...changes });
const input = { date, merchantId, staffId, shopSchedule, shopOverrides: [], staffSchedule, bookings: [] as PartnerBooking[] };

describe('actual staff utilization', () => {
  it('intersects store and staff hours after both sets of breaks and blocks', () => {
    const result = staffDailyUtilization(input);
    expect(result.intervals).toEqual([{ startMinute: 600, endMinute: 630 }, { startMinute: 660, endMinute: 720 }, { startMinute: 780, endMinute: 840 }, { startMinute: 870, endMinute: 900 }, { startMinute: 960, endMinute: 1080 }]);
    expect(result).toMatchObject({ availableMinutes: 300, occupiedMinutes: 0, bookingCount: 0, percentage: 0, scheduleState: 'ready' });
    expect(utilizationTimeLabel(result.intervals!)).toBe('10:00–10:30 / 11:00–12:00 / 13:00–14:00 / 14:30–15:00 / 16:00–18:00');
  });
  it('uses date exceptions instead of weekly hours, while retaining date blocks', () => {
    const result = staffDailyUtilization({ ...input, shopOverrides: [{ date, hours: [{ startMinute: 780, endMinute: 1080 }], breaks: [] }], staffSchedule: { ...staffSchedule, overrides: [{ date, hours: [{ startMinute: 840, endMinute: 1020 }], breaks: [{ startMinute: 900, endMinute: 930 }] }] } });
    expect(result.intervals).toEqual([{ startMinute: 870, endMinute: 900 }, { startMinute: 930, endMinute: 1020 }]);
    expect(result.availableMinutes).toBe(120);
  });
  it('unions overlapping bookings including cleanup, clips unavailable time and excludes cancellations', () => {
    const rows = [booking('a'), booking('b', { startAt: `${date}T11:00:00+09:00`, serviceEndAt: `${date}T12:00:00+09:00`, occupiedUntil: `${date}T12:15:00+09:00` }), booking('cancelled', { startAt: `${date}T13:00:00+09:00`, serviceEndAt: `${date}T14:00:00+09:00`, occupiedUntil: `${date}T14:15:00+09:00`, status: 'cancelled' }), booking('foreign-staff', { staffId: otherId })];
    const result = staffDailyUtilization({ ...input, bookings: rows });
    expect(result).toMatchObject({ bookingCount: 2, occupiedMinutes: 90, availableMinutes: 300, percentage: 30 });
  });
  it('includes cleanup and treats adjacent reservations as one continuous interval without inflation', () => {
    const schedule = { ...shopSchedule, hours: [period(600, 720)], breaks: [], blocks: [] };
    const result = staffDailyUtilization({ ...input, shopSchedule: schedule, staffSchedule: { ...staffSchedule, ...schedule }, bookings: [booking('a'), booking('b', { startAt: `${date}T11:15:00+09:00`, serviceEndAt: `${date}T11:45:00+09:00`, occupiedUntil: `${date}T12:00:00+09:00` })] });
    expect(result).toMatchObject({ occupiedMinutes: 120, percentage: 100, bookingCount: 2 });
  });
  it('keeps unknown bookings and schedules unknown instead of fabricating zero utilization', () => {
    expect(staffDailyUtilization({ ...input, bookings: null })).toMatchObject({ availableMinutes: 300, bookingCount: null, occupiedMinutes: null, percentage: null });
    expect(staffDailyUtilization({ ...input, staffSchedule: undefined })).toMatchObject({ scheduleState: 'unknown', availableMinutes: null, percentage: null });
    expect(staffDailyUtilization({ ...input, staffSchedule: null })).toMatchObject({ scheduleState: 'missing', availableMinutes: null, percentage: null });
    expect(staffDailyUtilization({ ...input, shopSchedule: null })).toMatchObject({ scheduleState: 'missing', percentage: null });
  });
  it('distinguishes a real closure from missing data and keeps real booking counts visible', () => {
    const result = staffDailyUtilization({ ...input, shopOverrides: [{ date, hours: [], breaks: [] }], bookings: [booking('a')] });
    expect(result).toMatchObject({ scheduleState: 'closed', intervals: [], availableMinutes: 0, occupiedMinutes: 0, bookingCount: 1, percentage: null });
  });
  it('refuses foreign staff/merchant schedules rather than reporting a believable percentage', () => {
    expect(staffDailyUtilization({ ...input, staffSchedule: { ...staffSchedule, staffId: otherId } }).scheduleState).toBe('unknown');
    expect(staffDailyUtilization({ ...input, staffSchedule: { ...staffSchedule, merchantId: otherId } }).scheduleState).toBe('unknown');
    expect(staffDailyUtilization({ ...input, shopSchedule: { ...shopSchedule, merchantId: otherId } }).scheduleState).toBe('unknown');
  });
  it('counts visits on the KST start date while carrying prior-day cleanup into today', () => {
    const schedule = { ...shopSchedule, hours: [period(0, 60)], breaks: [], blocks: [] };
    const result = staffDailyUtilization({ ...input, shopSchedule: schedule, staffSchedule: { ...staffSchedule, ...schedule }, bookings: [booking('prior', { startAt: '2026-10-19T14:30:00Z', serviceEndAt: '2026-10-19T15:00:00Z', occupiedUntil: '2026-10-19T15:15:00Z' })] });
    expect(result).toMatchObject({ bookingCount: 0, occupiedMinutes: 15, percentage: 25 });
  });
  it('does not mutate schedule or booking arrays while merging intervals', () => {
    const rows = Object.freeze([Object.freeze(booking('b')), Object.freeze(booking('a'))]);
    const before = JSON.stringify(input);
    expect(staffDailyUtilization({ ...input, bookings: rows }).occupiedMinutes).toBe(45);
    expect(JSON.stringify(input)).toBe(before); expect(rows.map(item => item.id)).toEqual(['b', 'a']);
  });
});

describe('weekly booking sources and dashboard presentation', () => {
  it('splits actual sources and compares complete adjacent Monday weeks across a year boundary', () => {
    const rows = [booking('app', { startAt: '2026-12-27T15:00:00Z' }), booking('phone', { source: 'phone', startAt: '2026-12-28T03:00:00Z' }), booking('walkin', { source: 'walkin', startAt: '2027-01-03T14:59:00Z' }), booking('cancelled', { status: 'cancelled', startAt: '2026-12-28T04:00:00Z' }), booking('previous', { startAt: '2026-12-27T14:59:00Z' }), booking('outside', { startAt: '2027-01-03T15:00:00Z' })];
    const week = dashboardWeekBookings(rows, '2027-01-01');
    expect(week).toMatchObject({ total: 3, previousTotal: 1 });
    expect(week?.days[0]).toEqual({ date: '2026-12-28', app: 1, other: 1, total: 2 });
    expect(week?.days[6]).toEqual({ date: '2027-01-03', app: 0, other: 1, total: 1 });
    expect(dashboardWeekBookings(null, date)).toBeNull();
  });
  it('renders actual names, available windows, counts and accessible utilization meters', () => {
    const $ = load(renderToStaticMarkup(<PartnerDashboardView snapshot={snapshot} bookings={[booking('a')]} staff={[staff]} staffCalendars={{ [staffId]: staffSchedule }} now={Date.parse(`${date}T12:00:00+09:00`)} />));
    expect($('#staff-today-heading').text()).toBe('디자이너별 오늘'); expect($('.util').text()).toContain(staff.name);
    expect($('.util').text()).toContain('가용 300분'); expect($('.util').text()).toContain('1건 · 15%');
    expect($('.util [role=meter]').attr('aria-valuenow')).toBe('15');
    expect($('.s-app').length).toBe(7); expect($('.s-other').length).toBe(7); expect($.text()).toContain('1건 · 지난주 0건');
  });
  it('offers retry for unread data, and shows shop mode without invented designer figures', () => {
    const unknown = load(renderToStaticMarkup(<PartnerDashboardView snapshot={snapshot} staffFailed onRefreshStaff={() => {}} />));
    expect(unknown.text()).toContain('담당자 일정을 불러오지 못했습니다.'); expect(unknown.text()).toContain('다시 조회'); expect(unknown('[role=meter]').length).toBe(0);
    const shop = load(renderToStaticMarkup(<PartnerDashboardView snapshot={{ ...snapshot, reservationRules: { ...snapshot.reservationRules!, mode: 'shop' } }} bookings={[]} />));
    expect(shop.text()).toContain('매장 예약형이라 디자이너별 집계가 없어요. 오늘 예약 0건 · 동시 예약 수 2건');
    expect(shop('[role=meter]').length).toBe(0);
  });
});
