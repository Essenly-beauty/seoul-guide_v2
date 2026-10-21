import {Button} from '@/components/ui/button';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { BookingStatus } from '@/lib/booking/contracts';
import { bookingStatusLabels, partnerBookingError } from './partner-bookings';
export function DashboardHeading({title,description,actions}:{title:string;description?:string;actions?:ReactNode}) { return <header className="pagehead"><div><h1>{title}</h1>{description&&<p>{description}</p>}</div>{actions&&<div className="row">{actions}</div>}</header>; }
export function StatusChip({status}:{status:BookingStatus}) {return <span className={`status ${status==='confirmed'||status==='completed'?'green':status==='cancelled'?'cancelled':''}`}>{bookingStatusLabels[status]}</span>;}
export function Kpi({label,value,unit='',note,href}:{label:string;value:string|number;unit?:string;note:string;href?:string}) {const content=<><span className="kpi-label">{label}</span><b className="kpi-value">{value}<i>{unit}</i></b><span className="kpi-note">{note}</span></>;return href?<Link className="kpi" href={href}>{content}</Link>:<div className="kpi">{content}</div>;}
export function BookingLoadState({loading,error,onRefresh}:{loading:boolean;error:string;onRefresh:()=>void}) {return error?<div className="notice" role="alert"><p>{partnerBookingError(error)}</p><Button variant="secondary" onClick={onRefresh}>다시 조회</Button></div>:loading?<p className="inline-note" role="status">최신 예약을 확인하고 있습니다…</p>:null;}
export function EmptyPanel({title,children}:{title:string;children?:ReactNode}) {return <div className="ag-empty"><b>{title}</b>{children&&<p>{children}</p>}</div>;}
