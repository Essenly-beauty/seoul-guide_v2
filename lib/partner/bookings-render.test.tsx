import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import { describe, expect, it, vi } from 'vitest';
import { changePartnerBooking, filterPartnerBookings, PartnerBookingList, partnerBookingActions, partnerBookingError } from '@/components/partner/partner-bookings';
import type { Booking, BookingStatus } from '@/lib/booking/contracts';

const booking: Booking = {
  id: '11111111-1111-4111-8111-111111111111', placeId: 'seoul-salon', merchantName: '서울 살롱',
  serviceName: 'Haircut', staffName: '민지', startAt: '2026-10-20T01:00:00Z', serviceEndAt: '2026-10-20T02:00:00Z',
  totalKrw: 45000, status: 'requested', paymentMode: 'pay_at_venue', customerName: 'Jamie', phone: '+82 10-1234-5678', notes: 'Please keep my fringe.\nThank you.',
  createdAt: '2026-10-19T12:00:00Z', updatedAt: '2026-10-19T12:00:00.123456Z', cancelledBy: null,
};
const render = (props: Partial<Parameters<typeof PartnerBookingList>[0]> = {}) => load(renderToStaticMarkup(<PartnerBookingList bookings={[booking]} loading={false} filtered={false} disabled={false} busyId={null} now={Date.parse('2026-10-20T03:00:00Z')} onAction={() => {}} {...props} />));

describe('partner booking management', () => {
  it('shows the customer, service, staff, Korean local time, exact amount and contact details', () => {
    const $ = render();
    for (const text of ['Jamie', 'Haircut', '민지', '10:00', '11:00', '45,000원', '현장 결제', '확인 대기', 'Please keep my fringe.']) expect($.text()).toContain(text);
    expect($('a[href="tel:+821012345678"]').text()).toBe(booking.phone);
    expect($('details summary').text()).toContain('고객 연락처와 예약 상세');
    expect($('button').map((_, el) => $(el).text()).get()).toEqual(['예약 확정', '예약 취소']);
    expect($.text()).not.toContain('결제 완료');
  });

  it.each(['customer', 'merchant'] as const)('shows cancellation origin %s and no further action', (cancelledBy) => {
    const $ = render({ bookings: [{ ...booking, status: 'cancelled', cancelledBy }] });
    expect($.text()).toContain(cancelledBy === 'customer' ? '고객이 취소한 예약' : '매장에서 취소한 예약');
    expect($('button').length).toBe(0);
  });

  it('distinguishes unreceived data, loading, an empty shop and empty filters', () => {
    expect(render({ bookings: null, loading: true }).text()).toContain('불러오는 중');
    expect(render({ bookings: null }).text()).toContain('불러오지 못했습니다');
    expect(render({ bookings: [] }).text()).toContain('아직 접수된 예약이 없습니다');
    expect(render({ bookings: [], filtered: true }).text()).toContain('선택한 날짜와 상태');
  });

  it('disables every status change for read-only/stale views and while a mutation is pending', () => {
    expect(render({ disabled: true })('button:not([disabled])').length).toBe(0);
    const pending = render({ busyId: booking.id });
    expect(pending('button:not([disabled])').length).toBe(0);
    expect(pending('button').text()).toContain('처리 중');
  });

  it('escapes customer and request text', () => {
    const $ = render({ bookings: [{ ...booking, customerName: '<script>bad</script>', notes: '<img src=x onerror=bad()>' }] });
    expect($('script,img').length).toBe(0);
    expect($.text()).toContain('<script>bad</script>');
  });

  it('shows removed customer contact details without a blank telephone link', () => {
    const $ = render({ bookings: [{ ...booking, customerName: 'Deleted customer', phone: '', notes: '' }] });
    expect($.text()).toContain('연락처 없음');
    expect($('a[href^="tel:"]').length).toBe(0);
  });

  it('allows completion and no-show only after a confirmed reservation starts', () => {
    const start = Date.parse(booking.startAt);
    expect(partnerBookingActions(booking, start)).toEqual(['confirm', 'cancel']);
    expect(partnerBookingActions({ ...booking, status: 'confirmed' }, start - 1)).toEqual(['cancel']);
    expect(partnerBookingActions({ ...booking, status: 'confirmed' }, start)).toEqual(['complete', 'no_show', 'cancel']);
    for (const status of ['cancelled', 'completed', 'no_show'] as BookingStatus[]) expect(partnerBookingActions({ ...booking, status }, start)).toEqual([]);
  });

  it('filters by Korean calendar date and status, regardless of the browser time zone', () => {
    const midnight: Booking = { ...booking, id: '22222222-2222-4222-8222-222222222222', startAt: '2026-10-19T15:00:00Z', serviceEndAt: '2026-10-19T16:00:00Z', status: 'confirmed' };
    expect(filterPartnerBookings([booking, midnight], '2026-10-20', '2026-10-20', 'all').map((item) => item.id)).toEqual([midnight.id, booking.id]);
    expect(filterPartnerBookings([booking, midnight], '2026-10-19', '2026-10-19', 'all')).toEqual([]);
    expect(filterPartnerBookings([booking, midnight], '', '', 'confirmed')).toEqual([midnight]);
  });

  it('sends the exact saved version and accepts only the acknowledged reservation', async () => {
    const confirmed: Booking = { ...booking, status: 'confirmed', updatedAt: '2026-10-20T00:00:00Z' };
    const request = vi.fn(async () => new Response(JSON.stringify({ booking: confirmed })));
    const signal = new AbortController().signal;
    expect(await changePartnerBooking(booking, 'confirm', signal, request)).toEqual({ kind: 'saved', booking: confirmed });
    expect(request).toHaveBeenCalledWith(`/api/partner/bookings/${booking.id}`, expect.objectContaining({ method: 'PATCH', credentials: 'same-origin', signal, body: JSON.stringify({ action: 'confirm', expectedUpdatedAt: booking.updatedAt }) }));
    expect(booking.status).toBe('requested');
  });

  it.each(['BOOKING_CONFLICT', 'PARTNER_READ_ONLY', 'PARTNER_FORBIDDEN', 'AUTH_REQUIRED', 'SERVICE_UNAVAILABLE'])('preserves server refusal %s without claiming a successful change', async (code) => {
    const result = await changePartnerBooking(booking, 'confirm', new AbortController().signal, async () => new Response(JSON.stringify({ code, error: '예약 요청을 처리할 수 없습니다.' }), { status: code === 'BOOKING_CONFLICT' ? 409 : 403 }));
    expect(result).toEqual({ kind: 'rejected', code });
    expect(partnerBookingError(code)).not.toContain('변경했습니다');
    expect(booking.status).toBe('requested');
  });

  it.each([
    {}, { booking }, { booking: { ...booking, status: 'confirmed', id: '22222222-2222-4222-8222-222222222222' } },
    { booking: { ...booking, status: 'confirmed', placeId: 'another-shop' } },
  ])('does not acknowledge a malformed, unrelated or untransitioned success response %#', async (body) => {
    expect(await changePartnerBooking(booking, 'confirm', new AbortController().signal, async () => new Response(JSON.stringify(body)))).toEqual({ kind: 'unconfirmed' });
  });

  it('treats a lost response as unconfirmed instead of retrying the mutation', async () => {
    const request = vi.fn(async () => { throw new Error('response lost'); });
    expect(await changePartnerBooking(booking, 'confirm', new AbortController().signal, request)).toEqual({ kind: 'unconfirmed' });
    expect(request).toHaveBeenCalledTimes(1);
  });
});
