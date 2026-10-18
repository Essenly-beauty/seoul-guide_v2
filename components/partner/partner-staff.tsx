'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import type { Menu, PartnerSnapshot } from '@/lib/partner/contracts';
import type { StaffCommand } from '@/lib/partner/staff-contracts';
import { completeStaffDraft, completeStaffMenuAction, completeStaffReload, discardStaffSelectionDrafts, lockPendingStaffMenuOnLeave, matchingStaffDetail, postStaffCommand, readBackStaffSave, recoverStaffMenuLock, restoreStaffListFocus, staffCreateAbsentFromList, staffMenuLockAfterRead } from '@/lib/partner/staff-client';
import type { StaffCalendar, StaffDetail, StaffDetailSnapshot, StaffListSnapshot, StaffSummary } from '@/lib/partner/staff-server';
import { staffCalendarDraft, staffCalendarFormValues, staffProfileDraft, staffProfileFormValues, type StaffCalendarDraft, type StaffProfileDraft } from '@/lib/partner/staff-form-values';
import { PartnerRequestScope, uncertainSaveOutcomeMessage, usePartner, type PartnerDraftRecord } from './partner-provider';
import { DateOverridesFields, ScheduleFields } from './partner-availability';
import { DraftRecoveryNotice, failedReloadState, Field, SaveStatus, type SaveState } from './partner-form';
import styles from './partner.module.css';

type Selection = { id: string; isNew: boolean };
type ReadState = 'loading' | 'ready' | 'error';
type StaffSaveResult = { kind: 'saved'; detail: StaffDetailSnapshot } | { kind: 'conflict' | 'error' | 'committed-stale' | 'unconfirmed' | 'cancelled'; message: string };
const visibilityLabels = { draft: '초안', visible: '공개 준비 (예약 연결 후 적용)', hidden: '숨김', archived: '보관' } as const;
const notFound = '담당자 정보를 찾을 수 없습니다. 목록을 다시 불러와 주세요.';

export function StaffModeNotice({ snapshot, eligibleCount }: { snapshot: PartnerSnapshot; eligibleCount?: number | null }) {
  return <Notice tone="info">
    {snapshot.reservationRules?.mode === 'staff'
      ? <>담당자 선택형입니다. 공개 준비된 담당자와 제공 메뉴 연결이 없으면 고객이 선택할 수 있는 시간이 없습니다.{eligibleCount === 0 ? ' 현재 확인된 대상이 없습니다.' : ''}</>
      : snapshot.reservationRules?.mode === 'shop'
        ? <>매장 예약형에서는 담당자 등록은 선택 사항입니다. 담당자가 없어도 매장 일정을 설정할 수 있습니다.</>
        : <>예약 방식을 아직 설정하지 않았습니다. 담당자 등록은 선택 사항이며 필요할 때 추가할 수 있습니다.</>}
    {' '}고객 예약은 아직 시작되지 않았습니다.
  </Notice>;
}

export function StaffListView({ staff, selectedId, loading, stale, onSelect, onButtonRef }: { staff: StaffSummary[] | null; selectedId: string | null; loading: boolean; stale: boolean; onSelect: (id: string) => void; onButtonRef?: (id: string, element: HTMLButtonElement | null) => void }) {
  if (staff === null) return <p className={styles.empty} role="status">{loading ? '담당자 목록을 불러오는 중입니다…' : '담당자 목록을 불러오지 못했습니다. 다시 시도해 주세요.'}</p>;
  const ordered = [...staff].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  return <>
    {stale && <p className={styles.hint} role="status">마지막으로 조회한 담당자 목록입니다. 최신 정보 확인에 실패했습니다.</p>}
    {ordered.length === 0 ? <p className={styles.empty}>아직 등록된 담당자가 없습니다. 필요할 때 예약용 담당자를 추가해 주세요.</p> :
      <ul className={styles.staffList}>{ordered.map((person) => <li key={person.id}>
        <button type="button" ref={(element) => onButtonRef?.(person.id, element)} className={styles.staffListButton} aria-current={selectedId === person.id ? 'true' : undefined} onClick={() => onSelect(person.id)}>
          <span className={styles.staffListName}>{person.name || '이름 미입력'}</span>
          <span className={styles.staffListMeta}>{person.title || '직함 미입력'} · {visibilityLabels[person.visibility]}</span>
        </button>
      </li>)}</ul>}
  </>;
}

