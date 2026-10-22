'use client';
import dynamic from 'next/dynamic';
import { SkeletonChips, SkeletonStatus } from '@/components/ui/skeleton';
import Link from 'next/link';
import { useCallback } from 'react';
import { ArrowUpRight, MapPin, Navigation } from 'lucide-react';
import { bookingLocation, type BookingLocation } from '@/lib/booking/location';
import { googleDirectionsUrl } from '@/lib/geo';
import { useLocale } from '@/lib/i18n/locale-provider';
import { routes } from '@/lib/routes';
import { useBookingResource } from './use-booking-resource';
import styles from './booking-location.module.css';

function MapLoading() { const { t } = useLocale(); return <SkeletonStatus label={t('Loading map…')} className={styles.fallback} style={{ display: 'block', padding: 0 }}><SkeletonChips count={1} width="100%" height="100%" /></SkeletonStatus>; }
const LocationMap = dynamic(() => import('./booking-location-map'), { ssr: false, loading: MapLoading });

export function BookingLocationView({ location }: { location: BookingLocation }) {
  const { t } = useLocale();
  const query = [location.nameKr || location.name, location.address].filter(Boolean).join(' ');
  const searchHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  const mapHref = location.coordinates ? `${routes.map}?place=${encodeURIComponent(location.placeId)}` : searchHref;
  const directionsHref = location.coordinates ? googleDirectionsUrl({ ...location.coordinates, name: location.name, address: location.address }) : searchHref;
  return <section className={styles.section} aria-label={t('Venue location')}>
    <h2 className={styles.heading}>{t('Venue location')}</h2>
    {location.coordinates ? <div className={styles.frame} role="group" aria-label={t('Map showing {venue}', { venue: location.name })}><LocationMap key={`${location.coordinates.lat}:${location.coordinates.lng}`} coordinates={location.coordinates}/></div> : <div className={styles.fallback}><MapPin aria-hidden="true"/><span>{t('Map location has not been verified yet.')}</span></div>}
    <div className={styles.address}><MapPin aria-hidden="true"/><p><strong>{location.name}</strong><span>{location.address || t('Address not available')}</span></p></div>
    <div className={styles.actions}>
      <a className={styles.action} href={mapHref} target="_blank" rel="noopener noreferrer">{t('Open map')}<ArrowUpRight aria-hidden="true"/></a>
      {location.coordinates && <a className={styles.action} href={directionsHref} target="_blank" rel="noopener noreferrer"><Navigation aria-hidden="true"/>{t('Get directions')}<ArrowUpRight aria-hidden="true"/></a>}
    </div>
  </section>;
}
export function BookingLocationCard({ placeId }: { placeId: string }) {
  const { t } = useLocale();
  const validate = useCallback((value: unknown): value is BookingLocation => bookingLocation(value) && value.placeId === placeId, [placeId]);
  const resource = useBookingResource(`/api/places/${encodeURIComponent(placeId)}/location`, validate);
  if (resource.data) return <BookingLocationView location={resource.data}/>;
  return <section className={styles.section} aria-label={t('Venue location')}><h2 className={styles.heading}>{t('Venue location')}</h2><p className={styles.message} role="status">{t(resource.error ? 'Location unavailable. View venue details.' : 'Loading location…')}</p>{resource.error && <div className={styles.actions}><button className={styles.action} type="button" onClick={resource.refresh}>{t('Retry')}</button><Link className={styles.action} href={routes.place(placeId)} target="_blank" rel="noopener noreferrer">{t('View venue')}<ArrowUpRight aria-hidden="true"/></Link></div>}</section>;
}
