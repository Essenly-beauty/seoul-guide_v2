import type { StaffDetailSnapshot, StaffListSnapshot } from './staff-server';
import type { StaffCommand } from './staff-contracts';
import type { PartnerDraftRecord, PartnerDraftStore } from '@/components/partner/partner-provider';

export type StaffPostResult = 'acknowledged' | 'conflict' | 'forbidden' | 'error' | 'unconfirmed';

export async function postStaffCommand(command: StaffCommand, signal: AbortSignal, post: typeof fetch = fetch): Promise<StaffPostResult> {
  try {
    const response = await post('/api/partner/staff', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(command), signal,
    });
    const body = await response.json();
    if (response.status === 401 || response.status === 403) return 'forbidden';
    if (response.status === 409) return 'conflict';
    return response.ok && body?.ok === true ? 'acknowledged' : 'error';
  } catch { return 'unconfirmed'; }
}

/** A superseded request may adopt a later read; never give that result to another staff form. */
export async function matchingStaffDetail(id: string, pending: Promise<StaffDetailSnapshot | null>): Promise<StaffDetailSnapshot | null> {
  const result = await pending;
  return result?.staff.id === id ? result : null;
}

/** A form owns one token; an unmounted or discarded form cannot write its result back. */
export function completeStaffDraft<T>(drafts: PartnerDraftStore, key: string, previous: PartnerDraftRecord<T>, next: PartnerDraftRecord<T>): boolean {
  return drafts.complete(key, previous.token, next);
}

/** A read may finish after its form was hidden, even when its clean draft token still exists. */
export async function completeStaffReload(
  id: string, pending: Promise<StaffDetailSnapshot | null>, isCurrentView: () => boolean,
  apply: (fresh: StaffDetailSnapshot | null) => unknown | Promise<unknown>,
): Promise<void> {
  const fresh = await pending;
  if (isCurrentView()) await apply(fresh?.staff.id === id ? fresh : null);
}

export function discardStaffSelectionDrafts(drafts: PartnerDraftStore, id: string): void {
  for (const key of [`staff:profile:${id}`, `staff:calendar:${id}`]) {
    const record = drafts.read(key);
    if (!record || record.state.kind === 'pending' || record.state.kind === 'committed-stale' || record.state.kind === 'unconfirmed') continue;
    if (JSON.stringify(record.draft) === JSON.stringify(record.baseline)) drafts.discard(key);
  }
}

/** Passive reads may refresh detail, but only an explicit recovery read unlocks uncertain menu links. */
export function staffMenuLockAfterRead(locks: Map<string, string>, id: string, explicitRecovery: boolean): string | null {
  if (explicitRecovery) locks.delete(id);
  return locks.get(id) ?? null;
}

export function lockPendingStaffMenuOnLeave(locks: Map<string, string>, pending: ReadonlyMap<string, Promise<void>>, id: string): void {
  if (pending.has(id) && !locks.has(id)) locks.set(id, '이전 연결 요청의 결과가 확인되지 않았습니다. 연결 상태를 다시 불러와 확인해 주세요.');
}

/** Do not read a possibly pre-write snapshot or apply recovery after another staff is selected. */
export async function recoverStaffMenuLock(
  id: string, pending: Promise<void> | undefined, isSelected: () => boolean,
  load: (id: string, explicitRecovery: boolean) => Promise<StaffDetailSnapshot | null>,
): Promise<StaffDetailSnapshot | null> {
  if (pending) await pending;
  return isSelected() ? load(id, true) : null;
}

/** An absent ID in a fresh account-scoped list permits retry with that same UUID; it does not prove an in-flight POST can never finish. */
export function staffCreateAbsentFromList(id: string, list: StaffListSnapshot | null): boolean {
  return !!list && !list.staff.some((person) => person.id === id);
}

export async function readBackStaffSave(
  id: string, loadDetail: (id: string) => Promise<StaffDetailSnapshot | null>, isCurrent: () => boolean,
): Promise<{ kind: 'saved'; detail: StaffDetailSnapshot } | { kind: 'committed-stale' } | { kind: 'cancelled' }> {
  const detail = await loadDetail(id);
  if (!isCurrent()) return { kind: 'cancelled' };
  return detail ? { kind: 'saved', detail } : { kind: 'committed-stale' };
}

/** Menu feedback belongs to the staff selection that started the command. */
export async function completeStaffMenuAction<T extends { kind: string }>(
  id: string, pending: Promise<T>, isSelected: () => boolean, apply: (result: T) => void,
): Promise<void> {
  const result = await pending;
  if (result.kind !== 'cancelled' && isSelected()) apply(result);
}

/** Called after the list is visible again, so focus never remains in its hidden detail pane. */
export function restoreStaffListFocus(id: string | null, buttons: ReadonlyMap<string, HTMLButtonElement>, heading: HTMLElement | null): void {
  ((id ? buttons.get(id) : null) ?? heading)?.focus();
}
