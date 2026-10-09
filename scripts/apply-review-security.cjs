// Explicit project-bound, transactional migration. Default is rollback-only rehearsal.
// Usage: node scripts/apply-review-security.cjs ENV_FILE PRIVATE_BACKUP_DIR [--apply]
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {connect} = require('./review-db-audit.cjs');
const version = '20261009052244';
const name = 'secure_public_review_projection';
const migration = fs.readFileSync(`supabase/migrations/${version}_${name}.sql`,'utf8');
const quote = s => '"'+s.replaceAll('"','""')+'"';
(async()=>{
  const [envFile,backupDir,mode] = process.argv.slice(2);
  if (!envFile || !backupDir || (mode && mode !== '--apply')) throw Error('Invalid arguments');
  fs.mkdirSync(backupDir,{recursive:true,mode:0o700});
  if ((fs.statSync(backupDir).mode & 0o077)!==0) throw Error('Backup directory must be private (0700)');
  const db = await connect(envFile);
  try {
    await db.query("begin; set local lock_timeout='5s'; set local statement_timeout='20s'; lock table public.ratings,public.review_reports in share row exclusive mode");
    const snapshot = async()=> (await db.query("select (select coalesce(jsonb_agg(to_jsonb(r) order by id),'[]') from public.ratings r) ratings, (select coalesce(jsonb_agg(to_jsonb(r) order by id),'[]') from public.review_reports r) reports")).rows[0];
    const original = await snapshot();
    const view = (await db.query("select pg_get_viewdef('public.public_reviews'::regclass,true) definition")).rows[0].definition;
    const grants = (await db.query("select grantee,table_name,privilege_type,is_grantable from information_schema.role_table_grants where table_schema='public' and table_name in ('ratings','review_reports','public_reviews')")).rows;
    const explicitColumns = (await db.query("select attname from pg_attribute where attrelid='public.ratings'::regclass and attacl is not null")).rows;
    assert.equal(explicitColumns.length,0,'Review and preserve existing explicit column grants before proceeding');
    const functionGrants = (await db.query("select case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end grantee,a.privilege_type,a.is_grantable from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='public.auto_hide_reported_review()'::regprocedure")).rows;
    let rollback = `drop trigger ratings_sync_public_projection on public.ratings;\ncreate or replace view public.public_reviews with (security_invoker=false) as ${view}\ndrop table public.published_reviews;\ndrop function review_internal.sync_published_review();\ndrop schema review_internal;\n`;
    rollback += 'revoke select(id,user_id) on public.ratings from anon;\nrevoke insert(user_id,place_id,rating,body,is_public),update(user_id,place_id,rating,body,is_public) on public.ratings from authenticated;\nrevoke insert(rating_id,reporter,reason) on public.review_reports from authenticated;\n';
    for(const table of ['ratings','review_reports','public_reviews']) rollback += `revoke all on public.${table} from public,anon,authenticated;\n`;
    for(const g of grants) rollback += `grant ${g.privilege_type} on public.${quote(g.table_name)} to ${g.grantee==='PUBLIC'?'PUBLIC':quote(g.grantee)}${g.is_grantable==='YES'?' with grant option':''};\n`;
    for(const g of functionGrants) rollback += `grant EXECUTE on function public.auto_hide_reported_review() to ${g.grantee==='PUBLIC'?'PUBLIC':quote(g.grantee)}${g.is_grantable?' with grant option':''};\n`;
    rollback += `delete from supabase_migrations.schema_migrations where version='${version}';\nnotify pgrst,'reload schema';\n`;
    const stamp=Date.now();
    fs.writeFileSync(path.join(backupDir,`${stamp}-source.json`),JSON.stringify({project:'njsocpyuesntblifpips',at:new Date().toISOString(),...original,view,grants,functionGrants}),{mode:0o600,flag:'wx'});
    fs.writeFileSync(path.join(backupDir,`${stamp}-rollback.sql`),'begin;\n'+rollback+'commit;\n',{mode:0o600,flag:'wx'});
    await db.query(migration);
    assert.deepEqual(await snapshot(),original,'Source rows changed');
    const verify = (await db.query("select has_column_privilege('authenticated','public.ratings','hidden','UPDATE') hidden_write,has_table_privilege('anon','public.ratings','TRUNCATE') anonymous_truncate,has_function_privilege('anon','public.auto_hide_reported_review()','EXECUTE') exposed_trigger,(select reloptions @> array['security_invoker=true'] from pg_class where oid='public.public_reviews'::regclass) invoker")).rows[0];
    assert.deepEqual(verify,{hidden_write:false,anonymous_truncate:false,exposed_trigger:false,invoker:true});
    await db.query("set local role anon; select * from public.public_reviews; reset role");
    if(mode==='--apply') {
      await db.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',[version,name,[migration]]);
      await db.query("notify pgrst,'reload schema'; commit");
      console.log(JSON.stringify({status:'applied',version,ratingsPreserved:original.ratings.length,reportsPreserved:original.reports.length,backupDir}));
    } else {
      await db.query(rollback);
      assert.deepEqual(await snapshot(),original,'Rollback changed source rows');
      const restored=(await db.query("select pg_get_viewdef('public.public_reviews'::regclass,true) definition")).rows[0].definition;
      assert.equal(restored,view,'View rollback mismatch');
      await db.query('rollback');
      console.log(JSON.stringify({status:'rehearsal-and-rollback-passed',ratingsPreserved:original.ratings.length,backupDir}));
    }
  } catch(e) {await db.query('rollback').catch(()=>{});throw e;}
  finally {await db.end();}
})().catch(e=>{console.error({status:'failed',code:e.code??e.name,message:e.code?'Database migration failed; transaction rolled back':e.message});process.exitCode=1;});
