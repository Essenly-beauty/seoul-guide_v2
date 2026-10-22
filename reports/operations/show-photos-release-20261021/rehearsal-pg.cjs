'use strict';
// 리허설 전용 preload: (cd $W && BOOKING_TEST_DB_PORT=54382 node -r $RUN/rehearsal-pg.cjs scripts/test-*.cjs)
// 통합 클론($W)의 pg 만 패치한다. 테스트 스크립트의 연결(127.0.0.1:54382/postgres)만 허용하고 대상 DB를 리허설 DB로 바꾼다.
const fs=require('node:fs');
const OPS='/Users/hanmyeong-gwan/myseouldrop-ops/show-photos';
const pgPath=require.resolve('pg',{paths:[process.cwd()]});
if(!pgPath.startsWith(OPS+'/integrate/node_modules/'))throw Error('Run the test scripts from the integration clone, not '+pgPath);
const name=fs.readFileSync(OPS+'/rehearsal-db-name','utf8').trim();
if(!/^booking_release_rehearsal_[0-9]+$/.test(name))throw Error('Invalid rehearsal target');
const pg=require(pgPath);
const Original=pg.Client;
pg.Client=class extends Original{constructor(options){
 if(!options||options.host!=='127.0.0.1'||options.port!==54382||options.database!=='postgres')throw Error('Only isolated local test connections allowed');
 super({...options,database:name,application_name:'myseouldrop-show-photos-test'});
}};
