'use client';
import { useAuthUser } from '@/lib/auth/use-auth';
import { partnerBookingList, type PartnerBooking } from '@/lib/booking/partner-contracts';
import { record } from '@/lib/partner/contracts';
import { useBookingResource } from '@/components/booking/use-booking-resource';
import { usePartner } from './partner-provider';
export type OperationsSnapshot={bookings:PartnerBooking[];placeId:string|null};
export function operationsSnapshot(value:unknown):value is OperationsSnapshot {
  return record(value)&&partnerBookingList(value.bookings)&&(value.placeId===null||(typeof value.placeId==='string'&&value.placeId.length>0&&value.placeId.length<=200));
}
export function usePartnerBookings() {
  const {user}=useAuthUser();
  const {snapshot,access}=usePartner();
  return useBookingResource(user&&snapshot&&access==='ready'?'/api/partner/operations/bookings':null,operationsSnapshot,`${user?.id??''}:${snapshot?.merchant.id??''}`);
}

import { reservationStaff } from '@/lib/partner/reservation-config';
import type { StaffListSnapshot } from '@/lib/partner/staff-server';
function staffSnapshot(value:unknown):value is {ok:true;snapshot:StaffListSnapshot} {
  if(!record(value)||value.ok!==true||!record(value.snapshot)||!Array.isArray(value.snapshot.staff))return false;
  const snapshot=value.snapshot;
  return typeof snapshot.merchantId==='string'&&typeof snapshot.readOnly==='boolean'&&(snapshot.staff as unknown[]).every(item=>{if(!record(item))return false;const {updatedAt,...profile}=item;return typeof updatedAt==='string'&&reservationStaff({...profile,menuIds:[]});});
}
export function usePartnerStaff() {const {user}=useAuthUser();const {snapshot,access}=usePartner();return useBookingResource(user&&snapshot&&access==='ready'?'/api/partner/staff':null,staffSnapshot,`${user?.id??''}:${snapshot?.merchant.id??''}`);}
