import test from 'node:test';import assert from 'node:assert/strict';
import {smartAttacks,chooseBrainAttack,brainThinkEvent,smartProfile} from '../public/enemy-brain.js';
import {arenaEnemy,arenaPlayer,arenaInDanger,arenaBehindCover,lockArenaAttack} from '../public/dungeon-arena.js';
import {normalizeState} from '../server/player-state.mjs';import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';import {advanceServerCombat} from '../server/activities.mjs';
import {huntEnemies,huntEnemy,enemyAttack,normalizeHunting,playerMeleeReach,vaultPhase} from '../public/hunting.js';import {prepareDungeonBuild} from './helpers/combat-fixtures.mjs';
import {boot} from './helpers/game-client.mjs';
function fighter(room='depthsCache',magic=false){const cleared=room==='depthsGate'?0:room==='depthsGallery'?1:2;const s=normalizeState({location:room,position:{x:5,y:5},depthsRun:{cleared,routeChoice:'dangerous'},stats:{strengthXp:1000,agilityXp:1000,vitalityXp:1000},combatGear:{ownedWeapons:['trainingSword','ironSword'],equippedWeapon:'ironSword'},characterRules:{combat:{enabled:true,dodge:true,q:false,e:false,fleeBelow:0}}});if(magic)prepareDungeonBuild(s);applyGameplayAction(s,'fight',{},1000,()=>.5);return s;}
const sample=(room,magic=false)=>{const s=fighter(room,magic),events=advanceServerCombat(s,91000,()=>.5);return {s,events};};

