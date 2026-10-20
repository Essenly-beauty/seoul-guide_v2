'use client';
import Link from 'next/link';
import { useLocale } from '@/lib/i18n/locale-provider';
import { routes } from '@/lib/routes';
import styles from './customer-booking.module.css';
/** Legacy trigger now opens the venue's real booking flow. */
export function BookingSheet({ placeId, triggerLabel = 'Book a visit', triggerStyle }: { placeId: string; triggerLabel?: string; triggerStyle?: React.CSSProperties }) {
  const { t } = useLocale();
  return <Link className={styles.primary} style={triggerStyle} href={routes.placeBooking(placeId)}>{t(triggerLabel)}</Link>;
}
