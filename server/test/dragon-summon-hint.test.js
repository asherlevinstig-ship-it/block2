const test=require('node:test');
const assert=require('node:assert/strict');

test('dragon summon prompt only advertises X for a rideable owned dragon in an allowed realm',async()=>{
  const {dragonSummonHint}=await import('../../client/js/dragon-summon-hint.mjs');
  const ready={owned:true,adult:true,realmAllowed:true,mountedDragon:false};
  assert.equal(dragonSummonHint(ready),'Press X to summon & ride your dragon');
  assert.equal(dragonSummonHint({...ready,owned:false}),'');
  assert.equal(dragonSummonHint({...ready,mountedDragon:true}),'');
  assert.match(dragonSummonHint({...ready,adult:false}),/growing.*Press \\/);
  assert.match(dragonSummonHint({...ready,realmAllowed:false}),/Return to the overworld or Taming Land/);
  assert.match(dragonSummonHint({...ready,touch:true}),/Menu → Call Dragon/);
  assert.match(dragonSummonHint({...ready,adult:false,touch:true}),/Menu → Dragon Bonds/);
});
