/* End-to-end HTTP round trip against the local app + real local Supabase only. */
const {execFileSync}=require('node:child_process');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const assert=require('node:assert/strict');const{randomUUID}=require('node:crypto');const{createServerClient}=require('@supabase/ssr');
const {isDeepStrictEqual}=require('node:util');
const origin=process.env.BOOKING_TEST_ORIGIN||'http://127.0.0.1:3113';
if(!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw Error('Local app only');
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++};
(async()=>{
 const workdir=process.argv[2];if(!workdir)throw Error('Isolated Supabase workdir required');
 const config=JSON.parse(execFileSync('supabase',['status','--workdir',workdir,'--output','json'],{env:{...process.env,SUPABASE_TELEMETRY_DISABLED:'1'},encoding:'utf8',stdio:['ignore','pipe','pipe']}));
 if(!['127.0.0.1','localhost'].includes(new URL(config.API_URL).hostname))throw Error('Local Supabase only');
 const access=JSON.parse(fs.readFileSync(path.join(os.tmpdir(),'myseouldrop-booking-local-access.json'),'utf8'));
 const jars={};for(const kind of ['customer','partner']){const jar=new Map();const client=createServerClient(config.API_URL,config.ANON_KEY,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:items=>items.forEach(({name,value})=>jar.set(name,value))}});const result=await client.auth.signInWithPassword({email:access[kind].email,password:access[kind].password});if(result.error)throw Error('Local test sign-in failed');jars[kind]=jar;}
 const request=async(url,kind,method='GET',body,status=200)=>{const cookie=kind?[...jars[kind]].map(([n,v])=>`${n}=${v}`).join('; '):'';const r=await fetch(origin+url,{method,headers:{cookie,origin,'content-type':'application/json'},body:body?JSON.stringify(body):undefined,redirect:'manual'});const value=await r.json();assert.equal(r.status,status,`${method} ${url}: ${r.status} ${JSON.stringify(value)}`);checks++;eq(r.headers.get('cache-control').includes('no-store'),true);return value};

 const ops='/api/partner/operations/bookings';
 await request(ops,null,'GET',undefined,401);await request(ops,'customer','GET',undefined,403);
 const initial=await request(ops,'partner');eq(initial.placeId,'myseouldrop-booking-studio');
 const place='/api/places/'+initial.placeId;
 const catalog=await request(place+'/booking');eq(catalog.status,'available');
 const service=catalog.services[0],staffId=catalog.selectionMode==='staff'?catalog.staff.find(s=>s.serviceIds.includes(service.id)).id:null;
 const day=new Date(Date.now()+6*86400000+9*3600000).toISOString().slice(0,10);
 const params=new URLSearchParams({serviceId:service.id,date:day});if(staffId)params.set('staffId',staffId);
 const available=await request(place+'/availability?'+params);assert(available.slots.length>2);checks++;
 const input={placeId:initial.placeId,serviceId:service.id,staffId,startAt:available.slots[0].startAt,quoteVersion:available.quoteVersion,requestId:randomUUID(),customerName:'Local operations QA',phone:'+82 10 0000 0001',notes:'Synthetic local operations check; no external messages or real appointment.'};
 let app=null,offline=null,noteOriginal=null,noteSaved=null;
 try {
  app=(await request('/api/bookings','customer','POST',input,201)).booking;
  const partnerApp=(await request(ops+'/'+app.id,'partner')).booking;eq(partnerApp.source,'app');eq(typeof partnerApp.customerId,'string');eq(partnerApp.serviceId,service.id);
  const confirm=(await request(ops+'/'+app.id,'partner','PATCH',{action:'confirm',expectedUpdatedAt:partnerApp.updatedAt})).booking;
  const moveParams=new URLSearchParams({date:day});if(staffId)moveParams.set('staffId',staffId);
  const moves=await request(ops+'/'+app.id+'/availability?'+moveParams,'partner');eq(moves.slots.some(s=>s.startAt===app.startAt),true);
  const newTime=moves.slots.at(-1).startAt;
  const moved=(await request(ops+'/'+app.id,'partner','PATCH',{action:'reschedule',expectedUpdatedAt:confirm.updatedAt,startAt:newTime,staffId})).booking;
  eq(moved.totalKrw,app.totalKrw);eq(Date.parse(moved.serviceEndAt)-Date.parse(moved.startAt),Date.parse(app.serviceEndAt)-Date.parse(app.startAt));
  eq((await request('/api/bookings/'+app.id,'customer')).booking.startAt,moved.startAt);
  await request(ops+'/'+app.id,'partner','PATCH',{action:'cancel',expectedUpdatedAt:confirm.updatedAt,cancelReason:'stale'},409);
  const offlineInput={...input,requestId:randomUUID(),source:'phone'};
  offline=(await request(ops,'partner','POST',offlineInput,201)).booking;eq(offline.status,'confirmed');eq(offline.source,'phone');eq(offline.paymentMode,'pay_at_venue');
  eq((await request(ops,'partner','POST',offlineInput,201)).booking.id,offline.id);
  await request('/api/bookings/'+offline.id,'customer','GET',undefined,404);
  const offlineThread=await request(ops+'/'+offline.id+'/messages','partner');eq(offlineThread.availability,'unavailable');
  const cancelled=(await request(ops+'/'+offline.id,'partner','PATCH',{action:'cancel',expectedUpdatedAt:offline.updatedAt,cancelReason:'Synthetic local QA completed'})).booking;eq(cancelled.cancelReason,'Synthetic local QA completed');
  const customerMessages='/api/bookings/'+app.id+'/messages',partnerMessages=ops+'/'+app.id+'/messages';
  const message={requestId:randomUUID(),body:'Synthetic local customer message for API verification.'};
  const sent=await request(customerMessages,'customer','POST',message,201);eq(sent.messages.at(-1).sender,'customer');
  eq((await request(customerMessages,'customer','POST',message,201)).messages.length,sent.messages.length);
  const thread=(await request('/api/partner/operations/messages','partner')).threads.find(t=>t.bookingId===app.id);eq(thread.unreadCount,1);
  const read=await request(partnerMessages,'partner','PATCH',{readAt:sent.messages.at(-1).createdAt});eq(read.readState.customerReadAt,null);
  eq((await request('/api/partner/operations/messages','partner')).threads.find(t=>t.bookingId===app.id).unreadCount,0);
  const reply=await request(partnerMessages,'partner','POST',{requestId:randomUUID(),body:'Synthetic local merchant reply; no external delivery.'},201);eq(reply.messages.at(-1).sender,'merchant');
  eq((await request(customerMessages,'customer')).messages.length,2);
  const notePath='/api/partner/operations/customers/'+partnerApp.customerId;
  noteOriginal=(await request(notePath,'partner')).customer;
  noteSaved=(await request(notePath,'partner','PATCH',{notes:'Synthetic QA note',expectedUpdatedAt:noteOriginal.updatedAt})).customer;
  eq(noteSaved.notes,'Synthetic QA note');
  await request(notePath,'partner','PATCH',{notes:'Stale note',expectedUpdatedAt:noteOriginal.updatedAt},409);
  const exported=await request('/api/account/export','customer');eq(exported.bookingMessages.filter(m=>m.bookingId===app.id).length,2);eq(exported.customerNotes.find(n=>n.id===partnerApp.customerId).notes,'Synthetic QA note');
 } finally {
  if(noteSaved)await request('/api/partner/operations/customers/'+noteSaved.id,'partner','PATCH',{notes:noteOriginal.notes,expectedUpdatedAt:noteSaved.updatedAt});
  for(const b of [app,offline])if(b){const latest=(await request(ops+'/'+b.id,'partner')).booking;if(['requested','confirmed'].includes(latest.status))await request(ops+'/'+b.id,'partner','PATCH',{action:'cancel',expectedUpdatedAt:latest.updatedAt,cancelReason:'Synthetic local QA completed'});}
 }
 console.log(JSON.stringify({status:'passed',checks,flow:'app booking → partner confirm/reschedule → customer sees move → offline creation/idempotency/cancel reason → two-party in-app messages/read receipt → customer note/version/export',saved:'Cancelled local QA bookings and synthetic local message history retained; customer note restored.'}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
