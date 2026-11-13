import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeState} from '../server/player-state.mjs';import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';
import {createDungeonEncounter,dungeonEncounters,resolveDungeonEncounter,dungeonEncounterResult} from '../public/dungeon-encounters.js';import {depthsSpoils} from '../public/depths.js';import {boot} from './helpers/game-client.mjs';
function state(kind){return normalizeState({location:'depthsGallery',position:{x:8,y:6},depthsRun:{cleared:2,routeChoice:'safe',encounter:{kind}},vitals:{hunger:100,mana:80,manaAt:1000},health:80,credits:100});}
const act=(s,choice,roll=.9)=>applyGameplayAction(s,'depthsEncounter',{choice},1000,()=>roll);
test('one encounter is picked at entry and survives reload and optional-room returns',()=>{
 for(const [i,kind] of Object.keys(dungeonEncounters).entries()){
  assert.deepEqual(createDungeonEncounter(()=>i/3+.01),{kind});const s=normalizeState({location:'ruins',depthsDiscovered:true});applyGameplayAction(s,'depthsEnter',{},1000,()=>i/3+.01);assert.equal(s.depthsRun.encounter.kind,kind);assert.deepEqual(normalizeState(s).depthsRun.encounter,{kind});
  const ready=state(kind);applyGameplayAction(ready,'depthsSide',{id:'rest'},1000);applyGameplayAction(ready,'depthsSide',{id:'return'},1000);assert.equal(ready.depthsRun.encounter.kind,kind);
 }
 assert.equal(normalizeState({location:'depthsGallery',depthsRun:{cleared:2}}).depthsRun.encounter,undefined);
});
test('all six encounter options charge one AP and have their stated costs and rewards',()=>{
 const rescue=state('explorer');act(rescue,'rescue');assert.equal(rescue.vitals.mana,60);assert.equal(depthsSpoils(rescue.depthsRun).gold,61);assert.equal(rescue.credits,100);assert.equal(rescue.actionPoints.value,99);
 for(const [roll,gold] of [[.1,60],[.9,10]]){const s=state('explorer');act(s,'passage',roll);assert.equal(s.health,65);assert.equal(s.depthsRun.encounter.gold,gold);assert.match(dungeonEncounterResult(s.depthsRun.encounter),new RegExp(String(gold)));}
 const bread=state('merchant');act(bread,'rations');assert.equal(bread.credits,94);assert.equal(bread.meals.towerBread,2);
 for(const [roll,gold] of [[.1,40],[.9,4]]){const s=state('merchant');act(s,'parcel',roll);assert.equal(s.credits,88);assert.equal(s.depthsRun.encounter.gold,gold);assert.equal(s.actionPoints.value,99);}
 const blessing=state('shrine');act(blessing,'blessing');assert.equal(blessing.health,95);assert.equal(blessing.vitals.mana,100);const bargain=state('shrine');act(bargain,'bargain');assert.equal(bargain.health,60);assert.equal(bargain.depthsRun.encounter.gold,50);
});
test('completed encounters cannot reroll or award again; extraction banks reward once',()=>{
 let s=state('merchant');act(s,'parcel',.1);s=normalizeState(s);const before=structuredClone(s);assert.throws(()=>act(s,'parcel',.9),/already completed/);assert.deepEqual(s,before);assert.throws(()=>act(s,'rations'),/already completed/);
 applyGameplayAction(s,'bank',{},1000);assert.equal(s.credits,164);assert.equal(s.location,'ruins');assert.equal(s.depthsRun,null);assert.throws(()=>act(s,'parcel'));
});
test('invalid, distant, mid-fight and unaffordable choices have no partial costs or lethal outcomes',()=>{
 const s=state('shrine');s.health=20;assert.throws(()=>act(s,'bargain'),/more than 20 HP/);assert.equal(s.health,20);s.health=100;s.vitals.mana=100;assert.throws(()=>act(s,'blessing'),/already full/);assert.equal(s.actionPoints.value,100);
 const poor=state('merchant');poor.credits=5;assert.throws(()=>act(poor,'rations'),/6 wallet gold/);assert.equal(poor.meals.towerBread??0,0);poor.position={x:4,y:5};assert.throws(()=>act(poor,'parcel'),/Travel beside/);
 const mage=state('explorer');mage.vitals.mana=19;assert.throws(()=>act(mage,'rescue'),/20 mana/);assert.equal(mage.vitals.mana,19);assert.throws(()=>act(mage,'rations'),/Travel beside/);mage.actionPoints.value=0;assert.throws(()=>act(mage,'passage'),/Action Point/);
 const combat=state('shrine');combat.depthsRun.cleared=1;combat.position={x:5,y:5};applyGameplayAction(combat,'fight',{},1000);assert.throws(()=>act(combat,'bargain'),/fighting/);
});
test('saves cannot forge encounter rewards or erase a resolved choice',()=>{
 const s=state('explorer'),forged=structuredClone(s);forged.depthsRun.encounter={kind:'explorer',choice:'passage',gold:60};assert.equal(protectFishingState(s,forged).depthsRun.encounter.choice,undefined);
 act(s,'passage');const erase=structuredClone(s);erase.depthsRun.encounter={kind:'merchant'};assert.deepEqual(protectFishingState(s,erase).depthsRun.encounter,s.depthsRun.encounter);
 assert.throws(()=>normalizeState({...s,depthsRun:{...s.depthsRun,encounter:{kind:'explorer',choice:'passage',gold:999}}}),/Invalid dungeon encounter/);
});
test('each encounter appears as one optional object and opens a clear, dismissible choice window',()=>{
 for(const kind of Object.keys(dungeonEncounters)){
  const s=state(kind),g=boot(s);g.run('depthsExploring=true;updateDepthsPanel();openGalleryEncounter()');assert.equal(g.read("roomFurniture().filter(p=>p.type==='galleryEncounter').length"),1);assert.equal(g.nodes.get('galleryEncounterVisit').hidden,false);assert.equal(g.nodes.get('galleryEncounterChoices').children.length,2);assert.equal(g.nodes.get('galleryEncounterDialog').open,true);g.nodes.get('galleryEncounterLater').onclick();assert.equal(g.nodes.get('galleryEncounterDialog').open,false);assert.equal(g.read('depthsRun.encounter.choice'),undefined);assert.deepEqual(g.errors,[]);
 }
});
