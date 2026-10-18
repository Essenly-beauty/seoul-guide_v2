import { describe, expect, it, vi } from 'vitest';
import { PartnerDraftStore, PartnerRequestScope, type PartnerDraftRecord } from '@/components/partner/partner-provider';
import { completeStaffDraft, completeStaffMenuAction, completeStaffReload, discardStaffSelectionDrafts, lockPendingStaffMenuOnLeave, matchingStaffDetail, postStaffCommand, readBackStaffSave, recoverStaffMenuLock, restoreStaffListFocus, staffCreateAbsentFromList, staffMenuLockAfterRead } from './staff-client';
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
  it('keeps conflict, access loss, and unconfirmed POST/JSON outcomes distinct from an acknowledged save', async () => {
    const controller = new AbortController();
    expect(await postStaffCommand(command, controller.signal, async () => new Response(JSON.stringify({ ok: false }), { status: 409 }))).toBe('conflict');
    expect(await postStaffCommand(command, controller.signal, async () => new Response(JSON.stringify({ ok: false }), { status: 403 }))).toBe('forbidden');
    expect(await postStaffCommand(command, controller.signal, async () => { throw new Error('connection lost'); })).toBe('unconfirmed');
    expect(await postStaffCommand(command, controller.signal, async () => new Response('not JSON', { status: 200 }))).toBe('unconfirmed');
    expect(await postStaffCommand(command, controller.signal, async () => new Response(JSON.stringify({ ok: false }), { status: 503 }))).toBe('error');
  });
  it('uses the same create UUID for a retry after an unconfirmed POST and treats 409 as conflict', async () => {
    const command: StaffCommand = { kind: 'staff', mode: 'create', id: staffA, values: { name: 'A', title: '', introduction: '', visibility: 'draft', sortOrder: 0 } };
    const bodies: string[] = [];
    const post = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      bodies.push(String(init?.body));
      return bodies.length === 1 ? Promise.reject(new Error('response lost')) : new Response(JSON.stringify({ ok: false }), { status: 409 });
    }) as typeof fetch;
    const controller = new AbortController();
    expect(await postStaffCommand(command, controller.signal, post)).toBe('unconfirmed');
    expect(staffCreateAbsentFromList(staffA, null)).toBe(false); // A failed verification read must remain locked.
    expect(staffCreateAbsentFromList(staffA, { merchantId, staff: [detail(staffB).staff], readOnly: false, loadedAt: '2026-10-18T00:00:00Z' })).toBe(true);
    expect(await postStaffCommand(command, controller.signal, post)).toBe('conflict');
    expect(JSON.parse(bodies[0]).id).toBe(staffA);
    expect(bodies[1]).toBe(bodies[0]);
    expect(staffCreateAbsentFromList(staffA, { merchantId, staff: [detail(staffA).staff], readOnly: false, loadedAt: '2026-10-18T00:00:00Z' })).toBe(false);
  });
});

