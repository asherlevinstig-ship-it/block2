import test from 'node:test';
import assert from 'node:assert/strict';
import {moonwood} from '../public/moonwood.js';
import {keeperSites,overlookRoom} from '../public/lantern-keepers.js';
import {normalizeState} from '../server/player-state.mjs';
import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';
import {autoRoomPath,autoTilePath} from '../server/auto-motion.mjs';
import {boot} from './helpers/game-client.mjs';

test('the markers reveal a walkable overlook only after both clues are examined',()=>{
 const state=normalizeState({location:'waystation',position:{x:9,y:3}});
 const inspect=id=>applyGameplayAction(state,'keeperClue',{id},1000);
 const ap=state.actionPoints.value;
 inspect('keeperCrate');
 assert.equal(autoRoomPath('waystation',overlookRoom,state),null);
 assert.throws(()=>inspect('keeperMarker'),/Travel/);
 state.location='willowbank';state.position={x:4,y:13};inspect('keeperMarker');
 assert.equal(state.adventure.keeperMarkerRead,true);
 assert.equal(protectFishingState(state,{...state,adventure:{keeperRouteFound:true}}).adventure.keeperRouteFound,false);
 state.location='waystation';state.position={x:9,y:3};inspect('keeperCrate');
 assert.equal(state.actionPoints.value,ap);
 const [door]=autoRoomPath('waystation',overlookRoom,normalizeState(state));
 assert(autoTilePath('waystation',{x:1,y:6},door.tile,state));
 const ledger=keeperSites.keeperLedger;
 assert(autoTilePath(overlookRoom,door.arrival,{x:ledger.x-1,y:ledger.y},state));
 assert(moonwood.doors[overlookRoom].some(d=>d.to==='waystation'));
 const game=boot(normalizeState({...state,location:overlookRoom,position:door.arrival}));
 game.run('draw(2000);showHudMap()');assert.deepEqual(game.errors,[]);
});
