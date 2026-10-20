import type { SupabaseClient } from '@supabase/supabase-js';
import { record } from '@/lib/partner/contracts';
import { getPartnerContext, PartnerError } from '@/lib/partner/server';
import { bookingAvailability, type BookingAvailability } from './contracts';
import { BookingError } from './server';
import {
  partnerBooking, partnerBookingSnapshot, type PartnerBookingSnapshot, type PartnerBooking, type PartnerBookingCreateInput,
  type PartnerBookingMutation, type PartnerBookingAvailabilityQuery,
} from './partner-contracts';

const rpcErrors: Record<string, number> = {
  AUTH_REQUIRED: 401, INVALID_REQUEST: 400, BOOKING_UNAVAILABLE: 409, SLOT_UNAVAILABLE: 409,
  STALE_SELECTION: 409, BOOKING_CONFLICT: 409, PARTNER_FORBIDDEN: 403,
  PARTNER_READ_ONLY: 403, BOOKING_NOT_FOUND: 404,
};
function unavailable(): never { throw new BookingError(503, 'BOOKING_SERVICE_UNAVAILABLE'); }
async function operation<T>(client: SupabaseClient, write: boolean, run: () => Promise<T>): Promise<T> {
  try {
    const context = await getPartnerContext(client);
    if (write && context.readOnly) throw new BookingError(403, 'PARTNER_READ_ONLY');
    return await run();
  } catch (error) {
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
      if (['23514', '23505'].includes(String(result.error.code))) throw new BookingError(409, 'BOOKING_CONFLICT');
    }
    return unavailable();
  }
  return result.data;
}
export async function listPartnerBookings(client: SupabaseClient): Promise<PartnerBookingSnapshot> {
  return operation(client, false, async () => {
    const data = rpcData(await client.rpc('partner_booking_list'));
    if (!partnerBookingSnapshot(data)) return unavailable();
    return data;
  });
}
export async function getPartnerBooking(client: SupabaseClient, id: string): Promise<PartnerBooking> {
  return operation(client, false, async () => {
    const data = rpcData(await client.rpc('partner_booking_get', { p_id: id.toLowerCase() }));
    if (!partnerBooking(data) || data.id.toLowerCase() !== id.toLowerCase()) return unavailable();
    return data;
  });
}
export async function createPartnerBooking(client: SupabaseClient, input: PartnerBookingCreateInput): Promise<PartnerBooking> {
  return operation(client, true, async () => {
    const data = rpcData(await client.rpc('partner_booking_create', {
      p_place_id: input.placeId, p_service_id: input.serviceId.toLowerCase(), p_staff_id: input.staffId?.toLowerCase() ?? null,
      p_start_at: input.startAt, p_quote_version: input.quoteVersion, p_request_id: input.requestId.toLowerCase(),
      p_customer_name: input.customerName.trim(), p_phone: input.phone.trim(), p_notes: input.notes, p_source: input.source,
    }));
    if (!partnerBooking(data) || data.placeId !== input.placeId || data.source !== input.source || Date.parse(data.startAt) !== Date.parse(input.startAt)) return unavailable();
    return data;
  });
}
export async function mutatePartnerBooking(client: SupabaseClient, id: string, input: PartnerBookingMutation): Promise<PartnerBooking> {
  return operation(client, true, async () => {
    const data = rpcData(await client.rpc('partner_booking_mutate', {
      p_id: id.toLowerCase(), p_action: input.action, p_expected_updated_at: input.expectedUpdatedAt,
      p_cancel_reason: input.action === 'cancel' ? input.cancelReason.trim() : '',
      p_start_at: input.action === 'reschedule' ? input.startAt : null,
      p_staff_id: input.action === 'reschedule' ? input.staffId?.toLowerCase() ?? null : null,
    }));
    if (!partnerBooking(data) || data.id.toLowerCase() !== id.toLowerCase()) return unavailable();
    return data;
  });
}
export async function getPartnerBookingAvailability(client: SupabaseClient, id: string, input: PartnerBookingAvailabilityQuery): Promise<BookingAvailability> {
  return operation(client, false, async () => {
    const data = rpcData(await client.rpc('partner_booking_availability', { p_id: id.toLowerCase(), p_date: input.date, p_staff_id: input.staffId }));
    if (!bookingAvailability(data) || data.slots.some((slot) => slot.staffId?.toLowerCase() !== input.staffId?.toLowerCase() ||
      new Date(Date.parse(slot.startAt) + 9 * 60 * 60 * 1000).toISOString().slice(0, 10) !== input.date)) return unavailable();
    return data;
  });
}
