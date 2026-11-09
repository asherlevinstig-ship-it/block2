import test from 'node:test';import assert from 'node:assert/strict';import {explorationVisibility} from '../public/exploration-fog.js';import {normalizeState,settlePlan} from '../server/player-state.mjs';import {touchPresence} from '../server/routines.mjs';import {simpleAutoRules} from '../public/simple-auto.js';import {boot} from './helpers/game-client.mjs';
test('fog reveals only visited rooms and their immediate open frontier',()=>{
 const exits=room=>({tower:[{to:'trail'}],trail:[{to:'tower'},{to:'pond'}],pond:[{to:'ruins'}]}[room]??[]),input={currentRoom:'tower',knownRooms:['tower'],rooms:['tower','trail','pond','ruins'],exits};
 let fog=explorationVisibility(input);assert.equal(fog.status('tower'),'discovered');assert.equal(fog.status('trail'),'frontier');assert.equal(fog.status('pond'),'hidden');assert.equal(fog.status('ruins'),'hidden');fog=explorationVisibility({...input,currentRoom:'trail',discovered:['trail']});assert.equal(fog.status('pond'),'frontier');assert.equal(fog.status('ruins'),'hidden');assert.equal(explorationVisibility({...input,discovered:['pond']}).status('pond'),'discovered');
});
test('fresh map hides distant names and destinations but keeps Tower and an explore route',()=>{
 const g=boot(normalizeState({location:'outside',quest:{accepted:true}}));g.run('showHudMap()');const svg=g.nodes.get('worldMap').innerHTML;assert.match(svg,/map-fog-mask/);assert.match(svg,/Unexplored/);assert.doesNotMatch(svg,/Silverfin Pond|Moonwell Ruins|Bramble Clearing/);assert.equal(g.read('mapRouteVisible("pond")'),false);assert.equal(g.read('mapRouteVisible("trail")'),true);assert.match(g.nodes.get('mapFogSummary').textContent,/0 \/ 9/);assert.deepEqual(g.errors,[]);
});
test('discoveries persist through normalization and reveal names without resetting old progress',()=>{
 const s=normalizeState({location:'trail',quest:{accepted:true},adventure:{discovered:['trail','creek','pond']}}),g=boot(s);g.run('showHudMap()');assert.match(g.nodes.get('worldMap').innerHTML,/Silverfin Pond/);assert.equal(g.read('worldMapVisibility().status("pond")'),'discovered');assert.equal(g.read('worldMapVisibility().status("roots")'),'hidden');assert.deepEqual(normalizeState(s).adventure.discovered,['trail','creek','pond']);assert.deepEqual(g.errors,[]);
});
test('Auto exploring clears fog through the same recorded discoveries',()=>{
 const s=normalizeState({quest:{accepted:true},characterRules:simpleAutoRules('exploring',{risk:'safe'})});s.controlMode='auto';touchPresence(s,1000,{forceStart:true,active:false});settlePlan(s,250000);const g=boot(s);g.run('showHudMap()');assert.equal(g.read('worldMapVisibility().status("pond")'),'discovered');assert.match(g.nodes.get('worldMap').innerHTML,/Silverfin Pond/);assert.deepEqual(g.errors,[]);
});