export function StaffProfileFields({ value, onChange, disabled }: { value: StaffProfileDraft; onChange: (value: StaffProfileDraft) => void; disabled: boolean }) {
  return <fieldset className={styles.fields} disabled={disabled}><legend>담당자 정보</legend>
    <div className={styles.twoColumns}>
      <Field label="이름"><input name="name" maxLength={120} value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} /></Field>
      <Field label="직함"><input name="title" maxLength={120} value={value.title} onChange={(event) => onChange({ ...value, title: event.target.value })} /></Field>
    </div>
    <Field label="예약용 소개"><textarea name="introduction" maxLength={1000} value={value.introduction} onChange={(event) => onChange({ ...value, introduction: event.target.value })} /></Field>
    <div className={styles.twoColumns}>
      <Field label="표시 상태"><select name="visibility" value={value.visibility} onChange={(event) => onChange({ ...value, visibility: event.target.value as StaffProfileDraft['visibility'] })}>
        {Object.entries(visibilityLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select></Field>
      <Field label="표시 순서" hint="0 이상의 정수. 작은 숫자가 먼저 표시됩니다."><input name="sortOrder" inputMode="numeric" value={value.sortOrder} onChange={(event) => onChange({ ...value, sortOrder: event.target.value })} /></Field>
    </div>
    <p className={styles.hint}>공개 준비에는 이름이 필요합니다. 보관은 신규 예약 노출만 중지하며 기록을 삭제하지 않습니다.</p>
  </fieldset>;
}

export function StaffMenuAssignments({ menus, menuIds, busy, disabled, onToggle }: { menus: Menu[]; menuIds: string[]; busy: boolean; disabled: boolean; onToggle: (menuId: string, assigned: boolean) => void }) {
  const ordered = [...menus].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  const name = (menu: Menu) => menu.nameKo.trim() || menu.nameEn.trim() || '이름 미입력 메뉴';
  const counts = new Map<string, number>();
  for (const menu of ordered) counts.set(name(menu), (counts.get(name(menu)) ?? 0) + 1);
  return <section aria-labelledby="staff-menus-title"><div className={styles.sectionHeading}><h3 id="staff-menus-title">제공 메뉴</h3><span className={styles.muted}>{menuIds.length}개 연결</span></div>
    <p className={styles.hint}>메뉴마다 제공 가능 여부를 명시하세요. 연결만으로 고객 예약이 열리지는 않습니다.</p>
    {ordered.length === 0 ? <p className={styles.empty}>연결 가능한 메뉴가 없습니다. 카테고리·메뉴에서 먼저 메뉴를 등록해 주세요.</p> :
      <ul className={styles.staffMenuList}>{ordered.map((menu) => {
        const assigned = menuIds.includes(menu.id);
        const label = name(menu);
        const showId = (!menu.nameKo.trim() && !menu.nameEn.trim()) || (counts.get(label) ?? 0) > 1;
        return <li key={menu.id}><div><strong>{label}</strong><small>{visibilityLabels[menu.visibility]} · {assigned ? '연결됨' : '연결 안 됨'}</small>{showId && <small>메뉴 ID {menu.id}</small>}</div>
          <Button variant="secondary" disabled={disabled || busy} aria-label={`${label}${showId ? ` 메뉴 ID ${menu.id}` : ''} ${assigned ? '연결 해제' : '연결'}`} onClick={() => onToggle(menu.id, assigned)}>{assigned ? '연결 해제' : '연결'}</Button>
        </li>;
      })}</ul>}
  </section>;
}

export function StaffCalendarFields({ value, onChange, disabled }: { value: StaffCalendarDraft; onChange: (value: StaffCalendarDraft) => void; disabled: boolean }) {
  return <>
    <h3>주간 근무·차단 시간</h3>
    <p className={styles.hint}>담당자 일정은 매장 공통 영업 일정과 함께 적용됩니다. 시간대 Asia/Seoul.</p>
    <ScheduleFields value={value.weekly} onChange={(weekly) => onChange({ ...value, weekly })} disabled={disabled} subject="staff" />
    <h3 className={styles.staffCalendarHeading}>특별 날짜·휴무</h3>
    <DateOverridesFields value={value.overrides} onChange={(overrides) => onChange({ ...value, overrides })} disabled={disabled} subject="staff" />
  </>;
}

function useStaffDraft<T extends { values: unknown; updatedAt: string | null }>(key: string, initial: T) {
  const { drafts } = usePartner();
  const [fallback] = useState<PartnerDraftRecord<T>>(() => ({ token: Symbol(key), draft: initial, baseline: initial, state: { kind: 'idle' } }));
  const [restored] = useState(() => {
    const previous = drafts.read<T>(key);
    return !!previous && (JSON.stringify(previous.draft) !== JSON.stringify(previous.baseline) || previous.state.kind === 'committed-stale' || previous.state.kind === 'unconfirmed');
  });
  const getSnapshot = useCallback(() => drafts.read<T>(key) ?? fallback, [drafts, key, fallback]);
  const record = useSyncExternalStore(drafts.subscribe, getSnapshot, () => fallback);
  const serializedInitial = JSON.stringify(initial);
  useEffect(() => {
    drafts.setActive(key);
    if (!drafts.read(key)) drafts.write(key, fallback);
    return () => drafts.setActive(null, key);
  }, [drafts, key, fallback]);
  useEffect(() => {
    const current = drafts.read<T>(key);
    if (!current || ['pending', 'reloading', 'committed-stale', 'unconfirmed'].includes(current.state.kind)) return;
    if (JSON.stringify(current.draft) === JSON.stringify(current.baseline) && JSON.stringify(current.baseline) !== serializedInitial) {
      const next = JSON.parse(serializedInitial) as T;
      drafts.complete(key, current.token, { ...current, draft: next, baseline: next });
    }
  }, [drafts, key, serializedInitial]);
  const setDraft = (draft: T) => completeStaffDraft(drafts, key, record, { ...record, draft });
  const setState = (state: SaveState) => completeStaffDraft(drafts, key, record, { ...record, state });
  const replace = (value: T, state: SaveState = { kind: 'idle' }) => completeStaffDraft(drafts, key, record, { ...record, draft: value, baseline: value, state });
  const dirty = JSON.stringify(record.draft) !== JSON.stringify(record.baseline);
  const locked = ['pending', 'reloading', 'committed-stale', 'unconfirmed'].includes(record.state.kind);
  return { ...record, dirty, locked, restored, setDraft, setState, replace };
}

function StaffEditor({ selection, detail, readOnly, snapshot, onSave, onReload, onReloadList, onNotCreated, onMenuReload, isSelected, onMenuToggle, menuBusy, menuMessage, menuAmbiguous }: {
  selection: Selection; detail: StaffDetailSnapshot | null; readOnly: boolean; snapshot: PartnerSnapshot;
  onSave: (command: StaffCommand) => Promise<StaffSaveResult>;
  onReload: () => Promise<StaffDetailSnapshot | null>; onReloadList: () => Promise<StaffListSnapshot | null>; onNotCreated: () => void; onMenuReload: () => Promise<StaffDetailSnapshot | null>; isSelected: () => boolean; onMenuToggle: (menuId: string, assigned: boolean) => void; menuBusy: boolean; menuMessage: string | null; menuAmbiguous: boolean;
}) {
  const person = detail?.staff;
  const profile = useStaffDraft(`staff:profile:${selection.id}`, { values: staffProfileDraft(person), updatedAt: person?.updatedAt ?? null });
  const calendar = useStaffDraft(`staff:calendar:${selection.id}`, { values: staffCalendarDraft(detail?.schedule ?? null), updatedAt: detail?.schedule?.updatedAt ?? null });
  const busy = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const isCurrentView = () => mounted.current && isSelected();
  const disabled = readOnly || snapshot.merchant.bookingEnabled;
  const submitProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (busy.current || disabled || profile.locked) return;
    const parsed = staffProfileFormValues(profile.draft.values);
    if (!parsed.ok) { profile.setState({ kind: 'error', message: parsed.error }); return; }
    busy.current = true;
    profile.setState({ kind: 'pending' });
    const command: StaffCommand = profile.draft.updatedAt
      ? { kind: 'staff', mode: 'update', id: selection.id, expectedUpdatedAt: profile.draft.updatedAt, values: parsed.values }
      : { kind: 'staff', mode: 'create', id: selection.id, values: parsed.values };
    const result = await onSave(command);
    busy.current = false;
    if (result.kind === 'saved') profile.replace({ values: staffProfileDraft(result.detail.staff), updatedAt: result.detail.staff.updatedAt }, { kind: 'saved' });
    else if (result.kind !== 'cancelled') profile.setState(result.kind === 'committed-stale' || result.kind === 'unconfirmed' ? { kind: result.kind } : { kind: result.kind, message: result.message });
  };
  const submitCalendar = async (event: FormEvent) => {
    event.preventDefault();
    if (busy.current || disabled || calendar.locked || !detail) return;
    const parsed = staffCalendarFormValues(calendar.draft.values, snapshot.merchant.id);
    if (!parsed.ok) { calendar.setState({ kind: 'error', message: parsed.error }); return; }
    busy.current = true;
    calendar.setState({ kind: 'pending' });
    const command: StaffCommand = calendar.draft.updatedAt
      ? { kind: 'staffSchedule', mode: 'update', staffId: selection.id, expectedUpdatedAt: calendar.draft.updatedAt, values: parsed.values }
      : { kind: 'staffSchedule', mode: 'create', staffId: selection.id, values: parsed.values };
    const result = await onSave(command);
    busy.current = false;
    if (result.kind === 'saved') calendar.replace({ values: staffCalendarDraft(result.detail.schedule), updatedAt: result.detail.schedule?.updatedAt ?? null }, { kind: 'saved' });
    else if (result.kind !== 'cancelled') calendar.setState(result.kind === 'committed-stale' || result.kind === 'unconfirmed' ? { kind: result.kind } : { kind: result.kind, message: result.message });
  };
  const reloadProfile = async () => {
    if ((profile.state.kind === 'unconfirmed' || (profile.dirty && profile.state.kind !== 'committed-stale')) && !window.confirm(profile.state.kind === 'unconfirmed' ? '저장 결과가 확인되지 않았습니다. 다시 불러오면 현재 담당자 입력이 조회된 정보로 바뀔 수 있습니다. 계속할까요?' : '담당자 정보의 저장하지 않은 변경사항을 버리고 다시 불러올까요?')) return;
    if (selection.isNew && !person && profile.state.kind !== 'unconfirmed' && profile.state.kind !== 'committed-stale') { profile.replace({ values: staffProfileDraft(), updatedAt: null }); return; }
    profile.setState({ kind: 'reloading' });
    await completeStaffReload(selection.id, onReload(), isCurrentView, async (fresh) => {
      if (fresh) profile.replace({ values: staffProfileDraft(fresh.staff), updatedAt: fresh.staff.updatedAt });
      else if (selection.isNew && profile.state.kind === 'unconfirmed') {
        const freshList = await onReloadList();
        if (!isCurrentView()) return;
        if (staffCreateAbsentFromList(selection.id, freshList)) {
          onNotCreated();
          profile.setState({ kind: 'error', message: '현재 목록에 이 담당자가 없습니다. 입력은 유지됩니다. 같은 담당자 ID로 다시 저장하거나 잠시 뒤 다시 확인해 주세요.' });
        } else profile.setState({ kind: 'unconfirmed' });
      } else profile.setState(failedReloadState(profile.state, '최신 담당자 정보를 불러오지 못했습니다. 현재 입력은 유지됩니다.'));
    });
  };
  const reloadCalendar = async () => {
    if ((calendar.state.kind === 'unconfirmed' || (calendar.dirty && calendar.state.kind !== 'committed-stale')) && !window.confirm(calendar.state.kind === 'unconfirmed' ? '저장 결과가 확인되지 않았습니다. 다시 불러오면 현재 담당자 일정 입력이 조회된 정보로 바뀔 수 있습니다. 계속할까요?' : '담당자 일정의 저장하지 않은 변경사항을 버리고 다시 불러올까요?')) return;
    calendar.setState({ kind: 'reloading' });
    await completeStaffReload(selection.id, onReload(), isCurrentView, (fresh) => {
      if (fresh) calendar.replace({ values: staffCalendarDraft(fresh.schedule), updatedAt: fresh.schedule?.updatedAt ?? null });
      else calendar.setState(failedReloadState(calendar.state, '최신 담당자 일정을 불러오지 못했습니다. 현재 입력은 유지됩니다.'));
    });
  };
  return <div className={styles.staffDetailBody}>
    <form className={styles.editor} onSubmit={(event) => void submitProfile(event)}>
      <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>PROFILE</p><h2>{selection.isNew && !person ? '담당자 추가' : person?.name || '담당자 정보'}</h2></div></div>
      <DraftRecoveryNotice restored={profile.restored} />
      <StaffProfileFields value={profile.draft.values} onChange={(values) => profile.setDraft({ ...profile.draft, values })} disabled={disabled || profile.locked} />
      <div className={styles.formFooter}><SaveStatus state={profile.state} onReload={() => void reloadProfile()} /><div className={styles.actions}><Button type="submit" disabled={disabled || profile.locked || (!profile.dirty && !!profile.draft.updatedAt)}>{profile.state.kind === 'pending' ? '저장 중…' : '담당자 정보 저장'}</Button><Button variant="secondary" disabled={profile.state.kind === 'pending'} onClick={() => void reloadProfile()}>다시 불러오기</Button></div></div>
    </form>
    {detail && <>
      <section className={styles.staffDetailSection}><StaffMenuAssignments menus={snapshot.menus} menuIds={detail.staff.menuIds} busy={menuBusy} disabled={disabled} onToggle={onMenuToggle} />{menuMessage && <Notice tone="warning" role="alert">{menuMessage}{menuAmbiguous && <> <Button variant="secondary" onClick={() => void onMenuReload()}>연결 상태 다시 불러오기</Button></>}</Notice>}</section>
      <form className={styles.editor} onSubmit={(event) => void submitCalendar(event)}>
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>CALENDAR</p><h2>담당자 근무 일정</h2></div></div>
        <DraftRecoveryNotice restored={calendar.restored} />
        <StaffCalendarFields value={calendar.draft.values} onChange={(values) => calendar.setDraft({ ...calendar.draft, values })} disabled={disabled || calendar.locked} />
        <div className={styles.formFooter}><SaveStatus state={calendar.state} onReload={() => void reloadCalendar()} /><div className={styles.actions}><Button type="submit" disabled={disabled || calendar.locked || (!calendar.dirty && !!calendar.draft.updatedAt)}>{calendar.state.kind === 'pending' ? '저장 중…' : '근무 일정 저장'}</Button><Button variant="secondary" disabled={calendar.state.kind === 'pending'} onClick={() => void reloadCalendar()}>다시 불러오기</Button></div></div>
      </form>
    </>}
  </div>;
}

