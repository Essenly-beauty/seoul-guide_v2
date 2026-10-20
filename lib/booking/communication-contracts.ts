import { boundedString, exactKeys, integer, record, uuid } from '@/lib/partner/contracts';
import { bookingTimestamp } from './contracts';

export type PartnerCustomerNote = { id: string; notes: string; updatedAt: string };
export type PartnerCustomerNoteInput = { notes: string; expectedUpdatedAt: string };
export type BookingMessage = { id: string; bookingId: string; body: string; sender: 'customer' | 'merchant'; createdAt: string };
export type BookingMessageReadState = { customerReadAt: string | null; merchantReadAt: string | null };
export type BookingMessageSnapshot = {
  availability: 'available' | 'unavailable'; messages: BookingMessage[]; readState: BookingMessageReadState;
};
export type BookingMessageInput = { requestId: string; body: string };
export type BookingMessageReadInput = { readAt: string };
export type PartnerMessageThread = { bookingId: string; lastMessage: BookingMessage; unreadCount: number; readState: BookingMessageReadState };
export type BookingCommunicationExport = { messages: BookingMessage[]; customerNotes: (PartnerCustomerNote & { merchantName: string })[] };

export function partnerCustomerNote(value: unknown): value is PartnerCustomerNote {
  return record(value) && exactKeys(value, ['id', 'notes', 'updatedAt']) && uuid(value.id) && boundedString(value.notes, 2000) && bookingTimestamp(value.updatedAt);
}
export function partnerCustomerNoteInput(value: unknown): value is PartnerCustomerNoteInput {
  return record(value) && exactKeys(value, ['notes', 'expectedUpdatedAt']) && boundedString(value.notes, 2000) && bookingTimestamp(value.expectedUpdatedAt);
}
export function bookingMessage(value: unknown): value is BookingMessage {
  return record(value) && exactKeys(value, ['id', 'bookingId', 'body', 'sender', 'createdAt']) && uuid(value.id) && uuid(value.bookingId) &&
    boundedString(value.body, 2000) && value.body.trim().length > 0 && ['customer', 'merchant'].includes(String(value.sender)) && bookingTimestamp(value.createdAt);
}
function messageList(value: unknown): value is BookingMessage[] {
  if (!Array.isArray(value) || value.length > 10000) return false;
  for (let index = 0; index < value.length; index += 1) if (!Object.hasOwn(value, index) || !bookingMessage(value[index])) return false;
  return new Set(value.map((item) => item.id.toLowerCase())).size === value.length;
}
function readState(value: unknown): value is BookingMessageReadState {
  return record(value) && exactKeys(value, ['customerReadAt', 'merchantReadAt']) &&
    (value.customerReadAt === null || bookingTimestamp(value.customerReadAt)) && (value.merchantReadAt === null || bookingTimestamp(value.merchantReadAt));
}
export function bookingMessageSnapshot(value: unknown): value is BookingMessageSnapshot {
  return record(value) && exactKeys(value, ['availability', 'messages', 'readState']) &&
    ['available', 'unavailable'].includes(String(value.availability)) && messageList(value.messages) && readState(value.readState);
}
export function bookingMessageInput(value: unknown): value is BookingMessageInput {
  return record(value) && exactKeys(value, ['requestId', 'body']) && uuid(value.requestId) && boundedString(value.body, 2000) && value.body.trim().length > 0;
}
export function bookingMessageReadInput(value: unknown): value is BookingMessageReadInput {
  return record(value) && exactKeys(value, ['readAt']) && bookingTimestamp(value.readAt);
}
export function partnerMessageThreads(value: unknown): value is PartnerMessageThread[] {
  if (!Array.isArray(value) || value.length > 10000) return false;
  for (let index = 0; index < value.length; index += 1) {
    const item: unknown = value[index];
    if (!Object.hasOwn(value, index) || !record(item) || !exactKeys(item, ['bookingId', 'lastMessage', 'unreadCount', 'readState']) ||
      !uuid(item.bookingId) || !bookingMessage(item.lastMessage) || item.lastMessage.bookingId !== item.bookingId ||
      !integer(item.unreadCount, 0) || !readState(item.readState)) return false;
  }
  return new Set(value.map((item) => item.bookingId.toLowerCase())).size === value.length;
}
export function bookingCommunicationExport(value: unknown): value is BookingCommunicationExport {
  if (!record(value) || !exactKeys(value, ['messages', 'customerNotes']) || !messageList(value.messages) || !Array.isArray(value.customerNotes) || value.customerNotes.length > 10000) return false;
  for (const note of value.customerNotes) {
    if (!record(note)) return false;
    const { merchantName, ...customerNote } = note;
    if (!boundedString(merchantName, 120) || merchantName.trim().length === 0 || !partnerCustomerNote(customerNote)) return false;
  }
  return true;
}
