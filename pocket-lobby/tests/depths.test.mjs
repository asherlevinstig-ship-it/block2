import {prepareDungeonBuild} from './helpers/combat-fixtures.mjs';
import test from 'node:test';
import {skillXpForLevel} from '../public/skill-curve.js';
import assert from 'node:assert/strict';
import {bankDepthsSpoils,clearDepthsStage,depthsStages,depthsSpoils,essenceCacheGold,depthsCacheRoom} from '../public/depths.js';
import {createHunt,huntEnemy,huntingTurn} from '../public/hunting.js';
import {normalizeState} from '../server/player-state.mjs';
import {touchPresence} from '../server/routines.mjs';
import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';
import {normalizeMagic} from '../public/essences.js';
import {handlePlayerApi} from '../server/player-api.mjs';
import {testDatabase} from './db-helper.mjs';
import {moonwood} from '../public/moonwood.js';

test('three chambers gate progress and bank only the cleared rewards once',()=>{
  let state=normalizeState({location:'depthsGate',depthsRun:{cleared:0},health:65,huntingLoot:{boar:1}});
  assert.throws(()=>bankDepthsSpoils(state),/Clear this chamber/);
  assert.equal(clearDepthsStage(state.depthsRun,'depthsVault'),false);
  assert.equal(clearDepthsStage(state.depthsRun,'depthsGate'),true);
  assert.equal(clearDepthsStage(state.depthsRun,'depthsGate'),false);
  assert.equal(state.credits,100);
  assert.equal(state.huntingLoot.boar,1);
  state=normalizeState(state);
  assert.deepEqual(bankDepthsSpoils(state),{gold:12,loot:{boar:1}});
  assert.equal(state.depthsRun,null);
  assert.equal(state.location,'ruins');
  assert.equal(state.health,65);
  assert.equal(state.credits,112);
  assert.equal(state.huntingLoot.boar,2);
  assert.throws(()=>bankDepthsSpoils(state),/Clear this chamber/);
  assert.deepEqual(depthsSpoils({cleared:3}),{gold:81,loot:{boar:1,stonebackShell:2}});
  const finalRun={cleared:2};
  assert.equal(depthsSpoils(finalRun).loot.moonwellShard,undefined);
  assert.equal(clearDepthsStage(finalRun,'depthsVault'),true);
  assert.deepEqual(depthsSpoils(finalRun),{gold:81,loot:{boar:1,stonebackShell:2,moonwellShard:1}});
});

test('every chamber enemy resumes in its own room and only a live chamber accepts an encounter',()=>{
  for(const [index,stage] of depthsStages.entries()){
    const encounter=createHunt(1000,undefined,stage.enemy);
    const state=normalizeState({location:stage.room,depthsRun:{cleared:index},hunting:{encounter}});
    assert.equal(state.hunting.encounter.enemy,stage.enemy);
    assert.equal(huntEnemy(state.hunting.encounter).room,stage.room);
    assert.throws(()=>normalizeState({...state,depthsRun:{cleared:index+1}}),/Invalid Moonwell Depths encounter/);
    assert.throws(()=>normalizeState({...state,depthsRun:null}),/Invalid Moonwell Depths progress/);
    if(index>0){
      const dodge=huntingTurn(encounter,100,{},'dodge',encounter.nextBoarAt-200);
      const slam=huntingTurn(dodge.encounter,100,{},'enemy',encounter.nextBoarAt);
      assert.equal(slam.shellExposed,index===2?undefined:true);
    }
  }
});

test('away rules cannot take a character out of a cleared chamber',()=>{
  const state=normalizeState({location:'depthsGate',depthsRun:{cleared:1},health:43,characterRules:{enabled:true,activity:'rest'}});
  state.routineLastSeen=1000;
  touchPresence(state,3000000);
  assert.equal(state.location,'depthsGate');
  assert.equal(state.health,43);
  assert.equal(state.depthsRun.cleared,1);
  assert.equal(state.report,undefined);
});

