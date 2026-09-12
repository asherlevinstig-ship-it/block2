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
