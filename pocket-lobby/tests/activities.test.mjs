import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeState,startPlan} from '../server/player-state.mjs';
import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';
import {settleActivities} from '../server/activities.mjs';
import {handlePlayerApi} from '../server/player-api.mjs';
import {testDatabase} from './db-helper.mjs';
import {moonwood} from '../public/moonwood.js';

const action=(s,name,body={},now=1000,random=()=>.5)=>applyGameplayAction(s,name,body,now,random);
const fighter=(extra={})=>normalizeState({location:'clearing',position:{x:5,y:5},...extra});
test('server chopping checks real trees, adjacency, elapsed time and regrowth; duplicate cuts do not pay',()=>{
  const s=normalizeState({location:'logging',position:{x:4,y:4}});
  action(s,'axe');action(s,'axe');assert(s.woodcutting.axeOwned);
  s.position={x:5,y:5};
  assert.throws(()=>action(s,'chop',{x:5,y:6}),/tree/);
  assert.throws(()=>action(s,'chop',{x:1,y:1}),/beside/);
  action(s,'chop',{x:6,y:5});
  assert.throws(()=>startPlan(s,{kind:'woodcutting',hours:1},1000),/chopping/);
  const first=s.timberCut;
  action(s,'chop',{x:6,y:5},2000);assert.equal(s.timberCut.id,first.id);
  assert.throws(()=>action(s,'cut',{x:6,y:5,cutId:first.id},first.endsAt-1),/timing/);
  for(let i=0;i<3;i++){
    const cut=s.timberCut;
    action(s,'cut',{x:6,y:5,cutId:cut.id,timber:99999},cut.endsAt);
    assert.equal(s.woodcutting.timber,i+1);
    assert.throws(()=>action(s,'cut',{x:6,y:5,cutId:cut.id},cut.endsAt+1),/timing|regrowth/);
  }
  assert.equal(s.woodcutting.xp,30);
  const regrows=s.woodcutting.trees['logging:6,5'].regrowsAt;
  assert.throws(()=>action(s,'chop',{x:6,y:5},regrows-1),/regrowth/);
  action(s,'chop',{x:6,y:5},regrows);assert(s.timberCut);
  // Every rendered forest tree comes from the same server-imported world layout.
  for(const [room,layout] of Object.entries(moonwood.layouts))for(const tree of layout.scenery.filter(i=>i.type==='wildtree')){
    s.location=room;s.position={x:tree.x+1,y:tree.y};delete s.timberCut;
    action(s,'chop',tree,regrows);assert.equal(s.timberCut.key,room+':'+tree.x+','+tree.y);
  }
});

test('server combat replays both clocks, awards victory once, and keeps damage and cooldowns',()=>{
  const s=fighter({quest:{accepted:true,fish:3}});
  action(s,'fight');const id=s.combatId;
  action(s,'combat',{combatId:id,damage:999999,health:1},1100);
  assert.equal(s.hunting.encounter.health,70);
  action(s,'combat',{combatId:id},11000);
  assert.equal(s.hunting.encounter,null);assert.equal(s.huntingLoot.boar,1);
  assert.equal(s.stats.strengthXp,15);assert(s.health<100);
  assert.equal(s.quest.boars,1);assert(s.history.boarDefeated);
  const hp=s.health,respawn=s.hunting.respawnAt;
  action(s,'combat',{combatId:id},12000);
  assert.equal(s.huntingLoot.boar,1);assert.equal(s.health,hp);
  assert.throws(()=>action(s,'fight',{},respawn-1),/return/);
  action(s,'fight',{},respawn);
  assert.notEqual(s.combatId,id);
  assert.throws(()=>action(s,'combat',{combatId:id},respawn+500),/Invalid encounter/);
});

test('dodge, flee, defeat and rest are governed by server time',()=>{
  const s=fighter();
  action(s,'fight',{},1000);
  action(s,'combat',{combatId:s.combatId,input:'dodge'},2100);
  assert.equal(s.hunting.encounter.stamina,60);
  action(s,'combat',{combatId:s.combatId},2300);
  assert(s.combatReceipt.events.some(e=>e.timedDodge));assert.equal(s.health,100);
  action(s,'combat',{combatId:s.combatId,input:'flee'},3900,()=>0);
  assert.equal(s.location,'trail');assert.equal(s.huntingLoot.boar??0,0);
  const doomed=fighter({health:1});action(doomed,'fight',{},1000);
  settleActivities(doomed,100000,()=>.5);
  assert.equal(doomed.location,'hub');assert.equal(doomed.health,100);
  assert.equal(doomed.hunting.encounter,null);assert.equal(doomed.huntingLoot.boar??0,0);
  s.location='home';s.health=37;action(s,'rest',{},5000);
  action(s,'recover',{},16999);assert.equal(s.health,37);
  action(s,'recover',{},17000);assert.equal(s.health,100);
});

