import { describe, expect, it, vi } from 'vitest';
import { PartnerDraftStore, PartnerRequestScope, type PartnerDraftRecord } from '@/components/partner/partner-provider';
import { completeStaffDraft, completeStaffMenuAction, matchingStaffDetail, postStaffCommand, readBackStaffSave, restoreStaffListFocus } from './staff-client';
import type { StaffCommand } from './staff-contracts';
import type { StaffDetailSnapshot } from './staff-server';

const merchantId = '11111111-1111-4111-8111-111111111111';
const staffA = '22222222-2222-4222-8222-222222222222';
const staffB = '33333333-3333-4333-8333-333333333333';
const detail = (id: string): StaffDetailSnapshot => ({
  merchantId, readOnly: false, loadedAt: '2026-10-18T00:00:00Z', schedule: null,
  staff: { id, merchantId, name: id === staffA ? 'A' : 'B', title: '', introduction: '', visibility: 'draft', sortOrder: 0, menuIds: [], updatedAt: '2026-10-18T00:00:00Z' },
});

describe('account-scoped staff detail reads', () => {
  it('never returns B detail to an A save/reload when a newer selection supersedes the read', async () => {
    const scope = new PartnerRequestScope();
    let finishA!: (value: StaffDetailSnapshot) => void;
    let finishB!: (value: StaffDetailSnapshot) => void;
    const pendingA = new Promise<StaffDetailSnapshot>((resolve) => { finishA = resolve; });
    const pendingB = new Promise<StaffDetailSnapshot>((resolve) => { finishB = resolve; });
    const readA = matchingStaffDetail(staffA, scope.runRead(async () => pendingA, null));
    const readB = matchingStaffDetail(staffB, scope.runRead(async () => pendingB, null));
    finishA(detail(staffA));
    finishB(detail(staffB));
    expect(await readA).toBeNull();
    expect(await readB).toEqual(detail(staffB));
  });
  it('drops a pending staff detail when the account session is disposed', async () => {
    const scope = new PartnerRequestScope();
    let finish!: (value: StaffDetailSnapshot) => void;
    const pending = new Promise<StaffDetailSnapshot>((resolve) => { finish = resolve; });
    const read = matchingStaffDetail(staffA, scope.runRead(async () => pending, null));
    scope.dispose();
    finish(detail(staffA));
    expect(await read).toBeNull();
  });
});

describe('staff command response before readback', () => {
  const command: StaffCommand = { kind: 'staffMenu', mode: 'add', staffId: staffA, menuId: staffB };
  it('acknowledges only a successful API response and sends one link with same-origin credentials', async () => {
    const post = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const controller = new AbortController();
    expect(await postStaffCommand(command, controller.signal, post)).toBe('acknowledged');
    expect(post).toHaveBeenCalledWith('/api/partner/staff', expect.objectContaining({
      method: 'POST', credentials: 'same-origin', signal: controller.signal, body: JSON.stringify(command),
    }));
  });
  it('keeps conflict, access loss, and ambiguous network outcome distinct for draft recovery', async () => {
    const controller = new AbortController();
    expect(await postStaffCommand(command, controller.signal, async () => new Response(JSON.stringify({ ok: false }), { status: 409 }))).toBe('conflict');
    expect(await postStaffCommand(command, controller.signal, async () => new Response(JSON.stringify({ ok: false }), { status: 403 }))).toBe('forbidden');
    expect(await postStaffCommand(command, controller.signal, async () => { throw new Error('connection lost'); })).toBe('ambiguous');
    expect(await postStaffCommand(command, controller.signal, async () => new Response(JSON.stringify({ ok: false }), { status: 503 }))).toBe('error');
  });
});

describe('mounted staff form completion after selection changes', () => {
  it('cancels A save readback after switching to B, even when the read resolves null', async () => {
    const scope = new PartnerRequestScope();
    let selectedId = staffA;
    let finish!: (value: StaffDetailSnapshot | null) => void;
    const pending = new Promise<StaffDetailSnapshot | null>((resolve) => { finish = resolve; });
    const request = scope.startWrite();
    expect(request).not.toBeNull();
    const outcome = readBackStaffSave(staffA, async () => pending, () => !!request?.isCurrent() && selectedId === staffA);
    selectedId = staffB;
    finish(null);
    expect(await outcome).toEqual({ kind: 'cancelled' });
    scope.finishWrite(request!);
  });

  it('does not recreate an unmounted A draft after a superseded detail read adopts B', async () => {
    const drafts = new PartnerDraftStore();
    const scope = new PartnerRequestScope();
    const key = `staff:profile:${staffA}`;
    const baseline = { values: { name: 'A' }, updatedAt: '2026-10-18T00:00:00Z' };
    const record: PartnerDraftRecord<typeof baseline> = { token: Symbol(key), draft: { ...baseline, values: { name: 'edited A' } }, baseline, state: { kind: 'pending' } };
    drafts.write(key, record); drafts.setActive(key);
    let finishA!: (value: StaffDetailSnapshot) => void;
    let finishB!: (value: StaffDetailSnapshot) => void;
    const pendingA = new Promise<StaffDetailSnapshot>((resolve) => { finishA = resolve; });
    const pendingB = new Promise<StaffDetailSnapshot>((resolve) => { finishB = resolve; });
    const readA = matchingStaffDetail(staffA, scope.runRead(async () => pendingA, null));
    const readB = matchingStaffDetail(staffB, scope.runRead(async () => pendingB, null));
    drafts.discardActive();
    finishA(detail(staffA)); finishB(detail(staffB));
    expect(await readA).toBeNull();
    expect(await readB).toEqual(detail(staffB));
    expect(completeStaffDraft(drafts, key, record, { ...record, state: { kind: 'committed-stale' } })).toBe(false);
    expect(drafts.read(key)).toBeUndefined();
  });

  it('does not put A menu uncertainty or busy state on B after a late A result', async () => {
    let selectedId = staffA;
    let finish!: (value: { kind: 'committed-stale' }) => void;
    const pending = new Promise<{ kind: 'committed-stale' }>((resolve) => { finish = resolve; });
    const applied = vi.fn();
    const action = completeStaffMenuAction(staffA, pending, () => selectedId === staffA, applied);
    selectedId = staffB;
    finish({ kind: 'committed-stale' });
    await action;
    expect(applied).not.toHaveBeenCalled();
  });
});

describe('returning from mobile staff detail', () => {
  it('focuses the selected list button after Back, and the list heading for an unsaved new staff', () => {
    const selected = { focus: vi.fn() } as unknown as HTMLButtonElement;
    const heading = { focus: vi.fn() } as unknown as HTMLElement;
    const buttons = new Map([[staffA, selected]]);
    restoreStaffListFocus(staffA, buttons, heading);
    expect(selected.focus).toHaveBeenCalledOnce();
    expect(heading.focus).not.toHaveBeenCalled();
    restoreStaffListFocus(null, buttons, heading);
    expect(heading.focus).toHaveBeenCalledOnce();
  });
});
