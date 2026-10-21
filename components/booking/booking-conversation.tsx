'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { SkeletonChips, SkeletonStatus } from '@/components/ui/skeleton';
import { ArrowDown, ArrowUp, MessageCircle } from 'lucide-react';
import type { BookingMessageInput, BookingMessageSnapshot } from '@/lib/booking/communication-contracts';
import { useLocale } from '@/lib/i18n/locale-provider';
import { bookingDate, bookingTime } from './customer-booking-state';
import { useVisibleBookingRefresh } from './use-booking-resource';
import { bookingConversationUrl, bookingMessageAttempt, bookingMessageError, laterMessageTime, latestVisibleIncoming, mergeBookingConversation, requestBookingConversation } from './booking-conversation-state';
import styles from './booking-conversation.module.css';

export type BookingConversationProps = { bookingId: string; partner?: boolean; scope: string; disabled?: boolean };

/** Keys prevent drafts, pending submissions and read markers carrying across accounts or bookings. */
export function BookingConversation({ bookingId, partner = false, scope, disabled = false }: BookingConversationProps) {
  return <ConversationContent key={`${scope}:${partner}:${bookingId}`} bookingId={bookingId} partner={partner} scope={scope} disabled={disabled} />;
}

const partnerCopy: Record<string, string> = {
  'Booking messages': '예약 메시지', 'Messages': '메시지', 'Seoul time': '서울 시간', 'Retry': '다시 시도',
  'Please sign in again to view your messages.': '메시지를 확인하려면 다시 로그인해 주세요.',
  'Messaging is unavailable for this booking.': '이 예약에서는 메시지를 이용할 수 없습니다.',
  'Loading messages…': '메시지를 불러오는 중…', 'Messages could not be loaded. Try again.': '메시지를 불러오지 못했습니다. 다시 시도해 주세요.',
  'We could not find this booking.': '예약을 찾을 수 없습니다.', 'Send a message about this booking.': '예약에 관한 메시지를 보내세요.',
  'You': '나', 'Customer': '고객', 'Venue': '매장', 'Read': '읽음', 'Sent': '전송됨', 'Latest messages': '최신 메시지',
  'Message the customer': '고객에게 메시지 보내기', 'Sending…': '전송 중…', 'Retry sending': '전송 다시 시도', 'Send message': '메시지 보내기',
  'You do not have permission to send messages for this booking.': '이 예약에 메시지를 보낼 권한이 없습니다.',
  'Enter a message of 1–2,000 characters.': '메시지를 1~2,000자로 입력해 주세요.',
  'We could not confirm delivery. Retry to check.': '전송 여부를 확인하지 못했습니다. 다시 시도하여 확인해 주세요.',
  'Messaging is read-only.': '현재는 메시지를 확인할 수만 있습니다.',
};

