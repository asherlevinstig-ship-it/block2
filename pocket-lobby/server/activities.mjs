import {MAX_SKILL_XP} from '../public/skill-curve.js';
import {nextCombatTactic} from '../public/character-rules.js';
import {castEssencePower} from './essences.mjs';
import {awardBattleStone,awardEssenceMastery} from '../public/essences.js';
import {moonwood} from '../public/moonwood.js';
import {isTimberTree,timberTreeState,cutTimberTree,choppingDuration,grantBasicAxe} from '../public/woodcutting.js';
import {huntEnemyForRoom,huntEnemy,huntRespawnAt,canUseWeapon,createHunt,advanceHunt,huntingTurn,boarRules,normalizeCombatSummary} from '../public/hunting.js';
import {depthsStages,depthsStageIndex,clearDepthsStage,inspectDepthsFind,depthsCacheRoom,depthsEnemyAvailable,chooseDepthsPassage,canEnterDepthsCache,depthsCacheReturn,canVisitDepthsRoom,depthsSpoils,depthsSideForRoom,visitDepthsSide,useDepthsRest} from '../public/depths.js';
import {recordQuest} from '../public/quests.js';

const adjacent=(state,item)=>state.position&&Math.abs(state.position.x-item.x)+Math.abs(state.position.y-item.y)===1;
function idle(state){
  if(state.plan||state.report||state.fishingCast||state.hunting.encounter||state.hunting.recoveryUntil||state.health<=0)throw new Error('Invalid activity while working, fishing, fighting or recovering.');
}
function move(state,room,position={x:5,y:7}){state.location=room;state.position=position;}
export function startCombatEncounter(state,enemy,now){
  delete state.timberCut;
  state.combatId=crypto.randomUUID();state.combatReceipt={id:crypto.randomUUID(),events:[]};
  state.hunting.encounter=createHunt(now,enemy.health,enemy.id);
  state.hunting.encounter.summary=normalizeCombatSummary({startedAt:now});
  if(state.characterRules?.combat?.enabled||state.plan?.activeHunt)state.hunting.encounter.tacticsAt=now;
}
function result(state,event,now){
  const encounter=state.hunting.encounter,enemy=huntEnemy(encounter);
  const room=state.location,heldBefore=state.depthsRun?depthsSpoils(state.depthsRun):null;
  const summary=normalizeCombatSummary(encounter.summary)??normalizeCombatSummary({startedAt:now,partial:true});
  if(event.powerId){
    summary.spells[event.powerId]=(summary.spells[event.powerId]??0)+1;
    if(event.automatic)summary.automaticCasts++;
  }
  if(event.action==='flee'){summary.fleeAttempts++;if(event.automatic)summary.automaticFlees++;}
  if(event.interrupted)summary.interrupts++;
  if(event.dodged)summary.dodges++;
  if(event.perfectDodge)summary.perfectDodges++;
  if(event.counter){summary.counters++;summary.counterBonus+=event.counterBonus??0;}
  if(event.staggered)summary.staggers++;
  if(event.weakSpot){summary.weakSpotHits++;summary.staggerBonus+=event.staggerBonus??0;}
  summary.prevented+=(event.weakened??0)+(event.warded??0)+(event.absorbed??0);
  if(event.encounter)event.encounter.summary=summary;
  const rewards={};
  if(event.encounter&&Number.isSafeInteger(encounter.tacticsAt))event.encounter.tacticsAt=now;
  state.hunting.encounter=event.encounter;state.health=event.health;
  if(event.outcome==='victory'){
    if(state.combatId)event.mastery=awardEssenceMastery(state.magic,[...(encounter.usedEssences??[]),event.masteryGem],enemy.masteryXp??10);
    if(state.location!==depthsCacheRoom&&state.location!=='depthsTrial'&&state.combatId&&state.magic?.picks.length)event.stone=awardBattleStone(state.magic,enemy.id==='depthsGuardian');
    rewards.xp={};
    for(const [i,key] of ['strengthXp','agilityXp','vitalityXp'].entries()){
      const before=state.stats[key];state.stats[key]=Math.min(MAX_SKILL_XP,before+enemy.xp[i]);rewards.xp[key]=state.stats[key]-before;
    }
    rewards.mastery=event.mastery??[];
    if(event.stone)rewards.stones={[event.stone]:1};
    if(state.depthsRun){
      clearDepthsStage(state.depthsRun,state.location,!!state.combatId);
      const held=depthsSpoils(state.depthsRun);
      rewards.held={gold:held.gold-heldBefore.gold,loot:Object.fromEntries(Object.entries(held.loot).map(([id,count])=>[id,count-(heldBefore.loot[id]??0)]).filter(([,count])=>count>0))};
      if(state.location===depthsCacheRoom)rewards.cacheUnlocked=true;
    }
    else{
      state.hunting[enemy.id==='beetle'?'beetleRespawnAt':'respawnAt']=now+enemy.respawn;
      const before=state.huntingLoot[enemy.loot]??0;
      state.huntingLoot[enemy.loot]=Math.min(1000000,before+1);
      if(state.huntingLoot[enemy.loot]>before)rewards.loot={[enemy.loot]:state.huntingLoot[enemy.loot]-before};
      if(enemy.id==='beetle'){state.depthsDiscovered=true;if(!state.plan?.activeHunt)state.history.beetleDefeated=true;}
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
    }else if(enemy.id==='beetle')move(state,'creek',{x:10,y:4});
    else move(state,'trail',{x:7,y:1});
  }
  if(event.outcome!=='fighting'&&state.combatId){
    const report={id:state.combatId,enemy:enemy.id,room,outcome:event.outcome,endedAt:now,endedHealth:event.health,summary,rewards};
    if(event.outcome==='defeat'&&heldBefore)report.lostSpoils=heldBefore;
    if(state.plan?.kind==='queue'&&state.plan.activeHunt?.id===state.combatId)state.plan.lastHuntReport=report;
    else state.combatReports=[...(state.combatReports??[]).filter(item=>item.id!==report.id),report].slice(-10);
  }
  return {...event,enemyId:enemy.id,at:now};
}

