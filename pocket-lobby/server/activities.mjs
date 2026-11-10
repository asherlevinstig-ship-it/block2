import {awardFamiliarBond} from './familiar-progression.mjs';
import {cinderPounce} from './familiars.mjs';
import {initializeAdds,addDueAt,spawnAddWave,addKinds,addEncounter,mergeAddEvent,advanceAddPosition,queueBossAdds,chooseAutoAddTarget} from '../public/dungeon-adds.js';
import {initializeBrain,brainThinkEvent} from '../public/enemy-brain.js';
import {activateVeil,outfitVeilUntil,readyOutfitPower} from '../public/outfit-magic.js';
import {combatStamina} from '../public/hunting.js';
import {arenaEnemy,arenaWarningAt,lockArenaAttack,arenaMoveEvent,dungeonCover} from '../public/dungeon-arena.js';
import {enemyAttack} from '../public/hunting.js';
import {useHunger,exertionDuration,isExhausted} from '../public/player-vitals.js';
import {armourSelection} from '../public/hunting.js';
import {startBedRest,settleBedRest,stopBedRest} from './bed-rest.mjs';
import {awardDungeonWeapon} from '../public/dungeon-loot.js';
import {awardLeadership} from '../public/leadership.js';
import {MAX_SKILL_XP} from '../public/skill-curve.js';
import {nextCombatTactic} from '../public/character-rules.js';
import {castEssencePower} from './essences.mjs';
import {awardBattleStone,awardEssenceMastery} from '../public/essences.js';
import {moonwood} from '../public/moonwood.js';
import {isTimberTree,timberTreeState,cutTimberTree,harvestTimber,choppingDuration,grantBasicAxe} from '../public/woodcutting.js';
import {huntEnemies,huntEnemyForRoom,huntEnemy,huntRespawnAt,canUseWeapon,createHunt,advanceHunt,huntingTurn,boarRules,normalizeCombatSummary} from '../public/hunting.js';
import {depthsStages,depthsStageIndex,clearDepthsStage,inspectDepthsFind,depthsCacheRoom,depthsEnemyAvailable,chooseDepthsPassage,canEnterDepthsCache,depthsCacheReturn,canVisitDepthsRoom,depthsSpoils,depthsSideForRoom,visitDepthsSide,useDepthsRest} from '../public/depths.js';
import {recordQuest} from '../public/quests.js';
import {moonbackRules,moonbackSighting} from '../public/moonback.js';
import {veilCloakId} from '../public/wardrobe.js';

