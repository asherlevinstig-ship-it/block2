import test from 'node:test';
import assert from 'node:assert/strict';
import {playerCombatPose,boarCombatPose,recordCharacterReaction} from '../public/combat-art.js';
import {signatureCast} from '../public/signature-poses.js';

const events={strikeAt:1000,hurtAt:2000,dodgeAt:3000,boarAttackAt:4000,boarHitAt:1000,victoryAt:5000};
test('damage reactions distinguish heavy hits, shields, dodges and critical health',()=>{
 const small={},large={},blocked={},evaded={};
 recordCharacterReaction(small,{damage:6},1000);
 recordCharacterReaction(large,{damage:28},1000);
 recordCharacterReaction(blocked,{damage:0,shielded:30},1000);
 recordCharacterReaction(evaded,{damage:0,perfectDodge:true},1000);
 const pose=fx=>playerCombatPose({time:1300,now:1300,encounter:{nextPlayerAt:0},events:fx,health:18,maxHealth:100});
 assert.equal(pose(small).hurt,false);
 assert.equal(pose(large).heavyHit,true);
 assert.equal(pose(blocked).hurt,false);
 assert(pose(blocked).shieldPulse>0);
 assert(pose(evaded).perfectEvade>0);
 assert.equal(pose(evaded).strained,true);
 const reduced=playerCombatPose({time:1100,now:1100,encounter:null,events:large,reduced:true});
 assert.equal(reduced.recoil,0);assert.equal(reduced.hurt,true);
});
test('signature ability poses last for their own duration and settle without repeating',()=>{
 for(const [id,duration] of [['faultbreaker',900],['sanctuary',800],['bloodPrice',850]]){
  const cue={...events,strikeAt:-10000,hurtAt:-10000,dodgeAt:-10000,victoryAt:-10000,castAt:1000,castKind:id};
  const pose=playerCombatPose({time:1500,now:1500,encounter:null,events:cue});
  assert.equal(pose.castKind,id);assert(pose.casting>0);
  const ended=playerCombatPose({time:1000+duration,now:1000+duration,encounter:null,events:cue});
  assert.equal(ended.casting,null);assert.equal(ended.castKind,null);
  assert.equal(signatureCast({styleAbilities:{readyAt:{[id]:46000}}},1500).id,id);
  assert.equal(signatureCast({styleAbilities:{readyAt:{[id]:46000}}},1000+duration),null);
 }
});
test('combat poses anticipate, strike, recover and settle after their events',()=>{
  const encounter={nextPlayerAt:1200,nextBoarAt:1500};
  const before=playerCombatPose({time:900,now:900,encounter,events});
  const strike=playerCombatPose({time:1100,now:1100,encounter,events});
  assert(before.ready);assert.equal(before.lunge,0);assert(strike.lunge>0);
  assert.notEqual(before.angle,strike.angle);
  assert(playerCombatPose({time:2150,now:2150,encounter,events}).recoil>0);
  assert(playerCombatPose({time:3200,now:3200,encounter,events}).dodge>0);
  assert(boarCombatPose({time:4200,now:4200,encounter,events}).charge>0);
  const settled=playerCombatPose({time:7000,now:7000,encounter:null,events});
  assert.equal(settled.armed,false);assert.equal(settled.lunge,0);assert.equal(settled.recoil,0);assert.equal(settled.dodge,0);
  for(const time of [0,1000,1100,1400,2200,3200,4100,5000,5200,5900,6300,100000]){
    for(const pose of [playerCombatPose({time,now:time,encounter,events}),boarCombatPose({time,now:time,encounter,events})]){
      for(const value of Object.values(pose))if(typeof value==='number')assert(Number.isFinite(value));
    }
  }
});

test('defeat remains briefly visible then fades; reduced motion keeps static readable poses',()=>{
  const collapsed=boarCombatPose({time:5500,now:5500,encounter:null,events,defeated:true});
  assert(collapsed.squash<1);assert.equal(collapsed.alpha,1);
  assert(boarCombatPose({time:6000,now:6000,encounter:null,events,defeated:true}).alpha<1);
  assert.equal(boarCombatPose({time:6300,now:6300,encounter:null,events,defeated:true}).alpha,0);
  const encounter={nextPlayerAt:1200,nextBoarAt:1500};
  for(const time of [1100,2150,3200,4200,5500]){
    const p=playerCombatPose({time,now:time,encounter,events,reduced:true});
    assert(p.armed);assert.equal(p.lunge,0);assert.equal(p.recoil,0);assert.equal(p.dodge,0);assert.equal(p.lift,0);
    const b=boarCombatPose({time,now:time,encounter,events,reduced:true,defeated:time>5000});
    assert.equal(b.charge,0);assert.equal(b.recoil,0);assert.equal(b.fall,0);assert.equal(b.squash,1);
  }
});
