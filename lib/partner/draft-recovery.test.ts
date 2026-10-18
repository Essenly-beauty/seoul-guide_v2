import { describe, expect, it, vi } from 'vitest';
import { PartnerDraftStore, uncertainSaveOutcomeMessage, type PartnerDraftRecord } from '@/components/partner/partner-provider';
import { rebaseUnchangedSharedSchedule } from '@/components/partner/partner-form';

const entry = (): PartnerDraftRecord<{ name: string; updatedAt: string }> => ({ token: Symbol(), draft: { name: '편집 중', updatedAt: '2026-10-18T01:02:03.123456+00:00' }, baseline: { name: '저장된 이름', updatedAt: '2026-10-18T01:02:03.123456+00:00' }, state: { kind: 'idle' } });

describe('session-scoped partner draft recovery', () => {
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
  it('does not rebase pending, reloading or committed-stale drafts', () => {
    const baseline = { values: [], updatedAt: '2026-10-18T01:00:00Z' };
    const next = { values: [], updatedAt: '2026-10-18T02:00:00Z' };
    for (const kind of ['pending', 'reloading', 'committed-stale'] as const) {
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