describe('mounted staff form completion after selection changes', () => {
  it('reserves committed-stale for an acknowledged POST whose detail readback fails', async () => {
    expect(await readBackStaffSave(staffA, async () => null, () => true)).toEqual({ kind: 'committed-stale' });
  });
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

  it('ignores a clean A profile/calendar reload after B is selected, then removes the stale form records', async () => {
    const drafts = new PartnerDraftStore();
    const scope = new PartnerRequestScope();
    const profileKey = `staff:profile:${staffA}`;
    const calendarKey = `staff:calendar:${staffA}`;
    const baseline = { values: { name: 'A' }, updatedAt: '2026-10-18T00:00:00Z' };
    const profile: PartnerDraftRecord<typeof baseline> = { token: Symbol(profileKey), draft: baseline, baseline, state: { kind: 'reloading' } };
    const calendar: PartnerDraftRecord<typeof baseline> = { token: Symbol(calendarKey), draft: baseline, baseline, state: { kind: 'reloading' } };
    drafts.write(profileKey, profile); drafts.write(calendarKey, calendar);
    drafts.setActive(profileKey); drafts.setActive(calendarKey);
    expect(drafts.hasActiveUnsavedChanges()).toBe(false);

    let selectedId = staffA;
    let finishA!: (value: StaffDetailSnapshot) => void;
    let finishB!: (value: StaffDetailSnapshot) => void;
    const pendingA = new Promise<StaffDetailSnapshot>((resolve) => { finishA = resolve; });
    const pendingB = new Promise<StaffDetailSnapshot>((resolve) => { finishB = resolve; });
    const readA = matchingStaffDetail(staffA, scope.runRead(async () => pendingA, null));
    const applyProfile = vi.fn((fresh: StaffDetailSnapshot | null) => completeStaffDraft(drafts, profileKey, profile, { ...profile, state: fresh ? { kind: 'idle' } : { kind: 'error', message: 'false reload error' } }));
    const applyCalendar = vi.fn((fresh: StaffDetailSnapshot | null) => completeStaffDraft(drafts, calendarKey, calendar, { ...calendar, state: fresh ? { kind: 'idle' } : { kind: 'error', message: 'false reload error' } }));
    const profileReload = completeStaffReload(staffA, readA, () => selectedId === staffA, applyProfile);
    const calendarReload = completeStaffReload(staffA, readA, () => selectedId === staffA, applyCalendar);

    selectedId = staffB;
    const readB = matchingStaffDetail(staffB, scope.runRead(async () => pendingB, null));
    finishA(detail(staffA)); finishB(detail(staffB));
    expect(await readA).toBeNull();
    expect(await readB).toEqual(detail(staffB));
    await Promise.all([profileReload, calendarReload]);
    expect(applyProfile).not.toHaveBeenCalled();
    expect(applyCalendar).not.toHaveBeenCalled();
    expect(drafts.read(profileKey)?.state).toEqual({ kind: 'reloading' });
    expect(drafts.read(calendarKey)?.state).toEqual({ kind: 'reloading' });
    discardStaffSelectionDrafts(drafts, staffA);
    expect(drafts.read(profileKey)).toBeUndefined();
    expect(drafts.read(calendarKey)).toBeUndefined();
  });

  it('preserves uncertain and unconfirmed dirty A input across A→B→A while clearing only clean records', () => {
    const drafts = new PartnerDraftStore();
    const profileKey = `staff:profile:${staffA}`;
    const calendarKey = `staff:calendar:${staffA}`;
    const inactiveDirtyKey = `staff:profile:${staffB}`;
    const baseline = { values: { name: 'A' }, updatedAt: '2026-10-18T00:00:00Z' };
    const changed = { ...baseline, values: { name: 'uncertain A edit' } };
    const uncertain: PartnerDraftRecord<typeof baseline> = { token: Symbol(profileKey), draft: changed, baseline, state: { kind: 'committed-stale' } };
    const clean: PartnerDraftRecord<typeof baseline> = { token: Symbol(calendarKey), draft: baseline, baseline, state: { kind: 'reloading' } };
    const unconfirmedDirty: PartnerDraftRecord<typeof baseline> = { token: Symbol(inactiveDirtyKey), draft: changed, baseline, state: { kind: 'error', message: 'retry' } };
    drafts.write(profileKey, uncertain); drafts.write(calendarKey, clean); drafts.write(inactiveDirtyKey, unconfirmedDirty);
    drafts.setActive(profileKey); drafts.setActive(calendarKey);
    expect(drafts.hasActiveUnsavedChanges()).toBe(false);

    discardStaffSelectionDrafts(drafts, staffA); // Navigate A → B without a discard confirmation.
    expect(drafts.read(profileKey)).toBe(uncertain);
    expect(drafts.read(calendarKey)).toBeUndefined();
    discardStaffSelectionDrafts(drafts, staffB);
    expect(drafts.read(inactiveDirtyKey)).toBe(unconfirmedDirty);
    expect(drafts.read(profileKey)?.draft).toEqual(changed); // Return B → A and recover the uncertain form.
    expect(drafts.read(profileKey)?.state).toEqual({ kind: 'committed-stale' });
  });

  it('preserves unconfirmed A input on staff switches even when its draft equals its baseline', () => {
    const drafts = new PartnerDraftStore();
    const key = `staff:profile:${staffA}`;
    const baseline = { values: { name: 'A' }, updatedAt: '2026-10-18T00:00:00Z' };
    const unconfirmed: PartnerDraftRecord<typeof baseline> = { token: Symbol(key), draft: baseline, baseline, state: { kind: 'unconfirmed' } };
    drafts.write(key, unconfirmed); drafts.setActive(key);
    expect(drafts.hasActiveUnsavedChanges()).toBe(true);
    drafts.setActive(null, key);
    expect(drafts.hasUnsavedChanges()).toBe(true);
    discardStaffSelectionDrafts(drafts, staffA);
    expect(drafts.read(key)).toBe(unconfirmed);
  });

  it('keeps a menu link locked across background reads and staff switches until explicit successful reload', () => {
    const locks = new Map([[staffA, '연결 요청 결과를 확인할 수 없습니다.']]);
    expect(staffMenuLockAfterRead(locks, staffA, false)).toBe('연결 요청 결과를 확인할 수 없습니다.');
    expect(staffMenuLockAfterRead(locks, staffB, false)).toBeNull();
    expect(locks.get(staffA)).toBeDefined(); // Return B → A: the original menu is still locked.
    expect(staffMenuLockAfterRead(locks, staffA, true)).toBeNull();
    expect(locks.has(staffA)).toBe(false);
  });

  it('locks only A when its menu write is pending at selection switch and waits for completion before recovery read', async () => {
    const locks = new Map<string, string>();
    let finish!: () => void;
    const pendingAction = new Promise<void>((resolve) => { finish = resolve; });
    const pending = new Map([[staffA, pendingAction]]);
    lockPendingStaffMenuOnLeave(locks, pending, staffA);
    expect(locks.get(staffA)).toContain('연결 요청');
    expect(locks.has(staffB)).toBe(false);
    const read = vi.fn(async () => detail(staffA));
    let selectedId = staffB;
    const cancelledRecovery = recoverStaffMenuLock(staffA, pendingAction, () => selectedId === staffA, read);
    expect(read).not.toHaveBeenCalled();
    finish();
    expect(await cancelledRecovery).toBeNull();
    expect(locks.has(staffA)).toBe(true);
    selectedId = staffA;
    expect(await recoverStaffMenuLock(staffA, pendingAction, () => selectedId === staffA, read)).toEqual(detail(staffA));
    expect(read).toHaveBeenCalledWith(staffA, true);
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