const adjacent=(state,item)=>state.position&&Math.abs(state.position.x-item.x)+Math.abs(state.position.y-item.y)===1;
function idle(state){
  if(state.plan||state.report||state.fishingCast||state.hunting.encounter||state.hunting.recoveryUntil||state.health<=0)throw new Error('Invalid activity while working, fishing, fighting or recovering.');
}
function move(state,room,position={x:5,y:7}){state.location=room;state.position=position;}
export function startCombatEncounter(state,enemy,now){
  delete state.timberCut;
  if(state.outfitMagic)state.outfitMagic.veilUntil=0;
  state.combatId=crypto.randomUUID();state.combatReceipt={id:crypto.randomUUID(),events:[]};
  state.hunting.encounter=createHunt(now,enemy.health,enemy.id,isExhausted(state.vitals));
  state.hunting.encounter.summary=normalizeCombatSummary({startedAt:now});
  if(enemy.room.startsWith('depths')||enemy.room==='millCellar')Object.assign(state.hunting.encounter,{arenaVersion:1,arenaRoom:enemy.room,arenaPlayer:{...(state.position??{x:5,y:5})},arenaEnemy:{x:6,y:5},arenaStepAt:now,arenaLockedFor:0,arenaSolids:(moonwood.layouts[enemy.room]?.scenery??[]).filter(p=>p.type!==enemy.prop).map(({x,y})=>({x,y}))});
  if(enemy.room==='millCellar')state.hunting.encounter=initializeBrain(state.hunting.encounter,enemy,now);
  if(enemy.room.startsWith('depths'))state.hunting.encounter=initializeAdds(initializeBrain(state.hunting.encounter,enemy,now),now,state.familiars?.equipped==='fox');
  if(state.characterRules?.combat?.enabled||state.plan?.activeHunt)state.hunting.encounter.tacticsAt=now;
}
function result(state,event,now,random=Math.random){
  const encounter=state.hunting.encounter,enemy=huntEnemy(encounter);
  const room=state.location,heldBefore=state.depthsRun?depthsSpoils(state.depthsRun):null;
  const summary=normalizeCombatSummary(encounter.summary)??normalizeCombatSummary({startedAt:now,partial:true});
  if(event.powerId){
    summary.spells[event.powerId]=(summary.spells[event.powerId]??0)+1;
    if(event.automatic)summary.automaticCasts++;
  }
  if(event.action==='flee'){summary.fleeAttempts++;if(event.automatic)summary.automaticFlees++;}
  if(event.interrupted)summary.interrupts++;
  if(event.addKill)awardFamiliarBond(state,'fox',5);
  if(event.dodged)summary.dodges++;
  if(event.automaticDodge)summary.automaticDodges++;
  if(event.perfectDodge)summary.perfectDodges++;
  if(event.counter){summary.counters++;summary.counterBonus+=event.counterBonus??0;}
  if(event.staggered)summary.staggers++;
  if(event.weakSpot){summary.weakSpotHits++;summary.staggerBonus+=event.staggerBonus??0;}
  summary.prevented+=(event.weakened??0)+(event.warded??0)+(event.absorbed??0);
  if(event.encounter)event.encounter.summary=summary;
  const rewards={};
  if(event.encounter&&Number.isSafeInteger(encounter.tacticsAt))event.encounter.tacticsAt=now;
  state.hunting.encounter=queueBossAdds(event.encounter,now);event.encounter=state.hunting.encounter;state.health=event.health;
  if(event.outcome==='victory'){
    useHunger(state,2);
    if(state.combatId)event.mastery=awardEssenceMastery(state.magic,[...(encounter.usedEssences??[]),event.masteryGem],enemy.masteryXp??10);
    if(state.location!==depthsCacheRoom&&state.location!=='depthsTrial'&&state.combatId&&state.magic?.picks.length)event.stone=awardBattleStone(state.magic,enemy.id==='depthsGuardian');
    rewards.xp={};
    for(const [i,key] of ['strengthXp','agilityXp','vitalityXp'].entries()){
      const before=state.stats[key];state.stats[key]=Math.min(MAX_SKILL_XP,before+enemy.xp[i]);rewards.xp[key]=state.stats[key]-before;
    }
    rewards.mastery=event.mastery??[];
    if(event.stone)rewards.stones={[event.stone]:1};
    if(state.depthsRun){
      const cleared=clearDepthsStage(state.depthsRun,state.location,!!state.combatId);
      if(cleared&&state.combatId&&enemy.id==='depthsGuardian'){
        rewards.xp.leadershipXp=awardLeadership(state,'vaultClear');
        const drop=awardDungeonWeapon(state,now,random);
        if(drop){event.weaponDrop=drop;rewards.weapon=drop.weapon;state.depthsRun.vaultWeapon=drop.weapon;}
      }
      const held=depthsSpoils(state.depthsRun);
      rewards.held={gold:held.gold-heldBefore.gold,loot:Object.fromEntries(Object.entries(held.loot).map(([id,count])=>[id,count-(heldBefore.loot[id]??0)]).filter(([,count])=>count>0))};
      if(state.location===depthsCacheRoom)rewards.cacheUnlocked=true;
    }
    else{
      if(enemy.id==='moonbackStag'){
        state.hunting.moonbackSighting=encounter.moonbackId;
        if(!state.wardrobe.owned.includes(veilCloakId)&&random()<moonbackRules.cloakChance){
          state.wardrobe.owned.push(veilCloakId);
          event.clothingDrop=rewards.clothing=veilCloakId;
        }
      }else if(enemy.id==='millCustodian'&&state.combatId)state.adventure.millCellarCleared=true;
      else state.hunting[enemy.id==='thornBoar'?'thornRespawnAt':enemy.id==='beetle'?'beetleRespawnAt':'respawnAt']=now+enemy.respawn;
      const before=state.huntingLoot[enemy.loot]??0;
      state.huntingLoot[enemy.loot]=Math.min(1000000,before+1);
      if(state.huntingLoot[enemy.loot]>before)rewards.loot={[enemy.loot]:state.huntingLoot[enemy.loot]-before};
      if(enemy.id==='beetle'){state.depthsDiscovered=true;if(!state.plan?.activeHunt)state.history.beetleDefeated=true;}
      if(enemy.id==='thornBoar'&&state.combatId)state.adventure.watchBoar=true;
      if(enemy.id==='boar'){recordQuest(state.quest,'boar');state.history.boarDefeated=true;}
    }
  }else if(event.outcome==='defeat'){
    state.depthsRun=null;state.hunting.recoveryUntil=now+boarRules.recovery;move(state,'hub',{x:8,y:12});
  }else if(event.outcome==='escaped'){
    if(state.depthsRun){
      if(depthsSideForRoom(state.location)){move(state,'depthsGallery',{x:4,y:5});}
      else{const previous=depthsStages[state.depthsRun.cleared-1];
      if(previous)move(state,previous.room,{x:4,y:5});
      else{state.depthsRun=null;move(state,'ruins');}}
    }else if(enemy.id==='millCustodian')move(state,'millbrook',{x:6,y:2});
    else if(enemy.id==='thornBoar')move(state,'ambermead',{x:10,y:2});
    else if(enemy.id==='beetle')move(state,'creek',{x:10,y:4});
    else move(state,'trail',{x:7,y:1});
  }
  if(event.outcome!=='fighting'&&state.combatId){
    const decision=event.decision??encounter.lastDecision;
    const report={...(decision?{decision}:{}),id:state.combatId,enemy:enemy.id,room,outcome:event.outcome,endedAt:now,endedHealth:event.health,summary,rewards};
    if(event.outcome==='defeat'&&heldBefore)report.lostSpoils=heldBefore;
    if(state.plan?.kind==='queue'&&state.plan.activeHunt?.id===state.combatId)state.plan.lastHuntReport=report;
    else state.combatReports=[...(state.combatReports??[]).filter(item=>item.id!==report.id),report].slice(-10);
  }
  return {...event,...(enemy.id==='moonbackStag'?{enemyTile:arenaEnemy(encounter)}:{}),...(encounter.arenaVersion===1?{enemyTile:event.enemyTile??arenaEnemy(encounter),attackTile:event.attackTile??encounter.arenaTarget,attackCenter:event.attackCenter??enemyAttack(encounter).center,attackFan:event.attackFan??enemyAttack(encounter).fan,attackReach:event.attackReach??enemyAttack(encounter).reach}:{}),enemyId:event.enemyId??enemy.id,at:now};
}

