import { boundedString, exactKeys, integer, record, timestamp, uuid } from '@/lib/partner/contracts';

export type BookingService = {
  id: string; category: string; name: string; description: string;
  priceKrw: number; durationMinutes: number; quoteVersion: string;
};
export type BookingStaff = { id: string; name: string; title: string; introduction: string; serviceIds: string[] };
export type BookingCatalog = { status: 'unavailable'; placeId: string } | {
  status: 'available'; placeId: string; merchantName: string; mode: 'request' | 'instant';
  paymentMode: 'pay_at_venue'; startDate: string; endDate: string; services: BookingService[];
  staff: BookingStaff[]; selectionMode: 'shop' | 'staff';
};
export type BookingSlot = { startAt: string; serviceEndAt: string; occupiedUntil: string; staffId: string | null };
export type BookingAvailability = { slots: BookingSlot[]; quoteVersion: string };
export type BookingStatus = 'requested' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
export type Booking = {
  id: string; placeId: string; merchantName: string; serviceName: string; staffName: string | null;
  startAt: string; serviceEndAt: string; totalKrw: number; status: BookingStatus; paymentMode: 'pay_at_venue';
  customerName: string; phone: string; notes: string; createdAt: string; updatedAt: string;
  cancelledBy: 'customer' | 'merchant' | null;
};
export type BookingCreateInput = {
  placeId: string; serviceId: string; staffId: string | null; startAt: string; quoteVersion: string;
  requestId: string; customerName: string; phone: string; notes: string;
};
export type BookingPartnerAction = 'confirm' | 'cancel' | 'complete' | 'no_show';
export type BookingPartnerTransition = { action: BookingPartnerAction; expectedUpdatedAt: string };
export type BookingAvailabilityQuery = { serviceId: string; staffId: string | null; date: string };

