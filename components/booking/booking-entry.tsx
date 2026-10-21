'use client';
import Link from 'next/link';
import { SkeletonChips, SkeletonLines, SkeletonList, SkeletonStatus } from '@/components/ui/skeleton';
import { bookingCatalog } from '@/lib/booking/contracts';
import { useLocale } from '@/lib/i18n/locale-provider';
import { routes } from '@/lib/routes';
import { useBookingResource } from './use-booking-resource';
import styles from './customer-booking.module.css';
export function BookingEntry({ placeId }: { placeId: string }) {
  const { t } = useLocale();
  const { data, loading, error, refresh } = useBookingResource(`/api/places/${encodeURIComponent(placeId)}/booking`, bookingCatalog);
  return <div className={styles.entry}>
    {loading ? <SkeletonStatus label={t('Checking booking availability…')}><SkeletonChips count={1} width="100%" height={48} /><SkeletonLines lines={1} widths={['62%']} lineHeight={11} /></SkeletonStatus> : error ? <><p className={styles.hint}>{t('Booking availability is temporarily unavailable.')}</p><button className={styles.secondary} onClick={refresh}>{t('Retry')}</button></> : data?.status === 'available' && data.services.length ? <><Link className={styles.primary} href={routes.placeBooking(placeId)}>{t('Book a visit')}</Link><p className={styles.hint}>{t(data.mode === 'request' ? 'The venue will confirm your request.' : 'Choose a time and confirm your booking.')}</p></> : <p className={styles.hint}>{t('Booking on MYSEOULDROP is not available for this venue yet.')}</p>}
  </div>;
}
