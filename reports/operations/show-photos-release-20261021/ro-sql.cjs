'use strict';
// 읽기 전용 SQL 실행기: node ro-sql.cjs --production|--rehearsal <file.sql> <out.json> [--set key=value]...
// 파일은 `-- @<id>` 줄로 시작하는 문장의 목록이다. 한 연결, 한 트랜잭션(repeatable read, read only, search_path='')에서
// 순서대로 실행하고 문장마다 결과를 남긴다. 오류가 나면 그 문장의 오류까지 기록하고 멈춘다(종료 코드 1, 출력 파일은 남는다).
// --set key=value 는 트랜잭션 안에서 myseouldrop.<key> 로 읽힌다. 출력 파일은 덮어쓰지 않는다. 자격 증명은 출력하지 않는다.
const fs=require('node:fs'),crypto=require('node:crypto');
const OPS='/Users/hanmyeong-gwan/myseouldrop-ops/show-photos',W=OPS+'/integrate';
const R='/Users/hanmyeong-gwan/mobile_design/.worktrees/service-quality-20261018';
const USAGE='usage: ro-sql.cjs --production|--rehearsal <file.sql> <out.json> [--set key=value]...';
const argv=process.argv.slice(2),sets=[],pos=[];
for(let i=0;i<argv.length;i++){
 const a=argv[i];
 if(a==='--set'){const m=/^([a-z_][a-z0-9_]*)=(.*)$/.exec(argv[++i]||'');if(!m)throw Error('bad --set; '+USAGE);sets.push([m[1],m[2]]);}
 else if(a==='--production'||a==='--rehearsal')continue;
 else if(a.startsWith('--'))throw Error('unknown option '+a+'; '+USAGE);
 else pos.push(a);
}
const production=argv.includes('--production'),rehearsal=argv.includes('--rehearsal');
if(production===rehearsal||pos.length!==2)throw Error(USAGE);
const [file,out]=pos;
if(fs.existsSync(out))throw Error('Output exists, choose a new name: '+out);
const text=fs.readFileSync(file,'utf8');
const parts=text.split(/^-- @([A-Za-z0-9_.=-]+)[ \t]*$/m);
if(parts.length<3)throw Error('No `-- @id` statements in '+file);
if(parts[0].split('\n').some(l=>l.trim()&&!l.trim().startsWith('--')))throw Error('SQL outside a `-- @id` block in '+file);
const statements=[];
for(let i=1;i<parts.length;i+=2)statements.push({id:parts[i],sql:parts[i+1].trim()});
if(new Set(statements.map(s=>s.id)).size!==statements.length||statements.some(s=>!s.sql))throw Error('Duplicate or empty statement id in '+file);
const {Client}=require(W+'/node_modules/pg');
let config,expectDb;
if(rehearsal){
 const name=fs.readFileSync(OPS+'/rehearsal-db-name','utf8').trim();
 if(!/^booking_release_rehearsal_[0-9]+$/.test(name))throw Error('Wrong rehearsal database');
 config={host:'127.0.0.1',port:54382,user:'postgres',password:process.env.REHEARSAL_PGPASSWORD||'postgres',database:name};expectDb=name;
}else{
 const {processEnv}=require(W+'/node_modules/@next/env');
 const [,s]=processEnv([{path:'.vercel/.env.production.local',contents:fs.readFileSync(R+'/.vercel/.env.production.local','utf8'),env:{}}],R,{info(){},error(){}});
 const u=new URL(s.POSTGRES_URL_NON_POOLING||s.POSTGRES_URL);
 if(!u.username.includes('njsocpyuesntblifpips')&&!u.hostname.includes('njsocpyuesntblifpips'))throw Error('Wrong production target');
 u.searchParams.delete('sslmode');
 config={connectionString:u.href,ssl:{rejectUnauthorized:true,ca:fs.readFileSync(OPS+'/ca/supabase-prod-ca-2021.crt','utf8')}};expectDb=decodeURIComponent(u.pathname.slice(1));
}
const c=new Client({...config,application_name:'myseouldrop-show-photos-ro',connectionTimeoutMillis:10000,query_timeout:60000,statement_timeout:15000,options:'-c default_transaction_read_only=on'});
c.on('error',()=>{});
const report={target:production?'production':'rehearsal',file,fileSha256:crypto.createHash('sha256').update(text).digest('hex'),
 statementIds:statements.map(s=>s.id),sets:Object.fromEntries(sets),startedAt:new Date().toISOString(),results:[],complete:false};
(async()=>{
 await c.connect();
 try{
  if(production&&c.connection.stream.authorized!==true)throw Error('TLS peer not verified');
  // The startup option can be dropped by the pooler; this SET cannot, and the checks below prove it took effect.
  await c.query("set application_name = 'myseouldrop-show-photos-ro'");
  await c.query('set session characteristics as transaction read only');
  const s=(await c.query("select current_database() as db, current_user as usr, current_setting('default_transaction_read_only') as ro")).rows[0];
  if(s.ro!=='on')throw Error('default_transaction_read_only is not on');
  if(s.db!==expectDb)throw Error('Connected to database '+s.db+', expected '+expectDb);
  report.db=s.db;report.user=s.usr;
  await c.query('begin isolation level repeatable read read only');
  if((await c.query("select current_setting('transaction_read_only') as ro")).rows[0].ro!=='on')throw Error('Transaction is not read only');
  await c.query("set local search_path = ''");
  for(const [k,v] of sets)await c.query('select set_config($1,$2,true)',['myseouldrop.'+k,v]);
  for(const st of statements){
   try{
    const r=await c.query(st.sql);
    if(Array.isArray(r))throw Object.assign(Error('More than one statement under @'+st.id),{code:'XXSPL'});
    report.results.push(r.command==='SELECT'?{id:st.id,rows:r.rows}:{id:st.id,command:r.command});
   }catch(e){report.results.push({id:st.id,error:{code:e.code??null,message:String(e.message),detail:e.detail??null,where:e.where??null}});break;}
  }
  report.complete=report.results.length===statements.length&&!report.results.some(x=>x.error);
 }finally{
  await c.query('rollback').catch(()=>{});await c.end().catch(()=>{});
  report.finishedAt=new Date().toISOString();
  fs.writeFileSync(out,JSON.stringify(report,null,1)+'\n',{mode:0o600,flag:'wx'});
 }
 for(const r of report.results)console.log(JSON.stringify(r.error?{id:r.id,error:r.error.code,message:r.error.message.split('\n')[0]}
  :r.rows?{id:r.id,rows:r.rows.length,ok:r.rows.some(x=>Object.hasOwn(x,'ok'))?r.rows.every(x=>x.ok===true):undefined}:{id:r.id,command:r.command}));
 console.log(JSON.stringify({target:report.target,db:report.db,complete:report.complete,out}));
 if(!report.complete)process.exitCode=1;
})().catch(e=>{console.error(JSON.stringify({code:e.code??null,message:String(e.message).split('\n')[0]}));process.exitCode=1;});