function text(value: unknown, max: number): value is string {
  return boundedString(value, max) && value.trim().length > 0;
}
export function bookingDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function bookingTimestamp(value: unknown): value is string {
  return timestamp(value) && bookingDate(value.slice(0, 10)) &&
    (value.endsWith('Z') || (Number(value.slice(-5, -3)) <= 23 && Number(value.slice(-2)) <= 59));
}
function denseArray<T>(value: unknown, max: number, valid: (item: unknown) => item is T): value is T[] {
  if (!Array.isArray(value) || value.length > max) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index) || !valid(value[index])) return false;
  }
  return true;
}
function uniqueIds(items: { id: string }[]): boolean { return new Set(items.map((item) => item.id.toLowerCase())).size === items.length; }
function nullableUuid(value: unknown): value is string | null { return value === null || uuid(value); }
export function bookingService(value: unknown): value is BookingService {
  return record(value) && exactKeys(value, ['id', 'category', 'name', 'description', 'priceKrw', 'durationMinutes', 'quoteVersion']) &&
    uuid(value.id) && text(value.category, 120) && text(value.name, 120) && boundedString(value.description, 4000) &&
    integer(value.priceKrw, 1) && integer(value.durationMinutes, 1) && value.durationMinutes <= 1440 && text(value.quoteVersion, 256);
}
export function bookingStaff(value: unknown): value is BookingStaff {
  return record(value) && exactKeys(value, ['id', 'name', 'title', 'introduction', 'serviceIds']) && uuid(value.id) &&
    text(value.name, 120) && boundedString(value.title, 120) && boundedString(value.introduction, 4000) &&
    denseArray(value.serviceIds, 10000, uuid) && new Set(value.serviceIds.map((id) => id.toLowerCase())).size === value.serviceIds.length;
}
export function bookingCatalog(value: unknown): value is BookingCatalog {
  if (!record(value) || !text(value.placeId, 200)) return false;
  if (value.status === 'unavailable') return exactKeys(value, ['status', 'placeId']);
  if (value.status !== 'available' || !exactKeys(value, ['status', 'placeId', 'merchantName', 'mode', 'paymentMode', 'startDate', 'endDate', 'services', 'staff', 'selectionMode']) ||
    !text(value.merchantName, 120) || !['request', 'instant'].includes(String(value.mode)) || value.paymentMode !== 'pay_at_venue' ||
    !bookingDate(value.startDate) || !bookingDate(value.endDate) || value.endDate < value.startDate ||
    !denseArray(value.services, 10000, bookingService) || !uniqueIds(value.services) ||
    !denseArray(value.staff, 1000, bookingStaff) || !uniqueIds(value.staff) ||
    !['shop', 'staff'].includes(String(value.selectionMode))) return false;
  const serviceIds = new Set(value.services.map((service) => service.id.toLowerCase()));
  return value.staff.every((staff) => staff.serviceIds.every((id) => serviceIds.has(id.toLowerCase())));
}
export function bookingSlot(value: unknown): value is BookingSlot {
  return record(value) && exactKeys(value, ['startAt', 'serviceEndAt', 'occupiedUntil', 'staffId']) &&
    bookingTimestamp(value.startAt) && bookingTimestamp(value.serviceEndAt) && bookingTimestamp(value.occupiedUntil) &&
    Date.parse(value.startAt) < Date.parse(value.serviceEndAt) && Date.parse(value.serviceEndAt) <= Date.parse(value.occupiedUntil) && nullableUuid(value.staffId);
}
export function bookingAvailability(value: unknown): value is BookingAvailability {
  if (!record(value) || !exactKeys(value, ['slots', 'quoteVersion']) || !text(value.quoteVersion, 256) || !denseArray(value.slots, 10000, bookingSlot)) return false;
  return new Set(value.slots.map((slot) => `${Date.parse(slot.startAt)}:${slot.staffId?.toLowerCase() ?? ''}`)).size === value.slots.length;
}
export function booking(value: unknown): value is Booking {
  return record(value) && exactKeys(value, ['id', 'placeId', 'merchantName', 'serviceName', 'staffName', 'startAt', 'serviceEndAt', 'totalKrw', 'status', 'paymentMode', 'customerName', 'phone', 'notes', 'createdAt', 'updatedAt', 'cancelledBy']) &&
    uuid(value.id) && text(value.placeId, 200) && text(value.merchantName, 120) && text(value.serviceName, 120) &&
    (value.staffName === null || text(value.staffName, 120)) && bookingTimestamp(value.startAt) && bookingTimestamp(value.serviceEndAt) &&
    Date.parse(value.startAt) < Date.parse(value.serviceEndAt) && integer(value.totalKrw, 1) &&
    ['requested', 'confirmed', 'cancelled', 'completed', 'no_show'].includes(String(value.status)) && value.paymentMode === 'pay_at_venue' &&
    text(value.customerName, 120) && boundedString(value.phone, 80) && boundedString(value.notes, 2000) &&
    bookingTimestamp(value.createdAt) && bookingTimestamp(value.updatedAt) && Date.parse(value.createdAt) <= Date.parse(value.updatedAt) &&
    (value.cancelledBy === null || value.cancelledBy === 'customer' || value.cancelledBy === 'merchant') &&
    (value.status === 'cancelled' ? value.cancelledBy !== null : value.cancelledBy === null);
}
export function bookingList(value: unknown): value is Booking[] { return denseArray(value, 10000, booking) && uniqueIds(value); }
export function bookingCreateInput(value: unknown): value is BookingCreateInput {
  return record(value) && exactKeys(value, ['placeId', 'serviceId', 'staffId', 'startAt', 'quoteVersion', 'requestId', 'customerName', 'phone', 'notes']) &&
    text(value.placeId, 200) && uuid(value.serviceId) && nullableUuid(value.staffId) && bookingTimestamp(value.startAt) && text(value.quoteVersion, 256) &&
    uuid(value.requestId) && text(value.customerName, 120) && text(value.phone, 80) && /^[+\d(). -]+$/.test(value.phone) &&
    value.phone.replace(/\D/g, '').length >= 7 && boundedString(value.notes, 2000);
}
export function bookingCustomerTransition(value: unknown): value is { action: 'cancel' } {
  return record(value) && exactKeys(value, ['action']) && value.action === 'cancel';
}
export function bookingPartnerTransition(value: unknown): value is BookingPartnerTransition {
  return record(value) && exactKeys(value, ['action', 'expectedUpdatedAt']) &&
    ['confirm', 'cancel', 'complete', 'no_show'].includes(String(value.action)) && bookingTimestamp(value.expectedUpdatedAt);
}
export function parseBookingAvailabilityQuery(params: URLSearchParams): BookingAvailabilityQuery | null {
  if (params.size !== (params.has('staffId') ? 3 : 2) || [...params.keys()].some((key) => !['serviceId', 'staffId', 'date'].includes(key))) return null;
  const serviceId = params.get('serviceId');
  const staffId = params.has('staffId') ? params.get('staffId') : null;
  const date = params.get('date');
  if (!uuid(serviceId) || !nullableUuid(staffId) || !bookingDate(date)) return null;
  return { serviceId: serviceId.toLowerCase(), staffId: staffId?.toLowerCase() ?? null, date };
}