test('Elite strength and previews agree with the live scaled encounter and boss thresholds',()=>{
 for(const [id,hp] of [['cacheGuardian',315],['sealGuardian',368],['depthsGuardian',420]]){const base=huntEnemies[id],s=fighter(base.room);assert.equal(s.hunting.encounter.health,hp);assert.equal(smartProfile(base).health,hp);assert.equal(huntEnemy(s.hunting.encounter).health,hp);assert(huntEnemy(s.hunting.encounter).damage>base.damage);}
 const e=fighter('depthsVault').hunting.encounter;for(const [hp,index] of [[281,1],[280,2],[141,2],[140,3]])assert.equal(vaultPhase({...e,health:hp}).index,index);
});
test('attack selection responds to range, blocked spells and repeated evasive movement',()=>{
 const s=fighter('depthsGallery'),e=s.hunting.encounter,enemy=huntEnemy(e);
 const distant=chooseBrainAttack({...e,arenaPlayer:{x:2,y:5}},enemy,5000);assert(['lane','bolt'].includes(smartAttacks[distant].shape));
 const caster=fighter(),c=caster.hunting.encounter;
 const response=smartAttacks[chooseBrainAttack({...c,brainBlockedCount:2,brainRecentMoves:['seerBolt']},huntEnemy(c),10000)];assert.equal(response.center,'target');assert.equal(response.blockable,undefined);
 const ids=new Set();let next={...e};for(let i=0;i<6;i++){const id=chooseBrainAttack(next,enemy,10000+i*3000);ids.add(id);next={...next,arenaPlayer:i%2?{x:5,y:5}:{x:2,y:5},brainAttackCount:i+1,brainRecentMoves:[id],brainMisses:i};}assert(ids.size>=3);
});
test('creatures path around cover and casters retreat to a clear firing distance',()=>{
 for(const room of ['depthsGallery','depthsCache']){const s=fighter(room),e=s.hunting.encounter;e.nextBoarAt=100000;e.brainRecoveryUntil=1000;e.arenaPlayer=room==='depthsGallery'?{x:3,y:5}:{x:5,y:5};e.arenaSolids=[{x:5,y:5}];
  if(room==='depthsGallery')e.arenaEnemy={x:6,y:5};else e.arenaSolids=[];
  const original={...e.arenaEnemy};for(let i=0;i<6;i++){const event=brainThinkEvent(s,huntEnemy(s.hunting.encounter),enemyAttack(s.hunting.encounter),1500+i*650);s.hunting.encounter=event.encounter;assert(!e.arenaSolids.some(p=>p.x===event.encounter.arenaEnemy.x&&p.y===event.encounter.arenaEnemy.y));}
  const to=arenaEnemy(s.hunting.encounter),p=arenaPlayer(s.hunting.encounter);assert.notDeepEqual(to,original);if(room==='depthsGallery')assert(Math.hypot(to.x-p.x,to.y-p.y)<=1.45);else assert(Math.hypot(to.x-p.x,to.y-p.y)>=2.5);
 }
});
test('committed attacks stay honest, have directional cones and projectiles, and leave room to evade',()=>{
 const s=fighter(),e=s.hunting.encounter;const locked=lockArenaAttack({...e,arenaTarget:undefined},smartAttacks.seerBurst,huntEnemy(e));const target={...locked.arenaTarget};locked.arenaPlayer={x:2,y:5};assert.deepEqual(locked.arenaTarget,target);
 const pose={...e,brainOrigin:{x:6,y:5},arenaEnemy:{x:6,y:5},arenaTarget:{x:5,y:5},arenaPlayer:{x:5,y:5}};
 assert(arenaInDanger(pose,smartAttacks.sentinelSlash,{x:5,y:5}));assert.equal(arenaInDanger(pose,smartAttacks.sentinelSlash,{x:7,y:5}),false);
 assert(arenaInDanger(pose,smartAttacks.wardenRush,{x:2,y:5}));assert.equal(arenaInDanger(pose,smartAttacks.wardenRush,{x:3,y:7}),false);
 assert(arenaInDanger(pose,smartAttacks.seerBurst,{x:4,y:5}));assert.equal(arenaInDanger(pose,smartAttacks.seerBurst,{x:3,y:5}),false);
 assert.equal(arenaBehindCover(pose,smartAttacks.seerBurst),false);assert(Object.values(smartAttacks).every(m=>m.tell>=700));
});
test('a repeated sidestep can be anticipated before commitment, never after it',()=>{
 const s=fighter(),e={...s.hunting.encounter,arenaPlayer:{x:5,y:5},brainPlayerHistory:[{dx:0,dy:1,at:1000},{dx:0,dy:1,at:1300}]};
 const locked=lockArenaAttack(e,smartAttacks.seerBurst,huntEnemy(e));assert.deepEqual(locked.arenaTarget,{x:5,y:6});const after={...locked,arenaPlayer:{x:4,y:5}};assert.deepEqual(after.arenaTarget,{x:5,y:6});
});
test('steps use stamina, rate limits are enforced and late movement cannot erase a hit',()=>{
 const s=fighter('depthsGate');s.characterRules.combat.enabled=false;const deadline=s.hunting.encounter.nextBoarAt;
 applyGameplayAction(s,'combat',{combatId:s.combatId,input:'move',tile:{x:5,y:6}},1100,()=>.5);assert.equal(s.hunting.encounter.stamina,88);assert.equal(s.hunting.encounter.nextBoarAt,deadline);
 applyGameplayAction(s,'combat',{combatId:s.combatId,input:'move',tile:{x:5,y:7}},1101,()=>.5);assert.deepEqual(s.position,{x:5,y:6});
 const late=fighter('depthsGate');late.characterRules.combat.enabled=false;const impact=late.hunting.encounter.nextBoarAt;applyGameplayAction(late,'combat',{combatId:late.combatId,input:'move',tile:{x:5,y:6}},impact+1,()=>.99);assert(late.health<100);
});
test('there is no free melee safe annulus outside a heavy attack',()=>{
 const s=fighter('depthsGallery'),e={...s.hunting.encounter,brainOrigin:{x:6,y:5},arenaTarget:{x:5,y:5}};assert(playerMeleeReach('ironSword')<smartAttacks.wardenStomp.radius);assert(playerMeleeReach('huntingSpear')<smartAttacks.wardenStomp.radius);assert(arenaInDanger(e,smartAttacks.wardenStomp,{x:4,y:5}));
});
test('Auto melee takes real Elite damage and cannot trivialize the Vault; a prepared magic build helps',()=>{
 for(const room of ['depthsCache','depthsTrial']){const {s,events}=sample(room);assert(s.health<100);assert(events.some(e=>e.taken>0));assert(new Set(events.map(e=>e.move).filter(Boolean)).size>=3);assert.equal(s.hunting.encounter,null);}
 const bare=sample('depthsVault'),prepared=sample('depthsVault',true);assert.equal(bare.events.at(-1).outcome,'defeat');assert.equal(prepared.events.at(-1).outcome,'victory');assert(prepared.s.health>bare.s.health);assert(prepared.events.some(e=>e.power));assert(prepared.events.some(e=>e.phaseChange));
});
test('online polling and offline catch-up replay the same AI choices, damage, positions and rewards',()=>{
 for(const room of ['depthsCache','depthsVault']){const online=fighter(room,true),offline=structuredClone(online),events=[];
  for(let now=1000;now<=61000;now+=75)events.push(...advanceServerCombat(online,now,()=>.5));events.push(...advanceServerCombat(online,61000,()=>.5));const batch=advanceServerCombat(offline,61000,()=>.5);
  for(const key of ['health','hunting','magic','stats','position','depthsRun','dungeonLoot'])assert.deepEqual(online[key],offline[key],room+' '+key);
  assert.deepEqual(events.map(e=>[e.action,e.at,e.move,e.taken,e.damage]),batch.map(e=>[e.action,e.at,e.move,e.taken,e.damage]));const earned=structuredClone(online.stats);advanceServerCombat(online,121000,()=>.5);assert.deepEqual(online.stats,earned);
 }
});
test('memory, cooldowns and committed footprints survive saves and cannot be forged in snapshots',()=>{
 const s=fighter();advanceServerCombat(s,2300,()=>.5);const normalized=normalizeState(s);assert.deepEqual(normalized.hunting,s.hunting);const next=protectFishingState(s,{...s,hunting:{encounter:{...s.hunting.encounter,brainMaxHealth:1,brainCooldowns:{},stamina:100}}});assert.deepEqual(next.hunting,s.hunting);
 assert.throws(()=>normalizeHunting({encounter:{...s.hunting.encounter,brainVersion:9}}),/Invalid/);assert.throws(()=>normalizeHunting({encounter:{...s.hunting.encounter,brainMove:'unknown'}}),/intelligence/);
});
test('the main HUD shows actual Elite max health, step cost and the current named attack',()=>{
 const s=fighter();s.hunting.encounter.nextPlayerAt=Date.now()+3000;s.hunting.encounter.nextBoarAt=Date.now()+1000;s.hunting.encounter.brainNextThinkAt=Date.now()+4000;s.hunting.encounter.brainRecoveryUntil=Date.now()-1000;s.hunting.encounter.arenaLockedFor=s.hunting.encounter.nextBoarAt;
 const g=boot(s);g.run('hunting.encounter.nextBoarAt=combatNow()+500;hunting.encounter.brainRecoveryUntil=combatNow()-1000;updateDungeonArenaHud();draw(2200)');assert.deepEqual(g.errors,[]);assert.equal(g.nodes.get('dungeonEnemyBar').max,315);assert.match(g.nodes.get('dungeonEnemyName').textContent,/Elite/);assert.match(g.nodes.get('dungeonArenaCue').textContent,new RegExp(enemyAttack(s.hunting.encounter).name));assert.match(g.nodes.get('dungeonDodge').title,/step costs 12/);
});
