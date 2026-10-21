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
 const base='/api/places/myseouldrop-booking-studio';
 await request('/api/bookings',null,'GET',undefined,401);
 await request('/api/partner/bookings','customer','GET',undefined,403);
 let catalog=await request(base+'/booking');eq(catalog.status,'available');eq(catalog.mode,'request');
 const serviceId=catalog.services[0].id,staffId=catalog.staff[0].id;
 const initial=(await request('/api/partner','partner')).snapshot;let menu=initial.menus.find(m=>m.id===serviceId);let restoreNeeded=false,created=null;
 // Exercise the real administrator endpoints, not direct fixture SQL.
 const staffSnapshot=(await request('/api/partner/staff?id='+staffId,'partner')).snapshot;
 const staffValues=st=>({name:st.name,title:st.title,introduction:st.introduction,visibility:st.visibility,sortOrder:st.sortOrder});
 let staffEdited=false;
 try {
  await request('/api/partner/staff','partner','POST',{kind:'staff',mode:'update',id:staffId,expectedUpdatedAt:staffSnapshot.staff.updatedAt,values:{...staffValues(staffSnapshot.staff),name:staffSnapshot.staff.name+' · HTTP check'}});staffEdited=true;
  eq((await request(base+'/booking')).staff.find(s=>s.id===staffId).name,staffSnapshot.staff.name+' · HTTP check');
 } finally {
  if(staffEdited){const latest=(await request('/api/partner/staff?id='+staffId,'partner')).snapshot.staff;
   if(latest.name===staffSnapshot.staff.name+' · HTTP check')await request('/api/partner/staff','partner','POST',{kind:'staff',mode:'update',id:staffId,expectedUpdatedAt:latest.updatedAt,values:{...staffValues(latest),name:staffSnapshot.staff.name}});
  }
 }
 const testDay=new Date(Date.now()+6*86400000+9*3600000).toISOString().slice(0,10);
 const originalOverrides=initial.schedule.overrides ?? initial.dateOverrides ?? [];
 const alteredOverrides=[...originalOverrides.filter(o=>o.date!==testDay),{date:testDay,hours:[{startMinute:840,endMinute:1080}],breaks:[]}];
 let scheduleEdited=false;
 try {
  await request('/api/partner','partner','POST',{kind:'dateOverrides',mode:'update',expectedUpdatedAt:initial.schedule.updatedAt,values:{overrides:alteredOverrides}});scheduleEdited=true;
  const params=new URLSearchParams({serviceId,staffId,date:testDay});const updatedTimes=await request(base+'/availability?'+params);
  assert(updatedTimes.slots.length);checks++;eq(new Date(updatedTimes.slots[0].startAt).toISOString().slice(11,16),'05:00');
 } finally {
  if(scheduleEdited){const latest=(await request('/api/partner','partner')).snapshot;
   const currentOverrides=latest.schedule.overrides ?? latest.dateOverrides ?? [];
   if(isDeepStrictEqual(currentOverrides,alteredOverrides))await request('/api/partner','partner','POST',{kind:'dateOverrides',mode:'update',expectedUpdatedAt:latest.schedule.updatedAt,values:{overrides:originalOverrides}});
  }
 }
 catalog=await request(base+'/booking');
 const menuValues=m=>({categoryId:m.categoryId,nameKo:m.nameKo,nameEn:m.nameEn,descriptionKo:m.descriptionKo,descriptionEn:m.descriptionEn,priceKrw:m.priceKrw,durationMinutes:m.durationMinutes,cleanupMinutes:m.cleanupMinutes,visibility:m.visibility,sortOrder:m.sortOrder});
 try{
 await request('/api/partner','partner','POST',{kind:'menu',mode:'update',id:menu.id,expectedUpdatedAt:menu.updatedAt,values:{...menuValues(menu),priceKrw:menu.priceKrw+1000}});restoreNeeded=true;
 const current=await request(base+'/booking');eq(current.services.find(s=>s.id===serviceId).priceKrw,menu.priceKrw+1000);eq(current.services[0].quoteVersion===catalog.services[0].quoteVersion,false);
 const day=new Date(Date.now()+6*86400000+9*3600000).toISOString().slice(0,10);
 const params=new URLSearchParams({serviceId,staffId,date:day});const availability=await request(base+'/availability?'+params);assert(availability.slots.length);checks++;
 const input={placeId:'myseouldrop-booking-studio',serviceId,staffId,startAt:availability.slots[0].startAt,quoteVersion:catalog.services.find(s=>s.id===serviceId).quoteVersion,requestId:randomUUID(),customerName:'Local integration check',phone:'+82 10 0000 0000',notes:'Automated local integration test. No real appointment or message.'};
 const stale=await request('/api/bookings','customer','POST',input,409);eq(stale.code,'STALE_SELECTION');
 input.quoteVersion=availability.quoteVersion;input.requestId=randomUUID();
 created=(await request('/api/bookings','customer','POST',input,201)).booking;eq(created.status,'requested');eq(created.totalKrw,menu.priceKrw+1000);eq(created.staffName,catalog.staff[0].name);
 eq((await request('/api/bookings','customer','POST',input,201)).booking.id,created.id);
 eq((await request('/api/partner/bookings','partner')).bookings.find(b=>b.id===created.id).status,'requested');
 const confirmed=(await request('/api/partner/bookings/'+created.id,'partner','PATCH',{action:'confirm',expectedUpdatedAt:created.updatedAt})).booking;eq(confirmed.status,'confirmed');
 eq((await request('/api/bookings/'+created.id,'customer')).booking.status,'confirmed');
 const cancelled=(await request('/api/bookings/'+created.id,'customer','PATCH',{action:'cancel'})).booking;eq(cancelled.status,'cancelled');eq(cancelled.cancelledBy,'customer');
 eq((await request('/api/partner/bookings','partner')).bookings.find(b=>b.id===created.id).status,'cancelled');
 const exported=await request('/api/account/export','customer');eq(exported.bookings.some(b=>b.id===created.id),true);
 const partnerExport=await request('/api/account/export','partner');eq(partnerExport.bookings.some(b=>b.id===created.id),false);
 const released=await request(base+'/availability?'+params);eq(released.slots.some(s=>s.startAt===created.startAt),true);

 }finally{
 if(created){const latest=(await request('/api/bookings/'+created.id,'customer')).booking;if(['requested','confirmed'].includes(latest.status))await request('/api/bookings/'+created.id,'customer','PATCH',{action:'cancel'});}
 if(restoreNeeded){const latest=(await request('/api/partner','partner')).snapshot.menus.find(m=>m.id===menu.id);if(latest.priceKrw===menu.priceKrw+1000)await request('/api/partner','partner','POST',{kind:'menu',mode:'update',id:menu.id,expectedUpdatedAt:latest.updatedAt,values:{...menuValues(latest),priceKrw:menu.priceKrw}});}
 } console.log(JSON.stringify({status:'passed',checks,bookingId:created.id,flow:'admin staff + calendar + price edits → customer catalog/slots → request → admin confirm → customer cancel → admin list → slot reopened',saved:'Cancelled test booking retained as a local audit example'}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
