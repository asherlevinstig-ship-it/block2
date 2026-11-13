import {rareBootsPenalty,awardRareHunt} from '../public/rare-loot.js';
import {playerMaxHealth,mealArmour} from '../public/food-buffs.js';
import {validVaultMechanism,vaultMechanisms} from '../public/vault-mechanisms.js';
import {dungeonFloor} from '../public/dungeon-arena.js';
import {vaultCoopRules,coopPhase,coopMove,coopDanger,coopEncounter,vaultPhaseDetails,vaultDefeatTip} from '../public/vault-coop.js';
import {physicalPlating} from '../public/enemy-roles.js';
import {combatBuild} from '../public/combat-builds.js';
import {huntingAttributes,weaponStagger,weaponProfile,armourSelection,armourProfile,playerMeleeReach,boarRules,normalizeCombatSummary} from '../public/hunting.js';
import {depthsSpoils} from '../public/depths.js';
import {essencePower,normalizeMagic,awardEssenceMastery,bondedEssences,bladeSplash} from '../public/essences.js';
import {manaAvailable,normalizeVitals} from '../public/player-vitals.js';
import {requireActionPoint,spendActionPoint} from './action-points.mjs';
import {awardDungeonWeapon} from '../public/dungeon-loot.js';
import {awardLeadership} from '../public/leadership.js';
import {tokenHash} from './identity.mjs';
import {MAX_SKILL_XP} from '../public/skill-curve.js';
const invalid=message=>Object.assign(new Error(message),{status:400});
const living=r=>Object.entries(r.members).filter(([,m])=>m.hp>0&&!m.left);
const uid=()=>crypto.randomUUID().slice(0,8).toUpperCase();
function eligible(s){if(s.location!=='depthsVault'||s.depthsRun?.cleared!==2||s.hunting?.encounter||s.plan||s.report||s.controlMode==='auto'||s.health<=0)throw invalid('Travel to the Sunken Vault in Play mode, before starting the solo fight.');}
function member(s,now){const build=combatBuild(s);return {id:uid(),name:s.avatar.name,hp:s.health,pos:{...s.position},lastAt:now,mealBuff:s.vitals?.mealBuff,damage:0,support:0,threat:0,lastStrike:0,dodgeUntil:0,counterUntil:0,nextDodgeAt:0,ward:0,used:[],build,armour:huntingAttributes(s.stats).armor+(armourProfile(armourSelection(s.combatGear))?.absorption??0)+build.armor-rareBootsPenalty(s),weapon:s.combatGear.equippedWeapon,attackInterval:huntingAttributes(s.stats,s.combatGear.equippedWeapon,s.combatGear.activeSwordUpgrade,false,s.combatGear.weaponEnchantments,build).attackInterval};}
function plan(r,at,pause=0){
 const phase=coopPhase(r),detail=vaultPhaseDetails[phase-1],players=living(r);if(!players.length){r.status='defeat';return;}
 const forced=players.find(([id])=>id===r.taunt&&at<r.tauntUntil),target=forced??players.sort((a,b)=>b[1].threat-a[1].threat)[0];
 r.target=target[0];r.targetTile={...target[1].pos};r.origin??={x:6,y:5};r.move=detail.moves[(r.attacks??0)%detail.moves.length];
 const move=coopMove(r);r.warningAt=at+pause+600;r.landsAt=r.warningAt+move.tell;r.phase=phase;r.castHits=0;
}
function hurt(r,m,amount,move,at){
 m.hp=Math.min(m.hp,playerMaxHealth(m,at));if(m.hp<=0||m.left)return;
 let damage=amount;if(m.dodgeUntil>=at&&m.dodgeUntil-at<=350){damage=0;m.counterUntil=at+1800+(m.build.counterWindow??0);m.lastFeedback='Perfect dodge · Counter ready';}
 if(damage&&m.ward>0&&at<=(m.wardUntil??0)){const block=Math.min(damage,m.ward);damage-=block;m.ward-=block;}
 if(damage)m.lastFeedback=move+' hit you for '+damage+' HP.';
 m.hp=Math.max(0,m.hp-damage);m.lastHit={at,damage,move};if(!m.hp){m.cause=move;m.tip=vaultDefeatTip(move);m.lastFeedback='Defeated by '+move;}
}
export function advanceVaultParty(r,now){
 if(r.status!=='battle')return;
 const end=Math.min(now,r.expiresAt);
 for(let guard=0;guard<400&&r.status==='battle';guard++){
  const due=Math.min(r.landsAt,r.burn?.nextAt??Infinity,...(r.adds??[]).filter(a=>a.hp>0).map(a=>a.landsAt));if(due>end)break;
  if(due===r.burn?.nextAt){const burn=r.burn,damage=Math.min(r.hp,burn.damage);r.hp-=damage;const source=r.members[burn.source];if(source){source.damage+=damage;source.threat+=damage;}if(burn.nextAt+1000<=burn.until)burn.nextAt+=1000;else delete r.burn;phaseChange(r,due);continue;}
  if(due===r.landsAt){
   const move=coopMove(r);for(const [,m] of living(r))if(coopDanger(r,m.pos))hurt(r,m,Math.max(5,Math.round((30+move.damage-m.armour-mealArmour(m,due))*(due<(r.weakenedUntil??0)?.75:1))),move.name,due);
   r.lastAttack={at:due,move:move.name,shape:move.shape,center:move.center,origin:{...r.origin},target:{...r.targetTile}};r.weakenedUntil=0;
   r.attacks=(r.attacks??0)+1;plan(r,due,move.recovery);
  }else{
   for(const add of r.adds??[]){if(add.hp<=0||add.landsAt!==due)continue;for(const [,m] of living(r))if(Math.hypot(m.pos.x-add.target.x,m.pos.y-add.target.y)<=1.1)hurt(r,m,Math.max(4,add.kind==='wisp'?14-m.armour-mealArmour(m,due):10-m.armour-mealArmour(m,due)),add.kind==='wisp'?'Wisp Bolt':'Hatchling Bite',due);
    const target=living(r).sort((a,b)=>a[1].hp-b[1].hp)[0];if(target)add.target={...target[1].pos};add.landsAt=due+3800;
   }
  }
  if(!living(r).length)r.status='defeat';
 }
 for(const m of Object.values(r.members))m.hp=Math.min(m.hp,playerMaxHealth(m,now));
 if(r.status==='battle'&&now>=r.expiresAt)r.status='expired';
}
function phaseChange(r,now){
 if(r.hp<=0){r.hp=0;r.status='victory';r.victoryAt=now;r.adds=[];return;}
 const phase=coopPhase(r);if(phase===r.phase)return;delete r.lastAttack;
 r.attacks=0;r.exposedUntil=0;r.stagger=0;plan(r,now,1500);
 const kind=phase===2?'skitter':'wisp',count=phase===3&&Object.keys(r.members).length>1?2:1;
 for(let i=0;i<count;i++)r.adds.push({id:'phase'+phase+'-'+i,kind,name:kind==='wisp'?'Rune Wisp':'Mire Hatchling',hp:kind==='wisp'?40:45,max:kind==='wisp'?40:45,x:i?8:4,y:i?4:7,target:{...r.targetTile},landsAt:now+4200});
}
function syncPlayer(s,r,id,now){const m=r.members[id];if(!m)return;if(m.hp<=0){
 if(!m.defeatLogged){m.defeatLogged=true;s.combatReports=[...(s.combatReports??[]),{id:'coop:'+r.id+':'+m.id,enemy:'depthsGuardian',room:'depthsVault',outcome:'defeat',endedAt:now,endedHealth:0,summary:normalizeCombatSummary({startedAt:r.startedAt??now,partial:true}),rewards:{},lostSpoils:depthsSpoils(s.depthsRun),defeat:{attack:m.cause??'Vault Guardian',damage:m.lastHit?.damage??0,tip:m.tip??vaultDefeatTip(m.cause)}}].slice(-10);}
 s.health=0;s.location='home';s.position={x:5,y:7};s.depthsRun=null;s.hunting.recoveryUntil=now+boarRules.recovery;delete s.vaultCoop;
 }else s.health=Math.min(m.hp,playerMaxHealth(s,now));}
