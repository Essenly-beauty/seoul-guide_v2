'use client';

import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import type { PartnerSnapshot } from '@/lib/partner/contracts';
import { dateOverridesDraft, dateOverridesFormValues, reservationRulesDraft, reservationRulesFormValues, scheduleDraft, scheduleFormValues, type DateOverrideDraft, type ReservationRulesDraft, type ScheduleDraft, type SpecialPeriodDraft } from '@/lib/partner/form-values';
import { usePartner } from './partner-provider';
import { DraftRecoveryNotice, Field, FormActions, usePartnerDraft } from './partner-form';
import styles from './partner.module.css';

const weekdays = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
export function ScheduleFields({ value, onChange, disabled }: { value: ScheduleDraft; onChange: (value: ScheduleDraft) => void; disabled: boolean }) {
  return <fieldset className={styles.fields} disabled={disabled}><legend>영업 일정 입력</legend><p className={styles.hint}>시간대 Asia/Seoul (한국 표준시). 영업시간 128개, 휴게시간 128개, 날짜별 휴무 512개까지 설정할 수 있습니다. 시간은 09:00 형식으로 입력하며 종료 시간은 24:00까지 가능합니다.</p>
    {(['hours', 'breaks'] as const).map((kind) => {
      const label = kind === 'hours' ? '영업시간' : '휴게시간';
      return <section key={kind} className={styles.scheduleSection}><h3>{label} <span className={styles.muted}>{value[kind].length} / 128</span></h3>
        {!value[kind].length && <p className={styles.muted}>{label}이 설정되지 않았습니다.</p>}
        {value[kind].map((row, index) => <div key={index} className={styles.scheduleRow}>
          <label>요일<select aria-label={`${label} ${index + 1} 요일`} value={row.weekday} onChange={(event) => onChange({ ...value, [kind]: value[kind].map((item, position) => position === index ? { ...item, weekday: event.target.value } : item) })}>{weekdays.map((day, dayIndex) => <option key={day} value={dayIndex}>{day}</option>)}</select></label>
          <label>시작 시간<input aria-label={`${label} ${index + 1} 시작 시간`} inputMode="text" placeholder="09:00" value={row.start} onChange={(event) => onChange({ ...value, [kind]: value[kind].map((item, position) => position === index ? { ...item, start: event.target.value } : item) })} /></label>
          <label>종료 시간<input aria-label={`${label} ${index + 1} 종료 시간`} inputMode="text" placeholder="18:00" value={row.end} onChange={(event) => onChange({ ...value, [kind]: value[kind].map((item, position) => position === index ? { ...item, end: event.target.value } : item) })} /></label>
          <Button variant="secondary" disabled={disabled} aria-label={`${label} ${index + 1} 삭제`} onClick={() => onChange({ ...value, [kind]: value[kind].filter((_, position) => position !== index) })}>행 삭제</Button>
        </div>)}
        <Button variant="secondary" disabled={disabled || value[kind].length >= 128} onClick={() => onChange({ ...value, [kind]: [...value[kind], { weekday: '1', start: '', end: '' }] })}>{label} 추가</Button>
      </section>;
    })}
    <section className={styles.scheduleSection}><h3>날짜별 휴무 <span className={styles.muted}>{value.blocks.length} / 512</span></h3><p className={styles.hint}>특정 날짜의 전체 또는 일부 시간을 제외합니다. 하루 휴무는 00:00–24:00으로 입력하세요.</p>
      {!value.blocks.length && <p className={styles.muted}>날짜별 휴무가 설정되지 않았습니다.</p>}
      {value.blocks.map((row, index) => <div key={index} className={styles.scheduleRow}>
        <label>날짜<input type="date" aria-label={`날짜별 휴무 ${index + 1} 날짜`} value={row.date} onChange={(event) => onChange({ ...value, blocks: value.blocks.map((item, position) => position === index ? { ...item, date: event.target.value } : item) })} /></label>
        <label>시작 시간<input aria-label={`날짜별 휴무 ${index + 1} 시작 시간`} placeholder="00:00" value={row.start} onChange={(event) => onChange({ ...value, blocks: value.blocks.map((item, position) => position === index ? { ...item, start: event.target.value } : item) })} /></label>
        <label>종료 시간<input aria-label={`날짜별 휴무 ${index + 1} 종료 시간`} placeholder="24:00" value={row.end} onChange={(event) => onChange({ ...value, blocks: value.blocks.map((item, position) => position === index ? { ...item, end: event.target.value } : item) })} /></label>
        <Button variant="secondary" disabled={disabled} aria-label={`날짜별 휴무 ${index + 1} 삭제`} onClick={() => onChange({ ...value, blocks: value.blocks.filter((_, position) => position !== index) })}>행 삭제</Button>
      </div>)}
      <Button variant="secondary" disabled={disabled || value.blocks.length >= 512} onClick={() => onChange({ ...value, blocks: [...value.blocks, { date: '', start: '00:00', end: '24:00' }] })}>날짜별 휴무 추가</Button>
    </section>
  </fieldset>;
}
export function ReservationRulesFields({ value, onChange, disabled }: { value: ReservationRulesDraft; onChange: (value: ReservationRulesDraft) => void; disabled: boolean }) {
  return <fieldset className={styles.fields} disabled={disabled}><legend>예약 접수 기준</legend>
    <Field label="예약 방식" hint="매장 예약형은 메뉴 다음 날짜·시간을 선택합니다. 담당자 선택형은 메뉴 다음 담당자를 선택하며, 담당자 정보는 아직 연결 전입니다."><select name="mode" value={value.mode} onChange={(event) => onChange({ ...value, mode: event.target.value as ReservationRulesDraft['mode'] })}><option value="shop">매장 예약형</option><option value="staff">담당자 선택형</option></select></Field>
    <Field label="매장 전체 동시 수용 수" hint="모든 메뉴와 담당자가 공유하는 예약 자리 수입니다. 담당자 수로 자동 계산하지 않습니다."><input name="capacity" inputMode="numeric" value={value.capacity} onChange={(event) => onChange({ ...value, capacity: event.target.value })} /></Field>
    <div className={styles.twoColumns}><Field label="예약 접수 시작 날짜" hint="이 날짜부터 고객이 선택할 수 있습니다."><input type="date" name="startDate" value={value.startDate} onChange={(event) => onChange({ ...value, startDate: event.target.value })} /></Field><Field label="예약 접수 종료 날짜" hint="이 날짜까지 포함합니다."><input type="date" name="endDate" value={value.endDate} onChange={(event) => onChange({ ...value, endDate: event.target.value })} /></Field></div>
    <div className={styles.twoColumns}><Field label="최소 사전 예약 시간 (분)" hint="예약 시작 전 필요한 시간입니다. 당일 접수를 허용하면 0을 입력하세요."><input name="minimumLeadMinutes" inputMode="numeric" value={value.minimumLeadMinutes} onChange={(event) => onChange({ ...value, minimumLeadMinutes: event.target.value })} /></Field><Field label="예약 시작 간격 (분)" hint="시간 선택 목록의 간격입니다. 예: 30분이면 09:00, 09:30 순서입니다."><input name="slotIntervalMinutes" inputMode="numeric" value={value.slotIntervalMinutes} onChange={(event) => onChange({ ...value, slotIntervalMinutes: event.target.value })} /></Field></div>
    <p className={styles.hint}>날짜와 시간은 Asia/Seoul 기준입니다. 설정을 저장해도 고객 예약 접수는 자동으로 시작되지 않습니다.</p>
  </fieldset>;
}
export function DateOverridesFields({ value, onChange, disabled }: { value: DateOverrideDraft[]; onChange: (value: DateOverrideDraft[]) => void; disabled: boolean }) {
  const updateDay = (index: number, change: Partial<DateOverrideDraft>) => onChange(value.map((day, position) => position === index ? { ...day, ...change } : day));
  const updatePeriod = (dayIndex: number, kind: 'hours' | 'breaks', periodIndex: number, change: Partial<SpecialPeriodDraft>) => updateDay(dayIndex, { [kind]: value[dayIndex][kind].map((period, position) => position === periodIndex ? { ...period, ...change } : period) });
  return <fieldset className={styles.fields} disabled={disabled}><legend>특별 영업일과 휴무</legend>
    <p className={styles.hint}>특별 날짜의 영업시간·휴게시간은 그 요일의 주간 영업시간과 휴게시간을 대체합니다. 주간 일정의 날짜별 차단 시간은 특별 날짜에도 그대로 적용됩니다. 시간대 Asia/Seoul.</p>
    {!value.length && <p className={styles.empty}>특별 영업일이 아직 없습니다. 평소와 다른 영업시간이나 종일 휴무가 있을 때 날짜를 추가해 주세요.</p>}
    {value.map((day, index) => <section key={index} className={styles.specialDay} aria-label={`특별 영업일 ${index + 1}`}>
      <div className={styles.sectionHeading}><h3>특별 날짜 {index + 1} <span className={styles.muted}>/ {value.length}</span></h3><Button variant="secondary" disabled={disabled} aria-label={`특별 영업일 ${index + 1} 삭제`} onClick={() => onChange(value.filter((_, position) => position !== index))}>날짜 삭제</Button></div>
      <Field label="날짜"><input type="date" aria-label={`특별 영업일 ${index + 1} 날짜`} value={day.date} onChange={(event) => updateDay(index, { date: event.target.value })} /></Field>
      <label className={styles.specialClosure}><input type="checkbox" checked={day.closed} onChange={(event) => updateDay(index, { closed: event.target.checked })} />종일 휴무</label>
      {!day.closed && (['hours', 'breaks'] as const).map((kind) => <section key={kind} className={styles.scheduleSection}><h3>{kind === 'hours' ? '특별 영업시간' : '특별 휴게시간'} <span className={styles.muted}>{day[kind].length} / 128</span></h3>
        {day[kind].map((period, periodIndex) => <div key={periodIndex} className={styles.specialRow}>
          <label>시작 시간<input aria-label={`특별 영업일 ${index + 1} ${kind === 'hours' ? '시작' : '휴게 시작'} 시간 ${periodIndex + 1}`} placeholder="09:00" value={period.start} onChange={(event) => updatePeriod(index, kind, periodIndex, { start: event.target.value })} /></label>
          <label>종료 시간<input aria-label={`특별 영업일 ${index + 1} ${kind === 'hours' ? '종료' : '휴게 종료'} 시간 ${periodIndex + 1}`} placeholder="18:00" value={period.end} onChange={(event) => updatePeriod(index, kind, periodIndex, { end: event.target.value })} /></label>
          <Button variant="secondary" disabled={disabled} aria-label={`특별 영업일 ${index + 1} ${kind === 'hours' ? '영업시간' : '휴게시간'} ${periodIndex + 1} 삭제`} onClick={() => updateDay(index, { [kind]: day[kind].filter((_, position) => position !== periodIndex) })}>시간 삭제</Button>
        </div>)}
        <Button variant="secondary" disabled={disabled || day[kind].length >= 128} onClick={() => updateDay(index, { [kind]: [...day[kind], { start: '', end: '' }] })}>{kind === 'hours' ? '영업시간' : '휴게시간'} 추가</Button>
      </section>)}
    </section>)}
    <Button variant="secondary" disabled={disabled || value.length >= 366} onClick={() => onChange([...value, { date: '', closed: true, hours: [], breaks: [] }])}>특별 날짜 추가</Button>
    <p className={styles.hint}>시간은 09:00 형식으로 입력하고 종료 시간에는 24:00을 사용할 수 있습니다. 특별 날짜는 366일까지 등록할 수 있습니다.</p>
  </fieldset>;
}
export function PartnerAvailability() {
  const { snapshot } = usePartner();
  return snapshot && <AvailabilityEditor snapshot={snapshot} />;
}
function AvailabilityEditor({ snapshot }: { snapshot: PartnerSnapshot }) {
  return <>
    <header className={styles.pageHeader}><p className={styles.eyebrow}>BOOKING OPERATIONS</p><h1>예약 일정·설정</h1><p className={styles.muted}>예약 접수 기준과 매장 운영시간을 관리합니다.</p></header>
    <Notice tone="info">저장한 설정은 아직 고객 예약 화면과 연결되지 않았습니다. 담당자·결제·운영 승인 연결이 완료될 때까지 고객은 예약을 확정할 수 없습니다.</Notice>
    <RulesEditor snapshot={snapshot} />
    <WeeklyEditor snapshot={snapshot} />
    <DateEditor snapshot={snapshot} />
  </>;
}
function RulesEditor({ snapshot }: { snapshot: PartnerSnapshot }) {
  const from = (current: PartnerSnapshot) => ({ values: reservationRulesDraft(current.reservationRules), updatedAt: current.reservationRules?.updatedAt ?? null });
  const form = usePartnerDraft('reservationRules', from(snapshot));
  const disabled = snapshot.readOnly || form.locked;
  return <section className={styles.availabilitySection} aria-labelledby="reservation-rules-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>01 / BOOKING POLICY</p><h2 id="reservation-rules-title">예약 접수 기준</h2></div></div>
    <p className={styles.muted}>예약 방식과 매장 전체 수용량을 먼저 정합니다. 입력 전까지 임의 기준은 저장되지 않습니다.</p>
    <form className={styles.editor} onSubmit={(event) => { event.preventDefault(); const parsed = reservationRulesFormValues(form.draft.values, snapshot.merchant.id); if (!parsed.ok) { form.invalid(parsed.error); return; } const version = form.draft.updatedAt ? { mode: 'update' as const, expectedUpdatedAt: form.draft.updatedAt } : { mode: 'create' as const }; void form.submit({ kind: 'reservationRules', ...version, values: parsed.values }, from); }}>
      <DraftRecoveryNotice restored={form.restored} />
      <ReservationRulesFields value={form.draft.values} onChange={(values) => form.setDraft({ ...form.draft, values })} disabled={disabled} />
      <FormActions state={form.state} disabled={disabled} dirty={form.dirty} onReload={() => void form.reload(from)} />
    </form>
  </section>;
}
function WeeklyEditor({ snapshot }: { snapshot: PartnerSnapshot }) {
  const from = (current: PartnerSnapshot) => ({ values: scheduleDraft(current.schedule), updatedAt: current.schedule?.updatedAt ?? null });
  const form = usePartnerDraft('schedule', from(snapshot));
  return <section className={styles.availabilitySection} aria-labelledby="weekly-hours-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>02 / WEEKLY HOURS</p><h2 id="weekly-hours-title">주간 영업 일정</h2></div></div>
    <p className={styles.muted}>모든 메뉴와 담당자에게 공통으로 적용할 영업시간·휴게시간·날짜별 차단 시간을 입력합니다.</p>
    <form className={styles.editor} onSubmit={(event) => { event.preventDefault(); const parsed = scheduleFormValues(form.draft.values, snapshot.dateOverrides); if (!parsed.ok) { form.invalid(parsed.error); return; } const version = form.draft.updatedAt ? { mode: 'update' as const, expectedUpdatedAt: form.draft.updatedAt } : { mode: 'create' as const }; void form.submit({ kind: 'schedule', ...version, values: parsed.values }, from); }}>
      <DraftRecoveryNotice restored={form.restored} />
      <ScheduleFields value={form.draft.values} onChange={(values) => form.setDraft({ ...form.draft, values })} disabled={snapshot.readOnly || form.locked} />
      <FormActions state={form.state} disabled={snapshot.readOnly || form.locked} dirty={form.dirty} onReload={() => void form.reload(from)} />
    </form>
  </section>;
}
function DateEditor({ snapshot }: { snapshot: PartnerSnapshot }) {
  const from = (current: PartnerSnapshot) => ({ values: dateOverridesDraft(current.dateOverrides), updatedAt: current.schedule?.updatedAt ?? null });
  const form = usePartnerDraft('dateOverrides', from(snapshot));
  const disabled = snapshot.readOnly || form.locked;
  return <section className={styles.availabilitySection} aria-labelledby="special-dates-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>03 / SPECIAL DATES</p><h2 id="special-dates-title">특별 영업일·휴무</h2></div></div>
    <p className={styles.muted}>평소와 다른 날짜만 추가하세요. 종일 휴무나 평소 쉬는 날의 특별 영업도 설정할 수 있습니다.</p>
    <form className={styles.editor} onSubmit={(event) => { event.preventDefault(); const parsed = dateOverridesFormValues(form.draft.values, snapshot.merchant.id, snapshot.schedule); if (!parsed.ok) { form.invalid(parsed.error); return; } const version = form.draft.updatedAt ? { mode: 'update' as const, expectedUpdatedAt: form.draft.updatedAt } : { mode: 'create' as const }; void form.submit({ kind: 'dateOverrides', ...version, values: parsed.values }, from); }}>
      <DraftRecoveryNotice restored={form.restored} />
      <DateOverridesFields value={form.draft.values} onChange={(values) => form.setDraft({ ...form.draft, values })} disabled={disabled} />
      <FormActions state={form.state} disabled={disabled} dirty={form.dirty} onReload={() => void form.reload(from)} />
    </form>
  </section>;
}
