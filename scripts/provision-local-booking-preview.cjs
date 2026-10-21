/** Explicit local QA fixture. Uses local admin API; sends no email; never accepts a remote host. */
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {randomBytes}=require('node:crypto');
const {Client}=require('pg');
const {createClient}=require('@supabase/supabase-js');
(async()=>{
 const workdir=process.argv[2];if(!workdir)throw Error('Usage: node scripts/provision-local-booking-preview.cjs <isolated-supabase-workdir>');
 const config=JSON.parse(execFileSync('supabase',['status','--workdir',workdir,'--output','json'],{env:{...process.env,SUPABASE_TELEMETRY_DISABLED:'1'},encoding:'utf8',stdio:['ignore','pipe','pipe']}));
 for(const raw of [config.API_URL,config.DB_URL]){const url=new URL(raw);if(!['127.0.0.1','localhost'].includes(url.hostname))throw Error('Local QA only');}
 const dburl=new URL(config.DB_URL);if(['5432','54322'].includes(dburl.port))throw Error('Requires an isolated QA database');
 const credentialsPath=path.join(os.tmpdir(),'myseouldrop-booking-local-access.json');
 const access=fs.existsSync(credentialsPath)?JSON.parse(fs.readFileSync(credentialsPath,'utf8')):{
  customer:{email:'guest.booking@myseouldrop.test',password:randomBytes(18).toString('base64url')+'Aa1!'},
  partner:{email:'owner.booking@myseouldrop.test',password:randomBytes(18).toString('base64url')+'Aa1!'}
 };
 const admin=createClient(config.API_URL,config.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const users=await admin.auth.admin.listUsers({perPage:1000});if(users.error)throw Error('Local auth is unavailable');
 for(const kind of ['customer','partner']){const account=access[kind];const existing=users.data.users.find(u=>u.email===account.email);
 if(existing){account.id=existing.id;}else{const created=await admin.auth.admin.createUser({email:account.email,password:account.password,email_confirm:true,user_metadata:{display_name:kind==='partner'?'Booking studio manager':'Booking test guest'}});if(created.error)throw Error(created.error.message);account.id=created.data.user.id;}
 }
 const c=new Client({connectionString:config.DB_URL});await c.connect();try{await c.query('begin');
 const m='b1000000-0000-4000-8000-000000000001',cat='b1000000-0000-4000-8000-000000000002';
 const services=['b1000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000004'];
 const staff=['b1000000-0000-4000-8000-000000000005','b1000000-0000-4000-8000-000000000006'];
 if(!(await c.query('select 1 from public.merchants where id=$1',[m])).rowCount){
 await c.query("insert into public.merchants(id,display_name,status,booking_enabled,business_types) values($1,'MYSEOULDROP Booking Studio · Test','active',true,array['hair'])",[m]);
 await c.query('insert into public.merchant_memberships(merchant_id,user_id) values($1,$2)',[m,access.partner.id]);
 await c.query("insert into public.merchant_booking_settings(merchant_id,confirmation_mode,payment_mode) values($1,'request','pay_at_venue')",[m]);
 await c.query("insert into public.merchant_publications(merchant_id,place_id,published) values($1,'myseouldrop-booking-studio',true)",[m]);
 await c.query("select set_config('request.jwt.claim.sub',$1,true)",[access.partner.id]);
 await c.query("insert into public.merchant_categories(id,merchant_id,name_ko,name_en,visibility) values($1,$2,'헤어','Hair','visible')",[cat,m]);
 for(const [i,id]of services.entries())await c.query("insert into public.merchant_services(id,merchant_id,category_id,name_ko,name_en,description_ko,description_en,price_krw,duration_minutes,cleanup_minutes,visibility,sort_order) values($1,$2,$3,$4,$5,$6,$7,$8,$9,15,'visible',$10)",[id,m,cat,i?'두피 케어':'시그니처 커트',i?'Scalp care':'Signature cut','예약 연동 테스트용 메뉴입니다.',i?'A relaxing scalp treatment. Local test service.':'Consultation, haircut and styling. Local test service.',i?70000:60000,i?75:60,i]);
 const hours=JSON.stringify(Array.from({length:7},(_,weekday)=>({weekday,startMinute:600,endMinute:1200})));
 await c.query('insert into public.merchant_schedules(merchant_id,hours) values($1,$2)',[m,hours]);
 await c.query("insert into public.merchant_reservation_rules(merchant_id,mode,capacity,start_date,end_date,minimum_lead_minutes,slot_interval_minutes) values($1,'staff',2,(now() at time zone 'Asia/Seoul')::date,(now() at time zone 'Asia/Seoul')::date+90,60,30)",[m]);
 for(const [i,id]of staff.entries()){
 await c.query("insert into public.merchant_staff(id,merchant_id,name,title,introduction,visibility,sort_order) values($1,$2,$3,$4,'English · Korean. Test profile.','visible',$5)",[id,m,i?'Jiyoon':'Min',i?'Stylist':'Senior stylist',i]);
 await c.query('insert into public.merchant_staff_schedules(merchant_id,staff_id,hours) values($1,$2,$3)',[m,id,hours]);
 for(const service of services)await c.query('insert into public.merchant_staff_menus(merchant_id,staff_id,service_id) values($1,$2,$3)',[m,id,service]);
 }
 }
 await c.query('commit');
 fs.writeFileSync(credentialsPath,JSON.stringify(access,null,2),{mode:0o600});
 console.log(JSON.stringify({status:'ready',credentialsPath,customerPath:'/place/myseouldrop-booking-studio/book',partnerPath:'/partner',note:'Existing administrator edits are preserved. Local QA only.'}));
 }catch(e){await c.query('rollback');throw e}finally{await c.end()}
})().catch(e=>{console.error(e.message);process.exitCode=1});
