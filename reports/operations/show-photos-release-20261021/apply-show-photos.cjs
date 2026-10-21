'use strict';
// 20261020123000_store_profile_show_photos 전용 적용기(2026-10-20 러너 기반). node apply-show-photos.cjs --rehearsal | --production
// --production 은 ⚠ 운영 쓰기다. c4-passed.json(같은 SQL로 C4를 통과한 표식)과 3시간 이내의 D0 백업이 있어야 시작한다.
// 종료 코드: 0 적용, 또는 검증을 통과한 skip(이미 원장에 있음). 1 커밋 전 실패(phase 로 위치 표시; phase=commit 이면 결과 미확정,
// phase=skip-verify 면 원장에는 있는데 상태가 이 러너가 남기는 상태와 다름). 3 커밋 뒤 보고용 점검 실패.
// 자격 증명은 메모리에서만 쓰고 출력하지 않는다.
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const OPS='/Users/hanmyeong-gwan/myseouldrop-ops/show-photos',RUN=OPS+'/run',W=OPS+'/integrate';
const R='/Users/hanmyeong-gwan/mobile_design/.worktrees/service-quality-20261018';
const GUARDS_SHA256='4f1182ec2d8816260403b817830ed5096fe58e126e0504f639f8cc5a4f4d15a2';
const APP='myseouldrop-show-photos-apply';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const production=process.argv.includes('--production'),rehearsal=process.argv.includes('--rehearsal');
if(production===rehearsal)throw Error('Select exactly one target: --production or --rehearsal');
const target=production?'production':'rehearsal';
const manifest=JSON.parse(fs.readFileSync(RUN+'/release-migrations-20261021.json','utf8'));
assert.equal(manifest.source,W,'manifest source must be the integration clone');
assert.deepEqual(manifest.files.map(f=>f.version),['20261020123000'],'allowlist must hold exactly one version');
const guards=fs.readFileSync(RUN+'/apply-guards.sql','utf8');
assert.equal(sha(guards),GUARDS_SHA256,'apply-guards.sql changed after review');
const [,PRE_GUARD,SNAPSHOT,POST_GUARD,LEDGER_GUARD]=guards.split(/^-- ===== .*$/m);
assert.ok(PRE_GUARD.includes('share row exclusive')&&PRE_GUARD.includes('$pre$')&&SNAPSHOT.includes('regprocedure')&&POST_GUARD.includes('$post$')&&LEDGER_GUARD.includes('$ledger$'),'apply-guards.sql layout');
const file=manifest.files[0];
const sql=fs.readFileSync(W+'/supabase/migrations/'+file.name,'utf8');
assert.equal(sha(sql),file.sha256,'Source changed after review');
const {Client}=require(W+'/node_modules/pg');
let config;
if(production){
 const marker=JSON.parse(fs.readFileSync(RUN+'/c4-passed.json','utf8'));
 assert.equal(marker.migrationSha256,file.sha256,'C4 rehearsed a different migration');
 assert.equal(marker.guardsSha256,GUARDS_SHA256,'C4 rehearsed different guards');
 const backup=JSON.parse(fs.readFileSync(OPS+'/backup/backup-d1.json','utf8'));
 assert.equal(backup.toc.ok,true,'D0 backup archive check failed');
 for(const part of backup.files)assert.equal(sha(fs.readFileSync(part.path)),part.sha256,'D0 backup changed: '+part.path);
 assert.ok(Date.now()-Date.parse(backup.completedAt)<3*3600e3,'D0 backup is older than 3 hours; take a new one (D0)');
 const {processEnv}=require(W+'/node_modules/@next/env');
 const [,settings]=processEnv([{path:'.vercel/.env.production.local',contents:fs.readFileSync(R+'/.vercel/.env.production.local','utf8'),env:{}}],R,{info(){},error(){}});
 const u=new URL(settings.POSTGRES_URL_NON_POOLING||settings.POSTGRES_URL);
 if(!u.username.includes('njsocpyuesntblifpips')&&!u.hostname.includes('njsocpyuesntblifpips'))throw Error('Wrong production target');
 u.searchParams.delete('sslmode');
 config={connectionString:u.href,ssl:{rejectUnauthorized:true,ca:fs.readFileSync(OPS+'/ca/supabase-prod-ca-2021.crt','utf8')}};
}else{
 const name=fs.readFileSync(OPS+'/rehearsal-db-name','utf8').trim();
 if(!/^booking_release_rehearsal_[0-9]+$/.test(name))throw Error('Wrong rehearsal database');
 config={host:'127.0.0.1',port:54382,user:'postgres',password:process.env.REHEARSAL_PGPASSWORD||'postgres',database:name};
}
const client=new Client({...config,application_name:APP,connectionTimeoutMillis:10000,query_timeout:90000});
let phase='connect';
client.on('error',e=>console.error(JSON.stringify({target,phase,connectionError:e.code??null,message:e.message})));
const report={target,startedAt:new Date().toISOString()};
(async()=>{
 await client.connect();
 try{
  phase='precheck';
  if(production)assert.equal(client.connection.stream.authorized,true);
  await client.query(`set application_name = '${APP}'`);   // the startup parameter may not survive the pooler; this SET does
  const initial=(await client.query('select version from supabase_migrations.schema_migrations order by version')).rows.map(r=>r.version);
  assert.equal(initial.includes('20260926083440'),false,'Withheld migration must remain absent');
  let before,after;
  phase='transaction';
  await client.query('begin');
  try{
   await client.query("set local lock_timeout='3s'; set local statement_timeout='60s'; set local idle_in_transaction_session_timeout='30s'");
   await client.query("select pg_advisory_xact_lock(hashtext('myseouldrop-release-migrations'))");
   const exists=await client.query('select 1 from supabase_migrations.schema_migrations where version=$1',[file.version]);
   if(exists.rowCount>0){
    // Already in the ledger. Report skip only after proving the committed state is the one this runner leaves behind:
    // LEDGER_GUARD (24 rows, head = this version, withheld absent, the row holds the reviewed file) and POST_GUARD
    // (column, bodies, overloads, smoke). Nothing is written; function attributes are compared to the C1 golden by V3.
    phase='skip-verify';
    await client.query(LEDGER_GUARD);
    await client.query(POST_GUARD);
    await client.query('rollback');
    console.log(JSON.stringify({target,skip:file.name,verified:['LEDGER_GUARD','POST_GUARD']}));
    return;
   }
   await client.query(PRE_GUARD);   // takes the ledger and freeze-table locks, then checks under them
   before=(await client.query(SNAPSHOT)).rows;
   assert.equal(before.length,3,'snapshot must cover the three functions');
   await client.query(sql);
   await client.query(POST_GUARD);
   after=(await client.query(SNAPSHOT)).rows;
   assert.deepEqual(after,before,'function attributes changed (owner/security definer/volatility/config/ACL/strict/parallel/cost/language/arguments/result)');
   await client.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',[file.version,file.name.slice(file.version.length+1,-4),[sql]]);
   await client.query(LEDGER_GUARD);   // 24 rows, head = this version, and the row holds the reviewed file, before COMMIT
   // NOTIFY is transactional: it is delivered when COMMIT succeeds and dropped with a rollback, so no failure after
   // COMMIT can leave PostgREST without the reload.
   await client.query("notify pgrst, 'reload schema'");
   phase='commit';
   await client.query('commit');
  }catch(e){if(phase!=='commit')await client.query('rollback').catch(()=>{});throw e;}
  phase='post-commit';
  report.applied=[file.version];report.sha256=file.sha256;report.functions=after;report.committedAt=new Date().toISOString();
  console.log(JSON.stringify({target,applied:file.name}));
  // Reporting only: the migration is committed. A failure here is examined in E and never answered with a re-run.
  const checks={};
  try{
   const history=(await client.query('select version from supabase_migrations.schema_migrations order by version')).rows.map(r=>r.version);
   checks.ledgerRows=history.length;checks.targetPresent=history.includes(file.version);checks.withheldAbsent=!history.includes('20260926083440');
   const tables=await client.query("select relname,relrowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r' and (relname like 'merchant_%' or relname in ('merchants','customer_bookings','customer_booking_events','booking_messages','published_merchant_catalogs')) order by relname");
   checks.rlsTables=tables.rowCount;checks.allRls=tables.rows.every(t=>t.relrowsecurity);
   const bucket=await client.query("select public,file_size_limit,allowed_mime_types from storage.buckets where id='merchant-images'");
   checks.bucketOk=JSON.stringify(bucket.rows)===JSON.stringify([{public:false,file_size_limit:'5242880',allowed_mime_types:['image/webp']}]);
  }catch(e){checks.error=e.message;}
  report.postCommit=checks;
  report.postCommitOk=checks.targetPresent===true&&checks.withheldAbsent===true&&checks.rlsTables>=15&&checks.allRls===true&&checks.bucketOk===true;
  fs.writeFileSync(RUN+'/migrations-'+target+'-'+Date.now()+'.json',JSON.stringify(report,null,2)+'\n',{mode:0o600,flag:'wx'});
  console.log(JSON.stringify(report));
  if(!report.postCommitOk)process.exitCode=3;
 }finally{await client.end().catch(()=>{});}
})().catch(e=>{console.error(JSON.stringify({target,phase,error:e.code??null,message:e.message,detail:e.detail??null,where:e.where??null,hint:e.hint??null}));process.exitCode=1;});
