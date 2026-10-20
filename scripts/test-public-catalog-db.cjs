/* Isolated local QA DB only. All DDL/data changes roll back. CATALOG_TEST_DB_PORT is required. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { Client } = require('pg');
(async () => {
 const port=Number(process.env.CATALOG_TEST_DB_PORT);
 if (!Number.isInteger(port) || port < 1024 || port > 65535 || [5432,54322].includes(port)) throw new Error('Set CATALOG_TEST_DB_PORT to an isolated local QA database port');
 const client=new Client({host:'127.0.0.1',port,user:'postgres',password:process.env.CATALOG_TEST_DB_PASSWORD || 'postgres',database:'postgres',connectionTimeoutMillis:3000});
 await client.connect();
 const db={query:q=>client.query(q),exec:q=>client.query(q)}; let checks=0;
 const eq=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
 const rows=async q=>(await db.query(q)).rows;
 const role=async name=>db.exec(`reset role; set role ${name}`);
 const denied=async q=>{await db.exec('savepoint access_check');try{await assert.rejects(()=>db.exec(q),e=>e.code==='42501');checks++;}finally{await db.exec('rollback to savepoint access_check')}};
 const m='11111111-1111-4111-8111-111111111111', c='22222222-2222-4222-8222-222222222222', s='33333333-3333-4333-8333-333333333333';
 try {
  await db.exec('begin');
  await db.exec(fs.readFileSync('supabase/migrations/20261019140243_public_merchant_catalog.sql','utf8'));
  await db.exec(`insert into public.merchants(id,status,contact_email) values ('${m}','active','PRIVATE'); insert into public.merchant_categories(id,merchant_id,name_en,visibility) values ('${c}','${m}','Hair','visible'); insert into public.merchant_services(id,merchant_id,category_id,name_en,description_en,price_krw,duration_minutes,visibility) values ('${s}','${m}','${c}','Signature cut','Consultation and styling',60000,60,'visible');`);
  eq((await rows('select place_id,services from public.published_merchant_catalogs')).length,0);
  await db.exec(`insert into public.merchant_publications(merchant_id,place_id,published) values ('${m}','example-salon',true)`);
  await role('anon');
  let catalog=await rows('select place_id,services from public.published_merchant_catalogs');
  eq(catalog.length,1); eq(catalog[0].services,[{id:s,category:'Hair',name:'Signature cut',description:'Consultation and styling',priceKrw:60000,durationMinutes:60}]);
  await denied('select * from public.merchant_publications');
  await denied('select merchant_id from public.published_merchant_catalogs');
  await denied(`update public.published_merchant_catalogs set services='[]'`);
  await denied('delete from public.published_merchant_catalogs');
  await denied(`select private.refresh_merchant_catalog('${m}')`);
  await role('authenticated');
  await denied(`insert into public.merchant_publications(merchant_id,place_id) values ('${m}','hijack')`);
  await denied(`update public.merchant_publications set place_id='hijack'`);
  await denied(`select private.refresh_merchant_catalog('${m}')`);
  await role('postgres');
  for (const [table,field,value,restore] of [['merchant_services','visibility','hidden','visible'],['merchant_services','name_en','','Signature cut'],['merchant_services','name_en','\t\u00a0\u3000','Signature cut'],['merchant_services','description_en','','Consultation and styling'],['merchant_categories','visibility','hidden','visible'],['merchant_categories','name_en','','Hair']]) {
   await db.exec(`update public.${table} set ${field}='${value}' where merchant_id='${m}'`);
   eq((await rows('select services from public.published_merchant_catalogs'))[0].services,[]);
   await db.exec(`update public.${table} set ${field}='${restore}' where merchant_id='${m}'`);
   eq((await rows('select services from public.published_merchant_catalogs'))[0].services.length,1);
  }
  await db.exec(`update public.merchant_services set price_krw=null where id='${s}'`);
  eq((await rows('select services from public.published_merchant_catalogs'))[0].services,[]);
  await db.exec(`update public.merchant_services set price_krw=65000 where id='${s}'`);
  eq((await rows('select services from public.published_merchant_catalogs'))[0].services[0].priceKrw,65000);
  await db.exec(`update public.merchants set status='suspended' where id='${m}'`);
  eq((await rows('select place_id,services from public.published_merchant_catalogs')).length,0);
  await db.exec(`update public.merchants set status='active' where id='${m}'; update public.merchant_publications set place_id='renamed-salon' where merchant_id='${m}'`);
  eq((await rows('select place_id from public.published_merchant_catalogs')),[{place_id:'renamed-salon'}]);
  await db.exec(`update public.merchant_publications set published=false where merchant_id='${m}'`);
  eq((await rows('select place_id from public.published_merchant_catalogs')).length,0);
  await db.exec(`update public.merchant_publications set published=true where merchant_id='${m}'; delete from public.merchant_services where id='${s}'`);
  eq((await rows('select services from public.published_merchant_catalogs'))[0].services,[]);
  await db.exec(`delete from public.merchant_publications where merchant_id='${m}'`);
  eq((await rows('select place_id from public.published_merchant_catalogs')).length,0);
  eq((await rows(`select booking_enabled from public.merchants where id='${m}'`)),[{booking_enabled:false}]);
  eq((await rows("select relrowsecurity from pg_class where oid='public.published_merchant_catalogs'::regclass"))[0].relrowsecurity,true);
  const other='44444444-4444-4444-8444-444444444444', otherCategory='55555555-5555-4555-8555-555555555555', otherService='66666666-6666-4666-8666-666666666666';
  await db.exec(`insert into public.merchants(id,status) values ('${other}','active'); insert into public.merchant_categories(id,merchant_id,name_en,visibility) values ('${otherCategory}','${other}','Other category','visible'); insert into public.merchant_services(id,merchant_id,category_id,name_en,description_en,price_krw,duration_minutes,visibility) values ('${otherService}','${other}','${otherCategory}','Other service','Other description',70000,75,'visible'); insert into public.merchant_publications(merchant_id,place_id,published) values ('${other}','other-salon',true),('${m}','example-salon',true)`);
  await role('anon');
  eq((await rows("select services from public.published_merchant_catalogs where place_id='example-salon'"))[0].services,[]);
  eq((await rows("select services from public.published_merchant_catalogs where place_id='other-salon'"))[0].services.map(row=>row.id),[otherService]);
  await role('postgres');
  await db.exec(`update public.merchants set status='closed' where id='${m}'`);
  eq((await rows('select place_id from public.published_merchant_catalogs')),[{place_id:'other-salon'}]);
  console.log(JSON.stringify({status:'passed',checks}));
 } finally { await client.query('rollback'); await client.end(); }
})().catch(error=>{console.error(error);process.exitCode=1});
