'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { bookingJson } from './customer-booking-state';

/** Only visible screens poll; cleanup removes timers and both event listeners. */
export function subscribeVisibleBookingRefresh(refresh: () => void, page: EventTarget & { visibilityState: string }, browser: EventTarget) {
  const refreshVisible = () => { if (page.visibilityState === 'visible') refresh(); };
  browser.addEventListener('focus', refreshVisible);
  page.addEventListener('visibilitychange', refreshVisible);
  const timer = setInterval(refreshVisible, 30000);
  return () => {
    clearInterval(timer);
    browser.removeEventListener('focus', refreshVisible);
    page.removeEventListener('visibilitychange', refreshVisible);
  };
}
export function useVisibleBookingRefresh(refresh: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    return subscribeVisibleBookingRefresh(refresh, document, window);
  }, [refresh, enabled]);
}

/** Abort previous requests, ignore late responses, and revalidate when returning to the app. */
export function useBookingResource<T>(url: string | null, validate: (value: unknown) => value is T, scope = '') {
  const identity = `${scope}:${url ?? ''}`;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ url: string | null; identity: string; data: T | null; loading: boolean; error: string }>({ url: null, identity, data: null, loading: !!url, error: '' });
  const sequence = useRef(0);
  const refresh = useCallback(() => setAttempt(value => value + 1), []);
  useVisibleBookingRefresh(refresh, !!url);
  useEffect(() => {
    const current = ++sequence.current;
    if (!url) { setResult({ url: null, identity, data: null, loading: false, error: '' }); return; }
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 15000);
    setResult(previous => ({ url, identity, data: previous.identity === identity ? previous.data : null, loading: true, error: '' }));
    void bookingJson<unknown>(url, { signal: controller.signal }).then(data => {
      if (!validate(data)) throw new Error('NETWORK_ERROR');
      if (active && current === sequence.current) setResult({ url, identity, data, loading: false, error: '' });
    }).catch(error => {
      if (active && current === sequence.current) setResult({ url, identity, data: null, loading: false, error: error instanceof Error ? error.message : 'NETWORK_ERROR' });
    }).finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [url, identity, attempt, validate]);
  if (result.identity !== identity) return { data: null, loading: !!url, error: '', refresh };
  return { ...result, refresh };
}
