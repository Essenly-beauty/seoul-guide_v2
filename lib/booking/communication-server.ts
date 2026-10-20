import type { SupabaseClient } from '@supabase/supabase-js';
import { record } from '@/lib/partner/contracts';
import { getPartnerContext, PartnerError } from '@/lib/partner/server';
import { BookingError, requireBookingUser } from './server';
import {
  bookingMessageSnapshot, partnerCustomerNote, partnerMessageThreads,
  type BookingMessageInput, type BookingMessageReadInput, type BookingMessageSnapshot,
  type PartnerCustomerNote, type PartnerCustomerNoteInput, type PartnerMessageThread,
} from './communication-contracts';

const errors: Record<string, number> = {
  AUTH_REQUIRED: 401, PARTNER_FORBIDDEN: 403, PARTNER_READ_ONLY: 403, INVALID_REQUEST: 400,
  BOOKING_NOT_FOUND: 404, CUSTOMER_NOT_FOUND: 404, BOOKING_CONFLICT: 409, BOOKING_MESSAGES_UNAVAILABLE: 409,
};
function unavailable(): never { throw new BookingError(503, 'BOOKING_SERVICE_UNAVAILABLE'); }
async function operation<T>(client: SupabaseClient, partner: boolean, write: boolean, run: () => Promise<T>): Promise<T> {
  try {
    if (partner) {
      const context = await getPartnerContext(client);
      if (write && context.readOnly) throw new BookingError(403, 'PARTNER_READ_ONLY');
    } else await requireBookingUser(client);
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
    if (record(result.error) && result.error.code === 'P0001' && typeof result.error.message === 'string' && Object.hasOwn(errors, result.error.message)) {
      throw new BookingError(errors[result.error.message], result.error.message);
    }
    return unavailable();
  }
  return result.data;
}
export async function getPartnerCustomerNote(client: SupabaseClient, id: string, input?: PartnerCustomerNoteInput): Promise<PartnerCustomerNote> {
  return operation(client, true, Boolean(input), async () => {
    const data = rpcData(await client.rpc('partner_customer_note', {
      p_id: id.toLowerCase(), p_notes: input?.notes ?? null, p_expected_updated_at: input?.expectedUpdatedAt ?? null,
    }));
    if (!partnerCustomerNote(data) || data.id.toLowerCase() !== id.toLowerCase()) return unavailable();
    return data;
  });
}
export async function getBookingMessages(client: SupabaseClient, id: string, partner: boolean, mutation?: BookingMessageInput | BookingMessageReadInput): Promise<BookingMessageSnapshot> {
  const send = Boolean(mutation && 'body' in mutation);
  return operation(client, partner, send, async () => {
    const data = rpcData(await client.rpc('booking_messages', {
      p_id: id.toLowerCase(), p_partner: partner,
      p_body: mutation && 'body' in mutation ? mutation.body.trim() : null,
      p_request_id: mutation && 'requestId' in mutation ? mutation.requestId.toLowerCase() : null,
      p_read_at: mutation && 'readAt' in mutation ? mutation.readAt : null,
    }));
    if (!bookingMessageSnapshot(data) || data.messages.some((message) => message.bookingId.toLowerCase() !== id.toLowerCase())) return unavailable();
    return data;
  });
}
export async function listPartnerMessageThreads(client: SupabaseClient): Promise<PartnerMessageThread[]> {
  return operation(client, true, false, async () => {
    const data = rpcData(await client.rpc('partner_message_threads'));
    if (!partnerMessageThreads(data)) return unavailable();
    return data;
  });
}
