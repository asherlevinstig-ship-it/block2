import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeState} from '../server/player-state.mjs';import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';import {advanceServerCombat} from '../server/activities.mjs';
import {addKinds,addEncounter,addDueAt,spawnAddWave,queueBossAdds,chooseAutoAddTarget,ADD_LIMIT} from '../public/dungeon-adds.js';
import {normalizeHunting,huntingTurn,huntEnemy,enemyAttack} from '../public/hunting.js';import {arenaInDanger,arenaBehindCover,arenaMoveEvent} from '../public/dungeon-arena.js';import {castEssencePower} from '../server/essences.mjs';import {prepareDungeonBuild} from './helpers/combat-fixtures.mjs';import {boot} from './helpers/game-client.mjs';
function fighter(room='depthsCache',auto=false){const s=normalizeState({location:room,position:{x:5,y:5},depthsRun:{cleared:room==='depthsGate'?0:room==='depthsGallery'?1:2,routeChoice:'dangerous'},stats:{strengthXp:1000,agilityXp:1000,vitalityXp:1000},combatGear:{ownedWeapons:['trainingSword','ironSword'],equippedWeapon:'ironSword'},characterRules:{combat:{enabled:auto,dodge:true,q:true,e:true,fleeBelow:0}}});prepareDungeonBuild(s);s.characterRules.combat.enabled=auto;applyGameplayAction(s,'fight',{},1000,()=>.5);return s;}
function wave(s,now=4500){const e=s.hunting.encounter;s.hunting.encounter=spawnAddWave(e,now).encounter;return s.hunting.encounter;}

test('reinforcements have stable encounter-owned IDs, finite waves and honest spawn delays',()=>{
 const s=fighter(),e=wave(s);assert.equal(e.adds.length,2);assert.deepEqual(e.addWaves,[1]);assert.equal(e.addWaveAt,0);assert.equal(new Set(e.adds.map(a=>a.id)).size,2);
 for(const a of e.adds){assert.equal(a.spawnAt,5900);assert(a.attackAt-addKinds[a.kind].move.tell>=a.spawnAt);assert(Math.hypot(a.x-e.arenaPlayer.x,a.y-e.arenaPlayer.y)>=2.5);assert(!e.arenaSolids.some(p=>p.x===a.x&&p.y===a.y));}
 assert.equal(fighter('depthsGate').hunting.encounter.addsVersion,undefined);
});

test('boss summons once at each phase boundary and the encounter cap cannot multiply per caller',()=>{
 let e=fighter('depthsVault').hunting.encounter;assert.equal(e.addWaveAt,0);e=queueBossAdds({...e,health:280},5000);assert.equal(e.addWaveAt,5600);
 for(let i=0;i<20;i++)e=queueBossAdds(e,5001+i);assert.equal(e.addWaveAt,5600);
 e=spawnAddWave(e,5600).encounter;assert.equal(e.adds.length,1);assert.equal(queueBossAdds(e,6000).addWaveAt,0);
 e=queueBossAdds({...e,health:140},8000);e=spawnAddWave(e,8600).encounter;assert.deepEqual(e.adds.map(a=>a.kind),['skitter','wisp']);assert(e.adds.length<=ADD_LIMIT);assert.deepEqual(e.addWaves,[1,2]);assert.equal(queueBossAdds(e,9000).addWaveAt,0);
});

test('weapon target kills only the add, consumes the strike clock and gives no chamber reward',()=>{
 const s=fighter(),e=wave(s),a=e.adds[0];Object.assign(a,{x:5,y:4,health:1});e.combatTarget=a.id;e.nextPlayerAt=6000;
 const event=huntingTurn(e,100,s.stats,'attack',6000,()=>.5,'ironSword');assert(event.addKill);assert.equal(event.outcome,'fighting');assert.equal(event.encounter.health,e.health);assert.equal(event.encounter.addKills,1);assert.equal(event.encounter.nextPlayerAt,7200);assert.equal(event.encounter.combatTarget,'leader');assert.equal(event.enemyTile.x,5);assert(!event.encounter.adds.some(b=>b.id===a.id));
});

test('powers damage and burn their selected add while shields still protect the player',()=>{
 const s=fighter(),e=wave(s),a=e.adds[1];s.stats.strengthXp=s.stats.agilityXp=s.stats.vitalityXp=0;e.combatTarget=a.id;const initial=a.health;const hit=castEssencePower(s,6000,'q');assert.equal(hit.encounter.health,e.health);assert(hit.damage>0);assert(hit.encounter.adds.find(b=>b.id===a.id).health<initial);assert(hit.encounter.adds.find(b=>b.id===a.id).burn);assert.equal(hit.encounter.burn,undefined);assert(s.vitals.mana<100);
 s.hunting.encounter=hit.encounter;const ward=castEssencePower(s,6100,'e');assert(ward.encounter.magicWard>0);assert.equal(ward.encounter.health,e.health);
});

test('add attacks commit to a fixed origin and target, use real shapes and can be blocked by cover',()=>{
 const s=fighter(),e=wave(s),a=e.adds.find(a=>a.kind==='wisp');Object.assign(a,{x:6,y:3,origin:{x:6,y:3},target:{x:2,y:3},lockedFor:a.attackAt});const v=addEncounter({...e,arenaPlayer:{x:2,y:3}},a),m=enemyAttack(v);assert.equal(huntEnemy(v).name,'Rune Wisp');assert(arenaInDanger(v,m));assert(arenaBehindCover(v,m));assert.equal(arenaInDanger(v,m,{x:2,y:5}),false);
 e.arenaPlayer={x:8,y:7};assert.deepEqual(a.target,{x:2,y:3});
});

