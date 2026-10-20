'use client';
import { useEffect, useState } from 'react';
import { CircleMarker, MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useTheme } from '@/components/theme/theme-provider';
import { useLocale } from '@/lib/i18n/locale-provider';
import { MAP_TILE_URLS, MAP_ATTRIBUTION, withTileKey } from '@/lib/map-tiles';
import type { BookingLocation } from '@/lib/booking/location';
import styles from './booking-location.module.css';

export default function BookingLocationMap({ coordinates }: { coordinates: NonNullable<BookingLocation['coordinates']> }) {
  const { theme } = useTheme();
  const { t } = useLocale();
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => { setUnavailable(false); }, [theme, coordinates.lat, coordinates.lng]);
  return <>
    <MapContainer className={styles.map} center={[coordinates.lat, coordinates.lng]} zoom={16} zoomControl={false} dragging={false} scrollWheelZoom={false} doubleClickZoom={false} touchZoom={false} boxZoom={false} keyboard={false} attributionControl>
      <TileLayer key={theme} url={withTileKey(MAP_TILE_URLS[theme], process.env.NEXT_PUBLIC_CARTO_API_KEY)} attribution={MAP_ATTRIBUTION} eventHandlers={{ tileerror: () => setUnavailable(true) }} />
      <CircleMarker center={[coordinates.lat, coordinates.lng]} radius={8} pathOptions={{ color: 'var(--surface)', weight: 3, fillColor: 'var(--action)', fillOpacity: 1 }} interactive={false}/>
    </MapContainer>
    {unavailable && <p className={styles.tileError} role="status">{t('Map preview unavailable. Use the links below.')}</p>}
  </>;
}
