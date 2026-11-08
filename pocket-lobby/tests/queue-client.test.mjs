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
  assert.equal(g.read('currentRoom'),room);assert.notEqual(g.nodes.get('inventoryDialog').open,true);assert.notEqual(g.nodes.get('merchantDialog').open,true);
 }
});