// Replay each due strike at its scheduled time. Closing or slowing the client
// cannot postpone enemy attacks or manufacture additional player strikes.
export function advanceServerCombat(state,now,random=Math.random){
  const events=[];
  for(let i=0;state.hunting.encounter&&i<2048;i++){
    const encounter=state.hunting.encounter;
    if(encounter.addsVersion===1&&!encounter.manualTarget&&state.characterRules?.combat?.enabled)encounter.combatTarget=chooseAutoAddTarget(encounter,encounter.tacticsAt??0);
    const addsDue=addDueAt(encounter);
    const coreDue=Math.min(addsDue,encounter.nextPlayerAt,encounter.nextBoarAt,encounter.burn?.nextAt??Infinity,encounter.brainVersion===2?encounter.brainNextThinkAt:Infinity);
    const tactic=nextCombatTactic(state),automatic=tactic&&tactic.at<coreDue;
    const due=automatic?tactic.at:coreDue,warningAt=arenaWarningAt(encounter,enemyAttack(encounter));
    if(warningAt<=Math.min(due,now)){state.hunting.encounter=lockArenaAttack(encounter,enemyAttack(encounter),huntEnemy(encounter));continue;}
    if(due>now)break;
    let event;
    if(automatic){
      if(tactic.action==='move')event=arenaMoveEvent(state,tactic.tile,due,moonwood.layouts[state.location]?.scenery,combatStamina(encounter,state.stats,due,state.combatGear.moonwellCharmEquipped));
      else if(tactic.action==='essence')event=castEssencePower(state,due,tactic.slot);
      else event=huntingTurn(encounter,state.health,state.stats,tactic.action,due,random,state.combatGear.equippedWeapon,state.combatGear.activeSwordUpgrade,armourSelection(state.combatGear),state.combatGear.moonwellCharmEquipped,state.combatGear.weaponEnchantments);
      if(event){event.automatic=true;if(tactic.action==='move'&&event.encounter?.brainVersion===2)event.encounter.brainAutoStepAt=due+900;event.decision={at:due,style:tactic.style,action:tactic.action,reason:tactic.reason};if(event.encounter){event.encounter.lastDecision=event.decision;if(tactic.action==='dodge')event.encounter.autoDodgeUntil=event.encounter.dodgeUntil;}}
    }else if(due===addsDue)event=advanceDungeonAdds(state,due,random);
    else if(encounter.brainVersion===2&&due===encounter.brainNextThinkAt)event=brainThinkEvent(state,huntEnemy(encounter),enemyAttack(encounter),due);
    else event=advanceHunt(encounter,state.health,state.stats,due,random,state.combatGear.equippedWeapon,state.combatGear.activeSwordUpgrade,armourSelection(state.combatGear),state.combatGear.moonwellCharmEquipped,state.combatGear.weaponEnchantments);
    if(!event)break;
    events.push(result(state,event,due,random));
  }
  if(events.length)state.combatReceipt={id:crypto.randomUUID(),events};
  return events;
}
export function settleActivities(state,now,random=Math.random){
  let changed=settleBedRest(state,now);
  if(state.hunting?.encounter&&!(state.plan?.kind==='queue'&&state.plan.activeHunt))changed=advanceServerCombat(state,now,random).length>0;
  if(state.hunting?.recoveryUntil&&now>=state.hunting.recoveryUntil){state.hunting.recoveryUntil=0;state.health=100;changed=true;}
  return changed;
}

