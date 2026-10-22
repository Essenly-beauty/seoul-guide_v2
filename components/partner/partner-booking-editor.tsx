'use client';
import {Button} from '@/components/ui/button';
import { useEffect,useRef,useState,type FormEvent, type ReactNode } from 'react';
import { useDialogFocus } from '@/components/ui/use-dialog-focus';
import { useBookingResource } from '@/components/booking/use-booking-resource';
import { bookingAvailability,bookingCatalog,type BookingAvailability,type BookingCatalog } from '@/lib/booking/contracts';
import { partnerBooking,type PartnerBooking,type PartnerBookingCreateInput,type PartnerBookingMutation } from '@/lib/booking/partner-contracts';
import { record } from '@/lib/partner/contracts';
import { kstDate,money,timeLabel } from '@/lib/partner/dashboard';
import { partnerBookingError } from './partner-bookings';
import {usePartner,type PartnerDraftRecord} from './partner-provider';

export function PartnerDialog({title,children,onClose,busy=false}:{title:string;children:ReactNode;onClose:()=>void;busy?:boolean}) {
  const ref=useDialogFocus<HTMLDivElement>(true,()=>{if(!busy)onClose();});
  return <div className="live-modal-backdrop"><div ref={ref} className="live-modal" role="dialog" aria-modal="true" aria-labelledby="operation-dialog-title" tabIndex={-1}><div className="dialog-head"><h2 id="operation-dialog-title">{title}</h2><button type="button" disabled={busy} onClick={onClose} aria-label="닫기">×</button></div>{children}</div></div>;
}
/** Slot lookup for the editor. Null while a required staff member is not chosen: the reschedule lookup used to go out without
 *  one, the server answered 409 BOOKING_UNAVAILABLE and the dialog showed "예약 시간을 조회하지 못했습니다" (2026-10-21 점검). */
