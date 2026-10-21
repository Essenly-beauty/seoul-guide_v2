'use strict';
// ro-sql.cjs 결과를 눈이 아니라 스크립트로 판정한다.
//   node check-results.cjs ok <result.json> [--target production|rehearsal] [--expect-error <id>=<SQLSTATE>[:<text>]]...
//     모든 문장이 실행됐고(기대한 오류 하나 제외), ok 열이 있는 행은 모두 ok=true 인지 본다.
//   node check-results.cjs same <golden.json> <other.json> <id | goldenId=otherId>...
//     두 결과 파일에서 같은 문장의 rows 가 정확히 같은지 본다(C1 골든 비교).
// 통과하면 PASS, 아니면 이유를 출력하고 종료 코드 1.
const fs=require('node:fs'),{isDeepStrictEqual}=require('node:util');
const [cmd,...rest]=process.argv.slice(2);
const load=p=>{const j=JSON.parse(fs.readFileSync(p,'utf8'));if(!Array.isArray(j.results)||!Array.isArray(j.statementIds))throw Error(p+': not a ro-sql.cjs result');return j;};
const fail=[];
if(cmd==='ok'){
 const file=rest[0],expected=new Map();let target=null;
 for(let i=1;i<rest.length;i++){
  if(rest[i]==='--target'){target=rest[++i];continue;}
  if(rest[i]!=='--expect-error')throw Error('unknown option '+rest[i]);
  const m=/^([^=]+)=([0-9A-Z]{5})(?::(.+))?$/.exec(rest[++i]||'');if(!m)throw Error('bad --expect-error');
  expected.set(m[1],{code:m[2],text:m[3]??null});
 }
 const j=load(file);
 console.log(`${file}: target=${j.target} db=${j.db} complete=${j.complete}`);
 if(target&&j.target!==target)fail.push(`target is ${j.target}, expected ${target}`);
 const ran=new Map(j.results.map(r=>[r.id,r]));
 for(const id of j.statementIds){
  const r=ran.get(id),e=expected.get(id);
  if(!r){fail.push(`${id}: never ran (an earlier statement failed)`);continue;}
  if(r.error){
   if(!e)fail.push(`${id}: unexpected error ${r.error.code} ${r.error.message}`);
   else if(r.error.code!==e.code||(e.text&&!r.error.message.includes(e.text)))fail.push(`${id}: expected ${e.code}${e.text?' '+e.text:''}, got ${r.error.code} ${r.error.message}`);
   else console.log(`${id}: expected error ${r.error.code} ${r.error.message}`);
   continue;
  }
  if(e){fail.push(`${id}: expected error ${e.code}, but the statement succeeded`);continue;}
  if(!r.rows){console.log(`${id}: ${r.command}`);continue;}
  const graded=r.rows.filter(x=>Object.hasOwn(x,'ok'));
  const bad=graded.filter(x=>x.ok!==true);
  if(bad.length)fail.push(`${id}: ok is not true in ${bad.length} row(s): ${JSON.stringify(bad)}`);
  else console.log(`${id}: ${r.rows.length} row(s)${graded.length?', ok':''}`);
 }
 for(const id of expected.keys())if(!j.statementIds.includes(id))fail.push(`${id}: no such statement in ${file}`);
}else if(cmd==='same'){
 const [g,o,...pairs]=rest;
 if(!g||!o||!pairs.length)throw Error('usage: check-results.cjs same <golden.json> <other.json> <id|goldenId=otherId>...');
 const G=load(g),O=load(o);
 console.log(`golden ${g}: target=${G.target} db=${G.db}; other ${o}: target=${O.target} db=${O.db}`);
 const gm=new Map(G.results.map(r=>[r.id,r])),om=new Map(O.results.map(r=>[r.id,r]));
 for(const p of pairs){
  const [gid,oid=gid]=p.split('=');const a=gm.get(gid),b=om.get(oid);
  if(!a||!b||a.error||b.error||!a.rows||!b.rows){fail.push(`${p}: missing, failed or not a SELECT in one of the files`);continue;}
  if(isDeepStrictEqual(a.rows,b.rows))console.log(`${p}: same`);
  else fail.push(`${p}: differs\n  golden: ${JSON.stringify(a.rows)}\n  other:  ${JSON.stringify(b.rows)}`);
 }
}else throw Error('usage: check-results.cjs ok|same ...');
if(fail.length){console.error('FAIL\n'+fail.join('\n'));process.exitCode=1;}else console.log('PASS');