export function activityAction(state,action,body,now,random){
  if(action==='bedRest'){startBedRest(state,body.id,now);return true;}
  if(action==='bedRestStop'){stopBedRest(state,now);return true;}
  if(action==='combatReportAck'){
    if(typeof body.id!=='string')throw new Error('Choose a combat recap to dismiss.');
    state.combatReports=(state.combatReports??[]).filter(report=>report.id!==body.id);
    if(!state.combatReports.length)delete state.combatReports;
    return true;
  }
  if(action==='axe'){
    idle(state);
    const npc=moonwood.layouts.logging.scenery.find(item=>item.type==='woodcutter');
    if(state.location!=='logging'||!adjacent(state,npc))throw new Error('Travel to the woodcutter for your free axe.');
    grantBasicAxe(state.woodcutting);return true;
  }
  if(action==='chop'||action==='cut'){
    idle(state);
    const tree=moonwood.layouts[state.location]?.scenery.find(item=>isTimberTree(item)&&item.x===body.x&&item.y===body.y);
    if(!tree||!adjacent(state,tree))throw new Error('Travel beside a tree before chopping.');
    const wood=state.woodcutting,key=state.location+':'+tree.x+','+tree.y;
    if(!wood.axeOwned||!wood.equipped)throw new Error('Choose your basic axe before chopping.');
    if(wood.timber>=1000000||timberTreeState(wood,now,key).regrowsAt)throw new Error('Invalid tree. Wait for regrowth or sell some timber.');
    if(action==='cut'){
      const cut=state.timberCut;
      if(!cut||cut.id!==body.cutId||cut.key!==key||now<cut.endsAt)throw new Error('Invalid cut timing. Finish chopping this tree first.');
      const xp=wood.xp;
      let amount=cutTimberTree(wood,now,key);if(amount&&state.location==='thornwood')amount+=harvestTimber(wood);useHunger(state);
      const felled=!!timberTreeState(wood,now,key).regrowsAt;
      state.timberReceipt={id:cut.id,key,amount,xp:wood.xp-xp,at:now,room:state.location,felled};delete state.timberCut;
      if(felled||wood.timber>=1000000)return true;
    }
    if(state.timberCut?.key!==key)state.timberCut={id:crypto.randomUUID(),key,started:now,endsAt:now+exertionDuration(choppingDuration(wood),state.vitals)};
    return true;
  }
  if(action==='fight'){
    idle(state);
    if(outfitVeilUntil(state)>now)throw new Error('Choose End Veilstep before starting a fight.');
    let sighting=null,enemy=huntEnemyForRoom(state.location);
    const index=depthsStageIndex(state.location);
    if(body.moonbackId!==undefined){
      sighting=moonbackSighting(now);
      if(!sighting||sighting.id!==body.moonbackId||sighting.room!==state.location)throw new Error('The Moonback Stag moved. Follow its fresh tracks.');
      if(state.hunting.moonbackSighting===sighting.id)throw new Error('You already won this sighting. Follow the next trail when it returns.');
      enemy={...huntEnemies.moonbackStag,room:state.location};
    }
    if(enemy?.id==='millCustodian'&&(!state.adventure.millCellarFound||state.adventure.millCellarCleared))throw new Error('Choose another challenge. The cellar custodian has already been defeated.');
    if(!enemy||!adjacent(state,sighting??{x:6,y:5}))throw new Error('Travel beside the creature before fighting.');
    if(!state.combatGear.equippedWeapon||!canUseWeapon(state.stats,state.combatGear.equippedWeapon))throw new Error('Choose a weapon you can use before fighting.');
    if(!sighting&&(index>=0?!depthsEnemyAvailable(state.depthsRun,state.location):now<huntRespawnAt(state.hunting,enemy)))throw new Error('Invalid encounter. Wait for the creature to return.');
    startCombatEncounter(state,enemy,now);
    if(sighting)Object.assign(state.hunting.encounter,{moonbackRoom:sighting.room,moonbackId:sighting.id});
    if(body.standGround===true&&index>=0)state.hunting.encounter.autoRetreatDisabled=true;
    const firstTactic=index>=0?nextCombatTactic(state):null;
    if(firstTactic?.action==='flee'){
      state.hunting.encounter=null;delete state.combatId;delete state.combatReceipt;
      throw new Error('Choose whether to fight: Auto retreat would immediately withdraw you. '+firstTactic.reason);
    }
    return true;
  }
  if(action==='combat'){
    if(state.plan?.activeHunt)throw new Error('Your hunting queue is controlling this fight. Return to stop after the fight.');
    if(body.combatId!==state.combatId)throw new Error('Invalid encounter. Reload your character.');
    const events=advanceServerCombat(state,now,random);
    if(state.hunting.encounter?.addsVersion===1&&body.input==='target'){
      const e=state.hunting.encounter,id=body.slot;
      if(id!=='leader'&&!e.adds.some(a=>a.id===id&&a.spawnAt<=now))throw new Error('Choose an active enemy.');
      e.combatTarget=id;e.manualTarget=true;state.combatReceipt={id:crypto.randomUUID(),events};return true;
    }
    if(state.hunting.encounter&&body.input==='secondWind'){
      const power=readyOutfitPower(state,'secondWind',now),encounter=state.hunting.encounter;
      const stamina=combatStamina(encounter,state.stats,now,state.combatGear.moonwellCharmEquipped);
      if(stamina>=100)throw new Error('Your dodge stamina is already full.');
      const restored=Math.min(power.amount,100-stamina);
      state.outfitMagic.readyAt.secondWind=now+power.cooldown;
      events.push(result(state,{action:'outfitPower',outcome:'fighting',health:state.health,damage:0,taken:0,
        encounter:{...encounter,stamina:stamina+restored,staminaAt:now},power:power.name,powerColor:power.color,powerForm:'speed',
        staminaRestored:Math.ceil(restored),effect:'restored '+Math.ceil(restored)+' dodge stamina'},now,random));
    }
    if(state.hunting.encounter&&body.input==='veil'){
      activateVeil(state,now);
      events.push(result(state,{action:'flee',outcome:'escaped',encounter:null,health:state.health,power:'Veilstep',effect:'breaks the creature’s pursuit'},now,random));
    }
    if(state.hunting.encounter&&body.input==='familiar')events.push(result(state,cinderPounce(state,now),now,random));
    if(state.hunting.encounter&&body.input==='move'){
      const e=arenaMoveEvent(state,body.tile,now,moonwood.layouts[state.location]?.scenery,combatStamina(state.hunting.encounter,state.stats,now,state.combatGear.moonwellCharmEquipped));
      if(e)events.push(result(state,e,now,random));
    }
    if(state.hunting.encounter&&['dodge','flee','essence'].includes(body.input)){
      if(body.input==='essence'){
        const event=castEssencePower(state,now,body.slot);
        if(event)events.push(result(state,event,now,random));
      }else{
        const event=huntingTurn(state.hunting.encounter,state.health,state.stats,body.input,now,random,state.combatGear.equippedWeapon,state.combatGear.activeSwordUpgrade,armourSelection(state.combatGear),state.combatGear.moonwellCharmEquipped,state.combatGear.weaponEnchantments);
        if(event)events.push(result(state,event,now,random));
      }
    }
    state.combatReceipt={id:crypto.randomUUID(),events};
    if(body.reviewing===true){
      state.combatReports=(state.combatReports??[]).filter(report=>report.id!==body.combatId||now-report.endedAt>1500);
      if(!state.combatReports.length)delete state.combatReports;
    }
    return true;
  }
  if(action==='rest'||action==='recover'){
    if(action==='rest'){
      idle(state);
      if(!['home','hub'].includes(state.location))throw new Error('Travel to the Tower to rest.');
      if(state.health<100)state.hunting.recoveryUntil=now+boarRules.recovery;
    }else settleActivities(state,now,random);
    return true;
  }
  if(action==='depthsSide'){idle(state);delete state.timberCut;visitDepthsSide(state,body.id);return true;}
  if(action==='depthsShrine'){idle(state);useDepthsRest(state);return true;}
  if(action==='depthsInspect'){
    idle(state);
    const item=moonwood.layouts[state.location]?.scenery.find(prop=>prop.type===body.id);
    inspectDepthsFind(state,item);
    return true;
  }
  if(action==='depthsPassage'){
    idle(state);delete state.timberCut;chooseDepthsPassage(state,body.choice);return true;
  }
  if(action==='depthsCacheEnter'||action==='depthsCacheLeave'){
    idle(state);delete state.timberCut;
    const entering=action==='depthsCacheEnter';
    if(entering?!canEnterDepthsCache(state.depthsRun,state.location):state.location!==depthsCacheRoom||!canVisitDepthsRoom(state.depthsRun,state.location))throw new Error('Clear Shell Gallery or choose the dangerous passage to reach the cache chamber.');
    const destination=entering?depthsCacheRoom:depthsCacheReturn(state.depthsRun);
    move(state,destination,entering?{x:3,y:5}:destination==='depthsGate'?{x:4,y:5}:{x:9,y:5});
    return true;
  }
  if(action==='depthsEnter'||action==='depthsNext'||action==='depthsLeave'){
    idle(state);delete state.timberCut;
    if(action==='depthsEnter'){
      if(state.location!=='ruins'||!state.depthsDiscovered||state.depthsRun||!state.combatGear.equippedWeapon)throw new Error('Invalid expedition entrance. Defeat the Stoneback Beetle first.');
      state.depthsRun={cleared:0,routeChoice:'pending'};move(state,depthsStages[0].room,{x:4,y:5});
    }else if(action==='depthsNext'){
      const index=depthsStageIndex(state.location),next=depthsStages[index+1];
      if(depthsSideForRoom(state.location)||state.location===depthsCacheRoom||index<0||!next||state.depthsRun?.cleared!==index+1)throw new Error('Invalid expedition. Clear this chamber first.');
      if(index===0&&state.depthsRun.routeChoice==='pending')throw new Error('Choose the safe or dangerous passage before continuing.');
      if(index===0&&state.depthsRun.routeChoice==='dangerous'&&!state.depthsRun.cacheGuardDefeated)throw new Error('Choose the dangerous passage to face its guardian, or bank your spoils.');
      move(state,next.room,{x:4,y:5});
    }else{
      if(depthsStageIndex(state.location)<0||state.depthsRun?.cleared!==0)throw new Error('Choose bank spoils to leave this expedition.');
      state.depthsRun=null;move(state,'ruins');
    }
    return true;
  }
  return false;
}