export function editorAvailabilityUrl({bookingId,placeId,serviceId,staffId,date,needsStaff}:{bookingId?:string;placeId:string;serviceId:string;staffId:string;date:string;needsStaff:boolean}):string|null {
  if(needsStaff&&!staffId) return null;
  if(bookingId) return `/api/partner/operations/bookings/${bookingId}/availability?date=${date}${staffId?`&staffId=${staffId}`:''}`;
  return serviceId?`/api/places/${encodeURIComponent(placeId)}/availability?serviceId=${serviceId}&date=${date}${needsStaff&&staffId?`&staffId=${staffId}`:''}`:null;
}
export async function writeBookingOperation(path:string,input:PartnerBookingMutation|PartnerBookingCreateInput,signal:AbortSignal):Promise<PartnerBooking> {
  const response=await fetch(path,{method:'requestId' in input?'POST':'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal});
  const body:unknown=await response.json();
  if(!response.ok) throw new Error(record(body)&&typeof body.code==='string'?body.code:'BOOKING_SERVICE_UNAVAILABLE');
  if(!record(body)||!partnerBooking(body.booking))throw new Error('BOOKING_SERVICE_UNAVAILABLE');
  return body.booking;
}
const catalogGuard=(data:unknown):data is BookingCatalog=>bookingCatalog(data);
const slotsGuard=(data:unknown):data is BookingAvailability=>bookingAvailability(data);
export function BookingEditor({placeId,booking,initialDate=kstDate(),initialStart='',initialStaffId,onClose,onSaved,disabled=false,scope,defaultCustomerName='',defaultPhone=''}:{placeId:string;booking?:PartnerBooking;initialDate?:string;initialStart?:string;initialStaffId?:string|null;onClose:()=>void;onSaved:(value:PartnerBooking)=>void;disabled?:boolean;scope:string;defaultCustomerName?:string;defaultPhone?:string}) {
  const {drafts}=usePartner();
  const pendingKey=`booking:create:${placeId}`;
  const inputKey=`booking:input:${placeId}:${booking?.id??'new'}`;
  const [inputRecord]=useState(()=>drafts.read<{serviceId:string;staffId:string;date:string;startAt:string;source:'phone'|'walkin';customerName:string;phone:string;notes:string}>(inputKey)??{
    token:Symbol(inputKey),draft:{serviceId:booking?.serviceId??'',staffId:initialStaffId!==undefined?(initialStaffId??''):(booking?.staffId??''),date:initialDate,startAt:initialStart,source:'phone' as 'phone'|'walkin',customerName:defaultCustomerName,phone:defaultPhone,notes:''},
    baseline:{serviceId:booking?.serviceId??'',staffId:initialStaffId!==undefined?(initialStaffId??''):(booking?.staffId??''),date:initialDate,startAt:initialStart,source:'phone' as 'phone'|'walkin',customerName:defaultCustomerName,phone:defaultPhone,notes:''},state:{kind:'idle' as const},
  });
  useEffect(()=>{drafts.setActive(inputKey);if(!drafts.read(inputKey))drafts.write(inputKey,inputRecord);return()=>drafts.setActive(null,inputKey);},[drafts,inputKey,inputRecord]);
  const [pendingRecord]=useState<PartnerDraftRecord<PartnerBookingCreateInput|null>>(()=>drafts.read<PartnerBookingCreateInput|null>(pendingKey)??{token:Symbol(pendingKey),draft:null,baseline:null,state:{kind:'idle'},retainUnconfirmed:true});
  const restored=!booking?pendingRecord.draft:null;
  useEffect(()=>{if(booking)return;drafts.setActive(pendingKey);if(!drafts.read(pendingKey))drafts.write(pendingKey,pendingRecord);return()=>drafts.setActive(null,pendingKey);},[booking,drafts,pendingKey,pendingRecord]);
  const resource=useBookingResource(`/api/places/${encodeURIComponent(placeId)}/booking`,catalogGuard,scope);
  const catalog=resource.data?.status==='available'?resource.data:null;
  const [serviceId,setServiceId]=useState(restored?.serviceId??inputRecord.draft.serviceId);
  const [staffId,setStaffId]=useState(restored?.staffId??inputRecord.draft.staffId);
  const [date,setDate]=useState(restored?kstDate(restored.startAt):inputRecord.draft.date);
  const [startAt,setStartAt]=useState(restored?.startAt??inputRecord.draft.startAt);
  const [source,setSource]=useState<'phone'|'walkin'>(restored?.source??inputRecord.draft.source);
  const [customerName,setName]=useState(restored?.customerName??inputRecord.draft.customerName);const [phone,setPhone]=useState(restored?.phone??inputRecord.draft.phone);const [notes,setNotes]=useState(restored?.notes??inputRecord.draft.notes);
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const [submitted,setSubmitted]=useState<PartnerBookingCreateInput|null>(restored);
  useEffect(()=>{if(!submitted)drafts.complete(inputKey,inputRecord.token,{...inputRecord,draft:{serviceId,staffId,date,startAt,source,customerName,phone,notes}});},[drafts,inputKey,inputRecord,submitted,serviceId,staffId,date,startAt,source,customerName,phone,notes]);
  function closeEditor(){
    if(busy)return;
    const entered={serviceId,staffId,date,startAt,source,customerName,phone,notes};
    if(!submitted&&JSON.stringify(entered)!==JSON.stringify(inputRecord.baseline)&&!window.confirm('입력 중인 예약 내용이 있습니다. 입력을 버리고 닫을까요?'))return;
    drafts.discard(inputKey);onClose();
  }
  const mounted=useRef(true);const controller=useRef<AbortController|null>(null);const lock=useRef(false);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();};},[]);
  const staff=catalog?.staff.filter(s=>s.serviceIds.includes(serviceId))??[];
  const needsStaff=booking?booking.staffId!==null:catalog?.selectionMode==='staff';
  const availabilityUrl=editorAvailabilityUrl({bookingId:booking?.id,placeId,serviceId,staffId,date,needsStaff});
  const availability=useBookingResource(availabilityUrl,slotsGuard,scope);
  const selected=availability.data?.slots.find(slot=>Date.parse(slot.startAt)===Date.parse(startAt));
  const menu=catalog?.services.find(s=>s.id===serviceId);
  async function submit(event:FormEvent) {
    event.preventDefault();if(lock.current||disabled||(!submitted&&!selected))return;
    const input:PartnerBookingMutation|PartnerBookingCreateInput=booking?{action:'reschedule',expectedUpdatedAt:booking.updatedAt,startAt,staffId:staffId||null}:submitted??{source,placeId,serviceId,staffId:needsStaff?staffId:null,startAt,quoteVersion:availability.data!.quoteVersion,requestId:crypto.randomUUID(),customerName,phone,notes};
    if('requestId' in input){setSubmitted(input);drafts.complete(pendingKey,pendingRecord.token,{...pendingRecord,draft:input,state:{kind:'pending'}});}
    lock.current=true;setBusy(true);setError('');controller.current=new AbortController();const timer=setTimeout(()=>controller.current?.abort(),15000);
    try {const result=await writeBookingOperation(`/api/partner/operations/bookings${booking?`/${booking.id}`:''}`,input,controller.current.signal);if('requestId' in input)drafts.complete(pendingKey,pendingRecord.token,{...pendingRecord,draft:null,baseline:null,state:{kind:'saved'}});drafts.discard(inputKey);if(mounted.current)onSaved(result);}
    catch(reason){const code=reason instanceof Error?reason.message:'';const definitive=['INVALID_REQUEST','SLOT_UNAVAILABLE','STALE_SELECTION','BOOKING_UNAVAILABLE'].includes(code);if('requestId' in input)drafts.complete(pendingKey,pendingRecord.token,{...pendingRecord,draft:definitive?null:input,state:{kind:definitive?'idle':'unconfirmed'}});if(mounted.current){setError(code);if(['INVALID_REQUEST','SLOT_UNAVAILABLE','STALE_SELECTION','BOOKING_UNAVAILABLE'].includes(code)){setSubmitted(null);setStartAt('');availability.refresh();resource.refresh();}}}
    finally{clearTimeout(timer);lock.current=false;if(mounted.current)setBusy(false);}
  }
  const locked=busy||!!submitted||disabled;
  return <PartnerDialog title={booking?'예약 시간 변경':'예약 추가'} onClose={closeEditor} busy={busy}><form onSubmit={event=>void submit(event)}><div className="dialog-body"><p className="small muted">{booking?`${booking.customerName} · ${booking.serviceName} · 기존 금액과 시술 시간 유지`:'전화·방문으로 받은 예약을 저장합니다. 예약 시간은 한국 표준시입니다.'}</p>
    {resource.loading&&!resource.data&&<p role="status">메뉴와 담당자를 불러오는 중…</p>}
    {(resource.error||resource.data?.status==='unavailable')&&<p role="alert" className="inline-note">현재 공개된 예약 메뉴를 불러올 수 없습니다. <Button type="button" variant="secondary" className="link" onClick={resource.refresh}>다시 조회</Button></p>}
    {restored&&<p className="notice" role="status">처리 여부가 확인되지 않은 예약 요청을 복원했습니다. 같은 요청으로 결과를 확인해 주세요.</p>}
    <fieldset disabled={locked} className="live-form-fields">
      {!booking&&<><div className="pills"><label className="choice"><input type="radio" name="source" value="phone" checked={source==='phone'} onChange={()=>setSource('phone')}/>전화</label><label className="choice"><input type="radio" name="source" value="walkin" checked={source==='walkin'} onChange={()=>setSource('walkin')}/>방문</label></div><div className="form-grid"><label className="field">고객 이름<input required maxLength={120} value={customerName} onChange={e=>setName(e.target.value)} autoComplete="off"/></label><label className="field">연락처<input required type="tel" maxLength={80} pattern="[+0-9(). \-]+" value={phone} onChange={e=>setPhone(e.target.value)} autoComplete="off"/></label></div><label className="field">메뉴<select required value={serviceId} onChange={e=>{setServiceId(e.target.value);setStaffId('');setStartAt('');}}><option value="">메뉴 선택</option>{catalog?.services.map(s=><option key={s.id} value={s.id}>{s.name} · {s.durationMinutes}분 · {money(s.priceKrw)}</option>)}</select></label></>}
      {needsStaff&&<label className="field">담당자<select required value={staffId} onChange={e=>{setStaffId(e.target.value);setStartAt('');}}><option value="" disabled>담당자 선택</option>{booking?.staffId&&!staff.some(s=>s.id===booking.staffId)&&<option value={booking.staffId}>{booking.staffName}</option>}{staff.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
      <div className="form-grid"><label className="field">날짜<input required type="date" value={date} min={catalog?.startDate} max={catalog?.endDate} onChange={e=>{setDate(e.target.value);setStartAt('');}}/></label><label className="field">예약 가능한 시작 시간<select required value={selected?.startAt??''} disabled={availability.loading||!!availability.error||!availability.data} onChange={e=>setStartAt(e.target.value)}><option value="">{availability.loading?'조회 중…':'시간 선택'}</option>{availability.data?.slots.map(slot=><option key={slot.startAt} value={slot.startAt}>{timeLabel(slot.startAt)}–{timeLabel(slot.serviceEndAt)}</option>)}</select></label></div>
      {needsStaff&&!staffId&&<p className="inline-note">담당자를 선택하면 예약 가능한 시간이 표시됩니다.</p>}
      {availability.error&&<p className="live-error" role="alert">예약 시간을 조회하지 못했습니다. <Button type="button" variant="secondary" className="link" onClick={availability.refresh}>다시 조회</Button></p>}{availability.data&&!availability.data.slots.length&&<p className="inline-note">선택한 날짜에 가능한 시간이 없습니다. 다른 날짜를 선택해 주세요.</p>}
      {selected&&<p className="inline-note">{timeLabel(selected.startAt)}–{timeLabel(selected.serviceEndAt)} · 정리 포함 {timeLabel(selected.occupiedUntil)}까지 · {money(booking?.totalKrw??menu?.priceKrw??0)} 현장 결제</p>}
      {!booking&&<label className="field">요청사항 (선택)<textarea value={notes} maxLength={2000} onChange={e=>setNotes(e.target.value)}/></label>}
    </fieldset>
    {error&&<p className="live-error" role="alert">{error==='SLOT_UNAVAILABLE'?'선택한 시간에 예약할 수 없습니다. 가능한 시간을 다시 선택해 주세요.':error==='STALE_SELECTION'?'메뉴나 일정이 변경됐습니다. 최신 내용을 확인해 주세요.':partnerBookingError(error)}{submitted&&' 처리 여부가 불명확하면 동일한 요청으로 다시 확인합니다.'}</p>}
    </div><div className="dialog-footer"><Button type="button" variant="secondary" disabled={busy} onClick={closeEditor}>닫기</Button><Button variant="primary" type="submit" disabled={busy||disabled||(!submitted&&(!selected||availability.loading||!!availability.error))}>{busy?'저장 중…':submitted?'같은 요청으로 다시 확인':booking?'변경 확정':'예약 추가'}</Button></div></form></PartnerDialog>;
}
