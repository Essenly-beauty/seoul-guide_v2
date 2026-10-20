'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { booking as validBooking, type Booking, type BookingPartnerAction, type BookingStatus } from '@/lib/booking/contracts';
import { record } from '@/lib/partner/contracts';
import styles from './partner.module.css';

export const bookingStatusLabels: Record<BookingStatus, string> = {
  requested: '확인 대기', confirmed: '예약 확정', cancelled: '취소', completed: '방문 완료', no_show: '미방문',
};
const actionLabels: Record<BookingPartnerAction, string> = { confirm: '예약 확정', cancel: '예약 취소', complete: '방문 완료', no_show: '미방문 처리' };
const actionStatus: Record<BookingPartnerAction, BookingStatus> = { confirm: 'confirmed', cancel: 'cancelled', complete: 'completed', no_show: 'no_show' };
const statusTones = { requested: 'warning', confirmed: 'success', cancelled: 'dim', completed: 'info', no_show: 'warning' } as const;
const dateFormat = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
const timeFormat = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export function partnerBookingDate(startAt: string): string {
  return new Date(Date.parse(startAt) + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
export function partnerBookingActions(booking: Booking, now: number): BookingPartnerAction[] {
  if (booking.status === 'requested') return ['confirm', 'cancel'];
  if (booking.status === 'confirmed') return Date.parse(booking.startAt) <= now ? ['complete', 'no_show', 'cancel'] : ['cancel'];
  return [];
}
export function filterPartnerBookings(bookings: Booking[], from: string, until: string, status: BookingStatus | 'all'): Booking[] {
  return bookings.filter((booking) => {
    const date = partnerBookingDate(booking.startAt);
    return (!from || date >= from) && (!until || date <= until) && (status === 'all' || booking.status === status);
  }).sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt) || a.id.localeCompare(b.id));
}
export function partnerBookingError(code: unknown): string {
  switch (code) {
    case 'AUTH_REQUIRED': return '로그인이 만료되었습니다. 다시 로그인해 주세요.';
    case 'PARTNER_FORBIDDEN': return '이 매장의 예약을 조회하거나 변경할 권한이 없습니다.';
    case 'PARTNER_READ_ONLY': return '현재 매장은 읽기 전용입니다. 예약 상태를 변경할 수 없습니다.';
    case 'BOOKING_NOT_FOUND': return '예약을 찾을 수 없습니다. 최신 예약 목록을 다시 확인해 주세요.';
    case 'BOOKING_CONFLICT': return '고객 또는 다른 관리자가 예약을 변경했거나 처리 가능한 시간이 아닙니다. 최신 상태를 확인한 뒤 다시 시도해 주세요.';
    case 'INVALID_REQUEST': return '예약 변경 요청을 확인해 주세요. 최신 목록을 불러온 뒤 다시 시도해 주세요.';
    default: return '예약 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.';
  }
}

type BookingChange = { kind: 'saved'; booking: Booking } | { kind: 'rejected'; code: unknown } | { kind: 'unconfirmed' };
export async function changePartnerBooking(booking: Booking, action: BookingPartnerAction, signal: AbortSignal, request: typeof fetch = fetch): Promise<BookingChange> {
  try {
    const response = await request(`/api/partner/bookings/${encodeURIComponent(booking.id)}`, {
      method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, expectedUpdatedAt: booking.updatedAt }), signal,
    });
    const body: unknown = await response.json();
    if (!response.ok) return { kind: 'rejected', code: record(body) ? body.code : undefined };
    if (!record(body) || !validBooking(body.booking) || body.booking.id !== booking.id || body.booking.placeId !== booking.placeId || body.booking.status !== actionStatus[action]) return { kind: 'unconfirmed' };
    return { kind: 'saved', booking: body.booking };
  } catch { return { kind: 'unconfirmed' }; }
}

export function PartnerBookingList({ bookings, loading, filtered, disabled, busyId, now, onAction }: {
  bookings: Booking[] | null; loading: boolean; filtered: boolean; disabled: boolean; busyId: string | null; now: number;
  onAction: (booking: Booking, action: BookingPartnerAction) => void;
}) {
  if (bookings === null) return <p className={styles.empty} role="status">{loading ? '예약을 불러오는 중입니다…' : '예약 목록을 불러오지 못했습니다. 다시 조회해 주세요.'}</p>;
  if (!bookings.length) return <p className={styles.empty}>{filtered ? '선택한 날짜와 상태에 해당하는 예약이 없습니다.' : '아직 접수된 예약이 없습니다. 고객이 예약하면 이곳에 표시됩니다.'}</p>;
  return <ul className={styles.bookingList}>{bookings.map((booking) => <li key={booking.id} className={styles.bookingItem}>
    <div className={styles.bookingHeading}><div><p className={styles.bookingTime}><time dateTime={booking.startAt}>{dateFormat.format(new Date(booking.startAt))} · {timeFormat.format(new Date(booking.startAt))}</time>–<time dateTime={booking.serviceEndAt}>{timeFormat.format(new Date(booking.serviceEndAt))}</time></p><h2>{booking.customerName}</h2></div><Badge tone={statusTones[booking.status]}>{bookingStatusLabels[booking.status]}</Badge></div>
    <p className={styles.bookingService}>{booking.serviceName}{booking.staffName ? ` · ${booking.staffName}` : ' · 담당자 지정 없음'}</p>
    <p className={styles.muted}>{booking.totalKrw.toLocaleString('ko-KR')}원 · 현장 결제</p>
    {booking.status === 'cancelled' && <p className={styles.hint}>{booking.cancelledBy === 'customer' ? '고객이 취소한 예약입니다.' : '매장에서 취소한 예약입니다.'}</p>}
    <details className={styles.bookingDetails}><summary>고객 연락처와 예약 상세</summary><dl>
      <dt>연락처</dt><dd>{booking.phone ? <a href={`tel:${booking.phone.replace(/[^+\d]/g, '')}`}>{booking.phone}</a> : '연락처 없음'}</dd>
      <dt>고객 요청사항</dt><dd className={styles.bookingNotes}>{booking.notes || '요청사항 없음'}</dd>
      <dt>예약 번호</dt><dd>{booking.id}</dd>
      <dt>접수 시간</dt><dd><time dateTime={booking.createdAt}>{partnerBookingDate(booking.createdAt)} {timeFormat.format(new Date(booking.createdAt))}</time></dd>
      <dt>최근 변경</dt><dd><time dateTime={booking.updatedAt}>{partnerBookingDate(booking.updatedAt)} {timeFormat.format(new Date(booking.updatedAt))}</time></dd>
    </dl></details>
    {partnerBookingActions(booking, now).length > 0 && <div className={styles.actions}>{partnerBookingActions(booking, now).map((action) => <Button key={action} variant={action === 'confirm' || action === 'complete' ? 'primary' : 'secondary'} disabled={disabled || busyId !== null} aria-label={`${booking.customerName} ${actionLabels[action]}`} onClick={() => onAction(booking, action)}>{busyId === booking.id ? '처리 중…' : actionLabels[action]}</Button>)}</div>}
  </li>)}</ul>;
}

export { PartnerBookingWorkspace as PartnerBookings } from './partner-booking-workspace';
