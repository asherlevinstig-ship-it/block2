import test from 'node:test';
import assert from 'node:assert/strict';
import {boot} from './helpers/game-client.mjs';
import {normalizeState} from '../server/player-state.mjs';
test('quest UI presents an any-order checklist and retains early kills and sales',()=>{
 const game=boot(normalizeState({location:'hub',position:{x:10,y:4},quest:{accepted:true,fish:0,boars:1,sold:true}}));
 game.run('updateQuestUI()');
 assert.match(game.nodes.get('wardenMessage').textContent,/any order/);
 assert.match(game.nodes.get('questTrackerText').textContent,/Fish 0\/3.*Boar 1\/1.*Sale complete/);
 assert.match(game.nodes.get('questBoar').textContent,/✓/);assert.match(game.nodes.get('questTrade').textContent,/✓/);
 assert.equal(game.nodes.get('questAction').disabled,true);
 game.run('quest.fish=3;updateQuestUI()');
 assert.equal(game.nodes.get('questAction').disabled,false);assert.match(game.nodes.get('questAction').textContent,/Claim/);
});
