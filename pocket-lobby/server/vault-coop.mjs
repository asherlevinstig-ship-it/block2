import {recordDragonSighting} from '../public/mounts.js';
import {ashenStagRules,ashenStagSighting,ashenStagRoom,ashenChargePath,ashstepCloakId} from '../public/ashen-stag.js';
import {wornRareItem} from '../public/rare-loot.js';
import {projectileCover} from '../public/dungeon-arena.js';
import {combatAbilityBlock,normalizeStyleAbilities,sanctuaryRules,styleAbilities} from '../public/style-abilities.js';
import {abilityMastery} from '../public/ability-mastery.js';
import {awardAbilityUse} from './ability-mastery.mjs';
import {recordDungeonChest} from '../public/dungeon-chests.js';
import {recordEquipmentEffect} from '../public/equipment-effects.js';
import {rareBootsPenalty,awardRareHunt} from '../public/rare-loot.js';
import {playerMaxHealth,mealArmour} from '../public/food-buffs.js';
import {validVaultMechanism,vaultMechanisms} from '../public/vault-mechanisms.js';
import {dungeonFloor} from '../public/dungeon-arena.js';
import {vaultCoopRules,vaultTeamCounter,coopPhase,coopMove,coopDanger,coopEncounter,vaultPhaseDetails,vaultDefeatTip} from '../public/vault-coop.js';
import {physicalPlating} from '../public/enemy-roles.js';
import {arenaMarkCount} from '../public/dungeon-arena.js';
import {shadowstepTiles} from '../public/shadowstep-tiles.js';
import {combatBuild} from '../public/combat-builds.js';
import {huntingAttributes,weaponStagger,weaponProfile,armourSelection,armourProfile,playerMeleeReach,warAxeReinforcement,warAxeSweepDamage,bowDrawTime,isRangedWeapon,weaponManaCost,runeStaffRules,markedAbilityDamage,longbowSnare,canRaiseShield,raiseIronShield,ironShieldImpact,counterMultiplier,counterRules,boarRules,normalizeCombatSummary} from '../public/hunting.js';
import {depthsSpoils} from '../public/depths.js';
import {essencePower,normalizeMagic,awardEssenceMastery,bondedEssences,bladeSplash} from '../public/essences.js';
import {manaAvailable,normalizeVitals,spendMana} from '../public/player-vitals.js';
import {requireActionPoint,spendActionPoint} from './action-points.mjs';
import {awardDungeonWeapon} from '../public/dungeon-loot.js';
import {awardLeadership} from '../public/leadership.js';
import {tokenHash} from './identity.mjs';
import {MAX_SKILL_XP} from '../public/skill-curve.js';
const invalid=message=>Object.assign(new Error(message),{status:400});
const living=r=>Object.entries(r.members).filter(([,m])=>m.hp>0&&!m.left);
function enemyReaction(r,hit,at){
 r.enemyReactionId=(r.enemyReactionId??0)+1;
 r.enemyReaction={id:r.enemyReactionId,at,...hit};
}
const uid=()=>crypto.randomUUID().slice(0,8).toUpperCase();
function eligible(s,raid,now){
 const ash=raid?.hunt==='ashenStag';
 const available=ash?raid.room===s.location&&!s.depthsRun&&s.hunting?.ashenSighting!==raid.sighting&&now<raid.sightingUntil:s.location==='depthsVault'&&s.depthsRun?.cleared===2;
 if(!available||s.hunting?.encounter||s.hunting?.recoveryUntil||s.plan||s.report||s.controlMode==='auto'||s.health<=0)throw invalid(ash?'Find the current Ashen Stag sighting in Play mode. One reward per sighting.':'Travel to the Sunken Vault in Play mode, before starting the solo fight.');
}
const nextStrikeAt=(r,m,interval=m.attackInterval)=>Math.max(m.lastStrike+interval,bowDrawTime(m.weapon)?(r.startedAt??0)+bowDrawTime(m.weapon):0);
function member(s,now){const build=combatBuild(s);return {id:uid(),name:s.avatar.name,hp:s.health,pos:{...s.position},lastAt:now,mealBuff:s.vitals?.mealBuff,damage:0,support:0,threat:0,lastStrike:0,dodgeUntil:0,counterUntil:0,nextDodgeAt:0,ward:0,used:[],build,armour:huntingAttributes(s.stats).armor+(armourProfile(armourSelection(s.combatGear))?.absorption??0)+build.armor-rareBootsPenalty(s),weapon:s.combatGear.equippedWeapon,ashstep:wornRareItem(s,ashstepCloakId),guardCapable:canRaiseShield(armourSelection(s.combatGear),s.combatGear.equippedWeapon),attackInterval:huntingAttributes(s.stats,s.combatGear.equippedWeapon,s.combatGear.activeSwordUpgrade,false,s.combatGear.weaponEnchantments,build).attackInterval};}
function plan(r,at,pause=0){
 const ash=r.hunt==='ashenStag',phase=ash?1:coopPhase(r),detail=vaultPhaseDetails[phase-1],players=living(r);if(!players.length){r.status='defeat';return;}
 const forced=players.find(([id])=>id===r.taunt&&at<r.tauntUntil),target=forced??players.sort((a,b)=>b[1].threat-a[1].threat)[0];
 r.target=target[0];r.targetTile={...target[1].pos};r.origin??={x:6,y:5};r.move=ash?((r.attacks??0)%2===0||Math.hypot(r.targetTile.x-r.origin.x,r.targetTile.y-r.origin.y)>2.4?'ashCharge':'ashSweep'):detail.moves[(r.attacks??0)%detail.moves.length];
 if(ash){r.ashAimLocked=false;r.charge=null;}
 const move=coopMove(r);r.warningAt=at+pause+600+(at<(r.snaredUntil??0)?longbowSnare.delay:0);r.landsAt=r.warningAt+move.tell;r.phase=phase;r.castHits=0;
 if(move.shape==='marks')r.marks=players.map(([,m])=>({...m.pos}));
 else delete r.marks;
}
function dodgeCoversImpact(member,at){
 return member.dodgeUntil>=at&&member.dodgeUntil-at<=boarRules.dodgeWindow;
}
const guardStamina=(m,at)=>Math.min(100,(m.stamina??100)+Math.max(0,at-(m.staminaAt??at))*.012);
function hurt(r,m,amount,move,at,origin){
 const name=move.name;
 m.hp=Math.min(m.hp,playerMaxHealth(m,at));if(m.hp<=0||m.left)return;
 const perfectDodge=dodgeCoversImpact(m,at);
 let damage=amount;if(perfectDodge){damage=0;m.counterUntil=at+counterRules.duration+(m.build.counterWindow??0);if(m.ashstep)m.ashstepUntil=at+ashenStagRules.ashstepMs;m.lastFeedback=m.ashstep?'Perfect dodge · Ashstep active':'Perfect dodge · Counter ready';}
 let shielded=0;
 let guard=null;
 if(damage&&at<(m.guardUntil??0)){
  m.stamina=guardStamina(m,at);m.staminaAt=at;
  guard=ironShieldImpact(m,damage,m.pos,origin,move,at);
  if(guard){
   damage-=guard.blocked;shielded+=guard.blocked;m.support++;
   if(guard.perfect){
    m.counterUntil=at+counterRules.duration+(m.build.counterWindow??0);m.threat+=guard.blocked*3;
    if(r.phase===1&&move.id===vaultTeamCounter.move&&r.teamOpening?.at!==at&&living(r).some(([,ally])=>ally!==m&&bowDrawTime(ally.weapon))){
     r.teamOpening={at,until:at+vaultTeamCounter.duration,openedBy:m.id};
    }
   }
  }
 }
 if(damage&&m.ward>0&&at<=(m.wardUntil??0)){const block=Math.min(damage,m.ward);damage-=block;m.ward-=block;shielded+=block;}
 const sanctuary=r.sanctuary;
 if(damage&&sanctuary?.until>at&&sanctuary.remaining>0&&Math.hypot(m.pos.x-sanctuary.x,m.pos.y-sanctuary.y)<=sanctuaryRules.radius){
  const blocked=Math.min(damage,sanctuary.remaining);
  damage-=blocked;
  sanctuary.remaining-=blocked;
  shielded+=blocked;
  m.lastFeedback='Sanctuary absorbed '+blocked+' damage.';
 }
 if(guard)m.lastFeedback=guard.broken?'Guard broken!':guard.perfect?'Perfect block · Counter ready':'Iron Shield blocked '+guard.blocked+' damage.';
 else if(damage)m.lastFeedback=name+' hit you for '+damage+' HP.';
 m.shielded=(m.shielded??0)+shielded;
 m.reactionId=(m.reactionId??0)+1;
 m.hp=Math.max(0,m.hp-damage);m.lastHit={id:m.reactionId,at,damage,shielded,perfectDodge,heavy:damage>=20,move:name,guardBlocked:guard?.blocked,guardBroken:guard?.broken,perfectBlock:guard?.perfect};if(!m.hp){m.cause=name;m.tip=vaultDefeatTip(name);m.lastFeedback='Defeated by '+name;}
}
export function advanceVaultParty(r,now){
 if(r.status!=='battle')return;
 const end=Math.min(now,r.expiresAt);
 for(let guard=0;guard<400&&r.status==='battle';guard++){
  const aimAt=r.hunt==='ashenStag'&&!r.ashAimLocked?r.warningAt:Infinity;
  const due=Math.min(aimAt,r.landsAt,r.burn?.nextAt??Infinity,...(r.adds??[]).filter(a=>a.hp>0).map(a=>a.landsAt));if(due>end)break;
  if(due===aimAt){
   const players=living(r),target=(r.tauntUntil>due&&players.find(([id])=>id===r.taunt))||players.sort((a,b)=>b[1].threat-a[1].threat)[0];
   if(!target){r.status='defeat';break;}
   r.target=target[0];r.targetTile={...target[1].pos};r.ashAimLocked=true;
   if(r.move==='ashCharge')r.charge=ashenChargePath(r.room,r.origin,r.targetTile);
   continue;
  }
  if(due===r.burn?.nextAt){const burn=r.burn,damage=Math.min(r.hp,burn.damage);r.hp-=damage;const source=r.members[burn.source];if(source){source.damage+=damage;source.threat+=damage;}if(burn.nextAt+1000<=burn.until)burn.nextAt+=1000;else delete r.burn;phaseChange(r,due);continue;}
  if(due===r.landsAt){
   const move=coopMove(r),encounter=coopEncounter(r),focused=r.members[r.target];
   if(r.phase===1&&move.opensShell&&focused&&(!coopDanger(r,focused.pos)||dodgeCoversImpact(focused,due))){
    r.exposedUntil=due+move.recovery+450;
   }
   for(const [,m] of living(r))if(coopDanger(r,m.pos)){
    const overlap=move.shape==='marks'?Math.max(0,arenaMarkCount(encounter,move,m.pos)-1)*8:0;
    hurt(r,m,Math.max(5,Math.round((30+move.damage+overlap-m.armour-mealArmour(m,due))*(due<(r.weakenedUntil??0)?.75:1))),move,due,r.origin);
   }
   r.lastAttack={at:due,move:move.name,shape:move.shape,center:move.center,origin:{...r.origin},target:{...r.targetTile},...(r.marks?{marks:r.marks}: {})};r.weakenedUntil=0;
   const charge=r.hunt==='ashenStag'&&move.id==='ashCharge'?r.charge:null;
   if(charge){r.origin={...charge.end};r.lastAttack.destination=r.origin;if(charge.crash){r.exposedUntil=due+ashenStagRules.crashMs;r.lastAttack.crash=charge.crash;}}
   r.attacks=(r.attacks??0)+1;plan(r,due,charge?.crash?ashenStagRules.crashMs:move.recovery);
  }else{
   for(const add of r.adds??[]){if(add.hp<=0||add.landsAt!==due)continue;for(const [,m] of living(r))if(Math.hypot(m.pos.x-add.target.x,m.pos.y-add.target.y)<=1.1)hurt(r,m,Math.max(4,add.kind==='wisp'?14-m.armour-mealArmour(m,due):10-m.armour-mealArmour(m,due)),{name:add.kind==='wisp'?'Wisp Bolt':'Hatchling Bite',shape:add.kind==='wisp'?'bolt':'arc',damage:0},due,add);
    const target=living(r).sort((a,b)=>a[1].hp-b[1].hp)[0];if(target)add.target={...target[1].pos};add.landsAt=due+3800+(due<(add.snaredUntil??0)?longbowSnare.delay:0);
   }
  }
  if(!living(r).length)r.status='defeat';
 }
 for(const m of Object.values(r.members))m.hp=Math.min(m.hp,playerMaxHealth(m,now));
 if(r.status==='battle'&&now>=r.expiresAt)r.status='expired';
}
function phaseChange(r,now){
 if(r.hp<=0){r.hp=0;r.status='victory';r.victoryAt=now;r.adds=[];return;}
 if(r.hunt==='ashenStag')return;
 const phase=coopPhase(r);if(phase===r.phase)return;delete r.lastAttack;
 r.attacks=0;r.exposedUntil=0;r.stagger=0;
 if(now>=r.warningAt&&now<r.landsAt){r.phase=phase;r.attacks=-1;}
 else plan(r,now);
 const kind=phase===2?'skitter':'wisp',count=phase===3&&Object.keys(r.members).length>1?2:1;
 for(let i=0;i<count;i++)r.adds.push({id:'phase'+phase+'-'+i,kind,name:kind==='wisp'?'Rune Wisp':'Mire Hatchling',hp:kind==='wisp'?40:45,max:kind==='wisp'?40:45,x:i?8:4,y:i?4:7,target:{...r.targetTile},landsAt:now+4200});
}
function syncPlayer(s,r,id,now){const m=r.members[id];if(!m)return;if(m.hp<=0){
 if(!m.defeatLogged&&r.hunt==='ashenStag')m.defeatLogged=true;
 if(!m.defeatLogged){m.defeatLogged=true;s.combatReports=[...(s.combatReports??[]),{id:'coop:'+r.id+':'+m.id,enemy:'depthsGuardian',room:'depthsVault',outcome:'defeat',endedAt:now,endedHealth:0,summary:normalizeCombatSummary({startedAt:r.startedAt??now,partial:true}),rewards:{},lostSpoils:depthsSpoils(s.depthsRun),defeat:{attack:m.cause??'Vault Guardian',damage:m.lastHit?.damage??0,tip:m.tip??vaultDefeatTip(m.cause)}}].slice(-10);}
 s.health=0;s.location='home';s.position={x:5,y:7};s.depthsRun=null;s.hunting.recoveryUntil=now+boarRules.recovery;delete s.vaultCoop;
 }else s.health=Math.min(m.hp,playerMaxHealth(s,now));}
