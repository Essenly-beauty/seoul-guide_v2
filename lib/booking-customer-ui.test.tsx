import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import { bookingReducer, initialBookingState, submitBooking, bookingErrorMessage, bookingStartDate, cancelBooking } from '@/components/booking/customer-booking-state';
import { BookingReview, BookingStatus } from '@/components/booking/booking-summary';
import { MyBookings, BookingDetail } from '@/components/booking/my-bookings';
import { translate } from '@/lib/i18n/core';
import { authLinkWithNext } from '@/lib/auth-return';

vi.mock('@/lib/auth/use-auth', () => ({ useAuthUser: () => ({ user: null, loading: false }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }) }));

const slot = { startAt: '2026-10-25T01:00:00.000Z', serviceEndAt: '2026-10-25T02:00:00.000Z', occupiedUntil: '2026-10-25T02:15:00.000Z', staffId: 'staff-1' };
const service = { id: 'service-1', category: 'Hair', name: 'Cut & style', description: 'Wash included', priceKrw: 60000, durationMinutes: 60, quoteVersion: 'v1' };
const staff = { id: 'staff-1', name: 'Mina', title: 'Stylist', introduction: '', serviceIds: ['service-1'] };
const body = { placeId: 'salon', serviceId: 'service-1', staffId: 'staff-1', startAt: slot.startAt, quoteVersion: 'v1', requestId: 'same-request', customerName: 'Jane', phone: '+821012345678', notes: '' };

describe('customer booking selection', () => {
  it('invalidates the selected time and request identity when service, staff or date changes', () => {
    const selected = { ...initialBookingState, serviceId: service.id, staffId: staff.id, date: '2026-10-25', slot, quoteVersion: 'v1', requestId: 'same-request' };
    for (const action of [{ type: 'service', value: 'service-2' }, { type: 'staff', value: 'staff-2' }, { type: 'date', value: '2026-10-26' }, { type: 'configuration' }] as const) {
      const next = bookingReducer(selected, action);
      expect(next.slot).toBeNull(); expect(next.requestId).toBeNull(); expect(next.quoteVersion).toBe('');
    }
  });
  it('keeps the same request identity after a failed submission and resets after customer edits', () => {
    const selected = { ...initialBookingState, slot, requestId: 'same-request' };
    expect(bookingReducer(selected, { type: 'error', value: 'NETWORK_ERROR' }).requestId).toBe('same-request');
    expect(bookingReducer(selected, { type: 'customer', field: 'phone', value: '+819012345678' }).requestId).toBeNull();
  });
});

describe('customer booking submission', () => {
  it('returns only a booking persisted by the server and sends the selected staff and stable request id', async () => {
    const booking = { id: '12345678-1234-4123-8123-123456789012', placeId: 'salon', merchantName: 'Salon', serviceName: 'Cut', staffName: 'Mina', startAt: slot.startAt, serviceEndAt: slot.serviceEndAt, totalKrw: 60000, status: 'requested', paymentMode: 'pay_at_venue', customerName: 'Jane', phone: '+821012345678', notes: '', createdAt: '2026-10-20T00:00:00Z', updatedAt: '2026-10-20T00:00:00Z', cancelledBy: null };
    const transport = vi.fn(async () => new Response(JSON.stringify({ booking }), { status: 201 }));
    expect(await submitBooking(body, transport)).toEqual(booking);
    expect(transport).toHaveBeenCalledWith('/api/bookings', expect.objectContaining({ method: 'POST', body: JSON.stringify(body) }));
  });
  it('surfaces server conflicts and authentication failures instead of returning success', async () => {
    for (const error of ['AUTH_REQUIRED', 'SLOT_UNAVAILABLE', 'STALE_SELECTION', 'BOOKING_CONFLICT']) {
      await expect(submitBooking(body, async () => new Response(JSON.stringify({ error }), { status: 409 }))).rejects.toThrow(error);
      expect(bookingErrorMessage(error)).not.toBe(error);
    }
  });
  it('reads machine error codes without displaying server-only human messages', async () => {
    await expect(submitBooking(body, async () => new Response(JSON.stringify({ code: 'AUTH_REQUIRED', error: '서버 안내' }), { status: 401 }))).rejects.toThrow('AUTH_REQUIRED');
  });
  it('does not accept a fabricated success payload without a complete persisted booking', async () => {
    await expect(submitBooking(body, async () => new Response(JSON.stringify({ booking: { id: 'fake', status: 'confirmed' } }), { status: 200 }))).rejects.toThrow('NETWORK_ERROR');
  });
  it('uses an internal return destination when login is required', () => {
    expect(authLinkWithNext('/login', '/place/salon/book?service=service-1')).toBe('/login?next=%2Fplace%2Fsalon%2Fbook%3Fservice%3Dservice-1');
  });
});