export function publicVaultParty(r,id,now=Date.now()){
 const self=r.members[id];return {id:r.id,status:r.status,vaultMechanism:r.vaultMechanism,expiresAt:r.expiresAt,hp:r.hp,max:r.max,phase:r.phase??1,move:r.move,warningAt:r.warningAt,landsAt:r.landsAt,origin:r.origin,targetTile:r.targetTile,exposedUntil:r.exposedUntil,stagger:r.stagger??0,lastAttack:r.lastAttack,observedAt:now,
  targetName:r.members[r.target]?.name??'',leader:r.leader===id,members:Object.values(r.members).filter(m=>!m.left).map(m=>({id:m.id,peerId:m.peerId,name:m.name,hp:m.hp,damage:m.damage,support:m.support,position:m.pos,strikeAt:m.lastStrike,castAt:m.castAt??0})),self:self?{id:self.id,hp:self.hp,nextStrikeAt:self.lastStrike+self.attackInterval,damage:self.damage,support:self.support,claimed:!!self.claimed,left:!!self.left,feedback:self.lastFeedback??'',cause:self.cause,tip:self.tip}:null,adds:(r.adds??[]).filter(a=>a.hp>0)};
}
export function actVaultParty(r,s,id,body,now,random=Math.random){
 s.routineLastSeen=now;
 const kind=body.kind;
 if(kind==='join'){
  eligible(s);if(r.status!=='waiting'||Object.values(r.members).filter(m=>!m.left).length>=vaultCoopRules.limit)throw invalid('This party has started or is full.');
  if(s.vaultCoop&&s.vaultCoop.id!==r.id)throw invalid('Leave your current party first.');
  if(r.members[id]?.left)throw invalid('You have already left this expedition party.');
  if(s.position?.x===11&&!dungeonFloor('depthsVault',s.position.x,s.position.y,r.vaultMechanism))throw invalid('Travel off the spillway lane before joining this party.');
  r.members[id]??=member(s,now);s.vaultCoop={id:r.id};return {text:'Joined co-op Vault party.'};
 }
 const m=r.members[id];if(!m||m.left||s.vaultCoop?.id!==r.id)throw invalid('Join this Vault party first.');
 if(s.position?.x===11&&!dungeonFloor('depthsVault',s.position.x,s.position.y,r.vaultMechanism))throw invalid('Choose a walkable tile in the shared Vault.');
 // A movement arriving after the impact cannot erase damage from that impact.
 if(r.status!=='battle'||now<r.landsAt)m.pos={...s.position};
 advanceVaultParty(r,now);m.pos={...s.position};m.lastAt=now;syncPlayer(s,r,id,now);
 if(!s.vaultCoop)return {text:'Defeated by '+m.cause+'. '+m.tip};
 if(kind==='leave'){
  m.left=true;delete s.vaultCoop;s.location='depthsGallery';s.position={x:4,y:5};if(r.leader===id){const next=living(r)[0];if(next)r.leader=next[0];}if(!living(r).length)r.status='abandoned';return {text:'Left the co-op fight. Your expedition haul remains at risk.'};
 }
 if(kind==='claim'){
  if(r.status!=='victory'||m.claimed||!(m.damage>0||m.support>=1)||s.depthsRun?.cleared!==2)throw invalid('Help defeat the Guardian to claim one Vault reward.');
  m.claimed=true;s.depthsRun.cleared=3;s.depthsRun.shardEarned=true;
  if(r.vaultMechanism)s.depthsRun.vaultMechanism=r.vaultMechanism;
  delete s.vaultCoop;
  for(const [key,xp] of Object.entries({strengthXp:75,agilityXp:55,vitalityXp:75}))s.stats[key]=Math.min(MAX_SKILL_XP,s.stats[key]+xp);
  awardLeadership(s,'vaultClear');awardEssenceMastery(s.magic,m.used,50);awardRareHunt(s,'depthsGuardian',random);const drop=awardDungeonWeapon(s,now,random);if(drop)s.depthsRun.vaultWeapon=drop.weapon;return {text:'Vault cleared! Review your haul and bank it to leave safely.'};
 }
 if(kind==='mechanism'){
  if(r.leader!==id||r.status!=='waiting'||r.vaultMechanism||s.depthsRun.vaultMechanism)throw invalid('Only the waiting party leader can choose one Vault mechanism.');
  if(!validVaultMechanism(body.mechanism))throw invalid('Choose the spillway or stone screen.');
  r.vaultMechanism=body.mechanism;s.depthsRun.vaultMechanism=body.mechanism;
  return {text:vaultMechanisms[body.mechanism].detail};
 }
 if(kind==='start'){
  if(r.leader!==id||r.status!=='waiting')throw invalid('Only the party leader can start this waiting fight.');
  const count=Object.values(r.members).filter(m=>!m.left).length;r.max=Math.round(vaultCoopRules.health*(1+(count-1)*vaultCoopRules.scale));r.hp=r.max;r.status='battle';r.startedAt=now;r.phase=1;r.adds=[];r.stagger=0;plan(r,now,1500);return {text:'The Guardian awakens. Taunt draws its next attack; allies clear adds and interrupt.'};
 }
 if(kind==='tick')return {text:m.lastFeedback??'Watch the marked attack.'};
 if(r.status!=='battle'||m.hp<=0)throw invalid('This co-op battle is not active.');
 if(!['strike','power','dodge','taunt'].includes(kind))throw invalid('Choose a co-op combat action.');
 if(kind!=='dodge')requireActionPoint(s);
 const build=m.build,weapon=weaponProfile(m.weapon,s.combatGear.activeSwordUpgrade,s.combatGear.weaponEnchantments),stats=huntingAttributes(s.stats,m.weapon,s.combatGear.activeSwordUpgrade,false,s.combatGear.weaponEnchantments,build);
 const target=r.adds?.find(a=>a.id===body.target&&a.hp>0),position=target??r.origin,armour=target?0:r.phase===1&&now>=(r.exposedUntil??0)?9:0;
 let damage=0,text='';
 if(kind==='strike'){
  if(!weapon)throw invalid('You joined without a weapon. Use abilities, or retreat and equip one.');
  if(now<m.lastStrike+stats.attackInterval)throw invalid('Wait for your weapon to recover.');
  if(Math.hypot(m.pos.x-position.x,m.pos.y-position.y)>playerMeleeReach(m.weapon))throw invalid('Move closer to your target.');
  const plating=!target&&r.phase===1?physicalPlating({...coopEncounter(r),arenaPlayer:m.pos,arenaLockedFor:now>=r.warningAt?r.landsAt:0,brainRecoveryUntil:r.lastAttack?r.warningAt-600:0},stats.damage,9,0,now):null;
  damage=plating?.damage??Math.max(1,stats.damage-armour);if(plating?.flanked)text='Flank hit! ';if(now<m.counterUntil){damage=Math.ceil(damage*(1+(weapon.counterMultiplier??.5)+build.counter));m.counterUntil=0;text+='Counter! ';}if(now<(r.exposedUntil??0))damage=Math.ceil(damage*1.25);
  m.lastStrike=now;
  if(!target){r.stagger+=Math.ceil(weaponStagger(m.weapon,s.combatGear.activeSwordUpgrade)*build.stagger)+(build.id==='vanguard'&&m.ward>0&&m.wardUntil>now?8:0);if(r.stagger>=160){r.stagger=0;r.exposedUntil=now+3000;r.landsAt=Math.max(r.landsAt,now+2000);text='Stagger break! Core exposed. ';}
   if(r.phase===3&&r.move==='bossFan'&&now>=r.warningAt){r.castHits++;if(r.castHits>=3){plan(r,now,1800);m.support++;text+='Charged volley interrupted! ';}}
  }
 }
 if(kind==='power'){
  const magic=normalizeMagic(s.magic),power=essencePower(magic.slots[body.slot],s.stats,magic,build);if(!power||!magic.unlocked.includes(power.id)||!bondedEssences(magic.picks).includes(power.gem)||!['q','e'].includes(body.slot)||now<(magic.cooldowns[power.id]??0))throw invalid('Choose an equipped ability that is ready.');
  const mana=manaAvailable(s.vitals,now);if(mana<build.mana)throw invalid('Wait for '+build.mana+' mana before casting.');
  const ally=Object.values(r.members).find(a=>a.id===body.ally&&a.hp>0&&!a.left)??m;
  if(power.form==='sword'){const shatter=!target&&build.id==='spellweaver'&&r.chilledUntil>now;damage=Math.max(1,Math.round(power.value*(shatter?1.15:1))-armour);if(shatter){r.chilledUntil=0;text='Shatter! ';}
   const splash=bladeSplash(power);let count=0;if(splash)for(const add of r.adds??[]){if(add.hp<=0||add.id===target?.id||Math.hypot(add.x-position.x,add.y-position.y)>splash.radius)continue;const hit=Math.min(add.hp,splash.damage);add.hp-=hit;m.damage+=hit;m.threat+=hit;count++;}if(count)text+='Splash hit '+count+' nearby reinforcements. ';
  }
  else if(power.form==='shield'){ally.ward=power.value;ally.wardUntil=now+5000;m.support++;text='Ward raised for '+ally.name+'. ';}
  else if(power.form==='renewal'){if(ally.hp>=playerMaxHealth(ally,now))throw invalid('Choose an injured ally to heal.');ally.hp=Math.min(playerMaxHealth(ally,now),ally.hp+power.value);m.support++;text='Healed '+ally.name+'. ';}
  else if(power.form==='focus'){r.landsAt+=Math.min(1000,power.value);m.support++;text='Guardian delayed. ';}
  else{m.nextDodgeAt=now;m.dodgeUntil=now+350;text='Dodge readied. ';}
  if(power.gem==='storm'&&r.phase===3&&r.move==='bossFan'&&now>=r.warningAt){plan(r,now,1800);m.support++;text+='Storm interrupted the volley! ';}
  if(!target&&power.gem==='fire')r.burn={source:id,damage:power.rank+2,nextAt:now+1000,until:now+4000};
  if(!target&&power.gem==='ice'){if(now>=(r.chilledUntil??0))r.landsAt+=600;r.chilledUntil=now+4000;}
  if(!target&&power.gem==='shadow')r.weakenedUntil=now+5000;
  s.magic={...magic,cooldowns:{...magic.cooldowns,[power.id]:now+power.cooldown}};s.vitals={...normalizeVitals(s.vitals),mana:mana-build.mana,manaAt:now};m.used=[...new Set([...m.used,power.gem])];m.castAt=now;
 }
 if(kind==='taunt'){if(now<(m.tauntReadyAt??0))throw invalid('Wait for Taunt to recover.');r.taunt=id;r.tauntUntil=now+6000;m.tauntReadyAt=now+8000;m.support++;text='Taunted! The next attack will focus you; the current warning stays locked.';}
 if(kind==='dodge'){if(now<m.nextDodgeAt)throw invalid('Wait for Dodge to recover.');m.dodgeUntil=now+350;m.nextDodgeAt=now+1300;text='Dodge started. Time it just before impact.';}
 if(damage){const hit=Math.min(damage,target?target.hp:r.hp);if(target)target.hp-=hit;else r.hp-=hit;if(m.weapon==='vampiricSword'&&(target?target.hp:r.hp)===0)m.hp=Math.min(playerMaxHealth(m,now),m.hp+4);m.damage+=hit;m.threat+=hit;text+='Hit '+(target?.name??'Guardian')+' for '+hit+'.';phaseChange(r,now);}
 m.lastFeedback=text;if(kind!=='dodge')spendActionPoint(s,now);syncPlayer(s,r,id,now);return {text,hit:damage};
}
export async function readVaultParty(db,id,playerId,now=Date.now()){
 if(!/^[A-F0-9]{8}$/.test(id??''))throw invalid('Enter the eight-character party code.');const row=await db.prepare('SELECT * FROM tower_vault_parties WHERE party_id=?').bind(id).first();if(!row)throw invalid('This Vault party could not be found.');
 const r=JSON.parse(row.state_json);return {row,raid:r,public:publicVaultParty(r,playerId,now)};
}
export async function writeVaultParty(db,row,body,now=Date.now(),random=Math.random){
 const create=body.kind==='create',original=JSON.parse(row.state_json);let party=body.id??original.vaultCoop?.id;
 if(create){eligible(original);if(original.vaultCoop)throw invalid('Leave your current party first.');await db.prepare("DELETE FROM tower_vault_parties WHERE expires_at<? AND json_extract(state_json,'$.closed')=1").bind(now-7*86400000).run();party=uid();const r={id:party,leader:row.player_id,status:'waiting',vaultMechanism:original.depthsRun.vaultMechanism,expiresAt:now+vaultCoopRules.lifetime,hp:420,max:420,members:{},adds:[]};await db.prepare('INSERT INTO tower_vault_parties(party_id,state_json,expires_at) VALUES(?,?,?)').bind(party,JSON.stringify(r),r.expiresAt).run();}
 const operation=JSON.stringify([row.player_id,body.operation]);
 for(let retry=0;retry<5;retry++){
  const {row:record,raid}=await readVaultParty(db,party,row.player_id,now),s=JSON.parse(row.state_json);if(now>=raid.expiresAt&&body.kind!=='leave'&&!(body.kind==='claim'&&raid.status==='victory'))throw invalid('This party has expired. Leave it and start a new expedition.');
  if(s.vaultCoop&&s.vaultCoop.id!==party)throw invalid('Leave your current party first.');
  const receipt=actVaultParty(raid,s,row.player_id,{...body,kind:create?'join':body.kind},now,random);
  if(raid.members[row.player_id])raid.members[row.player_id].peerId??=(await tokenHash('public:'+row.player_id)).slice(0,24);raid.closed=Object.values(raid.members).every(m=>m.left||m.claimed||m.defeatLogged);
  const result=await db.batch([
   db.prepare('UPDATE tower_vault_parties SET state_json=?,version=version+1,last_operation=? WHERE party_id=? AND version=? AND EXISTS(SELECT 1 FROM tower_players WHERE player_id=? AND revision=?)').bind(JSON.stringify(raid),operation,party,record.version,row.player_id,row.revision),
   db.prepare('UPDATE tower_players SET state_json=?,revision=revision+1,last_request=?,updated_at=? WHERE player_id=? AND revision=? AND EXISTS(SELECT 1 FROM tower_vault_parties WHERE party_id=? AND last_operation=?) RETURNING *').bind(JSON.stringify(s),body.operation,now,row.player_id,row.revision,party,operation)
  ]);const updated=result[1].results?.[0];if(updated)return {updated,raid:publicVaultParty(raid,row.player_id,now),receipt};
  const current=await db.prepare('SELECT revision FROM tower_players WHERE player_id=?').bind(row.player_id).first();if(current?.revision!==row.revision)return null;
 }
 throw Object.assign(new Error('The Vault party is busy. Try again.'),{status:409});
}
