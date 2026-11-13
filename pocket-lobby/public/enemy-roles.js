export const dungeonEnemyRoles={
 treasuryGuardian:{name:'Ironhide Guardian',kind:'ironhide',weakness:'Break its stagger, or use magic.',hint:'Heavy weapon hits build stagger. When the plating breaks, punish the exposed core. Leave the large slam ring.'},
 sealGuardian:{name:'Thornblade Duelist',kind:'thornblade',weakness:'Dodge the final flash, then counter.',hint:'Quick Slash can lead into a second cut. Held Thornstrike lands later: watch the warning rather than panic-dodging.'},
 cacheGuardian:{name:'Rune Channeler',kind:'channeler',weakness:'Defeat its Rune Wisp to break the ward.',hint:'The Wisp reduces damage to the Channeler by 60%. Target it first; fast hits or Storm can interrupt a charged bolt.'}
};
export const channelerWardActive=(e,now)=>!!e&&!e.addActor&&e.enemy==='cacheGuardian'&&(e.adds??[]).some(a=>a.kind==='wisp'&&a.health>0&&a.spawnAt<=now);
export function roleDamage(e,damage,now,{magic=false}={}){
 const opening=magic&&!e?.addActor&&((e?.enemy==='treasuryGuardian'&&e.exposedUntil>now)||(e?.enemy==='cacheGuardian'&&e.staggerWeakUntil>now));
 const raw=opening?Math.round(damage*1.25):damage;
 const reduced=channelerWardActive(e,now)&&raw>0?Math.max(1,Math.round(raw*.4)):raw;
 return {damage:reduced,wardAbsorbed:raw-reduced,coreBonus:opening};
}
export function enemyRoleInfo(e,now,id=e?.enemy){
 if(id==='depthsGuardian'){
  const max=e?.brainMaxHealth??240,phase=(e?.health??max)>max*2/3?1:(e?.health??max)>max/3?2:3;
  return {name:'Vault Guardian',kind:'vault',status:phase===1?(now<Math.max(e?.exposedUntil??0,e?.staggerWeakUntil??0)?'CORE EXPOSED · Strike now':'IRONCLAD · Build stagger; leave the slam ring'):phase===2?(now<(e?.counterUntil??0)?'COUNTER READY · Punish the opening':'UNBOUND · Watch the second cut; dodge, then counter'):'RUNIC HEART · 3 fast hits or Storm interrupt a charged volley',hint:phase===1?'Heavy weapons break the plating. Keep clear of the large ring and attack during recovery.':phase===2?'The first cut is followed by another attack. Hold your dodge for the final warning, then counter.':'Clear the Wisps. Charged volleys can be interrupted; detonation rings must be escaped.'};
 }
 const role=dungeonEnemyRoles[id];if(!role||e?.addActor)return null;
 if(role.kind==='channeler')return {...role,status:channelerWardActive(e,now)?'RUNE WARD · Defeat the Rune Wisp · Damage reduced 60%':e?.staggerWeakUntil>now?'WARD BROKEN · Strike now · Damage +25%':e?.adds?.some(a=>a.kind==='wisp'&&a.spawnAt>now)?'WISP SUMMONING · Target it when it appears':role.weakness};
 if(role.kind==='ironhide')return {...role,status:e?.exposedUntil>now?'CORE EXPOSED · Strike now':role.weakness};
 return {...role,status:e?.counterUntil>now?'COUNTER READY · Strike now':e?.brainCombo?'FOLLOW-UP · Watch for the second cut':role.weakness};
}
