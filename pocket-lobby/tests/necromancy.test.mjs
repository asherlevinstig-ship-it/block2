import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeState} from '../server/player-state.mjs';
import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';
import {advanceServerCombat,startCombatEncounter} from '../server/activities.mjs';
import {styleAbilityOffers,normalizeStyleAbilities} from '../public/style-abilities.js';
import {activeRaised,raisedProfile,normalizeNecromancy} from '../public/necromancy.js';
import {undeadStrike,undeadDueAt} from '../server/necromancy.mjs';
import {combatSchedule} from '../server/combat-schedule.mjs';
import {skillXpForLevel} from '../public/skill-curve.js';
import {huntEnemies} from '../public/hunting.js';
import {publicPeer} from '../server/shared-room.mjs';
const stats={magicKnowledgeXp:skillXpForLevel(5),evil:3};
const make=extra=>normalizeState({location:'clearing',position:{x:7,y:5},stats,actionPoints:{value:20},styleAbilities:{learned:['raiseFallen']},...extra});
const act=(s,action,body,at=10000)=>applyGameplayAction(s,action,body,at,()=>.99);
function corpse(s,at=10000){startCombatEncounter(s,huntEnemies.boar,at);s.hunting.encounter.health=1;advanceServerCombat(s,at+450,()=>.99);return s.styleAbilities.fallen;}
function summon(s,at=11000){corpse(s);act(s,'abilityCast',{id:'raiseFallen'},at);return s.styleAbilities.raised;}

test('Necromancy is offered only at Magic Knowledge 5 and Evil 3 and acceptance fills one permanent slot',()=>{
 const s=make({styleAbilities:undefined});assert(styleAbilityOffers(s).includes('raiseFallen'));
 for(const patch of [{magicKnowledgeXp:skillXpForLevel(4),evil:3},{magicKnowledgeXp:skillXpForLevel(5),evil:2}])assert(!styleAbilityOffers(make({stats:patch,styleAbilities:undefined})).includes('raiseFallen'));
 act(s,'abilityDecision',{id:'raiseFallen',decision:'accept'});assert.deepEqual(s.styleAbilities.learned,['raiseFallen']);assert(!styleAbilityOffers(s).includes('raiseFallen'));
});

test('A genuine beast victory records a recent corpse and one cast consumes it and one AP',()=>{
 const s=make(),fallen=corpse(s);assert.equal(fallen.enemy,'boar');assert.equal(fallen.room,'clearing');
 const points=s.actionPoints.value;act(s,'abilityCast',{id:'raiseFallen'},11000);
 assert.equal(s.styleAbilities.fallen,undefined);assert.equal(s.actionPoints.value,points-1);assert.equal(s.styleAbilities.raised.damage,6);assert.equal(s.styleAbilities.raised.until,41000);
 assert.throws(()=>act(s,'abilityCast',{id:'raiseFallen'},11001),/recharging/);
 const next=normalizeState(s);assert.deepEqual(next.styleAbilities.raised,s.styleAbilities.raised);
 const forged=make({styleAbilities:{learned:['raiseFallen'],raised:{id:'fake'}}});assert.deepEqual(protectFishingState(s,forged).styleAbilities,s.styleAbilities);
});

test('Raise Fallen rejects missing, distant, expired, wrong-room and boss corpses without spending AP',()=>{
 const s=make();assert.throws(()=>act(s,'abilityCast',{id:'raiseFallen'}),/Defeat/);
 const f=corpse(s),points=s.actionPoints.value;
 s.position={x:1,y:1};assert.throws(()=>act(s,'abilityCast',{id:'raiseFallen'},11000),/closer/);
 s.position={x:7,y:5};assert.throws(()=>act(s,'abilityCast',{id:'raiseFallen'},f.until+1),/Defeat/);
 s.location='pond';assert.throws(()=>act(s,'abilityCast',{id:'raiseFallen'},11000),/Defeat/);
 assert.equal(s.actionPoints.value,points);
 assert.equal(normalizeNecromancy({fallen:{...f,enemy:'depthsGuardian'}},['raiseFallen']).fallen,undefined);
});