test('dungeon progress and banking require server victories; crafting consumes real materials',()=>{
  const s=fighter({location:'ruins',stats:{strengthXp:1000,vitalityXp:1000},depthsDiscovered:true,woodcutting:{timber:8}});
  action(s,'depthsEnter');assert.equal(s.depthsRun.cleared,0);
  assert.throws(()=>action(s,'depthsNext'),/Clear|clear/);
  assert.throws(()=>action(s,'bank'),/Clear/);
  let now=2000;
  for(let i=0;i<3;i++){
    s.position={x:5,y:5};action(s,'fight',{},now);
    now+=20000;action(s,'combat',{combatId:s.combatId},now);
    assert.equal(s.depthsRun.cleared,i+1);
    if(i<2)action(s,'depthsNext',{},now);
  }
  assert.equal(s.huntingLoot.moonwellShard,undefined);
  assert.equal(normalizeState(s).depthsRun.shardEarned,true);
  action(s,'bank',{},now);assert.equal(s.credits,181);assert.equal(s.goldEarned,81);
  assert.equal(s.huntingLoot.moonwellShard,1);
  const merchant=structuredClone(s);merchant.location='market';
  action(merchant,'sell',{id:'moonwellShard',quantity:1},now);
  assert.equal(merchant.credits,281);assert.equal(merchant.huntingLoot.moonwellShard,0);
  assert.throws(()=>action(merchant,'sell',{id:'moonwellShard',quantity:1},now),/quantity/);
  const crafter=structuredClone(s);crafter.location='logging';crafter.position={x:5,y:4};
  action(crafter,'charm',{},now);
  assert.equal(crafter.huntingLoot.moonwellShard,0);assert.equal(crafter.woodcutting.timber,4);
  assert.equal(crafter.combatGear.moonwellCharmEquipped,true);
  assert.throws(()=>action(crafter,'charm',{},now),/already/);
  action(crafter,'wearCharm',{equipped:false},now);
  assert.equal(crafter.combatGear.moonwellCharmEquipped,false);
  action(crafter,'wearCharm',{equipped:true},now);
  crafter.location='clearing';crafter.position={x:5,y:5};
  action(crafter,'fight',{},now);
  action(crafter,'combat',{combatId:crafter.combatId,input:'dodge'},now);
  action(crafter,'combat',{combatId:crafter.combatId},now+450);
  assert.equal(crafter.hunting.encounter.stamina,66.75);
  assert.throws(()=>action(crafter,'wearCharm',{equipped:false},now+450),/fighting/);
  assert.equal(s.huntingLoot.stonebackShell,2);
  assert.throws(()=>action(s,'bank',{},now),/Clear/);
  s.location='logging';s.position={x:5,y:4};action(s,'vest',{},now);
  assert.equal(s.woodcutting.timber,0);assert.equal(s.huntingLoot.stonebackShell,1);assert(s.combatGear.stonebackVestOwned);
  assert.throws(()=>action(s,'furniture',{id:'bookcase'},now),/timber/);
});

