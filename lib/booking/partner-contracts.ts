import { boundedString, exactKeys, record, uuid } from '@/lib/partner/contracts';
import { booking, bookingCreateInput, bookingDate, bookingTimestamp, type Booking, type BookingCreateInput } from './contracts';

/** Merchant-only projection. Customer DTOs intentionally remain unchanged. */
export type PartnerBooking = Booking & {
  serviceId: string;
  staffId: string | null;
  customerId: string | null;
  occupiedUntil: string;
  source: 'app' | 'phone' | 'walkin';
  cancelReason: string;
};
export type PartnerBookingCreateInput = BookingCreateInput & { source: 'phone' | 'walkin' };
export type PartnerBookingSnapshot = { bookings: PartnerBooking[]; placeId: string | null };
export type PartnerBookingMutation =
  | { action: 'confirm' | 'complete' | 'no_show'; expectedUpdatedAt: string }
  | { action: 'cancel'; expectedUpdatedAt: string; cancelReason: string }
  | { action: 'reschedule'; expectedUpdatedAt: string; startAt: string; staffId: string | null };
export type PartnerBookingAvailabilityQuery = { date: string; staffId: string | null };

function nullableUuid(value: unknown): value is string | null { return value === null || uuid(value); }
export function partnerBooking(value: unknown): value is PartnerBooking {
  if (!record(value)) return false;
  const { serviceId, staffId, customerId, occupiedUntil, source, cancelReason, ...customer } = value;
  return booking(customer) && uuid(serviceId) && nullableUuid(staffId) && nullableUuid(customerId) &&
    bookingTimestamp(occupiedUntil) && Date.parse(occupiedUntil) >= Date.parse(customer.serviceEndAt) &&
    ['app', 'phone', 'walkin'].includes(String(source)) && boundedString(cancelReason, 1000) &&
    (customer.status === 'cancelled' || cancelReason === '') &&
    (staffId === null ? customer.staffName === null : customer.staffName !== null);
}
export function partnerBookingList(value: unknown): value is PartnerBooking[] {
  if (!Array.isArray(value) || value.length > 10000) return false;
  for (let index = 0; index < value.length; index += 1) if (!Object.hasOwn(value, index) || !partnerBooking(value[index])) return false;
  return new Set(value.map((item) => item.id.toLowerCase())).size === value.length;
}
export function partnerBookingSnapshot(value: unknown): value is PartnerBookingSnapshot {
  return record(value) && exactKeys(value, ['bookings', 'placeId']) && partnerBookingList(value.bookings) &&
    (value.placeId === null || (boundedString(value.placeId, 200) && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,199}$/.test(value.placeId)));
}
export function partnerBookingCreateInput(value: unknown): value is PartnerBookingCreateInput {
  if (!record(value)) return false;
  const { source, ...customerInput } = value;
  return (source === 'phone' || source === 'walkin') && bookingCreateInput(customerInput);
}
export function partnerBookingMutation(value: unknown): value is PartnerBookingMutation {
  if (!record(value) || !bookingTimestamp(value.expectedUpdatedAt)) return false;
  if (value.action === 'reschedule') return exactKeys(value, ['action', 'expectedUpdatedAt', 'startAt', 'staffId']) &&
    bookingTimestamp(value.startAt) && nullableUuid(value.staffId);
  if (value.action === 'cancel') return exactKeys(value, ['action', 'expectedUpdatedAt', 'cancelReason']) && boundedString(value.cancelReason, 1000);
  return exactKeys(value, ['action', 'expectedUpdatedAt']) && ['confirm', 'complete', 'no_show'].includes(String(value.action));
}
export function parsePartnerBookingAvailabilityQuery(params: URLSearchParams): PartnerBookingAvailabilityQuery | null {
  if (params.size !== (params.has('staffId') ? 2 : 1) || [...params.keys()].some((key) => !['date', 'staffId'].includes(key))) return null;
  const date = params.get('date');
  const staffId = params.has('staffId') ? params.get('staffId') : null;
  return bookingDate(date) && nullableUuid(staffId) ? { date, staffId: staffId?.toLowerCase() ?? null } : null;
}
