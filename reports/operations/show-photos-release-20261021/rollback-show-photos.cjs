'use strict';
// 20261020123000 비상 전체 롤백 실행기. node rollback-show-photos.cjs --rehearsal | --production
// --production 은 ⚠ 운영 쓰기: 오너 승인 뒤에만 실행한다. 진행 여부를 가르는 검사(원장·테이블 잠금, 원장 head, 사진 OFF 매장,
// 함수 속성, 롤백 뒤 원장 23행)는 모두 SQL 파일 안에서 COMMIT 전에 한다. 이 실행기는 파일을 고정하고 결과를 기록할 뿐이다.
// 자격 증명은 메모리에서만 쓰고 출력하지 않는다.
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const OPS='/Users/hanmyeong-gwan/myseouldrop-ops/show-photos',RUN=OPS+'/run',W=OPS+'/integrate';
const R='/Users/hanmyeong-gwan/mobile_design/.worktrees/service-quality-20261018';
const APP='myseouldrop-show-photos-rollback';
const production=process.argv.includes('--production'),rehearsal=process.argv.includes('--rehearsal');
if(production===rehearsal)throw Error('Select exactly one target: --production or --rehearsal');
const target=production?'production':'rehearsal';
const sql=fs.readFileSync(RUN+'/rollback-20261020123000.sql','utf8');
assert.equal(crypto.createHash('sha256').update(sql).digest('hex'),'4f528decb7c291eed917358236f6d2aa5e453d208ec4237c0bb178d415892eab','Rollback SQL changed after review');
const {Client}=require(W+'/node_modules/pg');
let config;
if(production){
 const {processEnv}=require(W+'/node_modules/@next/env');
 const [,s]=processEnv([{path:'.vercel/.env.production.local',contents:fs.readFileSync(R+'/.vercel/.env.production.local','utf8'),env:{}}],R,{info(){},error(){}});
 const u=new URL(s.POSTGRES_URL_NON_POOLING||s.POSTGRES_URL);
 if(!u.username.includes('njsocpyuesntblifpips')&&!u.hostname.includes('njsocpyuesntblifpips'))throw Error('Wrong production target');
 u.searchParams.delete('sslmode');
 config={connectionString:u.href,ssl:{rejectUnauthorized:true,ca:fs.readFileSync(OPS+'/ca/supabase-prod-ca-2021.crt','utf8')}};
}else{
 const name=fs.readFileSync(OPS+'/rehearsal-db-name','utf8').trim();
 if(!/^booking_release_rehearsal_[0-9]+$/.test(name))throw Error('Wrong rehearsal database');
 config={host:'127.0.0.1',port:54382,user:'postgres',password:process.env.REHEARSAL_PGPASSWORD||'postgres',database:name};
}
const c=new Client({...config,application_name:APP,connectionTimeoutMillis:10000,query_timeout:90000});
let phase='connect';
c.on('error',e=>console.error(JSON.stringify({target,phase,connectionError:e.code??null,message:e.message})));
(async()=>{
 await c.connect();
 try{
  phase='precheck';
  if(production)assert.equal(c.connection.stream.authorized,true);
  await c.query(`set application_name = '${APP}'`);
  // One query: begin, lock, guards, bodies, drop, ledger delete, verify, notify, commit. On any error the server skips the
  // rest of the string and leaves the transaction aborted, so end it here. A lost connection in this phase = outcome unknown.
  phase='transaction';
  try{await c.query(sql);}catch(e){await c.query('rollback').catch(()=>{});throw e;}
  phase='post-commit';
  // Reporting only: the file already required 23 rows / head 20261019200901 before COMMIT.
  const r=(await c.query("select count(*)::int as n,max(version) as head,count(*) filter (where version='20261020123000')::int as target,count(*) filter (where version='20260926083440')::int as withheld from supabase_migrations.schema_migrations")).rows[0];
  const report={target,rolledBack:'20261020123000',ledger:r,completedAt:new Date().toISOString()};
  fs.writeFileSync(RUN+'/rollback-'+target+'-'+Date.now()+'.json',JSON.stringify(report,null,2)+'\n',{mode:0o600,flag:'wx'});
  console.log(JSON.stringify(report));
 }finally{await c.end().catch(()=>{});}
})().catch(e=>{console.error(JSON.stringify({target,phase,error:e.code??null,message:e.message,detail:e.detail??null,where:e.where??null}));process.exitCode=1;});
