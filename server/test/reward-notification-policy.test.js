const test=require('node:test');
const assert=require('node:assert/strict');

test('reward policy separates routine loot from immersive moments',async()=>{
  const {rewardTier,rewardMomentCopy}=await import('../../client/js/reward-notification-policy.mjs');
  assert.equal(rewardTier('gold'),'minor');
  assert.equal(rewardTier('rare'),'important');
  assert.equal(rewardTier('legendary'),'legendary');
  assert.equal(rewardTier('rare',{tier:'major'}),'major');
  const gate=rewardMomentCopy('rare',1,'Abandoned Mine',{tier:'major',stagePanel:true,title:'E-RANK GATE CLEARED',detail:'The Foreman defeated'});
  assert.equal(gate.stagePanel,true);
  assert.equal(gate.title,'E-RANK GATE CLEARED');
  assert.equal(gate.detail,'The Foreman defeated');
});

test('duplicate reward moments aggregate without losing priority',async()=>{
  const {rewardMomentCopy,mergeRewardMoment}=await import('../../client/js/reward-notification-policy.mjs');
  const first=rewardMomentCopy('rare',1,'Frost Crystal');
  const next=rewardMomentCopy('rare',2,'Frost Crystal');
  const merged=mergeRewardMoment(first,next);
  assert.equal(merged.amount,3);
  assert.equal(merged.detail,'+3 Frost Crystal');
  assert.equal(merged.tier,'important');
  assert.equal(mergeRewardMoment(first,rewardMomentCopy('rare',1,'Mire Bloom')),null);
});

test('quest completion has one achievement-first moment with grouped rewards',async()=>{
  const {questCompletionMoment}=await import('../../client/js/reward-notification-policy.mjs');
  const story=questCompletionMoment({source:'story',title:'Road Ready',gold:25,xp:80,items:[{name:'Stone Sword',count:1},{name:'Bread',count:3}],nextStep:'Find the first Gate.'});
  assert.equal(story.options.title,'Road Ready');
  assert.equal(story.options.kicker,'STORY QUEST COMPLETE');
  assert.equal(story.options.tier,'major');
  assert.match(story.options.detail,/Stone Sword ×1 · Bread ×3 · \+80 Hunter XP · \+25 gold/);
  assert.equal(story.options.hint,'NEXT: Find the first Gate.');
  const routine=questCompletionMoment({source:'guild',title:'Road Patrol',gold:12,items:[{name:'Coal',count:2},{name:'Iron',count:1},{name:'Bread',count:1}]});
  assert.equal(routine.options.tier,'important');
  assert.match(routine.options.detail,/\+1 more items/);
});

test('reward moments wait for modal panels instead of being hidden behind them',()=>{
  const fs=require('node:fs'),path=require('node:path');
  const world=fs.readFileSync(path.join(__dirname,'../../client/js/world.mjs'),'utf8');
  assert.match(world,/function rewardMomentBlocked\(\)\{[\s\S]*classList\.contains\('game-modal-open'\)/);
});
