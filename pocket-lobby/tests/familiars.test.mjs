import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeState,startPlan} from '../server/player-state.mjs';
import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';
import {familiars,normalizeFamiliars} from '../public/familiars.js';
import {explorationVisibility} from '../public/exploration-fog.js';
import {publicPeer} from '../server/shared-room.mjs';
import {spawnAddWave} from '../public/dungeon-adds.js';
import {huntingTurn} from '../public/hunting.js';

const act=(s,action,body={},now=1000)=>applyGameplayAction(s,action,body,now,()=>.5);
const bond=(s,id)=>{act(s,'familiarRecruit',{id});act(s,'familiarEquip',{id});};

test('recruitment requires a milestone, equips one familiar and protects ownership on snapshot saves',()=>{
 const s=normalizeState({history:{fishCaught:true},adventure:{lantern:true}});
 assert.throws(()=>act(s,'familiarRecruit',{id:'fox'}),/unlock/);
 assert.throws(()=>act(s,'familiarEquip',{id:'otter'}),/Befriend/);
 bond(s,'otter');bond(s,'owl');act(s,'familiarRecruit',{id:'owl'});
 assert.deepEqual(s.familiars.owned,['otter','owl']);assert.equal(s.familiars.equipped,'owl');
 const normalized=normalizeState(s);assert.deepEqual(normalized.familiars,s.familiars);
 assert.deepEqual(protectFishingState(s,{...s,familiars:{owned:['fox'],equipped:'fox'}}).familiars,s.familiars);
 assert.equal(publicPeer({familiar:s.familiars.equipped}).familiar,'owl');assert.equal(publicPeer({familiar:'unknown'}).familiar,undefined);
});

test('Otter speeds the server bite, recovers a missed bonus once and preserves the normal catch reward',()=>{
 const make=()=>normalizeState({location:'pond',position:{x:4,y:5},history:{fishCaught:true},fishingGear:{ownedRods:['reed'],equippedRod:'reed',bait:3}});
 const withOtter=make(),control=make();bond(withOtter,'otter');act(control,'cast');act(withOtter,'cast');
 const cast=withOtter.fishingCast;assert.equal(cast.biteAt-1450,Math.round((control.fishingCast.biteAt-1450)*.85));
 assert.throws(()=>act(withOtter,'familiarUse',{castId:cast.id},cast.biteAt-1),/bite/);
 act(withOtter,'familiarUse',{castId:cast.id},cast.landAt+50);
 assert.equal(cast.bonus,5);assert.equal(withOtter.familiars.readyAt.otter,cast.landAt+50+familiars.otter.cooldown);
 assert.throws(()=>act(withOtter,'familiarUse',{castId:cast.id},cast.landAt+100),/recovering/);
 act(withOtter,'catch',{castId:cast.id},cast.landAt+900);
 assert.equal(withOtter.fishingReceipt.xp,15);assert.equal(withOtter.fishingGear.bait,2);assert.equal(withOtter.fishingCast,undefined);
});

test('the Otter also speeds away fishing without giving offline timing bonuses',()=>{
 const make=()=>normalizeState({location:'pond',position:{x:4,y:5},history:{fishCaught:true},fishingGear:{ownedRods:['reed'],equippedRod:'reed',bait:3}});
 const otter=make(),control=make();bond(otter,'otter');
 for(const s of [otter,control])startPlan(s,{kind:'fishing',hours:1,baitLimit:3},1000);
 assert.equal(otter.plan.interval,Math.round(control.plan.interval*.85));
 assert.equal(otter.plan.nextCatchAt,1000+otter.plan.interval);
});

test('Fox adds stagger only on adds and its pounce cancels a committed attack without harming the leader',()=>{
 const s=normalizeState({location:'depthsCache',position:{x:5,y:5},depthsDiscovered:true,depthsRun:{cleared:1,routeChoice:'dangerous'}});bond(s,'fox');act(s,'fight');
 const e=spawnAddWave(s.hunting.encounter,1200).encounter,a=e.adds[0];s.hunting.encounter=e;
 Object.assign(a,{x:5,y:4,thinkAt:4001,attackAt:4000,lockedFor:4000,origin:{x:5,y:4},target:{x:5,y:5}});e.combatTarget=a.id;e.nextPlayerAt=3000;
 const withFox=huntingTurn(e,100,s.stats,'attack',3000,()=>.5),withoutFox=huntingTurn({...e,foxBond:false},100,s.stats,'attack',3000,()=>.5);
 assert.equal(withFox.staggerGained-withoutFox.staggerGained,8);assert.equal(withFox.encounter.health,e.health);
 e.nextPlayerAt=e.nextBoarAt=e.brainNextThinkAt=10000;
 act(s,'combat',{combatId:s.combatId,input:'familiar'},3500);
 const after=s.hunting.encounter,add=after.adds.find(x=>x.id===a.id);assert.equal(after.health,e.health);assert.equal(after.nextBoarAt,10000);assert.equal(add.lockedFor,0);assert(add.attackAt>4000);
 assert(s.combatReceipt.events.some(event=>event.targetId===a.id&&event.interrupted));
 assert.throws(()=>act(s,'combat',{combatId:s.combatId,input:'familiar'},3501),/recovering/);
});

test('Owl scouts only the local frontier and Moon Sight has a room, duration and cooldown',()=>{
 const s=normalizeState({location:'trail',adventure:{lantern:true}});bond(s,'owl');act(s,'familiarUse');
 assert.deepEqual(s.familiars.sight,{room:'trail',until:16000});assert.equal(s.familiars.readyAt.owl,36000);
 s.location='hub';assert.throws(()=>act(s,'familiarUse',{},37000),/outdoors/);
 const options={currentRoom:'a',rooms:['a','b','c','d'],exits:room=>({a:[{to:'b'}],b:[{to:'c'}],c:[{to:'d'}],d:[]})[room]};
 assert.equal(explorationVisibility(options).status('c'),'hidden');const scouted=explorationVisibility({...options,scout:true});assert.equal(scouted.status('c'),'frontier');assert.equal(scouted.status('d'),'hidden');assert.equal(normalizeFamiliars(s.familiars).equipped,'owl');
});
