import {millRaidClock,millRaidRules,raidWave,raidThreat,raidDanger,bridgeBarricade,bridgeDanger,besideBarricade} from '../public/mill-raid.js';
import {weaponProfile,armourProfile,armourSelection} from '../public/hunting.js';
import {manaAvailable,normalizeVitals,useHunger} from '../public/player-vitals.js';
import {essencePower,normalizeMagic} from '../public/essences.js';
const invalid=message=>Object.assign(new Error(message),{status:400});
const eligible=member=>member.damage>=10||member.support>=2||(member.repaired??0)>=bridgeBarricade.hit;
const millbreaker=event=>event.mobs.find(mob=>mob.kind==='warden'&&mob.hp>0);
function advanceBarricade(event,now){
 const attacker=millbreaker(event);
 if(!attacker)return;
 const rules=bridgeBarricade;
 const bridge=event.bridge??={hp:rules.max,nextHitAt:attacker.at+rules.firstHit};
 while(bridge.hp>0&&now>=bridge.nextHitAt){
  bridge.hp=Math.max(0,bridge.hp-rules.hit);
  const landed=bridge.nextHitAt;
  bridge.nextHitAt+=rules.interval;
  if(!bridge.hp){
   event.mobs.push({id:rules.flanker,kind:'skitter',name:'Bridge Skitter',x:rules.x,y:rules.y,hp:48,max:48,hitAt:0,at:landed});
  }
 }
}
export async function readMillRaid(db,now=Date.now()){
 const clock=millRaidClock(now);
 const row=await db.prepare('SELECT * FROM tower_mill_raids WHERE raid_id=?').bind(clock.id).first();
 const state=row?JSON.parse(row.state_json):{wave:0,mobs:[],members:{},victoryAt:0};
 if(clock.phase==='battle'&&!state.victoryAt)advanceBarricade(state,now);
 return {clock,now,version:row?.version??0,state};
}
export function publicMillRaid(raid,playerId){
 const {clock,state}=raid,member=state.members[playerId];
 const bridge=state.bridge;
 return {...clock,revision:raid.version,observedAt:raid.now,phase:state.victoryAt?'victory':clock.phase,wave:state.wave+1,mobs:state.mobs.length?state.mobs:clock.phase==='battle'?raidWave(0,1,clock.opens):[],defenders:Object.values(state.members).filter(m=>!m.defeated&&m.lastAt>raid.now-15000).length,
  bridge:{hp:bridge?.hp??bridgeBarricade.max,max:bridgeBarricade.max,nextHitAt:bridge?.hp&&millbreaker(state)?bridge.nextHitAt:0,repairedAt:bridge?.repairedAt??0},
  self:member?{damage:member.damage,support:member.support,repaired:member.repaired??0,qualified:eligible(member),claimed:!!member.claimed,defeated:!!member.defeated}:null,
  victoryAt:state.victoryAt,contributors:state.victoryAt?Object.values(state.members).filter(eligible).map(m=>({name:m.name,damage:m.damage,support:m.support,repaired:m.repaired??0})):[]};
}
export function advanceMillRaid(raid,state,playerId,body,now){
 const {clock}=raid,event=raid.state;
 if(body.raidId!==clock.id)throw invalid('This raid has ended. Refresh the mill event.');
 if(state.location!=='millbrook'||state.characterCreated===false||state.plan||state.report||state.hunting?.encounter||state.fishingCast||state.timberCut)throw invalid('Visit Millbrook in Play mode and finish your current activity first.');
 const action=body.kind;
 if(!['strike','tick','heal','power','claim','buy','repair'].includes(action))throw invalid('Choose a raid action.');
 let member=event.members[playerId];
 if(action==='claim'){
  if(!event.victoryAt||!member||!eligible(member)||member.claimed)throw invalid('Help defend the mill to claim one reward after victory.');
  member.claimed=true;state.credits+=millRaidRules.reward;state.goldEarned=(state.goldEarned??0)+millRaidRules.reward;
  for(const [key,xp] of Object.entries({strengthXp:20,vitalityXp:20,leadershipXp:10}))state.stats[key]=(state.stats[key]??0)+xp;
  return {text:'+75 gold · +20 Strength XP · +20 Vitality XP · +10 Leadership XP',gold:75};
 }
 if(action==='buy'){
  if(!event.victoryAt||now>=clock.next)throw invalid('The relief merchant arrives after victory.');
  member??=event.members[playerId]={name:state.avatar.name,damage:0,support:0,lastAt:now};
  if((member.purchases??0)>=3||(state.credits??0)<6||(state.meals.towerBread??0)>96)throw invalid('Bring 6 gold and bag space. Three bundles per visit.');
  state.credits-=6;state.meals.towerBread=(state.meals.towerBread??0)+3;member.purchases=(member.purchases??0)+1;
  return {text:'Relief supplies · +3 Tower Bread · -6 gold',gold:-6};
 }
 if(event.victoryAt||clock.phase!=='battle')throw invalid('The mill raid is not in battle.');
 if(state.health<=0||member?.defeated)throw invalid('You are out of this raid. Rest by the mill and return for the next defense.');
 if(action==='tick'&&!member)throw invalid('Strike a monster or repair the barricade to join the defense.');
 advanceBarricade(event,now);
 const bridge=event.bridge;
 if(action==='repair'){
  if(!besideBarricade(state.position))throw invalid('Walk beside the bridge barricade to repair it.');
  if(bridge?.hp===0)throw invalid('The barricade is breached. Defeat the Bridge Skitter.');
  if(!bridge||bridge.hp===bridgeBarricade.max)throw invalid('The barricade is at full health.');
  if(!state.woodcutting?.timber)throw invalid('Bring 1 timber from your bag to repair the barricade.');
 }
 const weapon=weaponProfile(state.combatGear?.equippedWeapon,state.combatGear?.activeSwordUpgrade,state.combatGear?.weaponEnchantments);
 const target=event.mobs.find(m=>m.id===body.target&&m.hp>0);
 // Check the initial strike before registering an unarmed or distant visitor.
 if(action==='strike'&&(!weapon||event.mobs.length&&(!target||Math.hypot(state.position.x-target.x,state.position.y-target.y)>2.15)))throw invalid(!weapon?'Equip a weapon in Inventory to defend the mill.':'Move closer to that monster to strike.');
 member??=event.members[playerId]={name:state.avatar.name,damage:0,support:0,lastAt:now,lastBeat:Math.floor((now-clock.opens)/4000)-1,heals:event.healSeq??0};
 if(!event.mobs.length)event.mobs=raidWave(0,1,now);
 const mobs=event.mobs;
 const flanker=mobs.find(mob=>mob.id===bridgeBarricade.flanker&&mob.hp>0);
 const currentBeat=Math.floor((now-clock.opens)/4000)-1;
 let suffered=0;
 // Resolve elapsed attacks once, against the saved physical tile. Inactive defenders
 // take at most three hits on return; they never attack or earn rewards while away.
 for(let beat=Math.max(member.lastBeat+1,currentBeat-2);beat<=currentBeat;beat++){
  const threat=raidThreat(clock.opens,clock.opens+beat*4000+3999,event.wave);
  const flanked=flanker&&threat.lands>flanker.at&&bridgeDanger(state.position);
  if((raidDanger(state.position,threat)||flanked)&&threat.lands>(member.safeUntil??0)){
   const damage=Math.max(3,threat.damage-(armourProfile(armourSelection(state.combatGear))?.absorption??0));
   const blocked=Math.min(damage,member.shield??0);member.shield=Math.max(0,(member.shield??0)-blocked);suffered+=damage-blocked;
  }
 }
 member.lastBeat=currentBeat;
 const recovered=now-member.lastAt<15000?Math.max(0,(event.healSeq??0)-(member.heals??0))*12:0;member.heals=event.healSeq??0;
 state.health=Math.max(0,Math.min(100,state.health+recovered)-suffered);
 member.lastAt=now;member.health=state.health;
 if(state.health<=0){state.health=1;member.health=1;member.defeated=true;return {text:'The raiders overwhelmed you. Withdraw and rest by the mill.',damage:suffered,defeated:true};}
 let text=suffered?'-'+suffered+' HP':'',damage=0,repaired=0;
 if(action==='repair'){
  repaired=Math.min(bridgeBarricade.repair,bridgeBarricade.max-bridge.hp);
  bridge.hp+=repaired;bridge.repairedAt=now;state.woodcutting.timber--;member.repaired=(member.repaired??0)+repaired;
  text='Barricade repaired · +'+repaired+' HP · −1 timber';
 }
 if(action==='heal'){
  const mana=manaAvailable(state.vitals,now);
  if(mana<15||now-(member.lastHeal??0)<8000)throw invalid('Healing pulse needs 15 mana and an 8 second recovery.');
  state.vitals={...normalizeVitals(state.vitals),mana:mana-15,manaAt:now};member.lastHeal=now;
  member.support+=Object.entries(event.members).filter(([id,m])=>id!==playerId&&!m.defeated&&now-m.lastAt<15000&&m.health<100).length;
  event.healSeq=(event.healSeq??0)+1;member.heals=event.healSeq;state.health=Math.min(100,state.health+12);member.health=state.health;text='Healing pulse · +12 HP to active defenders';
 }
 if(action==='power'){
  const magic=normalizeMagic(state.magic),id=magic.slots[body.slot],power=essencePower(id,state.stats,magic),mana=manaAvailable(state.vitals,now);
  if(!['q','e'].includes(body.slot)||!power||mana<10||(magic.cooldowns[id]??0)>now)throw invalid('Equip a ready essence ability and keep 10 mana to cast.');
  if(power.form==='sword'){
   const mob=mobs.find(m=>m.id===body.target&&m.hp>0);if(!mob||Math.hypot(state.position.x-mob.x,state.position.y-mob.y)>4)throw invalid('Choose a nearby raider for your spell.');
   damage=Math.min(mob.hp,power.value);mob.hp-=damage;mob.hitAt=now;member.damage+=damage;
  }else if(power.form==='shield')member.shield=power.value;
  else if(power.form==='focus')member.safeUntil=now+1600+power.value;
  else if(power.form==='speed'){member.lastStrike=0;member.safeUntil=now+1000;}
  else{
   member.support+=Object.entries(event.members).filter(([id,m])=>id!==playerId&&!m.defeated&&now-m.lastAt<15000&&m.health<100).length;
   event.healSeq=(event.healSeq??0)+1;member.heals=event.healSeq;state.health=Math.min(100,state.health+power.value);member.health=state.health;
  }
  magic.cooldowns[id]=now+power.cooldown;state.magic=magic;state.vitals={...normalizeVitals(state.vitals),mana:mana-10,manaAt:now};text=power.name+'!';
 }
 if(action==='strike'&&now-(member.lastStrike??0)>=weapon.interval){
  const mob=mobs.find(m=>m.id===body.target&&m.hp>0)??mobs.find(m=>m.hp>0);
  if(!mob||Math.hypot(state.position.x-mob.x,state.position.y-mob.y)>2.15)throw invalid('Move closer to that monster to strike.');
  damage=Math.min(mob.hp,weapon.damage+Math.min(15,Math.floor((state.stats.strengthXp??0)/250)));
  mob.hp-=damage;mob.hitAt=now;member.damage+=damage;member.lastStrike=now;useHunger(state,1);text='Hit '+mob.name+' · -'+damage+' HP';
  if(mob.kind==='warden'&&mob.hp>0&&bridge?.hp>0&&now>=bridge.nextHitAt-bridgeBarricade.tell){
   bridge.nextHitAt+=bridgeBarricade.interval;
   text='Millbreaker interrupted · Barricade protected';
  }
 }
 if(mobs.every(m=>m.hp<=0)){
  if(event.wave===2){event.victoryAt=now;text='Millbrook defended! The relief merchant has arrived.';}
  else{event.wave++;const count=Object.values(event.members).filter(m=>m.damage>0&&!m.defeated&&now-m.lastAt<15000).length;event.mobs=raidWave(event.wave,count,now);advanceBarricade(event,now);text='Wave '+(event.wave+1)+' approaches!';}
 }
 return {text,damage:suffered,hit:damage,healing:recovered,repaired};
}
export async function writeMillRaid(db,row,body,now=Date.now()){
 const operation=JSON.stringify([row.player_id,body.operation]);
 for(let attempt=0;attempt<5;attempt++){
  const raid=await readMillRaid(db,now);raid.now=now;
  await db.prepare('INSERT OR IGNORE INTO tower_mill_raids(raid_id,state_json) VALUES(?,?)').bind(raid.clock.id,JSON.stringify(raid.state)).run();
  const state=JSON.parse(row.state_json),receipt=advanceMillRaid(raid,state,row.player_id,body,now);
  const results=await db.batch([
   db.prepare('UPDATE tower_mill_raids SET state_json=?,version=version+1,last_operation=? WHERE raid_id=? AND version=? AND EXISTS(SELECT 1 FROM tower_players WHERE player_id=? AND revision=?)').bind(JSON.stringify(raid.state),operation,raid.clock.id,raid.version,row.player_id,row.revision),
   db.prepare('UPDATE tower_players SET state_json=?,revision=revision+1,last_request=?,updated_at=? WHERE player_id=? AND revision=? AND EXISTS(SELECT 1 FROM tower_mill_raids WHERE raid_id=? AND last_operation=?) RETURNING *').bind(JSON.stringify(state),body.operation,now,row.player_id,row.revision,raid.clock.id,operation)
  ]);
  const updated=results[1].results?.[0];if(updated){raid.version++;return {updated,raid:publicMillRaid(raid,row.player_id),receipt};}
  const current=await db.prepare('SELECT revision FROM tower_players WHERE player_id=?').bind(row.player_id).first();if(current?.revision!==row.revision)return null;
 }
 throw Object.assign(new Error('The mill is busy. Try that action again.'),{status:409});
}
