/** Customer-only selection and HTTP handling. All booking authority stays on the server. */
import { booking } from '@/lib/booking/contracts';
import type { Booking as CustomerBooking, BookingCreateInput as BookingRequest, BookingSlot } from '@/lib/booking/contracts';
export type { Booking as CustomerBooking, BookingCreateInput as BookingRequest, BookingCatalog as BookingConfiguration, BookingService, BookingStaff, BookingSlot } from '@/lib/booking/contracts';
export type BookingSelection = { serviceId: string; staffId: string; date: string; slot: BookingSlot | null; quoteVersion: string; requestId: string | null; customerName: string; phone: string; notes: string; error: string };
export const initialBookingState: BookingSelection = { serviceId: '', staffId: '', date: '', slot: null, quoteVersion: '', requestId: null, customerName: '', phone: '', notes: '', error: '' };
type Action = { type: 'service' | 'staff' | 'date' | 'error' | 'request'; value: string } | { type: 'slot'; slot: BookingSlot; quoteVersion: string } | { type: 'customer'; field: 'customerName' | 'phone' | 'notes'; value: string } | { type: 'configuration' };
export function bookingReducer(state: BookingSelection, action: Action): BookingSelection {
  if (action.type === 'error') return { ...state, error: action.value };
  if (action.type === 'request') return { ...state, requestId: action.value };
  if (action.type === 'customer') return { ...state, [action.field]: action.value, requestId: null, error: '' };
  if (action.type === 'slot') return { ...state, slot: action.slot, quoteVersion: action.quoteVersion, requestId: null, error: '' };
  const cleared = { ...state, slot: null, quoteVersion: '', requestId: null, error: '' };
  if (action.type === 'service') return { ...cleared, serviceId: action.value, staffId: '' };
  if (action.type === 'staff') return { ...cleared, staffId: action.value };
  if (action.type === 'date') return { ...cleared, date: action.value };
  return cleared;
}

export async function bookingJson<T>(url: string, init?: RequestInit, transport: typeof fetch = fetch): Promise<T> {
  const response = await transport(url, { cache: 'no-store', ...init });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof data?.code === 'string' ? data.code : typeof data?.error === 'string' ? data.error : 'NETWORK_ERROR');
  if (!data || typeof data !== 'object') throw new Error('NETWORK_ERROR');
  return data as T;
}
export async function submitBooking(body: BookingRequest, transport: typeof fetch = fetch): Promise<CustomerBooking> {
  const data = await bookingJson<{ booking: CustomerBooking }>('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, transport);
  if (!booking(data.booking)) throw new Error('NETWORK_ERROR');
  return data.booking;
}
export function bookingErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    AUTH_REQUIRED: 'Please sign in to continue with your booking.',
    INVALID_REQUEST: 'Check your details and choose a time again.',
    BOOKING_UNAVAILABLE: 'This venue is not accepting bookings right now.',
    SLOT_UNAVAILABLE: 'That time is no longer available. Choose another time.',
    STALE_SELECTION: 'The service details have changed. Please review your selection again.',
    BOOKING_CONFLICT: 'You already have a booking at this time. Check My bookings.',
    SERVICE_UNAVAILABLE: 'This service is no longer available. Choose another service.',
    PLACE_NOT_FOUND: 'This venue is not accepting bookings right now.',
    BOOKING_NOT_FOUND: 'We could not find this booking.',
    INVALID_STATUS: 'This booking can no longer be cancelled. Refresh to see its latest status.',
  };
  return Object.prototype.hasOwnProperty.call(messages, code) ? messages[code] : 'We could not connect. Please try again.';
}
/** Same KRW style as the venue's public menu (₩60,000) in every language: French grouping uses a narrow no-break
 *  space that Plus Jakarta Sans draws about 1px wide, so "₩60 000" read as "₩60000". */
export function bookingPrice(value: number): string {
  return `₩${value.toLocaleString('en-US')}`;
}
export function bookingTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value));
}
export function bookingDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Seoul', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

/** Date-only arithmetic uses UTC so a device timezone or DST cannot shift the rail. */
export function shiftBookingDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function bookingDateWindow(first: string, last: string, anchor: string, count = 5): string[] {
  if (!first || !last || last < first || count < 1) return [];
  const latestStart = shiftBookingDate(last, -(count - 1));
  const start = anchor < first ? first : anchor > latestStart ? (latestStart < first ? first : latestStart) : anchor;
  return Array.from({ length: count }, (_, index) => shiftBookingDate(start, index)).filter(day => day <= last);
}
export function bookingCalendarLabel(value: string, locale: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'Asia/Seoul' }).format(new Date(`${value}T12:00:00+09:00`));
}
export function bookingTimeGroups(slots: readonly BookingSlot[]): { label: 'Morning' | 'Afternoon'; slots: BookingSlot[] }[] {
  const sorted = [...slots].sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
  return (['Morning', 'Afternoon'] as const).map(label => ({ label, slots: sorted.filter(slot => (Number(bookingTime(slot.startAt, 'en').slice(0, 2)) < 12 ? 'Morning' : 'Afternoon') === label) })).filter(group => group.slots.length);
}

export function bookingStartDate(startDate: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find(value => value.type === type)?.value ?? '';
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  return startDate > today ? startDate : today;
}
export async function cancelBooking(id: string, transport: typeof fetch = fetch): Promise<CustomerBooking> {
  const result = await bookingJson<{ booking: unknown }>(`/api/bookings/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel' }) }, transport);
  if (!booking(result.booking) || result.booking.id !== id || result.booking.status !== 'cancelled') throw new Error('NETWORK_ERROR');
  return result.booking;
}
