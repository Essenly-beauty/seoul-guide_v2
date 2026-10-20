import type { PartnerBooking } from '@/lib/booking/partner-contracts';
import type { BookingStatus } from '@/lib/booking/contracts';

export type BookingPeriod = 'today' | 'week' | 'month' | 'past' | 'all' | 'custom';
export const kstDate = (value: string | number = Date.now()) => new Date(new Date(value).getTime() + 9*60*60*1000).toISOString().slice(0,10);
export const shiftDate = (date:string,days:number) => new Date(Date.parse(`${date}T00:00:00Z`)+days*86400000).toISOString().slice(0,10);
export const timeLabel = (value:string) => new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value));
export const dateLabel = (date:string) => new Intl.DateTimeFormat('ko-KR',{timeZone:'UTC',month:'long',day:'numeric',weekday:'short'}).format(new Date(`${date}T00:00:00Z`));
export const money = (value:number) => `${value.toLocaleString('ko-KR')}원`;
export const sourceLabels = {app:'앱',phone:'전화',walkin:'방문'} as const;
export function periodBounds(period:BookingPeriod,today:string):[string,string] {
  if(period==='today') return [today,today];
  if(period==='week') { const offset=(new Date(`${today}T00:00:00Z`).getUTCDay()+6)%7; const start=shiftDate(today,-offset); return [start,shiftDate(start,6)]; }
  if(period==='month') { const start=`${today.slice(0,7)}-01`; const next=new Date(`${start}T00:00:00Z`); next.setUTCMonth(next.getUTCMonth()+1); return [start,shiftDate(next.toISOString().slice(0,10),-1)]; }
  return period==='past'?['',shiftDate(today,-1)]:['',''];
}
export function dashboardFilter(bookings:PartnerBooking[],filter:{from:string;until:string;status:BookingStatus|'all';staffId:string;source:string;query:string}) {
  const query=filter.query.trim().toLocaleLowerCase();
  return bookings.filter(b=>{ const day=kstDate(b.startAt); return (!filter.from||day>=filter.from)&&(!filter.until||day<=filter.until)&&(filter.status==='all'||b.status===filter.status)&&(filter.staffId==='all'||b.staffId===filter.staffId)&&(filter.source==='all'||b.source===filter.source)&&(!query||[b.customerName,b.phone,b.serviceName].some(text=>text.toLocaleLowerCase().includes(query))); }).sort((a,b)=>Date.parse(a.startAt)-Date.parse(b.startAt)||a.id.localeCompare(b.id));
}
export function bookingMetrics(bookings:PartnerBooking[],now=Date.now()) {
  const active=bookings.filter(b=>b.status!=='cancelled');
  const completed=bookings.filter(b=>b.status==='completed');
  const past=active.filter(b=>Date.parse(b.startAt)<=now);
  return { count:active.length,completed:completed.length,noShow:bookings.filter(b=>b.status==='no_show').length,cancelled:bookings.filter(b=>b.status==='cancelled').length,
    expected:bookings.filter(b=>b.status==='requested'||b.status==='confirmed').reduce((sum,b)=>sum+b.totalKrw,0),
    completedValue:completed.reduce((sum,b)=>sum+b.totalKrw,0),pastCount:past.length };
}
export function customersFromBookings(bookings:PartnerBooking[]) {
  const customers=new Map<string,{id:string;name:string;phone:string;bookings:PartnerBooking[]}>();
  for(const b of [...bookings].sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt))) {
    // No identity guessing from names/phone; deleted/unidentified bookings remain ungrouped.
    if(!b.customerId) continue;
    const customer=customers.get(b.customerId)??{id:b.customerId,name:b.customerName,phone:b.phone,bookings:[]};
    customer.bookings.push(b); customers.set(b.customerId,customer);
  }
  return [...customers.values()];
}
export function customerHistoryStats(bookings:PartnerBooking[],now=Date.now()) {
  const completed=bookings.filter(b=>b.status==='completed').sort((a,b)=>Date.parse(b.startAt)-Date.parse(a.startAt));
  const favorite=(key:'staffId'|'serviceId')=>{
    const counts=new Map<string,{count:number;booking:PartnerBooking}>();
    for(const booking of completed){const id=booking[key];if(!id)continue;const prior=counts.get(id);counts.set(id,{count:(prior?.count??0)+1,booking:prior?.booking??booking});}
    return [...counts.values()].sort((a,b)=>b.count-a.count)[0]?.booking??null;
  };
  return {visits:completed.length,noShows:bookings.filter(b=>b.status==='no_show').length,
    completedValue:completed.reduce((sum,b)=>sum+b.totalKrw,0),lastVisit:completed[0]??null,
    upcoming:bookings.filter(b=>['requested','confirmed'].includes(b.status)&&Date.parse(b.startAt)>=now).sort((a,b)=>Date.parse(a.startAt)-Date.parse(b.startAt))[0]??null,
    favoriteStaff:favorite('staffId')?.staffName??null,favoriteMenu:favorite('serviceId')?.serviceName??null};
}