test('the sluice opens one crossing and its supply chest heals once per run',()=>{
  let state=normalizeState({location:'depthsGate',depthsRun:{cleared:0},position:{x:4,y:4},health:70});
  const inspect=(id)=>applyGameplayAction(state,'depthsInspect',{id},1000);
  assert.equal(moonwood.blocked(state.location,8,4,state.adventure,state.depthsRun),true);
  assert.throws(()=>inspect('gateSupply'),/Travel/);
  inspect('sluiceLever');
  assert.equal(moonwood.blocked(state.location,8,4,state.adventure,state.depthsRun),false);
  assert.equal(moonwood.blocked(state.location,8,3,state.adventure,state.depthsRun),true);
  state=normalizeState(state);
  state.position={x:9,y:4};
  inspect('gateSupply');
  assert.equal(state.health,85);
  inspect('gateSupply');
  assert.equal(state.health,85);
  assert.deepEqual(state.depthsRun.finds,['sluiceLever','gateSupply']);
});

test('the hidden cache requires a chime and pays once on banking, while the vault relief is optional',()=>{
  const state=normalizeState({location:'depthsGallery',depthsRun:{cleared:1},position:{x:8,y:6}});
  const inspect=(id)=>applyGameplayAction(state,'depthsInspect',{id},1000);
  assert.throws(()=>inspect('galleryCache'),/Choose/);
  assert.throws(()=>inspect('vaultRelief'),/Travel/);
  const forged=protectFishingState(state,{...state,depthsRun:{cleared:1,finds:['shellChime','galleryCache']}});
  assert.equal(forged.depthsRun.finds,undefined);
  state.position={x:3,y:4};
  inspect('shellChime');
  state.position={x:8,y:6};
  inspect('galleryCache');
  inspect('galleryCache');
  assert.equal(state.credits,100);
  assert.equal(depthsSpoils(state.depthsRun).gold,30);
  assert.throws(()=>bankDepthsSpoils(state),/Clear/);
  clearDepthsStage(state.depthsRun,'depthsGallery');
  assert.equal(bankDepthsSpoils(state).gold,54);
  assert.equal(state.credits,154);
  assert.throws(()=>bankDepthsSpoils(state),/Clear/);
  const vault=normalizeState({location:'depthsVault',depthsRun:{cleared:2},position:{x:3,y:4}});
  applyGameplayAction(vault,'depthsInspect',{id:'vaultRelief'},1000);
  assert.deepEqual(vault.depthsRun.finds,['vaultRelief']);
  assert.equal(depthsSpoils(vault.depthsRun).gold,36);
});


test('the optional cache needs its own guardian victory, pays once, and preserves main dungeon progress',()=>{
  const state=normalizeState({location:'depthsGate',depthsRun:{cleared:0},stats:{strengthXp:skillXpForLevel(21),vitalityXp:skillXpForLevel(21)}});
  let now=1000;
  const act=(name,body={})=>applyGameplayAction(state,name,body,now,()=>.5);
  const win=()=>{state.position={x:5,y:5};act('fight');state.hunting.encounter.health=1;now+=60000;act('combat',{combatId:state.combatId});};
  assert.throws(()=>act('depthsCacheEnter'),/Clear Shell Gallery/);
  win();act('depthsNext');
  assert.throws(()=>act('depthsCacheEnter'),/Clear Shell Gallery/);
  win();
  assert.equal(state.depthsRun.cleared,2);
  act('depthsCacheEnter');
  assert.equal(state.location,depthsCacheRoom);
  state.position={x:8,y:5};
  assert.throws(()=>act('depthsInspect',{id:'essenceCache'}),/Defeat/);
  const forged=protectFishingState(state,{...state,depthsRun:{cleared:2,cacheGuardDefeated:true,finds:['essenceCache']}});
  assert.equal(forged.depthsRun.cacheGuardDefeated,undefined);
  win();
  assert.equal(state.depthsRun.cleared,2);
  assert.equal(state.depthsRun.cacheGuardDefeated,true);
  assert.throws(()=>act('fight'),/Invalid encounter/);
  assert.throws(()=>act('depthsNext'),/Clear this chamber/);
  state.position={x:8,y:5};
  act('depthsInspect',{id:'essenceCache'});
  assert.equal(state.credits,100+essenceCacheGold);
  assert.equal(state.goldEarned,essenceCacheGold);
  assert.equal(state.magic.stones.shield,1);
  assert.equal(state.depthsRun.cacheStone,'shield');
  assert.deepEqual(normalizeState(state).depthsRun,state.depthsRun);
  act('depthsInspect',{id:'essenceCache'});
  assert.equal(state.magic.stones.shield,1);
  assert.equal(state.credits,100+essenceCacheGold);
  act('depthsCacheLeave');act('depthsCacheEnter');
  assert.equal(state.depthsRun.cacheGuardDefeated,true);
  act('depthsCacheLeave');act('depthsNext');
  assert.equal(state.location,'depthsVault');
  win();act('bank');
  assert.equal(state.credits,181+essenceCacheGold);
  assert.equal(state.goldEarned,81+essenceCacheGold);
  assert.equal(state.magic.stones.shield,1);
  assert.equal(state.depthsRun,null);
  act('depthsEnter');
  assert.equal(state.depthsRun.cacheGuardDefeated,undefined);
  assert.equal(state.depthsRun.finds,undefined);
});