export function PartnerStaff() {
  const { snapshot } = usePartner();
  return snapshot ? <StaffWorkspace key={snapshot.merchant.id} snapshot={snapshot} /> : null;
}

function StaffWorkspace({ snapshot }: { snapshot: PartnerSnapshot }) {
  const { confirmLeave, drafts, refresh } = usePartner();
  const [list, setList] = useState<StaffListSnapshot | null>(null);
  const [listState, setListState] = useState<ReadState>('loading');
  const [listStale, setListStale] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [detail, setDetail] = useState<StaffDetailSnapshot | null>(null);
  const [detailState, setDetailState] = useState<ReadState>('loading');
  const [detailStale, setDetailStale] = useState(false);
  const [menuBusy, setMenuBusy] = useState(false);
  const [menuMessage, setMenuMessage] = useState<string | null>(null);
  const [menuAmbiguous, setMenuAmbiguous] = useState(false);
  const menuLocks = useRef(new Map<string, string>());
  const menuPending = useRef(new Map<string, Promise<void>>());
  const [listRequests] = useState(() => new PartnerRequestScope());
  const [detailRequests] = useState(() => new PartnerRequestScope());
  const [writes] = useState(() => new PartnerRequestScope());
  const selectedRef = useRef<Selection | null>(null);
  selectedRef.current = selection;
  const detailRef = useRef<StaffDetailSnapshot | null>(null);
  detailRef.current = detail;
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const listHeading = useRef<HTMLHeadingElement>(null);
  const listButtons = useRef(new Map<string, HTMLButtonElement>());
  const returnFocus = useRef<{ id: string | null } | null>(null);
  const merchantId = snapshot.merchant.id;

  const read = useCallback(async <T,>(url: string, signal: AbortSignal, isCurrent: () => boolean): Promise<T> => {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', signal });
    const body = await response.json();
    if (!isCurrent()) throw new Error('cancelled');
    if (response.status === 401 || response.status === 403) {
      setList(null); setDetail(null);
      void refresh();
      throw new Error('access');
    }
    if (!response.ok || body?.ok !== true || !body.snapshot || body.snapshot.merchantId !== merchantId) throw new Error('unavailable');
    return body.snapshot as T;
  }, [merchantId, refresh]);

  const loadList = useCallback(async (): Promise<StaffListSnapshot | null> => listRequests.runRead(async (request) => {
    setListState('loading');
    try {
      const fresh = await read<StaffListSnapshot>('/api/partner/staff', request.controller.signal, request.isCurrent);
      if (!request.isCurrent()) return null;
      if (!Array.isArray(fresh.staff)) throw new Error('invalid');
      setList(fresh); setListState('ready'); setListStale(false);
      return fresh;
    } catch {
      if (request.isCurrent()) { setListState('error'); setListStale(true); }
      return null;
    }
  }, null), [listRequests, read]);

  const loadDetail = useCallback(async (id: string, explicitMenuRecovery = false): Promise<StaffDetailSnapshot | null> => matchingStaffDetail(id, detailRequests.runRead(async (request) => {
    setDetailState('loading');
    try {
      const fresh = await read<StaffDetailSnapshot>(`/api/partner/staff?id=${encodeURIComponent(id)}`, request.controller.signal, request.isCurrent);
      if (!request.isCurrent() || selectedRef.current?.id !== id) return null;
      if (fresh.staff?.id !== id || !Array.isArray(fresh.staff.menuIds)) throw new Error('invalid');
      const menuLock = staffMenuLockAfterRead(menuLocks.current, id, explicitMenuRecovery);
      setDetail(fresh); setDetailState('ready'); setDetailStale(false); setMenuAmbiguous(!!menuLock); setMenuMessage(menuLock);
      return fresh;
    } catch {
      if (request.isCurrent()) { setDetailState('error'); setDetailStale(true); }
      return null;
    }
  }, null)), [detailRequests, read]);

  useEffect(() => {
    listRequests.activate(); detailRequests.activate(); writes.activate();
    void loadList();
    return () => { listRequests.dispose(); detailRequests.dispose(); writes.dispose(); };
  }, [listRequests, detailRequests, writes, loadList]);
  useEffect(() => {
    if (selection && !selection.isNew) void loadDetail(selection.id);
    else { detailRequests.invalidate(); setDetail(null); setDetailState('ready'); }
  }, [selection, loadDetail, detailRequests]);
  useEffect(() => {
    const focus = () => {
      if (document.visibilityState !== 'visible') return;
      void loadList();
      const current = selectedRef.current;
      if (current && !current.isNew) void loadDetail(current.id);
    };
    window.addEventListener('focus', focus); document.addEventListener('visibilitychange', focus);
    return () => { window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus); };
  }, [loadList, loadDetail]);
  useEffect(() => {
    if (selection) detailHeading.current?.focus();
    else if (returnFocus.current) {
      restoreStaffListFocus(returnFocus.current.id, listButtons.current, listHeading.current);
      returnFocus.current = null;
    }
  }, [selection]);

  const select = (next: Selection | null, focusList = false) => {
    if (selection?.id === next?.id || !confirmLeave()) return;
    if (focusList) returnFocus.current = { id: selection?.isNew ? null : selection?.id ?? null };
    if (selection) {
      discardStaffSelectionDrafts(drafts, selection.id);
      lockPendingStaffMenuOnLeave(menuLocks.current, menuPending.current, selection.id);
    }
    selectedRef.current = next;
    const menuLock = next ? menuLocks.current.get(next.id) ?? null : null;
    setDetail(null); setDetailStale(false); setMenuBusy(false); setMenuMessage(menuLock); setMenuAmbiguous(!!menuLock); setSelection(next);
  };
  const save = async (command: StaffCommand): Promise<StaffSaveResult> => {
    const request = writes.startWrite();
    if (!request) return { kind: 'error', message: '다른 저장이 진행 중입니다.' };
    const id = command.kind === 'staff' ? command.id : command.staffId;
    const stillCurrent = () => request.isCurrent() && selectedRef.current?.id === id;
    let acknowledged = false;
    try {
      const result = await postStaffCommand(command, request.controller.signal);
      if (!stillCurrent()) return { kind: 'cancelled', message: '' };
      if (result === 'forbidden') { setList(null); setDetail(null); void refresh(); return { kind: 'error', message: '현재 매장을 수정할 권한이 없습니다.' }; }
      if (result === 'conflict') return { kind: 'conflict', message: '다른 곳에서 정보가 변경되었습니다. 현재 입력은 유지됩니다. 최신 정보를 확인해 주세요.' };
      if (result === 'error') return { kind: 'error', message: '저장하지 못했습니다. 입력 내용은 유지됩니다. 잠시 후 다시 시도해 주세요.' };
      if (result === 'unconfirmed') return { kind: 'unconfirmed', message: uncertainSaveOutcomeMessage };
      acknowledged = true;
      void loadList();
      const readback = await readBackStaffSave(id, loadDetail, stillCurrent);
      if (readback.kind === 'cancelled') return { kind: 'cancelled', message: '' };
      if (readback.kind === 'committed-stale') return { kind: 'committed-stale', message: uncertainSaveOutcomeMessage };
      if (selectedRef.current?.isNew) setSelection({ id, isNew: false });
      return { kind: 'saved', detail: readback.detail };
    } catch {
      if (!stillCurrent()) return { kind: 'cancelled', message: '' };
      return { kind: acknowledged ? 'committed-stale' : 'unconfirmed', message: uncertainSaveOutcomeMessage };
    } finally { writes.finishWrite(request); }
  };
  const toggleMenu = async (menuId: string, assigned: boolean) => {
    if (!selection || !detail || menuBusy || menuAmbiguous || menuPending.current.has(selection.id) || snapshot.readOnly || snapshot.merchant.bookingEnabled) return;
    const staffId = selection.id;
    setMenuBusy(true); setMenuMessage(null);
    const action = completeStaffMenuAction(staffId, save({ kind: 'staffMenu', mode: assigned ? 'remove' : 'add', staffId, menuId }), () => selectedRef.current?.id === staffId, (result) => {
      setMenuBusy(false);
      if (result.kind === 'committed-stale' || result.kind === 'unconfirmed') {
        const message = result.kind === 'unconfirmed' ? '연결 요청이 처리됐는지 확인할 수 없습니다. 연결 상태를 다시 불러와 확인한 뒤 필요하면 다시 시도해 주세요.' : '연결 요청은 처리됐지만 최신 연결 상태를 불러오지 못했습니다. 다시 불러와 확인해 주세요.';
        menuLocks.current.set(staffId, message);
        setMenuAmbiguous(true); setMenuMessage(message);
      }
      else if (result.kind === 'conflict' || result.kind === 'error') setMenuMessage(result.message);
    });
    menuPending.current.set(staffId, action);
    try { await action; } finally { if (menuPending.current.get(staffId) === action) menuPending.current.delete(staffId); }
  };
  const currentDetail = detail?.staff.id === selection?.id ? detail : null;
  const readOnly = snapshot.readOnly || list?.readOnly === true || currentDetail?.readOnly === true;
  return <>
    <header className={styles.pageHeader}><p className={styles.eyebrow}>STAFF OPERATIONS</p><h1>담당자</h1><p className={styles.muted}>예약용 담당자와 제공 메뉴, 근무 일정을 관리합니다.</p></header>
    <StaffModeNotice snapshot={snapshot} eligibleCount={list && listState === 'ready' && !listStale && !list.staff.some((item) => item.visibility === 'visible') ? 0 : null} />
    <div className={styles.staffWorkspace} data-detail-open={selection ? 'true' : 'false'}>
      <section className={styles.staffListPane} aria-labelledby="staff-list-title"><div className={styles.sectionHeading}><h2 id="staff-list-title" ref={listHeading} tabIndex={-1}>담당자 목록 <span className={styles.muted}>{list ? `${list.staff.length}명` : ''}</span></h2><Button variant="secondary" disabled={readOnly || snapshot.merchant.bookingEnabled || !list || listState === 'error'} onClick={() => select({ id: crypto.randomUUID(), isNew: true })}>담당자 추가</Button></div>
        {listState === 'error' && <Notice tone="warning" role="alert">{list ? '최신 목록을 불러오지 못했습니다. 마지막 조회 정보를 표시합니다.' : '담당자 목록을 불러오지 못했습니다.'} <Button variant="secondary" onClick={() => void loadList()}>다시 시도</Button></Notice>}
        <StaffListView staff={list?.staff ?? null} selectedId={selection?.id ?? null} loading={listState === 'loading'} stale={listStale} onSelect={(id) => select({ id, isNew: false })} onButtonRef={(id, element) => { if (element) listButtons.current.set(id, element); else listButtons.current.delete(id); }} />
      </section>
      <section className={styles.staffDetailPane} aria-labelledby="staff-detail-title">
        {selection && <Button variant="secondary" className={styles.staffBack} onClick={() => select(null, true)}>담당자 목록으로</Button>}
        <h2 id="staff-detail-title" ref={detailHeading} tabIndex={-1} className={styles.staffDetailTitle}>{selection ? '담당자 상세' : '담당자 선택'}</h2>
        {!selection ? <p className={styles.empty}>목록에서 담당자를 선택하거나 새 담당자를 추가하세요.</p> : <>
          {detailState === 'loading' && !selection.isNew && !currentDetail && <p role="status">담당자 정보를 불러오는 중입니다…</p>}
          {detailState === 'error' && <Notice tone="warning" role="alert">{currentDetail ? '최신 담당자 정보를 불러오지 못했습니다. 마지막 조회 정보를 표시합니다.' : notFound} <Button variant="secondary" onClick={() => void loadDetail(selection.id)}>다시 시도</Button></Notice>}
          {detailStale && currentDetail && <p className={styles.hint}>마지막으로 조회한 상세 정보입니다. 저장 전에 최신 정보를 확인해 주세요.</p>}
          {(selection.isNew || currentDetail) && <StaffEditor key={selection.id} selection={selection} detail={currentDetail} readOnly={readOnly || listState === 'error' || detailState === 'error'} snapshot={snapshot} onSave={save} onReload={() => loadDetail(selection.id)} onReloadList={loadList} onNotCreated={() => { setDetailState('ready'); setDetailStale(false); }} onMenuReload={() => recoverStaffMenuLock(selection.id, menuPending.current.get(selection.id), () => selectedRef.current?.id === selection.id, loadDetail)} isSelected={() => selectedRef.current?.id === selection.id} onMenuToggle={(menuId, assigned) => void toggleMenu(menuId, assigned)} menuBusy={menuBusy || menuAmbiguous} menuMessage={menuMessage} menuAmbiguous={menuAmbiguous} />}
        </>}
      </section>
    </div>
  </>;
}
