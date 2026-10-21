'use client';
import {Avatar} from '@/components/ui/avatar';
import {Button} from '@/components/ui/button';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { PartnerBooking } from '@/lib/booking/partner-contracts';
import { menuReadiness } from '@/lib/partner/catalog';
import type { Merchant, PartnerSnapshot } from '@/lib/partner/contracts';
import { bookingMetrics,dateLabel,kstDate,money,timeLabel } from '@/lib/partner/dashboard';
import { dashboardWeekBookings, staffDailyUtilization, utilizationTimeLabel } from '@/lib/partner/dashboard-utilization';
import type { StaffCalendar, StaffSummary } from '@/lib/partner/staff-server';
import { usePartnerStaffDirectory } from './use-partner-staff-directory';
import { usePartner } from './partner-provider';
import { usePartnerBookings } from './use-partner-bookings';
import { BookingLoadState,DashboardHeading,Kpi,StatusChip } from './dashboard-widgets';

export const merchantStatus:Record<Merchant['status'],string>={onboarding:'입점 준비 중',active:'운영 승인됨',suspended:'운영 일시 중지',closed:'운영 종료'};
export function PartnerDashboard() {
  const {snapshot,stale,refresh}=usePartner(); const resource=usePartnerBookings(); const staffDirectory=usePartnerStaffDirectory(true);
  const reload=()=>{resource.refresh();void staffDirectory.refresh();void refresh();};
  return snapshot&&<><BookingLoadState loading={resource.loading} error={resource.error} onRefresh={resource.refresh}/><PartnerDashboardView snapshot={snapshot} bookings={resource.data?.bookings??null} staff={stale?null:staffDirectory.directory?.staff??null} staffCalendars={stale?null:staffDirectory.directory?.calendars??null} staffLoading={staffDirectory.loading} staffFailed={stale||staffDirectory.failed} onRefreshStaff={reload}/></>;
}
export function PartnerDashboardView({snapshot,bookings=null,now=Date.now(),staff=null,staffCalendars=null,staffLoading=false,staffFailed=false,onRefreshStaff}:{snapshot:PartnerSnapshot;bookings?:PartnerBooking[]|null;now?:number;staff?:StaffSummary[]|null;staffCalendars?:Record<string,StaffCalendar|null>|null;staffLoading?:boolean;staffFailed?:boolean;onRefreshStaff?:()=>void}) {
  const {merchant,categories,menus,schedule}=snapshot;
  const today=kstDate(now); const daily=bookings?.filter(b=>kstDate(b.startAt)===today)??[]; const metrics=bookingMetrics(daily,now);
  const readyMenus=menus.filter(menu=>!menuReadiness(menu,categories,{paymentMode:merchant.bookingEnabled?'pay_at_venue':undefined}).length).length;
  const steps=[{name:'매장 기본 정보',ready:!!(merchant.displayName.trim()&&merchant.contactEmail.trim()&&merchant.contactPhone.trim()&&merchant.address.trim()&&merchant.businessTypes.length),description:'상호명과 연락처, 주소를 확인해 주세요.',href:'/partner/settings'},
    {name:'서비스 카테고리',ready:categories.some(c=>c.visibility==='visible'&&c.nameKo&&c.nameEn),description:`등록된 카테고리 ${categories.length}개`,href:'/partner/services'},
    {name:'메뉴 공개 준비',ready:readyMenus>0,description:`등록된 메뉴 ${menus.length}개 · 공개 조건 충족 ${readyMenus}개`,href:'/partner/services'},
    {name:'영업 일정',ready:!!schedule?.hours.length,description:'영업시간과 날짜별 휴무를 확인해 주세요.',href:'/partner/availability'}];
  const missingEnglish=menus.filter(m=>m.visibility!=='archived'&&!m.nameEn.trim()).length;
  const requested=bookings?.filter(b=>b.status==='requested').length??0;
  const next=daily.filter(b=>(b.status==='requested'||b.status==='confirmed')&&Date.parse(b.serviceEndAt)>now).sort((a,b)=>Date.parse(a.startAt)-Date.parse(b.startAt)).slice(0,3);
  const week=dashboardWeekBookings(bookings,today); const maximum=Math.max(1,...(week?.days.map(day=>day.total)??[]));
  const staffRows=staff?.filter(person=>person.merchantId===merchant.id&&(person.visibility!=='archived'||daily.some(booking=>booking.staffId===person.id&&booking.status!=='cancelled'))).sort((a,b)=>a.sortOrder-b.sortOrder||a.name.localeCompare(b.name)).map(person=>({person,...staffDailyUtilization({date:today,merchantId:merchant.id,staffId:person.id,shopSchedule:schedule,shopOverrides:snapshot.dateOverrides,staffSchedule:staffCalendars?.[person.id],bookings})}));
  const staffUnknown=staffFailed||!staffRows||staffRows.some(row=>row.scheduleState==='unknown')||!bookings;
  return <>
    <DashboardHeading title={`안녕하세요, ${merchant.displayName||'우리 매장'}`} description={`${dateLabel(today)} · 시간은 서울(KST)`} actions={<span className="status green">{merchantStatus[merchant.status]}</span>}/>
    <section className="kpis panel" aria-label="오늘 요약"><Kpi label="오늘 예약" value={bookings?metrics.count:'—'} unit="건" note="취소 예약 제외" href="/partner/bookings?period=today"/><Kpi label="방문 완료" value={bookings?metrics.completed:'—'} unit="건" note="오늘 방문 완료한 예약" href="/partner/bookings?period=today&status=completed"/><Kpi label="미방문" value={bookings?metrics.noShow:'—'} unit="건" note="오늘 미방문 처리" href="/partner/bookings?period=today&status=no_show"/><Kpi label="현장 결제 예정" value={bookings?metrics.expected.toLocaleString('ko-KR'):'—'} unit="원" note="확인 대기·확정 예약 기준" href="/partner/bookings?period=today"/></section>
    <div className="home-grid"><div className="home-main">
      <section className="panel card"><div className="card-head"><div><h2>할 일</h2><p className="small muted">설정과 예약 상태에서 자동으로 찾은 항목이에요</p></div><span className="status">확인 필요</span></div><ul className="todo">
        {requested>0&&<li><i className="dot"/><div><b>확인을 기다리는 예약 {requested}건</b><small>고객의 요청 내용을 확인하고 예약을 확정해 주세요.</small></div><Button variant="secondary" className="compact" href="/partner/bookings?status=requested">예약 확인</Button></li>}
        {missingEnglish>0&&<li><i className="dot"/><div><b>영문 이름이 없는 메뉴 {missingEnglish}개</b><small>고객이 메뉴를 알아볼 수 있도록 영문 이름을 입력해 주세요.</small></div><Button variant="secondary" className="compact" href="/partner/services">메뉴 편집</Button></li>}
        {steps.filter(s=>!s.ready).map(s=><li key={s.name}><i className="dot"/><div><b>{s.name}</b><small>{s.description}</small></div><Button variant="secondary" className="compact" href={s.href}>설정</Button></li>)}
        {!requested&&!missingEnglish&&steps.every(s=>s.ready)&&<li><i className="dot"/><div><b>설정이 준비됐어요</b><small>새 예약은 예약 목록에서 확인할 수 있어요.</small></div><Button variant="secondary" className="compact" href="/partner/bookings">예약 관리</Button></li>}
      </ul></section>
      <section className="panel card"><div className="card-head"><div><h2>이번 주 예약</h2><p className="small muted">{week?`${week.total}건 · 지난주 ${week.previousTotal}건`:'— · 예약 조회 후 집계'}<br/>취소 제외 · 월요일–일요일</p></div><span className="legend-inline"><i className="sw" style={{'--c':'var(--accent)'} as CSSProperties}/>앱 <i className="sw" style={{'--c':'#b7d6ca'} as CSSProperties}/>전화·방문</span></div>{week?<div className="bars" role="img" aria-label={week.days.map(day=>`${dateLabel(day.date)} 앱 ${day.app}건, 전화·방문 ${day.other}건`).join(', ')}>{week.days.map(day=><div className={`bar-col ${day.date===today?'today':''} ${day.total?'':'zero'}`} key={day.date}><span className="bar-val">{day.total}</span><div className="bar-stack" style={{height:`${day.total/maximum*100}%`}}><i className="s-app" style={{flex:day.app}}/><i className="s-other" style={{flex:day.other}}/></div><span className="bar-lab">{new Intl.DateTimeFormat('ko-KR',{timeZone:'UTC',weekday:'short'}).format(new Date(`${day.date}T00:00:00Z`))}<small>{Number(day.date.slice(8))}</small></span></div>)}</div>:<p className="empty-line">예약 조회 후 집계됩니다.</p>}<Button variant="secondary" className="link" href="/partner/statistics">통계 →</Button></section>
      <section className="panel card" aria-labelledby="staff-today-heading"><div className="card-head"><div><h2 id="staff-today-heading">디자이너별 오늘</h2><p className="small muted">가용 근무시간 대비 예약 점유 · 정리 포함, 취소 제외<br/>매장·담당자의 휴게·차단·예외 일정 반영</p></div><Button variant="secondary" className="link" href="/partner/calendar">캘린더 →</Button></div>
        {snapshot.reservationRules?.mode==='shop'?<p className="empty-line">매장 예약형이라 디자이너별 집계가 없어요. 오늘 예약 {bookings?metrics.count:'—'}건 · 동시 예약 수 {snapshot.reservationRules.capacity}건</p>:!snapshot.reservationRules?<p className="empty-line">예약 방식 설정 후 담당자별 집계를 표시합니다. <Button variant="secondary" className="link" href="/partner/rules">예약 설정 →</Button></p>:<>
          {staffLoading&&<p className="inline-note" role="status">담당자 일정을 확인하고 있습니다…</p>}
          {staffUnknown&&<p className="empty-line" role={staffFailed?'alert':undefined}>— · {staffFailed?'담당자 일정을 불러오지 못했습니다.':'예약과 담당자 일정을 모두 조회하면 비율이 표시됩니다.'} {onRefreshStaff&&<Button type="button" variant="secondary" className="link" disabled={staffLoading} onClick={onRefreshStaff}>다시 조회</Button>}</p>}
          {staffRows?.length?<ul className="util">{staffRows.map(row=><li key={row.person.id}>
            <Avatar name={row.person.name} size={24} aria-hidden={true}/><b>{row.person.name} {row.person.title&&<span className="muted">{row.person.title}</span>}</b>
            <span className="muted">{row.scheduleState==='ready'?utilizationTimeLabel(row.intervals??[]):row.scheduleState==='closed'?'오늘 근무 없음':row.scheduleState==='missing'?'일정 미설정':'일정 조회 필요'}{row.availableMinutes!==null&&<small style={{display:'block'}}>가용 {row.availableMinutes.toLocaleString('ko-KR')}분</small>}</span>
            {row.percentage!==null?<div className="meter" role="meter" aria-label={`${row.person.name} 예약 점유율`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={row.percentage} aria-valuetext={`${row.occupiedMinutes?.toLocaleString('ko-KR')}분 / ${row.availableMinutes?.toLocaleString('ko-KR')}분, ${row.percentage}%`}><i style={{width:`${row.percentage}%`}}/></div>:<span className="muted" aria-label="점유율 계산 불가">—</span>}
            <span className="num">{row.bookingCount??'—'}건 · {row.percentage===null?'—':`${row.percentage}%`}</span>
          </li>)}</ul>:staffRows&&!staffFailed?<p className="empty-line">등록된 담당자가 없습니다. <Button variant="secondary" className="link" href="/partner/staff">담당자 관리 →</Button></p>:null}
          {staffRows?.some(row=>row.scheduleState==='missing')&&<p className="inline-note">근무 일정이 없는 담당자는 점유율을 계산하지 않습니다. <Button variant="secondary" className="link" href="/partner/roster">출근표 설정 →</Button></p>}
        </>}
      </section>
    </div><div className="home-side">
      <section className="panel card"><div className="card-head"><h2>다음 예약</h2><Button href="/partner/bookings" variant="secondary" className="link">예약 관리 →</Button></div>{next.length?<ul className="next">{next.map(b=><li key={b.id}><Link href={`/partner/bookings?booking=${b.id}`} className="next-booking"><span className="ag-time">{timeLabel(b.startAt)}<small>{dateLabel(kstDate(b.startAt))}</small></span><span className="ag-main"><b>{b.customerName}</b> {b.serviceName}<small>{b.staffName||'매장 예약'} · {money(b.totalKrw)}</small></span><StatusChip status={b.status}/></Link></li>)}</ul>:<p className="empty-line">{bookings?'오늘 남은 예약이 없어요.':'예약 조회 후 표시됩니다.'}</p>}</section>
      <section className="panel card"><div className="card-head"><div><h2>접수 준비</h2><p className="small muted">{steps.filter(s=>s.ready).length}/4 완료</p></div></div><ul className="ready">{steps.map(step=><li key={step.name}><i className={step.ready?'ok':''}>{step.ready?'✓':''}</i><span>{step.name}<small className="muted">{step.description}</small></span><Button variant="secondary" className="link compact" href={step.href}>{step.ready?'확인':'설정'} →</Button></li>)}</ul><p className="inline-note">{merchant.bookingEnabled&&merchant.status==='active'?'고객 예약 연결됨':'고객 예약 접수 준비'} · 예약 금액은 매장에서 결제합니다.</p></section>
      <section className="panel card"><div className="card-head"><h2>최근 예약 변경</h2></div><ul className="activity">{[...(bookings??[])].sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt)).slice(0,4).map(b=><li key={b.id}><Link href={`/partner/bookings?booking=${b.id}`}>{b.customerName} · {b.serviceName}</Link><StatusChip status={b.status}/><small className="muted">{dateLabel(kstDate(b.updatedAt))} {timeLabel(b.updatedAt)}</small></li>)}</ul>{bookings?.length===0&&<p className="empty-line">예약이 접수되면 최근 변경이 표시됩니다.</p>}</section>
    </div></div>
  </>;
}
