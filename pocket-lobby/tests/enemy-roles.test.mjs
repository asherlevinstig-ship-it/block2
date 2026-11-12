import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeState} from '../server/player-state.mjs';import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';import {advanceServerCombat} from '../server/activities.mjs';import {prepareDungeonBuild} from './helpers/combat-fixtures.mjs';import {huntingTurn,advanceHunt,huntEnemy,enemyAttack,normalizeHunting} from '../public/hunting.js';import {spawnAddWave,chooseAutoAddTarget,addEncounter} from '../public/dungeon-adds.js';import {castEssencePower} from '../server/essences.mjs';import {channelerWardActive,enemyRoleInfo,roleDamage} from '../public/enemy-roles.js';import {smartAttacks,chooseBrainAttack,planBrainAttack} from '../public/enemy-brain.js';import {nextCombatTactic} from '../public/character-rules.js';import {arenaEnemy} from '../public/dungeon-arena.js';import {boot} from './helpers/game-client.mjs';
function fighter(room='depthsCache',auto=false){const s=normalizeState({location:room,position:{x:5,y:5},depthsRun:{cleared:2,routeChoice:'dangerous'},stats:{strengthXp:1000,agilityXp:1000,vitalityXp:1000},combatGear:{ownedWeapons:['trainingSword','ironSword'],equippedWeapon:'ironSword'},characterRules:{combat:{enabled:auto,dodge:true,q:true,e:true,fleeBelow:0}}});prepareDungeonBuild(s);s.characterRules.combat.enabled=auto;applyGameplayAction(s,'fight',{},1000,()=>.5);return s;}
function wave(s){s.hunting.encounter=spawnAddWave(s.hunting.encounter,4500).encounter;return s.hunting.encounter;}
test('Ironhide has a readable wide slam and a stagger-or-magic weakness',()=>{
 const s=fighter('depthsTreasury'),e=s.hunting.encounter,enemy=huntEnemy(e);assert.equal(enemy.name,'Ironhide Guardian');assert.equal(enemy.archetype,'armoured');assert(smartAttacks.ironhideSlam.tell>=1700);assert(smartAttacks.ironhideSlam.radius>2.5);assert.match(enemyRoleInfo(e,2000).status,/stagger|magic/);
 const open={...e,exposedUntil:7000};assert.equal(roleDamage(open,40,6000,{magic:true}).damage,50);assert.equal(roleDamage(e,40,6000,{magic:true}).damage,40);
});
test('Thornblade starts with a readable two-cut pattern and a held third attack',()=>{
 const s=fighter('depthsTrial'),e={...s.hunting.encounter,arenaPlayer:{x:5,y:5},arenaEnemy:{x:6,y:5}},enemy=huntEnemy(e);assert.equal(enemy.name,'Thornblade Duelist');
 assert.equal(chooseBrainAttack({...e,brainAttackCount:0,brainRecentMoves:[]},enemy,1000),'sentinelSlash');
 const afterSlash=planBrainAttack({...e,brainAttackCount:1,brainRecentMoves:['sentinelSlash']},enemy,2000,smartAttacks.sentinelSlash);assert.equal(afterSlash.brainMove,'sentinelSweep');assert.equal(afterSlash.brainCombo,true);assert(afterSlash.nextBoarAt-2000>smartAttacks.sentinelSweep.tell);
 assert.equal(chooseBrainAttack({...e,brainAttackCount:2,brainRecentMoves:['sentinelSlash','sentinelSweep'],brainCooldowns:{}},enemy,4000),'sentinelDelayed');assert(smartAttacks.sentinelDelayed.tell>smartAttacks.sentinelSlash.tell);assert.match(enemyRoleInfo(afterSlash,2200).status,/FOLLOW-UP/);
});
test('Channeler ward starts only when its Wisp appears and reduces physical, spell and burn damage',()=>{
 const s=fighter(),e=wave(s),w=e.adds.find(a=>a.kind==='wisp');assert(!channelerWardActive(e,w.spawnAt-1));assert(channelerWardActive(e,w.spawnAt));assert.match(enemyRoleInfo(e,6000).status,/RUNE WARD/);
 const hit={...e,combatTarget:'leader',arenaEnemy:{x:6,y:5},arenaPlayer:{x:5,y:5},nextPlayerAt:6000,staggerResistUntil:10000};const ward=huntingTurn(hit,100,s.stats,'attack',6000,()=>0,'ironSword'),plain=huntingTurn({...hit,adds:[]},100,s.stats,'attack',6000,()=>0,'ironSword');assert(ward.damage<plain.damage);assert(ward.wardAbsorbed>0);
 const dot=advanceHunt({...hit,nextPlayerAt:9000,nextBoarAt:10000,burn:{damage:10,nextAt:6000,until:8000}},100,s.stats,6000,()=>0,'ironSword');assert.equal(dot.damage,4);assert.equal(dot.wardAbsorbed,6);
 s.hunting.encounter=hit;const spell=castEssencePower(s,6000,'q');assert(spell.wardAbsorbed>0);assert(spell.damage>0);
});
test('killing a Wisp breaks the ward, creates a timed opening and never clears the room',()=>{
 const s=fighter(),e=wave(s),w=e.adds.find(a=>a.kind==='wisp');Object.assign(w,{health:1,x:5,y:4});e.combatTarget=w.id;e.nextPlayerAt=6000;
 const hit=huntingTurn(e,100,s.stats,'attack',6000,()=>0,'ironSword');assert(hit.addKill);assert(hit.wardBroken);assert.equal(hit.outcome,'fighting');assert.equal(hit.encounter.health,e.health);assert.equal(hit.encounter.staggerWeakUntil,9000);assert(!channelerWardActive(hit.encounter,6000));assert.match(enemyRoleInfo(hit.encounter,6000).status,/WARD BROKEN/);assert.equal(roleDamage(hit.encounter,40,7000,{magic:true}).damage,50);assert.equal(roleDamage(hit.encounter,40,9000,{magic:true}).damage,40);assert.equal(s.depthsRun.cacheGuardDefeated,undefined);
});
test('the ward never protects an add, and Auto prioritises the protecting Wisp',()=>{
 const s=fighter(),e=wave(s),w=e.adds.find(a=>a.kind==='wisp');assert.equal(chooseAutoAddTarget(e,6000),w.id);assert(!channelerWardActive(addEncounter(e,w),6000));assert.equal(roleDamage(addEncounter(e,w),20,6000).damage,20);
});
test('Auto routes to a Wisp without trying to walk through its guardian',()=>{
 const s=fighter('depthsTrial',true),e=wave(s),w=e.adds.find(a=>a.kind==='wisp');Object.assign(e,{arenaPlayer:{x:3,y:5},arenaEnemy:{x:4,y:5},combatTarget:w.id,tacticsAt:6000,nextPlayerAt:20000,nextBoarAt:20000,brainMove:'sentinelSlash'});Object.assign(w,{x:6,y:7,spawnAt:5900});s.position={x:3,y:5};s.characterRules.combat.q=false;s.characterRules.combat.e=false;
 const tactic=nextCombatTactic(s);assert.equal(tactic.action,'move');assert.notDeepEqual(tactic.tile,arenaEnemy(e));
 const events=advanceServerCombat(s,25000,()=>.5);assert(events.some(event=>event.at>10000));
});
test('ward state and target selection survive saves; online and offline combat agree',()=>{
 const online=fighter('depthsCache',true),offline=structuredClone(online);let sawWard=false;
 for(let now=1000;now<=45000;now+=100){advanceServerCombat(online,now,()=>.5);if(online.hunting.encounter&&channelerWardActive(online.hunting.encounter,now)){sawWard=true;assert.deepEqual(normalizeHunting(online.hunting),online.hunting);}}
 advanceServerCombat(offline,45000,()=>.5);assert(sawWard);for(const key of ['health','hunting','stats','position','depthsRun','magic'])assert.deepEqual(online[key],offline[key],key);
});
test('the main-screen dungeon HUD explains the active ward and its target',()=>{
 const s=fighter(),e=wave(s),now=Date.now();for(const a of e.adds)a.spawnAt=now-1000;Object.assign(e,{nextPlayerAt:now+5000,nextBoarAt:now+5000,brainNextThinkAt:now+5000});const g=boot(s);g.run('updateDungeonArenaHud()');assert.match(g.nodes.get('dungeonWeakness').textContent,/RUNE WARD.*Rune Wisp/);assert.deepEqual(g.errors,[]);
});
