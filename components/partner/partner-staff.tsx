'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { useAuthUser } from '@/lib/auth/use-auth';
import { record, uuid, type Menu, type PartnerSnapshot } from '@/lib/partner/contracts';
import { reservationIntervals, type ReservationSchedule } from '@/lib/partner/reservation-calendar';
import { seoulDateKey } from '@/lib/partner/availability';
import { staffProfile as validStaffProfile, staffProfileValues as validStaffProfileValues, type StaffProfile as EnglishProfile, type StaffProfileValues as EnglishProfileValues } from '@/lib/partner/staff-profile-contracts';
import type { StaffCommand } from '@/lib/partner/staff-contracts';
import { canResetNewStaffProfile, completeStaffDraft, completeStaffMenuAction, completeStaffReload, discardStaffSelectionDrafts, lockPendingStaffMenuOnLeave, matchingStaffDetail, persistedStaffSelection, postStaffCommand, readBackStaffSave, recoverNewStaffProfile, recoverStaffMenuLock, restoreStaffListFocus, staffMenuLockAfterRead } from '@/lib/partner/staff-client';
import type { StaffCalendar, StaffDetail, StaffDetailSnapshot, StaffListSnapshot, StaffSummary } from '@/lib/partner/staff-server';
import { staffCalendarDraft, staffCalendarFormValues, staffProfileDraft, staffProfileFormValues, type StaffCalendarDraft, type StaffProfileDraft } from '@/lib/partner/staff-form-values';
import { PartnerRequestScope, uncertainSaveOutcomeMessage, usePartner, type PartnerDraftRecord } from './partner-provider';
import { DateEditor, DateOverridesFields, ScheduleFields } from './partner-availability';
import { DraftRecoveryNotice, failedReloadState, Field, SaveStatus, type SaveState } from './partner-form';
import styles from './partner.module.css';
import editorStyles from './partner-editors.module.css';
import { PartnerMediaManager } from './partner-media-manager';

type Selection = { id: string; isNew: boolean; date?: string };
type ReadState = 'loading' | 'ready' | 'error';
type StaffSaveResult = { kind: 'saved'; detail: StaffDetailSnapshot } | { kind: 'conflict' | 'error' | 'committed-stale' | 'unconfirmed' | 'cancelled'; message: string };
const visibilityLabels = { draft: '초안', visible: '공개', hidden: '숨김', archived: '보관' } as const;
const notFound = '담당자 정보를 찾을 수 없습니다. 목록을 다시 불러와 주세요.';

export function StaffModeNotice({ snapshot, eligibleCount }: { snapshot: PartnerSnapshot; eligibleCount?: number | null }) {
  return <Notice tone="info">
    {snapshot.reservationRules?.mode === 'staff'
      ? <>담당자 선택형입니다. 공개된 담당자와 제공 메뉴 연결이 없으면 고객이 선택할 수 있는 시간이 없습니다.{eligibleCount === 0 ? ' 현재 확인된 대상이 없습니다.' : ''}</>
      : snapshot.reservationRules?.mode === 'shop'
        ? <>매장 예약형에서는 담당자 등록은 선택 사항입니다. 담당자가 없어도 매장 일정을 설정할 수 있습니다.</>
        : <>예약 방식을 아직 설정하지 않았습니다. 담당자 등록은 선택 사항이며 필요할 때 추가할 수 있습니다.</>}
    {' '}{snapshot.merchant.bookingEnabled && snapshot.merchant.status === 'active' ? '저장한 담당자와 근무 일정은 고객 예약에 적용됩니다.' : '고객 예약을 받으려면 매장 운영 승인과 예약 연결이 필요합니다.'}
  </Notice>;
}

export function StaffAvatar({ name, size = 30 }: { name: string; size?: number }) {
  return <span className={editorStyles.avatar} style={{ '--avatar-size': `${size}px` } as CSSProperties} aria-hidden="true"><svg viewBox="0 0 40 40"><path d="M5 41c1-9 7-14 15-14s14 5 15 14Z" /><path d={name.length % 2 ? 'M11 25V19C11 12 15 8 20 8s9 4 9 11v6Z' : 'M12 19a8 8 0 0 1 16 0v3H12Z'} /><circle cx="20" cy="20" r="6.5" /></svg></span>;
}