export function publicVaultParty(r,id,now=Date.now()){
 const self=r.members[id];return {id:r.id,status:r.status,hunt:r.hunt,room:r.room,charge:r.charge,vaultMechanism:r.vaultMechanism,expiresAt:r.expiresAt,hp:r.hp,max:r.max,phase:r.phase??1,move:r.move,warningAt:r.warningAt,landsAt:r.landsAt,origin:r.origin,targetTile:r.targetTile,marks:r.marks,exposedUntil:r.exposedUntil,stagger:r.stagger??0,lastAttack:r.lastAttack,teamOpening:r.status==='battle'&&r.teamOpening?.until>now&&!r.teamOpening.used?r.teamOpening:null,lastExposedHit:r.lastExposedHit&&now-r.lastExposedHit.at<1100?r.lastExposedHit:null,faultbreaker:r.phase===1&&r.faultbreaker?.until>now&&r.faultbreaker.hits>0?r.faultbreaker:null,sanctuary:r.sanctuary?.until>now&&r.sanctuary.remaining>0?r.sanctuary:null,observedAt:now,enemyReaction:r.enemyReaction&&now>=r.enemyReaction.at&&now-r.enemyReaction.at<1000?r.enemyReaction:null,
  targetName:r.members[r.target]?.name??'',leader:r.leader===id,members:Object.values(r.members).filter(m=>!m.left).map(m=>({id:m.id,peerId:m.peerId,name:m.name,hp:m.hp,maxHealth:playerMaxHealth(m,now),lastHit:m.lastHit&&now>=m.lastHit.at&&now-m.lastHit.at<900?m.lastHit:null,shielded:m.shielded??0,damage:m.damage,support:m.support,position:m.pos,...(m.perk?{perk:m.perk}:{}),guardUntil:m.guardUntil??0,guardCapable:m.guardCapable===true,runeBurstAt:m.runeBurstAt??0,strikeAt:m.lastStrike,arrow:m.arrow??null,lastCounter:m.lastCounter&&now-m.lastCounter.at<1100?m.lastCounter:null,castAt:m.castAt??0,castKind:m.castKind??null,attackTarget:m.attackTarget??null,attackPosition:m.attackPosition??null,blink:m.blink&&now>=m.blink.at&&now-m.blink.at<700?m.blink:null})),self:self?{id:self.id,hp:self.hp,counterUntil:self.counterUntil,ashstepUntil:self.ashstepUntil??0,nextDodgeAt:self.nextDodgeAt,guardUntil:self.guardUntil??0,nextGuardAt:self.nextGuardAt??0,guardStamina:guardStamina(self,now),nextStrikeAt:nextStrikeAt(r,self),runeMarks:self.runeMarks??{},runeBurstAt:self.runeBurstAt??0,damage:self.damage,support:self.support,claimed:!!self.claimed,left:!!self.left,feedback:self.lastFeedback??'',cause:self.cause,tip:self.tip}:null,adds:(r.adds??[]).filter(a=>a.hp>0)};
}
export function actVaultParty(r,s,id,body,now,random=Math.random){
 s.routineLastSeen=now;
 const kind=body.kind,ash=r.hunt==='ashenStag';
 if(kind==='join'){
  eligible(s,r,now);if(r.status!=='waiting'||Object.values(r.members).filter(m=>!m.left).length>=vaultCoopRules.limit)throw invalid('This party has started or is full.');
  if(s.vaultCoop&&s.vaultCoop.id!==r.id)throw invalid('Leave your current party first.');
  if(r.members[id]?.left)throw invalid('You have already left this expedition party.');
  if(!ash&&s.position?.x===11&&!dungeonFloor('depthsVault',s.position.x,s.position.y,r.vaultMechanism))throw invalid('Travel off the spillway lane before joining this party.');
  r.members[id]??=member(s,now);s.vaultCoop={id:r.id,...(ash?{hunt:r.hunt}:{})};return {text:ash?'Joined the Ashen Stag hunt.':'Joined co-op Vault party.'};
 }
 const m=r.members[id];if(!m||m.left||s.vaultCoop?.id!==r.id)throw invalid('Join this Vault party first.');
 if(!ash&&s.position?.x===11&&!dungeonFloor('depthsVault',s.position.x,s.position.y,r.vaultMechanism))throw invalid('Choose a walkable tile in the shared Vault.');
 // A movement arriving after the impact cannot erase damage from that impact.
 const nextImpact=Math.min(r.landsAt,...(r.adds??[]).filter(add=>add.hp>0).map(add=>add.landsAt));
 if(r.status!=='battle'||now<nextImpact)m.pos={...s.position};
 advanceVaultParty(r,now);m.pos={...s.position};m.lastAt=now;syncPlayer(s,r,id,now);
 if(!s.vaultCoop)return {text:'Defeated by '+m.cause+'. '+m.tip};
 if(kind==='leave'){
  m.left=true;delete s.vaultCoop;if(!ash){s.location='depthsGallery';s.position={x:4,y:5};}if(r.leader===id){const next=living(r)[0];if(next)r.leader=next[0];}if(!living(r).length)r.status='abandoned';return {text:ash?'Left the Ashen Stag hunt.':'Left the co-op fight. Your expedition haul remains at risk.'};
 }
 if(kind==='claim'&&ash){
  if(r.status!=='victory'||m.claimed||!(m.damage>0||m.support>=1)||s.hunting.ashenSighting===r.sighting)throw invalid('Contribute to the hunt to claim this sighting’s reward once.');
  m.claimed=true;s.hunting.ashenSighting=r.sighting;delete s.vaultCoop;
  s.credits+=ashenStagRules.gold;s.goldEarned=(s.goldEarned??0)+ashenStagRules.gold;
  const cloak=!s.wardrobe.owned.includes(ashstepCloakId);if(cloak)s.wardrobe.owned.push(ashstepCloakId);
  const dragon=recordDragonSighting(s);
  return {text:'Ashen Stag defeated · +'+ashenStagRules.gold+' gold'+(cloak?' · Ashstep Cloak added to Inventory':'')+(dragon?' · Cinderwing unlocked!':''),cloak,dragon,dragonSightings:s.mounts.sightings,gold:ashenStagRules.gold};
 }
 if(kind==='claim'){
  if(r.status!=='victory'||m.claimed||!(m.damage>0||m.support>=1)||s.depthsRun?.cleared!==2)throw invalid('Help defeat the Guardian to claim one Vault reward.');
  const heldBefore=depthsSpoils(s.depthsRun);
  m.claimed=true;s.depthsRun.cleared=3;s.depthsRun.shardEarned=true;
  if(r.vaultMechanism)s.depthsRun.vaultMechanism=r.vaultMechanism;
  delete s.vaultCoop;
  for(const [key,xp] of Object.entries({strengthXp:75,agilityXp:55,vitalityXp:75}))s.stats[key]=Math.min(MAX_SKILL_XP,s.stats[key]+xp);
  awardLeadership(s,'vaultClear');awardEssenceMastery(s.magic,m.used,50);const rare=awardRareHunt(s,'depthsGuardian',random,now);if(s.equipmentEffects?.at(-1)?.perk==='luck'&&s.equipmentEffects.at(-1).at===now)m.perk=s.equipmentEffects.at(-1);const drop=awardDungeonWeapon(s,now,random);if(drop)s.depthsRun.vaultWeapon=drop.weapon;const held=depthsSpoils(s.depthsRun);recordDungeonChest(s,{id:'coop:'+r.id+':'+id,enemy:'depthsGuardian',room:'depthsVault',outcome:'victory',endedAt:now,rewards:{held:{gold:held.gold-heldBefore.gold,loot:Object.fromEntries(Object.entries(held.loot).map(([key,n])=>[key,n-(heldBefore.loot[key]??0)]).filter(([,n])=>n>0))},...(rare?{rareEquipment:rare.id}:{}),...(drop?{weapon:drop.weapon}:{})}});return {text:'Vault cleared! Review your haul and bank it to leave safely.'};
 }
 if(kind==='mechanism'){
  if(ash||r.leader!==id||r.status!=='waiting'||r.vaultMechanism||s.depthsRun.vaultMechanism)throw invalid('Only the waiting party leader can choose one Vault mechanism.');
  if(!validVaultMechanism(body.mechanism))throw invalid('Choose the spillway or stone screen.');
  r.vaultMechanism=body.mechanism;s.depthsRun.vaultMechanism=body.mechanism;
  return {text:vaultMechanisms[body.mechanism].detail};
 }
 if(kind==='start'){
  if(r.leader!==id||r.status!=='waiting')throw invalid('Only the party leader can start this waiting fight.');
  if(ash){eligible(s,r,now);r.expiresAt=now+5*60000;}
  const count=Object.values(r.members).filter(m=>!m.left).length;r.max=Math.round((ash?ashenStagRules.health:vaultCoopRules.health)*(1+(count-1)*vaultCoopRules.scale));r.hp=r.max;r.status='battle';r.startedAt=now;r.phase=1;r.adds=[];r.stagger=0;plan(r,now,1500);return {text:ash?'Bait the charge toward a ruin and move sideways. Strike when the stag crashes.':'The Guardian awakens. Taunt draws its next attack; allies clear adds and interrupt.'};
 }
 if(kind==='tick')return {text:m.lastFeedback??'Watch the marked attack.'};
 if(r.status!=='battle'||m.hp<=0)throw invalid('This co-op battle is not active.');
 if(!['strike','power','dodge','guard','runeBurst','taunt','sanctuary','faultbreaker','shadowstep'].includes(kind))throw invalid('Choose a co-op combat action.');
 if(kind==='guard'){
  if(!canRaiseShield(armourSelection(s.combatGear),m.weapon))throw invalid('Equip the Iron Shield and a sword to guard.');
  m.stamina=guardStamina(m,now);m.staminaAt=now;
  const target=r.adds?.find(a=>a.id===body.target&&a.hp>0)??r.origin;
  if(!raiseIronShield(m,m.pos,target,now))throw invalid('Let your guard and stamina recover.');
  m.guardCapable=true;
  m.lastFeedback='Shield raised.';return {text:m.lastFeedback};
 }
 if(kind==='shadowstep'){
  const abilities=normalizeStyleAbilities(s.styleAbilities);
  if(!abilities.learned.includes(kind))throw invalid('Learn Shadowstep before using it.');
  if((abilities.readyAt[kind]??0)>now)throw invalid('Shadowstep is still recharging.');
  const encounter={...coopEncounter(r),arenaPlayer:m.pos,adds:r.adds.filter(add=>add.hp>0)};
  const tile=shadowstepTiles({...s,hunting:{encounter}}).find(p=>p.x===body.tile?.x&&p.y===body.tile?.y);
  if(!tile)throw invalid('Choose a reachable floor tile up to four steps away.');
  requireActionPoint(s);
  abilities.blink={at:now,room:s.location,from:{...m.pos},to:{x:tile.x,y:tile.y}};
  m.blink=abilities.blink;
  s.position=m.pos={x:tile.x,y:tile.y};
  abilities.readyAt[kind]=now+abilityMastery(s,kind).cooldown;
  abilities.lastBlinkAt=now;
  s.styleAbilities=abilities;
  awardAbilityUse(s,kind,body.operation);
  spendActionPoint(s,now);
  return {text:'Shadowstep · 1 AP'};
 }
 if(kind==='faultbreaker'){
  if(ash)throw invalid('The Ashen Stag has no armour to fracture. Bait its charge into a ruin.');
  const abilities=normalizeStyleAbilities(s.styleAbilities);
  if(!abilities.learned.includes('faultbreaker'))throw invalid('Learn Faultbreaker before using it.');
  if((abilities.readyAt.faultbreaker??0)>now)throw invalid('Faultbreaker is still recharging.');
  const block=combatAbilityBlock(kind,s,now,r);
  if(block)throw invalid(block);
  requireActionPoint(s);
  const hits=2+abilityMastery(s,'faultbreaker').stage;
  r.faultbreaker={until:now+8000,hits};
  enemyReaction(r,{broken:true},now);
  s.styleAbilities=abilities;
  abilities.readyAt.faultbreaker=now+styleAbilities.faultbreaker.cooldown;
  awardAbilityUse(s,'faultbreaker',body.operation);
  m.support++;
  m.castAt=now;m.castKind=kind;
  m.attackTarget={...r.origin};m.attackPosition={...m.pos};
  m.lastFeedback='Armour fractured · '+hits+' empowered party hits.';
  spendActionPoint(s,now);
  syncPlayer(s,r,id,now);
  return {text:m.lastFeedback};
 }
 if(kind==='sanctuary'){
  const abilities=normalizeStyleAbilities(s.styleAbilities);
  if(!abilities.learned.includes('sanctuary'))throw invalid('Learn Sanctuary before placing a ward.');
  if((abilities.readyAt.sanctuary??0)>now)throw invalid('Sanctuary is still recharging.');
  const block=combatAbilityBlock(kind,s,now,r);
  if(block)throw invalid(block);
  requireActionPoint(s);
  const remaining=sanctuaryRules.capacity+(abilityMastery(s,'sanctuary').stage-1)*10;
  r.sanctuary={x:m.pos.x,y:m.pos.y,until:now+sanctuaryRules.duration,remaining};
  s.styleAbilities=abilities;
  abilities.readyAt.sanctuary=now+styleAbilities.sanctuary.cooldown;
  awardAbilityUse(s,'sanctuary',body.operation);
  m.support++;
  m.castAt=now;m.castKind=kind;
  m.attackTarget=null;m.attackPosition=null;
  m.lastFeedback='Sanctuary placed · '+remaining+' shared protection.';
  spendActionPoint(s,now);
  syncPlayer(s,r,id,now);
  return {text:m.lastFeedback};
 }
 if(kind!=='dodge')requireActionPoint(s);
 const build=m.build,weapon=weaponProfile(m.weapon,s.combatGear.activeSwordUpgrade,s.combatGear.weaponEnchantments),stats=huntingAttributes(s.stats,m.weapon,s.combatGear.activeSwordUpgrade,false,s.combatGear.weaponEnchantments,build);
 const target=r.adds?.find(a=>a.id===body.target&&a.hp>0),position=target??r.origin,armour=target||ash?0:r.phase===1&&now>=(r.exposedUntil??0)?9:0;
 let damage=0,text='',guarded=false,broken=false,interrupted=false,counter=false,exposedShot=false;
 if(kind==='strike'){
  if(!weapon)throw invalid('You joined without a weapon. Use abilities, or retreat and equip one.');
  if(now<nextStrikeAt(r,m,stats.attackInterval))throw invalid('Wait for your weapon to recover.');
  if(Math.hypot(m.pos.x-position.x,m.pos.y-position.y)>playerMeleeReach(m.weapon)){
   if(m.weapon!=='warAxe')throw invalid('Move closer to your target.');
   m.lastStrike=now;m.attackTarget=null;m.attackPosition=null;
   m.lastFeedback='War Axe missed · Recover before swinging again.';
   syncPlayer(s,r,id,now);return {text:m.lastFeedback,hit:0};
  }
  const cover=isRangedWeapon(m.weapon)?projectileCover(coopEncounter(r),m.pos,position):null;
  const cost=weaponManaCost(m.weapon);
  if(cost&&!spendMana(s,now,cost))throw invalid('Runewood Staff needs '+cost+' mana.');
  if(isRangedWeapon(m.weapon))m.arrow={from:{...m.pos},to:{x:(cover??position).x,y:(cover??position).y},blocked:!!cover,...(m.weapon==='cinderthornLongbow'?{longbow:true}:cost?{staff:true}:{})};
  if(cover){
   m.lastStrike=now;m.attackTarget={...cover};m.attackPosition={...m.pos};
   m.lastFeedback='Cover blocked your arrow. Move for a clear shot.';
   spendActionPoint(s,now);syncPlayer(s,r,id,now);return {text:m.lastFeedback,hit:0};
  }
  const fractured=!ash&&!target&&r.phase===1&&r.faultbreaker?.until>now&&r.faultbreaker.hits>0;
  const plating=!ash&&!fractured&&!target&&r.phase===1?physicalPlating({...coopEncounter(r),arenaPlayer:m.pos,counterUntil:m.counterUntil,arenaLockedFor:now>=r.warningAt?r.landsAt:0,brainRecoveryUntil:r.lastAttack?r.warningAt-600:0},stats.damage,9,0,now):null;
  guarded=plating?.shellGuarded===true;
  damage=plating?.damage??Math.max(1,stats.damage-(fractured?0:armour));
  if(plating?.flanked)text='Flank hit! ';
  if(now<m.counterUntil){
   const bonus=Math.ceil(damage*counterMultiplier(m.weapon,s.combatGear.activeSwordUpgrade,build,true));
   damage+=bonus;
   m.counterUntil=0;
   counter=true;
   text+='Counter! ';
  }
  if(now<(r.exposedUntil??0))damage=Math.ceil(damage*(1+(ash?ashenStagRules.exposedBonus:.25)));
  const opening=r.teamOpening;
  if(!target&&(!body.target||body.target==='boss')&&bowDrawTime(m.weapon)&&opening&&!opening.used&&now<opening.until&&m.id!==opening.openedBy){
   damage+=Math.ceil(damage*vaultTeamCounter.bonus);
   opening.used=true;
   m.arrow.exposed=true;
   exposedShot=true;
   text+='Exposed hit! ';
  }
  const raised=s.styleAbilities?.raised;
  if(s.styleAbilities?.learned?.includes(raised?.living?'bindBeast':'raiseFallen')&&raised?.summonedAt<=now&&raised.until>now&&raised.nextAt<=now){
   damage+=raised.damage;
   raised.nextAt=now+3000;
   raised.lastStrikeAt=now;
   awardAbilityUse(s,raised.living?'bindBeast':'raiseFallen',raised.id);
   text+=raised.living?'Bound beast joined the strike. ':'Undead ally joined the strike. ';
  }
  if(fractured){
   damage=Math.ceil(damage*1.2);
   r.faultbreaker.hits--;
   text+='Faultbreaker opening! ';
  }
  m.lastStrike=now;
  if(cost&&damage>0&&damage<(target?.hp??r.hp)){
   m.runeMarks=Object.fromEntries(Object.entries(m.runeMarks??{}).filter(([,until])=>until>now));
   m.runeMarks[target?.id??'boss']=now+runeStaffRules.markMs;
   text+='Rune marked. ';
  }
  const foe=target??r;
  if(m.weapon==='cinderthornLongbow'&&damage>0&&damage<(target?.hp??r.hp)&&now>=(foe.snaredUntil??0)){
   foe.snaredUntil=now+longbowSnare.duration;
   if(target&&now<target.landsAt-1400)target.landsAt+=longbowSnare.delay;
   if(!target&&now<r.warningAt){r.warningAt+=longbowSnare.delay;r.landsAt+=longbowSnare.delay;}
   text+='Target snared. ';
  }
  if(m.weapon==='warAxe'){
   const add=warAxeReinforcement(m.pos,position,(r.adds??[]).filter(candidate=>candidate.hp>0),target?.id);
   if(add){const hit=Math.min(add.hp,warAxeSweepDamage());add.hp-=hit;m.damage+=hit;m.threat+=hit;text+='Cleave hit '+add.name+' for '+hit+'. ';}
  }
  if(!target){r.stagger+=Math.ceil(weaponStagger(m.weapon,s.combatGear.activeSwordUpgrade)*build.stagger)+(build.id==='vanguard'&&m.ward>0&&m.wardUntil>now?8:0);if(r.stagger>=160){r.stagger=0;r.exposedUntil=now+3000;r.landsAt=Math.max(r.landsAt,now+2000);text+='Stagger break! Core exposed. ';broken=true;}
   if(r.move==='bossFan'&&now>=r.warningAt){r.castHits++;if(r.castHits>=3){plan(r,now,1800);m.support++;text+='Charged volley interrupted! ';interrupted=true;}}
  }
 }
 if(kind==='runeBurst'){
  const key=target?.id??'boss';
  if(m.weapon!==runeStaffRules.weapon||now>=(m.runeMarks?.[key]??0)||body.target&&body.target!=='boss'&&!target)throw invalid('Land a Runewood Staff bolt on your target first.');
  if(Math.hypot(m.pos.x-position.x,m.pos.y-position.y)>playerMeleeReach(m.weapon)||projectileCover(coopEncounter(r),m.pos,position))throw invalid('Move into range and find a clear shot for Rune Burst.');
  if(!spendMana(s,now,runeStaffRules.burstMana))throw invalid('Rune Burst needs 12 mana.');
  damage=markedAbilityDamage(Math.max(1,runeStaffRules.burstDamage-armour),m.runeMarks[key],now);
  delete m.runeMarks[key];m.runeBurstAt=now;
  m.arrow={from:{...m.pos},to:{x:position.x,y:position.y},blocked:false,staff:true};
  text='Rune Burst · Rune mark consumed. ';
 }
 if(kind==='power'){
  const magic=normalizeMagic(s.magic),power=essencePower(magic.slots[body.slot],s.stats,magic,build);if(!power||!magic.unlocked.includes(power.id)||!bondedEssences(magic.picks).includes(power.gem)||!['q','e'].includes(body.slot)||now<(magic.cooldowns[power.id]??0))throw invalid('Choose an equipped ability that is ready.');
  const mana=manaAvailable(s.vitals,now);if(mana<build.mana)throw invalid('Wait for '+build.mana+' mana before casting.');
  const ally=Object.values(r.members).find(a=>a.id===body.ally&&a.hp>0&&!a.left)??m;
  if(power.form==='sword'){const shatter=!target&&build.id==='spellweaver'&&r.chilledUntil>now;damage=Math.max(1,Math.round(power.value*(shatter?1.15:1))-armour);if(shatter){r.chilledUntil=0;text='Shatter! ';}
   const key=target?.id??'boss';if(now<(m.runeMarks?.[key]??0)){damage=markedAbilityDamage(damage,m.runeMarks[key],now);delete m.runeMarks[key];text+='Rune mark consumed. ';}
   const splash=bladeSplash(power);let count=0;if(splash)for(const add of r.adds??[]){if(add.hp<=0||add.id===target?.id||Math.hypot(add.x-position.x,add.y-position.y)>splash.radius)continue;const hit=Math.min(add.hp,splash.damage);add.hp-=hit;m.damage+=hit;m.threat+=hit;count++;}if(count)text+='Splash hit '+count+' nearby reinforcements. ';
  }
  else if(power.form==='shield'){ally.ward=power.value;ally.wardUntil=now+5000;m.support++;text='Ward raised for '+ally.name+'. ';}
  else if(power.form==='renewal'){if(ally.hp>=playerMaxHealth(ally,now))throw invalid('Choose an injured ally to heal.');ally.hp=Math.min(playerMaxHealth(ally,now),ally.hp+power.value);m.support++;text='Healed '+ally.name+'. ';}
  else if(power.form==='focus'){r.landsAt+=Math.min(1000,power.value);m.support++;text='Guardian delayed. ';}
  else{m.nextDodgeAt=now;m.dodgeUntil=now+boarRules.dodgeWindow;text='Dodge readied. ';}
  if(power.gem==='storm'&&r.move==='bossFan'&&now>=r.warningAt){plan(r,now,1800);m.support++;text+='Storm interrupted the volley! ';interrupted=true;}
  if(!target&&power.gem==='fire')r.burn={source:id,damage:power.rank+2,nextAt:now+1000,until:now+4000};
  if(!target&&power.gem==='ice'){if(now>=(r.chilledUntil??0))r.landsAt+=600;r.chilledUntil=now+4000;}
  if(!target&&power.gem==='shadow')r.weakenedUntil=now+5000;
  s.magic={...magic,cooldowns:{...magic.cooldowns,[power.id]:now+power.cooldown}};s.vitals={...normalizeVitals(s.vitals),mana:mana-build.mana,manaAt:now};m.used=[...new Set([...m.used,power.gem])];m.castAt=now;m.castKind=null;
 }
 if(kind==='taunt'){if(now<(m.tauntReadyAt??0))throw invalid('Wait for Taunt to recover.');r.taunt=id;r.tauntUntil=now+6000;m.tauntReadyAt=now+8000;m.support++;text='Taunted! The next attack will focus you; the current warning stays locked.';}
 if(kind==='dodge'){if(now<m.nextDodgeAt)throw invalid('Wait for Dodge to recover.');m.dodgeUntil=now+350;m.nextDodgeAt=now+1300;text='Dodge started. Time it just before impact.';}
 if(kind==='strike'||kind==='power'||kind==='runeBurst'){
  m.attackTarget=damage>0?{x:position.x,y:position.y}:null;
  m.attackPosition=damage>0?{...m.pos}:null;
 }
 if(ash&&damage>0&&kind!=='strike'&&now<(r.exposedUntil??0))damage=Math.ceil(damage*(1+ashenStagRules.exposedBonus));
 if(damage){const hit=Math.min(damage,target?target.hp:r.hp);if(counter)m.lastCounter={at:now,tile:{x:position.x,y:position.y},damage:hit};if(exposedShot)r.lastExposedHit={at:now,tile:{x:position.x,y:position.y},damage:hit};if(target)target.hp-=hit;else r.hp-=hit;if(m.weapon==='vampiricSword'&&(target?target.hp:r.hp)===0){const heal=Math.min(4,playerMaxHealth(m,now)-m.hp);m.hp+=heal;if(heal){recordEquipmentEffect(s,'vampire',heal,now,'vampire:coop:'+r.id+':'+(target?.id??'leader'));m.perk=s.equipmentEffects.at(-1);}}m.damage+=hit;m.threat+=hit;text+='Hit '+(target?.name??'Guardian')+' for '+hit+'.';phaseChange(r,now);}
 if(interrupted||!target&&(damage>0||broken))enemyReaction(r,{damage:target?0:damage,guarded,broken,interrupted},now);
 m.lastFeedback=text;if(kind!=='dodge')spendActionPoint(s,now);syncPlayer(s,r,id,now);return {text,hit:damage};
}
export async function readVaultParty(db,id,playerId,now=Date.now()){
 if(!/^[A-F0-9]{8}$/.test(id??''))throw invalid('Enter the eight-character party code.');const row=await db.prepare('SELECT * FROM tower_vault_parties WHERE party_id=?').bind(id).first();if(!row)throw invalid('This Vault party could not be found.');
 const r=JSON.parse(row.state_json);return {row,raid:r,public:publicVaultParty(r,playerId,now)};
}
export async function writeVaultParty(db,row,body,now=Date.now(),random=Math.random){
 const create=body.kind==='create',original=JSON.parse(row.state_json);let party=body.id??original.vaultCoop?.id;
 if(create){
  const sighting=ashenStagRoom(original.location)?ashenStagSighting(now):null;
  const hunt=sighting?{hunt:'ashenStag',room:sighting.room,sighting:sighting.id,sightingUntil:sighting.until,origin:{x:sighting.x,y:sighting.y}}:{};
  eligible(original,hunt,now);if(original.vaultCoop)throw invalid('Leave your current party first.');await db.prepare("DELETE FROM tower_vault_parties WHERE expires_at<? AND json_extract(state_json,'$.closed')=1").bind(now-7*86400000).run();party=uid();const r={id:party,leader:row.player_id,status:'waiting',...hunt,vaultMechanism:original.depthsRun?.vaultMechanism,expiresAt:sighting?.until??now+vaultCoopRules.lifetime,hp:420,max:420,members:{},adds:[]};await db.prepare('INSERT INTO tower_vault_parties(party_id,state_json,expires_at) VALUES(?,?,?)').bind(party,JSON.stringify(r),r.expiresAt).run();}
 const operation=JSON.stringify([row.player_id,body.operation]);
 for(let retry=0;retry<5;retry++){
  const {row:record,raid}=await readVaultParty(db,party,row.player_id,now),s=JSON.parse(row.state_json);if(now>=raid.expiresAt&&body.kind!=='leave'&&!(body.kind==='claim'&&raid.status==='victory'))throw invalid('This party has expired. Leave it and start a new expedition.');
  if(s.vaultCoop&&s.vaultCoop.id!==party)throw invalid('Leave your current party first.');
  const member=raid.members[row.player_id],readOnlyCandidate=body.kind==='tick'&&!!member?.peerId;
  const beforeRaid=readOnlyCandidate?JSON.stringify(raid):null;
  const beforeState=readOnlyCandidate?JSON.stringify(s):null;
  const lastAt=member?.lastAt,lastSeen=s.routineLastSeen;
  const receipt=actVaultParty(raid,s,row.player_id,{...body,kind:create?'join':body.kind},now,random);
  if(readOnlyCandidate){
   member.lastAt=lastAt;
   s.routineLastSeen=lastSeen;
   if(JSON.stringify(raid)===beforeRaid&&JSON.stringify(s)===beforeState){
    return {updated:row,raid:publicVaultParty(raid,row.player_id,now),receipt,unchanged:true};
   }
   member.lastAt=now;
   s.routineLastSeen=now;
  }
  if(raid.members[row.player_id])raid.members[row.player_id].peerId??=(await tokenHash('public:'+row.player_id)).slice(0,24);raid.closed=Object.values(raid.members).every(m=>m.left||m.claimed||m.defeatLogged);
  const result=await db.batch([
   db.prepare('UPDATE tower_vault_parties SET state_json=?,version=version+1,last_operation=? WHERE party_id=? AND version=? AND EXISTS(SELECT 1 FROM tower_players WHERE player_id=? AND revision=?)').bind(JSON.stringify(raid),operation,party,record.version,row.player_id,row.revision),
   db.prepare('UPDATE tower_players SET state_json=?,revision=revision+1,last_request=?,updated_at=? WHERE player_id=? AND revision=? AND EXISTS(SELECT 1 FROM tower_vault_parties WHERE party_id=? AND last_operation=?) RETURNING *').bind(JSON.stringify(s),body.operation,now,row.player_id,row.revision,party,operation)
  ]);const updated=result[1].results?.[0];if(updated)return {updated,raid:publicVaultParty(raid,row.player_id,now),receipt};
  const current=await db.prepare('SELECT revision FROM tower_players WHERE player_id=?').bind(row.player_id).first();if(current?.revision!==row.revision)return null;
 }
 throw Object.assign(new Error('The Vault party is busy. Try again.'),{status:409});
}
