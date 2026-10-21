'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { PartnerSnapshot } from '@/lib/partner/contracts';
import { dateOverridesDraft, dateOverridesFormValues, reservationRulesDraft, reservationRulesFormValues, scheduleDraft, scheduleFormValues, type DateOverrideDraft, type ReservationRulesDraft, type ScheduleDraft, type SpecialPeriodDraft } from '@/lib/partner/form-values';
import { usePartner } from './partner-provider';
import { DraftRecoveryNotice, Field, FormActions, usePartnerDraft } from './partner-form';
import styles from './partner.module.css';
import editorStyles from './partner-editors.module.css';
import { usePartnerStaffDirectory } from './use-partner-staff-directory';

const weekdays = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
export function copyWeekdaySchedule(value: ScheduleDraft, source: string, targets: readonly string[]): ScheduleDraft | null {
  const days = new Set(targets.filter((day) => day !== source));
  const copy = (kind: 'hours' | 'breaks') => [...value[kind].filter((period) => !days.has(period.weekday)), ...[...days].flatMap((weekday) => value[kind].filter((period) => period.weekday === source).map((period) => ({ ...period, weekday })))];
  const hours = copy('hours'); const breaks = copy('breaks');
  return hours.length <= 128 && breaks.length <= 128 ? { ...value, hours, breaks } : null;
}
function minutePercent(time: string): number {
  if (!/^\d{2}:\d{2}$/.test(time)) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return Math.min(100, Math.max(0, (hours * 60 + minutes) / 1440 * 100));
}
export function ScheduleFields({ value, onChange, disabled, subject = 'shop' }: { value: ScheduleDraft; onChange: (value: ScheduleDraft) => void; disabled: boolean; subject?: 'shop' | 'staff' }) {
  const [editingDay, setEditingDay] = useState<string | null>(() => value.hours[0]?.weekday ?? null);
  const label = subject === 'staff' ? '근무시간' : '영업시간';
  const copied = copyWeekdaySchedule(value, '1', ['2', '3', '4', '5']);
  const updatePeriod = (kind: 'hours' | 'breaks', index: number, change: Partial<ScheduleDraft['hours'][number]>) => onChange({ ...value, [kind]: value[kind].map((row, position) => position === index ? { ...row, ...change } : row) });
  return <fieldset className={styles.fields} disabled={disabled}><legend>{subject === 'staff' ? '담당자 근무 일정 입력' : '영업 일정 입력'}</legend>
    <div className={editorStyles.weekdayHead}><div><h3>요일별 {label}</h3><p>요일을 편집한 뒤 같은 시간을 다른 평일에 복사할 수 있어요.</p></div><Button variant="secondary" disabled={disabled || !copied} onClick={() => { if (copied) onChange(copied); }}>월요일을 평일에 복사</Button></div>
    <div className={editorStyles.week}>{[1, 2, 3, 4, 5, 6, 0].map((day) => {
      const hours = value.hours.filter((period) => period.weekday === String(day));
      const breaks = value.breaks.filter((period) => period.weekday === String(day));
      return <div key={day}><div className={editorStyles.weekRow}><div><strong>{weekdays[day]}</strong><small>{hours.length ? '매주 반복' : '정기 휴무'}</small></div>
        <div className={editorStyles.track} aria-hidden="true">{([...hours.map((period) => ({ ...period, rest: false })), ...breaks.map((period) => ({ ...period, rest: true }))]).map((period, index) => <span key={index} data-break={period.rest} style={{ left: `${minutePercent(period.start)}%`, width: `${Math.max(0, minutePercent(period.end) - minutePercent(period.start))}%` }} />)}</div>
        <div className={editorStyles.weekHours}>{hours.length ? hours.map((period) => `${period.start || '시작 미입력'} – ${period.end || '종료 미입력'}`).join(' / ') : '휴무'}{breaks.length > 0 && <small>휴게 {breaks.map((period) => `${period.start} – ${period.end}`).join(' / ')}</small>}</div>
        <button type="button" className={editorStyles.textButton} disabled={disabled} aria-label={`${weekdays[day]} 시간 편집`} aria-expanded={editingDay === String(day)} onClick={() => setEditingDay(editingDay === String(day) ? null : String(day))}>편집</button></div>
        {editingDay === String(day) && <section className={editorStyles.dayEditor} aria-label={`${weekdays[day]} 시간 편집`}><div className={styles.sectionHeading}><h3>{weekdays[day]} 시간 편집</h3><button type="button" disabled={disabled} className={editorStyles.textButton} onClick={() => setEditingDay(null)}>닫기</button></div>
          <label className={styles.specialClosure}><input type="checkbox" aria-label={`${weekdays[day]} ${subject === 'staff' ? '근무' : '영업'}`} checked={hours.length > 0} onChange={(event) => onChange(event.target.checked ? { ...value, hours: [...value.hours, { weekday: String(day), start: '', end: '' }] } : { ...value, hours: value.hours.filter((row) => row.weekday !== String(day)), breaks: value.breaks.filter((row) => row.weekday !== String(day)) })} disabled={disabled || (!hours.length && value.hours.length >= 128)} />이 요일에 {subject === 'staff' ? '근무' : '영업'}해요</label>
          {(['hours', 'breaks'] as const).map((kind) => <div key={kind}><h4>{kind === 'hours' ? label : '휴게시간'}</h4>{value[kind].map((row, index) => row.weekday !== String(day) ? null : <div key={index} className={styles.scheduleRow}>
            <label>시작 시간<input aria-label={`${kind === 'hours' ? label : '휴게시간'} ${index + 1} 시작 시간`} placeholder="09:00" value={row.start} onChange={(event) => updatePeriod(kind, index, { start: event.target.value })} /></label>
            <label>종료 시간<input aria-label={`${kind === 'hours' ? label : '휴게시간'} ${index + 1} 종료 시간`} placeholder="18:00" value={row.end} onChange={(event) => updatePeriod(kind, index, { end: event.target.value })} /></label>
            <Button variant="secondary" disabled={disabled} aria-label={`${kind === 'hours' ? label : '휴게시간'} ${index + 1} 삭제`} onClick={() => onChange({ ...value, [kind]: value[kind].filter((_, position) => position !== index) })}>삭제</Button>
          </div>)}<Button variant="secondary" disabled={disabled || value[kind].length >= 128 || (kind === 'breaks' && !hours.length)} onClick={() => onChange({ ...value, [kind]: [...value[kind], { weekday: String(day), start: '', end: '' }] })}>{kind === 'hours' ? label : '휴게시간'} 추가</Button></div>)}
        </section>}
      </div>;
    })}</div>
    <p className={styles.hint}>시간대 Asia/Seoul (한국 표준시). {label}과 휴게시간은 각각 128개까지 설정할 수 있어요. 종료 시간은 24:00까지 입력할 수 있어요.</p>
    <details open={value.blocks.length > 0}><summary className={editorStyles.textButton}>날짜별 차단 시간 · {value.blocks.length}개</summary><section className={styles.scheduleSection}><h3>날짜별 휴무</h3><p className={styles.hint}>특정 날짜의 전체 또는 일부 시간을 제외해요. 최대 512개, 하루 휴무는 00:00–24:00으로 입력하세요.</p>
      {value.blocks.map((row, index) => <div key={index} className={styles.scheduleRow}>
        <label>날짜<input type="date" aria-label={`날짜별 휴무 ${index + 1} 날짜`} value={row.date} onChange={(event) => onChange({ ...value, blocks: value.blocks.map((item, position) => position === index ? { ...item, date: event.target.value } : item) })} /></label>
        <label>시작 시간<input aria-label={`날짜별 휴무 ${index + 1} 시작 시간`} placeholder="00:00" value={row.start} onChange={(event) => onChange({ ...value, blocks: value.blocks.map((item, position) => position === index ? { ...item, start: event.target.value } : item) })} /></label>
        <label>종료 시간<input aria-label={`날짜별 휴무 ${index + 1} 종료 시간`} placeholder="24:00" value={row.end} onChange={(event) => onChange({ ...value, blocks: value.blocks.map((item, position) => position === index ? { ...item, end: event.target.value } : item) })} /></label>
        <Button variant="secondary" disabled={disabled} aria-label={`날짜별 휴무 ${index + 1} 삭제`} onClick={() => onChange({ ...value, blocks: value.blocks.filter((_, position) => position !== index) })}>삭제</Button>
      </div>)}<Button variant="secondary" disabled={disabled || value.blocks.length >= 512} onClick={() => onChange({ ...value, blocks: [...value.blocks, { date: '', start: '00:00', end: '24:00' }] })}>날짜별 휴무 추가</Button>
    </section></details>
  </fieldset>;
}
export function ReservationRulesFields({ value, onChange, disabled }: { value: ReservationRulesDraft; onChange: (value: ReservationRulesDraft) => void; disabled: boolean }) {
  return <fieldset className={styles.fields} disabled={disabled}><legend>예약 접수 기준</legend>
    <div className={editorStyles.modeGrid} role="group" aria-label="예약 방식">{([['staff', '담당자 선택형', '고객이 메뉴 → 디자이너 → 날짜·시간 순서로 골라요. 담당자의 제공 메뉴와 근무 일정을 함께 적용해요.'], ['shop', '매장 예약형', '고객은 메뉴와 날짜·시간만 골라요. 매장 영업시간과 동시 예약 수로 빈 시간을 계산해요.']] as const).map(([mode, title, description]) => <label key={mode} className={editorStyles.modeCard}><input type="radio" name="mode" value={mode} checked={value.mode === mode} onChange={() => onChange({ ...value, mode })} /><span><strong>{title}</strong><small>{description}</small></span></label>)}</div>
    <Field label="매장 전체 동시 수용 수" hint="모든 메뉴와 담당자가 공유하는 예약 자리 수입니다. 담당자 수로 자동 계산하지 않습니다."><input name="capacity" inputMode="numeric" value={value.capacity} onChange={(event) => onChange({ ...value, capacity: event.target.value })} /></Field>
    <div className={styles.twoColumns}><Field label="예약 접수 시작 날짜" hint="이 날짜부터 고객이 선택할 수 있습니다."><input type="date" name="startDate" value={value.startDate} onChange={(event) => onChange({ ...value, startDate: event.target.value })} /></Field><Field label="예약 접수 종료 날짜" hint="이 날짜까지 포함합니다."><input type="date" name="endDate" value={value.endDate} onChange={(event) => onChange({ ...value, endDate: event.target.value })} /></Field></div>
    <div className={styles.twoColumns}><Field label="최소 사전 예약 시간 (분)" hint="예약 시작 전 필요한 시간입니다. 당일 접수를 허용하면 0을 입력하세요."><input name="minimumLeadMinutes" inputMode="numeric" value={value.minimumLeadMinutes} onChange={(event) => onChange({ ...value, minimumLeadMinutes: event.target.value })} /></Field><Field label="예약 시작 간격 (분)" hint="시간 선택 목록의 간격입니다. 예: 30분이면 09:00, 09:30 순서입니다."><input name="slotIntervalMinutes" inputMode="numeric" value={value.slotIntervalMinutes} onChange={(event) => onChange({ ...value, slotIntervalMinutes: event.target.value })} /></Field></div>
    <p className={styles.hint}>날짜와 시간은 Asia/Seoul 기준입니다. 설정을 저장해도 고객 예약 접수는 자동으로 시작되지 않습니다.</p>
  </fieldset>;
}
export function DateOverridesFields({ value, onChange, disabled, subject = 'shop', initialDate }: { value: DateOverrideDraft[]; onChange: (value: DateOverrideDraft[]) => void; disabled: boolean; subject?: 'shop' | 'staff'; initialDate?: string }) {
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(() => initialDate || value[0]?.date || today);
  const [month, setMonth] = useState(() => (initialDate || value[0]?.date || today).slice(0, 7));
  const year = Number(month.slice(0, 4)); const monthIndex = Number(month.slice(5)) - 1;
  const calendarDays = /^\d{4}-\d{2}$/.test(month) && year >= 1000 && year <= 9999 && monthIndex >= 0 && monthIndex <= 11 ? new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate() : 0;
  const firstDay = calendarDays ? new Date(`${month}-01T00:00:00Z`).getUTCDay() : 0;
  const addSelectedDate = (closed: boolean) => { if (value.length >= 366 || value.some((day) => day.date === selectedDate)) return; onChange([...value, { date: selectedDate, closed, hours: closed ? [] : [{ start: '', end: '' }], breaks: [] }]); };
  const updateDay = (index: number, change: Partial<DateOverrideDraft>) => {
    if (change.date !== undefined) { setSelectedDate(change.date); if (change.date) setMonth(change.date.slice(0, 7)); }
    onChange(value.map((day, position) => position === index ? { ...day, ...change } : day));
  };
  const updatePeriod = (dayIndex: number, kind: 'hours' | 'breaks', periodIndex: number, change: Partial<SpecialPeriodDraft>) => updateDay(dayIndex, { [kind]: value[dayIndex][kind].map((period, position) => position === periodIndex ? { ...period, ...change } : period) });
  const dayLabel = subject === 'staff' ? '특별 근무일' : '특별 영업일';
  const hoursLabel = subject === 'staff' ? '근무시간' : '영업시간';
  return <fieldset className={styles.fields} disabled={disabled}><legend>{dayLabel}과 휴무</legend>
    <p className={styles.hint}>특별 날짜의 {subject === 'staff' ? '근무시간' : '영업시간'}·휴게시간은 그 요일의 주간 {subject === 'staff' ? '근무시간' : '영업시간'}과 휴게시간을 대체합니다. 주간 일정의 날짜별 차단 시간은 특별 날짜에도 그대로 적용됩니다. 시간대 Asia/Seoul.</p>
    {!value.length && <p className={styles.empty}>{dayLabel}이 아직 없습니다. 평소와 다른 {hoursLabel}이나 종일 휴무가 있을 때 날짜를 추가해 주세요.</p>}
    <div className={editorStyles.dateLayout}><div><div className={editorStyles.calendarHead}><input type="month" aria-label="예외 일정 달력 월" value={month} min="1000-01" max="9999-12" disabled={disabled} onChange={(event) => { if (event.target.value) setMonth(event.target.value); }} /></div>
      <div className={editorStyles.calendarGrid}>{['일', '월', '화', '수', '목', '금', '토'].map((day) => <span key={day}>{day}</span>)}{Array.from({ length: firstDay }, (_, index) => <span key={`empty-${index}`} />)}{Array.from({ length: calendarDays }, (_, index) => { const date = `${month}-${String(index + 1).padStart(2, '0')}`; const hasException = value.some((day) => day.date === date); return <button type="button" key={date} disabled={disabled} aria-label={`${date}${hasException ? ' 예외 설정 있음' : ''}`} aria-pressed={selectedDate === date} data-exception={hasException} onClick={() => setSelectedDate(date)}>{index + 1}</button>; })}</div>
      <p className={styles.hint}>● 날짜별 예외가 있는 날 · 서울 (KST)</p></div><div className={editorStyles.dateForm}>
      {!value.some((day) => day.date === selectedDate) && <><h3>{selectedDate}</h3><p>이 날짜에만 적용할 일정을 정해 주세요.</p><div className={styles.actions}><Button variant="secondary" disabled={disabled || value.length >= 366} onClick={() => addSelectedDate(true)}>하루 휴무 추가</Button><Button variant="secondary" disabled={disabled || value.length >= 366} onClick={() => addSelectedDate(false)}>{hoursLabel} 설정</Button></div></>}
    {value.map((day, index) => <section key={index} hidden={day.date !== selectedDate && !!day.date} className={styles.specialDay} aria-label={`${dayLabel} ${index + 1}`}>
      <div className={styles.sectionHeading}><h3>특별 날짜 {index + 1} <span className={styles.muted}>/ {value.length}</span></h3><Button variant="secondary" disabled={disabled} aria-label={`${dayLabel} ${index + 1} 삭제`} onClick={() => onChange(value.filter((_, position) => position !== index))}>날짜 삭제</Button></div>
      <Field label="날짜"><input type="date" aria-label={`${dayLabel} ${index + 1} 날짜`} value={day.date} onChange={(event) => updateDay(index, { date: event.target.value })} /></Field>
      <label className={styles.specialClosure}><input type="checkbox" aria-label={`${dayLabel} ${index + 1} 종일 휴무`} checked={day.closed} onChange={(event) => updateDay(index, { closed: event.target.checked })} />종일 휴무</label>
      {!day.closed && (['hours', 'breaks'] as const).map((kind) => <section key={kind} className={styles.scheduleSection}><h3>{kind === 'hours' ? `특별 ${hoursLabel}` : '특별 휴게시간'} <span className={styles.muted}>{day[kind].length} / 128</span></h3>
        {day[kind].map((period, periodIndex) => <div key={periodIndex} className={styles.specialRow}>
          <label>시작 시간<input aria-label={`${dayLabel} ${index + 1} ${kind === 'hours' ? subject === 'staff' ? '근무 시작' : '시작' : '휴게 시작'} 시간 ${periodIndex + 1}`} placeholder="09:00" value={period.start} onChange={(event) => updatePeriod(index, kind, periodIndex, { start: event.target.value })} /></label>
          <label>종료 시간<input aria-label={`${dayLabel} ${index + 1} ${kind === 'hours' ? subject === 'staff' ? '근무 종료' : '종료' : '휴게 종료'} 시간 ${periodIndex + 1}`} placeholder="18:00" value={period.end} onChange={(event) => updatePeriod(index, kind, periodIndex, { end: event.target.value })} /></label>
          <Button variant="secondary" disabled={disabled} aria-label={`${dayLabel} ${index + 1} ${kind === 'hours' ? hoursLabel : '휴게시간'} ${periodIndex + 1} 삭제`} onClick={() => updateDay(index, { [kind]: day[kind].filter((_, position) => position !== periodIndex) })}>시간 삭제</Button>
        </div>)}
        <Button variant="secondary" disabled={disabled || day[kind].length >= 128} onClick={() => updateDay(index, { [kind]: [...day[kind], { start: '', end: '' }] })}>{kind === 'hours' ? hoursLabel : '휴게시간'} 추가</Button>
      </section>)}
    </section>)}</div></div>
    {value.length > 0 && <div className={editorStyles.dateList}><h3>설정된 날짜별 예외</h3>{value.map((day, index) => <div key={index} className={editorStyles.dateItem}><div>{day.date || '날짜 미입력'} · {day.closed ? '하루 휴무' : `다른 ${hoursLabel}`}<small>{day.closed ? '고객이 예약할 수 없는 날이에요.' : day.hours.map((period) => `${period.start || '시작 미입력'} – ${period.end || '종료 미입력'}`).join(' / ')}</small></div><button type="button" disabled={disabled} className={editorStyles.textButton} onClick={() => { setSelectedDate(day.date); if (day.date) setMonth(day.date.slice(0, 7)); }}>수정</button></div>)}</div>}
    <Button variant="secondary" disabled={disabled || value.length >= 366} onClick={() => { setSelectedDate(''); onChange([...value, { date: '', closed: true, hours: [], breaks: [] }]); }}>특별 날짜 추가</Button>
    <p className={styles.hint}>시간은 09:00 형식으로 입력하고 종료 시간에는 24:00을 사용할 수 있습니다. 특별 날짜는 366일까지 등록할 수 있습니다.</p>
  </fieldset>;
}
export function PartnerAvailability() {
  const { snapshot } = usePartner();
  return snapshot && <AvailabilityEditor snapshot={snapshot} />;
}
function AvailabilityEditor({ snapshot }: { snapshot: PartnerSnapshot }) {
  const staffDirectory = usePartnerStaffDirectory();
  const [tab, setTab] = useState<'weekly' | 'dates'>('weekly');
  return <div className={editorStyles.scope}>
    <header className={editorStyles.pageHead}><div><h1>기본 근무시간</h1><p>매주 반복하는 영업·근무시간과 특정 날짜 예외를 정해요.</p></div><Button variant="secondary" href="/partner/rules">예약 설정</Button></header>
    <div className={editorStyles.workspace}><aside className={editorStyles.targetList} aria-label="일정 대상"><h2>일정 대상</h2><Link href="/partner/availability" aria-current="page" className={editorStyles.target}><span aria-hidden="true">◷</span><div><strong>매장 공통</strong><small>기본 영업·휴무</small></div></Link>{staffDirectory.directory?.staff.map((person) => <Link key={person.id} href={`/partner/staff?staff=${encodeURIComponent(person.id)}&view=schedule`} className={editorStyles.target}><span aria-hidden="true">♙</span><div><strong>{person.name || '이름 미입력'}</strong><small>{person.title || '담당자'} · 근무 일정</small></div></Link>)}{!staffDirectory.directory?.staff.length && <Link href="/partner/staff" className={editorStyles.target}>담당자 관리 →</Link>}{staffDirectory.failed && <button type="button" className={editorStyles.textButton} onClick={() => void staffDirectory.refresh()}>담당자 다시 조회</button>}<p className={editorStyles.targetNote}>담당자 일정은 매장 공통 일정 안에서만 적용돼요.<br />시간 기준: 서울 (KST)</p></aside>
      <section className={editorStyles.panel} aria-label="일정 편집"><div className={editorStyles.panelHead}><h2>매장 공통 일정</h2><p>고객이 예약할 수 있는 매장의 기본 시간이에요.</p></div>
        <div className={editorStyles.tabs} aria-label="일정 유형"><button type="button" aria-pressed={tab === 'weekly'} onClick={() => setTab('weekly')}>매주 반복</button><button type="button" aria-pressed={tab === 'dates'} onClick={() => setTab('dates')}>특정 날짜 · {snapshot.dateOverrides.length}</button></div>
        <div hidden={tab !== 'weekly'}><WeeklyEditor snapshot={snapshot} /></div><div hidden={tab !== 'dates'}><DateEditor snapshot={snapshot} /></div>
        <p className={editorStyles.summary}>실제 예약 가능 시간에는 시술·정리 시간, 담당자, 매장 수용량, 기존 예약이 함께 적용돼요. 접수·확정된 예약과 충돌하는 변경은 저장할 수 없어요.</p>
      </section></div>
  </div>;
}
export function PartnerReservationSettings() {
  const { snapshot } = usePartner();
  return snapshot && <div className={editorStyles.scope}><header className={editorStyles.pageHead}><div><h1>예약 설정</h1><p>예약 방식과 동시 예약 수, 예약을 받는 기간을 정해요.</p></div><Button variant="secondary" href="/partner/availability">기본 근무시간</Button></header><section className={editorStyles.panel}><RulesEditor snapshot={snapshot} /></section></div>;
}
function RulesEditor({ snapshot }: { snapshot: PartnerSnapshot }) {
  const from = (current: PartnerSnapshot) => ({ values: reservationRulesDraft(current.reservationRules), updatedAt: current.reservationRules?.updatedAt ?? null });
  const form = usePartnerDraft('reservationRules', from(snapshot));
  const disabled = snapshot.readOnly || form.locked;
  return <section className={editorStyles.panelBody} aria-labelledby="reservation-rules-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>01 / BOOKING POLICY</p><h2 id="reservation-rules-title">예약 접수 기준</h2></div></div>
    <p className={styles.muted}>예약 방식과 매장 전체 수용량을 먼저 정합니다. 입력 전까지 임의 기준은 저장되지 않습니다.</p>
    <form className={editorStyles.staffForm} onSubmit={(event) => { event.preventDefault(); const parsed = reservationRulesFormValues(form.draft.values, snapshot.merchant.id); if (!parsed.ok) { form.invalid(parsed.error); return; } const version = form.draft.updatedAt ? { mode: 'update' as const, expectedUpdatedAt: form.draft.updatedAt } : { mode: 'create' as const }; void form.submit({ kind: 'reservationRules', ...version, values: parsed.values }, from); }}>
      <DraftRecoveryNotice restored={form.restored} />
      <ReservationRulesFields value={form.draft.values} onChange={(values) => form.setDraft({ ...form.draft, values })} disabled={disabled} />
      <FormActions state={form.state} disabled={disabled} dirty={form.dirty} onReload={() => void form.reload(from)} />
    </form>
  </section>;
}
function WeeklyEditor({ snapshot }: { snapshot: PartnerSnapshot }) {
  const from = (current: PartnerSnapshot) => ({ values: scheduleDraft(current.schedule), updatedAt: current.schedule?.updatedAt ?? null });
  const form = usePartnerDraft('schedule', from(snapshot), true);
  return <section className={editorStyles.panelBody} aria-labelledby="weekly-hours-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>02 / WEEKLY HOURS</p><h2 id="weekly-hours-title">주간 영업 일정</h2></div></div>
    <p className={styles.muted}>모든 메뉴와 담당자에게 공통으로 적용할 영업시간·휴게시간·날짜별 차단 시간을 입력합니다.</p>
    <form className={editorStyles.staffForm} onSubmit={(event) => { event.preventDefault(); const parsed = scheduleFormValues(form.draft.values, snapshot.dateOverrides); if (!parsed.ok) { form.invalid(parsed.error); return; } const version = form.draft.updatedAt ? { mode: 'update' as const, expectedUpdatedAt: form.draft.updatedAt } : { mode: 'create' as const }; void form.submit({ kind: 'schedule', ...version, values: parsed.values }, from); }}>
      <DraftRecoveryNotice restored={form.restored} />
      <ScheduleFields value={form.draft.values} onChange={(values) => form.setDraft({ ...form.draft, values })} disabled={snapshot.readOnly || form.locked} />
      <FormActions state={form.state} disabled={snapshot.readOnly || form.locked} dirty={form.dirty} onReload={() => void form.reload(from)} />
    </form>
  </section>;
}
export function DateEditor({ snapshot, initialDate }: { snapshot: PartnerSnapshot; initialDate?: string }) {
  const from = (current: PartnerSnapshot) => ({ values: dateOverridesDraft(current.dateOverrides), updatedAt: current.schedule?.updatedAt ?? null });
  const form = usePartnerDraft('dateOverrides', from(snapshot), true);
  const disabled = snapshot.readOnly || form.locked;
  return <section className={editorStyles.panelBody} aria-labelledby="special-dates-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>03 / SPECIAL DATES</p><h2 id="special-dates-title">특별 영업일·휴무</h2></div></div>
    <p className={styles.muted}>평소와 다른 날짜만 추가하세요. 종일 휴무나 평소 쉬는 날의 특별 영업도 설정할 수 있습니다.</p>
    <form className={editorStyles.staffForm} onSubmit={(event) => { event.preventDefault(); const parsed = dateOverridesFormValues(form.draft.values, snapshot.merchant.id, snapshot.schedule); if (!parsed.ok) { form.invalid(parsed.error); return; } const version = form.draft.updatedAt ? { mode: 'update' as const, expectedUpdatedAt: form.draft.updatedAt } : { mode: 'create' as const }; void form.submit({ kind: 'dateOverrides', ...version, values: parsed.values }, from); }}>
      <DraftRecoveryNotice restored={form.restored} />
      <DateOverridesFields initialDate={initialDate} value={form.draft.values} onChange={(values) => form.setDraft({ ...form.draft, values })} disabled={disabled} />
      <FormActions state={form.state} disabled={disabled} dirty={form.dirty} onReload={() => void form.reload(from)} />
    </form>
  </section>;
}