describe('customer booking review', () => {
  it('shows the exact staff, full price, Seoul time and pay-at-venue policy before submission', () => {
    const $ = load(renderToStaticMarkup(<BookingReview merchantName="Salon" service={service} staff={staff} slot={slot} mode="request" paymentMode="pay_at_venue" />));
    expect($.text()).toContain('Mina'); expect($.text()).toContain('60,000'); expect($.text()).toContain('10:00'); expect($.text()).toContain('Pay at the venue'); expect($.text()).toContain('The venue will confirm your request.');
    expect($.text()).not.toMatch(/deposit|paid|charged|stripe/i);
    expect($.text()).toContain('Cancel before your visit in My bookings.');
  });
  it('clearly distinguishes an awaiting-confirmation request from a confirmed booking', () => {
    expect(renderToStaticMarkup(<BookingStatus status="requested" />)).toContain('Awaiting confirmation');
    expect(renderToStaticMarkup(<BookingStatus status="confirmed" />)).toContain('Confirmed');
  });
});

describe('booking dates and cancellation', () => {
  it('clamps an ongoing booking window to today in Seoul across the UTC date boundary', () => {
    const now = new Date('2026-10-20T18:00:00Z');
    expect(bookingStartDate('2026-10-01', now)).toBe('2026-10-21');
    expect(bookingStartDate('2026-10-25', now)).toBe('2026-10-25');
  });
  it('never reports cancellation success from a server conflict', async () => {
    const transport = vi.fn(async () => new Response(JSON.stringify({ code: 'BOOKING_CONFLICT', error: 'changed' }), { status: 409 }));
    await expect(cancelBooking('12345678-1234-4123-8123-123456789012', transport)).rejects.toThrow('BOOKING_CONFLICT');
    expect(transport).toHaveBeenCalledWith('/api/bookings/12345678-1234-4123-8123-123456789012', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ action: 'cancel' }) }));
  });
});

describe('guest booking access and localization', () => {
  it('asks guests to sign in with the exact booking screen as their return path', () => {
    const list = load(renderToStaticMarkup(<MyBookings />));
    expect(list('a[href="/login?next=%2Fbookings"]')).toHaveLength(1);
    expect(list.text()).toContain('Sign in to view and manage your appointments.');
    const detail = load(renderToStaticMarkup(<BookingDetail id="12345678-1234-4123-8123-123456789012" />));
    expect(detail('a[href="/login?next=%2Fbookings%2F12345678-1234-4123-8123-123456789012"]')).toHaveLength(1);
    expect(detail.text()).not.toContain('Cancel booking');
  });
  it('translates booking actions and server errors in every supported customer language', () => {
    for (const locale of ['ja', 'zh-CN', 'es', 'fr'] as const) {
      for (const message of ['My bookings', 'Book a visit', 'Awaiting confirmation', 'Cancel before your visit in My bookings.', ...['AUTH_REQUIRED', 'SLOT_UNAVAILABLE', 'STALE_SELECTION', 'BOOKING_CONFLICT'].map(bookingErrorMessage)]) {
        expect(translate(locale, message)).not.toBe(message);
      }
    }
  });
});
