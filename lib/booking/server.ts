import type { SupabaseClient } from '@supabase/supabase-js';
import { record, uuid } from '@/lib/partner/contracts';
import { getPartnerContext, PartnerError } from '@/lib/partner/server';
import {
  booking, bookingAvailability, bookingCatalog, bookingList,
  type Booking, type BookingAvailability, type BookingAvailabilityQuery, type BookingCatalog,
  type BookingCreateInput, type BookingPartnerTransition,
} from './contracts';

export class BookingError extends Error {
  constructor(public readonly status: number, public readonly code: string) { super(code); }
}
const rpcErrors: Record<string, number> = {
  AUTH_REQUIRED: 401, INVALID_REQUEST: 400, BOOKING_UNAVAILABLE: 409, SLOT_UNAVAILABLE: 409,
  STALE_SELECTION: 409, BOOKING_CONFLICT: 409, PARTNER_FORBIDDEN: 403,
  PARTNER_READ_ONLY: 403, BOOKING_NOT_FOUND: 404,
};
function unavailable(): never { throw new BookingError(503, 'BOOKING_SERVICE_UNAVAILABLE'); }
async function operation<T>(run: () => Promise<T>): Promise<T> {
  try { return await run(); }
  catch (error) {
    if (error instanceof BookingError) throw error;
    if (error instanceof PartnerError) {
      if (error.code === 'UNAUTHENTICATED') throw new BookingError(401, 'AUTH_REQUIRED');
      if (['PARTNER_UNASSIGNED', 'PARTNER_FORBIDDEN'].includes(error.code)) throw new BookingError(403, 'PARTNER_FORBIDDEN');
      if (error.code === 'PARTNER_READ_ONLY') throw new BookingError(403, 'PARTNER_READ_ONLY');
    }
    return unavailable();
  }
}
function rpcData(result: unknown): unknown {
  if (!record(result) || !Object.hasOwn(result, 'data') || !Object.hasOwn(result, 'error')) return unavailable();
  if (result.error !== null) {
    if (record(result.error)) {
      if (result.error.code === 'P0001' && typeof result.error.message === 'string' && Object.hasOwn(rpcErrors, result.error.message)) {
        throw new BookingError(rpcErrors[result.error.message], result.error.message);
      }
      if (result.error.code === '23514' || result.error.code === '23505') throw new BookingError(409, 'BOOKING_CONFLICT');
    }
    return unavailable();
  }
  return result.data;
}
export async function requireBookingUser(client: SupabaseClient): Promise<string> {
  return operation(async () => {
    const auth: unknown = await client.auth.getUser();
    if (!record(auth)) return unavailable();
    if (auth.error !== null) {
      const error = auth.error as { name?: unknown; status?: unknown; code?: unknown } | null | undefined;
      if (error && typeof error === 'object' && (error.name === 'AuthSessionMissingError' || error.status === 401 || error.status === 403 ||
        (typeof error.code === 'string' && ['bad_jwt', 'session_not_found', 'user_not_found', 'refresh_token_not_found', 'refresh_token_already_used'].includes(error.code)))) throw new BookingError(401, 'AUTH_REQUIRED');
      return unavailable();
    }
    if (!record(auth.data) || !Object.hasOwn(auth.data, 'user')) return unavailable();
    if (auth.data.user === null) throw new BookingError(401, 'AUTH_REQUIRED');
    if (!record(auth.data.user) || !uuid(auth.data.user.id) || auth.data.user.is_anonymous === true) throw new BookingError(401, 'AUTH_REQUIRED');
    return auth.data.user.id;
  });
}
export async function getBookingCatalog(client: SupabaseClient, placeId: string): Promise<BookingCatalog> {
  return operation(async () => {
    const data = rpcData(await client.rpc('booking_catalog', { p_place_id: placeId }));
    if (!bookingCatalog(data) || data.placeId !== placeId) return unavailable();
    return data;
  });
}
export async function getBookingAvailability(client: SupabaseClient, placeId: string, selection: BookingAvailabilityQuery): Promise<BookingAvailability> {
  return operation(async () => {
    const data = rpcData(await client.rpc('booking_availability', {
      p_place_id: placeId, p_service_id: selection.serviceId, p_staff_id: selection.staffId, p_date: selection.date,
    }));
    if (!bookingAvailability(data) || data.slots.some((slot) =>
      slot.staffId?.toLowerCase() !== selection.staffId?.toLowerCase() ||
      new Date(Date.parse(slot.startAt) + 9 * 60 * 60 * 1000).toISOString().slice(0, 10) !== selection.date)) return unavailable();
    return data;
  });
}
export async function createBooking(client: SupabaseClient, input: BookingCreateInput): Promise<Booking> {
  return operation(async () => {
    await requireBookingUser(client);
    const data = rpcData(await client.rpc('booking_create', {
      p_place_id: input.placeId, p_service_id: input.serviceId.toLowerCase(), p_staff_id: input.staffId?.toLowerCase() ?? null,
      p_start_at: input.startAt, p_quote_version: input.quoteVersion, p_request_id: input.requestId.toLowerCase(),
      p_customer_name: input.customerName.trim(), p_phone: input.phone.trim(), p_notes: input.notes,
    }));
    if (!booking(data) || data.placeId !== input.placeId || Date.parse(data.startAt) !== Date.parse(input.startAt)) return unavailable();
    return data;
  });
}
export async function listBookings(client: SupabaseClient, partner = false): Promise<Booking[]> {
  return operation(async () => {
    if (partner) await getPartnerContext(client); else await requireBookingUser(client);
    const data = rpcData(await client.rpc('booking_list', { p_partner: partner }));
    if (!bookingList(data)) return unavailable();
    return data;
  });
}
export async function getBooking(client: SupabaseClient, id: string): Promise<Booking> {
  return operation(async () => {
    await requireBookingUser(client);
    const data = rpcData(await client.rpc('booking_get', { p_id: id.toLowerCase(), p_partner: false }));
    if (data === null) throw new BookingError(404, 'BOOKING_NOT_FOUND');
    if (!booking(data) || data.id.toLowerCase() !== id.toLowerCase()) return unavailable();
    return data;
  });
}
export async function transitionBooking(client: SupabaseClient, id: string, partnerTransition?: BookingPartnerTransition): Promise<Booking> {
  return operation(async () => {
    if (partnerTransition) {
      const context = await getPartnerContext(client);
      if (context.readOnly) throw new BookingError(403, 'PARTNER_READ_ONLY');
    } else await requireBookingUser(client);
    const data = rpcData(await client.rpc('booking_transition', {
      p_id: id.toLowerCase(), p_action: partnerTransition?.action ?? 'cancel', p_partner: Boolean(partnerTransition),
      p_expected_updated_at: partnerTransition?.expectedUpdatedAt ?? null,
    }));
    if (!booking(data) || data.id.toLowerCase() !== id.toLowerCase()) return unavailable();
    return data;
  });
}
