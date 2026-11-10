import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeState,settlePlan} from '../server/player-state.mjs';import {touchPresence} from '../server/routines.mjs';import {chooseGoldTask,safeHuntPreview} from '../server/gold-planner.mjs';import {normalizeCharacterRules} from '../public/character-rules.js';import {skillXpForLevel} from '../public/skill-curve.js';import {boot} from './helpers/game-client.mjs';import {autoStatus} from '../public/auto-mode.js';
import {handlePlayerApi} from '../server/player-api.mjs';import {testDatabase} from './db-helper.mjs';
const character=extra=>normalizeState({location:'home',bedLessonComplete:true,adventure:{discovered:['pond']},characterRules:{enabled:true,strategy:'earnGold'},...extra});
function start(s){s.controlMode='auto';s.routineLastSeen=1000;touchPresence(s,1000,{forceStart:true,active:false,random:()=>.5});return s;}
test('gold goal is opt-in, validates every limit and preserves exact queue choices',()=>{
 assert.equal(normalizeCharacterRules().strategy,'routine');
 for(const input of [{strategy:'fake'},{goldPolicy:{budget:-1}},{goldPolicy:{keepFish:1.5}},{goldPolicy:{minHealth:20}}])assert.throws(()=>normalizeCharacterRules(input),/Choose/);
 const r=normalizeCharacterRules({strategy:'earnGold',queue:{enabled:true,steps:[{type:'woodcutting',amount:9}]}});assert.equal(r.queue.steps[0].amount,9);assert.equal(normalizeCharacterRules({...r,strategy:'routine'}).queue.steps[0].amount,9);
});
test('surplus sales protect category reserves and never sell shards, meals or gear',()=>{
 const s=start(character({fishStock:{silverfin:3},huntingLoot:{boar:4,stonebackShell:5,moonwellShard:7},woodcutting:{timber:20,xp:0},characterRules:{strategy:'earnGold',goldPolicy:{keepFish:2,keepTimber:19,keepMeat:3,keepShells:4}}}));
 settlePlan(s,61000,{random:()=>.5});assert.equal(s.fishStock.silverfin,2);assert.equal(s.woodcutting.timber,19);assert.equal(s.huntingLoot.boar,3);assert.equal(s.huntingLoot.stonebackShell,4);assert.equal(s.huntingLoot.moonwellShard,7);assert.equal(s.credits,184);assert.equal(s.plan.goldEarned,84);
});
test('injured characters choose safe gathering; critical health rests first',()=>{
 const s=start(character({health:50}));assert.equal(s.plan.queue.steps[0].type,'fishing');assert.match(s.plan.plannerReason,/too low/);
 const rest=start(character({health:20}));assert.equal(rest.plan.queue.steps[0].type,'rest');settlePlan(rest,17000,{random:()=>.5});assert.equal(rest.health,100);assert.equal(rest.plan.queue.steps[0].type,'fishing');
});
test('bait buying respects a total budget and gold reserve and stops when no work remains',()=>{
 const s=start(character({fishingGear:{ownedRods:['reed'],equippedRod:'reed',bait:5},characterRules:{strategy:'earnGold',goldPolicy:{budget:10,reserveGold:90}}}));assert.equal(s.plan.queue.steps[0].type,'buyBait');settlePlan(s,16001,{random:()=>.5});assert.equal(s.credits,90);assert.equal(s.fishingGear.bait,15);assert.equal(s.plan.goldSpent,10);
 settlePlan(s,2000000,{random:()=>.5});assert.equal(s.plan,undefined);assert.equal(s.report.reason,'no-safe-work');assert.equal(s.report.goldSpent,10);assert.equal(s.fishingGear.bait,5);assert(s.credits>100);
 const blocked=start(character({fishingGear:{ownedRods:['reed'],equippedRod:'reed',bait:5},characterRules:{strategy:'earnGold',goldPolicy:{budget:100,reserveGold:100}}}));assert.equal(blocked.report.reason,'no-safe-work');assert.equal(blocked.credits,100);
});
test('hunt selection requires unlocked grounds and conservative survival with equipped gear',()=>{
 const novice=character({health:80,history:{boarDefeated:true}});assert.equal(safeHuntPreview(novice,'boar',80),null);
 const stats={strengthXp:skillXpForLevel(10),agilityXp:skillXpForLevel(10),vitalityXp:skillXpForLevel(10)};
 const strong=start(character({stats,history:{boarDefeated:true},combatGear:{ownedWeapons:['ironSword'],equippedWeapon:'ironSword'}}));assert.equal(strong.plan.queue.steps[0].type,'huntBoars');assert.match(strong.plan.plannerReason,/conservative/);
 const fresh=character({stats,combatGear:{ownedWeapons:['ironSword'],equippedWeapon:'ironSword'}});fresh.history.boarDefeated=false;const unseen=start(fresh);assert.equal(unseen.plan.queue.steps[0].type,'fishing');
});
test('continuous adaptive planning matches fine polling, preserves reserves, and stops at the offline cap',()=>{
 const setup=()=>start(character({meals:{silverfinFeast:10},woodcutting:{axeOwned:true,equipped:true,timber:0,xp:0},fishingGear:{ownedRods:['reed'],equippedRod:'reed',bait:5}}));
 const online=setup(),offline=setup();for(let at=1000;at<=3601000;at+=1000)settlePlan(online,at,{random:()=>.5});settlePlan(offline,3601000,{random:()=>.5});
 for(const key of ['credits','woodcutting','stats'])assert.deepEqual(online[key],offline[key]);assert.equal(online.plan.goldEarned,offline.plan.goldEarned);assert(online.woodcutting.timber>=10);assert(online.plan.entries.length<=64);
 settlePlan(offline,24*3600000,{random:()=>.5});assert.equal(offline.report.reason,'away-cap');assert.equal(offline.controlMode,'play');const gold=offline.credits;settlePlan(offline,48*3600000,{random:()=>.5});assert.equal(offline.credits,gold);
});
test('manual handoff and visible goal explanation use the shared Auto flow',()=>{
 const s=start(character());assert.match(autoStatus(s).decision,/Fishing/);assert.match(autoStatus(s).next,/Reassess/);settlePlan(s,62000,{stop:true,random:()=>.5});assert.equal(s.report.reason,'returned');assert.equal(Object.values(s.report.catches).reduce((a,b)=>a+b,0),1);
 const g=boot(character());g.run('openAdvancedCharacterRules()');assert.equal(g.nodes.get('rulesStrategy').value,'earnGold');assert.equal(g.nodes.get('rulesGoldPolicy').hidden,false);assert.equal(g.nodes.get('rulesExactQueue').hidden,true);assert.deepEqual(g.errors,[]);
});
test('gold goal never spends on a previously saved equipment upgrade',()=>{
 const s=start(character({credits:1000,characterRules:{strategy:'earnGold',goldPolicy:{budget:1000,reserveGold:0},goal:{target:'weapon:ironSword',autoBuy:true}}}));settlePlan(s,320000,{random:()=>.5});assert.equal(s.combatGear.ownedWeapons.includes('ironSword'),false);assert.equal(s.plan.goalResult,undefined);assert.equal(s.plan.goldSpent,0);
});
test('API concurrent offline settlement pays surplus once and retains chosen limits after handoff',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());const clock=Date.now;let now=1000;Date.now=()=>now;t.after(()=>Date.now=clock);const origin='https://tower.test';let packet,cookie='';
 async function call(path,body){const r=await handlePlayerApi(new Request(origin+'/api/player/'+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify({...body,characterKey:packet?.characterKey}):undefined}),{TOWER_DB:db});cookie=r.headers.get('set-cookie')?.split(';')[0]??cookie;const data=await r.json();if(r.ok)packet=data;return {status:r.status,...data};}
 const act=(path,body)=>call(path,{revision:packet.revision,operation:crypto.randomUUID(),...body});
 await call('session',{legacy:character({fishStock:{silverfin:8}})});await act('rules/save',{rules:{strategy:'earnGold',goldPolicy:{keepFish:3,budget:10,reserveGold:100}}});assert.equal((await act('control',{mode:'auto'})).status,200);
 now=16000;for(const r of await Promise.all([call('state'),call('state')])){assert.equal(r.status,200);assert.equal(r.state.credits,125);assert.equal(r.state.fishStock.silverfin,3);assert.equal(r.state.plan.goldEarned,25);}
 assert.equal((await act('control',{mode:'play'})).status,200);assert.equal(packet.state.report.goldEarned,25);assert.equal(packet.state.characterRules.goldPolicy.keepFish,3);assert.equal(packet.state.credits,125);
});
