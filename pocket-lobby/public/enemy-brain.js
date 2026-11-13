import {arenaPlayer,arenaEnemy,dungeonFloor,dungeonCover} from './dungeon-arena.js';
// Attacks are committed before their warning. Position and memory choose the next move;
// nothing reads future player input or changes a marked attack after commitment.
export const smartAttacks={
 skitterBite:{name:'Snapping Bite',tell:700,recovery:500,shape:'arc',reach:1.45,angle:1.1,damage:-3},
 skitterPounce:{name:'Leaping Pounce',tell:1100,recovery:950,shape:'lane',reach:5,width:.62,damage:4,cooldown:4500},
 skitterRake:{name:'Flanking Rake',tell:850,recovery:650,shape:'arc',reach:1.9,angle:1.5,damage:1},
 ironhideSlam:{name:'Faultline Slam',tell:1800,recovery:1600,shape:'ring',radius:2.75,damage:8,cooldown:7000},
 seerConduit:{name:'Conduit Detonation',tell:1900,recovery:1300,shape:'ring',center:'target',radius:1.75,damage:8,cooldown:7500},
 wardenSweep:{name:'Stone Sweep',tell:900,recovery:650,shape:'arc',reach:2.1,angle:1.5,damage:-2},
 wardenStomp:{name:'Shattering Stomp',tell:1450,recovery:1250,shape:'ring',radius:2.45,damage:6,opensShell:true,cooldown:6500},
 wardenThrow:{name:'Hurled Stone',tell:1200,recovery:850,shape:'bolt',reach:7,width:.6,damage:2,blockable:true,cooldown:4500},
 wardenRush:{name:'Shoulder Rush',tell:1200,recovery:950,shape:'lane',reach:6,width:.95,damage:5,cooldown:5500},
 seerBolt:{name:'Rune Bolt',tell:1200,recovery:550,shape:'bolt',reach:7,width:.45,damage:0,blockable:true},
 seerFan:{name:'Threefold Volley',tell:1550,recovery:850,shape:'bolt',reach:7,width:.42,fan:[-.4,0,.4],damage:2,blockable:true,cooldown:5500},
 seerBurst:{name:'Rune Eruption',tell:1450,recovery:1050,shape:'ring',center:'target',radius:1.45,damage:5,cooldown:5500},
 seerRepulse:{name:'Repulsion Pulse',tell:1000,recovery:700,shape:'ring',radius:2.1,damage:0,cooldown:4000},
 sentinelSlash:{name:'Quick Slash',tell:700,recovery:500,shape:'arc',reach:1.8,angle:1.1,damage:-2},
 sentinelLunge:{name:'Pursuing Lunge',tell:1050,recovery:700,shape:'lane',reach:5,width:.62,damage:3,cooldown:4000},
 sentinelDelayed:{name:'Held Thornstrike',tell:1750,recovery:1000,shape:'ring',center:'target',radius:1.4,damage:6,cooldown:5000},
 sentinelSweep:{name:'Returning Sweep',tell:950,recovery:750,shape:'arc',reach:2.35,angle:1.95,damage:2},
 bossIronSweep:{name:'Anchor Sweep',tell:1100,recovery:800,shape:'arc',reach:2.6,angle:1.9,damage:1},
 bossIronSmash:{name:'Sundering Smash',tell:1550,recovery:1350,shape:'ring',radius:2.7,damage:7,opensShell:true,cooldown:6500},
 bossHarpoon:{name:'Chain Harpoon',tell:1300,recovery:950,shape:'lane',reach:7,width:.8,damage:3,cooldown:4500},
 bossCleave:{name:'Twinblade Cleave',tell:850,recovery:500,shape:'arc',reach:2.2,angle:1.55,damage:0},
 bossDelayed:{name:'Held Overhead',tell:1500,recovery:1000,shape:'ring',center:'target',radius:1.5,damage:5,cooldown:5000},
 bossLunge:{name:'Chained Lunge',tell:1000,recovery:700,shape:'lane',reach:6,width:.8,damage:3,cooldown:4000},
 bossFan:{name:'Heartbolt Volley',tell:1500,recovery:800,shape:'bolt',reach:8,width:.5,fan:[-.42,0,.42],damage:3,blockable:true},
 bossErupt:{name:'Runic Detonation',tell:1600,recovery:1050,shape:'ring',center:'target',radius:1.55,damage:6,cooldown:5000},
 bossPulse:{name:'Heart Pulse',tell:1100,recovery:650,shape:'ring',radius:2.4,damage:0,cooldown:4000}
};
for(const [id,move] of Object.entries(smartAttacks))Object.assign(move,{id,opensShell:move.opensShell===true});
export function smartProfile(base){
 if(!base?.room.startsWith('depths'))return base;
 const boss=base.id==='depthsGuardian',elite=base.elite||base.id==='treasuryGuardian';
 return {...base,health:Math.round(base.health*(boss||elite?1.75:1.25)),damage:Math.ceil(base.damage*(boss||elite?1.3:1.1))};
}
export function brainAttackIds(enemy){
 if(enemy.id==='treasuryGuardian')return ['wardenSweep','ironhideSlam','wardenThrow','wardenRush'];
 if(enemy.id==='cacheGuardian')return ['seerBolt','seerFan','seerConduit','seerRepulse'];
 if(enemy.id==='depthsBoar')return ['skitterBite','skitterPounce','skitterRake'];
 if(enemy.id==='depthsGuardian')return enemy.index===2?['bossCleave','bossDelayed','bossLunge']:enemy.index===3?['bossFan','bossErupt','bossPulse']:['bossIronSweep','bossIronSmash','bossHarpoon'];
 if(enemy.archetype==='caster')return ['seerBolt','seerFan','seerBurst','seerRepulse'];
 if(enemy.archetype==='duelist')return ['sentinelSlash','sentinelLunge','sentinelDelayed','sentinelSweep'];
 return ['wardenSweep','wardenStomp','wardenThrow','wardenRush'];
}
export function chooseBrainAttack(e,enemy,now){
 const foe=arenaEnemy(e),p=arenaPlayer(e),distance=Math.hypot(p.x-foe.x,p.y-foe.y),recent=e.brainRecentMoves??[],history=e.brainPlayerHistory??[];
 const repeated=history.length>=2&&history.at(-1).dx===history.at(-2).dx&&history.at(-1).dy===history.at(-2).dy;
 const available=brainAttackIds(enemy).filter(id=>now>=(e.brainCooldowns?.[id]??0));
 const ids=available.length?available:brainAttackIds(enemy);
 if(enemy.id==='sealGuardian'){
  if(distance<=2.4&&(e.brainAttackCount??0)===0&&ids.includes('sentinelSlash'))return 'sentinelSlash';
  if(distance<=2.5&&recent.at(-1)==='sentinelSlash'&&ids.includes('sentinelSweep'))return 'sentinelSweep';
  if((e.brainAttackCount??0)%3===2&&ids.includes('sentinelDelayed'))return 'sentinelDelayed';
 }
 return ids.map((id,index)=>{
  const m=smartAttacks[id];let score=10+((e.brainAttackCount??0)*7+index*3)%5;
  if(id===recent.at(-1))score-=18;
  if(distance>2.4){if(m.shape==='bolt'||m.shape==='lane'||m.center==='target')score+=15;else score-=16;}
  if(distance<1.7&&m.shape==='arc')score+=5;
  if(m.shape==='ring'&&m.center!=='target'&&distance<2.5)score+=5;
  if(m.center==='target'&&(repeated||(e.brainStepsSinceAttack??0)<2||(e.brainMisses??0)>0))score+=13;
  if((e.brainBlockedCount??0)>0&&m.center==='target')score+=24;
  if(m.shape==='bolt'&&(e.brainBlockedCount??0)>0)score-=20;
  if(m.fan&&repeated)score+=12;
  if(m.tell>=1400&&e.dodgeUntil>now)score+=12;
  if(m.tell<=950&&(e.stamina??100)<25)score+=9;
  return {id,score};
 }).sort((a,b)=>b.score-a.score)[0].id;
}
export function planBrainAttack(e,enemy,now,previous=null){
 const id=chooseBrainAttack(e,enemy,now),move=smartAttacks[id],count=e.brainAttackCount??0;
 const combo=!!previous&&(enemy.id==='sealGuardian'?previous.id==='sentinelSlash':(enemy.elite||enemy.id==='depthsGuardian'||enemy.archetype==='duelist')&&count%3===1);
 const recovery=previous?Math.max(300,Math.round(previous.recovery*(combo?.55:1))):500;
 const approach=combo?150:enemy.archetype==='caster'?400:550;
 return {...e,brainMove:id,brainRecoveryUntil:now+recovery,brainNextThinkAt:now+recovery,nextBoarAt:now+recovery+approach+move.tell,
  brainCooldowns:{...e.brainCooldowns,...(move.cooldown?{[id]:now+move.cooldown}:{})},brainRecentMoves:[...(e.brainRecentMoves??[]),id].slice(-3),brainCombo:combo};
}
export function initializeBrain(e,base,now){
 const enemy=smartProfile(base),next={...e,brainVersion:2,brainMaxHealth:enemy.health,health:enemy.health,brainAttackCount:0,brainMisses:0,brainBlockedCount:0,brainStepsSinceAttack:0,brainPlayerHistory:[],brainCooldowns:{},brainRecentMoves:[],brainAutoStepAt:0,arenaCycle:e.arenaCycle??0};
 return planBrainAttack(next,enemy,now);
}
function coverBetween(a,b){const dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy;return dungeonCover.some(p=>{const t=d?((p.x-a.x)*dx+(p.y-a.y)*dy)/d:0;return t>0&&t<1&&Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)<.65;});}
export function brainThinkEvent(state,enemy,move,now){
 const e=state.hunting.encounter,p=arenaPlayer(e),from=arenaEnemy(e),next={...e};
 const warning=e.nextBoarAt-move.tell;
 if(now<(e.staggerUntil??0)||now<(e.brainRecoveryUntil??0)||now>=warning){next.brainNextThinkAt=now<Math.max(e.staggerUntil??0,e.brainRecoveryUntil??0)?Math.max(e.staggerUntil??0,e.brainRecoveryUntil??0):e.nextBoarAt+1;return {action:'enemyThink',encounter:next,health:state.health,damage:0,taken:0,outcome:'fighting'};}
 const caster=enemy.archetype==='caster',distance=Math.hypot(p.x-from.x,p.y-from.y);
 const valid=q=>!(e.adds??[]).some(a=>a.x===q.x&&a.y===q.y)&&q.x>=1&&q.x<=10&&q.y>=1&&q.y<=8&&dungeonFloor(state.location,q.x,q.y)&&!(q.x===p.x&&q.y===p.y)&&!(e.arenaSolids??[]).some(s=>s.x===q.x&&s.y===q.y)&&!(state.location==='depthsGate'&&q.x===8);
 let goals=[];for(let y=1;y<=8;y++)for(let x=1;x<=10;x++){const q={x,y},d=Math.hypot(x-p.x,y-p.y);if(valid(q)&&(caster?d>=2.5&&d<=4&&!coverBetween(q,p):d>=1&&d<=1.45))goals.push(q);}
 const hunter=enemy.id==='depthsBoar';
 if(hunter&&distance>1.45){const dx=from.x-p.x,dy=from.y-p.y,flanks=goals.filter(q=>((q.x-p.x)*dx+(q.y-p.y)*dy)/distance<.5&&((q.x-p.x)*dy-(q.y-p.y)*dx)>0);if(flanks.length)goals=flanks;}
 const queue=[{...from,first:null}],seen=new Set(),goal=new Set(goals.map(p=>p.x+','+p.y));let step=null;
 for(const q of queue){const k=q.x+','+q.y;if(seen.has(k))continue;seen.add(k);if(goal.has(k)){step=q.first;break;}for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const n={x:q.x+dx,y:q.y+dy};if(valid(n)&&!seen.has(n.x+','+n.y))queue.push({...n,first:q.first??n});}}
 if(step)next.arenaEnemy=step;
 next.brainNextThinkAt=now+(enemy.id==='depthsBoar'?420:caster?600:550);
 return {action:step?'enemyMove':'enemyThink',behaviour:step?(caster?'Seeking a clear firing line.':hunter?'Circling your flank before the pounce.':'Closing to attack range.'):'Watching for an opening.',encounter:next,health:state.health,damage:0,taken:0,outcome:'fighting'};
}
export function normalizeBrain(e,base){
 if(e.brainVersion===undefined)return {};
 if(e.brainVersion!==2||e.arenaVersion!==1||!(base.room.startsWith('depths')||base.room==='millCellar'||base.room==='crystaldeep')||e.brainMaxHealth!==smartProfile(base).health||!smartAttacks[e.brainMove])throw new Error('Invalid enemy intelligence.');
 if(!Array.isArray(e.brainRecentMoves??[])||!Array.isArray(e.brainPlayerHistory??[])||!e.brainCooldowns||typeof e.brainCooldowns!=='object'||Array.isArray(e.brainCooldowns))throw new Error('Invalid enemy memory.');
 const time=v=>{if(v===undefined)return 0;if(!Number.isSafeInteger(v)||v<0)throw new Error('Invalid enemy clock.');return v;};
 const tile=p=>Number.isInteger(p?.x)&&Number.isInteger(p?.y)&&p.x>=1&&p.x<=10&&p.y>=1&&p.y<=8&&dungeonFloor(base.room,p.x,p.y);
 const out={brainVersion:2,brainMaxHealth:e.brainMaxHealth,brainMove:e.brainMove,brainCombo:e.brainCombo===true};
 for(const key of ['brainNextThinkAt','brainRecoveryUntil','brainAutoStepAt','brainAttackCount','brainMisses','brainBlockedCount','brainStepsSinceAttack'])out[key]=time(e[key]);
 if(e.brainOrigin){if(!tile(e.brainOrigin))throw new Error('Invalid enemy origin.');out.brainOrigin={...e.brainOrigin};}
 out.brainRecentMoves=(e.brainRecentMoves??[]).filter(id=>smartAttacks[id]).slice(-3);
 out.brainCooldowns=Object.fromEntries(Object.entries(e.brainCooldowns??{}).filter(([id])=>smartAttacks[id]).map(([id,at])=>[id,time(at)]));
 out.brainPlayerHistory=(e.brainPlayerHistory??[]).slice(-4).map(p=>{if(![-1,0,1].includes(p.dx)||![-1,0,1].includes(p.dy)||Math.abs(p.dx)+Math.abs(p.dy)!==1)throw new Error('Invalid movement history.');return {dx:p.dx,dy:p.dy,at:time(p.at)};});
 return out;
}

export function advanceOnEnemy(e,reach){
 const hero=arenaPlayer(e),foe=arenaEnemy(e),queue=[{...hero,first:null}],seen=new Set();
 for(const p of queue){const key=p.x+','+p.y;if(seen.has(key))continue;seen.add(key);if(Math.hypot(p.x-foe.x,p.y-foe.y)<=reach)return p.first;
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const n={x:p.x+dx,y:p.y+dy};if(!(e.adds??[]).some(a=>a.x===n.x&&a.y===n.y)&&n.x>=1&&n.x<=10&&n.y>=1&&n.y<=8&&dungeonFloor(e.arenaRoom,n.x,n.y)&&!(n.x===foe.x&&n.y===foe.y)&&!(e.arenaSolids??[]).some(s=>s.x===n.x&&s.y===n.y)&&!(e.arenaRoom==='depthsGate'&&n.x===8)&&!seen.has(n.x+','+n.y))queue.push({...n,first:p.first??n});}
 }
 return null;
}
