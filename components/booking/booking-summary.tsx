'use client';
import { CalendarDays, Scissors, UserRound } from 'lucide-react';
import { useLocale } from '@/lib/i18n/locale-provider';
import { bookingDate, bookingTime, type BookingService, type BookingSlot, type BookingStaff, type CustomerBooking } from './customer-booking-state';
import { BookingPhoto, type BookingVenue } from './booking-ui';
import { BookingLocationCard } from './booking-location';
import styles from './customer-booking.module.css';
export function BookingStatus({ status }: { status: CustomerBooking['status'] }) {
  const { t } = useLocale();
  const labels = { requested: 'Awaiting confirmation', confirmed: 'Confirmed', cancelled: 'Cancelled', completed: 'Completed', no_show: 'Missed appointment' };
  return <span className={styles.status} data-status={status}>{t(labels[status])}</span>;
}
export function BookingReview({ merchantName, service, staff, slot, mode, paymentMode, venue, placeId, onEdit, needsStaff = true }: { merchantName: string; service: BookingService; staff?: BookingStaff; slot: BookingSlot; mode: 'request' | 'instant'; paymentMode: 'pay_at_venue'; venue?: BookingVenue; placeId?: string; onEdit?: (step: number) => void; needsStaff?: boolean }) {
  const { t, locale } = useLocale();
  const rows = [
    { id: 0, label: 'Service', icon: Scissors, title: service.name, description: t('{minutes} min', { minutes: service.durationMinutes }), editable: true },
    { id: 1, label: 'Staff', icon: UserRound, title: staff?.name ?? t('Venue team'), description: staff?.title, editable: needsStaff },
    { id: 2, label: 'Date & time', icon: CalendarDays, title: bookingDate(slot.startAt, locale), description: `${bookingTime(slot.startAt, locale)}–${bookingTime(slot.serviceEndAt, locale)} · ${t('Seoul time')}`, editable: true },
  ];
  return <section className={styles.review} aria-label={t('Booking summary')}>
    <div className={styles.summaryVenue}><BookingPhoto width={venue?.photoWidth} height={venue?.photoHeight} src={venue?.photoUrl} name={merchantName} compact /><div><h2>{merchantName}</h2>{!placeId && venue?.address && <p>{venue.address}</p>}</div></div>
    <dl className={styles.reviewDetails}>{rows.map(row => <div className={styles.detailRow} key={row.id}><row.icon aria-hidden="true" /><div className={styles.detailCopy}><dt className={styles.srOnly}>{t(row.label)}</dt><dd>{row.title}{row.description && <small>{row.description}</small>}</dd></div>{onEdit && row.editable && <button type="button" className={styles.textButton} aria-label={t('Edit {field}', { field: t(row.label) })} onClick={() => onEdit(row.id)}>{t('Edit')}</button>}</div>)}</dl>
    {placeId && <BookingLocationCard placeId={placeId}/>}
    <div className={styles.amounts}><div className={styles.total}><span>{t('Total')}</span><strong>₩{service.priceKrw.toLocaleString(locale)}</strong></div>{paymentMode === 'pay_at_venue' && <div><span>{t('Pay at the venue')}</span><span>₩{service.priceKrw.toLocaleString(locale)}</span></div>}</div>
    <div className={styles.policy}><strong>{t(mode === 'request' ? 'The venue will confirm your request.' : 'Your booking is confirmed when you submit.')}</strong><p>{t('No payment is collected online.')}</p><p>{t('Cancel before your visit in My bookings.')}</p></div>
  </section>;
}
