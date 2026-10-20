import { bookingJson } from './customer-booking-state';
import { bookingMessageSnapshot, type BookingMessageInput, type BookingMessageSnapshot } from '@/lib/booking/communication-contracts';

export function bookingConversationUrl(bookingId: string, partner: boolean): string {
  return `${partner ? '/api/partner/operations/bookings' : '/api/bookings'}/${encodeURIComponent(bookingId)}/messages`;
}
export function isBookingConversation(value: unknown, bookingId: string): value is BookingMessageSnapshot {
  return bookingMessageSnapshot(value) && value.messages.every(message => message.bookingId === bookingId);
}
export function laterMessageTime(first: string | null, second: string | null): string | null {
  if (!first) return second;
  return second && Date.parse(second) > Date.parse(first) ? second : first;
}
/** Merge successful sends with polls that may have started before the send completed. */
export function mergeBookingConversation(previous: BookingMessageSnapshot | null, next: BookingMessageSnapshot): BookingMessageSnapshot {
  if (!previous || previous.availability === 'unavailable' || next.availability === 'unavailable') return next;
  const messages = new Map(previous.messages.map(message => [message.id, message]));
  for (const message of next.messages) messages.set(message.id, message);
  return {
    availability: next.availability,
    messages: [...messages.values()].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id)),
    readState: {
      customerReadAt: laterMessageTime(previous.readState.customerReadAt, next.readState.customerReadAt),
      merchantReadAt: laterMessageTime(previous.readState.merchantReadAt, next.readState.merchantReadAt),
    },
  };
}
/** An uncertain delivery owns its original body and key until the server resolves it. */
export function bookingMessageAttempt(draft: string, pending: BookingMessageInput | null, createId: () => string): BookingMessageInput {
  if (pending) return pending;
  const body = draft.trim();
  if (!body || body.length > 2000) throw new Error('INVALID_REQUEST');
  return { requestId: createId(), body };
}
export function latestVisibleIncoming(snapshot: BookingMessageSnapshot, partner: boolean, visibleIds: ReadonlySet<string>, pageVisible: boolean): string | null {
  if (!pageVisible || snapshot.availability !== 'available') return null;
  return snapshot.messages.reduce<string | null>((latest, message) => message.sender === (partner ? 'customer' : 'merchant') && visibleIds.has(message.id) ? laterMessageTime(latest, message.createdAt) : latest, null);
}
export function bookingMessageError(code: string): string {
  if (code === 'BOOKING_MESSAGES_UNAVAILABLE') return 'Messaging is unavailable for this booking.';
  if (code === 'AUTH_REQUIRED') return 'Please sign in again to view your messages.';
  if (code === 'PARTNER_FORBIDDEN' || code === 'PARTNER_READ_ONLY') return 'You do not have permission to send messages for this booking.';
  if (code === 'BOOKING_NOT_FOUND') return 'We could not find this booking.';
  if (code === 'INVALID_REQUEST') return 'Enter a message of 1–2,000 characters.';
  return 'We could not confirm delivery. Retry to check.';
}

export async function requestBookingConversation(url: string, bookingId: string, init?: RequestInit, transport: typeof fetch = fetch): Promise<BookingMessageSnapshot> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  init?.signal?.addEventListener('abort', abort, { once: true });
  if (init?.signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 15000);
  try {
    const data = await bookingJson<unknown>(url, { ...init, signal: controller.signal }, transport);
    if (!isBookingConversation(data, bookingId)) throw new Error('NETWORK_ERROR');
    return data;
  } finally {
    clearTimeout(timeout);
    init?.signal?.removeEventListener('abort', abort);
  }
}