function advanceDungeonAdds(state,now,random){
 const e=state.hunting.encounter;
 if(e.addWaveAt&&now===e.addWaveAt)return {...spawnAddWave(e,now),health:state.health};
 const a=e.adds.find(a=>Math.min(a.thinkAt,a.attackAt,a.lockedFor===a.attackAt?Infinity:a.attackAt-addKinds[a.kind].move.tell,a.burn?.nextAt??Infinity)===now);
 if(!a)return null;
 const move=addKinds[a.kind].move,view=addEncounter(e,a);
 const change=actor=>({action:'addThink',encounter:{...e,adds:e.adds.map(b=>b.id===a.id?actor:b)},health:state.health,damage:0,taken:0,outcome:'fighting'});
 if(a.burn?.nextAt===now){
  const damage=Math.min(a.health,a.burn.damage),next={...view,health:a.health-damage};
  if(a.burn.nextAt+1000<=a.burn.until)next.burn={...a.burn,nextAt:now+1000};else delete next.burn;
  return mergeAddEvent(e,a,{action:'burn',damage,taken:0,health:state.health,powerColor:'#ffac78',encounter:next.health?next:null,outcome:next.health?'fighting':'victory'});
 }
 if(a.lockedFor!==a.attackAt&&now===a.attackAt-move.tell)return change({...a,lockedFor:a.attackAt,target:{...e.arenaPlayer},origin:{x:a.x,y:a.y}});
 if(now===a.attackAt){
  const event=huntingTurn(view,state.health,state.stats,'enemy',now,random,state.combatGear.equippedWeapon,state.combatGear.activeSwordUpgrade,armourSelection(state.combatGear),state.combatGear.moonwellCharmEquipped,state.combatGear.weaponEnchantments);
  if(event?.encounter){event.encounter.nextBoarAt=now+addKinds[a.kind].interval;event.nextMove=move.name;}
  const merged=mergeAddEvent(e,a,event);
  if(merged?.encounter)merged.encounter.adds=merged.encounter.adds.map(b=>b.id===a.id?{...b,thinkAt:now+move.recovery}:b);
  return merged;
 }
 return change(now<a.spawnAt||now>=(a.staggerUntil??0)&&now>=a.attackAt-move.tell?{...a,thinkAt:a.attackAt+1}:now<(a.staggerUntil??0)?{...a,thinkAt:a.staggerUntil}:advanceAddPosition(e,a,now));
}
