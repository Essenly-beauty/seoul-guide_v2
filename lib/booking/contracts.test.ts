import { describe, expect, it } from 'vitest';
import {
  booking, bookingAvailability, bookingCatalog, bookingCreateInput, bookingCustomerTransition,
  bookingDate, bookingList, bookingPartnerTransition, bookingTimestamp, parseBookingAvailabilityQuery,
} from './contracts';

const id = '11111111-1111-4111-8111-111111111111';
const service = { id, category: 'Hair', name: 'Cut', description: '', priceKrw: 30000, durationMinutes: 60, quoteVersion: 'quote' };
const catalog = { status: 'available', placeId: 'known', merchantName: 'Salon', mode: 'request', paymentMode: 'pay_at_venue', startDate: '2026-10-20', endDate: '2026-12-31', services: [service], staff: [], selectionMode: 'shop' };
const slot = { startAt: '2026-10-21T10:00:00+09:00', serviceEndAt: '2026-10-21T11:00:00+09:00', occupiedUntil: '2026-10-21T11:15:00+09:00', staffId: null };
const saved = { id, placeId: 'known', merchantName: 'Salon', serviceName: 'Cut', staffName: null, startAt: slot.startAt, serviceEndAt: slot.serviceEndAt, totalKrw: 30000, status: 'requested', paymentMode: 'pay_at_venue', customerName: 'Customer', phone: '+82 10 1234 5678', notes: '', createdAt: '2026-10-20T10:00:00Z', updatedAt: '2026-10-20T10:00:00Z', cancelledBy: null };
const input = { placeId: 'known', serviceId: id, staffId: null, startAt: slot.startAt, quoteVersion: 'quote', requestId: id, customerName: 'Customer', phone: '+82 10 1234 5678', notes: '' };

describe('booking boundary contracts', () => {
  it('accepts the complete supported wire shapes', () => {
    expect(bookingCatalog(catalog)).toBe(true);
    expect(bookingCatalog({ status: 'unavailable', placeId: 'known' })).toBe(true);
    expect(bookingAvailability({ slots: [slot], quoteVersion: 'quote' })).toBe(true);
    expect(booking(saved)).toBe(true);
    expect(bookingList([saved])).toBe(true);
    expect(bookingCreateInput(input)).toBe(true);
  });
  it.each(['2026-02-29', '2026-02-30', '0000-01-01', '2026-13-01', '26-01-01'])('rejects invalid date %s', (value) => {
    expect(bookingDate(value)).toBe(false);
    expect(bookingTimestamp(`${value}T10:00:00Z`)).toBe(false);
  });
  it.each(['2026-10-20T24:00:00Z', '2026-10-20T23:00:60Z', '2026-10-20T10:00:00+09:99', '2026-10-20', '2026-10-20T10:00:00'])('rejects invalid timestamp %s', (value) => {
    expect(bookingTimestamp(value)).toBe(false);
    expect(bookingCreateInput({ ...input, startAt: value })).toBe(false);
  });
  it('accepts valid leap days and preserves microseconds', () => {
    expect(bookingDate('2028-02-29')).toBe(true);
    expect(bookingTimestamp('2026-10-20T10:00:00.123456+00:00')).toBe(true);
  });
  it('rejects sparse arrays, duplicated identities and broken staff/service references', () => {
    expect(bookingAvailability({ slots: Array(1), quoteVersion: 'quote' })).toBe(false);
    expect(bookingAvailability({ slots: [slot, slot], quoteVersion: 'quote' })).toBe(false);
    expect(bookingCatalog({ ...catalog, services: [service, service] })).toBe(false);
    expect(bookingCatalog({ ...catalog, staff: [{ id, name: 'Staff', title: '', introduction: '', serviceIds: ['22222222-2222-4222-8222-222222222222'] }] })).toBe(false);
    expect(bookingList([saved, saved])).toBe(false);
    expect(bookingList(Array(1))).toBe(false);
  });
  it('rejects impossible durations and unrecognised payment modes', () => {
    expect(bookingAvailability({ slots: [{ ...slot, occupiedUntil: slot.startAt }], quoteVersion: 'quote' })).toBe(false);
    expect(bookingCatalog({ ...catalog, paymentMode: 'online' })).toBe(false);
    expect(booking({ ...saved, serviceEndAt: saved.startAt })).toBe(false);
    expect(booking({ ...saved, paymentMode: 'online' })).toBe(false);
    expect(booking({ ...saved, status: 'confirmed', cancelledBy: 'customer' })).toBe(false);
  });
  it('rejects hidden fields instead of returning them from database results', () => {
    expect(booking({ ...saved, user_id: 'private' })).toBe(false);
    expect(bookingCatalog({ ...catalog, membership: { userId: 'private' } })).toBe(false);
    expect(bookingCatalog({ status: 'unavailable', placeId: 'known', merchantName: 'secret' })).toBe(false);
  });
  it('allows anonymized account-deletion receipts without weakening new contact validation', () => {
    expect(booking({ ...saved, customerName: 'Deleted customer', phone: '', notes: '' })).toBe(true);
    expect(bookingCreateInput({ ...input, phone: '' })).toBe(false);
  });
  it.each([{ customerName: '  ' }, { phone: '123' }, { phone: 'person@example.test' }, { phone: '+82\t10 1234 5678' }, { placeId: 'x'.repeat(201) }, { notes: '\u0000' }, { notes: '\ud800' }, { notes: 'x'.repeat(2001) }, { requestId: 'no' }, { userId: id }, { merchantId: id }, { totalKrw: 1 }])('rejects malformed creation input %j', (change) => {
    expect(bookingCreateInput({ ...input, ...change })).toBe(false);
  });
  it('restricts customer/partner transitions and requires concurrency version', () => {
    expect(bookingCustomerTransition({ action: 'cancel' })).toBe(true);
    expect(bookingCustomerTransition({ action: 'confirm' })).toBe(false);
    expect(bookingCustomerTransition({ action: 'cancel', partner: true })).toBe(false);
    expect(bookingPartnerTransition({ action: 'confirm', expectedUpdatedAt: saved.updatedAt })).toBe(true);
    expect(bookingPartnerTransition({ action: 'complete' })).toBe(false);
    expect(bookingPartnerTransition({ action: 'request', expectedUpdatedAt: saved.updatedAt })).toBe(false);
  });
  it('allows only one instance of each availability query parameter', () => {
    const query = `serviceId=${id}&date=2026-10-21`;
    expect(parseBookingAvailabilityQuery(new URLSearchParams(query))).toEqual({ serviceId: id, staffId: null, date: '2026-10-21' });
    for (const extra of ['&date=2026-10-22', '&merchantId=private', '&staffId=', '&staffId=null', '&staffId=invalid']) {
      expect(parseBookingAvailabilityQuery(new URLSearchParams(query + extra))).toBeNull();
    }
  });
});