test('replay advances concurrent add attacks, burns and leader attacks without pausing the fight',()=>{
 const s=fighter();wave(s);s.hunting.encounter.nextPlayerAt=20000;const events=advanceServerCombat(s,12000,()=>.99);assert(events.some(e=>e.enemyId==='addSkitter'&&e.action==='enemy'));assert(events.some(e=>e.enemyId==='addWisp'&&e.action==='enemy'));assert(events.some(e=>e.enemyId==='cacheGuardian'&&e.action==='enemy'));assert(s.health<100);assert(addDueAt(s.hunting.encounter)>12000);
});

test('occupied add tiles block movement and Auto prioritizes active supports',()=>{
 const s=fighter(),e=wave(s),a=e.adds[0];Object.assign(a,{x:5,y:4});assert.equal(arenaMoveEvent(s,{x:5,y:4},6000,[],100),null);assert.equal(chooseAutoAddTarget(e,5000),'leader');assert(e.adds.some(a=>a.id===chooseAutoAddTarget(e,6000)));
});

test('polling and offline catch-up produce identical add kills, damage, casts and chamber rewards',()=>{
 const a=fighter('depthsCache',true),b=structuredClone(a),events=[];for(let at=1000;at<=61000;at+=100)events.push(...advanceServerCombat(a,at,()=>.5));const batch=advanceServerCombat(b,61000,()=>.5);
 for(const key of ['hunting','health','stats','magic','depthsRun','position'])assert.deepEqual(a[key],b[key],key);
 assert.deepEqual(events.map(e=>[e.action,e.at,e.enemyId,e.damage,e.taken,e.addKill]),batch.map(e=>[e.action,e.at,e.enemyId,e.damage,e.taken,e.addKill]));assert(events.some(e=>e.action==='reinforcements'));assert(events.some(e=>e.addKill));assert.equal(events.filter(e=>e.outcome==='victory').length,1);
 const earned=structuredClone(a.stats);advanceServerCombat(a,90000,()=>.5);assert.deepEqual(a.stats,earned);
});

test('adds and target survive normalization and snapshot writes cannot forge them',()=>{
 const s=fighter();wave(s);const e=s.hunting.encounter;e.combatTarget=e.adds[0].id;assert.deepEqual(normalizeHunting(s.hunting),s.hunting);const n=normalizeState(s);assert.deepEqual(n.hunting,s.hunting);
 const protectedState=protectFishingState(s,{...s,hunting:{...s.hunting,encounter:{...e,adds:[],addWaveAt:1,combatTarget:'leader'}}});assert.deepEqual(protectedState.hunting,s.hunting);
 assert.throws(()=>normalizeHunting({encounter:{...e,adds:[...e.adds,...e.adds]}}),/reinforcements/);assert.throws(()=>normalizeHunting({encounter:{...e,combatTarget:'forged'}}),/target/);assert.throws(()=>normalizeHunting({encounter:{...e,adds:e.adds.map((a,i)=>i? a:{...a,health:100000})}}),/add/);
});

test('target changes settle due damage first and reject unknown or still-spawning adds',()=>{
 const s=fighter();wave(s);assert.throws(()=>applyGameplayAction(s,'combat',{combatId:s.combatId,input:'target',slot:s.hunting.encounter.adds[0].id},4600,()=>.5),/active/);assert.throws(()=>applyGameplayAction(s,'combat',{combatId:s.combatId,input:'target',slot:'fake'},6000,()=>.5),/active/);
 const id=s.hunting.encounter.adds[0].id;applyGameplayAction(s,'combat',{combatId:s.combatId,input:'target',slot:id},6100,()=>.5);assert.equal(s.hunting.encounter.combatTarget,id);
});

test('the HUD renders selectable adds, summoning feedback and their own health',()=>{
 const s=fighter(),e=wave(s,Date.now()-2000);e.combatTarget=e.adds[0].id;const g=boot(s);g.run('updateDungeonArenaHud();draw(2200)');assert.deepEqual(g.errors,[]);assert.equal(g.nodes.get('dungeonTargets').hidden,false);assert.equal(g.nodes.get('dungeonTargets').children.length,3);assert.match(g.nodes.get('dungeonEnemyName').textContent,/Mire Hatchling/);assert.equal(g.nodes.get('dungeonEnemyBar').max,32);assert.equal(g.read('roomFurniture().filter(i=>i.addId).length'),2);
});

test('nameplates distinguish the guardian and reinforcements, then clear defeated targets',()=>{
 const s=fighter('depthsTrial'),encounter=wave(s);
 const target=encounter.adds[0];
 encounter.combatTarget=target.id;
 const g=boot(s);
 g.run('draw(2200)');
 assert.equal(g.read("actorNameplates.get('enemy:leader').node.textContent"),'Thornblade Duelist');
 assert.match(g.read("actorNameplates.get('enemy:'+hunting.encounter.combatTarget).node.textContent"),/Mire Hatchling · Target/);
 g.run("hunting.encounter.adds=[];hunting.encounter.combatTarget='leader';draw(2400)");
 assert.equal(g.read("Array.from(actorNameplates.keys()).filter(k=>k.startsWith('enemy:')).join(',')"),'enemy:leader');
 assert.match(g.read("actorNameplates.get('enemy:leader').node.textContent"),/Thornblade Duelist · Target/);
 assert.deepEqual(g.errors,[]);
});
