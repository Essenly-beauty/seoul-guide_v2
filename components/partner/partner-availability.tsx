'use client';

import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import type { PartnerSnapshot } from '@/lib/partner/contracts';
import { scheduleDraft, scheduleFormValues, type ScheduleDraft } from '@/lib/partner/form-values';
import { usePartner } from './partner-provider';
import { DraftRecoveryNotice, FormActions, usePartnerDraft } from './partner-form';
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
export function PartnerAvailability() {
  const { snapshot } = usePartner();
  return snapshot && <AvailabilityEditor snapshot={snapshot} />;
}
function AvailabilityEditor({ snapshot }: { snapshot: PartnerSnapshot }) {
  const from = (current: PartnerSnapshot) => ({ values: scheduleDraft(current.schedule), updatedAt: current.schedule?.updatedAt ?? null });
  const form = usePartnerDraft('schedule', from(snapshot));
  return <>
    <header className={styles.pageHeader}><p className={styles.eyebrow}>BUSINESS HOURS</p><h1>영업 일정</h1><p className={styles.muted}>매장의 한 주와 쉬어가는 시간을 정리하세요.</p></header>
    <Notice tone="info">모든 메뉴에 공통으로 적용하는 매장 일정입니다. 메뉴별 수용 인원이나 실제 예약 가능한 시간표가 아닙니다. 고객 예약은 아직 연결되지 않았습니다.</Notice>
    <DraftRecoveryNotice restored={form.restored} />
    <form onSubmit={(event) => { event.preventDefault(); const parsed = scheduleFormValues(form.draft.values); if (!parsed.ok) { form.invalid(parsed.error); return; } const version = form.draft.updatedAt ? { mode: 'update' as const, expectedUpdatedAt: form.draft.updatedAt } : { mode: 'create' as const }; void form.submit({ kind: 'schedule', ...version, values: parsed.values }, from); }}>
      <ScheduleFields value={form.draft.values} onChange={(values) => form.setDraft({ ...form.draft, values })} disabled={snapshot.readOnly || form.locked} />
      <FormActions state={form.state} disabled={snapshot.readOnly || form.locked} dirty={form.dirty} onReload={() => void form.reload(from)} />
    </form>
  </>;
}
