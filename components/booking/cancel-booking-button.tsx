'use client';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDialogFocus } from '@/components/ui/use-dialog-focus';
import { useLocale } from '@/lib/i18n/locale-provider';
import { bookingErrorMessage, cancelBooking, type CustomerBooking } from './customer-booking-state';
import { BookingArrow, BookingFooter, BookingHeader, BookingHint, BookingTicket } from './booking-ui';
import styles from './customer-booking.module.css';

export function CancelBookingButton({ value, onCancelled, onRefresh, disabled = false, text = false }: { disabled?: boolean; text?: boolean; value: CustomerBooking; onCancelled: (booking: CustomerBooking) => void; onRefresh: () => void }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const keepRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useDialogFocus<HTMLDivElement>(open, () => { if (!lock.current) setOpen(false); }, keepRef);
  async function cancel() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const cancelled = await cancelBooking(value.id);
      onCancelled(cancelled); setOpen(false);
    } catch (reason) { const code = reason instanceof Error ? reason.message : 'NETWORK_ERROR'; setError(code === 'BOOKING_CONFLICT' ? 'INVALID_STATUS' : code); onRefresh(); }
    finally { lock.current = false; setBusy(false); }
  }
  return <>
    <button type="button" disabled={disabled} className={text ? styles.textButton : styles.secondary} onClick={() => { setError(''); setOpen(true); }}>{t('Cancel booking')}</button>
    {open && createPortal(<div className={styles.backdrop}><div ref={dialogRef} className={styles.cancelScreen} role="dialog" aria-modal="true" aria-labelledby="booking-cancel-title" aria-describedby="booking-cancel-description" tabIndex={-1}>
      <BookingHeader title={t('Cancel booking')} onBack={() => { if (!busy) setOpen(false); }} disabled={busy} />
      <div className={`${styles.scroll} ${styles.page}`}>
        <header className={styles.heading}><h1 id="booking-cancel-title">{t('Cancel this booking?')}</h1><p id="booking-cancel-description">{t('Your appointment will be released. This cannot be undone.')}</p></header>
        <BookingTicket value={value} />
        <BookingHint>{t('No payment is collected online.')}</BookingHint>
        {error && <p className={styles.error} role="alert">{t(bookingErrorMessage(error))}</p>}
        <button ref={keepRef} type="button" disabled={busy} className={styles.textButton} onClick={() => setOpen(false)}>{t('Keep booking')}</button>
      </div>
      <BookingFooter><button type="button" disabled={busy} className={styles.primary} onClick={() => void cancel()}>{t(busy ? 'Cancelling…' : 'Cancel booking')}{!busy && <BookingArrow />}</button></BookingFooter>
    </div></div>, document.body)}
  </>;
}
