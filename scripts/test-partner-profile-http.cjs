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

 const profilePath='/api/partner/operations/profile';
 const original=await request(profilePath,'partner');
 const publicPath='/api/places/'+original.placeId+'/profile';
 eq((await request(publicPath)).profile.contactPhone,original.profile.contactPhone);
 const instant=p=>({contactPhone:p.contactPhone,contactEmail:p.contactEmail,englishOk:p.englishOk,notice:p.notice});
 let changed=null,reviewId=null,staffOriginal=null,staffChanged=null;
 try {
  changed=await request(profilePath,'partner','PATCH',{action:'update',expectedUpdatedAt:original.profile.updatedAt,values:{...instant(original.profile),notice:'Synthetic local profile QA'}});
  eq((await request(publicPath)).profile.notice,'Synthetic local profile QA');
  if(!original.pendingReview){
   const reviewValues={nameKo:original.profile.nameKo,nameEn:original.profile.nameEn,address:original.profile.address,introductionKo:original.profile.introductionKo,introductionEn:'Synthetic proposed text requiring review'};
   const pending=await request(profilePath,'partner','PATCH',{action:'request_review',expectedUpdatedAt:changed.profile.updatedAt,values:reviewValues});reviewId=pending.pendingReview.id;
   eq(pending.pendingReview.fields.introductionEn,reviewValues.introductionEn);
   eq((await request(publicPath)).profile.introductionEn,original.profile.introductionEn);
   await request(profilePath,'partner','PATCH',{action:'cancel_review',expectedUpdatedAt:pending.profile.updatedAt,reviewId});reviewId=null;
  }
  const catalog=await request('/api/places/'+original.placeId+'/booking');
  if(catalog.staff.length){
   const path='/api/partner/operations/staff/'+catalog.staff[0].id+'/profile';staffOriginal=(await request(path,'partner')).staff;
   const values=({id,updatedAt,...values})=>values;
   staffChanged=(await request(path,'partner','PATCH',{...values(staffOriginal),nameEn:'Local QA English',introductionEn:'Synthetic local English introduction',expectedUpdatedAt:staffOriginal.updatedAt})).staff;
   const translated=await request('/api/places/'+original.placeId+'/booking');
   eq(translated.staff.find(s=>s.id===staffOriginal.id).name,'Local QA English');eq(translated.staff.find(s=>s.id===staffOriginal.id).introduction,'Synthetic local English introduction');
   eq(translated.services[0].quoteVersion===catalog.services[0].quoteVersion,false);
   const legacy=(await request('/api/partner/staff?id='+staffOriginal.id,'partner')).snapshot.staff;eq(legacy.name,staffOriginal.name);eq(legacy.nameEn,undefined);
  }
 }finally{
  if(staffChanged){const path='/api/partner/operations/staff/'+staffChanged.id+'/profile';const latest=(await request(path,'partner')).staff;if(latest.updatedAt===staffChanged.updatedAt){const{id,updatedAt,...values}=staffOriginal;await request(path,'partner','PATCH',{...values,expectedUpdatedAt:latest.updatedAt});}}
  const latest=await request(profilePath,'partner');
  if(reviewId&&latest.pendingReview?.id===reviewId)await request(profilePath,'partner','PATCH',{action:'cancel_review',expectedUpdatedAt:latest.profile.updatedAt,reviewId});
  const restore=await request(profilePath,'partner');if(restore.profile.notice==='Synthetic local profile QA')await request(profilePath,'partner','PATCH',{action:'update',expectedUpdatedAt:restore.profile.updatedAt,values:instant(original.profile)});
 }
 console.log(JSON.stringify({status:'passed',checks,flow:'merchant instant profile → published customer profile; review request stays private → cancel; English staff save → booking catalog/quote; original values restored'}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
