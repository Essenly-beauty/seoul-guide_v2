'use client';
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Clock3, Info, Scissors, UserRound, X } from 'lucide-react';
import type { MerchantMedia } from '@/lib/partner/media-contracts';
import { useLocale } from '@/lib/i18n/locale-provider';
import { bookingCalendarLabel, bookingDate, bookingDateWindow, bookingPrice, bookingTime, shiftBookingDate, type BookingService, type CustomerBooking } from './customer-booking-state';
import styles from './customer-booking.module.css';

export type BookingVenue = { name?: string; photoUrl?: string; photoWidth?: number; photoHeight?: number; address?: string; introduction?: string; englishOk?: boolean; notice?: string };

export function BookingHeader({ title, backHref, onBack, closeHref, disabled = false }: { title: string; backHref?: string; onBack?: () => void; closeHref?: string; disabled?: boolean }) {
  const { t } = useLocale();
  return <header className={styles.topbar}>
    {onBack ? <button type="button" className={styles.iconButton} aria-label={t('Back')} disabled={disabled} onClick={onBack}><ArrowLeft /></button> : backHref ? <Link className={styles.iconButton} aria-label={t('Back')} href={backHref}><ArrowLeft /></Link> : <span className={styles.headerSpacer} />}
    <span className={styles.barTitle}>{title}</span>
    {closeHref ? <Link className={styles.iconButton} aria-label={t('Close booking')} aria-disabled={disabled || undefined} href={closeHref} onClick={event => { if (disabled) event.preventDefault(); }}><X /></Link> : <span className={styles.headerSpacer} />}
  </header>;
}

export function BookingHeading({ title, subtitle, step, total }: { title: string; subtitle?: string; step?: number; total?: number }) {
  const { t } = useLocale();
  return <header className={styles.heading}>{step != null && <p className={styles.stepLabel}><i aria-hidden="true" />{t('Step {number} of {total}', { number: step, total: total ?? 3 })}</p>}<h1 tabIndex={-1}>{title}</h1>{subtitle && <p>{subtitle}</p>}</header>;
}

export function BookingFooter({ service, children, note }: { service?: BookingService; children: ReactNode; note?: string }) {
  const { t, locale } = useLocale();
  return <footer className={styles.footer}>{service && <div className={styles.footerSummary}><span>{service.name}<small>{t('{minutes} min', { minutes: service.durationMinutes })} · {t('Total')}</small></span><strong>{bookingPrice(service.priceKrw)}</strong></div>}{children}{note && <p className={styles.footerNote}>{note}</p>}</footer>;
}
export function BookingArrow() { return <ArrowRight className={styles.actionArrow} aria-hidden="true" />; }
export function BookingHint({ children, clock = false }: { children: ReactNode; clock?: boolean }) {
  return <div className={styles.choiceHint}>{clock ? <Clock3 aria-hidden="true" /> : <Info aria-hidden="true" />}<span>{children}</span></div>;
}
export function BookingContext({ children, staff = false }: { children: ReactNode; staff?: boolean }) {
  return <div className={styles.context}>{staff ? <UserRound aria-hidden="true" /> : <Scissors aria-hidden="true" />}<span>{children}</span></div>;
}
export function BookingPhoto({ src, name, compact = false, width, height }: { src?: string; name: string; compact?: boolean; width?: number; height?: number }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (!src || failedSource === src) return null;
  // Only a verified place photo, or a clearly labelled development fixture, is supplied here.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={compact ? styles.summaryPhoto : styles.venuePhoto} src={src} width={width} height={height} alt={name} onError={() => setFailedSource(src)} />;
}

export function BookingThumbnail({ media, name, staff = false }: { media?: MerchantMedia; name: string; staff?: boolean }) {
  return <BookingThumbnailImage key={media?.url ?? name} media={media} name={name} staff={staff} />;
}
function BookingThumbnailImage({ media, name, staff }: { media?: MerchantMedia; name: string; staff: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!media || failed) return staff ? <span className={styles.avatar} aria-hidden="true">{Array.from(name.trim())[0]}</span> : null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={staff ? styles.staffPhoto : styles.servicePhoto} src={media.url} width={media.width} height={media.height} alt="" onError={() => setFailed(true)} />;
}

export function BookingDatePicker({ first, last, date, onChange }: { first: string; last: string; date: string; onChange: (date: string) => void }) {
  const { t, locale } = useLocale();
  const [anchor, setAnchor] = useState(date);
  const days = bookingDateWindow(first, last, anchor);
  const start = days[0] ?? first;
  const end = days.at(-1) ?? last;
  useEffect(() => {
    setAnchor(current => {
      const visible = bookingDateWindow(first, last, current);
      return !visible.includes(date) ? date : current;
    });
  }, [date, first, last]);
  function select(value: string) {
    if (value >= first && value <= last) { setAnchor(value); onChange(value); }
  }
  return <div className={styles.datePicker}>
    <div className={styles.calendarHeading}><h2>{bookingCalendarLabel(start, locale, { month: 'long', year: 'numeric' })}</h2><label className={styles.calendarControl}><CalendarDays aria-hidden="true" /><span>{t('Calendar')}</span><input aria-label={t('Choose a date')} type="date" value={date} min={first} max={last} onChange={event => select(event.target.value)} /></label></div>
    <div className={styles.dateNavigation}><button type="button" className={styles.iconButton} disabled={start <= first} aria-label={t('Earlier dates')} onClick={() => setAnchor(shiftBookingDate(start, -5))}><ChevronLeft /></button><span>{bookingCalendarLabel(start, locale, { month: 'short', day: 'numeric' })} – {bookingCalendarLabel(end, locale, { month: 'short', day: 'numeric' })}</span><button type="button" className={styles.iconButton} disabled={end >= last} aria-label={t('Later dates')} onClick={() => setAnchor(shiftBookingDate(start, 5))}><ChevronRight /></button></div>
    <div className={styles.days} role="group" aria-label={t('Choose a date')}>{days.map(day => <button type="button" key={day} className={styles.day} aria-label={bookingDate(`${day}T12:00:00+09:00`, locale)} aria-pressed={date === day} onClick={() => onChange(day)}><span>{bookingCalendarLabel(day, locale, { weekday: 'short' })}</span><strong>{bookingCalendarLabel(day, locale, { day: 'numeric' })}</strong></button>)}</div>
  </div>;
}

export function BookingTicket({ value, children }: { value: CustomerBooking; children?: ReactNode }) {
  const { t, locale } = useLocale();
  return <section className={styles.ticket} aria-label={t('Booking summary')}>{children}<h2>{value.merchantName}</h2><p>{value.serviceName}{value.staffName && <> · {value.staffName}</>}</p><div className={styles.ticketRow}><CalendarDays aria-hidden="true" /><div>{bookingDate(value.startAt, locale)}<small>{bookingTime(value.startAt, locale)}–{bookingTime(value.serviceEndAt, locale)} · {t('Seoul time')}</small></div></div></section>;
}
