import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { guardPartnerNavigate, guardPartnerPopstate, PartnerDraftStore, uncertainSaveOutcomeMessage, type PartnerDraftRecord } from '@/components/partner/partner-provider';
import { failedReloadState, rebaseUnchangedSharedSchedule, SaveStatus } from '@/components/partner/partner-form';

const entry = (): PartnerDraftRecord<{ name: string; updatedAt: string }> => ({ token: Symbol(), draft: { name: '편집 중', updatedAt: '2026-10-18T01:02:03.123456+00:00' }, baseline: { name: '저장된 이름', updatedAt: '2026-10-18T01:02:03.123456+00:00' }, state: { kind: 'idle' } });

describe('session-scoped partner draft recovery', () => {
  it('retains a submitted booking request through internal discard and restores its exact request ID', () => {
    const store = new PartnerDraftStore();
    const request = { requestId: '11111111-1111-4111-8111-111111111111', startAt: '2026-10-20T10:00:00+09:00' };
    const pending: PartnerDraftRecord<typeof request | null> = { token: Symbol(), draft: request, baseline: null, state: { kind: 'pending' }, retainUnconfirmed: true };
    store.write('booking:create:studio', pending);
    store.write('settings', entry());
    store.setActive('booking:create:studio'); store.setActive('settings');
    expect(store.hasRetainedSubmission()).toBe(true);
    store.discardActive();
    expect(store.read('settings')).toBeUndefined();
    expect(store.read('booking:create:studio')?.draft).toEqual(request);
    // The old editor's aborted response must still update the preserved token.
    expect(store.complete('booking:create:studio', pending.token, { ...pending, state: { kind: 'unconfirmed' } })).toBe(true);
    store.setActive(null); store.setActive('booking:create:studio');
    store.discardActive();
    expect(store.read('booking:create:studio')?.draft).toEqual(request);
    expect(store.complete('booking:create:studio', pending.token, { ...pending, draft: null, baseline: null, state: { kind: 'saved' } })).toBe(true);
    expect(store.hasRetainedSubmission()).toBe(false);
    expect(store.hasUnsavedChanges()).toBe(false);
    store.discardActive();
    expect(store.read('booking:create:studio')).toBeUndefined();
  });
  it('does not restore a retained submitted booking into another account session', () => {
    const store = new PartnerDraftStore();
    const pending = { ...entry(), state: { kind: 'unconfirmed' as const }, retainUnconfirmed: true };
    store.write('booking:create:studio', pending); store.setActive('booking:create:studio');
    store.clear();
    expect(store.complete('booking:create:studio', pending.token, pending)).toBe(false);
    expect(store.hasUnsavedChanges()).toBe(false);
    expect(store.read('booking:create:studio')).toBeUndefined();
  });
  it('keeps the unload warning for inactive unsaved drafts, but not confirmed commits', () => {
    const store = new PartnerDraftStore();
    const record = entry();
    store.write('settings', record);
    store.setActive(null);
    expect(store.hasUnsavedChanges()).toBe(true);
    store.write('settings', { ...record, state: { kind: 'committed-stale' } });
    expect(store.hasUnsavedChanges()).toBe(false);
    store.write('settings', { ...record, draft: record.baseline, state: { kind: 'pending' } });
    expect(store.hasUnsavedChanges()).toBe(true);
  });
  it('treats an unacknowledged POST as unsaved even when values equal the baseline', () => {
    const store = new PartnerDraftStore();
    const record = entry();
    const unconfirmed: PartnerDraftRecord<typeof record.draft> = { ...record, draft: record.baseline, state: { kind: 'unconfirmed' } };
    store.write('staff', unconfirmed); store.setActive('staff');
    expect(store.hasActiveUnsavedChanges()).toBe(true);
    expect(store.confirmReload('staff', () => false)).toBe(false);
    store.setActive(null, 'staff');
    expect(store.hasUnsavedChanges()).toBe(true);
    const html = renderToStaticMarkup(createElement(SaveStatus, { state: unconfirmed.state, onReload: () => {} }));
    expect(html).toContain('저장 여부');
    expect(html).not.toContain('저장은 완료');
  });
  it('blocks a history traversal out of partner when an inactive unconfirmed draft is not discarded', () => {
    const store = new PartnerDraftStore();
    const record = { ...entry(), draft: entry().baseline, state: { kind: 'unconfirmed' as const } };
    store.write('staff:profile:existing', record);
    const previous = { href: 'http://localhost/partner/staff', state: { __NA: true, tree: 'partner' } };
    const stop = vi.fn();
    const restore = vi.fn();
    const confirm = vi.fn(() => false);
    expect(guardPartnerPopstate({ stopImmediatePropagation: stop }, previous, 'http://localhost/support', store, () => true, confirm, restore)).toBe(false);
    expect(stop).toHaveBeenCalledOnce();
    expect(restore).toHaveBeenCalledWith(previous);
    expect(store.read('staff:profile:existing')).toBe(record);
    expect(confirm).toHaveBeenCalledOnce();
  });
  it('lets confirmed external traversal clear drafts and internal traversal use active-form confirmation', () => {
    const store = new PartnerDraftStore();
    const record = entry();
    store.write('settings', record); store.setActive('settings');
    const previous = { href: 'http://localhost/partner/settings', state: { __NA: true } };
    const stop = vi.fn();
    const restore = vi.fn();
    const confirmLeave = vi.fn(() => { store.discardActive(); return true; });
    expect(guardPartnerPopstate({ stopImmediatePropagation: stop }, previous, 'http://localhost/partner/staff', store, confirmLeave, () => false, restore)).toBe(true);
    expect(confirmLeave).toHaveBeenCalledOnce();
    expect(store.read('settings')).toBeUndefined();
    store.write('settings', record);
    expect(guardPartnerPopstate({ stopImmediatePropagation: stop }, previous, 'http://localhost/support', store, confirmLeave, () => true, restore)).toBe(true);
    expect(store.read('settings')).toBeUndefined();
    expect(stop).not.toHaveBeenCalled();
    expect(restore).not.toHaveBeenCalled();
  });
  it('restores the current route for a declined internal Back and ignores same-URL history entries', () => {
    const store = new PartnerDraftStore();
    const record = entry();
    store.write('staff', record); store.setActive('staff');
    const previous = { href: 'http://localhost/partner/staff', state: { __NA: true } };
    const stop = vi.fn();
    const restore = vi.fn();
    const confirmLeave = vi.fn(() => false);
    expect(guardPartnerPopstate({ stopImmediatePropagation: stop }, previous, 'http://localhost/partner/services', store, confirmLeave, () => true, restore)).toBe(false);
    expect(restore).toHaveBeenCalledWith(previous);
    expect(store.read('staff')).toBe(record);
    expect(guardPartnerPopstate({ stopImmediatePropagation: stop }, previous, previous.href, store, confirmLeave, () => true, restore)).toBe(true);
    expect(confirmLeave).toHaveBeenCalledOnce();
  });
  it('cancels a supported Back before traversal without rewriting history or losing an unconfirmed draft', () => {
    const store = new PartnerDraftStore();
    const record = { ...entry(), draft: entry().baseline, state: { kind: 'unconfirmed' as const } };
    store.write('staff:profile:existing', record);
    const prevent = vi.fn();
    const confirmExit = vi.fn(() => false);
    const event = { navigationType: 'traverse', cancelable: true, destination: { url: 'http://localhost/support', key: 'support-entry', sameDocument: true }, preventDefault: prevent };
    expect(guardPartnerNavigate(event, 'http://localhost/partner/staff', store, () => true, confirmExit)).toBeNull();
    expect(prevent).toHaveBeenCalledOnce();
    expect(confirmExit).toHaveBeenCalledOnce();
    expect(store.read('staff:profile:existing')).toBe(record);
  });
  it('defers noncancelable and cross-document traversals to the existing popstate fallback', () => {
    const store = new PartnerDraftStore();
    store.write('settings', entry()); store.setActive('settings');
    const confirmLeave = vi.fn(() => false);
    const prevent = vi.fn();
    const destination = { url: 'http://localhost/partner/services', key: 'services-entry', sameDocument: true };
    expect(guardPartnerNavigate({ navigationType: 'traverse', cancelable: false, destination, preventDefault: prevent }, 'http://localhost/partner/settings', store, confirmLeave, () => false)).toBeNull();
    expect(guardPartnerNavigate({ navigationType: 'traverse', cancelable: true, destination: { ...destination, sameDocument: false }, preventDefault: prevent }, 'http://localhost/partner/settings', store, confirmLeave, () => false)).toBeNull();
    expect(prevent).not.toHaveBeenCalled();
    expect(confirmLeave).not.toHaveBeenCalled();
    expect(store.hasUnsavedChanges()).toBe(true);
  });
  it('does not discard a draft when traversing between same-URL history entries', () => {
    const store = new PartnerDraftStore();
    store.write('settings', entry()); store.setActive('settings');
    const confirmLeave = vi.fn(() => true);
    const prevent = vi.fn();
    const href = 'http://localhost/partner/settings';
    expect(guardPartnerNavigate({ navigationType: 'traverse', cancelable: true, destination: { url: href, key: 'other-entry', sameDocument: true }, preventDefault: prevent }, href, store, confirmLeave, () => true)).toBeNull();
    expect(confirmLeave).not.toHaveBeenCalled();
    expect(prevent).not.toHaveBeenCalled();
    expect(store.hasUnsavedChanges()).toBe(true);
  });
  it('consumes an accepted pre-traversal approval only for its matching history entry', () => {
    const store = new PartnerDraftStore();
    store.write('settings', entry()); store.setActive('settings');
    const confirmLeave = vi.fn(() => { store.discardActive(); return true; });
    const previous = { href: 'http://localhost/partner/settings', state: { __NA: true } };
    const destination = { url: 'http://localhost/partner/services', key: 'services-entry', sameDocument: true };
    const approval = guardPartnerNavigate({ navigationType: 'traverse', cancelable: true, destination, preventDefault: vi.fn() }, previous.href, store, confirmLeave, () => false);
    expect(approval).toEqual({ href: destination.url, key: destination.key });
    expect(guardPartnerPopstate({ stopImmediatePropagation: vi.fn() }, previous, destination.url, store, confirmLeave, () => false, vi.fn(), approval, destination.key)).toBe(true);
    expect(confirmLeave).toHaveBeenCalledOnce();
    store.write('settings', entry()); store.setActive('settings');
    confirmLeave.mockReturnValue(false);
    const restore = vi.fn();
    expect(guardPartnerPopstate({ stopImmediatePropagation: vi.fn() }, previous, destination.url, store, confirmLeave, () => false, restore, approval, 'different-entry')).toBe(false);
    expect(confirmLeave).toHaveBeenCalledTimes(2);
    expect(restore).toHaveBeenCalledWith(previous);
  });
  it('does not unlock an unconfirmed form when its explicit recovery read fails', () => {
    expect(failedReloadState({ kind: 'unconfirmed' }, 'read failed')).toEqual({ kind: 'unconfirmed' });
    expect(failedReloadState({ kind: 'committed-stale' }, 'read failed')).toEqual({ kind: 'committed-stale' });
    expect(failedReloadState({ kind: 'idle' }, 'read failed')).toEqual({ kind: 'error', message: 'read failed' });
  });
  it('retains entered values, exact baseline version and the new editor UUID across subscribers', () => {
    const store = new PartnerDraftStore();
    const record = entry();
    const id = '11111111-1111-4111-8111-111111111111';
    store.setEditor({ kind: 'menu', id });
    store.write(`menu:${id}`, record);
    const unsubscribe = store.subscribe(() => {});
    unsubscribe(); // A route unmount does not clear the session store.
    expect(store.read(`menu:${id}`)).toEqual(record);
    expect(store.getEditor()).toEqual({ kind: 'menu', id });
    expect(store.read(`menu:${id}`)?.baseline).toEqual(record.baseline);
  });
  it('publishes a pending save outcome to a form restored after route navigation', () => {
    const store = new PartnerDraftStore();
    const record = { ...entry(), state: { kind: 'pending' as const } };
    store.write('settings', record);
    const observed: string[] = [];
    const unsubscribe = store.subscribe(() => observed.push(store.read('settings')!.state.kind));
    const saved = { ...record, baseline: record.draft, state: { kind: 'saved' as const } };
    expect(store.complete('settings', record.token, saved)).toBe(true);
    expect(observed).toEqual(['saved']);
    expect(store.read('settings')).toEqual(saved);
    unsubscribe();
  });
  it('discards only the active draft and prevents its late save overwriting a newer editor', () => {
    const store = new PartnerDraftStore();
    const old = entry();
    store.write('settings', old);
    store.write('schedule', entry());
    store.setActive('settings');
    store.discardActive();
    expect(store.read('settings')).toBeUndefined();
    expect(store.read('schedule')).toBeDefined();
    const replacement = entry();
    store.write('settings', replacement);
    expect(store.complete('settings', old.token, old)).toBe(false);
    expect(store.read('settings')).toBe(replacement);
  });
  it('tracks every mounted form and discards all active edits without touching inactive drafts', () => {
    const store = new PartnerDraftStore();
    store.write('schedule', entry());
    store.write('reservationRules', entry());
    store.write('dateOverrides', entry());
    store.write('menu:inactive', entry());
    store.setActive('schedule');
    store.setActive('reservationRules');
    store.setActive('dateOverrides');
    expect(store.hasActiveUnsavedChanges()).toBe(true);
    store.discardActive();
    expect(store.read('schedule')).toBeUndefined();
    expect(store.read('reservationRules')).toBeUndefined();
    expect(store.read('dateOverrides')).toBeUndefined();
    expect(store.read('menu:inactive')).toBeDefined();
    expect(store.hasActiveUnsavedChanges()).toBe(false);
  });
  it('unmounting one form does not mark another mounted form inactive', () => {
    const store = new PartnerDraftStore();
    store.write('schedule', entry());
    store.write('dateOverrides', entry());
    store.setActive('schedule');
    store.setActive('dateOverrides');
    store.setActive(null, 'schedule');
    expect(store.hasActiveUnsavedChanges()).toBe(true);
    store.discardActive();
    expect(store.read('schedule')).toBeDefined();
    expect(store.read('dateOverrides')).toBeUndefined();
  });
  it('checks only the form being reloaded while preserving another dirty form', () => {
    const store = new PartnerDraftStore();
    const clean = entry();
    store.write('schedule', { ...clean, draft: clean.baseline });
    const special = entry();
    store.write('dateOverrides', special);
    store.setActive('schedule');
    store.setActive('dateOverrides');
    const confirm = vi.fn(() => false);
    expect(store.confirmReload('schedule', confirm)).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    expect(store.confirmReload('dateOverrides', confirm)).toBe(false);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(store.read('dateOverrides')).toEqual(special);
    expect(store.read('schedule')?.draft).toEqual(clean.baseline);
  });
  it('does not promise a stable client identifier when a save outcome is unknown', () => {
    expect(uncertainSaveOutcomeMessage).toContain('저장 여부를 확인');
    expect(uncertainSaveOutcomeMessage).not.toMatch(/같은 식별자|중복 없이 재시도/);
  });
  it('keeps dirty weekly hours and rebases only their version after a special-date save', () => {
    const baseline = { values: { hours: [], breaks: [], blocks: [] }, updatedAt: null as string | null };
    const record = { token: Symbol(), baseline, draft: { values: { ...baseline.values, hours: [{ weekday: 1, startMinute: 540, endMinute: 1080 }] }, updatedAt: baseline.updatedAt }, state: { kind: 'idle' as const } };
    const next = { values: baseline.values, updatedAt: '2026-10-18T02:00:00Z' };
    const rebased = rebaseUnchangedSharedSchedule(record, next);
    expect(rebased?.draft.values).toEqual(record.draft.values);
    expect(rebased?.draft.updatedAt).toBe(next.updatedAt);
    expect(rebased?.baseline.values).toEqual(baseline.values);
    expect(rebased?.baseline.updatedAt).toBe(next.updatedAt);
    expect(rebased?.token).toBe(record.token);
  });
  it('keeps dirty special dates and rebases only their version after a weekly-hours save', () => {
    const baseline = { values: [], updatedAt: null };
    const record = { token: Symbol(), baseline, draft: { values: [{ date: '2026-11-05', closed: true, hours: [], breaks: [] }], updatedAt: null }, state: { kind: 'idle' as const } };
    const next = { values: [], updatedAt: '2026-10-18T02:00:00Z' };
    const rebased = rebaseUnchangedSharedSchedule(record, next);
    expect(rebased?.draft.values).toEqual(record.draft.values);
    expect(rebased?.draft.updatedAt).toBe(next.updatedAt);
    expect(rebased?.baseline.updatedAt).toBe(next.updatedAt);
  });
  it('retains the stale stamp when the same persisted field changed externally', () => {
    const baseline = { values: [], updatedAt: '2026-10-18T01:00:00Z' };
    const record = { token: Symbol(), baseline, draft: { values: [{ date: '2026-11-05' }], updatedAt: baseline.updatedAt }, state: { kind: 'conflict' as const, message: '충돌' } };
    expect(rebaseUnchangedSharedSchedule(record, { values: [{ date: '2026-11-06' }], updatedAt: '2026-10-18T02:00:00Z' })).toBeNull();
    expect(record.draft.updatedAt).toBe(baseline.updatedAt);
    expect(rebaseUnchangedSharedSchedule(record, { values: baseline.values, updatedAt: '2026-10-18T02:00:00Z' })?.state).toEqual({ kind: 'idle' });
  });
  it('does not rebase pending, reloading, committed-stale or unconfirmed drafts', () => {
    const baseline = { values: [], updatedAt: '2026-10-18T01:00:00Z' };
    const next = { values: [], updatedAt: '2026-10-18T02:00:00Z' };
    for (const kind of ['pending', 'reloading', 'committed-stale', 'unconfirmed'] as const) {
      const record = { token: Symbol(), baseline, draft: { values: [{ date: '2026-11-05' }], updatedAt: baseline.updatedAt }, state: { kind } };
      expect(rebaseUnchangedSharedSchedule(record, next)).toBeNull();
    }
  });
  it('clears all private draft/editor state on access loss or session teardown', () => {
    const store = new PartnerDraftStore();
    const record = entry();
    store.write('settings', record);
    store.setEditor({ kind: 'category', id: 'private-draft-id' });
    store.clear();
    expect(store.read('settings')).toBeUndefined();
    expect(store.getEditor()).toBeNull();
    expect(store.complete('settings', record.token, record)).toBe(false);
    expect(new PartnerDraftStore().read('settings')).toBeUndefined();
  });
});