test('cache capacity failures preserve the sealed reward, and claimed rewards survive defeat',()=>{
  const state=normalizeState({location:depthsCacheRoom,depthsRun:{cleared:2,cacheGuardDefeated:true},position:{x:8,y:5}});
  const inspect=()=>applyGameplayAction(state,'depthsInspect',{id:'essenceCache'},1000,()=>.5);
  state.credits=100000000;
  assert.throws(inspect,/wallet/);
  assert.equal(state.depthsRun.finds,undefined);
  state.credits=100;state.magic=normalizeMagic({stones:{shield:9999}});
  assert.throws(inspect,/Make room/);
  assert.equal(state.magic.nextStone,1);
  assert.equal(state.depthsRun.finds,undefined);
  state.magic.stones.shield=0;
  inspect();
  applyGameplayAction(state,'depthsCacheLeave',{},1000);
  applyGameplayAction(state,'depthsNext',{},1000);
  state.position={x:5,y:5};state.health=1;
  applyGameplayAction(state,'fight',{},1000);
  applyGameplayAction(state,'combat',{combatId:state.combatId},state.hunting.encounter.nextBoarAt,()=>.5);
  assert.equal(state.location,'hub');
  assert.equal(state.depthsRun,null);
  assert.equal(state.credits,100+essenceCacheGold);
  assert.equal(state.magic.stones.shield,1);
});

test('cache API retries and concurrent claims cannot pay twice',async t=>{
  const {db,sql}=testDatabase();t.after(()=>sql.close());
  const origin='https://tower.test';
  const session=await handlePlayerApi(new Request(origin+'/api/player/session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({legacy:{location:depthsCacheRoom,depthsRun:{cleared:2,cacheGuardDefeated:true,finds:['essenceCache'],cacheStone:'shield'}}})}),{TOWER_DB:db});
  const packet=await session.json(),cookie=session.headers.get('set-cookie').split(';')[0];
  assert.equal(packet.state.depthsRun.cacheGuardDefeated,undefined);
  assert.equal(packet.state.depthsRun.finds,undefined);
  assert.equal(packet.state.depthsRun.cacheStone,undefined);
  const seed=normalizeState({location:depthsCacheRoom,depthsRun:{cleared:2,cacheGuardDefeated:true},position:{x:8,y:5}});
  sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(seed),packet.characterKey);
  const operation=crypto.randomUUID();
  const claim=(op,revision=packet.revision)=>handlePlayerApi(new Request(origin+'/api/player/gameplay/depthsInspect',{
    method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},
    body:JSON.stringify({id:'essenceCache',characterKey:packet.characterKey,revision,operation:op})
  }),{TOWER_DB:db});
  const sealed={...seed,depthsRun:{cleared:2}};
  sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(sealed),packet.characterKey);
  const blocked=await claim(crypto.randomUUID());assert.equal(blocked.status,400);
  assert.match((await blocked.json()).error,/Defeat the Cache Guardian/);
  sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(seed),packet.characterKey);
  const first=await claim(operation);assert.equal(first.status,200);
  const awarded=await first.json();
  const retry=await claim(operation);assert.equal(retry.status,200);
  assert.equal((await retry.json()).state.credits,100+essenceCacheGold);
  const [a,b]=await Promise.all([claim(crypto.randomUUID(),awarded.revision),claim(crypto.randomUUID(),awarded.revision)]);
  assert.deepEqual([a.status,b.status].sort(),[200,409]);
  const row=sql.prepare('SELECT state_json FROM tower_players WHERE player_id=?').get(packet.characterKey);
  const final=JSON.parse(row.state_json);
  assert.equal(final.credits,100+essenceCacheGold);
  assert.equal(final.magic.stones.shield,1);
});


