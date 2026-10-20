import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {load} from 'cheerio';
import type {PartnerBooking} from '@/lib/booking/partner-contracts';
import {bookingMetrics,customerHistoryStats,customersFromBookings,dashboardFilter,kstDate,periodBounds,shiftDate} from './dashboard';
import {calendarBounds,calendarEventLanes,calendarPoint,PartnerCalendarView} from '@/components/partner/partner-calendar-view';
import type {PartnerSnapshot} from './contracts';
const staffId='11111111-1111-4111-8111-111111111111';
const customerId='22222222-2222-4222-8222-222222222222';
const base:PartnerBooking={id:'33333333-3333-4333-8333-333333333333',placeId:'studio',merchantName:'Studio',serviceName:'Cut',staffName:'Min',startAt:'2026-10-20T01:00:00Z',serviceEndAt:'2026-10-20T02:00:00Z',totalKrw:60000,status:'confirmed',paymentMode:'pay_at_venue',customerName:'Alex',phone:'010-1234-5678',notes:'',createdAt:'2026-10-19T00:00:00Z',updatedAt:'2026-10-19T00:00:00Z',cancelledBy:null,serviceId:'44444444-4444-4444-8444-444444444444',staffId,customerId,occupiedUntil:'2026-10-20T02:15:00Z',source:'app',cancelReason:''};
const b=(id:string,values:Partial<PartnerBooking>={}):PartnerBooking=>({...base,id,...values});
describe('live dashboard data semantics',()=>{
 it('uses completed visits for preferences and ignores cancelled or past appointments for the next booking',()=>{
   const rows=[b('done',{status:'completed',startAt:'2026-10-18T01:00:00Z'}),b('cancel',{status:'cancelled',startAt:'2026-10-21T00:00:00Z',staffName:'Other'}),b('past',{startAt:'2026-10-19T01:00:00Z'}),b('later',{startAt:'2026-10-23T01:00:00Z'}),b('next',{status:'requested',startAt:'2026-10-22T01:00:00Z'})];
   const result=customerHistoryStats(rows,Date.parse('2026-10-20T00:00:00Z'));
   expect(result.visits).toBe(1);expect(result.completedValue).toBe(60000);expect(result.lastVisit?.id).toBe('done');expect(result.upcoming?.id).toBe('next');expect(result.favoriteStaff).toBe('Min');expect(result.favoriteMenu).toBe('Cut');
 });
 it('uses Korean business day at the UTC boundary',()=>{expect(kstDate('2026-10-19T14:59:59Z')).toBe('2026-10-19');expect(kstDate('2026-10-19T15:00:00Z')).toBe('2026-10-20');});
 it('derives Monday weeks across years and actual leap months',()=>{expect(periodBounds('week','2027-01-01')).toEqual(['2026-12-28','2027-01-03']);expect(periodBounds('month','2028-02-22')).toEqual(['2028-02-01','2028-02-29']);expect(shiftDate('2026-12-31',1)).toBe('2027-01-01');expect(periodBounds('past','2026-10-20')).toEqual(['','2026-10-19']);});
 it('keeps future receivables separate from completed service value',()=>{const data=[b('1'),b('2',{status:'requested'}),b('3',{status:'completed'}),b('4',{status:'cancelled',cancelledBy:'customer'}),b('5',{status:'no_show'})];expect(bookingMetrics(data,Date.parse('2026-10-21T00:00:00Z'))).toEqual({count:4,completed:1,noShow:1,cancelled:1,expected:120000,completedValue:60000,pastCount:4});});
 it('combines date/status/staff/source and case-insensitive search',()=>{const data=[b('a'),b('b',{source:'phone'}),b('c',{customerName:'JANE'}),b('d',{startAt:'2026-10-19T00:00:00Z'})];expect(dashboardFilter(data,{from:'2026-10-20',until:'2026-10-20',status:'confirmed',staffId,source:'app',query:'alex'}).map(row=>row.id)).toEqual(['a']);});
 it('groups by private stable customer ID, never shared name or phone',()=>{const data=[b('a'),b('b',{customerId:'another',customerName:'Alex'}),b('c',{customerId:null}),b('d',{customerName:'New name',updatedAt:'2026-10-20T00:00:00Z'})];const customers=customersFromBookings(data);expect(customers).toHaveLength(2);expect(customers.find(c=>c.id===customerId)?.name).toBe('New name');expect(customers.find(c=>c.id===customerId)?.bookings.map(row=>row.id)).toEqual(['d','a']);});
 it('does not mutate the source while filtering/grouping',()=>{const data=Object.freeze([Object.freeze(b('b')),Object.freeze(b('a'))]);expect(()=>customersFromBookings(data as unknown as PartnerBooking[])).not.toThrow();expect(data.map(row=>row.id)).toEqual(['b','a']);});
});
describe('calendar interactions and display',()=>{
 it('keeps early exceptions and midnight cleanup visible across the whole displayed week',()=>{
   const snapshot={schedule:{hours:[]},dateOverrides:[{date:'2026-10-21',hours:[{startMinute:360,endMinute:720}],breaks:[]}]} as unknown as PartnerSnapshot;
   const late=b('late',{startAt:'2026-10-23T14:00:00Z',serviceEndAt:'2026-10-23T14:45:00Z',occupiedUntil:'2026-10-23T15:00:00Z'});
   expect(calendarBounds(['2026-10-20','2026-10-21','2026-10-23'],[late],snapshot)).toEqual({start:360,end:1440});
   expect(calendarBounds(['2026-10-20'],[late],snapshot)).toEqual({start:480,end:1200});
 });
 it('rounds a drop to the grid and keeps it inside the visible day',()=>{expect(calendarPoint('2026-10-20',staffId,-100,480,1200,1.2).startAt).toBe('2026-10-20T08:00:00+09:00');expect(calendarPoint('2026-10-20',staffId,9999,480,1200,1.2).startAt).toBe('2026-10-20T19:30:00+09:00');expect(calendarPoint('2026-10-20',staffId,180,480,1200,1.2).startAt).toBe('2026-10-20T10:30:00+09:00');});
 it('lays out overlaps separately until cleanup ends, then reuses lanes',()=>{const data=[b('a'),b('b',{startAt:'2026-10-20T02:00:00Z',serviceEndAt:'2026-10-20T03:00:00Z',occupiedUntil:'2026-10-20T03:00:00Z'}),b('c',{startAt:'2026-10-20T03:00:00Z',serviceEndAt:'2026-10-20T04:00:00Z',occupiedUntil:'2026-10-20T04:00:00Z'})];const lanes=calendarEventLanes(data);expect(lanes.get('a')).toEqual({lane:0,count:2});expect(lanes.get('b')).toEqual({lane:1,count:2});expect(lanes.get('c')).toEqual({lane:0,count:1});});
 it('renders actual staff calendars without passing DB metadata into strict schedule validators',()=>{const merchantId='55555555-5555-4555-8555-555555555555';const schedule={merchantId,hours:[{weekday:2,startMinute:600,endMinute:1080}],breaks:[],blocks:[],updatedAt:base.createdAt};const snapshot:PartnerSnapshot={merchant:{id:merchantId,displayName:'Studio',contactEmail:'',contactPhone:'',address:'',businessTypes:['hair'],status:'active',bookingEnabled:true,updatedAt:base.createdAt},categories:[],menus:[],schedule,reservationRules:{merchantId,mode:'staff',capacity:2,startDate:'2026-10-20',endDate:'2026-11-20',minimumLeadMinutes:60,slotIntervalMinutes:30,updatedAt:base.createdAt},dateOverrides:[],readOnly:false,loadedAt:base.createdAt};
 const staff={id:staffId,merchantId,name:'Min',title:'Stylist',introduction:'',visibility:'visible' as const,sortOrder:0,updatedAt:base.createdAt};
 const $=load(renderToStaticMarkup(<PartnerCalendarView bookings={[base]} staff={[staff]} snapshot={snapshot} staffCalendars={{[staffId]:{...schedule,staffId,overrides:[]}}} date="2026-10-20" onDate={()=>{}} onSelect={()=>{}} onBlank={()=>{}} onMove={()=>{}} disabled={false}/>));expect($('[data-calendar-booking]').length).toBe(1);expect($.text()).toContain('10:00–11:00');expect($('.live-calendar-closed').length).toBeGreaterThan(0);expect($('.live-cleanup').text()).toBe('정리');expect($('[aria-label="캘린더 보기"] button').length).toBe(3);
 });
});
