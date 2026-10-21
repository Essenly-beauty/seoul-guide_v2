'use client';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { SkeletonChips, SkeletonLines, SkeletonList, SkeletonStatus } from '@/components/ui/skeleton';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthUser } from '@/lib/auth/use-auth';
import { authLinkWithNext } from '@/lib/auth-return';
import { useLocale } from '@/lib/i18n/locale-provider';
import { routes } from '@/lib/routes';
import type { MerchantMedia } from '@/lib/partner/media-contracts';
import { publicPlaceMediaResponse } from '@/lib/place-media';
import { bookingAvailability, bookingCatalog } from '@/lib/booking/contracts';
import { bookingErrorMessage, bookingReducer, bookingStartDate, bookingTime, bookingTimeGroups, initialBookingState, submitBooking, type BookingConfiguration } from './customer-booking-state';
import { useBookingResource } from './use-booking-resource';
import { BookingReview } from './booking-summary';
import { BookingArrow, BookingContext, BookingDatePicker, BookingFooter, BookingHeader, BookingHeading, BookingHint, BookingPhoto, BookingThumbnail, type BookingVenue } from './booking-ui';
import styles from './customer-booking.module.css';

type BookingFlowProps = { placeId: string; initialService?: string; isPreview?: boolean; venue?: BookingVenue; initialMedia?: MerchantMedia[] };

export function BookingFlow(props: BookingFlowProps) {
  const { user } = useAuthUser();
  // Contact details and uncertain submissions never carry over to another account.
  return <BookingFlowContent key={`${props.placeId}:${user?.id ?? 'guest'}`} {...props} />;
}

