'use client';

import { useCallback, useEffect, useState } from 'react';
import { record, timestamp } from '@/lib/partner/contracts';
import { reservationSchedule } from '@/lib/partner/reservation-calendar';
import { reservationStaff } from '@/lib/partner/reservation-config';
import type { StaffCalendar, StaffDetail, StaffSummary } from '@/lib/partner/staff-server';
import { PartnerRequestScope, usePartner } from './partner-provider';

type Directory = { merchantId: string; staff: StaffSummary[]; details: Record<string, StaffDetail>; calendars: Record<string, StaffCalendar | null> };

/** Shared read-only directory; incomplete menu links remain unknown rather than showing a false empty list. */
export function usePartnerStaffDirectory(includeMenuLinks = false) {
  const { snapshot, refresh: refreshPartner } = usePartner();
  const merchantId = snapshot?.merchant.id;
  const [requests] = useState(() => new PartnerRequestScope());
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => requests.runRead(async (request) => {
    if (!merchantId) return null;
    setLoading(true); setFailed(false);
    const read = async (id?: string) => {
      const response = await fetch(`/api/partner/staff${id ? `?id=${encodeURIComponent(id)}` : ''}`, { credentials: 'same-origin', cache: 'no-store', signal: request.controller.signal });
      const body: unknown = await response.json();
      if (!request.isCurrent()) throw new Error('cancelled');
      if (response.status === 401 || response.status === 403) { setDirectory(null); void refreshPartner(); throw new Error('access'); }
      if (!response.ok || !record(body) || body.ok !== true || !record(body.snapshot) || body.snapshot.merchantId !== merchantId) throw new Error('unavailable');
      return body.snapshot;
    };
    try {
      const list = await read();
      if (!Array.isArray(list.staff)) throw new Error('invalid');
      const staff: StaffSummary[] = list.staff.map((person: unknown) => {
        if (!record(person) || !timestamp(person.updatedAt)) throw new Error('invalid');
        const { updatedAt, ...profile } = person;
        if (!reservationStaff({ ...profile, menuIds: [] }) || profile.merchantId !== merchantId) throw new Error('invalid');
        return { ...profile, updatedAt } as StaffSummary;
      });
      const details: Record<string, StaffDetail> = {};
      const calendars: Record<string, StaffCalendar | null> = {};
      if (includeMenuLinks) {
        const pending = [...staff];
        const results = await Promise.allSettled(Array.from({ length: Math.min(4, staff.length) }, async () => {
          for (;;) {
            const person = pending.shift(); if (!person || !request.isCurrent()) return;
            const fresh = await read(person.id);
            if (!record(fresh.staff) || !timestamp(fresh.staff.updatedAt)) throw new Error('invalid');
            const { updatedAt, ...profile } = fresh.staff;
            if (!reservationStaff(profile) || profile.merchantId !== merchantId || profile.id !== person.id) throw new Error('invalid');
            details[person.id] = { ...profile, updatedAt };
            if (fresh.schedule === null) calendars[person.id] = null;
            else {
              if (!record(fresh.schedule)) throw new Error('invalid');
              const { staffId, updatedAt: scheduleVersion, ...calendar } = fresh.schedule;
              if (staffId !== person.id || !timestamp(scheduleVersion) || !reservationSchedule(calendar) || calendar.merchantId !== merchantId) throw new Error('invalid');
              calendars[person.id] = { ...calendar, staffId, updatedAt: scheduleVersion };
            }
          }
        }));
        if (results.some((result) => result.status === 'rejected')) throw new Error('partial');
      }
      if (request.isCurrent()) setDirectory({ merchantId, staff, details, calendars });
    } catch { if (request.isCurrent()) { setDirectory(null); setFailed(true); } }
    finally { if (request.isCurrent()) setLoading(false); }
    return null;
  }, null), [merchantId, includeMenuLinks, requests, refreshPartner]);
  useEffect(() => {
    requests.activate(); void load();
    const refreshVisible = () => { if (document.visibilityState === 'visible') void load(); };
    window.addEventListener('focus', refreshVisible);
    document.addEventListener('visibilitychange', refreshVisible);
    return () => { requests.dispose(); window.removeEventListener('focus', refreshVisible); document.removeEventListener('visibilitychange', refreshVisible); };
  }, [load, requests]);
  return { directory: directory?.merchantId === merchantId ? directory : null, loading, failed, refresh: load };
}
