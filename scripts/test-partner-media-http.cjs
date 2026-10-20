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

 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aOWQAAAAASUVORK5CYII=','base64');
 const mediaPath='/api/partner/operations/media';
 const initial=await request('/api/partner/operations/profile','partner');
 await request(mediaPath,null,'GET',undefined,401);await request(mediaPath,'customer','GET',undefined,403);
 const staffId=randomUUID(),staffPath='/api/partner/operations/staff/'+staffId+'/profile';
 let staff=null;const uploads=[];
 const upload=async(kind,targetId,requestId=randomUUID())=>{
  const form=new FormData();form.set('targetKind',kind);form.set('targetId',targetId||'');form.set('requestId',requestId);form.set('file',new File([png],'synthetic-qa.png',{type:'image/png'}));
  const cookie=[...jars.partner].map(([n,v])=>`${n}=${v}`).join('; ');const response=await fetch(origin+mediaPath,{method:'POST',headers:{cookie,origin},body:form});
  const json=await response.json();assert.equal(response.status,201,JSON.stringify(json));checks++;return json.media;
 };
 const image=async(url,kind,status=200)=>{const cookie=kind?[...jars[kind]].map(([n,v])=>`${n}=${v}`).join('; '):'';const response=await fetch(origin+url,{headers:{cookie}});eq(response.status,status);if(status===200){eq(response.headers.get('content-type'),'image/webp');eq(Buffer.from(await response.arrayBuffer()).subarray(0,4).toString(),'RIFF');}};
 try{
  staff=(await request(staffPath,'partner','POST',{name:'Local media QA',title:'Synthetic',introduction:'Local synthetic test only',visibility:'visible',sortOrder:9999,nameEn:'Local media QA',introductionEn:''},201)).staff;
  const requestId=randomUUID();const active=await upload('staff',staffId,requestId);uploads.push(active);eq(active.status,'active');eq(active.width,1);eq(active.height,1);
  eq((await upload('staff',staffId,requestId)).id,active.id);
  await image(active.url,'partner');await image(active.url,null,401);
  const publicList=await request('/api/places/'+initial.placeId+'/media');const publicMedia=publicList.media.find(m=>m.id===active.id);assert(publicMedia);checks++;await image(publicMedia.url);
  const pending=await upload('store',null);uploads.push(pending);eq(pending.status,'pending');await image(pending.url,'partner');
  eq((await request('/api/places/'+initial.placeId+'/media')).media.some(m=>m.id===pending.id),false);
  await image('/api/places/'+initial.placeId+'/media/'+pending.id,null,404);
  eq((await request(mediaPath+'?targetKind=staff&targetId='+staffId,'partner')).media.some(m=>m.id===active.id),true);
  await request(mediaPath+'/'+active.id,'partner','DELETE',{expectedUpdatedAt:active.updatedAt});uploads.splice(uploads.findIndex(m=>m.id===active.id),1);
  await image(publicMedia.url,null,404);
 }finally{
  for(const media of uploads)await request(mediaPath+'/'+media.id,'partner','DELETE',{expectedUpdatedAt:media.updatedAt});
  if(staff){const latest=(await request(staffPath,'partner')).staff;const{id,updatedAt,...values}=latest;await request(staffPath,'partner','PATCH',{...values,visibility:'archived',expectedUpdatedAt:updatedAt});}
 }
 console.log(JSON.stringify({status:'passed',checks,flow:'real PNG upload → metadata-stripped WebP storage → merchant preview → public staff image → idempotent retry → pending store hidden → versioned deletion removes object',saved:'Uploaded QA objects deleted; synthetic staff archived.'}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
