import type { StaffDetailSnapshot } from './staff-server';
import type { StaffCommand } from './staff-contracts';

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

/** Called after the list is visible again, so focus never remains in its hidden detail pane. */
export function restoreStaffListFocus(id: string | null, buttons: ReadonlyMap<string, HTMLButtonElement>, heading: HTMLElement | null): void {
  ((id ? buttons.get(id) : null) ?? heading)?.focus();
}
