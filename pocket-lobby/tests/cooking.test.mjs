import test from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './db-helper.mjs';
import {handlePlayerApi} from '../server/player-api.mjs';
import {applyGameplayAction} from '../server/gameplay.mjs';
import {normalizeState} from '../server/player-state.mjs';
import {createHunt} from '../public/hunting.js';

test('cooking spends ingredients at the campfire and meals only heal between fights',()=>{
  const state=normalizeState({
    location:'trail',position:{x:1,y:5},health:25,
    fishStock:{silverfin:1,silverfin_rare:1},huntingLoot:{boar:1},woodcutting:{timber:2}
  });
  const act=(name,id)=>applyGameplayAction(state,name,{id},1000);
  assert.throws(()=>act('cook','grilledSilverfin'),/beside the campfire/);
  state.position={x:3,y:5};
  act('cook','grilledSilverfin');
  assert.equal(state.fishStock.silverfin,0);
  assert.equal(state.fishStock.silverfin_rare,1);
  act('cook','boarStew');
  assert.equal(state.huntingLoot.boar,0);
  assert.equal(state.woodcutting.timber,0);
  assert.throws(()=>act('cook','grilledSilverfin'),/ingredients/);
  state.location='depthsGate';
  state.depthsRun={cleared:0};
  state.hunting.encounter=createHunt(1000,62,'depthsBoar');
  assert.throws(()=>act('eat','grilledSilverfin'),/fighting/);
  assert.equal(state.meals.grilledSilverfin,1);
  state.hunting.encounter=null;
  state.depthsRun.cleared=1;
  act('eat','grilledSilverfin');
  assert.equal(state.health,45);
  act('eat','boarStew');
  assert.equal(state.health,85);
  assert.deepEqual(state.meals,{});
  assert.equal(state.depthsRun.cleared,1);
});

test('concurrent cooking and eating spend once, and saves cannot forge meals or health',async t=>{
  const {db,sql}=testDatabase();t.after(()=>sql.close());
  let cookie='',packet;
  async function call(path,body){
    const response=await handlePlayerApi(new Request('https://tower.test/api/player/'+path,{
      method:body?'POST':'GET',headers:{Cookie:cookie,Origin:'https://tower.test','Content-Type':'application/json'},
      body:body?JSON.stringify({...body,characterKey:packet?.characterKey}):undefined
    }),{TOWER_DB:db});
    cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;
    const data=await response.json();if(response.ok)packet=data;
    return response.status;
  }
  const send=(path,body)=>call(path,{...body,revision:packet.revision,operation:crypto.randomUUID()});
  await call('session',{legacy:{location:'trail',position:{x:3,y:5},health:90,stats:{cookingXp:999},huntingLoot:{boar:1},woodcutting:{timber:1},meals:{boarStew:50}}});
  assert.deepEqual(packet.state.meals,{});assert.equal(packet.state.stats.cookingXp,undefined);
  for(const action of ['cook','eat']){
    const results=await Promise.all([send('gameplay/'+action,{id:'boarStew'}),send('gameplay/'+action,{id:'boarStew'})]);
    assert.deepEqual(results.sort(),[200,409]);
    await call('state');
    if(action==='cook'){
      assert.deepEqual(packet.state.meals,{boarStew:1});assert.equal(packet.state.stats.cookingXp,10);
      await send('save',{state:{...packet.state,stats:{...packet.state.stats,cookingXp:999},meals:{boarStew:500},health:1}});
      assert.deepEqual(packet.state.meals,{boarStew:1});assert.equal(packet.state.stats.cookingXp,10);
      assert.equal(packet.state.health,90);
    }
  }
  assert.equal(packet.state.health,100);
  assert.deepEqual(packet.state.meals,{});
  assert.equal(packet.state.woodcutting.timber,0);
  assert.equal(packet.state.huntingLoot.boar,0);
  assert.equal(await send('gameplay/eat',{id:'boarStew'}),400);
});
