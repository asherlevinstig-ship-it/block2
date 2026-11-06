import test from 'node:test';
import assert from 'node:assert/strict';
import {handlePlayerApi} from '../server/player-api.mjs';
import {testDatabase} from './db-helper.mjs';

test('the carpenter accepts existing timber once, with atomic inventory and wallet updates', async t=>{
  const {db,sql}=testDatabase();
  t.after(()=>sql.close());
  const origin='https://tower.test';
  let cookie,characterKey;
  async function call(path,body){
    const headers={Origin:origin,'Content-Type':'application/json'};
    if(cookie)headers.Cookie=cookie;
    const response=await handlePlayerApi(new Request(origin+'/api/player/'+path,{
      headers,method:body?'POST':'GET',body:body?JSON.stringify({...body,characterKey}):undefined
    }),{TOWER_DB:db});
    cookie=response.headers.get('Set-Cookie')?.split(';')[0]??cookie;
    const result=await response.json();
    characterKey=result.characterKey??characterKey;
    return {status:response.status,...result};
  }
  const created=await call('session',{legacy:{location:'hub',woodcutting:{timber:11},carpenterOrderComplete:true}});
  const submit=revision=>call('commissions/carpenter',{revision,operation:crypto.randomUUID()});
  assert.equal((await submit(created.revision)).status,400);
  const short=await call('save',{revision:created.revision,operation:'enter-market',state:{...created.state,location:'market',carpenterOrderComplete:true}});
  assert.equal(short.state.carpenterOrderComplete,false);
  assert.equal((await submit(short.revision)).status,400);
  const ready=await call('save',{revision:short.revision,operation:'bring-timber',state:{...short.state,woodcutting:{...short.state.woodcutting,timber:14}}});
  const action={revision:ready.revision,operation:'carpenter-delivery'};
  const concurrent=await Promise.all([call('commissions/carpenter',action),submit(ready.revision)]);
  assert.deepEqual(concurrent.map(result=>result.status).sort(),[200,409]);
  const latest=await call('state');
  assert.equal(latest.state.carpenterOrderComplete,true);
  assert.equal(latest.state.credits,160);
  assert.equal(latest.state.woodcutting.timber,2);
  const retry=await call('commissions/carpenter',{revision:ready.revision,operation:latest.lastOperation});
  assert.equal(retry.status,200);
  assert.equal(retry.revision,latest.revision);
  assert.equal(retry.state.credits,160);
  assert.equal((await submit(latest.revision)).status,400);
  const handoff=await call('save',{revision:latest.revision,operation:'old-client-save',state:{...latest.state,carpenterOrderComplete:false}});
  assert.equal(handoff.state.carpenterOrderComplete,true);
  assert.equal(handoff.state.credits,160);
});
