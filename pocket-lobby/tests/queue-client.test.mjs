import test from 'node:test';
import assert from 'node:assert/strict';
import {boot} from './helpers/game-client.mjs';
import {normalizeState} from '../server/player-state.mjs';
test('automated queue travel does not open equipment tutorials or merchant dialogs over the work report',()=>{
 const g=boot(normalizeState({location:'hub',quest:{accepted:true}}));
 for(const room of ['pond','store','market']){
  const s=normalizeState({location:room,position:{x:4,y:5},quest:{accepted:true},adventure:{discovered:['pond']}});
  s.plan={kind:'queue',source:'rules'};g.context.playerCloud.initial=s;
  g.context.towerApplyRoutineState(s);
  for(let frame=0;frame<1200&&g.read('!!autoJourney');frame++)g.run('advanceAnimation('+(1000+frame*200)+')');
  assert.equal(g.read('currentRoom'),room);assert.equal(g.read('autoJourney'),null);assert.notEqual(g.nodes.get('inventoryDialog').open,true);assert.notEqual(g.nodes.get('merchantDialog').open,true);
 }
});

test('reloading during an automated hunt does not enable manual combat polling',()=>{
 const state=normalizeState({location:'clearing',position:{x:5,y:5}});
 state.plan={kind:'queue',source:'rules',activeHunt:{id:'hunt'}};
 state.hunting.encounter={enemy:'boar',health:70,nextPlayerAt:2000,nextBoarAt:3000,nextFleeAt:0};
 const g=boot(state);assert.equal(g.read('player.inCombat'),false);
 g.context.towerApplyRoutineState(state);assert.equal(g.read('player.inCombat'),true);g.context.playerCloud.gameplay=()=>{throw new Error('Manual polling must stay off');};g.run('updateCombatMoment(10000)');assert.equal(g.read('currentRoom'),'clearing');
});
