'use client';
import {Button} from '@/components/ui/button';
import {record} from '@/lib/partner/contracts';
import {reservationSchedule} from '@/lib/partner/reservation-calendar';
import type {StaffSummary,StaffDetailSnapshot} from '@/lib/partner/staff-server';
import {postStaffCommand} from '@/lib/partner/staff-client';
import {useBookingResource} from '@/components/booking/use-booking-resource';
import {uncertainSaveOutcomeMessage,usePartner} from './partner-provider';
import {useOperationDraft} from './use-operation-draft';
import {SaveStatus} from './partner-form';
import {PartnerDialog} from './partner-booking-editor';
import type {CalendarPoint} from './partner-calendar-view';
function staffDetail(value:unknown):value is {ok:true;snapshot:StaffDetailSnapshot} {
  if(!record(value)||value.ok!==true||!record(value.snapshot)||!record(value.snapshot.staff))return false;
  const s=value.snapshot.schedule;if(s===null)return true;if(!record(s))return false;
  const {staffId,updatedAt,...schedule}=s;
  return typeof staffId==='string'&&typeof updatedAt==='string'&&reservationSchedule(schedule);
}
export function CalendarBlockEditor({point,staff,closure,onClose,onSaved,scope}:{point:CalendarPoint;staff:StaffSummary[];closure:boolean;onClose:()=>void;onSaved:()=>void;scope:string}) {
  const {snapshot,stale,save,refresh}=usePartner();
  const form=useOperationDraft(`calendar:block:${scope}:${point.staffId}:${point.startAt}:${closure}`,{
    values:{target:point.staffId??'shop',date:point.date,start:point.startAt.slice(11,16),end:''},
    updatedAt:snapshot?.schedule?.updatedAt??snapshot?.merchant.updatedAt??'',
  });
  const {target,date,start,end}=form.draft.values;
  const detail=useBookingResource(target==='shop'?null:`/api/partner/staff?id=${target}`,staffDetail,scope);
  const disabled=!!snapshot?.readOnly||stale;
  const minutes=(text:string)=>Number(text.slice(0,2))*60+Number(text.slice(3));
  const change=(key:keyof typeof form.draft.values,value:string)=>form.setDraft({...form.draft,values:{...form.draft.values,[key]:value}});
  async function readStaff(){
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
    try{const response=await fetch(`/api/partner/staff?id=${target}`,{cache:'no-store',credentials:'same-origin',signal:controller.signal});const body:unknown=await response.json();
      if(!response.ok||!staffDetail(body)||body.snapshot.staff.id!==target||body.snapshot.merchantId!==snapshot?.merchant.id)throw new Error('BOOKING_SERVICE_UNAVAILABLE');
      return body.snapshot;
    }finally{clearTimeout(timeout);}
  }
  const recover=()=>void form.recover(async()=>{
    if(target==='shop'){
      const fresh=await refresh();if(!fresh)throw new Error('BOOKING_SERVICE_UNAVAILABLE');
      const applied=closure?fresh.dateOverrides.some(o=>o.date===date&&!o.hours.length):fresh.schedule?.blocks.some(b=>b.date===date&&b.startMinute===minutes(start)&&b.endMinute===minutes(end));
      if(applied)onSaved();
      return {values:form.draft.values,updatedAt:fresh.schedule?.updatedAt??fresh.merchant.updatedAt};
    }
    const fresh=await readStaff();detail.refresh();
    const applied=closure?fresh.schedule?.overrides.some(o=>o.date===date&&!o.hours.length):fresh.schedule?.blocks.some(b=>b.date===date&&b.startMinute===minutes(start)&&b.endMinute===minutes(end));
    if(applied)onSaved();
    return {values:form.draft.values,updatedAt:fresh.schedule?.updatedAt??fresh.staff.updatedAt};
  });
  const submit=()=>void form.commit(async()=>{
    if(!snapshot||disabled)throw new Error('PARTNER_READ_ONLY');
    if(target==='shop'){
      const current=snapshot.schedule;
      const result=await save(closure?{kind:'dateOverrides',...(current?{mode:'update',expectedUpdatedAt:current.updatedAt}as const:{mode:'create'}as const),values:{overrides:[...snapshot.dateOverrides.filter(o=>o.date!==date),{date,hours:[],breaks:[]}]}}:{kind:'schedule',...(current?{mode:'update',expectedUpdatedAt:current.updatedAt}as const:{mode:'create'}as const),values:{hours:current?.hours??[],breaks:current?.breaks??[],blocks:[...(current?.blocks??[]),{date,startMinute:minutes(start),endMinute:minutes(end)}]}});
      if(result.kind==='conflict')throw new Error('BOOKING_CONFLICT');
      // The provider also returns `error` when the request may have committed.
      // Keep that outcome locked until readback confirms the stored schedule.
      if(result.kind!=='saved')throw new Error(result.kind==='error'&&result.message!==uncertainSaveOutcomeMessage?'INVALID_REQUEST':'BOOKING_SERVICE_UNAVAILABLE');
      onSaved();return {values:form.draft.values,updatedAt:result.snapshot.schedule?.updatedAt??result.snapshot.merchant.updatedAt};
    }
    const data=detail.data?.snapshot;
    if(!data||detail.error||data.staff.id!==target||data.merchantId!==snapshot.merchant.id)throw new Error('BOOKING_SERVICE_UNAVAILABLE');
    const current=data.schedule;const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
    try{
      const result=await postStaffCommand({kind:'staffSchedule',staffId:target,...(current?{mode:'update',expectedUpdatedAt:current.updatedAt}as const:{mode:'create'}as const),values:{hours:current?.hours??[],breaks:current?.breaks??[],blocks:closure?current?.blocks??[]:[...(current?.blocks??[]),{date,startMinute:minutes(start),endMinute:minutes(end)}],overrides:closure?[...(current?.overrides??[]).filter(o=>o.date!==date),{date,hours:[],breaks:[]}]:current?.overrides??[]}},controller.signal);
      if(result==='conflict')throw new Error('BOOKING_CONFLICT');
      if(result!=='acknowledged')throw new Error(result==='unconfirmed'?'BOOKING_SERVICE_UNAVAILABLE':'INVALID_REQUEST');
      const fresh=await readStaff();onSaved();return {values:form.draft.values,updatedAt:fresh.schedule?.updatedAt??fresh.staff.updatedAt};
    }finally{clearTimeout(timeout);}
  });
  return <PartnerDialog title={closure?'휴무 설정':'시간 막기'} onClose={onClose} busy={form.state.kind==='pending'}><form onSubmit={e=>{e.preventDefault();submit();}}><div className="dialog-body"><p className="small muted">저장하면 고객의 예약 가능한 시간에도 적용됩니다. 기존 예약과 겹치는 변경은 저장할 수 없습니다.</p><fieldset className="live-form-fields" disabled={disabled||form.locked}><label className="field">대상<select value={target} onChange={e=>change('target',e.target.value)}><option value="shop">매장 전체</option>{staff.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label className="field">날짜<input type="date" required value={date} onChange={e=>change('date',e.target.value)}/></label>{!closure&&<div className="form-grid"><label className="field">시작<input type="time" required value={start} onChange={e=>change('start',e.target.value)}/></label><label className="field">끝<input type="time" required value={end} min={start} onChange={e=>change('end',e.target.value)}/></label></div>}</fieldset><SaveStatus state={form.state} onReload={recover}/></div><div className="dialog-footer"><Button type="button" variant="secondary" disabled={form.state.kind==='pending'} onClick={onClose}>닫기</Button><Button variant="primary" type="submit" disabled={disabled||form.locked||(target!=='shop'&&(!detail.data||detail.loading||!!detail.error))||(!closure&&(!end||end<=start))}>{form.state.kind==='pending'?'저장 중…':closure?'휴무로 설정':'시간 막기'}</Button></div></form></PartnerDialog>;
}
