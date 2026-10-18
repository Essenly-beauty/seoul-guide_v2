import type { StaffDetailSnapshot } from './staff-server';
import type { StaffCommand } from './staff-contracts';
import type { PartnerDraftRecord, PartnerDraftStore } from '@/components/partner/partner-provider';

export type StaffPostResult = 'acknowledged' | 'conflict' | 'forbidden' | 'error' | 'ambiguous';

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
  } catch { return 'ambiguous'; }
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
