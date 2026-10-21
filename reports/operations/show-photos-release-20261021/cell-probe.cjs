'use strict';
// C4 전용(로컬 리허설 DB, 운영과 무관): node cell-probe.cjs --expect=pre|post <out.json>
// 합성 매장·멤버십·게시를 만들어 RPC의 실제 응답을 받고(파트너 조회, M이 보내는 즉시 필드 저장, 공개 조회) 트랜잭션은 전부 롤백한다.
// 그 응답을 M과 main의 실제 파서(esbuild 번들)로 검사해 호환 표의 셀을 실행 증거로 남긴다.
//   --expect=pre  (적용 전): C 셀(M)과 A 셀(main) 모두 통과해야 한다.
//   --expect=post (적용 후): D 셀(M)은 통과, B 셀(main)은 실패해야 한다.
const fs=require('node:fs'),assert=require('node:assert/strict');
const OPS='/Users/hanmyeong-gwan/myseouldrop-ops/show-photos',RUN=OPS+'/run',W=OPS+'/integrate';
const args=process.argv.slice(2);
const expect=(args.find(a=>a.startsWith('--expect='))||'').slice('--expect='.length);
const out=args.find(a=>!a.startsWith('--'));
if(!['pre','post'].includes(expect)||!out)throw Error('usage: cell-probe.cjs --expect=pre|post <out.json>');
if(fs.existsSync(out))throw Error('Output exists, choose a new name: '+out);
const name=fs.readFileSync(OPS+'/rehearsal-db-name','utf8').trim();
if(!/^booking_release_rehearsal_[0-9]+$/.test(name))throw Error('Wrong rehearsal database');
const {Client}=require(W+'/node_modules/pg');
const parsers={M:require(RUN+'/probe/contracts-M.cjs'),main:require(RUN+'/probe/contracts-main.cjs')};
const ids={user:'b2000000-0000-4000-8000-000000000001',merchant:'b2000000-0000-4000-8000-000000000002'},place='show-photos-probe';
const c=new Client({host:'127.0.0.1',port:54382,user:'postgres',password:process.env.REHEARSAL_PGPASSWORD||'postgres',database:name,application_name:'myseouldrop-show-photos-probe'});
(async()=>{
 await c.connect();
 const seen={};
 try{
  await c.query('begin');
  assert.equal((await c.query('select current_database() as d')).rows[0].d,name);
  seen.showPhotosColumn=(await c.query("select count(*)::int as n from pg_attribute where attrelid='public.merchant_store_profiles'::regclass and attname='show_photos' and not attisdropped")).rows[0].n===1;
  await c.query("insert into auth.users(id,aud,role,email) values($1,'authenticated','authenticated','probe@show-photos.invalid')",[ids.user]);
  await c.query("insert into public.merchants(id,display_name,contact_phone,contact_email,address,status) values($1,'사진 스위치 점검 매장','02-000-0000','probe@show-photos.invalid','서울 성동구','active')",[ids.merchant]);
  await c.query('insert into public.merchant_memberships(merchant_id,user_id) values($1,$2)',[ids.merchant,ids.user]);
  await c.query("insert into public.merchant_store_profiles(merchant_id,name_en,english_ok,notice) values($1,'Show photos probe',true,'probe')",[ids.merchant]);
  await c.query('insert into public.merchant_publications(merchant_id,place_id,published) values($1,$2,true)',[ids.merchant,place]);
  await c.query("select set_config('request.jwt.claim.sub',$1,true)",[ids.user]);
  await c.query('set local role authenticated');
  seen.partnerGet=(await c.query('select public.partner_store_profile() as v')).rows[0].v;
  seen.publicGet=(await c.query('select public.public_store_profile($1) as v',[place])).rows[0].v;
  // The instant-field save M sends: storeInstantDraft carries showPhotos only when the server reported it (4 keys before, 5 after).
  seen.draft=parsers.M.storeInstantDraft(seen.partnerGet);
  seen.partnerSave=(await c.query("select public.partner_store_profile('update',$1::timestamptz,$2::jsonb) as v",
   [seen.partnerGet.profile.updatedAt,JSON.stringify(seen.draft)])).rows[0].v;
 }finally{await c.query('rollback').catch(()=>{});await c.end().catch(()=>{});}
 const verdict={};
 for(const [k,p] of Object.entries(parsers))verdict[k]={get:p.partnerStoreProfileSnapshot(seen.partnerGet),save:p.partnerStoreProfileSnapshot(seen.partnerSave),public:p.publicStoreProfile(seen.publicGet)};
 const want=expect==='pre'?{M:{get:true,save:true,public:true},main:{get:true,save:true,public:true}}
  :{M:{get:true,save:true,public:true},main:{get:false,save:false,public:false}};
 const report={expect,db:name,showPhotosColumn:seen.showPhotosColumn,profileKeys:Object.keys(seen.partnerGet.profile).length,
  draftKeys:Object.keys(seen.draft).length,verdict,want,responses:{partnerGet:seen.partnerGet,partnerSave:seen.partnerSave,publicGet:seen.publicGet},
  checkedAt:new Date().toISOString()};
 fs.writeFileSync(out,JSON.stringify(report,null,1)+'\n',{mode:0o600,flag:'wx'});
 assert.equal(seen.showPhotosColumn,expect==='post','show_photos column presence does not match --expect');
 assert.equal(report.profileKeys,expect==='pre'?10:11,'profile key count');
 assert.equal(report.draftKeys,expect==='pre'?4:5,'instant draft key count');
 assert.deepEqual(verdict,want,'cell verdict');
 console.log(JSON.stringify({expect,profileKeys:report.profileKeys,draftKeys:report.draftKeys,verdict,out}));
})().catch(e=>{console.error(JSON.stringify({code:e.code??null,message:e.message,detail:e.detail??null}));process.exitCode=1;});
