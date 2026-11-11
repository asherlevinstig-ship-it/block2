import test from 'node:test';
import assert from 'node:assert/strict';
import {autoUsage,autoUsagePhase,recordAutoUsage} from '../server/auto-usage.mjs';

test('Auto usage attributes elapsed time to the preceding phase and caps it at the plan deadline',()=>{
 const env={AUTO_METRICS_LOG:'1'};
 const previous={phase:'fishing',audience:'empty',at:1000,until:4500};
 assert.deepEqual(autoUsage(env,previous,'alarm',9000),{
  event:'auto_usage_v1',weight:1,phase:'fishing',audience:'empty',trigger:'alarm',activeMs:3500,presence:0,activity:0,spot:0,saves:0,
 });
 assert.equal(autoUsage(env,null,'sync',9000).activeMs,0);
 const state={location:'pond',plan:{physicalFishing:true}};
 assert.equal(autoUsagePhase(state,{moving:true},'fishing'),'travel');
 assert.equal(autoUsagePhase(state,{moving:false},'fishing'),'fishing');
 assert.equal(autoUsagePhase({plan:{treeWork:{}}},{},'woodcutting'),'woodcutting');
 assert.equal(autoUsagePhase({plan:{activeHunt:{}}},{},'hunt-boar'),'combat');
 assert.equal(autoUsagePhase({plan:{miningWork:{}}},{},'mining'),'mining');
 assert.equal(autoUsagePhase({plan:{miningWork:{}},hunting:{encounter:{enemy:'crystalGuardian'}}},{},'mining'),'combat');
});

test('production logs sample Auto ticks and omit character identifiers',t=>{
 const random=t.mock.method(Math,'random',()=>0.5);
 const log=t.mock.method(console,'log',()=>{});
 const previous={phase:'fishing',audience:'observed',at:1000,until:4500,playerId:'private'};
 assert.equal(autoUsage({},previous,'alarm',2000),null);
 random.mock.mockImplementation(()=>0.01);
 recordAutoUsage(autoUsage({},previous,'alarm',2000));
 assert.deepEqual(log.mock.calls[0].arguments,[{
  event:'auto_usage_v1',weight:20,phase:'fishing',audience:'observed',trigger:'alarm',
  activeMs:1000,presence:0,activity:0,spot:0,saves:0,
 }]);
});
