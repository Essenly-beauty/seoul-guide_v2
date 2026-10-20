'use client';

import { BookingEntry } from "@/components/booking/booking-entry";
import { T } from "@/lib/i18n/locale-provider";

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { decodePublicCatalog, type PublicCatalog } from '@/lib/booking/public-catalog';
import { useVisibleBookingRefresh } from '@/components/booking/use-booking-resource';
import styles from './public-service-menu.module.css';

type MenuState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; catalog: PublicCatalog };
export function PublicServiceMenuView({ state, fallback, onRetry }: { state: MenuState; fallback: ReactNode; onRetry: () => void }) {
  if (state.kind === 'ready' && state.catalog.services.length) {
    return <div className={styles.catalog}>
      <p className="caption muted"><T text={"Services listed by the venue · Prices in KRW"} /></p>
      <ul className={styles.list}>
        {state.catalog.services.map(service => <li className={styles.service} key={service.id}>
          <div className={styles.heading}><div><p className={styles.category}><T text={service.category} /></p><h3>{service.name}</h3></div><strong className={styles.price}>₩{service.priceKrw.toLocaleString('en-US')}</strong></div>
          <p className={styles.description}>{service.description}</p>
          <span className={styles.duration}><T text="{minutes} min" values={{ minutes: service.durationMinutes }} /></span>
        </li>)}
      </ul>
      <p className="caption muted"><T text={"Availability and final details still need to be confirmed."} /></p>
    </div>;
  }
  return <>
    {state.kind === 'ready' && fallback}
    {state.kind === 'loading' && <p className="caption muted" role="status"><T text={"Checking venue menus…"} /></p>}
    {state.kind === 'error' && <div className={styles.error}><p className="caption muted" role="status"><T text={"Venue menus are temporarily unavailable."} /></p><button className={styles.retry} onClick={onRetry}><T text={"Retry"} /></button></div>}
  </>;
}

export function PublicServiceMenu({ placeId, fallback }: { placeId: string; fallback: ReactNode }) {
  const [result, setResult] = useState<{ placeId: string; state: MenuState }>({ placeId, state: { kind: 'loading' } });
  const [attempt, setAttempt] = useState(0);
  const refresh = useCallback(() => setAttempt(value => value + 1), []);
  useVisibleBookingRefresh(refresh);
  useEffect(() => {
    const controller = new AbortController();
    // A request timeout must be visible as an error, distinct from unmount cancellation.
    let cancelled = false;
    const timeout = setTimeout(() => controller.abort(), 10000);
    setResult({ placeId, state: { kind: 'loading' } });
    async function read() {
      try {
        const response = await fetch(`/api/places/${encodeURIComponent(placeId)}/catalog`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Menu unavailable');
        const payload: unknown = await response.json();
        if (!payload || typeof payload !== 'object' || !('status' in payload) || !('services' in payload)) throw new Error('Invalid catalog');
        const status = payload.status;
        if (status !== 'published' && status !== 'unpublished') throw new Error('Invalid catalog status');
        const catalog = decodePublicCatalog({ place_id: placeId, services: payload.services }, placeId);
        if (status === 'unpublished' && catalog.services.length) throw new Error('Invalid unpublished catalog');
        if (!cancelled) setResult({ placeId, state: { kind: 'ready', catalog: { ...catalog, status } } });
      } catch {
        if (!cancelled) setResult({ placeId, state: { kind: 'error' } });
      } finally { clearTimeout(timeout); }
    }
    void read();
    return () => { cancelled = true; clearTimeout(timeout); controller.abort(); };
  }, [placeId, attempt]);
  const state: MenuState = result.placeId === placeId ? result.state : { kind: 'loading' };
  return <><PublicServiceMenuView state={state} fallback={fallback} onRetry={refresh} /><BookingEntry placeId={placeId} /></>;
}
