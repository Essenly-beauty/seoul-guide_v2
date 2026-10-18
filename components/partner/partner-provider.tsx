'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthUser } from '@/lib/auth/use-auth';
import type { PartnerCommand, PartnerSnapshot } from '@/lib/partner/contracts';
import type { ReservationCommand } from '@/lib/partner/reservation-commands';
import type { SaveState } from './partner-form';

export type SaveResult = { kind: 'saved'; snapshot: PartnerSnapshot } | { kind: 'committed-stale' } | { kind: 'conflict' | 'error'; message: string } | { kind: 'cancelled' };
type ScopedRequest = { controller: AbortController; isCurrent: () => boolean };

/** Owns requests for one mounted account view; abort alone cannot reject late responses. */
export class PartnerRequestScope {
  private active = true;
  private read: AbortController | null = null;
  private write: AbortController | null = null;
  private epoch = 0;
  private latestRead: Promise<unknown> | null = null;
  activate() { this.active = true; }
  startRead(): ScopedRequest | null {
    if (!this.active) return null;
    this.read?.abort();
    const controller = new AbortController();
    this.read = controller;
    return { controller, isCurrent: () => this.active && this.read === controller && !controller.signal.aborted };
  }
  runRead<T>(operation: (request: ScopedRequest) => Promise<T>, fallback: T): Promise<T> {
    const request = this.startRead();
    if (!request) return Promise.resolve(fallback);
    const epoch = this.epoch;
    const pending: Promise<T> = Promise.resolve().then(() => operation(request)).then((value) => {
      if (request.isCurrent()) return value;
      // Focus/visibility may supersede a manual or post-save read. Its caller
      // needs the replacement read's result, not a synthetic connection error.
      return this.active && this.epoch === epoch && this.latestRead && this.latestRead !== pending ? this.latestRead as Promise<T> : fallback;
    });
    this.latestRead = pending;
    return pending;
  }
  startWrite(): ScopedRequest | null {
    if (!this.active || this.write) return null;
    const controller = new AbortController();
    this.write = controller;
    return { controller, isCurrent: () => this.active && this.write === controller && !controller.signal.aborted };
  }
  finishWrite(request: ScopedRequest) { if (this.write === request.controller) this.write = null; }
  invalidate() {
    ++this.epoch;
    this.read?.abort();
    this.write?.abort();
    this.read = null;
    this.write = null;
    this.latestRead = null;
  }
  dispose() { this.active = false; this.invalidate(); }
}

export type PartnerDraftRecord<T> = { token: symbol; draft: T; baseline: T; state: SaveState };
export type PartnerEditor = { kind: 'category' | 'menu'; id: string };
/** Memory only, owned by one authenticated PartnerSession, never browser storage. */
export class PartnerDraftStore {
  private records = new Map<string, PartnerDraftRecord<unknown>>();
  private listeners = new Set<() => void>();
  private editor: PartnerEditor | null = null;
  private activeKeys = new Set<string>();
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  read<T>(key: string): PartnerDraftRecord<T> | undefined { return this.records.get(key) as PartnerDraftRecord<T> | undefined; }
  write<T>(key: string, value: PartnerDraftRecord<T>) { this.records.set(key, value); this.listeners.forEach((listener) => listener()); }
  complete<T>(key: string, token: symbol, value: PartnerDraftRecord<T>): boolean {
    if (this.records.get(key)?.token !== token) return false;
    this.write(key, value);
    return true;
  }
  discard(key: string) { this.records.delete(key); this.listeners.forEach((listener) => listener()); }
  setActive(key: string | null, inactiveKey?: string) {
    if (key) this.activeKeys.add(key);
    else if (inactiveKey) this.activeKeys.delete(inactiveKey);
    else this.activeKeys.clear();
  }
  discardActive() { for (const key of this.activeKeys) this.discard(key); }
  hasActiveUnsavedChanges() { return [...this.activeKeys].some((key) => {
    const record = this.records.get(key);
    return record && (record.state.kind === 'pending' || record.state.kind === 'unconfirmed' || (record.state.kind !== 'committed-stale' && JSON.stringify(record.draft) !== JSON.stringify(record.baseline)));
  }); }
  hasUnsavedChanges() {
    return [...this.records.values()].some((record) => record.state.kind === 'pending' || record.state.kind === 'unconfirmed' || (record.state.kind !== 'committed-stale' && JSON.stringify(record.draft) !== JSON.stringify(record.baseline)));
  }
  confirmReload(key: string, confirm: () => boolean) {
    const record = this.records.get(key);
    return !record || record.state.kind === 'committed-stale' || (record.state.kind !== 'unconfirmed' && JSON.stringify(record.draft) === JSON.stringify(record.baseline)) || confirm();
  }
  getEditor() { return this.editor; }
  setEditor(editor: PartnerEditor | null) { this.editor = editor; }
  clear() { this.records.clear(); this.editor = null; this.activeKeys.clear(); this.listeners.forEach((listener) => listener()); }
}