test('Only one ally can be active and Magic Knowledge scales strength and lifetime within a cap',()=>{
 const s=make();summon(s);s.styleAbilities.readyAt.raiseFallen=0;
 assert.throws(()=>act(s,'abilityCast',{id:'raiseFallen'},12000),/already have/);
 assert.deepEqual(raisedProfile(stats),{damage:6,duration:30000});assert.deepEqual(raisedProfile({magicKnowledgeXp:skillXpForLevel(100)},3),{damage:16,duration:60000});
 assert.equal(activeRaised(s,41000),null);assert(activeRaised({...s,location:'depthsGate'},12000));assert.equal(activeRaised({...s,location:'hub'},12000),null);assert.equal(activeRaised({...s,health:0},12000),null);assert.equal(activeRaised({...s,vaultCoop:{}},12000),null);
});

test('Server clock schedules undead strikes and replay batches match frequent combat reads',()=>{
 const s=make();summon(s);startCombatEncounter(s,huntEnemies.boar,12000);
 s.hunting.encounter.health=80;s.hunting.encounter.nextPlayerAt=Number.MAX_SAFE_INTEGER;s.hunting.encounter.nextBoarAt=Number.MAX_SAFE_INTEGER;
 const a=structuredClone(s),b=structuredClone(s),points=s.actionPoints.value;
 assert.equal(combatSchedule(a).undeadDue,13500);assert.equal(combatSchedule(a).at,13500);
 for(const at of [13500,16500,19500])advanceServerCombat(a,at,()=>.99);
 const events=advanceServerCombat(b,19500,()=>.99);
 assert.equal(events.filter(e=>e.action==='undead').length,3);assert.equal(a.hunting.encounter.health,b.hunting.encounter.health);assert.equal(b.hunting.encounter.health,62);
 assert.equal(b.styleAbilities.mastery.raiseFallen.uses,1);assert.equal(b.actionPoints.value,points,'ongoing summon effect does not charge extra casts');
 assert.equal(advanceServerCombat(b,19500).length,0);assert.equal(undeadDueAt({...b,location:'hub'}),Infinity);
});

test('An undead killing blow uses the ordinary victory/reward path exactly once',()=>{
 const s=make();summon(s);startCombatEncounter(s,huntEnemies.boar,12000);s.hunting.encounter.health=1;s.hunting.encounter.nextPlayerAt=Number.MAX_SAFE_INTEGER;s.hunting.encounter.nextBoarAt=Number.MAX_SAFE_INTEGER;
 const before=s.huntingLoot.boar??0,events=advanceServerCombat(s,13500,()=>.99);assert.equal(events[0].outcome,'victory');assert.equal(s.hunting.encounter,null);assert.equal(s.huntingLoot.boar,before+1);
 assert.equal(advanceServerCombat(s,14000).length,0);assert.equal(s.huntingLoot.boar,before+1);
});

test('Summon strikes target a selected dungeon add without ending its leader encounter',()=>{
 const s=make();summon(s);startCombatEncounter(s,huntEnemies.boar,12000);
 Object.assign(s.hunting.encounter,{addsVersion:1,combatTarget:'add-1',adds:[{id:'add-1',kind:'skitter',health:1,x:5,y:5,spawnAt:12000,attackAt:20000}],addKills:0});
 const hp=s.hunting.encounter.health,event=undeadStrike(s,13500);assert.equal(event.outcome,'fighting');assert.equal(event.addKill,true);assert.equal(event.encounter.health,hp);assert.equal(event.encounter.adds.length,0);
});

test('Spectators see one bounded undead ally and its pose expires without extra polling',()=>{
 const s=make();const ally=summon(s),meta={room:'clearing',id:'public',health:100,undead:ally};assert(publicPeer(meta,12000).undead);assert.equal(publicPeer(meta,ally.until).undead,null);assert.equal(publicPeer({...meta,room:'hub'},12000).undead,null);
 assert.equal(normalizeStyleAbilities({learned:[],raised:ally}).raised,undefined);
});