function ConversationContent({ bookingId, partner = false, scope, disabled = false }: BookingConversationProps) {
  const { t: customerTranslate, locale: customerLocale } = useLocale();
  const locale = partner ? 'ko-KR' : customerLocale;
  const t = (message: string) => partner ? partnerCopy[message] ?? message : customerTranslate(message);
  const url = scope ? bookingConversationUrl(bookingId, partner) : null;
  const [snapshot, setSnapshot] = useState<BookingMessageSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<BookingMessageInput | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [atBottom, setAtBottom] = useState(true);
  const alive = useRef(true);
  const request = useRef<AbortController | null>(null);
  const sendLock = useRef(false);
  const pane = useRef<HTMLDivElement>(null);
  const bottom = useRef(true);
  const initialized = useRef(false);
  const latestSeen = useRef<string | null>(null);
  const readAt = useRef<string | null>(null);
  const marking = useRef(false);
  const sender = partner ? 'merchant' : 'customer';
  const incoming = partner ? 'customer' : 'merchant';
  const viewerReadAt = snapshot ? partner ? snapshot.readState.merchantReadAt : snapshot.readState.customerReadAt : null;
  const otherReadAt = snapshot ? partner ? snapshot.readState.customerReadAt : snapshot.readState.merchantReadAt : null;
  readAt.current = laterMessageTime(readAt.current, viewerReadAt);
  useEffect(() => { alive.current = true; return () => { alive.current = false; request.current?.abort(); }; }, []);

  const refresh = useCallback(async () => {
    if (!url) { setLoading(false); return; }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    try {
      const data = await requestBookingConversation(url, bookingId, { signal: controller.signal });
      if (!alive.current || request.current !== controller) return;
      setSnapshot(previous => mergeBookingConversation(previous, data));
      setLoadError('');
    } catch (reason) {
      if (alive.current && request.current === controller) setLoadError(reason instanceof Error ? reason.message : 'NETWORK_ERROR');
    } finally {
      if (alive.current && request.current === controller) setLoading(false);
    }
  }, [bookingId, url]);
  useEffect(() => { void refresh(); }, [refresh]);
  useVisibleBookingRefresh(refresh, !!url);

  const markSeen = useCallback(async (timestamp: string) => {
    latestSeen.current = laterMessageTime(latestSeen.current, timestamp);
    if (!url || marking.current || document.visibilityState !== 'visible') return;
    marking.current = true;
    try {
      while (alive.current && document.visibilityState === 'visible' && latestSeen.current && (!readAt.current || Date.parse(latestSeen.current) > Date.parse(readAt.current))) {
        const seen = latestSeen.current;
        const data = await requestBookingConversation(url, bookingId, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ readAt: seen }) });
        if (!alive.current) return;
        setSnapshot(previous => mergeBookingConversation(previous, data));
        const accepted = partner ? data.readState.merchantReadAt : data.readState.customerReadAt;
        readAt.current = laterMessageTime(readAt.current, accepted);
        if (!accepted || Date.parse(accepted) < Date.parse(seen)) break;
      }
    } catch {
      // A later visible refresh retries the receipt; delivery itself is unaffected.
    } finally { marking.current = false; }
  }, [bookingId, partner, url]);

  useEffect(() => {
    if (!snapshot || snapshot.availability !== 'available' || !pane.current || typeof IntersectionObserver === 'undefined') return;
    const visibleIds = new Set<string>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.messageId;
        if (!id) continue;
        if (entry.isIntersecting && entry.intersectionRatio >= 1) visibleIds.add(id); else visibleIds.delete(id);
      }
      const seen = latestVisibleIncoming(snapshot, partner, visibleIds, document.visibilityState === 'visible');
      if (seen) void markSeen(seen);
    }, { threshold: 1 });
    // Observe the incoming message's timestamp, so reaching its end counts as seeing it.
    const markers = pane.current.querySelectorAll<HTMLElement>(`time[data-sender="${incoming}"]`);
    markers.forEach(marker => observer.observe(marker));
    const onVisible = () => { if (document.visibilityState === 'visible') markers.forEach(marker => { observer.unobserve(marker); observer.observe(marker); }); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', onVisible); };
  }, [snapshot, partner, incoming, markSeen]);

  const latestId = snapshot?.messages.at(-1)?.id;
  useEffect(() => {
    if (pane.current && (!initialized.current || bottom.current)) {
      pane.current.scrollTop = pane.current.scrollHeight;
      initialized.current = true;
    }
  }, [latestId]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || sendLock.current || !url || snapshot?.availability !== 'available') return;
    let attempt: BookingMessageInput;
    try { attempt = bookingMessageAttempt(draft, pending, () => crypto.randomUUID()); }
    catch { setSendError('INVALID_REQUEST'); return; }
    sendLock.current = true; setSending(true); setSendError(''); setPending(attempt);
    try {
      const data = await requestBookingConversation(url, bookingId, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(attempt) });
      if (data.availability !== 'available') throw new Error('BOOKING_MESSAGES_UNAVAILABLE');
      if (!alive.current) return;
      bottom.current = true; setAtBottom(true);
      setSnapshot(previous => mergeBookingConversation(previous, data));
      setPending(null); setDraft('');
    } catch (reason) {
      if (!alive.current) return;
      const code = reason instanceof Error ? reason.message : 'NETWORK_ERROR';
      setSendError(code);
      if (code === 'INVALID_REQUEST') setPending(null);
      if (code === 'BOOKING_MESSAGES_UNAVAILABLE') void refresh();
    } finally { if (alive.current) { sendLock.current = false; setSending(false); } }
  }

  return <section className={styles.conversation} lang={partner ? 'ko' : undefined} aria-label={t('Booking messages')}>
    <div className={styles.heading}><h2><MessageCircle aria-hidden="true" />{t('Messages')}</h2><span>{t('Seoul time')}</span></div>
    {!url ? <p className={styles.notice}>{t('Please sign in again to view your messages.')}</p> : snapshot?.availability === 'unavailable' ? <p className={styles.notice}>{t('Messaging is unavailable for this booking.')}</p> : <>
      {loading && !snapshot && <SkeletonStatus label={t('Loading messages…')}><SkeletonChips count={1} width="72%" height={44} /><SkeletonChips count={1} width="58%" height={44} className="skel-chips-end" /></SkeletonStatus>}
      {loadError && <div className={styles.error} role="alert"><span>{t(loadError === 'AUTH_REQUIRED' || loadError === 'BOOKING_NOT_FOUND' ? bookingMessageError(loadError) : 'Messages could not be loaded. Try again.')}</span><button type="button" onClick={() => void refresh()}>{t('Retry')}</button></div>}
      {snapshot && <>
        <div ref={pane} className={styles.thread} role="log" aria-label={t('Booking messages')} aria-live="polite" aria-relevant="additions" tabIndex={0} onScroll={() => { const element = pane.current; if (element) { bottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 32; setAtBottom(bottom.current); } }}>
          {!snapshot.messages.length ? <p className={styles.empty}>{t(partner ? 'Send a message about this booking.' : 'Ask the venue a question about your visit.')}</p> : snapshot.messages.map(message => <article className={styles.message} key={message.id} data-own={message.sender === sender}>
            <p className={styles.sender}>{t(message.sender === sender ? 'You' : partner ? 'Customer' : 'Venue')}</p><p className={styles.body}>{message.body}</p>
            <div className={styles.meta}><time data-message-id={message.id} data-sender={message.sender} dateTime={message.createdAt} title={`${bookingDate(message.createdAt, locale)} · ${t('Seoul time')}`}>{new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Seoul', month: 'short', day: 'numeric' }).format(new Date(message.createdAt))} · {bookingTime(message.createdAt, locale)}</time>{message.sender === sender && <span>{t(otherReadAt && Date.parse(message.createdAt) <= Date.parse(otherReadAt) ? 'Read' : 'Sent')}</span>}</div>
          </article>)}
        </div>
        {!atBottom && <button type="button" className={styles.latest} onClick={() => { if (pane.current) pane.current.scrollTop = pane.current.scrollHeight; bottom.current = true; setAtBottom(true); }}>{t('Latest messages')}<ArrowDown aria-hidden="true" /></button>}
        <form className={styles.composer} onSubmit={send}>
          <label>{t(partner ? 'Message the customer' : 'Message the venue')}<textarea required maxLength={2000} rows={3} value={draft} readOnly={disabled || sending || !!pending} onChange={event => { setDraft(event.target.value); setSendError(''); }} /></label>
          <div className={styles.composerActions}><span>{draft.length.toLocaleString(locale)} / 2,000</span><button type="submit" disabled={disabled || sending || (!pending && !draft.trim())}>{t(sending ? 'Sending…' : pending ? 'Retry sending' : 'Send message')}<ArrowUp aria-hidden="true" /></button></div>
          {disabled && <p className={styles.notice}>{t('Messaging is read-only.')}</p>}
          {sendError && <p className={styles.error} role="alert">{t(bookingMessageError(sendError))}</p>}
        </form>
      </>}
    </>}
  </section>;
}
