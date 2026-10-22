'use strict';
// C4-1 전용: pg_restore 의 stderr 파일을 오류 블록 단위로 읽고, 허용 목록에 없는 블록이 하나라도 있으면 종료 코드 1로 멈춘다.
// 허용 목록에는 비교 대상(public·private·supabase_migrations 의 객체, storage.buckets, 대상 함수가 쓰는 auth 함수)과 무관하고
// 리허설 결과를 바꾸지 않는 오류만 둔다. 2026-10-22 로컬 Supabase(PostgreSQL 17.6)에서 같은 pg_dump 옵션으로 만든 덤프를
// 새 DB에 복원해 나온 두 종류다. 목록 밖의 블록이 나오면 계획 C4-1 아래의 절차대로 판단한다(자동으로 넓히지 않는다).
// 사용: node check-restore-errors.cjs <stderr 파일>...
const fs=require('node:fs');
const ALLOW=[
 // 새 DB에도 public 스키마가 이미 있다.
 {why:'public schema exists',error:/^ERROR:  schema "public" already exists$/,command:/^CREATE SCHEMA public;$/},
 // postgres 는 Supabase 관리 역할이 '앞으로 만들' 객체의 기본 권한을 바꿀 수 없다. 이미 있는 객체의 GRANT 는 따로 복원된다.
 {why:'default privileges of Supabase-managed roles',error:/^ERROR:  permission denied to change default privileges$/,
  command:/^(?:ALTER DEFAULT PRIVILEGES FOR ROLE (?:supabase_admin|supabase_auth_admin|supabase_storage_admin) IN SCHEMA (?:public|auth|storage) GRANT ALL ON (?:TABLES|SEQUENCES|FUNCTIONS) TO [a-z_]+;\n?)+$/},
];
const counts=Object.fromEntries(ALLOW.map(a=>[a.why,0])),bad=[];
for(const file of process.argv.slice(2)){
 for(const block of fs.readFileSync(file,'utf8').split(/\n(?=pg_restore: )/).map(b=>b.trim()).filter(Boolean)){
  if(/^pg_restore: warning: errors ignored on restore: \d+$/.test(block))continue;
  const m=block.match(/^pg_restore: error: could not execute query: (ERROR: [^\n]*)\nCommand was: ([\s\S]*)$/);
  const hit=m&&ALLOW.find(a=>a.error.test(m[1])&&a.command.test(m[2].trim()));
  if(hit)counts[hit.why]++;else bad.push(file+'\n'+block);
 }
}
console.log(JSON.stringify({allowed:counts,notAllowed:bad.length}));
if(bad.length){console.error(bad.join('\n\n'));process.exitCode=1;}
