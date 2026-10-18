'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import type { PartnerCommand, PartnerSnapshot } from '@/lib/partner/contracts';
import type { ReservationCommand } from '@/lib/partner/reservation-commands';
import { usePartner, type PartnerDraftRecord } from './partner-provider';
import styles from './partner.module.css';

export type SaveState = { kind: 'idle' | 'pending' | 'reloading' | 'saved' | 'committed-stale' } | { kind: 'error' | 'conflict'; message: string };
export function SaveStatus({ state, onReload }: { state: SaveState; onReload: () => void }) {
  if (state.kind === 'idle') return null;
  return <div className={styles.saveStatus}>
    <Notice tone={state.kind === 'error' || state.kind === 'conflict' || state.kind === 'committed-stale' ? 'warning' : 'info'} role={state.kind === 'error' || state.kind === 'conflict' ? 'alert' : 'status'}>
      {state.kind === 'pending' ? '저장 중입니다…' : state.kind === 'reloading' ? '최신 정보를 불러오는 중입니다…' : state.kind === 'saved' ? '저장했습니다.' : state.kind === 'committed-stale' ? '저장은 완료됐지만 최신 정보 조회 실패. 중복 저장을 막기 위해 다시 불러오기 전까지 편집을 잠갔습니다.' : 'message' in state ? state.message : ''}
    </Notice>
    {(state.kind === 'conflict' || state.kind === 'committed-stale') && <Button variant="secondary" onClick={onReload}>{state.kind === 'conflict' ? '변경사항 버리고 다시 불러오기' : '저장된 정보 다시 불러오기'}</Button>}
  </div>;
}

type VersionedValues = { values: unknown; updatedAt: string | null };

/** Preserve this form's edits when only a sibling field changed on the shared schedule row. */
export function rebaseUnchangedSharedSchedule<T extends VersionedValues>(record: PartnerDraftRecord<T>, incoming: VersionedValues): PartnerDraftRecord<T> | null {
  if (!incoming.updatedAt || incoming.updatedAt === record.baseline.updatedAt ||
    record.state.kind === 'pending' || record.state.kind === 'reloading' || record.state.kind === 'committed-stale' ||
    JSON.stringify(record.draft) === JSON.stringify(record.baseline) ||
    JSON.stringify(incoming.values) !== JSON.stringify(record.baseline.values)) return null;
  return { ...record,
    draft: { ...record.draft, updatedAt: incoming.updatedAt },
    baseline: { ...record.baseline, updatedAt: incoming.updatedAt },
    state: record.state.kind === 'conflict' ? { kind: 'idle' } : record.state };
}

/** The baseline (including the exact DB version) travels with the draft. */
export function usePartnerDraft<T extends VersionedValues>(key: string, initial: T, rebaseSharedScheduleVersion = false) {
  const partner = usePartner();
  const { drafts } = partner;
  const [fallback] = useState<PartnerDraftRecord<T>>(() => ({ token: Symbol(key), draft: initial, baseline: initial, state: { kind: 'idle' } }));
  const [restored] = useState(() => {
    const previous = drafts.read<T>(key);
    return !!previous && (JSON.stringify(previous.draft) !== JSON.stringify(previous.baseline) || ['pending', 'reloading', 'committed-stale'].includes(previous.state.kind));
  });
  const getSnapshot = useCallback(() => drafts.read<T>(key) ?? fallback, [drafts, key, fallback]);
  const record = useSyncExternalStore(drafts.subscribe, getSnapshot, () => fallback);
  const { draft, baseline, state } = record;
  const busy = useRef(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const locked = state.kind === 'pending' || state.kind === 'reloading' || state.kind === 'committed-stale';
  const serializedInitial = JSON.stringify(initial);
  useEffect(() => {
    drafts.setActive(key);
    if (!drafts.read(key)) drafts.write(key, fallback);
    return () => drafts.setActive(null, key);
  }, [drafts, key, fallback]);
  useEffect(() => {
    const current = drafts.read<T>(key);
    if (!current || current.state.kind === 'pending' || current.state.kind === 'reloading' || current.state.kind === 'committed-stale') return;
    const next = JSON.parse(serializedInitial) as T;
    if (JSON.stringify(current.draft) === JSON.stringify(current.baseline)) {
      if (JSON.stringify(current.baseline) !== serializedInitial) drafts.write(key, { ...current, draft: next, baseline: next });
    } else if (rebaseSharedScheduleVersion) {
      const rebased = rebaseUnchangedSharedSchedule(current, next);
      if (rebased) drafts.write(key, rebased);
    }
  }, [serializedInitial, dirty, locked, drafts, key, rebaseSharedScheduleVersion]);
  const setDraft = (value: T) => drafts.write(key, { ...record, draft: value });
  const setState = (value: SaveState) => drafts.write(key, { ...record, state: value });
  const submit = async (command: PartnerCommand | ReservationCommand, next: (snapshot: PartnerSnapshot) => T) => {
    if (busy.current || locked || partner.snapshot?.readOnly) return;
    busy.current = true;
    setState({ kind: 'pending' });
    const result = await partner.save(command);
    busy.current = false;
    if (result.kind === 'cancelled') return;
    if (result.kind === 'saved') {
      const value = next(result.snapshot);
      drafts.complete(key, record.token, { ...record, draft: value, baseline: value, state: { kind: 'saved' } });
    } else drafts.complete(key, record.token, { ...record, state: result });
  };
  const reload = async (next: (snapshot: PartnerSnapshot) => T) => {
    if (busy.current || (locked && state.kind !== 'committed-stale') || (dirty && !drafts.confirmReload(key, () => window.confirm('이 양식의 저장하지 않은 변경사항을 버리고 다시 불러올까요?')))) return;
    busy.current = true;
    setState({ kind: 'reloading' });
    const current = await partner.refresh();
    busy.current = false;
    if (current) {
      const value = next(current);
      drafts.complete(key, record.token, { ...record, draft: value, baseline: value, state: { kind: 'idle' } });
    } else drafts.complete(key, record.token, { ...record, state: state.kind === 'committed-stale' ? { kind: 'committed-stale' } : { kind: 'error', message: '최신 정보를 불러오지 못했습니다. 현재 입력은 유지됩니다.' } });
  };
  return { draft, setDraft, dirty, locked, state, restored, submit, reload, invalid: (message: string) => setState({ kind: 'error', message }) };
}

export function DraftRecoveryNotice({ restored }: { restored: boolean }) {
  return restored ? <Notice tone="info" role="status">이전에 열어 둔 편집 내용을 복원했습니다. 입력 내용과 저장 상태를 확인해 주세요. 초안은 가맹점 관리 영역을 벗어나거나 로그아웃하면 지워집니다.</Notice> : null;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className={styles.field}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
export function FormActions({ state, disabled, dirty, onReload }: { state: SaveState; disabled: boolean; dirty: boolean; onReload: () => void }) {
  return <div className={styles.formFooter}>
    <SaveStatus state={state} onReload={onReload} />
    <div className={styles.actions}>
      <Button type="submit" disabled={disabled || !dirty}>{state.kind === 'pending' ? '저장 중…' : '변경사항 저장'}</Button>
      {state.kind !== 'conflict' && state.kind !== 'committed-stale' && <Button variant="secondary" disabled={state.kind === 'pending' || state.kind === 'reloading'} onClick={onReload}>변경사항 버리고 다시 불러오기</Button>}
      {dirty && state.kind !== 'committed-stale' && <span className={styles.muted}>저장하지 않은 변경사항</span>}
    </div>
  </div>;
}
