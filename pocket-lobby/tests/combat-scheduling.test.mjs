import test from 'node:test';
import assert from 'node:assert/strict';
import {combatSchedule,nextCombatEventAt} from '../server/combat-schedule.mjs';
import {advanceServerCombat,startCombatEncounter} from '../server/activities.mjs';
import {normalizeState} from '../server/player-state.mjs';
import {huntEnemies} from '../public/hunting.js';
import {prepareDungeonBuild} from './helpers/combat-fixtures.mjs';
import {spawnAddWave} from '../public/dungeon-adds.js';
import {runCombatCostScenario} from './helpers/combat-cost-harness.mjs';

function fighter(enemy='boar',extra={}){
 const s=normalizeState({location:huntEnemies[enemy].room,position:{x:5,y:5},adventure:{millCellarFound:true},characterRules:{combat:{enabled:true,dodge:true,q:true,e:true,fleeBelow:0}},...extra});
 if(enemy.startsWith('depths')||['cacheGuardian','sealGuardian'].includes(enemy))prepareDungeonBuild(s);
 startCombatEncounter(s,huntEnemies[enemy],1000);return s;
}
const semantic=e=>[e.at,e.action,e.enemyId,e.power,e.damage,e.taken,e.outcome,e.addKill,e.decision];
const outcome=s=>Object.fromEntries(['health','hunting','stats','magic','huntingLoot','location','position','depthsRun','combatReports'].map(k=>[k,s[k]]));

test('the combat clock chooses strikes, burns, warnings, tactics and enemy thinking without changing state',()=>{
 const s=fighter(),before=structuredClone(s);
 assert.equal(nextCombatEventAt(s),1450);assert.deepEqual(s,before);
 s.hunting.encounter.burn={nextAt:1200,until:2000,damage:2};assert.equal(nextCombatEventAt(s),1200);
 const arena=fighter('millCustodian'),e=arena.hunting.encounter;
 arena.characterRules.combat.enabled=false;
 e.nextPlayerAt=10000;e.brainNextThinkAt=1100;assert.equal(nextCombatEventAt(arena),1100);
 e.brainNextThinkAt=10000;
 const warning=combatSchedule(arena);assert.equal(warning.at,warning.warningAt);
 e.arenaLockedFor=e.nextBoarAt;assert.equal(nextCombatEventAt(arena),e.nextBoarAt);
 const flee=fighter();flee.characterRules.combat.fleeBelow=40;flee.health=30;
 assert.equal(combatSchedule(flee).tactic.action,'flee');assert.equal(nextCombatEventAt(flee),1150);
 assert.equal(nextCombatEventAt({}),Infinity);
});

test('reinforcement spawns and add clocks wake the actor, including automatic target selection',()=>{
 const s=fighter('cacheGuardian',{depthsRun:{cleared:2}}),e=s.hunting.encounter;
 e.nextPlayerAt=e.nextBoarAt=e.brainNextThinkAt=10000;e.arenaLockedFor=e.nextBoarAt;e.addWaveAt=1200;
 s.characterRules.combat.enabled=false;assert.equal(nextCombatEventAt(s),1200);
 s.hunting.encounter=spawnAddWave(e,1200).encounter;
 const adds=s.hunting.encounter.adds;for(const a of adds){a.thinkAt=3000;a.attackAt=10000;a.lockedFor=a.attackAt;}
 adds[0].burn={nextAt:2700,until:5000,damage:2};assert.equal(nextCombatEventAt(s),2700);
 s.characterRules.combat.enabled=true;s.hunting.encounter.tacticsAt=6000;
 const before=structuredClone(s);combatSchedule(s);assert.deepEqual(s,before,'scheduler does not persist target changes');
});

for(const enemy of ['boar','beetle','millCustodian','crystalGuardian','depthsBoar','cacheGuardian','depthsGuardian'])test('event-driven replay preserves '+enemy+' damage, spell timing, rewards and outcome',()=>{
 const extra=enemy.startsWith('depths')||enemy==='cacheGuardian'?{depthsRun:{cleared:enemy==='depthsBoar'?0:enemy==='depthsGuardian'?3:2,routeChoice:'dangerous'},stats:{strengthXp:1000,agilityXp:1000,vitalityXp:1000},combatGear:{ownedWeapons:['ironSword'],equippedWeapon:'ironSword'}}:{};
 const scheduled=fighter(enemy,extra),polled=structuredClone(scheduled),scheduledEvents=[],pollEvents=[];
 let last=1000,wakes=0;
 while(scheduled.hunting.encounter&&wakes++<1500){
  const at=Math.max(last,nextCombatEventAt(scheduled));if(at>91000)break;
  const before=JSON.stringify(scheduled.hunting.encounter);
  scheduledEvents.push(...advanceServerCombat(scheduled,at,()=>.5));
  assert.notEqual(JSON.stringify(scheduled.hunting.encounter),before,'each scheduled wake changes the combat state');
  last=at;
 }
 assert(wakes<1500,'no scheduling loop');
 for(let at=1000;at<=91000;at+=100)pollEvents.push(...advanceServerCombat(polled,at,()=>.5));
 assert.deepEqual(scheduledEvents.map(semantic),pollEvents.map(semantic));
 assert.deepEqual(outcome(scheduled),outcome(polled));
 const earned=structuredClone(scheduled.stats);advanceServerCombat(scheduled,200000,()=>.5);
 if(!polled.hunting.encounter)assert.deepEqual(scheduled.stats,earned,'completed fight cannot pay twice');
});

test('actor scheduling removes empty half-second reads without changing a starter hunt or retreat',async()=>{
 for(const flee of [false,true]){
  const old=await runCombatCostScenario({fixedPolling:true,flee}),next=await runCombatCostScenario({fixedPolling:false,flee});
  for(const key of ['outcome','health','stats','loot','hunts'])assert.deepEqual(next[key],old[key],key);
  assert(next.counts.alarms<=old.counts.alarms,'no extra alarms in the starter scenarios');assert(next.elapsedMs<=old.elapsedMs,'safety decisions are delivered sooner');
  if(!flee){assert(next.counts.alarms<old.counts.alarms,'fewer combat alarms');assert(next.counts.reads<old.counts.reads,'fewer state reads');assert(next.counts.alarms<=8&&next.counts.reads<=9,'starter combat operation budget');}
 }
});

test('reaching the Auto time cap mid-fight never schedules an already expired alarm',async()=>{
 const result=await runCombatCostScenario({sessionCapMs:1000});
 assert.equal(result.outcome,'away-cap');assert.equal(result.hunts.wins,1);assert.equal(result.loot.boar,1);
 assert(result.counts.alarms<=10,'the capped fight has a bounded number of wake-ups');
});