export function StaffListView({ staff, selectedId, loading, stale, onSelect, onButtonRef }: { staff: StaffSummary[] | null; selectedId: string | null; loading: boolean; stale: boolean; onSelect: (id: string) => void; onButtonRef?: (id: string, element: HTMLButtonElement | null) => void }) {
  if (staff === null) return <p className={styles.empty} role="status">{loading ? '담당자 목록을 불러오는 중입니다…' : '담당자 목록을 불러오지 못했습니다. 다시 시도해 주세요.'}</p>;
  const ordered = [...staff].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  return <>
    {stale && <p className={styles.hint} role="status">마지막으로 조회한 담당자 목록입니다. 최신 정보 확인에 실패했습니다.</p>}
    {ordered.length === 0 ? <p className={styles.empty}>아직 등록된 담당자가 없습니다. 필요할 때 예약용 담당자를 추가해 주세요.</p> :
      <ul className={styles.staffList}>{ordered.map((person) => <li key={person.id}>
        <button type="button" ref={(element) => onButtonRef?.(person.id, element)} className={styles.staffListButton} aria-current={selectedId === person.id ? 'true' : undefined} onClick={() => onSelect(person.id)}>
          <StaffAvatar name={person.name} /><span className={editorStyles.staffPerson}><span className={styles.staffListName}>{person.name || '이름 미입력'}</span>
          <span className={styles.staffListMeta}>{person.title || '직함 미입력'} · {visibilityLabels[person.visibility]}</span></span>
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

export function StaffCalendarFields({ value, onChange, disabled, initialDate }: { value: StaffCalendarDraft; onChange: (value: StaffCalendarDraft) => void; disabled: boolean; initialDate?: string }) {
  const [tab, setTab] = useState<'weekly' | 'dates'>(initialDate ? 'dates' : 'weekly');
  return <>
    <div className={editorStyles.tabs} aria-label="담당자 일정 유형"><button type="button" aria-pressed={tab === 'weekly'} onClick={() => setTab('weekly')}>매주 반복</button><button type="button" aria-pressed={tab === 'dates'} onClick={() => setTab('dates')}>특정 날짜 · {value.overrides.length}</button></div>
    <div hidden={tab !== 'weekly'}><h3>주간 근무·차단 시간</h3><p className={styles.hint}>담당자 일정은 매장 공통 영업 일정과 함께 적용됩니다. 시간대 Asia/Seoul.</p>
      <ScheduleFields value={value.weekly} onChange={(weekly) => onChange({ ...value, weekly })} disabled={disabled} subject="staff" /></div>
    <div hidden={tab !== 'dates'}><h3 className={styles.staffCalendarHeading}>특별 날짜·휴무</h3>
      <DateOverridesFields initialDate={initialDate} value={value.overrides} onChange={(overrides) => onChange({ ...value, overrides })} disabled={disabled} subject="staff" /></div>
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

export function StaffEnglishFields({ value, onChange, disabled }: { value: Pick<EnglishProfileValues, 'nameEn' | 'introductionEn'>; onChange: (value: Pick<EnglishProfileValues, 'nameEn' | 'introductionEn'>) => void; disabled: boolean }) {
  return <fieldset className={styles.fields} disabled={disabled}><legend>고객 앱에 표시할 영문 정보</legend><Field label="영문 이름" hint="고객의 디자이너 선택 화면에 먼저 보여요."><input lang="en" name="nameEn" maxLength={120} value={value.nameEn} onChange={(event) => onChange({ ...value, nameEn: event.target.value })} placeholder="예: Jiu" /></Field><Field label="영문 소개"><textarea lang="en" name="introductionEn" maxLength={1000} value={value.introductionEn} onChange={(event) => onChange({ ...value, introductionEn: event.target.value })} /></Field><p className={styles.hint}>비워 두면 기존 이름과 소개가 표시돼요.</p></fieldset>;
}
function englishDraft(profile: EnglishProfile) {
  const { id: _id, updatedAt, ...values } = profile;
  return { values, updatedAt };
}
export function rebaseStaffEnglishDraft(previous: PartnerDraftRecord<ReturnType<typeof englishDraft>>, incoming: EnglishProfile): PartnerDraftRecord<ReturnType<typeof englishDraft>> | null {
  if (previous.baseline.updatedAt === incoming.updatedAt || ['pending', 'reloading', 'unconfirmed', 'committed-stale'].includes(previous.state.kind) ||
    previous.baseline.values.nameEn !== incoming.nameEn || previous.baseline.values.introductionEn !== incoming.introductionEn ||
    JSON.stringify(previous.draft) === JSON.stringify(previous.baseline)) return null;
  const baseline = englishDraft(incoming);
  return { ...previous, baseline, draft: { ...baseline, values: { ...baseline.values, nameEn: previous.draft.values.nameEn, introductionEn: previous.draft.values.introductionEn } }, state: previous.state.kind === 'conflict' ? { kind: 'idle' } : previous.state };
}
type EnglishSaveResult = { kind: 'saved'; profile: EnglishProfile } | { kind: 'conflict' | 'error'; message: string } | { kind: 'unconfirmed' } | { kind: 'cancelled' };
function StaffEnglishProfile({ person, readOnly, onSaved }: { person: StaffDetail; readOnly: boolean; onSaved: () => Promise<StaffDetailSnapshot | null> }) {
  const { snapshot, refresh } = usePartner();
  const [profile, setProfile] = useState<EnglishProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [requests] = useState(() => new PartnerRequestScope());
  const writing = useRef(false);
  const staffId = person.id; const merchantId = snapshot?.merchant.id;
  const endpoint = `/api/partner/operations/staff/${encodeURIComponent(staffId)}/profile`;
  const load = useCallback(() => requests.runRead(async (request) => {
    setLoading(true);
    try {
      const response = await fetch(endpoint, { credentials: 'same-origin', cache: 'no-store', signal: request.controller.signal });
      const body: unknown = await response.json();
      if (!request.isCurrent()) return null;
      if (response.status === 401 || response.status === 403) { setProfile(null); void refresh(); }
      if (!response.ok || !record(body) || !validStaffProfile(body.staff) || body.staff.id !== staffId) throw new Error('unavailable');
      setProfile(body.staff); setError(false); return body.staff;
    } catch { if (request.isCurrent()) setError(true); return null; }
    finally { if (request.isCurrent()) setLoading(false); }
  }, null), [endpoint, staffId, requests, refresh]);
  useEffect(() => { requests.activate(); return () => requests.dispose(); }, [requests, merchantId]);
  useEffect(() => { if (!writing.current) void load(); }, [person.updatedAt, load]);
  const save = async (values: EnglishProfileValues, expectedUpdatedAt: string): Promise<EnglishSaveResult> => {
    if (readOnly || loading || error || writing.current) return { kind: 'cancelled' };
    writing.current = true; requests.invalidate();
    const request = requests.startWrite();
    if (!request) { writing.current = false; return { kind: 'cancelled' }; }
    try {
      const response = await fetch(endpoint, { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...values, expectedUpdatedAt }), signal: request.controller.signal });
      const body: unknown = await response.json();
      if (!request.isCurrent()) return { kind: 'cancelled' };
      if (response.status === 401 || response.status === 403) { setProfile(null); void refresh(); return { kind: 'error', message: '현재 담당자 정보를 수정할 권한이 없습니다.' }; }
      if (response.status === 409) return { kind: 'conflict', message: '다른 곳에서 담당자 정보가 변경되었습니다. 최신 정보를 다시 불러온 뒤 영문 정보를 저장해 주세요.' };
      if (!response.ok) return { kind: 'error', message: '영문 정보를 저장하지 못했습니다. 입력을 확인하고 다시 시도해 주세요.' };
      if (!record(body) || !validStaffProfile(body.staff) || body.staff.id !== staffId) return { kind: 'unconfirmed' };
      setProfile(body.staff); await onSaved(); return request.isCurrent() ? { kind: 'saved', profile: body.staff } : { kind: 'cancelled' };
    } catch { return request.isCurrent() ? { kind: 'unconfirmed' } : { kind: 'cancelled' }; }
    finally { writing.current = false; requests.finishWrite(request); }
  };
  return <section className={editorStyles.staffForm} aria-label="담당자 영문 정보">{error && <Notice tone="warning" role="alert">영문 정보를 불러오지 못했습니다. <Button variant="secondary" disabled={loading} onClick={() => void load()}>다시 조회</Button></Notice>}{profile ? <StaffEnglishForm profile={profile} disabled={readOnly || loading || error} onSave={save} onReload={load} /> : !error && <p role="status">영문 정보를 불러오고 있습니다…</p>}</section>;
}
function StaffEnglishForm({ profile, disabled, onSave, onReload }: { profile: EnglishProfile; disabled: boolean; onSave: (values: EnglishProfileValues, version: string) => Promise<EnglishSaveResult>; onReload: () => Promise<EnglishProfile | null> }) {
  const key = `staff:english:${profile.id}`;
  const { drafts } = usePartner();
  const form = useStaffDraft(key, englishDraft(profile));
  useEffect(() => {
    const current = drafts.read<ReturnType<typeof englishDraft>>(key);
    if (!current) return;
    const rebased = rebaseStaffEnglishDraft(current, profile);
    if (rebased) drafts.complete(key, current.token, rebased);
  }, [drafts, key, profile, form.state.kind]);
  const busy = useRef(false);
  const reload = async () => {
    if (busy.current || (form.dirty && !window.confirm('영문 정보의 저장하지 않은 변경사항을 버리고 다시 불러올까요?'))) return;
    busy.current = true; form.setState({ kind: 'reloading' });
    const fresh = await onReload();
    if (fresh) form.replace(englishDraft(fresh)); else form.setState(failedReloadState(form.state, '최신 영문 정보를 불러오지 못했습니다. 현재 입력은 유지됩니다.'));
    busy.current = false;
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (disabled || busy.current || form.locked || !form.dirty) return;
    if (!validStaffProfileValues(form.draft.values)) { form.setState({ kind: 'error', message: '영문 이름은 120자, 소개는 1,000자 이내로 입력해 주세요.' }); return; }
    busy.current = true; form.setState({ kind: 'pending' });
    const result = await onSave(form.draft.values, form.draft.updatedAt);
    if (result.kind === 'saved') form.replace(englishDraft(result.profile), { kind: 'saved' });
    else if (result.kind !== 'cancelled') form.setState(result);
    else form.setState({ kind: 'idle' });
    busy.current = false;
  };
  return <form onSubmit={(event) => void submit(event)}><DraftRecoveryNotice restored={form.restored} /><StaffEnglishFields value={form.draft.values} onChange={(values) => form.setDraft({ ...form.draft, values: { ...form.draft.values, ...values } })} disabled={disabled || form.locked} /><div className={editorStyles.savebar} data-dirty={form.dirty}><SaveStatus state={form.state} onReload={() => void reload()} /><div className={styles.actions}><Button type="submit" disabled={disabled || form.locked || !form.dirty}>{form.state.kind === 'pending' ? '저장 중…' : '영문 정보 저장'}</Button><Button variant="secondary" disabled={form.state.kind === 'pending' || form.state.kind === 'reloading'} onClick={() => void reload()}>다시 불러오기</Button></div></div></form>;
}

function StaffEditor({ selection, detail, readOnly, snapshot, initialTab, onSave, onReload, onReloadList, onNotCreated, onMenuReload, isSelected, onMenuToggle, menuBusy, menuMessage, menuAmbiguous }: {
  selection: Selection; detail: StaffDetailSnapshot | null; readOnly: boolean; snapshot: PartnerSnapshot; initialTab?: 'profile' | 'schedule';
  onSave: (command: StaffCommand) => Promise<StaffSaveResult>;
  onReload: () => Promise<StaffDetailSnapshot | null>; onReloadList: () => Promise<StaffListSnapshot | null>; onNotCreated: () => void; onMenuReload: () => Promise<StaffDetailSnapshot | null>; isSelected: () => boolean; onMenuToggle: (menuId: string, assigned: boolean) => void; menuBusy: boolean; menuMessage: string | null; menuAmbiguous: boolean;
}) {
  const { user } = useAuthUser();
  const { stale } = usePartner();
  const person = detail?.staff;
  const [tab, setTab] = useState<'profile' | 'menus' | 'schedule'>(selection.date ? 'schedule' : selection.isNew && !person ? 'profile' : initialTab ?? 'profile');
  const profile = useStaffDraft(`staff:profile:${selection.id}`, { values: staffProfileDraft(person), updatedAt: person?.updatedAt ?? null });
  const calendar = useStaffDraft(`staff:calendar:${selection.id}`, { values: staffCalendarDraft(detail?.schedule ?? null), updatedAt: detail?.schedule?.updatedAt ?? null });
  const busy = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const isCurrentView = () => mounted.current && isSelected();
  const disabled = readOnly;
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
    if (canResetNewStaffProfile(selection.isNew, !!person, profile.state.kind)) { profile.replace({ values: staffProfileDraft(), updatedAt: null }); return; }
    profile.setState({ kind: 'reloading' });
    if (selection.isNew && !person && profile.state.kind !== 'committed-stale') {
      const recovery = await recoverNewStaffProfile(selection.id, onReload, onReloadList, isCurrentView);
      if (recovery.kind === 'found') profile.replace({ values: staffProfileDraft(recovery.detail.staff), updatedAt: recovery.detail.staff.updatedAt });
      else if (recovery.kind === 'absent') {
        onNotCreated();
        profile.setState({ kind: 'error', message: '현재 목록에 이 담당자가 없습니다. 입력은 유지됩니다. 같은 담당자 ID로 다시 저장하거나 잠시 뒤 다시 확인해 주세요.' });
      } else if (recovery.kind === 'unconfirmed') profile.setState({ kind: 'unconfirmed' });
      return;
    }
    await completeStaffReload(selection.id, onReload(), isCurrentView, async (fresh) => {
      if (fresh) profile.replace({ values: staffProfileDraft(fresh.staff), updatedAt: fresh.staff.updatedAt });
      else profile.setState(failedReloadState(profile.state, '최신 담당자 정보를 불러오지 못했습니다. 현재 입력은 유지됩니다.'));
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
    <div className={editorStyles.staffTitle}><StaffAvatar name={person?.name || profile.draft.values.name} size={52} /><div><h2>{selection.isNew && !person ? '담당자 추가' : person?.name || '담당자 정보'} {person?.title}</h2><p>{person ? `제공 메뉴 ${person.menuIds.length}개` : '기본정보를 저장한 뒤 메뉴와 근무 일정을 연결하세요.'}</p></div>{person && <span className={editorStyles.status} data-visible={person.visibility === 'visible'}>{visibilityLabels[person.visibility]}</span>}</div>
    <div className={editorStyles.tabs} aria-label="담당자 편집 항목">{([['profile', '기본정보'], ['menus', '제공 메뉴'], ['schedule', '근무 일정']] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={tab === value} disabled={value !== 'profile' && !detail} onClick={() => setTab(value)}>{label}{value === 'profile' && profile.dirty ? ' · 변경됨' : value === 'schedule' && calendar.dirty ? ' · 변경됨' : ''}</button>)}</div>
    <form hidden={tab !== 'profile'} className={editorStyles.staffForm} onSubmit={(event) => void submitProfile(event)}>
      <DraftRecoveryNotice restored={profile.restored} />
      <StaffProfileFields value={profile.draft.values} onChange={(values) => profile.setDraft({ ...profile.draft, values })} disabled={disabled || profile.locked} />
      <PartnerMediaManager targetKind="staff" targetId={person?.id ?? null} scope={user ? `${user.id}:${snapshot.merchant.id}` : ''} disabled={disabled || stale || profile.locked || calendar.locked || menuBusy || !user} />
      <div className={styles.formFooter}><SaveStatus state={profile.state} onReload={() => void reloadProfile()} /><div className={styles.actions}><Button type="submit" disabled={disabled || profile.locked || (!profile.dirty && !!profile.draft.updatedAt)}>{profile.state.kind === 'pending' ? '저장 중…' : '담당자 정보 저장'}</Button><Button variant="secondary" disabled={profile.state.kind === 'pending'} onClick={() => void reloadProfile()}>다시 불러오기</Button></div></div>
    </form>
    {detail && <>
      <div hidden={tab !== 'profile'}><StaffEnglishProfile person={detail.staff} readOnly={disabled || profile.locked || calendar.locked || menuBusy} onSaved={onReload} /></div>
      <section hidden={tab !== 'menus'} className={editorStyles.panelBody}><StaffMenuAssignments menus={snapshot.menus} menuIds={detail.staff.menuIds} busy={menuBusy} disabled={disabled} onToggle={onMenuToggle} />{menuMessage && <Notice tone="warning" role="alert">{menuMessage}{menuAmbiguous && <> <Button variant="secondary" onClick={() => void onMenuReload()}>연결 상태 다시 불러오기</Button></>}</Notice>}</section>
      <form hidden={tab !== 'schedule'} className={editorStyles.staffForm} onSubmit={(event) => void submitCalendar(event)}>
        <div className={styles.sectionHeading}><h2>담당자 근무 일정</h2></div>
        <DraftRecoveryNotice restored={calendar.restored} />
        <StaffCalendarFields initialDate={selection.date} value={calendar.draft.values} onChange={(values) => calendar.setDraft({ ...calendar.draft, values })} disabled={disabled || calendar.locked} />
        <div className={styles.formFooter}><SaveStatus state={calendar.state} onReload={() => void reloadCalendar()} /><div className={styles.actions}><Button type="submit" disabled={disabled || calendar.locked || (!calendar.dirty && !!calendar.draft.updatedAt)}>{calendar.state.kind === 'pending' ? '저장 중…' : '근무 일정 저장'}</Button><Button variant="secondary" disabled={calendar.state.kind === 'pending'} onClick={() => void reloadCalendar()}>다시 불러오기</Button></div></div>
      </form>
    </>}
  </div>;
}

export function PartnerStaff({ initialStaffId, initialTab = 'profile' }: { initialStaffId?: string; initialTab?: 'profile' | 'schedule' }) {
  const { snapshot } = usePartner();
  const id = uuid(initialStaffId) ? initialStaffId : undefined;
  return snapshot ? <StaffWorkspace key={`${snapshot.merchant.id}:${id ?? ''}:${initialTab}`} snapshot={snapshot} initialStaffId={id} initialTab={initialTab} /> : null;
}

export type RosterDayState = 'on' | 'off' | 'shopoff' | 'unset' | 'unknown';
export function rosterDayState(shop: ReservationSchedule | null, staff: ReservationSchedule | null | undefined, date: string, isShop = false): RosterDayState {
  if (!shop) return 'unset';
  try {
    const openings = reservationIntervals(shop, shop.merchantId, date);
    if (isShop) return openings.length ? 'on' : 'off';
    if (!openings.length) return 'shopoff';
    if (staff === undefined) return 'unknown';
    if (staff === null) return 'unset';
    const shifts = reservationIntervals(staff, shop.merchantId, date);
    return shifts.some((shift) => openings.some((opening) => shift.startMinute < opening.endMinute && opening.startMinute < shift.endMinute)) ? 'on' : 'off';
  } catch { return 'unknown'; }
}
export function PartnerRoster() {
  const { snapshot } = usePartner();
  return snapshot ? <StaffWorkspace key={snapshot.merchant.id} snapshot={snapshot} view="roster" /> : null;
}
function RosterTable({ snapshot, staff, calendars, month, onSelect }: { snapshot: PartnerSnapshot; staff: StaffSummary[]; calendars: Record<string, StaffCalendar | null>; month: string; onSelect: (id: string, date: string) => void }) {
  const count = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate();
  const dates = Array.from({ length: count }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`);
  const shop = snapshot.schedule ? { ...snapshot.schedule, overrides: snapshot.dateOverrides } : null;
  const rows = [{ id: 'shop', name: '매장', title: '영업일' }, ...staff];
  const labels: Record<RosterDayState, string> = { on: '근무', off: '휴무', shopoff: '매장 휴무', unset: '일정 미설정', unknown: '조회 필요' };
  return <div className={editorStyles.rosterScroll}><table className={editorStyles.roster}><thead><tr><th scope="col">{month.replace('-', '년 ')}월</th>{dates.map((date) => <th scope="col" key={date}><b>{Number(date.slice(-2))}</b><small>{['일', '월', '화', '수', '목', '금', '토'][new Date(`${date}T00:00:00Z`).getUTCDay()]}</small></th>)}<th scope="col">근무일</th></tr></thead><tbody>{rows.map((person) => {
    const states = dates.map((date) => rosterDayState(shop, calendars[person.id], date, person.id === 'shop'));
    return <tr key={person.id}><th scope="row">{person.id !== 'shop' && <StaffAvatar name={person.name} size={22} />}{person.name || '이름 미입력'}<small>{person.title || '담당자'}</small></th>{dates.map((date, index) => {
      const state = states[index]; const exception = (person.id === 'shop' ? snapshot.dateOverrides : calendars[person.id]?.overrides ?? []).some((day) => day.date === date);
      return <td key={date} data-state={state} data-exception={exception}><button type="button" aria-label={`${person.name || '이름 미입력'} ${date} ${labels[state]} 일정 편집`} onClick={() => onSelect(person.id, date)} title={labels[state]}>{state === 'on' ? <i /> : state === 'off' ? '휴' : state === 'shopoff' ? '·' : '—'}</button></td>;
    })}<td>{states.some((state) => state === 'unknown' || state === 'unset') ? '—' : states.filter((state) => state === 'on').length}일</td></tr>;
  })}</tbody></table></div>;
}

function StaffWorkspace({ snapshot, view = 'staff', initialStaffId, initialTab }: { snapshot: PartnerSnapshot; view?: 'staff' | 'roster'; initialStaffId?: string; initialTab?: 'profile' | 'schedule' }) {
  const { confirmLeave, drafts, refresh } = usePartner();
  const [list, setList] = useState<StaffListSnapshot | null>(null);
  const [query, setQuery] = useState('');
  const [month, setMonth] = useState(() => seoulDateKey(new Date()).slice(0, 7));
  const [shopDate, setShopDate] = useState<string | null>(null);
  const [rosterCalendars, setRosterCalendars] = useState<Record<string, StaffCalendar | null>>({});
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState(false);
  const [rosterRequests] = useState(() => new PartnerRequestScope());
  const [listState, setListState] = useState<ReadState>('loading');
  const [listStale, setListStale] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(() => initialStaffId ? { id: initialStaffId, isNew: false } : null);
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
      setRosterCalendars((current) => ({ ...current, [id]: fresh.schedule }));
      setDetail(fresh); setDetailState('ready'); setDetailStale(false); setMenuAmbiguous(!!menuLock); setMenuMessage(menuLock);
      const persisted = persistedStaffSelection(selectedRef.current, id);
      if (persisted !== selectedRef.current) { selectedRef.current = persisted; setSelection(persisted); }
      return fresh;
    } catch {
      if (request.isCurrent()) { setDetailState('error'); setDetailStale(true); }
      return null;
    }
  }, null)), [detailRequests, read]);

  useEffect(() => {
    rosterRequests.activate();
    return () => rosterRequests.dispose();
  }, [rosterRequests]);
  useEffect(() => {
    if (view !== 'roster' || !list) return;
    void rosterRequests.runRead(async (request) => {
      setRosterLoading(true); setRosterError(false);
      const pending = [...list.staff]; const calendars: Record<string, StaffCalendar | null> = {}; let failed = false;
      const workers = Array.from({ length: Math.min(4, pending.length) }, async () => {
        for (;;) {
          const person = pending.shift(); if (!person || !request.isCurrent()) return;
          try { const fresh = await read<StaffDetailSnapshot>(`/api/partner/staff?id=${encodeURIComponent(person.id)}`, request.controller.signal, request.isCurrent); if (fresh.staff?.id !== person.id) throw new Error('invalid'); calendars[person.id] = fresh.schedule; }
          catch { failed = true; }
        }
      });
      await Promise.allSettled(workers);
      if (request.isCurrent()) { setRosterCalendars(calendars); setRosterError(failed); setRosterLoading(false); }
      return null;
    }, null);
  }, [list, view, rosterRequests, read]);
  useEffect(() => {
    listRequests.activate(); detailRequests.activate(); writes.activate();
    void loadList();
    return () => { listRequests.dispose(); detailRequests.dispose(); writes.dispose(); };
  }, [listRequests, detailRequests, writes, loadList]);
  useEffect(() => {
    if (selection && !selection.isNew) {
      if (detailRef.current?.staff.id !== selection.id) void loadDetail(selection.id);
    }
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
    if ((selection?.id === next?.id && selection?.date === next?.date) || !confirmLeave()) return false;
    if (focusList) returnFocus.current = { id: selection?.isNew ? null : selection?.id ?? null };
    if (selection) {
      discardStaffSelectionDrafts(drafts, selection.id);
      lockPendingStaffMenuOnLeave(menuLocks.current, menuPending.current, selection.id);
    }
    selectedRef.current = next;
    const menuLock = next ? menuLocks.current.get(next.id) ?? null : null;
    setDetail(null); setDetailStale(false); setMenuBusy(false); setMenuMessage(menuLock); setMenuAmbiguous(!!menuLock); setSelection(next);
    return true;
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
      if (result === 'conflict') return { kind: 'conflict', message: command.kind === 'staffSchedule' ? '예약과 겹치는 근무시간 변경은 저장할 수 없습니다. 다른 곳에서 일정이 변경되었을 수도 있습니다. 현재 입력은 유지되며, 최신 예약과 일정을 확인해 주세요.' : '다른 곳에서 정보가 변경되었습니다. 현재 입력은 유지됩니다. 최신 정보를 확인해 주세요.' };
      if (result === 'error') return { kind: 'error', message: '저장하지 못했습니다. 입력 내용은 유지됩니다. 잠시 후 다시 시도해 주세요.' };
      if (result === 'unconfirmed') return { kind: 'unconfirmed', message: uncertainSaveOutcomeMessage };
      acknowledged = true;
      void loadList();
      const readback = await readBackStaffSave(id, loadDetail, stillCurrent);
      if (readback.kind === 'cancelled') return { kind: 'cancelled', message: '' };
      if (readback.kind === 'committed-stale') return { kind: 'committed-stale', message: uncertainSaveOutcomeMessage };
      return { kind: 'saved', detail: readback.detail };
    } catch {
      if (!stillCurrent()) return { kind: 'cancelled', message: '' };
      return { kind: acknowledged ? 'committed-stale' : 'unconfirmed', message: uncertainSaveOutcomeMessage };
    } finally { writes.finishWrite(request); }
  };
  const toggleMenu = async (menuId: string, assigned: boolean) => {
    if (!selection || !detail || menuBusy || menuAmbiguous || menuPending.current.has(selection.id) || snapshot.readOnly) return;
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
  return <div className={editorStyles.scope}>
    <header className={editorStyles.pageHead}><div><h1>{view === 'roster' ? '출근표' : '담당자'}</h1><p>{view === 'roster' ? '날짜를 눌러 매장·담당자의 출근과 휴무를 정해요. 변경사항을 저장하면 고객 예약에 반영돼요.' : '고객이 선택할 담당자와 제공 메뉴, 근무 일정을 관리해요.'}</p></div>{view === 'roster' ? <Button variant="secondary" href="/partner/availability">매주 반복 설정 →</Button> : <Button disabled={readOnly || !list || listState === 'error'} onClick={() => select({ id: crypto.randomUUID(), isNew: true })}>+ 담당자 추가</Button>}</header>
    {view === 'roster' && <section className={editorStyles.panel}><div className={editorStyles.toolbar}><input type="month" aria-label="출근표 월" min="1000-01" max="9999-12" value={month} onChange={(event) => { if (/^\d{4}-\d{2}$/.test(event.target.value) && Number(event.target.value.slice(0, 4)) >= 1000) setMonth(event.target.value); }} /><span role="status">{rosterLoading ? '근무 일정을 조회하고 있어요…' : rosterError ? '일부 일정 조회 실패 · — 표시된 담당자를 눌러 다시 확인하세요.' : '서울 (KST)'}</span><Button variant="secondary" disabled={listState === 'loading' || rosterLoading} onClick={() => void loadList()}>새로고침</Button></div>
      {listState === 'error' && <Notice tone="warning" role="alert">담당자 목록을 불러오지 못했습니다. 새로고침해 주세요.</Notice>}
      <RosterTable snapshot={snapshot} staff={list?.staff ?? []} calendars={rosterCalendars} month={month} onSelect={(id, date) => { if (id === 'shop') { if (selection ? !select(null) : !confirmLeave()) return; setShopDate(date); } else if (select({ id, isNew: false, date })) setShopDate(null); }} />
      <p className={editorStyles.summary}>● 근무 · 휴 = 휴무 · 테두리 = 날짜 예외 · — = 미설정 또는 조회 필요. 칸을 누르면 아래에서 해당 날짜를 편집할 수 있어요. 기존 예약과 충돌하는 일정은 저장되지 않아요.</p></section>}
    {view === 'roster' && shopDate && <section className={editorStyles.panel}><DateEditor key={shopDate} snapshot={snapshot} initialDate={shopDate} /></section>}
    {view === 'staff' && <StaffModeNotice snapshot={snapshot} eligibleCount={list && listState === 'ready' && !listStale && !list.staff.some((item) => item.visibility === 'visible') ? 0 : null} />}
    <div hidden={view === 'roster' && !selection} className={`${styles.staffWorkspace} ${editorStyles.staffLayout} ${view === 'roster' ? editorStyles.rosterWorkspace : ''}`} data-detail-open={selection ? 'true' : 'false'}>
      <section className={`${styles.staffListPane} ${editorStyles.staffTargets}`} aria-labelledby="staff-list-title"><div className={styles.sectionHeading}><h2 id="staff-list-title" ref={listHeading} tabIndex={-1}>담당자 <span className={styles.muted}>{list ? `${list.staff.length}명` : ''}</span></h2></div><div className={editorStyles.toolbar}><input type="search" aria-label="담당자 검색" placeholder="담당자 검색" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        {listState === 'error' && <Notice tone="warning" role="alert">{list ? '최신 목록을 불러오지 못했습니다. 마지막 조회 정보를 표시합니다.' : '담당자 목록을 불러오지 못했습니다.'} <Button variant="secondary" onClick={() => void loadList()}>다시 시도</Button></Notice>}
        <StaffListView staff={list ? list.staff.filter((person) => `${person.name} ${person.title}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) : null} selectedId={selection?.id ?? null} loading={listState === 'loading'} stale={listStale} onSelect={(id) => select({ id, isNew: false })} onButtonRef={(id, element) => { if (element) listButtons.current.set(id, element); else listButtons.current.delete(id); }} />
      </section>
      <section className={`${styles.staffDetailPane} ${editorStyles.staffDetail}`} aria-labelledby="staff-detail-title">
        {selection && <Button variant="secondary" className={styles.staffBack} onClick={() => select(null, true)}>담당자 목록으로</Button>}
        <h2 id="staff-detail-title" ref={detailHeading} tabIndex={-1} className={styles.staffDetailTitle}>{selection ? '담당자 상세' : '담당자 선택'}</h2>
        {!selection ? <p className={styles.empty}>목록에서 담당자를 선택하거나 새 담당자를 추가하세요.</p> : <>
          {detailState === 'loading' && !selection.isNew && !currentDetail && <p role="status">담당자 정보를 불러오는 중입니다…</p>}
          {detailState === 'error' && <Notice tone="warning" role="alert">{currentDetail ? '최신 담당자 정보를 불러오지 못했습니다. 마지막 조회 정보를 표시합니다.' : notFound} <Button variant="secondary" onClick={() => void loadDetail(selection.id)}>다시 시도</Button></Notice>}
          {detailStale && currentDetail && <p className={styles.hint}>마지막으로 조회한 상세 정보입니다. 저장 전에 최신 정보를 확인해 주세요.</p>}
          {(selection.isNew || currentDetail) && <StaffEditor key={`${selection.id}:${selection.date ?? ''}`} selection={selection} initialTab={initialTab} detail={currentDetail} readOnly={readOnly || listState === 'error' || detailState === 'error'} snapshot={snapshot} onSave={save} onReload={() => loadDetail(selection.id)} onReloadList={loadList} onNotCreated={() => { setDetailState('ready'); setDetailStale(false); }} onMenuReload={() => recoverStaffMenuLock(selection.id, menuPending.current.get(selection.id), () => selectedRef.current?.id === selection.id, loadDetail)} isSelected={() => selectedRef.current?.id === selection.id} onMenuToggle={(menuId, assigned) => void toggleMenu(menuId, assigned)} menuBusy={menuBusy || menuAmbiguous} menuMessage={menuMessage} menuAmbiguous={menuAmbiguous} />}
        </>}
      </section>
    </div>
  </div>;
}
