'use strict';
// 운영 읽기 전용 백업(pg_dump 17.6 in Docker, sslmode verify-full). node backup-show-photos.cjs rehearsal|d1
// 개인정보가 담긴 행은 덤프하지 않는다. schema.dump = 6개 스키마의 구조(함수 정의·권한 포함),
// data.dump = supabase_migrations.schema_migrations 와 storage.buckets 의 행만. 복구 자료는 이것과 fn-defs.sql 출력이다.
// 결과: $OPS/backup/<label>/{schema,data}.dump(+ .toc.txt), $OPS/backup/backup-<label>.json. 어떤 파일도 덮어쓰지 않는다.
const fs=require('node:fs'),crypto=require('node:crypto'),{spawn,spawnSync}=require('node:child_process');
const OPS='/Users/hanmyeong-gwan/myseouldrop-ops/show-photos',W=OPS+'/integrate';
const R='/Users/hanmyeong-gwan/mobile_design/.worktrees/service-quality-20261018';
const C='supabase_db_partner-app-20261018-Io8Zlv';
const label=process.argv[2];
if(!/^(rehearsal|d1)$/.test(label||''))throw Error('usage: backup-show-photos.cjs rehearsal|d1');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const {processEnv}=require(W+'/node_modules/@next/env');
const [,settings]=processEnv([{path:'.vercel/.env.production.local',contents:fs.readFileSync(R+'/.vercel/.env.production.local','utf8'),env:{}}],R,{info(){},error(){}});
const dump=(args,env,fd)=>new Promise((ok,no)=>{
 const p=spawn('docker',args,{env,stdio:['ignore',fd,'pipe']});let err='';
 p.stderr.on('data',x=>{err+=x;});p.on('error',no);
 p.on('exit',code=>code?no(Error('pg_dump exited '+code+': '+err.slice(0,2000))):ok());
});
(async()=>{
 const u=new URL(settings.POSTGRES_URL_NON_POOLING||settings.POSTGRES_URL);
 if(!u.username.includes('njsocpyuesntblifpips')&&!u.hostname.includes('njsocpyuesntblifpips'))throw Error('Wrong DB target');
 const {address}=await new Promise((ok,no)=>require('node:dns').lookup(u.hostname,(e,address)=>e?no(e):ok({address})));
 const dir=OPS+'/backup/'+label;fs.mkdirSync(dir,{recursive:false,mode:0o700});
 const env={...process.env,PGHOST:u.hostname,PGHOSTADDR:address,PGPORT:u.port||'5432',PGUSER:decodeURIComponent(u.username),
  PGPASSWORD:decodeURIComponent(u.password),PGDATABASE:decodeURIComponent(u.pathname.slice(1)),PGSSLMODE:'verify-full',
  PGSSLROOTCERT:'/tmp/myseouldrop-prod-ca.crt',PGCONNECT_TIMEOUT:'10',PGAPPNAME:'myseouldrop-show-photos-backup'};
 const keys=['PGHOST','PGHOSTADDR','PGPORT','PGUSER','PGPASSWORD','PGDATABASE','PGSSLMODE','PGSSLROOTCERT','PGCONNECT_TIMEOUT','PGAPPNAME'];
 const base=['exec',...keys.flatMap(k=>['-e',k]),C,'pg_dump','--format=custom','--no-owner'];
 const parts=[
  {part:'schema',args:['--schema-only','--schema=public','--schema=private','--schema=review_internal','--schema=auth','--schema=storage','--schema=supabase_migrations']},
  {part:'data',args:['--data-only','--table=supabase_migrations.schema_migrations','--table=storage.buckets']},
 ];
 const files=[];
 for(const {part,args} of parts){
  const path=dir+'/'+part+'.dump',fd=fs.openSync(path,'wx',0o600);
  try{await dump([...base,...args],env,fd);}finally{fs.closeSync(fd);}
  const data=fs.readFileSync(path);files.push({part,path,bytes:data.length,sha256:sha(data)});
 }
 // Read the archive table of contents without copying the archive into the container: pg_restore -l reads stdin.
 const toc={};
 for(const f of files){
  const r=spawnSync('docker',['exec','-i',C,'pg_restore','-l'],{input:fs.readFileSync(f.path),maxBuffer:64<<20});
  if(r.status!==0)throw Error('pg_restore -l failed for '+f.part+': '+String(r.stderr).slice(0,500));
  fs.writeFileSync(dir+'/'+f.part+'.toc.txt',r.stdout,{mode:0o600,flag:'wx'});toc[f.part]=String(r.stdout);
 }
 const check={
  privateSchema:/ SCHEMA - private /.test(toc.schema),
  replacedFunctions:['store_profile_json','partner_store_profile','booking_quote'].every(n=>new RegExp(' FUNCTION private '+n+'\\(').test(toc.schema)),
  ledgerRows:/ TABLE DATA supabase_migrations schema_migrations /.test(toc.data),
  bucketRows:/ TABLE DATA storage buckets /.test(toc.data),
  noOtherRows:!/ TABLE DATA /.test(toc.schema)&&(toc.data.match(/ TABLE DATA /g)||[]).length===2,
 };
 const record={label,files,toc:{...check,ok:Object.values(check).every(Boolean)},completedAt:new Date().toISOString()};
 fs.writeFileSync(OPS+'/backup/backup-'+label+'.json',JSON.stringify(record,null,2)+'\n',{mode:0o600,flag:'wx'});
 console.log(JSON.stringify(record));
 if(!record.toc.ok)process.exitCode=2;
})().catch(e=>{console.error(e.message);process.exitCode=1;});