test('browser saves cannot forge combat, trees, health, loot, dungeon wins or crafted equipment',async t=>{
  const {db,sql}=testDatabase();t.after(()=>sql.close());let cookie='',key;
  async function call(path,body){
    const r=await handlePlayerApi(new Request('https://tower.test/api/player/'+path,{method:body?'POST':'GET',headers:{Cookie:cookie,Origin:'https://tower.test','Content-Type':'application/json'},body:body?JSON.stringify({...body,characterKey:key}):undefined}),{TOWER_DB:db});
    cookie=r.headers.get('set-cookie')?.split(';')[0]??cookie;const data=await r.json();key=data.characterKey??key;return {status:r.status,...data};
  }
  let p=await call('session',{legacy:{location:'clearing',position:{x:5,y:5},health:50}});
  p=await call('gameplay/fight',{revision:p.revision,operation:'fight'});assert.equal(p.status,200);
  const combatId=p.state.combatId;
  const forged={...p.state,location:'home',health:100,stats:{strengthXp:999999},huntingLoot:{boar:999999,moonwellShard:999999},hunting:{},woodcutting:{axeOwned:true,equipped:true,timber:999999,xp:999999},combatGear:{...p.state.combatGear,stonebackVestOwned:true,stonebackVestEquipped:true,moonwellCharmOwned:true,moonwellCharmEquipped:true},depthsRun:{cleared:3},depthsDiscovered:true,ownedFurniture:{bed:1,bookcase:100}};
  p=await call('save',{revision:p.revision,operation:'forge',state:forged});assert.equal(p.status,200);
  assert.equal(p.state.health,50);assert.equal(p.state.location,'clearing');assert.equal(p.state.stats.strengthXp,0);
  assert.equal(p.state.woodcutting.timber,0);assert.equal(p.state.woodcutting.axeOwned,false);
  assert.equal(p.state.combatGear.stonebackVestOwned===true,false);assert.equal(p.state.huntingLoot.boar??0,0);
  assert.equal(p.state.combatGear.moonwellCharmOwned,undefined);assert.equal(p.state.huntingLoot.moonwellShard,undefined);
  assert.equal(p.state.depthsRun,null);assert.equal(p.state.depthsDiscovered,false);assert.equal(p.state.ownedFurniture.bookcase,undefined);
  assert.equal(p.state.combatId,combatId);assert.equal(p.state.hunting.encounter.health,70);
  const req={revision:p.revision,operation:'parallel-combat',combatId};
  const responses=await Promise.all([call('gameplay/combat',req),call('gameplay/combat',{...req,operation:'other-tab'})]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
});

test('moving away cancels a paid chopping clock; snapshots cannot add or reset it',()=>{
  const s=normalizeState({location:'logging',position:{x:5,y:5},woodcutting:{axeOwned:true,equipped:true}});
  action(s,'chop',{x:6,y:5});
  const same=protectFishingState(s,normalizeState(protectFishingState(s,{...s,timberCut:{endsAt:0}})));
  assert.equal(same.timberCut.id,s.timberCut.id);
  const moved=protectFishingState(s,normalizeState(protectFishingState(s,{...s,position:{x:4,y:5}})));
  assert.equal(moved.timberCut,undefined);
  assert.equal(moved.woodcutting.timber,0);
});

test('persisted cut races pay once and refreshing a fight settles elapsed attacks instead of resetting them',async t=>{
  const {db,sql}=testDatabase();t.after(()=>sql.close());let cookie='',key;
  async function call(path,body){
    const response=await handlePlayerApi(new Request('https://tower.test/api/player/'+path,{method:body?'POST':'GET',headers:{Cookie:cookie,Origin:'https://tower.test','Content-Type':'application/json'},body:body?JSON.stringify({...body,characterKey:key}):undefined}),{TOWER_DB:db});
    cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;const data=await response.json();key=data.characterKey??key;return {status:response.status,...data};
  }
  let p=await call('session',{legacy:{location:'logging',position:{x:5,y:5},woodcutting:{axeOwned:true,equipped:true}}});
  p=await call('gameplay/chop',{operation:'chop',revision:p.revision,x:6,y:5});
  const early=await call('gameplay/cut',{operation:'early',revision:p.revision,x:6,y:5,cutId:p.state.timberCut.id});assert.equal(early.status,400);
  // Fast-forward only the persisted server clock to avoid sleeping in the test.
  p.state.timberCut.endsAt=Date.now()-1;
  sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(p.state),key);
  const request={revision:p.revision,operation:'cut',x:6,y:5,cutId:p.state.timberCut.id};
  const race=await Promise.all([call('gameplay/cut',request),call('gameplay/cut',{...request,operation:'cut-other-tab'})]);
  assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
  p=await call('state');assert.equal(p.state.woodcutting.timber,1);assert.equal(p.state.woodcutting.xp,10);
  const repeat=await call('gameplay/cut',{...request,revision:p.revision,operation:'reused-cut'});assert.equal(repeat.status,400);
  p=await call('save',{operation:'to-clearing',revision:p.revision,state:{...p.state,location:'clearing',position:{x:5,y:5}}});
  p=await call('gameplay/fight',{operation:'fight',revision:p.revision});
  const elapsed=Date.now()-10000;
  p.state.hunting.encounter.nextPlayerAt=elapsed+450;p.state.hunting.encounter.nextBoarAt=elapsed+1300;
  sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(p.state),key);
  const resumed=await call('state');assert.equal(resumed.state.hunting.encounter,null);
  assert.equal(resumed.state.huntingLoot.boar,1);assert.equal(resumed.state.stats.strengthXp,15);assert(resumed.state.health<100);
  const twice=await call('state');assert.equal(twice.state.huntingLoot.boar,1);assert.equal(twice.state.stats.strengthXp,15);
});
