import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeState} from '../server/player-state.mjs';import {applyGameplayAction} from '../server/gameplay.mjs';import {advanceServerCombat} from '../server/activities.mjs';
import {huntingTurn,huntEnemy,enemyAttack,normalizeHunting} from '../public/hunting.js';import {platedDefence,enemyRoleInfo} from '../public/enemy-roles.js';
import {brainThinkEvent} from '../public/enemy-brain.js';import {spawnAddWave} from '../public/dungeon-adds.js';import {castEssencePower} from '../server/essences.mjs';import {powerDescription,essencePower,bladeSplash} from '../public/essences.js';
import {recordCombatFx} from '../public/combat-fx.js';import {boot} from './helpers/game-client.mjs';
function fighter(room='depthsGallery',auto=false){const s=normalizeState({location:room,position:{x:5,y:5},depthsRun:{cleared:room==='depthsGate'?0:room==='depthsGallery'?1:2,routeChoice:'dangerous'},stats:{strengthXp:1000,agilityXp:1000,vitalityXp:1000},combatGear:{ownedWeapons:['trainingSword','ironSword'],equippedWeapon:'ironSword'},magic:{picks:['fire','ice','storm'],unlocked:['fire:sword','ice:sword','storm:sword'],slots:{q:'fire:sword',e:'storm:sword'}},characterRules:{combat:{enabled:auto,dodge:true,q:true,e:true,fleeBelow:0}}});applyGameplayAction(s,'fight',{},1000,()=>.5);return s;}
const hit=(s,e)=>huntingTurn({...e,nextPlayerAt:2000},100,s.stats,'attack',2000,()=>0,'ironSword');
test('committed plating rewards rear and side positions; recovery opens it without a damage sponge',()=>{
 const s=fighter(),e={...s.hunting.encounter,brainRecoveryUntil:0,brainOrigin:{x:6,y:5},arenaEnemy:{x:6,y:5},arenaTarget:{x:5,y:5},arenaLockedFor:4000,nextBoarAt:4000};
 const front=hit(s,{...e,arenaPlayer:{x:5,y:5}}),side=hit(s,{...e,arenaPlayer:{x:6,y:6}}),rear=hit(s,{...e,arenaPlayer:{x:7,y:5}}),recovery=hit(s,{...e,arenaPlayer:{x:5,y:5},brainRecoveryUntil:2500});
 assert(front.damage<side.damage);assert(side.damage<rear.damage);assert.equal(rear.shellGuarded,false);assert(rear.flanked);assert(recovery.damage>=rear.damage);assert(recovery.recoveryOpening);
 assert.equal(platedDefence({...e,arenaPlayer:{x:7,y:5}},2000),'rear');assert.equal(platedDefence({...e,arenaPlayer:{x:7,y:5},arenaLockedFor:0},2000),'front');
});
test('hunter circles toward a flank and exposes its landing; legacy encounters retain damage',()=>{
 const s=fighter('depthsGate'),e=s.hunting.encounter;Object.assign(e,{arenaPlayer:{x:3,y:5},arenaEnemy:{x:6,y:5},arenaSolids:[],brainRecoveryUntil:0,nextBoarAt:10000});
 const move=brainThinkEvent(s,huntEnemy(e),enemyAttack(e),2000);assert.match(move.behaviour,/flank/);assert.deepEqual(move.encounter.arenaEnemy,{x:5,y:5});
 const p={...e,arenaPlayer:{x:5,y:5},arenaEnemy:{x:6,y:5}},plain=hit(s,p),opening=hit(s,{...p,brainRecoveryUntil:2500});assert.equal(opening.damage,Math.round(plain.damage*1.25));assert.match(enemyRoleInfo({...p,brainRecoveryUntil:2500},2000).status,/LANDING/);
 const legacy={...p};delete legacy.brainVersion;assert.equal(hit(s,{...legacy,brainRecoveryUntil:2500}).damage,hit(s,legacy).damage);
});
test('the first chamber teaches one hunter before the gallery introduces a finite hatchling pack',()=>{
 assert.equal(fighter('depthsGate').hunting.encounter.addsVersion,undefined);const e=spawnAddWave(fighter().hunting.encounter,4500).encounter;assert.deepEqual(e.adds.map(a=>a.kind),['skitter','skitter']);assert.equal(new Set(e.adds.map(a=>a.id)).size,2);assert.deepEqual(normalizeHunting({encounter:e}).encounter.adds,e.adds);
});
function clustered(){const s=fighter();s.hunting.encounter=spawnAddWave(s.hunting.encounter,4500).encounter;Object.assign(s.hunting.encounter,{arenaEnemy:{x:6,y:5},nextPlayerAt:10000,nextBoarAt:20000,brainNextThinkAt:20000});s.hunting.encounter.adds.forEach((a,i)=>Object.assign(a,{x:6+i,y:6,health:10,spawnAt:5000}));return s;}
test('Fire Blade hits a cluster once, kills adds without clearing the room and uses one cooldown and mana charge',()=>{
 const s=clustered(),before=structuredClone(s),event=castEssencePower(s,6000,'q');assert.equal(event.splash.length,2);assert.equal(event.splashKills,2);assert.equal(event.encounter.adds.length,0);assert.equal(event.encounter.addKills,2);assert.equal(event.outcome,'fighting');assert(event.encounter.health>0);assert.equal(s.magic.cooldowns['fire:sword'],12500);assert.equal(castEssencePower(s,6001,'q'),null);assert.equal(s.actionPoints.value,before.actionPoints.value);
 assert.match(event.effect,/Splash/);const fx={};recordCombatFx(fx,event,1000);assert.deepEqual(fx.bursts[0].splash,event.splash);
});
test('splash respects distance, spawn time and selected target; Ice remains single target',()=>{
 const s=clustered(),[first,second]=s.hunting.encounter.adds;second.x=9;second.y=8;s.hunting.encounter.combatTarget=first.id;const e=castEssencePower(s,6000,'q');assert.equal(e.splash,undefined);assert.equal(e.encounter.adds.length,1);assert.equal(e.encounter.health,s.hunting.encounter.health);
 const ice=clustered();ice.magic.slots.q='ice:sword';assert.equal(castEssencePower(ice,6000,'q').splash,undefined);
 const pending=clustered();pending.hunting.encounter.adds.forEach(a=>a.spawnAt=7000);assert.equal(castEssencePower(pending,6000,'q').splash,undefined);assert.equal(bladeSplash(essencePower('fire:shield')),null);assert.match(powerDescription(essencePower('storm:sword')),/2 tiles/);
});
test('area damage can break the Channeler ward without granting its chamber rewards',()=>{
 const s=fighter('depthsCache');s.hunting.encounter=spawnAddWave(s.hunting.encounter,4500).encounter;s.hunting.encounter.adds.forEach((a,i)=>Object.assign(a,{x:6+i,y:6,health:1,spawnAt:5000}));const e=castEssencePower(s,6000,'q');assert(e.wardBroken);assert.equal(e.encounter.staggerWeakUntil,9000);assert.equal(e.outcome,'fighting');assert.equal(s.depthsRun.cacheGuardDefeated,undefined);
});
test('a manual area cast spends exactly one AP and cannot duplicate add kills on retry',()=>{
 const s=clustered();s.hunting.encounter.adds.forEach(a=>Object.assign(a,{thinkAt:20000,attackAt:25000}));const ap=s.actionPoints.value;
 applyGameplayAction(s,'combat',{combatId:s.combatId,input:'essence',slot:'q'},6000,()=>.5);assert.equal(s.actionPoints.value,ap-1);assert.equal(s.hunting.encounter.addKills,2);assert.equal(s.depthsRun.cleared,1);
 applyGameplayAction(s,'combat',{combatId:s.combatId,input:'essence',slot:'q'},6001,()=>.5);assert.equal(s.actionPoints.value,ap-1);assert.equal(s.hunting.encounter.addKills,2);
});
test('online and offline simulation agree with flanking, packs and splash casts',()=>{
 for(const room of ['depthsGate','depthsGallery']){const online=fighter(room,true),offline=structuredClone(online);for(let t=1000;t<=41000;t+=100)advanceServerCombat(online,t,()=>.5);advanceServerCombat(offline,41000,()=>.5);for(const key of ['hunting','health','position','magic','depthsRun','actionPoints'])assert.deepEqual(online[key],offline[key],room+' '+key);}
});
test('main-screen hints explain the Warden and pack rather than hiding the matchup in a journal',()=>{
 const s=clustered(),now=Date.now();s.hunting.encounter.adds.forEach(a=>a.spawnAt=now-1000);const g=boot(s);g.run('updateDungeonArenaHud()');assert.match(g.nodes.get('dungeonWeakness').textContent,/plating|PLATING/);assert.match(g.nodes.get('dungeonWeakness').textContent,/PACK.*splash/);assert.deepEqual(g.errors,[]);
});

