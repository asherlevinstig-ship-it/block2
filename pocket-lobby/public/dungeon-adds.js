import {channelerWardActive} from './enemy-roles.js';
import {arenaPlayer,arenaEnemy,dungeonFloor,arenaInDanger,arenaBehindCover} from './dungeon-arena.js';
// One reinforcement schedule belongs to an encounter, never to a connected client.
// IDs are stable across saves/replays; a later shared party instance uses the same cap.
export const ADD_LIMIT=3;
export const addKinds={
 skitter:{id:'addSkitter',name:'Mire Hatchling',prop:'depthsSkitter',health:32,damage:6,shellArmor:0,interval:2800,archetype:'skirmisher',move:{id:'addBite',name:'Hatchling Bite',tell:900,recovery:650,shape:'arc',reach:1.5,angle:1.2,damage:0}},
 wisp:{id:'addWisp',name:'Rune Wisp',prop:'depthsSeer',health:30,damage:8,shellArmor:0,interval:3700,archetype:'caster',move:{id:'addBolt',name:'Wisp Bolt',tell:1400,recovery:800,shape:'bolt',reach:7,width:.42,damage:0,blockable:true}}
};
const effects=['burn','chilledUntil','weakenedUntil','weakenPercent','interruptResistUntil','castHits','castDeadline','stagger','staggerUntil','staggerWeakUntil','staggerResistUntil','exposedUntil'];
const heroFields=['bloodShield','bloodShieldUntil','stamina','staminaAt','dodgeUntil','nextDodgeAt','nextPlayerAt','nextFleeAt','magicWard','magicWardUntil','usedEssences','counterUntil','counterPercent','autoDodgeUntil'];
export function initializeAdds(e,now,foxBond=false){
 if(e.brainVersion!==2||e.arenaRoom==='depthsGate')return e;
 return {...e,addsVersion:1,...(foxBond?{foxBond:true}:{}),adds:[],addWaves:[],addKills:0,manualTarget:false,addWaveAt:e.enemy==='depthsGuardian'?0:now+3500,combatTarget:'leader'};
}
export function activeAdd(e){return e?.adds?.find(a=>a.id===e.combatTarget&&a.health>0);}
export function combatTargetTile(e){const a=activeAdd(e);return a?{x:a.x,y:a.y}:arenaEnemy(e);}
export function addEncounter(e,a){
 const out={...e,addActor:a.kind,health:a.health,arenaEnemy:{x:a.x,y:a.y},brainOrigin:a.origin??{x:a.x,y:a.y},arenaTarget:a.target??arenaPlayer(e),nextBoarAt:a.attackAt,arenaLockedFor:a.lockedFor??0};
 delete out.bossVersion;delete out.adds;delete out.addsVersion;delete out.combatTarget;
 for(const key of effects){delete out[key];if(a[key]!==undefined)out[key]=a[key];}
 return out;
}
export function mergeAddEvent(e,a,event,now=0){
 if(!event)return null;
 const next=event.encounter??event.killedEncounter,dead=event.outcome==='victory',out={...event,targetId:a.id,enemyId:addKinds[a.kind].id,enemyTile:{x:a.x,y:a.y},attackTile:a.target,attackReach:addKinds[a.kind].move.reach,addKill:dead};
 delete out.killedEncounter;
 if(event.outcome==='defeat'||event.outcome==='escaped')return out;
 const combined={...e};
 if(next)for(const key of heroFields){delete combined[key];if(next[key]!==undefined)combined[key]=next[key];}
 const actor={...a,health:dead?0:next.health};
 if(next){actor.attackAt=next.nextBoarAt;for(const key of effects){delete actor[key];if(next[key]!==undefined)actor[key]=next[key];}}
 combined.adds=e.adds.filter(b=>b.id!==a.id);if(!dead)combined.adds.push(actor);
 combined.adds.sort((a,b)=>a.id.localeCompare(b.id));combined.addKills=(e.addKills??0)+(dead?1:0);
 if(dead&&a.kind==='wisp'&&e.enemy==='cacheGuardian'&&!combined.adds.some(b=>b.kind==='wisp'&&b.health>0)){combined.staggerWeakUntil=Math.max(combined.staggerWeakUntil??0,now+3000);out.wardBroken=true;}
 if(dead&&combined.combatTarget===a.id){combined.combatTarget='leader';combined.manualTarget=false;}
 out.encounter=combined;out.outcome='fighting';return out;
}
export function queueBossAdds(e,now){
 if(e?.addsVersion!==1||e.enemy!=='depthsGuardian'||e.addWaveAt)return e;
 const stage=e.health<=e.brainMaxHealth/3?2:e.health<=e.brainMaxHealth*2/3?1:0;
 if(stage>e.addWaves.length&&e.addWaves.length<2)return {...e,addWaveAt:now+600};return e;
}
export function addDueAt(e){
 if(e?.addsVersion!==1)return Infinity;
 return Math.min(e.addWaveAt||Infinity,...e.adds.flatMap(a=>[a.thinkAt,a.attackAt,a.lockedFor===a.attackAt?Infinity:a.attackAt-addKinds[a.kind].move.tell,a.burn?.nextAt??Infinity]));
}
function valid(e,q,exclude){return q.x>=1&&q.x<=10&&q.y>=1&&q.y<=8&&dungeonFloor(e.arenaRoom,q.x,q.y)&&!(e.arenaRoom==='depthsGate'&&q.x===8)&&!(e.arenaSolids??[]).some(s=>s.x===q.x&&s.y===q.y)&&!(arenaEnemy(e).x===q.x&&arenaEnemy(e).y===q.y)&&!e.adds.some(a=>a.id!==exclude&&a.x===q.x&&a.y===q.y);}
export function spawnAddWave(e,now){
 const wave=e.addWaves.length+1;
 let kinds=['skitter','wisp'];
 if(e.enemy==='depthsBeetle')kinds=['skitter','skitter'];
 if(e.enemy==='depthsGuardian')kinds=wave===1?['skitter']:['wisp'];
 const p=arenaPlayer(e),adds=e.adds.map(a=>({...a})),next={...e,adds,addWaveAt:0,addWaves:[...e.addWaves,wave]};
 for(const kind of kinds){
  if(adds.length>=ADD_LIMIT)break;
  const tiles=[];for(let y=2;y<=8;y++)for(let x=2;x<=10;x++){const q={x,y};if(valid(next,q)&&Math.hypot(x-p.x,y-p.y)>=2.5)tiles.push(q);}
  tiles.sort((a,b)=>Math.abs(Math.hypot(a.x-p.x,a.y-p.y)-3.5)-Math.abs(Math.hypot(b.x-p.x,b.y-p.y)-3.5)||a.y-b.y||a.x-b.x);
  const tile=tiles[(wave+adds.length)%Math.min(3,tiles.length)];if(!tile)break;
  const offset=adds.length*450;adds.push({id:'wave'+wave+'-'+kind+'-'+adds.length,kind,health:addKinds[kind].health,...tile,spawnAt:now+1400,thinkAt:now+1400+offset,attackAt:now+1400+offset+900+addKinds[kind].move.tell,lockedFor:0});
 }
 return {action:'reinforcements',encounter:next,damage:0,taken:0,outcome:'fighting',wave,spawned:adds.length-e.adds.length};
}
export function advanceAddPosition(e,a,now){
 const p=arenaPlayer(e),from={x:a.x,y:a.y},caster=a.kind==='wisp',queue=[{...from,first:null}],seen=new Set();let step=null;
 const goal=q=>{const d=Math.hypot(q.x-p.x,q.y-p.y);return caster?d>=2.5&&d<=4&&!arenaBehindCover({...addEncounter(e,a),brainOrigin:q},addKinds[a.kind].move):d>=1&&d<=1.45;};
 for(const q of queue){const k=q.x+','+q.y;if(seen.has(k))continue;seen.add(k);if(goal(q)){step=q.first;break;}for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const n={x:q.x+dx,y:q.y+dy};if(valid(e,n,a.id)&&!(n.x===p.x&&n.y===p.y)&&!seen.has(n.x+','+n.y))queue.push({...n,first:q.first??n});}}
 return {...a,...(step??{}),thinkAt:now+(caster?600:450)};
}
export function addThreats(e,now){return (e?.adds??[]).filter(a=>a.spawnAt<=now&&a.lockedFor===a.attackAt&&a.attackAt>=now).map(a=>({actor:a,encounter:addEncounter(e,a),move:addKinds[a.kind].move}));}
export function chooseAutoAddTarget(e,now){
 const p=arenaPlayer(e),ready=(e.adds??[]).filter(a=>a.spawnAt<=now);
 if(!ready.length)return 'leader';
 const ranked=ready.map(a=>({a,score:(channelerWardActive(e,now)&&a.kind==='wisp'?100:0)+(a.kind==='wisp'?3:0)+(a.health<20?3:0)-Math.hypot(a.x-p.x,a.y-p.y)})).sort((a,b)=>b.score-a.score||a.a.id.localeCompare(b.a.id));
 return ranked[0].a.id;
}
export function normalizeAdds(e){
 if(e.addsVersion===undefined)return {};
 if(e.addsVersion!==1||e.brainVersion!==2||!Array.isArray(e.adds)||e.adds.length>ADD_LIMIT||!Array.isArray(e.addWaves)||e.addWaves.length>2||e.addWaves.some((v,i)=>v!==i+1))throw new Error('Invalid dungeon reinforcements.');
 const time=v=>{if(!Number.isSafeInteger(v)||v<0)throw new Error('Invalid reinforcement clock.');return v;};
 const ids=new Set(),tile=p=>p&&Number.isInteger(p.x)&&Number.isInteger(p.y)&&dungeonFloor(e.arenaRoom,p.x,p.y,e.vaultMechanism);
 const adds=e.adds.map(a=>{
  if(!Object.hasOwn(addKinds,a.kind)||typeof a.id!=='string'||!/^wave[12]-(skitter|wisp)-[0-2]$/.test(a.id)||ids.has(a.id)||!tile(a)||!Number.isInteger(a.health)||a.health<1||a.health>addKinds[a.kind].health)throw new Error('Invalid dungeon add.');ids.add(a.id);
  const out={id:a.id,kind:a.kind,health:a.health,x:a.x,y:a.y,...(a.pounceBonded===true?{pounceBonded:true}:{})};for(const key of ['spawnAt','thinkAt','attackAt','lockedFor'])out[key]=time(a[key]);
  for(const key of ['origin','target'])if(a[key]){if(!tile(a[key]))throw new Error('Invalid add target.');out[key]={...a[key]};}
  for(const key of effects)if(a[key]!==undefined){if(key==='burn'){const b=a.burn;if(!Number.isInteger(b?.damage)||b.damage<1||b.damage>12||time(b.nextAt)>time(b.until))throw new Error('Invalid add burn.');out.burn={damage:b.damage,nextAt:b.nextAt,until:b.until};}else out[key]=time(a[key]);}
  return out;
 });
 const target=e.combatTarget??'leader';if(target!=='leader'&&!ids.has(target))throw new Error('Invalid combat target.');
 return {addsVersion:1,...(e.foxBond===true?{foxBond:true}:{}),adds,addWaves:[...e.addWaves],addWaveAt:time(e.addWaveAt),addKills:time(e.addKills??0),manualTarget:e.manualTarget===true,combatTarget:target};
}
