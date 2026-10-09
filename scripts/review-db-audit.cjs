// Read-only, scoped review backup. Never print row data or credentials.
const fs = require('node:fs');
const {parseEnv} = require('node:util');
const {Client} = require('pg');
async function connect(envFile) {
  const env = parseEnv(fs.readFileSync(envFile,'utf8'));
  const url = new URL(env.POSTGRES_URL_NON_POOLING || env.POSTGRES_URL);
  if (!(url.hostname + url.username).includes('njsocpyuesntblifpips')) throw Error('Project mismatch');
  url.searchParams.delete('sslmode');
  const res = await fetch('https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt');
  if (!res.ok) throw Error('Certificate unavailable');
  const db = new Client({connectionString:url.toString(),ssl:{ca:await res.text(),rejectUnauthorized:true},connectionTimeoutMillis:8000,query_timeout:15000});
  await db.connect(); return db;
}
module.exports = {connect};
if (require.main === module) (async()=>{
  const [envFile, outputFile] = process.argv.slice(2);
  if (!envFile || !outputFile) throw Error('Usage: node scripts/review-db-audit.cjs ENV_FILE PRIVATE_OUTPUT_FILE');
  const db = await connect(envFile);
  try {
    await db.query('begin isolation level repeatable read read only');
    const backup = {project:'njsocpyuesntblifpips',at:new Date().toISOString()};
    const queries = {
      view: "select pg_get_viewdef('public.public_reviews'::regclass,true) as definition",
      grants: "select * from information_schema.role_table_grants where table_schema='public' and table_name in ('ratings','review_reports','public_reviews')",
      column_grants: "select * from information_schema.column_privileges where table_schema='public' and table_name in ('ratings','review_reports','public_reviews')",
      policies: "select * from pg_policies where schemaname='public' and tablename in ('ratings','review_reports')",
      columns: "select column_name,data_type,column_default,is_nullable from information_schema.columns where table_schema='public' and table_name='ratings' order by ordinal_position",
      ratings: 'select * from public.ratings',
      reports: 'select * from public.review_reports',
      functions: "select pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='auto_hide_reported_review'",
      public_count: 'select count(*) from public.public_reviews',
    };
    for(const [k,q] of Object.entries(queries)) backup[k]=(await db.query(q)).rows;
    await db.query('commit');
    fs.writeFileSync(outputFile,JSON.stringify(backup,null,2),{mode:0o600,flag:'wx'});
    console.log(JSON.stringify({backup:outputFile,ratings:backup.ratings.length,reports:backup.reports.length,public_count:backup.public_count},null,2));
  } finally {await db.end();}
})().catch(e=>{console.error({code:e.code??e.name,message:'Audit failed; no credentials printed'});process.exitCode=1;});
