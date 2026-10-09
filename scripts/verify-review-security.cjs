// Exercises live role permissions inside a rolled-back transaction.
// No synthetic review becomes visible to other connections or persists.
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const {connect} = require('./review-db-audit.cjs');
(async()=>{
  const db = await connect(process.argv[2]);
  try {
    await db.query('begin');
    const source=(await db.query('select user_id from public.ratings limit 1')).rows[0];
    if(!source) throw Error('No existing account available for transaction-only ownership check');
    const place='security-check-'+randomUUID();
    await db.query("select set_config('request.jwt.claim.sub',$1,true)",[source.user_id]);
    await db.query('set local role authenticated');
    const save=()=>db.query('insert into public.ratings(user_id,place_id,rating,body,is_public) values($1,$2,5,$3,true) on conflict(user_id,place_id) do update set user_id=excluded.user_id,place_id=excluded.place_id,rating=excluded.rating,body=excluded.body,is_public=excluded.is_public',[source.user_id,place,'Transaction-only verification']);
    await save(); await save();
    assert.deepEqual((await db.query('select display_name,mine from public.public_reviews where place_id=$1',[place])).rows,[{display_name:'User',mine:true}]);
    await db.query("set local role anon; select set_config('request.jwt.claim.sub','',true)");
    assert.deepEqual((await db.query('select display_name,mine from public.public_reviews where place_id=$1',[place])).rows,[{display_name:'User',mine:false}]);
    assert.equal((await db.query('select id,user_id from public.ratings where place_id=$1',[place])).rowCount,0);
    await db.query('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,true)",[source.user_id]);
    await db.query('set local role authenticated');
    await db.query('update public.ratings set is_public=false where place_id=$1',[place]);
    assert.equal((await db.query('select id from public.public_reviews where place_id=$1',[place])).rowCount,0);
    await db.query('rollback');
    assert.equal((await db.query('select id from public.ratings where place_id=$1',[place])).rowCount,0);
    console.log(JSON.stringify({status:'passed',liveRoleUpsert:true,ownership:true,publicPrivateSync:true,syntheticRowsPersisted:0}));
  } finally {await db.query('rollback').catch(()=>{});await db.end();}
})().catch(e=>{console.error({status:'failed',code:e.code??e.name});process.exitCode=1;});