function BookingFlowContent({ placeId, initialService = '', isPreview = false, venue: sourceVenue, initialMedia = [] }: BookingFlowProps) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const auth = useAuthUser();
  const [selection, dispatch] = useReducer(bookingReducer, { ...initialBookingState, serviceId: initialService });
  const [step, setStep] = useState(0);
  const content = useRef<HTMLElement>(null);
  useEffect(() => {
    content.current?.scrollTo?.({ top: 0 });
    content.current?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
  }, [step]);
  const [submitting, setSubmitting] = useState(false);
  const submissionLock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const submittedCatalog = useRef<Extract<BookingConfiguration, { status: 'available' }> | null>(null);
  const validateMedia = useCallback((value: unknown): value is { media: MerchantMedia[] } => publicPlaceMediaResponse(value, placeId), [placeId]);
  const publicImages = useBookingResource(`/api/places/${encodeURIComponent(placeId)}/media`, validateMedia);
  const media = publicImages.data?.media ?? (publicImages.error ? [] : initialMedia);
  const storePhoto = media.find(item => item.targetKind === 'store');
  const venue = storePhoto ? { ...sourceVenue, photoUrl: storePhoto.url, photoWidth: storePhoto.width, photoHeight: storePhoto.height } : sourceVenue;
  const configuration = useBookingResource(`/api/places/${encodeURIComponent(placeId)}/booking`, bookingCatalog);
  const latestCatalog = configuration.data?.status === 'available' && configuration.data.endDate >= bookingStartDate(configuration.data.startDate) ? configuration.data : null;
  const catalog = selection.requestId && submittedCatalog.current ? submittedCatalog.current : latestCatalog;
  const service = catalog?.services.find(item => item.id === selection.serviceId);
  const staff = catalog?.staff.find(item => item.id === selection.staffId);
  const staffOptions = catalog?.staff.filter(item => item.serviceIds.includes(selection.serviceId)) ?? [];
  const needsStaff = catalog?.selectionMode === 'staff';
  const firstDate = catalog ? bookingStartDate(catalog.startDate) : '';
  const date = selection.date && selection.date >= firstDate && selection.date <= (catalog?.endDate ?? '') ? selection.date : firstDate;
  const params = new URLSearchParams({ serviceId: selection.serviceId, date });
  if (needsStaff && selection.staffId) params.set('staffId', selection.staffId);
  const availabilityUrl = service && date && (!needsStaff || staff) ? `/api/places/${encodeURIComponent(placeId)}/availability?${params}` : null;
  const availability = useBookingResource(availabilityUrl, bookingAvailability);
  const availableSlots = availability.data?.slots.filter(slot => slot.staffId === (needsStaff ? selection.staffId : null)) ?? [];
  const fingerprint = latestCatalog ? JSON.stringify(latestCatalog) : '';
  const previousFingerprint = useRef('');
  useEffect(() => {
    if (!fingerprint || selection.requestId) return;
    if (previousFingerprint.current && previousFingerprint.current !== fingerprint) {
      dispatch({ type: 'configuration' });
      setStep(0);
    }
    previousFingerprint.current = fingerprint;
  }, [fingerprint, selection.requestId]);
  useEffect(() => {
    if (!selection.slot || selection.requestId || availability.loading || !availability.data) return;
    const exists = availability.data.slots.some(item => item.startAt === selection.slot?.startAt && item.staffId === selection.slot?.staffId);
    if (!exists || availability.data.quoteVersion !== selection.quoteVersion) {
      dispatch({ type: 'configuration' });
      dispatch({ type: 'error', value: 'SLOT_UNAVAILABLE' });
      setStep(2);
    }
  }, [availability.data, availability.loading, selection.slot, selection.quoteVersion, selection.requestId]);

  const refreshConfiguration = configuration.refresh;
  const refreshAvailability = availability.refresh;
  const quoteMismatch = !!(service && availability.data && service.quoteVersion !== availability.data.quoteVersion);
  useEffect(() => {
    if (!quoteMismatch || selection.requestId) return;
    dispatch({ type: 'configuration' });
    dispatch({ type: 'error', value: 'STALE_SELECTION' });
    setStep(0);
    refreshConfiguration();
    refreshAvailability();
  }, [quoteMismatch, selection.requestId, refreshConfiguration, refreshAvailability]);

  function go(next: number) { dispatch({ type: 'error', value: '' }); setStep(next); }
  function signIn() {
    const query = new URLSearchParams();
    if (selection.serviceId) query.set('service', selection.serviceId);
    router.push(authLinkWithNext(routes.signIn, `${routes.placeBooking(placeId)}${query.size ? `?${query}` : ''}`));
  }
  async function confirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionLock.current || !catalog || !service || !selection.slot || configuration.loading || availability.loading || (!selection.requestId && (availability.error || configuration.error || quoteMismatch))) return;
    if (!auth.user) { signIn(); return; }
    submissionLock.current = true;
    setSubmitting(true);
    if (!selection.requestId) submittedCatalog.current = catalog;
    const requestId = selection.requestId ?? crypto.randomUUID();
    dispatch({ type: 'request', value: requestId });
    dispatch({ type: 'error', value: '' });
    try {
      const booking = await submitBooking({ placeId, serviceId: service.id, staffId: selection.slot.staffId, startAt: selection.slot.startAt, quoteVersion: selection.quoteVersion, requestId, customerName: selection.customerName.trim(), phone: selection.phone.trim(), notes: selection.notes.trim() });
      if (mounted.current) router.replace(routes.booking(booking.id));
    } catch (error) {
      if (!mounted.current) return;
      const code = error instanceof Error ? error.message : 'NETWORK_ERROR';
      dispatch({ type: 'error', value: code });
      if (code === 'AUTH_REQUIRED') signIn();
      if (['SLOT_UNAVAILABLE', 'STALE_SELECTION', 'BOOKING_UNAVAILABLE'].includes(code)) {
        dispatch({ type: 'configuration' });
        dispatch({ type: 'error', value: code });
        setStep(code === 'SLOT_UNAVAILABLE' ? 2 : 0);
        configuration.refresh(); availability.refresh();
      }
    } finally { if (mounted.current) { submissionLock.current = false; setSubmitting(false); } }
  }

  const busy = submitting || configuration.loading || availability.loading || auth.loading || (quoteMismatch && !selection.requestId);
  const groups = bookingTimeGroups(availableSlots);
  const stepNumber = step - (needsStaff ? 0 : 1);
  const forwardLabel = step === 0 ? (!auth.loading && !auth.user ? 'Sign in to book' : needsStaff ? 'Choose your staff' : 'Choose a date & time') : step === 1 ? 'Choose a date & time' : 'Review booking';
  const forwardDisabled = step === 0 ? !service || configuration.loading || auth.loading : step === 1 ? !staff : !selection.slot || availability.loading || !!availability.error || quoteMismatch;
  function forward() {
    if (step === 0) { if (auth.user) go(needsStaff ? 1 : 2); else signIn(); }
    else go(step + 1);
  }
  return <div className={styles.shell}>
    <BookingHeader title={step === 0 && catalog ? venue?.name ?? catalog.merchantName : t('Book a visit')} backHref={step === 0 ? routes.place(placeId) : undefined} onBack={step ? () => go(step === 2 && !needsStaff ? 0 : step - 1) : undefined} closeHref={routes.place(placeId)} disabled={submitting} />
    <form className={styles.flow} onSubmit={confirm}>
      <main ref={content} className={styles.scroll}>
        {!catalog ? <div className={styles.page}><div className={styles.empty}>
          <h1 tabIndex={-1}>{t('Book a visit')}</h1>
          {configuration.loading ? <SkeletonStatus label={t('Loading booking details…')}><SkeletonLines lines={2} widths={['55%', '85%']} /><SkeletonList rows={2} thumb={44} /></SkeletonStatus> : configuration.error ? <><p role="alert">{t(bookingErrorMessage(configuration.error))}</p><button type="button" className={styles.secondary} onClick={configuration.refresh}>{t('Retry')}</button></> : <><p>{t('This venue is not accepting bookings right now.')}</p><Link className={styles.secondary} href={routes.place(placeId)}>{t('Back to venue')}</Link></>}
        </div></div> : <>
          {step === 0 && <BookingPhoto src={venue?.photoUrl} width={venue?.photoWidth} height={venue?.photoHeight} name={venue?.name ?? catalog.merchantName} />}
          <div className={styles.page}>
            {isPreview && <p className={styles.previewNote}>{t('This is a test venue. Bookings here are for testing only.')}</p>}
            <fieldset disabled={submitting} className={styles.fieldset}>
              {step === 0 && <section className={styles.section}>
                <BookingHeading title={t('Choose a service')} subtitle={venue?.introduction || t('Choose your service and a time that works for you.')} />
                {venue?.address && <p className={styles.venueAddress}>{venue.address}</p>}
                {venue?.englishOk !== undefined && <p className={styles.venueAddress}>{t(venue.englishOk ? 'Staff can assist in English' : 'Translation app recommended')}</p>}
                {venue?.notice && <div className={styles.policy}><strong>{t('Venue notice')}</strong><p>{venue.notice}</p></div>}
                <div className={styles.sectionTitle}><h2>{t('Service')}</h2><span>{t('Prices in KRW')}</span></div>
                <div className={styles.options} role="group" aria-label={t('Choose a service')}>{catalog.services.map(item => <button type="button" key={item.id} className={styles.serviceOption} aria-pressed={service?.id === item.id} onClick={() => dispatch({ type: 'service', value: item.id })}>
                  <BookingThumbnail media={media.find(photo => photo.targetKind === 'menu' && photo.targetId === item.id)} name={item.name} /><span className={styles.optionCopy}><strong>{item.name}</strong>{item.description && <small>{item.description}</small>}<span className={styles.serviceMeta}><b>₩{item.priceKrw.toLocaleString(locale)}</b><span>{t('{minutes} min', { minutes: item.durationMinutes })}</span></span></span><span className={styles.selection} aria-hidden="true" />
                </button>)}</div>
                {!catalog.services.length && <p className={styles.hint}>{t('This venue is not accepting bookings right now.')}</p>}
                <BookingHint>{t('Pay at the venue')} · {t('No payment is collected online.')}</BookingHint>
              </section>}
              {step === 1 && <section className={styles.section}>
                <BookingHeading title={t('Choose your staff')} subtitle={t('Choose the specialist who feels right for you.')} step={1} total={3} />
                {service && <BookingContext>{service.name} · {t('{minutes} min', { minutes: service.durationMinutes })}</BookingContext>}
                <div className={styles.staffList} role="group" aria-label={t('Choose your staff')}>{staffOptions.map(item => <button type="button" key={item.id} className={styles.person} aria-pressed={staff?.id === item.id} onClick={() => dispatch({ type: 'staff', value: item.id })}>
                  <BookingThumbnail media={media.find(photo => photo.targetKind === 'staff' && photo.targetId === item.id)} name={item.name} staff /><span className={styles.personInfo}><span><strong>{item.name}</strong>{item.title && <span className={styles.personRole}>{item.title}</span>}</span>{item.introduction && <span className={styles.personIntroduction}>{item.introduction}</span>}</span><span className={styles.selection} aria-hidden="true" />
                </button>)}</div>
                {!staffOptions.length && <p className={styles.hint}>{t('No staff are available for this service.')}</p>}
              </section>}
              {step === 2 && <section className={styles.section}>
                <BookingHeading title={t('Choose a date & time')} subtitle={t('All appointment times are in Seoul time (KST).')} step={stepNumber} total={needsStaff ? 3 : 2} />
                {service && <BookingContext staff>{staff?.name ?? t('Venue team')} · {service.name} · {t('{minutes} min', { minutes: service.durationMinutes })}</BookingContext>}
                <BookingDatePicker first={firstDate} last={catalog.endDate} date={date} onChange={value => dispatch({ type: 'date', value })} />
                <div aria-live="polite">
                  {availability.loading ? <SkeletonStatus label={t('Checking available times…')} className={styles.availabilityMessage}><SkeletonChips count={8} width={68} height={40} /></SkeletonStatus> : availability.error ? <div className={styles.error} role="alert">{t(bookingErrorMessage(availability.error))}<button type="button" className={styles.secondary} onClick={availability.refresh}>{t('Retry')}</button></div> : groups.length ? groups.map(group => <div className={styles.timeGroup} key={group.label}><h2>{t(group.label)}</h2><div className={styles.times} role="group" aria-label={t(group.label)}>{group.slots.map(slot => <button type="button" className={styles.time} key={`${slot.startAt}:${slot.staffId}`} aria-pressed={selection.slot?.startAt === slot.startAt && selection.slot.staffId === slot.staffId} onClick={() => dispatch({ type: 'slot', slot, quoteVersion: availability.data!.quoteVersion })}>{bookingTime(slot.startAt, locale)}</button>)}</div></div>) : <p className={styles.availabilityMessage}>{t('No times are available on this date. Please choose another date.')}</p>}
                </div>
                <BookingHint clock>{selection.slot ? `${bookingTime(selection.slot.startAt, locale)}–${bookingTime(selection.slot.serviceEndAt, locale)} · ${t('Seoul time')}` : t('Choose a time to see when your visit will end.')}</BookingHint>
              </section>}
              {step === 3 && service && selection.slot && <section className={styles.section}>
                <BookingHeading title={t('Review your booking')} subtitle={t('Check the details before you continue.')} step={stepNumber} total={needsStaff ? 3 : 2} />
                <BookingReview placeId={placeId} merchantName={venue?.name ?? catalog.merchantName} service={service} staff={staff} slot={selection.slot} mode={catalog.mode} paymentMode={catalog.paymentMode} venue={venue} onEdit={go} needsStaff={needsStaff} />
                <div className={styles.contactFields}>
                  <h2>{t('Your contact details')}</h2>
                  <label className={styles.field}>{t('Full name')}<input required maxLength={120} autoComplete="name" value={selection.customerName} onChange={event => dispatch({ type: 'customer', field: 'customerName', value: event.target.value })} /></label>
                  <label className={styles.field}>{t('Phone number')}<input required type="tel" maxLength={80} autoComplete="tel" placeholder="+82 10 1234 5678" value={selection.phone} onChange={event => dispatch({ type: 'customer', field: 'phone', value: event.target.value })} /><span className={styles.hint}>{t('Include your country code so the venue can contact you.')}</span></label>
                  <label className={styles.field}>{t('Notes (optional)')}<textarea maxLength={2000} value={selection.notes} onChange={event => dispatch({ type: 'customer', field: 'notes', value: event.target.value })} /></label>
                </div>
              </section>}
            </fieldset>
            {selection.error && <div role="alert" className={styles.error}>{t(bookingErrorMessage(selection.error))}{selection.requestId && <Link href={routes.bookings} className={styles.textButton}>{t('My bookings')}</Link>}</div>}
            {configuration.error && <p role="alert" className={styles.error}>{t(bookingErrorMessage(configuration.error))}</p>}
          </div>
        </>}
      </main>
      {catalog && <BookingFooter service={step < 3 ? service : undefined} note={step === 3 ? t('No payment is collected online.') : undefined}>
        {step < 3 ? <button type="button" className={styles.primary} disabled={forwardDisabled || submitting} onClick={forward}>{t(forwardLabel)}<BookingArrow /></button> : !auth.loading && !auth.user ? <button type="button" className={styles.primary} onClick={signIn}>{t('Sign in to book')}<BookingArrow /></button> : <button type="submit" className={styles.primary} disabled={busy || !service || !selection.slot || (!selection.requestId && (!!configuration.error || !!availability.error))}>{t(submitting ? 'Submitting…' : catalog.mode === 'request' ? 'Send booking request' : 'Confirm booking')}{!submitting && <BookingArrow />}</button>}
      </BookingFooter>}
    </form>
  </div>;
}