// Replay each due strike at its scheduled time. Closing or slowing the client
// cannot postpone enemy attacks or manufacture additional player strikes.
export function advanceServerCombat(state,now,random=Math.random){
  const events=[];
  for(let i=0;state.hunting.encounter&&i<2048;i++){
    const encounter=state.hunting.encounter;
    const coreDue=Math.min(encounter.nextPlayerAt,encounter.nextBoarAt,encounter.burn?.nextAt??Infinity);
    const tactic=nextCombatTactic(state),automatic=tactic&&tactic.at<coreDue;
    const due=automatic?tactic.at:coreDue;
    if(due>now)break;
    let event;
    if(automatic){
      if(tactic.action==='essence')event=castEssencePower(state,due,tactic.slot);
      else event=huntingTurn(encounter,state.health,state.stats,'flee',due,random,state.combatGear.equippedWeapon,state.combatGear.activeSwordUpgrade,state.combatGear.stonebackVestEquipped,state.combatGear.moonwellCharmEquipped,state.combatGear.weaponEnchantments);
      if(event)event.automatic=true;
    }else event=advanceHunt(encounter,state.health,state.stats,due,random,state.combatGear.equippedWeapon,state.combatGear.activeSwordUpgrade,state.combatGear.stonebackVestEquipped,state.combatGear.moonwellCharmEquipped,state.combatGear.weaponEnchantments);
    if(!event)break;
    events.push(result(state,event,due));
  }
  if(events.length)state.combatReceipt={id:crypto.randomUUID(),events};
  return events;
}
export function settleActivities(state,now,random=Math.random){
  let changed=false;
  if(state.hunting?.encounter&&!(state.plan?.kind==='queue'&&state.plan.activeHunt))changed=advanceServerCombat(state,now,random).length>0;
  if(state.hunting?.recoveryUntil&&now>=state.hunting.recoveryUntil){state.hunting.recoveryUntil=0;state.health=100;changed=true;}
  return changed;
}

export function activityAction(state,action,body,now,random){
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
      const amount=cutTimberTree(wood,now,key);
      state.timberReceipt={id:cut.id,key,amount};delete state.timberCut;
      if(timberTreeState(wood,now,key).regrowsAt)return true;
    }
    if(state.timberCut?.key!==key)state.timberCut={id:crypto.randomUUID(),key,started:now,endsAt:now+choppingDuration(wood)};
    return true;
  }
  if(action==='fight'){
    idle(state);
    const enemy=huntEnemyForRoom(state.location),index=depthsStageIndex(state.location);
    if(!enemy||!adjacent(state,{x:6,y:5}))throw new Error('Travel beside the creature before fighting.');
    if(!state.combatGear.equippedWeapon||!canUseWeapon(state.stats,state.combatGear.equippedWeapon))throw new Error('Choose a weapon you can use before fighting.');
    if(index>=0?!depthsEnemyAvailable(state.depthsRun,state.location):now<huntRespawnAt(state.hunting,enemy))throw new Error('Invalid encounter. Wait for the creature to return.');
    startCombatEncounter(state,enemy,now);
    return true;
  }
  if(action==='combat'){
    if(state.plan?.activeHunt)throw new Error('Your hunting queue is controlling this fight. Return to stop after the fight.');
    if(body.combatId!==state.combatId)throw new Error('Invalid encounter. Reload your character.');
    const events=advanceServerCombat(state,now,random);
    if(state.hunting.encounter&&['dodge','flee','essence'].includes(body.input)){
      if(body.input==='essence'){
        const event=castEssencePower(state,now,body.slot);
        if(event)events.push(result(state,event,now));
      }else{
        const event=huntingTurn(state.hunting.encounter,state.health,state.stats,body.input,now,random,state.combatGear.equippedWeapon,state.combatGear.activeSwordUpgrade,state.combatGear.stonebackVestEquipped,state.combatGear.moonwellCharmEquipped,state.combatGear.weaponEnchantments);
        if(event)events.push(result(state,event,now));
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
