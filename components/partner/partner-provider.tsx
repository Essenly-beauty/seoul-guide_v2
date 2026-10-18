'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthUser } from '@/lib/auth/use-auth';
import type { PartnerCommand, PartnerSnapshot } from '@/lib/partner/contracts';

export type SaveResult = { kind: 'saved'; snapshot: PartnerSnapshot } | { kind: 'committed-stale' } | { kind: 'conflict' | 'error'; message: string } | { kind: 'cancelled' };
type ScopedRequest = { controller: AbortController; isCurrent: () => boolean };

/** Owns requests for one mounted account view; abort alone cannot reject late responses. */
export class PartnerRequestScope {
  private active = true;
  private read: AbortController | null = null;
  private write: AbortController | null = null;
  activate() { this.active = true; }
  startRead(): ScopedRequest | null {
    if (!this.active) return null;
    this.read?.abort();
    const controller = new AbortController();
    this.read = controller;
    return { controller, isCurrent: () => this.active && this.read === controller && !controller.signal.aborted };
  }
  startWrite(): ScopedRequest | null {
    if (!this.active || this.write) return null;
    const controller = new AbortController();
    this.write = controller;
    return { controller, isCurrent: () => this.active && this.write === controller && !controller.signal.aborted };
  }
  finishWrite(request: ScopedRequest) { if (this.write === request.controller) this.write = null; }
  invalidate() {
    this.read?.abort();
    this.write?.abort();
    this.read = null;
    this.write = null;
  }
  dispose() { this.active = false; this.invalidate(); }
}

type Access = 'loading' | 'ready' | 'signed-out' | 'unassigned' | 'unavailable';
type PartnerContextValue = {
  snapshot: PartnerSnapshot | null; access: Access; refreshing: boolean; stale: boolean;
  refresh: () => Promise<PartnerSnapshot | null>; save: (command: PartnerCommand) => Promise<SaveResult>;
  setDirty: (dirty: boolean) => void; confirmLeave: () => boolean;
};
const PartnerContext = createContext<PartnerContextValue | null>(null);
export function usePartner() {
  const context = useContext(PartnerContext);
  if (!context) throw new Error('PartnerProvider is required');
  return context;
}
export function PartnerProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuthUser();
  // Identity is only a private-view reset boundary. The API decides authorization.
  return <PartnerSession key={loading ? 'checking' : user?.id ?? 'signed-out'} authenticated={!loading && !!user} checking={loading}>{children}</PartnerSession>;
}
function PartnerSession({ children, authenticated, checking }: { children: ReactNode; authenticated: boolean; checking: boolean }) {
  const pathname = usePathname();
  const [snapshot, setSnapshot] = useState<PartnerSnapshot | null>(null);
  const [access, setAccess] = useState<Access>(checking ? 'loading' : authenticated ? 'loading' : 'signed-out');
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState(false);
  const [requests] = useState(() => new PartnerRequestScope());
  const dirty = useRef(false);
  const setDirty = useCallback((value: boolean) => { dirty.current = value; }, []);
  const confirmLeave = useCallback(() => !dirty.current || window.confirm('저장하지 않은 변경사항이 있습니다. 변경사항을 버리고 이동할까요?'), []);
  const clearAccess = useCallback((status: number) => {
    requests.invalidate();
    setSnapshot(null);
    setStale(false);
    setRefreshing(false);
    dirty.current = false;
    setAccess(status === 401 ? 'signed-out' : 'unassigned');
  }, [requests]);
  const refresh = useCallback(async (): Promise<PartnerSnapshot | null> => {
    if (!authenticated) return null;
    const request = requests.startRead();
    if (!request) return null;
    setRefreshing(true);
    try {
      const response = await fetch('/api/partner', { cache: 'no-store', credentials: 'same-origin', signal: request.controller.signal });
      const body = await response.json();
      if (!request.isCurrent()) return null;
      if (response.status === 401 || response.status === 403) { clearAccess(response.status); return null; }
      if (!response.ok || body?.ok !== true || !body.snapshot) throw new Error('unavailable');
      setSnapshot(body.snapshot);
      setAccess('ready');
      setStale(false);
      return body.snapshot;
    } catch {
      if (!request.isCurrent()) return null;
      setStale(true);
      setAccess((current) => current === 'ready' ? 'ready' : 'unavailable');
      return null;
    } finally {
      if (request.isCurrent()) setRefreshing(false);
    }
  }, [authenticated, clearAccess, requests]);
  useEffect(() => {
    requests.activate();
    return () => requests.dispose();
  }, [requests]);
  useEffect(() => { void refresh(); }, [pathname, refresh]);
  useEffect(() => {
    const focus = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', focus);
    return () => { window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus); };
  }, [refresh]);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => { if (dirty.current) { event.preventDefault(); event.returnValue = ''; } };
    const click = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === '_blank' || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;
      if (!confirmLeave()) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', click, true);
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', click, true); };
  }, [confirmLeave]);
  const save = useCallback(async (command: PartnerCommand): Promise<SaveResult> => {
    if (!authenticated) return { kind: 'cancelled' };
    const request = requests.startWrite();
    if (!request) return { kind: 'error', message: '저장 중입니다. 잠시 기다려 주세요.' };
    try {
      const response = await fetch('/api/partner', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(command), signal: request.controller.signal });
      const body = await response.json();
      if (!request.isCurrent()) return { kind: 'cancelled' };
      if (response.status === 401 || body?.code === 'PARTNER_UNASSIGNED') {
        clearAccess(response.status); return { kind: 'cancelled' };
      }
      if (!response.ok || body?.ok !== true) {
        if (response.status === 403) void refresh();
        if (response.status === 409) return { kind: 'conflict', message: '다른 곳에서 정보가 변경되었습니다. 현재 입력은 유지됩니다. 최신 정보를 확인하려면 변경사항을 버리고 다시 불러와 주세요.' };
        const message = body?.code === 'PARTNER_READ_ONLY' || body?.code === 'PARTNER_FORBIDDEN' ? '현재 이 매장을 수정할 권한이 없습니다. 권한을 다시 확인하고 있습니다.' : body?.code === 'PARTNER_LIMIT_EXCEEDED' ? '등록 가능한 항목 수를 초과했습니다. 기존 항목을 수정하거나 운영자에게 문의해 주세요.' : body?.code === 'INVALID_COMMAND' ? '입력한 값이 저장 조건에 맞지 않습니다. 이름 길이, 금액과 시간 범위를 확인해 주세요.' : '저장하지 못했습니다. 입력 내용은 유지됩니다. 잠시 후 다시 시도해 주세요.';
        return { kind: 'error', message };
      }
      const current = await refresh();
      if (!request.isCurrent()) return { kind: 'cancelled' };
      return current ? { kind: 'saved', snapshot: current } : { kind: 'committed-stale' };
    } catch {
      if (!request.isCurrent()) return { kind: 'cancelled' };
      return { kind: 'error', message: '서버의 저장 결과를 확인하지 못했습니다. 다시 불러와 저장 여부를 확인해 주세요. 새 항목은 같은 식별자로 재시도됩니다.' };
    } finally { requests.finishWrite(request); }
  }, [authenticated, clearAccess, refresh, requests]);
  return <PartnerContext.Provider value={{ snapshot, access, refreshing, stale, refresh, save, setDirty, confirmLeave }}>{children}</PartnerContext.Provider>;
}
