import test from 'node:test';
import assert from 'node:assert/strict';
import {confluence,bondedEssences,essencePower,stoneForms,normalizeMagic} from '../public/essences.js';
import {normalizeState} from '../server/player-state.mjs';
import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';

const gems=['fire','ice','shadow'];
const character=()=>normalizeState({
  location:'ruins',position:{x:5,y:4},adventure:{rootstone:{awakened:true,power:'rootbind'}}
});
const act=(s,name,body={},now=1000)=>applyGameplayAction(s,name,body,now,()=>.5);

test('three distinct base Gems form an order-independent fourth, with five powers each',()=>{
  assert.equal(confluence(['shadow','fire','ice']).id,'eclipse');
  assert.equal(confluence(['fire','ice','storm']).id,'aurora');
  assert.equal(confluence(['fire','shadow','storm']).id,'emberstorm');
  assert.equal(confluence(['storm','shadow','ice']).id,'winterveil');
  assert.equal(confluence(['fire','fire','ice']),null);
  assert.equal(confluence(['fire','ice','eclipse']),null);
  const powers=bondedEssences(gems).flatMap(gem=>Object.keys(stoneForms).map(form=>essencePower(gem+':'+form)));
  assert.equal(new Set(powers.map(power=>power.name)).size,20);
  assert(essencePower('fire:sword',{strengthXp:150}).value>essencePower('fire:sword').value);
});

test('server bonds once, spends typed stones once, preserves unlocks across gem changes, and blocks forged snapshots',()=>{
  const s=character();
  assert.throws(()=>act(s,'bondEssences',{picks:['fire','fire','ice']}),/three/);
  act(s,'bondEssences',{picks:gems});
  assert.equal(s.magic.stones.sword,1);
  assert.throws(()=>act(s,'awakenPower',{id:'storm:sword'}),/bonded/);
  assert.throws(()=>act(s,'awakenPower',{id:'ice:shield'}),/matching/);
  act(s,'awakenPower',{id:'eclipse:sword'});
  assert.equal(s.magic.equipped,'eclipse:sword');
  assert.equal(s.magic.stones.sword,0);
  assert.throws(()=>act(s,'awakenPower',{id:'eclipse:sword'}),/already/);
  assert.throws(()=>act(s,'equipPower',{id:'ice:sword'}),/Awaken/);
  const forged=protectFishingState(s,{...s,magic:normalizeMagic({picks:gems,stones:{sword:999},unlocked:['ice:sword'],equipped:'ice:sword'})});
  assert.deepEqual(forged.magic,s.magic);
  s.location='shrine';
  act(s,'bondEssences',{picks:['fire','ice','storm']});
  assert.equal(s.magic.stones.sword,0);
  assert.equal(s.magic.equipped,null);
  assert.deepEqual(s.magic.unlocked,['eclipse:sword']);
});

test('server spell damage respects cooldown and awards a typed stone on a magic victory',()=>{
  const s=character();
  act(s,'bondEssences',{picks:gems});
  act(s,'awakenPower',{id:'fire:sword'});
  s.location='clearing';s.position={x:5,y:5};
  act(s,'fight',{},1000);
  const spell={combatId:s.combatId,input:'essence'};
  act(s,'combat',spell,1100);
  assert.equal(s.hunting.encounter.health,47);
  assert.equal(s.combatReceipt.events[0].power,'Fire Blade');
  act(s,'combat',spell,1200);
  assert.equal(s.hunting.encounter.health,47);
  assert.equal(s.combatReceipt.events.length,0);
  s.magic.nextCastAt=0;
  s.hunting.encounter.health=20;
  act(s,'combat',spell,1250);
  assert.equal(s.huntingLoot.boar,1);
  assert.equal(s.magic.stones.shield,1);
  assert.equal(s.combatReceipt.events[0].stone,'shield');
  act(s,'combat',spell,1300);
  assert.equal(s.magic.stones.shield,1);
});

test('shield, speed, focus and renewal alter actual combat state',()=>{
  for(const [form,check] of Object.entries({
    shield:s=>{assert.equal(s.hunting.encounter.magicWard,24);act(s,'combat',{combatId:s.combatId},2300);assert.equal(s.health,50);assert(s.combatReceipt.events.some(e=>e.warded>0));},
    speed:s=>{assert(s.hunting.encounter.stamina>75);assert.equal(s.hunting.encounter.nextPlayerAt,1150);},
    focus:s=>assert.equal(s.hunting.encounter.nextBoarAt,3850),
    renewal:s=>assert.equal(s.health,62)
  })){
    const s=character();
    act(s,'bondEssences',{picks:gems});
    s.magic.stones[form]=1;
    act(s,'awakenPower',{id:'ice:'+form});
    s.location='clearing';s.position={x:5,y:5};s.health=50;
    act(s,'fight');
    s.hunting.encounter.stamina=60;
    act(s,'combat',{combatId:s.combatId,input:'essence'},1100);
    check(s);
  }
});