test('elite cache guardian rewards a prepared build across low and high combat rolls',()=>{
  assert.equal(essenceCacheGold,50);
  for(const roll of [0,.1,.5,.99]){
    const s=normalizeState({location:depthsCacheRoom,depthsRun:{cleared:2},position:{x:5,y:5},stats:{strengthXp:skillXpForLevel(5),agilityXp:skillXpForLevel(5),vitalityXp:skillXpForLevel(5)},combatGear:{ownedWeapons:['trainingSword','ironSword'],equippedWeapon:'ironSword',stonebackVestOwned:true,stonebackVestEquipped:true}});
    prepareDungeonBuild(s);applyGameplayAction(s,'fight',{},1000,()=>roll);
    applyGameplayAction(s,'combat',{combatId:s.combatId},30000,()=>roll);
    assert.equal(s.hunting.encounter,null);
    assert.equal(s.depthsRun?.cacheGuardDefeated,true);
    assert(s.health>0);
    assert.equal(s.combatGear.equippedWeapon,'ironSword');
    assert(s.magic.picks.length===3);
    assert.equal(s.credits,100);
    s.position={x:8,y:5};applyGameplayAction(s,'depthsInspect',{id:'essenceCache'},30000,()=>roll);
    assert.equal(s.credits,150);
  }
});


const forkReady=()=>normalizeState({location:'depthsGate',depthsRun:{cleared:1,routeChoice:'pending',finds:['sluiceLever']},health:65,position:{x:4,y:5},stats:{strengthXp:skillXpForLevel(21),vitalityXp:skillXpForLevel(21)}});
const passageAction=(state,name,body={},now=1000)=>applyGameplayAction(state,name,body,now,()=>.5);

test('the safe passage heals and pays once, rejoins the gallery and locks out the elite route',()=>{
  const s=forkReady();
  assert.throws(()=>passageAction(s,'depthsNext'),/Choose the safe/);
  assert.throws(()=>passageAction(s,'depthsCacheEnter'),/Clear Shell Gallery/);
  passageAction(s,'depthsPassage',{choice:'safe'});
  assert.equal(s.location,'depthsGallery');assert.equal(s.health,85);assert.equal(s.credits,110);
  assert.equal(s.goldEarned,10);assert.equal(s.depthsRun.routeChoice,'safe');
  assert.equal(normalizeState(s).depthsRun.routeChoice,'safe');
  assert.throws(()=>passageAction(s,'depthsPassage',{choice:'safe'}),/Choose an available/);
  assert.throws(()=>passageAction(s,'depthsCacheEnter'),/Clear Shell Gallery/);
  assert.equal(s.credits,110);
  s.position={x:5,y:5};passageAction(s,'fight');
  passageAction(s,'combat',{combatId:s.combatId},20000);
  assert.equal(s.depthsRun.cleared,2);
  assert.throws(()=>passageAction(s,'depthsCacheEnter'),/Clear Shell Gallery/);
  passageAction(s,'bank');
  assert.equal(s.credits,146);assert.equal(s.depthsRun,null);
  passageAction(s,'depthsEnter');
  assert.equal(s.depthsRun.routeChoice,'pending');
});

test('dangerous passage survives fleeing, requires the elite and rejoins the same main route',()=>{
  const s=forkReady();passageAction(s,'depthsPassage',{choice:'dangerous'});
  assert.equal(s.location,depthsCacheRoom);assert.equal(s.health,65);assert.equal(s.credits,100);
  assert.equal(normalizeState(s).depthsRun.routeChoice,'dangerous');
  s.position={x:5,y:5};passageAction(s,'fight',{},2000);
  passageAction(s,'combat',{combatId:s.combatId,input:'flee'},2100);
  assert.equal(s.location,'depthsGate');assert.equal(s.depthsRun.routeChoice,'dangerous');
  assert.throws(()=>passageAction(s,'depthsNext'),/face its guardian/);
  assert.throws(()=>passageAction(s,'depthsPassage',{choice:'safe'}),/Choose an available/);
  const forged=protectFishingState(s,{...s,depthsRun:{cleared:1,routeChoice:'safe',cacheGuardDefeated:true}});
  assert.equal(forged.depthsRun.routeChoice,'dangerous');assert.equal(forged.depthsRun.cacheGuardDefeated,undefined);
  passageAction(s,'depthsCacheEnter');
  s.position={x:5,y:5};passageAction(s,'fight',{},3000);s.hunting.encounter.health=1;
  passageAction(s,'combat',{combatId:s.combatId},23000);
  assert.equal(s.depthsRun.cacheGuardDefeated,true);assert.equal(s.depthsRun.cleared,1);
  s.position={x:8,y:5};passageAction(s,'depthsInspect',{id:'essenceCache'},23000);
  assert.equal(s.credits,150);assert.equal(s.magic.stones.shield,1);
  passageAction(s,'depthsCacheLeave');
  assert.equal(s.location,'depthsGallery');assert.equal(s.depthsRun.cleared,1);
  assert.equal(normalizeState(s).location,'depthsGallery');
  passageAction(s,'depthsCacheEnter');
  assert.equal(s.depthsRun.cacheGuardDefeated,true);
  passageAction(s,'depthsCacheLeave');
  s.position={x:5,y:5};passageAction(s,'fight',{},24000);s.hunting.encounter.health=1;
  passageAction(s,'combat',{combatId:s.combatId},44000);
  passageAction(s,'depthsNext');assert.equal(s.location,'depthsVault');
});

