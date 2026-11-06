import test from 'node:test';
import assert from 'node:assert/strict';
import {canAwakenRootstone,normalizeRootstone,castRootbind} from '../public/rootstone.js';
import {normalizeState,startPlan} from '../server/player-state.mjs';
import {advanceHunt,createHunt,resumeHunt} from '../public/hunting.js';
import {touchPresence} from '../server/routines.mjs';

test('the Rootstone requires both discoveries and the correct rune order',()=>{
  const runes=['moth','wave','root'];
  assert.equal(canAwakenRootstone({shrine:true,bridge:true},'ruins',runes),true);
  assert.equal(canAwakenRootstone({shrine:false,bridge:true},'ruins',runes),false);
  assert.equal(canAwakenRootstone({shrine:true,bridge:false},'ruins',runes),false);
  assert.equal(canAwakenRootstone({shrine:true,bridge:true},'shrine',runes),false);
  assert.equal(canAwakenRootstone({shrine:true,bridge:true},'ruins',['wave','moth','root']),false);
  assert.equal(normalizeRootstone({power:'deepRoots'}).power,null);
});

test('Rootbind interrupts one charging attack without stopping player strikes',()=>{
  const encounter=createHunt(1000);
  const stone=normalizeRootstone({awakened:true,power:'rootbind'});
  assert.equal(castRootbind(stone,encounter,1200),false);
  assert.equal(castRootbind(stone,encounter,1800),true);
  assert.equal(encounter.rootboundUntil,3800);
  assert.equal(encounter.nextBoarAt,4400);
  assert.equal(encounter.nextPlayerAt,1450);
  assert.equal(advanceHunt(encounter,100,{},2300,()=>0.5).action,'attack');
  assert.equal(castRootbind(stone,encounter,4200),false);
  const saved=normalizeState({location:'clearing',adventure:{rootstone:stone},hunting:{encounter}});
  assert.equal(saved.adventure.rootstone.nextCastAt,13800);
  assert.equal(resumeHunt(saved.hunting.encounter,2000).nextBoarAt,4400);
});

test('Deep Roots speeds up away woodcutting, honors its target and cap, and leaves manual shifts at their standard pace',()=>{
  const character=power=>({
    ...normalizeState({location:'logging',woodcutting:{axeOwned:true,equipped:true},
      adventure:{rootstone:{awakened:true,power}},
      characterRules:{enabled:true,activity:'woodcutting',timberTarget:1000}}),
    routineLastSeen:0
  });
  const away=character('deepRoots');
  touchPresence(away,86400000);
  assert.equal(away.woodcutting.timber,640);
  assert.equal(away.report.deepRoots,true);
  assert.equal(away.report.reason,'away-cap');
  const target=character('deepRoots');
  target.characterRules.timberTarget=3;
  touchPresence(target,86400000);
  assert.equal(target.woodcutting.timber,3);
  assert.equal(target.report.endedAt,195000);
  assert.equal(target.report.reason,'target-reached');
  const normal=character('rootbind');
  touchPresence(normal,86400000);
  assert.equal(normal.woodcutting.timber,480);
  const manual=character('deepRoots');
  startPlan(manual,{kind:'woodcutting',hours:1},1000);
  assert.equal(manual.plan.interval,60000);
});
