const test=require('node:test');
const assert=require('node:assert/strict');

test('ordinary undead share readable combat phases but keep distinct poses',async()=>{
  const {ordinaryCombatPhase,ordinaryCombatPose}=await import('../../client/js/combat-visual-language.mjs');
  assert.equal(ordinaryCombatPhase('draw'),'anticipation');
  assert.equal(ordinaryCombatPhase('windup'),'anticipation');
  assert.equal(ordinaryCombatPhase('attack'),'impact');
  assert.equal(ordinaryCombatPhase('recover'),'recovery');
  assert.equal(ordinaryCombatPhase('stun'),'disabled');
  const drawn=ordinaryCombatPose('skeleton','draw',.32);
  const lunging=ordinaryCombatPose('zombie','windup',.32);
  assert.ok(drawn.bow>0);
  assert.equal(lunging.bow,0);
  assert.notEqual(drawn.right,lunging.right);
  assert.ok(ordinaryCombatPose('zombie','attack',.16).lean>0);
  assert.equal(ordinaryCombatPose('skeleton','recover',1).bow,0);
  assert.equal(ordinaryCombatPose('boss','draw',.2),null);
});

test('combat cues classify starter attacks and preserve safe-pocket and lane semantics',async()=>{
  const {combatCue,ordinaryFollowThrough,ordinaryFollowPose}=await import('../../client/js/combat-visual-language.mjs');
  assert.deepEqual([combatCue('windup').type,combatCue('draw').type,combatCue('slamWind').type,combatCue('chargeWind').type,combatCue('volleyWind').type],['melee','ranged','area','charge','lanes']);
  assert.equal(combatCue('graveRingWind').label,'FIND POCKET');
  assert.equal(combatCue('graveRingWind').radius,0);
  assert.equal(combatCue('bossMeleeWind').radius,2.35);
  assert.equal(combatCue('idle'),null);
  const follow=ordinaryFollowThrough('windup','',0);
  assert.equal(follow,.42);
  assert.equal(ordinaryFollowPose(.32).state,'attack');
  assert.equal(ordinaryFollowPose(.12).state,'recover');
  assert.equal(ordinaryFollowPose(0),null);
  assert.equal(ordinaryFollowThrough('draw','stun',follow),0);
  assert.equal(ordinaryFollowThrough('draw','windup',follow),0);
});
