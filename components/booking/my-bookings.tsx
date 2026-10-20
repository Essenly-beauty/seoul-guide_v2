'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Check, Clock3, X } from 'lucide-react';
import { BottomNav } from '@/components/ui/bottom-nav';
import { useAuthUser } from '@/lib/auth/use-auth';
import { useLocale } from '@/lib/i18n/locale-provider';
import { authLinkWithNext } from '@/lib/auth-return';
import { booking, bookingList, type Booking } from '@/lib/booking/contracts';
import { routes } from '@/lib/routes';
import { bookingDate, bookingErrorMessage, bookingTime } from './customer-booking-state';
import { useBookingResource } from './use-booking-resource';
import { BookingStatus } from './booking-summary';
import { CancelBookingButton } from './cancel-booking-button';
import { BookingConversation } from './booking-conversation';
import { BookingLocationCard } from './booking-location';
import { BookingArrow, BookingFooter, BookingHeader, BookingHeading, BookingTicket } from './booking-ui';
import styles from './customer-booking.module.css';
function validList(value: unknown): value is { bookings: Booking[] } { return !!value && typeof value === 'object' && 'bookings' in value && bookingList(value.bookings); }
function validBooking(value: unknown): value is { booking: Booking } { return !!value && typeof value === 'object' && 'booking' in value && booking(value.booking); }
function AuthPrompt({ next }: { next: string }) {
  const { t } = useLocale();
  return <div className={styles.empty}><h2>{t('Your bookings, in one place')}</h2><p className={styles.hint}>{t('Sign in to view and manage your appointments.')}</p><Link className={styles.primary} href={authLinkWithNext(routes.signIn, next)}>{t('Sign in')}</Link></div>;
}
export function MyBookings() {
  const { t, locale } = useLocale();
  const { user, loading } = useAuthUser();
  const resource = useBookingResource(user ? '/api/bookings' : null, validList, user?.id);
  const [overrides, setOverrides] = useState<{ userId: string; values: Record<string, Booking> } | null>(null);
  useEffect(() => { setOverrides(null); }, [user?.id]);
  const bookings = (resource.data?.bookings ?? []).map(item => {
    const changed = overrides?.userId === user?.id ? overrides?.values[item.id] : undefined;
    return changed && Date.parse(changed.updatedAt) >= Date.parse(item.updatedAt) ? changed : item;
  }).sort((a, b) => Date.parse(b.startAt) - Date.parse(a.startAt));
  return <div className={styles.shell}><BookingHeader backHref={routes.menu} title={t('My bookings')} /><main className={`${styles.scroll} ${styles.page}`}>
    <h1 className={styles.srOnly}>{t('My bookings')}</h1><p className={styles.hint}>{t('Your appointments and their latest status.')}</p>
    {loading ? <p role="status">{t('Loading bookings…')}</p> : !user || resource.error === 'AUTH_REQUIRED' ? <AuthPrompt next={routes.bookings} /> : resource.error ? <div className={styles.empty}><p role="alert">{t(bookingErrorMessage(resource.error))}</p><button className={styles.secondary} onClick={resource.refresh}>{t('Retry')}</button></div> : resource.loading && !resource.data ? <p role="status">{t('Loading bookings…')}</p> : !bookings.length ? <div className={styles.empty}><h2>{t('No bookings yet')}</h2><p className={styles.hint}>{t('Find a venue and choose an available service to get started.')}</p><Link className={styles.primary} href={routes.map}>{t('Explore places')}<BookingArrow /></Link></div> : <ul className={styles.list}>{bookings.map(item => <li key={item.id}><article className={styles.bookingCard}>
      <BookingStatus status={item.status} /><h2>{item.merchantName}</h2><p>{item.serviceName}{item.staffName && <> · {item.staffName}</>}</p><p className={styles.bookingDate}>{bookingDate(item.startAt, locale)} · {bookingTime(item.startAt, locale)}</p><p className={styles.caption}>{t('Seoul time')}</p>
      <Link href={routes.booking(item.id)} className={styles.secondary}>{t('View booking')}</Link>
      {['requested', 'confirmed'].includes(item.status) && Date.parse(item.startAt) > Date.now() && <CancelBookingButton key={`${user?.id}:${item.id}`} text disabled={resource.loading} value={item} onCancelled={next => { if (user) setOverrides(previous => ({ userId: user.id, values: { ...(previous?.userId === user.id ? previous.values : {}), [next.id]: next } })); resource.refresh(); }} onRefresh={resource.refresh} />}
    </article></li>)}</ul>}
  </main><BottomNav active="menu" /></div>;
}
export function BookingDetail({ id }: { id: string }) {
  const { t, locale } = useLocale();
  const { user, loading } = useAuthUser();
  const resource = useBookingResource(user ? `/api/bookings/${encodeURIComponent(id)}` : null, validBooking, user?.id);
  const [override, setOverride] = useState<{ userId: string; value: Booking } | null>(null);
  const updated = override?.userId === user?.id ? override?.value : null;
  useEffect(() => { setOverride(null); }, [id, user?.id]);
  const fromServer = resource.data?.booking.id === id ? resource.data.booking : null;
  const value = updated && (!fromServer || Date.parse(updated.updatedAt) >= Date.parse(fromServer.updatedAt)) ? updated : fromServer;
  const canCancel = value && ['requested', 'confirmed'].includes(value.status) && Date.parse(value.startAt) > Date.now();
  const statusMessage = value ? value.status === 'requested' ? 'The venue will confirm your request.' : value.status === 'confirmed' ? 'Your appointment is confirmed.' : value.status === 'cancelled' ? value.cancelledBy === 'merchant' ? 'The venue cancelled this booking.' : 'You cancelled this booking.' : value.status === 'completed' ? 'Your visit is complete.' : 'The venue marked this appointment as missed.' : '';
  return <div className={styles.shell}><BookingHeader backHref={routes.bookings} title={t('Booking details')} /><main className={`${styles.scroll} ${styles.page}`}>
    {loading ? <p role="status">{t('Loading booking details…')}</p> : !user || resource.error === 'AUTH_REQUIRED' ? <AuthPrompt next={routes.booking(id)} /> : resource.error ? <div className={styles.empty}><p role="alert">{t(bookingErrorMessage(resource.error))}</p><button className={styles.secondary} onClick={resource.refresh}>{t('Retry')}</button><Link className={styles.secondary} href={routes.bookings}>{t('My bookings')}</Link></div> : !value ? <p role="status">{t('Loading booking details…')}</p> : <>
      <div className={styles.resultSymbol} aria-hidden="true">{value.status === 'requested' ? <Clock3 /> : ['confirmed', 'completed'].includes(value.status) ? <Check /> : <X />}</div>
      <BookingHeading title={t(statusMessage)} />
      <BookingTicket value={value}><BookingStatus status={value.status} /></BookingTicket>
      <BookingLocationCard placeId={value.placeId}/>
      <div className={styles.amounts}><div className={styles.total}><span>{t('Total')}</span><strong>₩{value.totalKrw.toLocaleString(locale)}</strong></div></div>
      {value.paymentMode === 'pay_at_venue' && <div className={styles.policy}><strong>{t('Pay at the venue')}</strong><p>{t('No payment is collected online.')}</p></div>}
      <dl className={styles.customerDetails}><div><dt>{t('Full name')}</dt><dd>{value.customerName}</dd></div><div><dt>{t('Phone number')}</dt><dd>{value.phone || '—'}</dd></div>{value.notes && <div><dt>{t('Notes')}</dt><dd>{value.notes}</dd></div>}</dl>
      <div className={styles.detailActions}><Link href={routes.place(value.placeId)} className={styles.secondary}>{t('View venue')}</Link>{canCancel && <CancelBookingButton key={`${user?.id}:${value.id}`} text disabled={resource.loading} value={value} onCancelled={next => { if (user) setOverride({ userId: user.id, value: next }); }} onRefresh={resource.refresh} />}</div>
      <BookingConversation bookingId={value.id} scope={user.id} /><p className={styles.reference}>{t('Booking reference')}<br />{value.id}</p>
    </>}
  </main>{value && user && !resource.error && <BookingFooter><Link href={routes.bookings} className={styles.primary}>{t('My bookings')}<BookingArrow /></Link></BookingFooter>}</div>;
}