test('passages cap healing, preserve pending choices on capacity failure and leave old runs playable',()=>{
  const full=forkReady();full.health=100;passageAction(full,'depthsPassage',{choice:'safe'});
  assert.equal(full.health,100);assert.equal(full.credits,110);
  const capped=forkReady();capped.credits=100000000;
  assert.throws(()=>passageAction(capped,'depthsPassage',{choice:'safe'}),/Make room/);
  assert.equal(capped.health,65);assert.equal(capped.depthsRun.routeChoice,'pending');
  assert.throws(()=>passageAction(capped,'depthsPassage',{choice:'other'}),/Choose/);
  const legacy=normalizeState({location:'depthsGate',depthsRun:{cleared:1}});
  passageAction(legacy,'depthsNext');assert.equal(legacy.location,'depthsGallery');
  legacy.depthsRun.cleared=2;passageAction(legacy,'depthsCacheEnter');
  assert.equal(legacy.location,depthsCacheRoom);
  assert.throws(()=>normalizeState({...capped,depthsRun:{cleared:1,routeChoice:'other'}}),/Invalid dungeon passage/);
});

test('concurrent passage choices and retries commit only one route and one reward',async t=>{
  const {db,sql}=testDatabase();t.after(()=>sql.close());
  const origin='https://tower.test';
  const session=await handlePlayerApi(new Request(origin+'/api/player/session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({legacy:{location:'depthsGate',health:95,depthsRun:{cleared:1,routeChoice:'pending'}}})}),{TOWER_DB:db});
  const initial=await session.json(),cookie=session.headers.get('set-cookie').split(';')[0];
  sql.prepare("UPDATE tower_players SET state_json=json_set(state_json,'$.position',json_object('x',3,'y',5)) WHERE player_id=?").run(initial.characterKey);
  const lever=await handlePlayerApi(new Request(origin+'/api/player/gameplay/depthsInspect',{
    method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},
    body:JSON.stringify({id:'sluiceLever',characterKey:initial.characterKey,revision:initial.revision,operation:crypto.randomUUID()})
  }),{TOWER_DB:db});
  assert.equal(lever.status,200);
  const packet=await lever.json();
  const safeOperation=crypto.randomUUID(),dangerOperation=crypto.randomUUID();
  const choose=(choice,operation)=>handlePlayerApi(new Request(origin+'/api/player/gameplay/depthsPassage',{
    method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},
    body:JSON.stringify({choice,characterKey:packet.characterKey,revision:packet.revision,operation})
  }),{TOWER_DB:db});
  const [safe,danger]=await Promise.all([choose('safe',safeOperation),choose('dangerous',dangerOperation)]);
  assert.deepEqual([safe.status,danger.status].sort(),[200,409]);
  const winner=await (safe.status===200?safe:danger).json();
  const choice=winner.state.depthsRun.routeChoice;
  const retry=await choose(choice,choice==='safe'?safeOperation:dangerOperation);
  assert.equal(retry.status,200);
  const retried=await retry.json();
  assert.equal(retried.state.depthsRun.routeChoice,choice);
  assert.equal(retried.state.credits,choice==='safe'?110:100);
  assert.equal(retried.state.health,choice==='safe'?100:95);
});
