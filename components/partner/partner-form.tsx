'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import type { PartnerCommand, PartnerSnapshot } from '@/lib/partner/contracts';
import { usePartner } from './partner-provider';
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

/** The baseline (including the exact DB version) travels with the draft. */
export function usePartnerDraft<T>(initial: T) {
  const partner = usePartner();
  const { setDirty } = partner;
  const [draft, setDraft] = useState(initial);
  const [baseline, setBaseline] = useState(initial);
  const [state, setState] = useState<SaveState>({ kind: 'idle' });
  const busy = useRef(false);
  const mounted = useRef(true);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const locked = state.kind === 'pending' || state.kind === 'reloading' || state.kind === 'committed-stale';
  const serializedInitial = JSON.stringify(initial);
  useEffect(() => {
    if (!dirty && !locked) { const next = JSON.parse(serializedInitial) as T; setDraft(next); setBaseline(next); }
  }, [serializedInitial, dirty, locked]);
  useEffect(() => { setDirty((dirty && state.kind !== 'committed-stale') || state.kind === 'pending'); return () => setDirty(false); }, [dirty, state.kind, setDirty]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const replace = (value: T) => { setDraft(value); setBaseline(value); };
  const submit = async (command: PartnerCommand, next: (snapshot: PartnerSnapshot) => T, onSaved?: () => void) => {
    if (busy.current || locked || partner.snapshot?.readOnly) return;
    busy.current = true;
    setState({ kind: 'pending' });
    const result = await partner.save(command);
    busy.current = false;
    if (!mounted.current || result.kind === 'cancelled') return;
    if (result.kind === 'saved') { replace(next(result.snapshot)); setState({ kind: 'saved' }); partner.setDirty(false); onSaved?.(); }
    else { setState(result); if (result.kind === 'committed-stale') partner.setDirty(false); }
  };
  const reload = async (next: (snapshot: PartnerSnapshot) => T) => {
    if (busy.current || (state.kind !== 'committed-stale' && dirty && !partner.confirmLeave())) return;
    busy.current = true;
    setState({ kind: 'reloading' });
    const current = await partner.refresh();
    busy.current = false;
    if (!mounted.current) return;
    if (current) { replace(next(current)); setState({ kind: 'idle' }); partner.setDirty(false); }
    else setState(state.kind === 'committed-stale' ? { kind: 'committed-stale' } : { kind: 'error', message: '최신 정보를 불러오지 못했습니다. 현재 입력은 유지됩니다.' });
  };
  return { draft, setDraft, dirty, locked, state, submit, reload, invalid: (message: string) => setState({ kind: 'error', message }) };
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
