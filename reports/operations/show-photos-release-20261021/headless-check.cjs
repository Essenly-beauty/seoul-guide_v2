'use strict';
// 헤드리스 점검: node headless-check.cjs <base-url> <out.json> [--loops=N]
// M에만 있는 표식을 하드 단언한다(main b26586b 에서는 실패해야 정상). 하나라도 어긋나면 종료 코드 1.
// networkidle 은 기다리지 않는다. 가로 넘침은 scrollWidth 로 판정한다. 사용자 에이전트에 점검 표식을 붙여
// 이 트래픽이 client_errors·web_vitals 에서 구분되게 한다.
const fs=require('node:fs');
const OPS='/Users/hanmyeong-gwan/myseouldrop-ops/show-photos';
const {chromium}=require(OPS+'/integrate/node_modules/playwright');
const pos=process.argv.slice(2).filter(a=>!a.startsWith('--'));
const loops=Number((process.argv.find(a=>a.startsWith('--loops='))||'--loops=1').slice('--loops='.length));
const [base,out]=pos;
if(!/^https?:\/\/[^/]+$/.test(base||'')||!out||!(Number.isInteger(loops)&&loops>=1&&loops<=30))throw Error('usage: headless-check.cjs <base-url> <out.json> [--loops=N]');
if(fs.existsSync(out))throw Error('Output exists, choose a new name: '+out);
const P='ct-more-on-hair-seongsu-branch';   // 게시 안 됨, 사진 없음
const PH='ados-dakyo-nail-seongsu';         // 사진 5장: 콜라주 3칸 + "+2"
const TAG='myseouldrop-release-check/20261022';
const results=[];
const check=(loop,name,pass,detail)=>{results.push({loop,name,pass:pass===true,...(detail===undefined?{}:{detail})});};
const visible=locator=>locator.first().waitFor({state:'visible',timeout:20000}).then(()=>true,()=>false);
(async()=>{
 const browser=await chromium.launch();
 const startedAt=new Date().toISOString();
 try{
  const probe=await browser.newContext();const ua=await (await probe.newPage()).evaluate(()=>navigator.userAgent);await probe.close();
  for(let loop=1;loop<=loops;loop++){
   const context=await browser.newContext({viewport:{width:390,height:844},locale:'en-US',userAgent:ua+' '+TAG});
   const page=await context.newPage();
   const consoleErrors=[],api=[];
   page.on('console',m=>{if(m.type()==='error')consoleErrors.push({url:page.url(),text:m.text().slice(0,300)});});
   page.on('pageerror',e=>consoleErrors.push({url:page.url(),text:'pageerror: '+String(e.message).slice(0,300)}));
   page.on('response',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/api/places/'))api.push({path:u.pathname,status:r.status()});});
   const overflow=()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth);
   try{
    // 1. 사진 없는 미게시 장소: M 에는 Photos 탭·섹션이 없다(main 에는 있다).
    let res=await page.goto(base+'/place/'+P,{waitUntil:'domcontentloaded'});
    check(loop,'place:http-200',res?.status()===200,res?.status());
    check(loop,'place:heading',await visible(page.locator('h1')));
    check(loop,'place:no-photos-section',await page.locator('#d-photos').count()===0);
    check(loop,'place:no-photos-anchor-tab',await page.locator('nav.anchortabs button').filter({hasText:/^Photos$/}).count()===0);
    check(loop,'place:empty-photo-state',await visible(page.locator('.place-photo-empty')));
    check(loop,'place:no-horizontal-overflow',await overflow());
    // 2. 사진 5장 장소: 사진 헤더 콜라주 3칸, "+2", 타일을 누르면 라이트박스, 닫기 버튼으로 닫힘.
    res=await page.goto(base+'/place/'+PH,{waitUntil:'domcontentloaded'});
    check(loop,'photos:http-200',res?.status()===200,res?.status());
    const collage=page.locator('.place-photo-collage.layout-three');
    check(loop,'photos:collage-three',await visible(collage));
    check(loop,'photos:more-badge-plus-2',(await page.locator('.place-photo-more').first().textContent({timeout:10000}).catch(()=>null))?.trim()==='+2');
    check(loop,'photos:no-photos-section',await page.locator('#d-photos').count()===0);
    await collage.first().locator('button').first().click({timeout:10000}).catch(()=>{});
    const lightbox=page.locator('.photo-lightbox[role="dialog"]');
    check(loop,'photos:lightbox-opens',await visible(lightbox));
    await page.locator('.photo-lightbox button[aria-label="Close photos"]').first().click({timeout:10000}).catch(()=>{});
    check(loop,'photos:lightbox-closes',await lightbox.first().waitFor({state:'hidden',timeout:10000}).then(()=>true,()=>false));
    check(loop,'photos:no-horizontal-overflow',await overflow());
    const placeErrors=consoleErrors.filter(e=>e.url.includes('/place/'));
    check(loop,'place-pages:no-console-errors',placeErrors.length===0,placeErrors);
    // 3. 비회원 화면: M 의 저장 목록 안내 문구(main 에는 없다), 예약·관리자 로그인 게이트.
    await page.goto(base+'/favorites',{waitUntil:'domcontentloaded'});
    check(loop,'favorites:guest-copy',await visible(page.getByText('Sign in to save places — hearts are kept on your account.',{exact:true})));
    await page.goto(base+'/bookings',{waitUntil:'domcontentloaded'});
    check(loop,'bookings:sign-in-gate',await visible(page.getByText('Sign in to view and manage your appointments.')));
    await page.goto(base+'/partner',{waitUntil:'domcontentloaded'});
    check(loop,'partner:sign-in-gate',await visible(page.getByText('가맹점 계정으로 로그인해 주세요')));
    // 4. 지도 핀 선택: M 은 공개 프로필·사진을 한 번 읽고 60초 동안 다시 읽지 않는다(main 은 읽지 않는다).
    api.length=0;
    await page.goto(base+'/map?place='+PH,{waitUntil:'domcontentloaded'});
    check(loop,'map:sheet-open',await visible(page.locator('.mapsheet.has-selection')));
    await page.waitForTimeout(8000);
    const profile=api.filter(a=>a.path==='/api/places/'+PH+'/profile'),media=api.filter(a=>a.path==='/api/places/'+PH+'/media');
    check(loop,'map:profile-read-200',profile.length>=1&&profile.every(a=>a.status===200),profile);
    check(loop,'map:media-read-200',media.length>=1&&media.every(a=>a.status===200),media);
    check(loop,'map:no-rapid-rereads',profile.length<=2&&media.length<=2,{profile:profile.length,media:media.length});
    check(loop,'map:no-horizontal-overflow',await overflow());
    // 5. 랭킹 → 상품 상세: 상품 사진은 잘리지 않는다(contain).
    await page.goto(base+'/ranking',{waitUntil:'domcontentloaded'});
    const link=page.locator('a[href^="/shop/"]:not([href^="/shop/daiso"]):not([href="/shop/routine-filter"])').first();
    const href=await link.waitFor({timeout:20000}).then(()=>link.getAttribute('href'),()=>null);
    let fit=null;
    if(href){
     await page.goto(base+href,{waitUntil:'domcontentloaded'});
     const img=page.locator('.product-detail-gallery img').first();
     fit=await img.waitFor({timeout:15000}).then(()=>img.evaluate(e=>getComputedStyle(e).objectFit),()=>null);
    }
    check(loop,'product:hero-contain',fit==='contain',{href,fit});
   }catch(e){check(loop,'run:exception',false,String(e.message).slice(0,300));}
   check(loop,'info:console-errors-all-pages',true,consoleErrors);
   await context.close();
  }
 }finally{await browser.close();}
 const failed=results.filter(r=>!r.pass);
 fs.writeFileSync(out,JSON.stringify({base,loops,tag:TAG,startedAt,finishedAt:new Date().toISOString(),failed:failed.length,results},null,1)+'\n',{mode:0o600,flag:'wx'});
 for(const r of failed)console.log(JSON.stringify(r));
 console.log(JSON.stringify({base,loops,checks:results.length,failed:failed.length,out}));
 if(failed.length)process.exitCode=1;
})().catch(e=>{console.error(String(e.message).slice(0,500));process.exitCode=1;});
