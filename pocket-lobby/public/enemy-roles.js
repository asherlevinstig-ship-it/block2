export const dungeonEnemyRoles={
 depthsBoar:{name:'Mire Skitter',kind:'hunter',weakness:'Sidestep the pounce, then punish its landing.',hint:'It approaches from the side. Its marked pounce stays committed: move clear, then strike during recovery for +25% damage. Chill delays its attack; wards soften a mistake.'},
 depthsBeetle:{name:'Shell Warden',kind:'plated',weakness:'Circle its plating, or strike during recovery.',hint:'Frontal weapon hits are heavily reduced. Move to its side or rear during a committed attack, use magic, or punish its recovery. Hatchlings arrive together: Fire and Storm Blades splash nearby enemies.'},
 treasuryGuardian:{name:'Ironhide Guardian',kind:'ironhide',weakness:'Break its stagger, or use magic.',hint:'Heavy hits break plating. Circle a committed attack to hit its rear, or strike during recovery. Leave the large slam ring.'},
 sealGuardian:{name:'Thornblade Duelist',kind:'thornblade',weakness:'Dodge the final flash, then counter.',hint:'Quick Slash can lead into a second cut. Held Thornstrike lands later: watch the warning rather than panic-dodging.'},
 cacheGuardian:{name:'Rune Channeler',kind:'channeler',weakness:'Defeat its Rune Wisp to break the ward.',hint:'The Wisp reduces damage to the Channeler by 60%. Target it first; fast hits or Storm can interrupt a charged bolt.'}
};
export function platedDefence(e,now){
 if(e?.addActor||e?.brainVersion!==2||!['depthsBeetle','treasuryGuardian','depthsGuardian'].includes(e.enemy))return null;
 if(e.enemy==='depthsGuardian'&&e.health<=(e.brainMaxHealth??420)*2/3)return null;
 if(now<(e.exposedUntil??0)||now<(e.staggerWeakUntil??0)||now<(e.brainRecoveryUntil??0))return 'open';
 // Facing is the committed warning, never a direction changed after player input.
 if(e.arenaLockedFor!==e.nextBoarAt||!e.brainOrigin||!e.arenaTarget||!e.arenaPlayer)return 'front';
 const o=e.brainOrigin,t=e.arenaTarget,p=e.arenaPlayer,dx=t.x-o.x,dy=t.y-o.y,px=p.x-o.x,py=p.y-o.y;
 const dot=(dx*px+dy*py)/(Math.hypot(dx,dy)*Math.hypot(px,py)||1);
 return dot<-.35?'rear':dot<.5?'side':'front';
}
export function physicalPlating(e,damage,armor,bonus,now){
 const facing=platedDefence(e,now);
 if(facing==='open'||facing==='rear')return {damage:damage+(bonus??0),shellGuarded:false,flanked:facing==='rear',recoveryOpening:facing==='open'};
 if(facing)return {damage:Math.max(1,Math.floor((damage-armor)*(facing==='front'?.5:.8))),shellGuarded:true,flanked:facing==='side'};
 return null;
}
export const channelerWardActive=(e,now)=>!!e&&!e.addActor&&e.enemy==='cacheGuardian'&&(e.adds??[]).some(a=>a.kind==='wisp'&&a.health>0&&a.spawnAt<=now);
export function roleDamage(e,damage,now,{magic=false}={}){
 const opening=magic&&!e?.addActor&&((e?.enemy==='treasuryGuardian'&&e.exposedUntil>now)||(e?.enemy==='cacheGuardian'&&e.staggerWeakUntil>now));
 const recoveryOpening=e?.brainVersion===2&&!e.addActor&&e.enemy==='depthsBoar'&&now<(e.brainRecoveryUntil??0);
 const raw=opening||recoveryOpening?Math.round(damage*1.25):damage;
 const reduced=channelerWardActive(e,now)&&raw>0?Math.max(1,Math.round(raw*.4)):raw;
 return {damage:reduced,wardAbsorbed:raw-reduced,coreBonus:opening,recoveryOpening};
}
export function enemyRoleInfo(e,now,id=e?.enemy){
 if(id==='depthsGuardian'){
  const max=e?.brainMaxHealth??240,phase=(e?.health??max)>max*2/3?1:(e?.health??max)>max/3?2:3;
  if(phase===1&&['rear','side','open'].includes(platedDefence(e,now)))return {name:'Vault Guardian',kind:'vault',status:platedDefence(e,now)==='rear'?'REAR EXPOSED · Strike past the plating':platedDefence(e,now)==='side'?'SIDE OPENING · Reduced plating':'CORE EXPOSED · Strike now',hint:'Circle the committed attack, or punish recovery. Leave the large slam ring.'};
  return {name:'Vault Guardian',kind:'vault',status:phase===1?(now<Math.max(e?.exposedUntil??0,e?.staggerWeakUntil??0)?'CORE EXPOSED · Strike now':'IRONCLAD · Build stagger; leave the slam ring'):phase===2?(now<(e?.counterUntil??0)?'COUNTER READY · Punish the opening':'UNBOUND · Watch the second cut; dodge, then counter'):'RUNIC HEART · 3 fast hits or Storm interrupt a charged volley',hint:phase===1?'Heavy weapons break the plating. Keep clear of the large ring and attack during recovery.':phase===2?'The first cut is followed by another attack. Hold your dodge for the final warning, then counter.':'Clear the Wisps. Charged volleys can be interrupted; detonation rings must be escaped.'};
 }
 const role=dungeonEnemyRoles[id];if(!role||e?.addActor)return null;
 if(role.kind==='hunter')return {...role,status:e?.brainVersion===2&&now<e.brainRecoveryUntil?'LANDING OPENING · Strike now · Damage +25%':role.weakness};
 if(role.kind==='plated')return {...role,status:platedDefence(e,now)==='open'?'PLATING OPEN · Strike during recovery':platedDefence(e,now)==='rear'?'REAR EXPOSED · Your weapon bypasses plating':platedDefence(e,now)==='side'?'SIDE OPENING · Reduced plating':role.weakness};
 if(role.kind==='channeler')return {...role,status:channelerWardActive(e,now)?'RUNE WARD · Defeat the Rune Wisp · Damage reduced 60%':e?.staggerWeakUntil>now?'WARD BROKEN · Strike now · Damage +25%':e?.adds?.some(a=>a.kind==='wisp'&&a.spawnAt>now)?'WISP SUMMONING · Target it when it appears':role.weakness};
 if(role.kind==='ironhide')return {...role,status:platedDefence(e,now)==='open'||e?.exposedUntil>now?'CORE EXPOSED · Strike now':platedDefence(e,now)==='rear'?'REAR EXPOSED · Strike past the plating':platedDefence(e,now)==='side'?'SIDE OPENING · Reduced plating':role.weakness};
 return {...role,status:e?.counterUntil>now?'COUNTER READY · Strike now':e?.brainCombo?'FOLLOW-UP · Watch for the second cut':role.weakness};
}
