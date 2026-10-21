import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import type { BookingMessage, BookingMessageSnapshot } from '@/lib/booking/communication-contracts';
import { BookingConversation } from '@/components/booking/booking-conversation';
import { bookingConversationUrl, bookingMessageAttempt, isBookingConversation, latestVisibleIncoming, mergeBookingConversation, requestBookingConversation } from '@/components/booking/booking-conversation-state';
import { bookingMessages } from '@/lib/i18n/booking-messages';

const bookingId = '12345678-1234-4123-8123-123456789012';
const otherBooking = '22345678-1234-4123-8123-123456789012';
const requestId = '32345678-1234-4123-8123-123456789012';
const message = (digit: string, sender: 'customer' | 'merchant', createdAt: string): BookingMessage => ({ id: `${digit}2345678-1234-4123-8123-123456789012`, bookingId, sender, createdAt, body: 'Message about this booking' });
const first = message('4', 'merchant', '2026-10-20T01:00:00.000Z');
const second = message('5', 'customer', '2026-10-20T01:01:00.000Z');
const third = message('6', 'merchant', '2026-10-20T01:02:00.000Z');
const snapshot = (messages: BookingMessage[]): BookingMessageSnapshot => ({ availability: 'available', messages, readState: { customerReadAt: null, merchantReadAt: null } });
afterEach(() => vi.useRealTimers());

describe('booking conversation scope and delivery', () => {
  it('uses the correct customer and partner operations endpoints', () => {
    expect(bookingConversationUrl(bookingId, false)).toBe(`/api/bookings/${bookingId}/messages`);
    expect(bookingConversationUrl(bookingId, true)).toBe(`/api/partner/operations/bookings/${bookingId}/messages`);
  });
  it('rejects messages from a different booking even when the response otherwise validates', async () => {
    expect(isBookingConversation(snapshot([first]), bookingId)).toBe(true);
    expect(isBookingConversation(snapshot([{ ...first, bookingId: otherBooking }]), bookingId)).toBe(false);
    const transport = vi.fn(async () => new Response(JSON.stringify(snapshot([{ ...first, bookingId: otherBooking }]))));
    await expect(requestBookingConversation(bookingConversationUrl(bookingId, false), bookingId, undefined, transport)).rejects.toThrow('NETWORK_ERROR');
  });
  it('reuses the exact message body and request UUID after an unknown result', async () => {
    const createId = vi.fn(() => requestId);
    const original = bookingMessageAttempt('  Is there anything I should bring?  ', null, createId);
    const retry = bookingMessageAttempt('A different draft must not replace the pending send', original, createId);
    expect(retry).toBe(original);
    expect(retry).toEqual({ requestId, body: 'Is there anything I should bring?' });
    expect(createId).toHaveBeenCalledTimes(1);
    const transport = vi.fn().mockRejectedValueOnce(new TypeError('Network failed')).mockResolvedValueOnce(new Response(JSON.stringify(snapshot([second])), { status: 201 }));
    const url = bookingConversationUrl(bookingId, false);
    const init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(original) };
    await expect(requestBookingConversation(url, bookingId, init, transport)).rejects.toThrow('Network failed');
    await expect(requestBookingConversation(url, bookingId, { ...init, body: JSON.stringify(retry) }, transport)).resolves.toEqual(snapshot([second]));
    expect(transport.mock.calls[0][1].body).toBe(transport.mock.calls[1][1].body);
  });
  it('rejects blank and oversized new messages without allocating a request key', () => {
    const createId = vi.fn(() => requestId);
    expect(() => bookingMessageAttempt('  ', null, createId)).toThrow('INVALID_REQUEST');
    expect(() => bookingMessageAttempt('x'.repeat(2001), null, createId)).toThrow('INVALID_REQUEST');
    expect(createId).not.toHaveBeenCalled();
  });
  it('ends a stalled request so the same message can be retried', async () => {
    vi.useFakeTimers();
    const transport = vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => { init?.signal?.addEventListener('abort', () => reject(new Error('TIMEOUT'))); }));
    const request = requestBookingConversation(bookingConversationUrl(bookingId, false), bookingId, undefined, transport);
    const result = expect(request).rejects.toThrow('TIMEOUT');
    await vi.advanceTimersByTimeAsync(15000);
    await result;
  });
  it('uses Korean for the partner conversation independently of customer language', () => {
    const $ = load(renderToStaticMarkup(<BookingConversation bookingId={bookingId} scope="" partner disabled />));
    expect($('section').attr('lang')).toBe('ko');
    expect($.text()).toContain('메시지를 확인하려면 다시 로그인해 주세요.');
    expect($.text()).not.toContain('Please sign in');
  });
  it('does not expose a composer or send action without an account scope', () => {
    const $ = load(renderToStaticMarkup(<BookingConversation bookingId={bookingId} scope="" />));
    expect($.text()).toContain('Please sign in again');
    expect($('textarea')).toHaveLength(0);
    expect($('form')).toHaveLength(0);
  });
});

describe('booking conversation visibility and polling', () => {
  it('only marks the latest actually visible incoming message, never hidden or outgoing messages', () => {
    const data = snapshot([first, second, third]);
    expect(latestVisibleIncoming(data, false, new Set([first.id, second.id]), true)).toBe(first.createdAt);
    expect(latestVisibleIncoming(data, false, new Set([first.id, second.id]), false)).toBeNull();
    expect(latestVisibleIncoming(data, false, new Set([second.id]), true)).toBeNull();
    expect(latestVisibleIncoming(data, true, new Set([first.id, second.id]), true)).toBe(second.createdAt);
    expect(latestVisibleIncoming(data, false, new Set([first.id, third.id]), true)).toBe(third.createdAt);
  });
  it('retains successful sends and monotonic read receipts when an earlier poll returns late', () => {
    const current = { ...snapshot([first, second, third]), readState: { customerReadAt: third.createdAt, merchantReadAt: second.createdAt } };
    const result = mergeBookingConversation(current, snapshot([first]));
    expect(result.messages).toEqual([first, second, third]);
    expect(result.readState).toEqual(current.readState);
    expect(mergeBookingConversation(result, snapshot([third, second])).messages).toHaveLength(3);
  });
  it('honors unavailable state instead of retaining prior conversation content', () => {
    const unavailable: BookingMessageSnapshot = { availability: 'unavailable', messages: [], readState: { customerReadAt: null, merchantReadAt: null } };
    expect(mergeBookingConversation(snapshot([first]), unavailable)).toEqual(unavailable);
    expect(latestVisibleIncoming(unavailable, false, new Set([first.id]), true)).toBeNull();
  });
  it('provides message controls and delivery notices in all translated languages', () => {
    for (const locale of ['ja', 'zh-CN', 'es', 'fr'] as const) for (const key of ['Booking messages', 'Messages', 'Message the venue', 'Message the customer', 'Send message', 'Retry sending', 'Read', 'Sent', 'We could not confirm delivery. Retry to check.']) expect(bookingMessages[locale]?.[key], `${locale}: ${key}`).toBeTruthy();
  });
});