type PartnerHistoryLocation = { href: string; state: unknown };
/** Runs before App Router's popstate listener; a rejected traversal restores its prior route/tree. */
export function guardPartnerPopstate(
  event: Pick<PopStateEvent, 'stopImmediatePropagation'>, previous: PartnerHistoryLocation, destinationHref: string,
  drafts: PartnerDraftStore, confirmLeave: () => boolean, confirmExit: () => boolean,
  restore: (location: PartnerHistoryLocation) => void,
): boolean {
  if (destinationHref === previous.href) return true;
  const destination = new URL(destinationHref);
  const leavesWorkspace = destination.origin !== new URL(previous.href).origin || (destination.pathname !== '/partner' && !destination.pathname.startsWith('/partner/'));
  let allowed = true;
  if (leavesWorkspace && drafts.hasUnsavedChanges()) {
    allowed = confirmExit();
    if (allowed) drafts.clear();
  } else allowed = confirmLeave();
  if (!allowed) { event.stopImmediatePropagation(); restore(previous); }
  return allowed;
}

type Access = 'loading' | 'ready' | 'signed-out' | 'unassigned' | 'unavailable';
export const uncertainSaveOutcomeMessage = '서버의 저장 결과를 확인하지 못했습니다. 다시 불러와 저장 여부를 확인한 뒤 필요하면 다시 저장해 주세요.';
type PartnerContextValue = {
  snapshot: PartnerSnapshot | null; access: Access; refreshing: boolean; stale: boolean;
  refresh: () => Promise<PartnerSnapshot | null>; save: (command: PartnerCommand | ReservationCommand) => Promise<SaveResult>;
  confirmLeave: (discard?: boolean) => boolean; drafts: PartnerDraftStore;
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
  const [drafts] = useState(() => new PartnerDraftStore());
  const merchantId = useRef<string | null>(null);
  const historyLocation = useRef<PartnerHistoryLocation | null>(null);
  const confirmLeave = useCallback((discard = true) => {
    if (!drafts.hasActiveUnsavedChanges()) return true;
    if (!window.confirm('저장하지 않은 변경사항이 있습니다. 변경사항을 버릴까요?')) return false;
    if (discard) drafts.discardActive();
    return true;
  }, [drafts]);
  const clearAccess = useCallback((status: number) => {
    requests.invalidate();
    drafts.clear();
    merchantId.current = null;
    setSnapshot(null);
    setStale(false);
    setRefreshing(false);
    setAccess(status === 401 ? 'signed-out' : 'unassigned');
  }, [requests, drafts]);
  const refresh = useCallback(async (): Promise<PartnerSnapshot | null> => {
    if (!authenticated) return null;
    return requests.runRead(async (request): Promise<PartnerSnapshot | null> => {
      if (!request.isCurrent()) return null;
      setRefreshing(true);
      try {
        const response = await fetch('/api/partner', { cache: 'no-store', credentials: 'same-origin', signal: request.controller.signal });
        const body = await response.json();
        if (!request.isCurrent()) return null;
        if (response.status === 401 || response.status === 403) { clearAccess(response.status); return null; }
        if (!response.ok || body?.ok !== true || !body.snapshot) throw new Error('unavailable');
        if (merchantId.current && merchantId.current !== body.snapshot.merchant.id) {
          requests.invalidate();
          drafts.clear();
          setRefreshing(false);
        }
        merchantId.current = body.snapshot.merchant.id;
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
    }, null);
  }, [authenticated, clearAccess, requests, drafts]);
  useEffect(() => {
    requests.activate();
    return () => { requests.dispose(); drafts.clear(); };
  }, [requests, drafts]);
  useEffect(() => { void refresh(); }, [pathname, refresh]);
  useEffect(() => { historyLocation.current = { href: window.location.href, state: window.history.state }; });
  useEffect(() => {
    const focus = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', focus);
    return () => { window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus); };
  }, [refresh]);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => { if (drafts.hasUnsavedChanges()) { event.preventDefault(); event.returnValue = ''; } };
    const click = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === '_blank' || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;
      const leavesWorkspace = destination.origin !== window.location.origin || (destination.pathname !== '/partner' && !destination.pathname.startsWith('/partner/'));
      let allowed = true;
      if (leavesWorkspace && drafts.hasUnsavedChanges()) {
        allowed = window.confirm('가맹점 관리를 나가면 저장하지 않은 초안이 모두 지워집니다. 나갈까요?');
        if (allowed) drafts.clear();
      } else allowed = confirmLeave();
      if (!allowed) { event.preventDefault(); event.stopPropagation(); }
    };
    const popstate = (event: PopStateEvent) => {
      const previous = historyLocation.current;
      if (!previous) return;
      const allowed = guardPartnerPopstate(event, previous, window.location.href, drafts, confirmLeave,
        () => window.confirm('가맹점 관리를 나가면 저장하지 않은 초안이 모두 지워집니다. 나갈까요?'),
        (location) => window.history.pushState(location.state, '', location.href));
      if (allowed) historyLocation.current = { href: window.location.href, state: event.state };
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', click, true);
    window.addEventListener('popstate', popstate, true);
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', click, true); window.removeEventListener('popstate', popstate, true); };
  }, [confirmLeave, drafts]);
  const save = useCallback(async (command: PartnerCommand | ReservationCommand): Promise<SaveResult> => {
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
      return { kind: 'error', message: uncertainSaveOutcomeMessage };
    } finally { requests.finishWrite(request); }
  }, [authenticated, clearAccess, refresh, requests]);
  return <PartnerContext.Provider value={{ snapshot, access, refreshing, stale, refresh, save, confirmLeave, drafts }}>{children}</PartnerContext.Provider>;
}
