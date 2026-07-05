import {api as worldApi,state as worldState} from './world.mjs';
import {api as dimensionsApi,state as dimensionsState} from './dimensions.mjs';
import {api as combatApi,state as combatState} from './combat.mjs';
import {api as hudApi,state as hudState} from './hud.mjs';
import {api as menusApi,state as menusState} from './menus.mjs';
import {createNetworkSession} from './network-session.mjs';
import {createSocialSystem} from './social.mjs';
import {createNetworkFramePump} from './network-frame-pump.mjs';
import {createCompanionSystem} from './companions.mjs';
import {createReplicationVisuals} from './replication-visuals.mjs';
import {createGearRewardPresenter} from './gear-rewards.mjs';
import {createCombatFeedback} from './combat-feedback.mjs';
import {biomeStatus} from './biome-status.mjs';
const gameContext=window.BlockcraftGameContext;
const GEAR_SYSTEM=globalThis.BlockcraftGearSystem;
const JOB_SYSTEM=globalThis.BlockcraftJobSystem;
const player=combatState.player,inv=combatState.inventory;
biomeStatus.init(document);
const getB=worldApi.getBlock,setB=worldApi.setBlock;
const refreshHUD=hudApi.refresh;
function receiveRewardItemLegacy(it){
  if(!it||!ITEMS[it.id])return;
  const itemInfo=ITEMS[it.id],info=itemInfo.tool||itemInfo.armor;
  if(!it.gear||!info){addItem(it.id,it.count||1);return;}
  const stack={id:it.id,count:1,plus:Math.max(0,Math.min(3,it.plus|0))};
  if(GEAR_SYSTEM.RANKS.some((r,i)=>i<6&&r.id===it.gearRank))stack.gearRank=it.gearRank;
  if(itemInfo.armor&&GEAR_SYSTEM.ARMOR_ARCHETYPES[it.armorType])stack.armorType=it.armorType;
  if(GEAR_SYSTEM.RARITIES.some(r=>r.id===it.rarity))stack.rarity=it.rarity;
  if(JOB_SYSTEM.reforgeModifier(it.forge))stack.forge=it.forge;
  if(it.masterwork&&stack.forge)stack.masterwork=true;
  if(it.locked)stack.locked=true;
  if(typeof it.source==='string'&&it.source)stack.source=it.source;
  stack.dur=Number.isFinite(it.dur)?it.dur:(itemInfo.armor?armorMaxDur(stack):toolMaxDur(stack));
  if(itemInfo.armor){
    const previous=armorSlot,profile=GEAR_SYSTEM.armorProfile(info,stack),old=previous?GEAR_SYSTEM.armorProfile(ITEMS[previous.id].armor,previous):null;
    const index=inv.findIndex(s=>!s);if(index<0)return;inv[index]=stack;refreshHUD();
    const better=!old||profile.mitigation>old.mitigation||(profile.mitigation===old.mitigation&&profile.maxDur>old.maxDur);
    const delta=old?Math.round((profile.mitigation-old.mitigation)*100):0;
    sysMsg('<b style="color:'+profile.rarity.color+'">'+escHTML(profile.rank.name+' '+profile.rarity.name+' '+itemNameWithPlus(stack))+'</b> acquired'+(better?' <b>Â· UPGRADE</b>':'')+' Â· '+Math.round(profile.mitigation*100)+'% mitigation'+(old?' ('+(delta>=0?'+':'')+delta+'%)':'')+' Â· '+profile.maxDur+' durability.');
    return;
  }
  const weapons=inv.filter(s=>s&&ITEMS[s.id]&&ITEMS[s.id].tool&&['sword','axe'].includes(ITEMS[s.id].tool.cls));
  const previous=weapons.reduce((best,s)=>!best||weaponDpsFor(s)>weaponDpsFor(best)?s:best,null);
  const index=inv.findIndex(s=>!s);if(index<0)return;inv[index]=stack;refreshHUD();
  const gear=GEAR_SYSTEM.profile({tier:info.tier,legendary:!!ITEMS[it.id].legendary},stack);
  const combat=weaponCombatFor(stack),oldCombat=previous?weaponCombatFor(previous):null,newDur=toolMaxDur(stack),oldDur=previous?toolMaxDur(previous):0;
  const better=!oldCombat||combat.dps>oldCombat.dps;
  const delta=(value,old)=>' ('+(value>=old?'+':'')+(Math.round((value-old)*10)/10)+')';
  const comparison=oldCombat
    ?' · Damage '+combat.damage+delta(combat.damage,oldCombat.damage)+' · Speed '+combat.attacksPerSecond+'/s'+delta(combat.attacksPerSecond,oldCombat.attacksPerSecond)+' · DPS '+combat.dps+delta(combat.dps,oldCombat.dps)+' · Durability '+newDur+delta(newDur,oldDur)
    :' · Damage '+combat.damage+' · Speed '+combat.attacksPerSecond+'/s · DPS '+combat.dps+' · Durability '+newDur;
  const col=gear.rarity.color;sysMsg('<b style="color:'+col+'">'+escHTML(gear.rank.name+' '+gear.rarity.name+' '+itemNameWithPlus(stack))+'</b> acquired'+(better?' <b>· UPGRADE</b>':'')+escHTML(comparison)+'.');
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.055,.14,5,8),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.72,depthWrite:false}));beam.position.set(player.pos.x,player.pos.y+2.5,player.pos.z);scene.add(beam);setTimeout(()=>{scene.remove(beam);beam.geometry.dispose();beam.material.dispose();},1800);
}

function rewardGearStack(it){
  if(!it||!ITEMS[it.id])return null;
  const itemInfo=ITEMS[it.id],info=itemInfo.tool||itemInfo.armor;
  if(!info)return null;
  const stack={id:it.id,count:1,plus:Math.max(0,Math.min(3,it.plus|0))};
  if(GEAR_SYSTEM.RANKS.some((r,i)=>i<6&&r.id===it.gearRank))stack.gearRank=it.gearRank;
  if(itemInfo.armor&&GEAR_SYSTEM.ARMOR_ARCHETYPES[it.armorType])stack.armorType=it.armorType;
  if(GEAR_SYSTEM.RARITIES.some(r=>r.id===it.rarity))stack.rarity=it.rarity;
  if(JOB_SYSTEM.reforgeModifier(it.forge))stack.forge=it.forge;
  if(it.masterwork&&stack.forge)stack.masterwork=true;
  if(it.locked)stack.locked=true;
  if(typeof it.source==='string'&&it.source)stack.source=it.source;
  stack.dur=Number.isFinite(it.dur)?it.dur:(itemInfo.armor?armorMaxDur(stack):toolMaxDur(stack));
  return stack;
}
function receiveRewardItem(it){
  if(!it||!ITEMS[it.id])return null;
  const itemInfo=ITEMS[it.id],info=itemInfo.tool||itemInfo.armor;
  if(!it.gear||!info){addItem(it.id,it.count||1);return null;}
  const baseline=itemInfo.armor?armorSlot:(()=>{
    const selected=inv[combatState.selectedSlot],selectedItem=selected&&ITEMS[selected.id];
    return selectedItem&&selectedItem.tool&&['sword','axe'].includes(selectedItem.tool.cls)?selected:null;
  })();
  const stack=rewardGearStack(it),slot=inv.findIndex(s=>!s);
  if(!stack||slot<0)return null;
  inv[slot]=stack;refreshHUD();
  return {stack,slot,baseline};
}

const GEAR_REWARDS=createGearRewardPresenter({
  document,items:ITEMS,gearSystem:GEAR_SYSTEM,itemName:itemNameWithPlus,toolMaxDur,
  getArmor:()=>armorSlot,
  getWeapon:()=>{
    const stack=inv[combatState.selectedSlot],item=stack&&ITEMS[stack.id];
    return item&&item.tool&&['sword','axe'].includes(item.tool.cls)?stack:null;
  },
  getSelectedSlot:()=>combatState.selectedSlot,
  send:(type,payload)=>{if(NET.on&&NET.room)NET.room.send(type,payload);},
  nearBlacksmith:()=>dimensionsState.kind==='overworld'&&!dimensionsState.dungeon&&Math.hypot(player.pos.x-(TOWN.TC+14.5),player.pos.z-(TOWN.TC-14))<=10,
  onReveal:({summary,recovered})=>{
    const color=summary.profile.rarity.color;
    if(summary.profile.rarityIndex>=3||summary.profile.rankIndex>=5)SFX.level();else SFX.success();
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(.055,.15,recovered?3.5:5,8),new THREE.MeshBasicMaterial({color,transparent:true,opacity:recovered?.42:.72,depthWrite:false}));
    beam.position.set(player.pos.x,player.pos.y+(recovered?1.75:2.5),player.pos.z);scene.add(beam);
    setTimeout(()=>{scene.remove(beam);beam.geometry.dispose();beam.material.dispose();},1800);
  },
});
const COMBAT_FEEDBACK=createCombatFeedback({document,showName,sysMsg,sound:SFX});

let prospectMarkers=null,prospectMarkerTimer=0;
function clearProspectMarkers(){
  if(prospectMarkerTimer){clearTimeout(prospectMarkerTimer);prospectMarkerTimer=0;}
  if(!prospectMarkers)return;
  prospectMarkers.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});
  scene.remove(prospectMarkers);prospectMarkers=null;
}
function showProspectMarkers(m){
  clearProspectMarkers();const ores=Array.isArray(m&&m.ores)?m.ores:[];
  if(!ores.length){sysMsg('Your survey finds no ore veins nearby.');return;}
  prospectMarkers=new THREE.Group();prospectMarkers.name='miner-prospect-markers';
  for(const ore of ores){
    const color=ore.id===B.DIAMOND_ORE?0x67e8f9:ore.id===B.IRON_ORE?0xf59e7a:0xd1d5db;
    const marker=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.08,1.08,1.08)),new THREE.LineBasicMaterial({color,transparent:true,opacity:.92,depthTest:false}));
    marker.position.set((ore.x|0)+.5,(ore.y|0)+.5,(ore.z|0)+.5);marker.renderOrder=20;prospectMarkers.add(marker);
  }
  scene.add(prospectMarkers);showJobPerk('miner',ores.length+' veins revealed');
  sysMsg('Ore Sense reveals <b>'+ores.length+'</b> nearby vein'+(ores.length===1?'':'s')+' for '+Math.round(((m&&m.durationMs)||12000)/1000)+' sec.');
  prospectMarkerTimer=setTimeout(clearProspectMarkers,Math.max(1000,(m&&m.durationMs)||12000));
}

const legacyNetworkingBindings={
  "acknowledgeSmartSuggestionKey":{get:()=>acknowledgeSmartSuggestionKey},
  "activeFamiliar":{get:()=>COMPANIONS.activeFamiliar,set:value=>{COMPANIONS.activeFamiliar=value;}},
  "addLightningBeam":{get:()=>addLightningBeam},
  "appearanceBackDummy":{get:()=>appearanceBackDummy,set:value=>{appearanceBackDummy=value;}},
  "appearanceDummy":{get:()=>appearanceDummy,set:value=>{appearanceDummy=value;}},
  "appearancePreviewActive":{get:()=>appearancePreviewActive,set:value=>{appearancePreviewActive=value;}},
  "applyMount":{get:()=>applyMount},
  "bindFamiliarItem":{get:()=>bindFamiliarItem},
  "buildAppearanceDummy":{get:()=>buildAppearanceDummy},
  "castDragonAbility":{get:()=>castDragonAbility},
  "chatLine":{get:()=>chatLine},
  "chatTyping":{get:()=>SOCIAL.chatTyping,set:value=>{SOCIAL.chatTyping=value;}},
  "claimLocalIncubation":{get:()=>claimLocalIncubation},
  "cutscene":{get:()=>cutscene,set:value=>{cutscene=value;}},
  "cutsceneSeen":{get:()=>cutsceneSeen},
  "cycleDragon":{get:()=>cycleDragon},
  "cycleFamiliar":{get:()=>cycleFamiliar},
  "disposeAppearanceDummy":{get:()=>disposeAppearanceDummy},
  "DRAGON_ABILITIES":{get:()=>DRAGON_ABILITIES},
  "DRAGON_EGG_TO_TYPE":{get:()=>DRAGON_EGG_TO_TYPE},
  "DRAGON_PERCH_SLOTS_C":{get:()=>DRAGON_PERCH_SLOTS_C},
  "DRAGON_TYPES":{get:()=>DRAGON_TYPES},
  "DRAGON_TYPES_LIST":{get:()=>DRAGON_TYPES_LIST},
  "dragonBreathe":{get:()=>dragonBreathe},
  "dragonHappiness":{get:()=>dragonHappiness},
  "dragonNames":{get:()=>COMPANIONS.dragonNames,set:value=>{COMPANIONS.dragonNames=value;}},
  "dragonRoostSig":{get:()=>COMPANIONS.dragonRoostSig,set:value=>{COMPANIONS.dragonRoostSig=value;}},
  "dragonType":{get:()=>dragonType},
  "dragonUnlocks":{get:()=>COMPANIONS.dragonUnlocks,set:value=>{COMPANIONS.dragonUnlocks=value;}},
  "dungeonRestartRecovery":{get:()=>dungeonRestartRecovery,set:value=>{dungeonRestartRecovery=value;}},
  "e2eJourneyResult":{get:()=>e2eJourneyResult,set:value=>{e2eJourneyResult=value;}},
  "FAMILIAR_BY_SIGIL":{get:()=>FAMILIAR_BY_SIGIL},
  "FAMILIARS":{get:()=>FAMILIARS},
  "familiarUnlocks":{get:()=>COMPANIONS.familiarUnlocks,set:value=>{COMPANIONS.familiarUnlocks=value;}},
  "feedMountedDragon":{get:()=>feedMountedDragon},
  "feedNestDragon":{get:()=>feedNestDragon},
  "firstDragonEggSlot":{get:()=>firstDragonEggSlot},
  "forwardFacingYaw":{get:()=>forwardFacingYaw},
  "hatchDragonEgg":{get:()=>hatchDragonEgg},
  "hideSmartSuggestion":{get:()=>hideSmartSuggestion},
  "localDisplayName":{get:()=>localDisplayName},
  "localMountObj":{get:()=>COMPANIONS.localMountObj,set:value=>{COMPANIONS.localMountObj=value;}},
  "markCutsceneSeen":{get:()=>markCutsceneSeen},
  "markSmartSuggestionDone":{get:()=>markSmartSuggestionDone},
  "meditationOwnedAppearance":{get:()=>meditationOwnedAppearance,set:value=>{meditationOwnedAppearance=value;}},
  "mounted":{get:()=>COMPANIONS.mounted,set:value=>{COMPANIONS.mounted=value;}},
  "mountEye":{get:()=>mountEye},
  "mountKind":{get:()=>COMPANIONS.mountKind,set:value=>{COMPANIONS.mountKind=value;}},
  "myTeamId":{get:()=>myTeamId},
  "NET":{get:()=>NET},
  "netConnect":{get:()=>netConnect},
  "netFlushPending":{get:()=>netFlushPending},
  "netMirrorGate":{get:()=>netMirrorGate},
  "netMobTick":{get:()=>netMobTick},
  "netSendEdit":{get:()=>netSendEdit},
  "netSnapshot":{get:()=>netSnapshot},
  "netTick":{get:()=>netTick},
  "NETWORK":{get:()=>NETWORK},
  "ONBOARD":{get:()=>ONBOARD},
  "openChat":{get:()=>openChat},
  "openTeamUI":{get:()=>openTeamUI},
  "perchedDragons":{get:()=>perchedDragons},
  "perchKeysAt":{get:()=>perchKeysAt},
  "perchMyDragon":{get:()=>perchMyDragon},
  "poseMeditationDummy":{get:()=>poseMeditationDummy},
  "queueGateUnlockCutscene":{get:()=>queueGateUnlockCutscene},
  "recallNestDragon":{get:()=>recallNestDragon},
  "refreshAppearanceDummy":{get:()=>refreshAppearanceDummy},
  "runLevel2CutsceneThenTutorial":{get:()=>runLevel2CutsceneThenTutorial},
  "shadowStep":{get:()=>shadowStep},
  "skipCutscene":{get:()=>skipCutscene},
  "spriteForage":{get:()=>spriteForage},
  "spriteForageChance":{get:()=>spriteForageChance},
  "startIntroCutscene":{get:()=>startIntroCutscene},
  "stopAbilityDemo":{get:()=>stopAbilityDemo},
  "tickCutscene":{get:()=>tickCutscene},
  "tickDragonRoost":{get:()=>tickDragonRoost},
  "tickFamiliars":{get:()=>tickFamiliars},
  "tickLocalMount":{get:()=>tickLocalMount},
  "tickPerchedDragons":{get:()=>tickPerchedDragons},
  "tickSmartSuggestions":{get:()=>tickSmartSuggestions},
  "tickWatchfulShade":{get:()=>tickWatchfulShade},
  "toggleAbilityDemo":{get:()=>toggleAbilityDemo},
  "toggleAppearanceDummy":{get:()=>toggleAppearanceDummy},
  "toggleMount":{get:()=>toggleMount},
  "tryStartQueuedGateCutscene":{get:()=>tryStartQueuedGateCutscene},
  "updateAbilityDemo":{get:()=>updateAbilityDemo},
  "updateAppearanceDummy":{get:()=>updateAppearanceDummy},
  "updateFamiliarHUD":{get:()=>updateFamiliarHUD},
};
for(const [bindingName,binding] of Object.entries(legacyNetworkingBindings)){
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,bindingName);
  if(!descriptor||descriptor.configurable)Object.defineProperty(globalThis,bindingName,{...binding,configurable:true});
}
/* Blockcraft networking runtime module. Multiplayer synchronization, remote entities, mounts, familiars, chat, and teams.
 * Loaded sequentially; shares the compatibility scope with combat and sibling UI modules.
 */
// ---------------- multiplayer (colyseus) ----------------
const SESSION=createNetworkSession({
  createController:createNetworkController,
  Client:typeof Colyseus==='undefined'?null:Colyseus.Client,
  endpoint:()=>((location.protocol==='https:'?'wss':'ws')+'://'+location.host),
  sessionStorage,
  attachRoom:(...args)=>netAttachRoom(...args),
  unavailable:()=>{eventLog('Solo mode: no server SDK');setWorldLoadingStatus('Starting solo world...');setTimeout(()=>finishWorldLoading('solo'),900);},
  interrupted:()=>eventLog('Connection interrupted - reconnecting...'),
  reconnectAttempt:n=>setWorldLoadingStatus('Reconnecting to world... attempt '+n),
  restored:()=>eventLog('Connection restored'),
  failure:netConnectionFailed,
  getPlayerName:()=>document.getElementById('playername').value,
  beforeConnect:()=>setWorldLoadingStatus('Connecting to world server...'),
});
const NETWORK=SESSION.controller;
const NET=SESSION.state;
let e2eJourneyResult=null;
let dungeonRestartRecovery=null;
const ONBOARD=createOnboardingUI({
  rewardWin, rewardPanel,
  rankUpWin:document.getElementById('rankupwin'),
  rankUpPanel:document.getElementById('rankuppanel'),
  I, ITEMS, HUB,
  escHTML, rewardLineHTML, countItem, hasAnyArmorItem, toolMaxDur, refreshPlayUi,
  getFocus:()=>progressionFocus,
  getInv:()=>inv,
  releasePointerLock:()=>{ if(document.pointerLockElement===renderer.domElement)document.exitPointerLock(); locked=false; lockFallback=false; },
  restoreLock:()=>{ lockFallback=true; locked=true; },
  clearRewardTimer:()=>clearTimeout(rewardHideTimer),
  sendNet:(type,payload)=>{ if(NET.on&&NET.room)NET.room.send(type,payload); },
});

const netConnect=SESSION.connect;

function netAttachRoom(room,name,client){
    setWorldLoadingStatus('Syncing hunter profile...');
    let staleLocalMobs=0;
    for(let i=mobs.length-1;i>=0;i--) if(!mobs[i].net){ removeMob(i); staleLocalMobs++; }
    eventLog('Connected as '+name);
    room.onMessage('e2eJourneyResult',m=>{e2eJourneyResult=m||null;});
    room.onMessage('dungeonRestartRecovery',m=>{
      dungeonRestartRecovery=m||null;
      if(m&&m.refunded)sysMsg('The server restarted during your Gate. You were returned safely and your entry item was refunded.');
      else sysMsg('The server restarted during your Gate. You were returned safely to the entrance.');
    });
    // These three requests only have handlers on the overworld `blockcraft` room. Colyseus 0.15
    // forcibly disconnects a client that sends a message type with no registered handler (and no
    // wildcard), so sending them to a `dungeon` room (DungeonRoom 2c-i) would silently kick the
    // hunter out mid-attach instead of just warning.
    const isOverworldRoom=room.name==='blockcraft';
    if(isOverworldRoom) room.send('dungeonRecoveryRequest',{});
    if(staleLocalMobs) eventLog('Cleared '+staleLocalMobs+' pre-connection local mob'+(staleLocalMobs===1?'':'s')+'.','[Damage Audit]');

    room.state.listen('tod', v=>{ NET.tod=v; });
    room.onMessage('dayCycleSync', m=>applyDayCycleSync(m));
    if(isOverworldRoom) room.send('dayCycleSyncRequest', {});
    room.state.edits.onAdd((id,key)=>netApplyEdit(key,id));
    room.state.edits.onChange((id,key)=>netApplyEdit(key,id));
    room.state.players.onAdd((p,sid)=>{ if(sid!==room.sessionId) netAddRemote(sid,p); });
    room.state.players.onRemove((p,sid)=>netRemoveRemote(sid));
    room.state.mobs.onAdd((mb,id)=>netAddMob(id,mb));
    room.state.mobs.onRemove((mb,id)=>netRemoveMob(id));

    room.onMessage('trainingReset', ()=>{if(dim==='tutorial')resetTrainingMeadowLocal();});
    room.onMessage('tutorialDimension', m=>{
      if(m&&m.active){
        const matching=(m.kind==='onboarding'&&dim==='tutorial')||(m.kind==='ability'&&dim==='ability');
        if(matching&&m.spaceId) NET.dgn=String(m.spaceId);
      }else if(dim==='tutorial'||dim==='ability'){
        NET.dgn='';
      }
    });
    room.onMessage('profile', m=>netRestoreProfile(m));
    room.onMessage('tutorialProgress', m=>{if(m&&m.ok&&m.tutorials)applyServerTutorials(m.tutorials);});
    room.onMessage('firstPromotionAck', m=>{if(m&&m.ok)ONBOARD.setSeen(true);});
    room.onMessage('rankUp', m=>{
      SFX.level();
      setTimeout(()=>ONBOARD.showRankPromotion(m),80);
    });
    bindProgressionMessages(room,{
      getJobXp:id=>jobXpFor(id||playerJob||'adventurer'),setJobXp:(v,id)=>{jobXpByJob[id||playerJob||'adventurer']=v;jobXp=jobXpFor(playerJob||'adventurer');},setJobXpMap:v=>{for(const id of Object.keys(jobXpByJob))jobXpByJob[id]=Math.max(0,(v&&v[id])|0);jobXp=jobXpFor(playerJob||'adventurer');},setContract:v=>{jobContract=v;},clampContract:clampJobContract,
      jobLevel:jobLevelFromXp,contractReady:jobContractReady,
      onJobLevel:(level,id)=>{const milestone=JOB_SYSTEM.milestoneAt(id,level);SFX.level();sysMsg('<b>'+escHTML((JOBS[id]&&JOBS[id].name)||'Job')+' Level '+level+'</b> reached'+(milestone?'<br><b>'+escHTML(milestone.title)+' unlocked:</b> '+escHTML(milestone.desc):''));},
      onContractReady:()=>{SFX.level();sysMsg('<b>'+escHTML(jobContract.title)+'</b> complete - claim it from Jobs');},
      reconcileArmor:()=>{cursorStack=null;renderCursor();if(uiOpen)renderUI();},
      reject:why=>{sysMsg(why);SFX.error();},
      accept:m=>{
        if(m.type==='armor'){gearInspectSlot=m.id?-2:-1;if(uiOpen)renderUI();}
        if(m.type==='jobContract'&&m.action==='claim'){
          SFX.coin();sysMsg('Contract claimed'+(m.rewardGold?' - <b>+'+m.rewardGold+' gold</b>':'')+(m.rewardXp?', <b>+'+m.rewardXp+' XP</b>':'')+'.');
          for(const milestone of Array.isArray(m.milestones)?m.milestones:[]){SFX.level();sysMsg('<b>'+escHTML((JOBS[m.job]&&JOBS[m.job].name)||'Job')+' Level '+milestone.level+'</b> reached<br><b>'+escHTML(milestone.title)+' unlocked:</b> '+escHTML(milestone.desc));}
          if(m.graduation)setTimeout(()=>ONBOARD.showFieldWorkGraduation(),40);
        }
        if(m.type==='jobContract'&&m.action==='take')clearTownJobGuidance();
        if(m.type==='job'&&m.job)sysMsg('You are now working as a <b>'+escHTML(JOBS[m.job]&&JOBS[m.job].name||m.job)+'</b>.'+(jobContract&&jobContract.job!=='adventurer'&&jobContract.job!==m.job?'<br>Your '+escHTML((JOBS[jobContract.job]&&JOBS[jobContract.job].name)||jobContract.job)+' contract is paused until you switch back.':''));
        if((m.type==='job'||m.type==='jobContract')&&qOpen)openJobsUI(m.job||playerJob);
      },
      refresh:()=>{renderBars();renderStat();refreshHUD();refreshAppearanceDummy();if(qOpen&&qMode==='management')openJobsUI();},
    });
    room.onMessage('jobContractOffers',m=>{
      jobContractOffers=Array.isArray(m&&m.offers)?m.offers.map(clampJobContract).filter(Boolean):[];
      jobContractOffersJob=String(m&&m.job||'');jobContractRefreshAt=Math.max(0,Number(m&&m.refreshAt)||0);
      if(qOpen&&qMode==='management')openJobsUI(jobContractOffersJob==='adventurer'?'':jobContractOffersJob);
    });
    room.onMessage('npcQuest', m=>{
      if(!m)return;
      quest=m.quest||null;
      if(m.completed){SFX.coin();SFX.level();sysMsg('<b>'+escHTML(m.completed.title||'Town quest')+'</b> complete.');}
      else if(m.action==='accept'&&quest){
        SFX.quest();
        sysMsg('<b>'+escHTML(quest.title||'Town quest')+'</b> accepted from '+escHTML(quest.giver)+'.');
        if(Array.isArray(m.grantedItems)&&m.grantedItems.some(item=>item&&item.id===I.WOOD_SWORD)){
          sysMsg('Mara hands you a <b>Wooden Sword</b>. It is already in your inventory.');
          showName('Wooden Sword received');
        }
        maraQuestCue(quest);
      }
      else if(m.action==='abandon')sysMsg('Quest abandoned.');
      else if(m.action==='progress'&&quest&&questDone())sysMsg('<b>'+escHTML(quest.title||'Town quest')+'</b> complete - return to '+escHTML(quest.giver)+'.');
      refreshHUD();if(qOpen)closeQWin();
    });
    room.onMessage('aegisTrialReward', m=>{
      quest=null;SFX.coin();SFX.level();
      const reward=m&&m.reward||{},label=reward.kind||'Aegis Cache';
      sysMsg('<b>Aegis Trial complete</b> - +'+((m&&m.rewardGold)||0)+' gold, +'+((m&&m.rewardXp)||0)+' XP, <b>'+escHTML(label)+'</b>.');
      refreshHUD();if(qOpen)closeQWin();
    });
    room.onMessage('guildHallSync', m=>{
      guildHallState={
        floors:Array.isArray(m&&m.floors)?m.floors:[],fellowships:Array.isArray(m&&m.fellowships)?m.fellowships:[],guild:m&&m.guild||null,
        nextFloor:Math.max(1,(m&&m.nextFloor)|0||1),nextPrice:Math.max(0,(m&&m.nextPrice)|0),maxFloors:Math.max(1,(m&&m.maxFloors)|0||6)
      };
      renderGuildHallFloors();
      if(guildHallOpen) openGuildHallUI();
    });
    room.onMessage('guildCreated',m=>{sysMsg('Guild founded: <b>'+escHTML(m&&m.name||'New Guild')+'</b>. You are its leader.');SFX.level();});
    room.onMessage('guildJoined',m=>{if(m&&m.id)delete pendingGuildInvites[m.id];sysMsg('Joined fellowship: <b>'+escHTML(m&&m.name||'Fellowship')+'</b>.');SFX.level();});
    room.onMessage('guildLeft',m=>{sysMsg((m&&m.kicked)?'You were removed from <b>'+escHTML(m.name||'your fellowship')+'</b>.':(m&&m.disbanded)?'<b>'+escHTML(m&&m.name||'Your fellowship')+'</b> disbanded.':'You left <b>'+escHTML(m&&m.name||'your fellowship')+'</b>.');SFX.uiClose();});
    room.onMessage('guildInvite',m=>{if(m&&m.id)pendingGuildInvites[m.id]=Date.now();sysMsg('<b>'+escHTML(m&&m.from||'An officer')+'</b> invited you to <b>'+escHTML(m&&m.name||'a fellowship')+'</b>. Visit Lyra at the Fellowship Hall to join.');SFX.level();});
    room.onMessage('guildResult',m=>{
      if(!m||!m.ok){sysMsg('Fellowship action failed.');return;}
      if(m.action==='privacy')sysMsg('Fellowship is now <b>'+(m.private?'invite-only':'open')+'</b>.');
      else if(m.action==='invite')sysMsg('Invited <b>'+escHTML(m.target||'hunter')+'</b> to the fellowship.');
      else if(m.action==='kick')sysMsg('Removed <b>'+escHTML(m.target||'hunter')+'</b> from the fellowship.');
      else if(m.action==='role')sysMsg('<b>'+escHTML(m.target||'Hunter')+'</b> is now '+escHTML(m.role||'member')+'.');
      else if(m.action==='roleChanged')sysMsg('Your fellowship role is now <b>'+escHTML(m.role||'member')+'</b>.');
      if(guildHallOpen)openGuildHallUI();
    });
    room.onMessage('guildFloorResult',m=>{
      if(typeof (m&&m.gold)==='number')gold=Math.max(0,m.gold|0);
      sysMsg('<b>'+escHTML(m&&m.name||'Your guild')+'</b> now owns Guild Hall Floor '+((m&&m.floor)|0)+'.');
      SFX.coin();
    });
    room.onMessage('guildReject',m=>{
      const r=m&&m.reason;
       sysMsg(r==='range'?'Speak with <b>Lyra Pennant</b> at the Fellowship Hall.':r==='member'?'You already belong to a fellowship.':r==='name'?'Choose a fellowship name between <b>3 and 20 characters</b>.':r==='taken'?'That fellowship name is already registered.':r==='guild'?'Join or create a fellowship first.':r==='leader'?'Only the <b>fellowship leader</b> may do that.':r==='officer'?'Only a <b>leader or officer</b> may do that.':r==='invite'?'That fellowship is <b>invite-only</b>.':r==='target'?'That hunter is not available for this fellowship action.':r==='leader_self'?'Transfer leadership before changing your own leader role.':r==='owned'?'Your fellowship already owns a hall floor.':r==='full'?'Every Fellowship Hall floor is occupied.':r==='full_members'?'That fellowship is full.':r==='missing'?'That fellowship no longer exists.':r==='gold'?'You need <b>'+((m&&m.price)|0)+' gold</b> for the next floor.':'The Fellowship Hall could not complete that request.');
    });
    room.onMessage('utilityUnlock', m=>{
      const id=String(m&&m.id||''), u=UTILITY_DEFS[id];
      if(!u) return;
      if(!utilityUnlocks.includes(id)) utilityUnlocks.push(id);
      SFX.level();
      sysMsg('Utility unlocked: <b>'+escHTML(u.name)+'</b>'+(m&&m.equipped?' (equipped)':'')+(m&&m.reason?' - '+escHTML(m.reason):''));
      renderUtilitiesUI();
      updateLandMinimap();
      questSystemCheck();
    });
    room.onMessage('utilityLoadout', m=>{
      utilityLoadout=clampUtilityLoadout(m);
      renderUtilitiesUI();
      updateLandMinimap();
    });
    room.onMessage('skyshipSync', m=>applySkyShipSync(m));
    if(isOverworldRoom) room.send('skyshipSyncRequest', {});
    room.onMessage('skyshipBoardResult', ()=>{
      SFX.uiOpen();
      sysMsg('<b>Boarding approved.</b> S-Rank and 1,000 gold verified for the western route.');
    });
    room.onMessage('skyshipBoardReject', m=>{
      const r=m&&m.reason;
      SFX.error();
      sysMsg(r==='rank'?'Boarding requires an <b>S-Rank Hunter</b>':
             r==='gold'?'Boarding requires <b>1,000 gold</b> in your possession':
             r==='away'?'The airship is not currently docked':
             r==='range'?'Stand on the ship gangway to board':'Boarding is unavailable');
    });
    room.onMessage('sleepWait', m=>sysMsg('Waiting for sleepers: <b>'+((m&&m.sleeping)||1)+'/'+((m&&m.needed)||1)+'</b>'));
    room.onMessage('sleepReject', m=>{ SFX.error(); showName(m&&m.reason==='day'?'You can only sleep at night':'You must be beside a bed'); });
    room.onMessage('sleepComplete', ()=>{
      hp=Math.min(maxHp(),hp+8); mp=maxMp(); sp=maxSp(); renderBars();
      sleepEl.style.opacity=0; sleeping=false; showName('Good morning!');
    });
    room.onMessage('enterDungeon', m=>{
      dungeonLobbyState=null;
      if(dungeonLobbyOpen) closeQWin();
      NET.dgn=m.id;
      const shard=(m.shardPlus>0)?{plus:m.shardPlus, name:m.shardName||'', mods:(m.shardMods||'').split(',').filter(Boolean)}:null;
      beginDungeon(m.rank, m.seed, m.edits, {back:{x:m.bx,y:m.by,z:m.bz}, shard, localMobs:false, cleared:m.cleared, kind:m.kind||'public'});
    });
    room.onMessage('shardAttuneResult', m=>{
      const i=Math.max(0, Math.min(35, m.slot|0));
      const s=inv[i]; if(s){ s.count--; if(s.count<=0) inv[i]=null; }
      refreshHUD();
      sysMsg('A <b>'+(m.name||'')+' +'+m.plus+'</b> sharded gate tears open — <b>'+(m.mods||[]).join('</b>, <b>')+'</b>');
    });
    room.onMessage('shardAttuneReject', m=>{
      const r=(m&&m.reason)||'invalid';
      sysMsg(r==='space'?'No room for a gate here — move to open ground':
             r==='item'?'You have no shard in that slot':'Could not attune that shard');
    });
    room.onMessage('dungeonStatus', m=>applyDungeonStatus(m));
    room.onMessage('dungeonPing', m=>{if(globalThis.applyDungeonPing)globalThis.applyDungeonPing(m);});
    room.onMessage('dungeonLobby', m=>{
      dungeonLobbyState=m;
      openDungeonLobbyUI();
    });
    room.onMessage('dungeonMatchmaking', m=>{
      dungeonMatchmakingState=m&&Array.isArray(m.listings)?m:{listings:[]};
      if(dungeonLobbyOpen&&dungeonLobbyState)openDungeonLobbyUI();
    });
    room.onMessage('dungeonLobbyStart', m=>{
      if(dungeonLobbyOpen) closeQWin();
      dungeonLobbyState=null;
      sysMsg('The party is ready. <b>The Gate opens.</b>');
      // Flag-on members get the gate descriptor (mode:'room') and switch into the dedicated
      // DungeonRoom; flag-off members instead receive a follow-up 'enterDungeon' (legacy in-room)
      // and just close the lobby here.
      if(m && m.mode==='room' && globalThis.enterDungeonRoomWith) globalThis.enterDungeonRoomWith(m);
    });
    room.onMessage('dungeonLobbyClosed', m=>{
      const r=m&&m.reason;
      dungeonLobbyState=null;
      if(dungeonLobbyOpen) closeQWin();
      if(r==='gone') sysMsg('That <b>Gate</b> closed before the party entered.');
      else if(r==='range') sysMsg('You drifted too far from the <b>Gate Lobby</b>.');
      else if(r==='left') sysMsg('You left the <b>Gate Lobby</b>.');
    });
    room.onMessage('gateReject', m=>gateRejected(m));
    room.onMessage('dedit', m=>{ if(dim==='dungeon') netWriteEdit(m.x, m.y, m.z, m.id); });
    room.onMessage('gateCleared', m=>{ if(dungeon){ dungeon.cleared=true; questGate(m&&m.rank==null?dungeon.rank:m.rank); } });
    room.onMessage('dungeonDeath', m=>{
      if(dim==='dungeon') exitDungeon(true);
      if(m&&Number.isFinite(m.x)&&Number.isFinite(m.y)&&Number.isFinite(m.z))player.pos.set(m.x,m.y,m.z);
      hp=maxHp(); sp=maxSp(); hunger=maxHunger(); renderBars();
      showDeathScreen('The dungeon overwhelmed you','The attempt has failed — returning to the gate');
    });
    room.onMessage('worldDeath',m=>{
      showDeathScreen(deathCauseText('server:'+((m&&m.cause)||'combat')),'Returning to the Town of Beginnings');
    });
    room.onMessage('dungeonFailed', m=>{
      if(dim==='dungeon') exitDungeon(true);
      if(m&&Number.isFinite(m.x)&&Number.isFinite(m.y)&&Number.isFinite(m.z))player.pos.set(m.x,m.y,m.z);
      hp=maxHp(); sp=maxSp(); hunger=maxHunger(); renderBars();
      sysMsg((m&&m.reason)==='solo' ? 'The solo dungeon collapses.' : 'The party wiped. The dungeon collapses.');
    });
    room.onMessage('loot', m=>{
      gainXP(m.xp||0);
      if(m.gold) addGold(m.gold);
      if(m.coal) addItem(I.COAL, m.coal);
      if(m.iron) addItem(I.IRON_INGOT, m.iron);
      if(m.dia)  addItem(I.DIAMOND, m.dia);
      let keyCount=0;
      if(Array.isArray(m.items)) for(const it of m.items) if(ITEMS[it.id]){
        const received=receiveRewardItem(it);if(received)GEAR_REWARDS.present(received);
        if(SOLO_KEY_IDS.includes(it.id)||TEAM_KEY_IDS.includes(it.id)) keyCount+=it.count||1;
      }
      showDungeonReward(m, true);
      sysMsg('<b>Boss defeated!</b> Party loot acquired'+(m.dia?' (diamonds!)':'')+(keyCount?' + key':''));
    });
    room.onMessage('lootReject', m=>{
      showDungeonReward(m||{}, false);
      sysMsg('No boss loot: '+escHTML(rewardReasonText(m&&m.reason)));
    });
    room.onMessage('firstQuestReward', m=>applyFirstQuestRewardResult(m));
    room.onMessage('grant', m=>{
      if(m.xp) gainXP(m.xp);
      if(Array.isArray(m.items)) for(const it of m.items) if(ITEMS[it.id]){
        const received=receiveRewardItem(it);if(received)GEAR_REWARDS.present(received);
      }
      if(m.source==='mob'){
        gainJobXP('adventurer', 3, 'hunt');
        jobContractProgress('kill', 1, 0);
      } else if(m.source==='hunt'){
        gainJobXP('adventurer', 2, 'hunt');
        jobContractProgress('kill', 1, 0);
      } else if(m.source==='event'){
        gainJobXP('adventurer', 12, 'event');
        jobContractProgress('event', 1, 0);
      }
      if(m.source==='hunt'){
        const meat=(m.items||[]).find(it=>it&&it.id===I.MONSTER_MEAT);
        if(meat){
          sysMsg('Hunted food acquired: <b>Monster Meat x'+(meat.count||1)+'</b>','minor');
          if(quest && quest.type==='sell' && quest.item===I.MONSTER_MEAT && !questDone()) showName('Now sell the Monster Meat to Greta');
        }
      } else if(m.source==='event'){
        sysMsg('<b>'+escHTML(m.event||'Event')+'</b> reward acquired'+(m.xp?' - <b>+'+(m.xp|0)+' Hunter XP</b>':''));
      } else if(m.source==='mob'&&m.elite){
        sysMsg('<b>Elite defeated!</b> Ring '+((m.dangerRing|0)+1)+' treasure acquired');
      }
    });
    room.onMessage('biomeFind', m=>{
      if(m&&m.name) sysMsg('Regional discovery: <b>'+escHTML(m.name)+(m.count>1?' x'+(m.count|0):'')+'</b>');
    });
    room.onMessage('discoveryResult',m=>{
      if(!m)return;sysMsg('<b>'+escHTML(m.name||'Discovery')+':</b> '+escHTML(m.text||'Reward acquired'));
    });
    room.onMessage('discoverySighted',m=>{
      if(!m||!m.id)return;const fresh=!discoveredIds.has(m.id);discoveredIds.add(m.id);updateLandMinimap();
      if(fresh)sysMsg((m.shared?'Team mapped':'Mapped')+': <b>'+escHTML(String(m.name||'new discovery').replace(/_/g,' '))+'</b>'+(m.shared&&m.by?' via '+escHTML(m.by):''));
    });
    room.onMessage('discoveryReject',m=>{
      const r=m&&m.reason;sysMsg(r==='pattern'?escHTML(m.hint||'The pattern does not respond.'):r==='claimed'?'You have already claimed this discovery.':r==='cooldown'?'The fishing pool needs time to replenish.':'Nothing happens.');
    });
    room.onMessage('banditCampState',m=>{
      if(!m)return;
      if(m.phase==='captain')sysMsg('<b>Bandit Captain!</b> The camp leader has entered the fight.');
      else if(m.phase==='cleared'){discoveredIds.add(m.id);updateLandMinimap();sysMsg('<b>Bandit Camp Cleared!</b> The camp chest is unlocked for a short time.');}
    });
    room.onMessage('banditPatrolSighted',m=>{if(m)sysMsg('<b>Bandit tracks:</b> '+escHTML(m.text||'A patrol has passed nearby.'));});
    room.onMessage('banditCaravanRescued',()=>sysMsg('<b>Caravan rescued!</b> The road merchant rewards your intervention.'));
    room.onMessage('banditSpared',()=>sysMsg('<b>Bandit spared.</b> They surrender their stolen supplies and flee.'));
    room.onMessage('caravanState',m=>{
      if(!m)return;
      if(m.state==='departed')sysMsg('A merchant caravan has departed along the regional road.');
      else if(m.state==='arrived')sysMsg('<b>Escort complete!</b> Road merchants offer you 20% off for ten minutes.');
      else if(m.state==='wrecked')sysMsg('<b>Caravan lost.</b> Bandits carried its supplies toward a nearby camp.');
      else if(m.state==='recovered')sysMsg('<b>Stolen caravan supplies recovered!</b>');
    });
    room.onMessage('roadsideEncounter',m=>{
      if(!m)return;
      const names={wounded_hunter:'Wounded hunter',merchant_rescue:'Merchant rescue',pursuit:'Stolen supply pursuit'},name=names[m.type]||'Roadside encounter';
      if(m.state==='started')sysMsg('<b>'+name+':</b> a nearby road needs your help.');
      else if(m.state==='failed')sysMsg('<b>'+name+' failed.</b> '+(m.reason==='merchant'?'The merchant was overwhelmed.':m.reason==='night'?'The trail went cold after dark.':'The bandits escaped with the supplies.'));
    });
    room.onMessage('roadsideEncounterResult',m=>{
      if(!m)return;
      const text=m.type==='wounded_hunter'?'The hunter is stable and shares supplies in thanks.':m.type==='merchant_rescue'?'The merchant is safe.':'The stolen supplies are secured.';
      sysMsg('<b>Roadside encounter complete!</b> '+text);
    });
    room.onMessage('roadsideEncounterReject',()=>sysMsg('Move closer and aim at the wounded hunter to provide aid.'));
    room.onMessage('overworldActivity',m=>{overworldActivity=m||null;if(m&&m.roadSafety){roadSafety=Math.max(0,Math.min(100,m.roadSafety.score|0));refreshRoadSafetyScenes();}updateLandMinimap();});
    room.onMessage('roadSafetyChanged',m=>{
      if(!m)return;roadSafety=Math.max(0,Math.min(100,m.score|0));
      refreshRoadSafetyScenes();
      const direction=(m.delta|0)>0?'improved':'worsened';sysMsg('Regional road safety <b>'+direction+'</b> · '+roadSafety+'/100 · '+escHTML(String(m.tier||'contested').toUpperCase()));
      renderRegionalContractsUI();
    });
    room.onMessage('regionalContracts',m=>{
      regionalContractOffers=Array.isArray(m&&m.offers)?m.offers.map(clampRegionalContract).filter(Boolean):[];
      regionalContract=clampRegionalContract(m&&m.active);
      renderRegionalContractsUI();
    });
    room.onMessage('regionalContractUpdate',m=>{
      regionalContract=clampRegionalContract(m&&m.active);
      renderRegionalContractsUI();
      if(regionalContract) sysMsg('Guild contract: <b>'+escHTML(regionalContract.title)+'</b> '+regionalContract.have+'/'+regionalContract.need);
    });
    room.onMessage('regionalContractReady',m=>{
      const c=clampRegionalContract(m&&m.active);
      if(c){ regionalContract=c; renderRegionalContractsUI(); sysMsg('Guild contract complete: <b>'+escHTML(c.title)+'</b> - claim it at the Job Board'); }
    });
    room.onMessage('regionalContractClaimed',m=>{
      const c=clampRegionalContract(m&&m.contract);
      if(m&&m.rewardXp) gainXP(m.rewardXp|0);
      if(m&&m.rewardGold) addGold(m.rewardGold|0);
      if(Array.isArray(m&&m.rewardItems)) for(const it of m.rewardItems) if(ITEMS[it.id]) addItem(it.id,it.count||1);
      if(typeof (m&&m.roadWardenRep)==='number') roadWardenRep=Math.max(0,m.roadWardenRep|0);
      regionalContract=null;
      renderRegionalContractsUI();
      sysMsg((c&&String(c.type||'').startsWith('road_')?'Road Warden':'Guild')+' contract claimed'+(c?': <b>'+escHTML(c.title)+'</b>':'')+' - <b>+'+((m&&m.rewardGold)|0)+' gold</b>');
      if(m&&m.roadWardenMilestone)sysMsg('<b>Road Warden milestone · '+escHTML(m.roadWardenMilestone.name)+'</b> — '+escHTML(m.roadWardenMilestone.reward||''));
    });
    room.onMessage('regionalContractReject',m=>{
      const r=m&&m.reason;
      sysMsg(r==='range'?'Use the <b>Job Board</b> to manage guild contracts.':r==='active'?'Finish, claim, or abandon your active guild contract first.':r==='expired'?'That guild contract has rotated out. Refresh the board.':r==='incomplete'?'That guild contract is not complete yet.':'Guild contract unavailable.');
    });
    room.onMessage('craftLegendaryResult', m=>applyLegendaryCraftResult(m));
    room.onMessage('craftLegendaryReject', m=>legendaryCraftRejected(m));
    room.onMessage('eventStatus', m=>applyEventStatus(m));
    room.onMessage('eventJoined', m=>{ applyEventStatus(m); sysMsg('Joined the <b>'+escHTML(m&&m.name||'server')+'</b> event queue. Watch the countdown banner.'); });
    room.onMessage('eventLeft', m=>{ applyEventStatus(m); sysMsg('Left the event queue. You can rejoin while the countdown is still open.'); });
    room.onMessage('eventReject', m=>eventRejected(m));
    room.onMessage('eventStarted', m=>applyEventStatus(m));
    room.onMessage('eventGo', m=>eventGo(m));
    room.onMessage('eventReady', m=>applyEventStatus(m));
    room.onMessage('eventAfk', m=>eventAfk(m));
    room.onMessage('eventCancelled', m=>eventCancelled(m));
    room.onMessage('eventTeleport', m=>applyEventTeleport(m));
    room.onMessage('eventComplete', m=>eventCompleted(m));
    room.onMessage('eventFailed', m=>eventFailed(m));
    room.onMessage('eventResult', m=>showEventResult(m));
    room.onMessage('eventCheckpoint', m=>parkourCheckpointReached(m));
    room.onMessage('eventCaravanWave', m=>caravanWaveChanged(m));
    room.onMessage('eventCaravanDowned', m=>caravanHunterDowned(m));
    room.onMessage('eventCaravanRevived', m=>caravanHunterRevived(m));
    room.onMessage('pvpBountyAssigned', m=>acceptAegisBounty(m));
    room.onMessage('pvpBountyComplete', m=>completeAegisBounty(m));
    room.onMessage('pvpBountyFail', m=>failAegisBounty(m&&m.reason));
    room.onMessage('pvpBountyReject', m=>{
      const r=m&&m.reason;
      if(r==='target') sysMsg('No valid Aegis bounty target is available.');
      else if(r==='town') sysMsg('Aegis bounty combat cannot be done inside town.');
      else if(r==='range') showName('Too far from bounty target');
      else if(r==='none') sysMsg('No active Aegis bounty.');
      else sysMsg('Aegis bounty strike failed.');
    });
    room.onMessage('pvpBountySlain', ()=>sysMsg('You were slain by an <b>Aegis bounty</b>.'));
    room.onMessage('eventCrown', m=>{
      if(!m) return;
      kingCrownChanged(m);
    });
    room.onMessage('mineNoDrop', ()=>sysMsg('Your tool is too weak to harvest that block'));
    room.onMessage('toolSync', m=>applyToolSync(m));
    room.onMessage('armorSync',m=>{
      equipmentModel.restore(m&&m.armor);
      const stack=m&&m.armor,item=stack&&ITEMS[stack.id];
      const profile=item&&item.armor?GEAR_SYSTEM.armorProfile(item.armor,stack):null;
      COMBAT_FEEDBACK.syncArmor(profile?{...stack,maxDur:profile.maxDur}:null,!!(m&&m.broke));
      refreshHUD();if(uiOpen)renderUI();
    });
    room.onMessage('weaponEquipResult',m=>{
      if(m&&m.ok){combatState.selectedSlot=Math.max(0,Math.min(8,m.slot|0));gearInspectSlot=combatState.selectedSlot;refreshHUD();if(uiOpen)renderUI();}
    });
    room.onMessage('repairResult', m=>applyRepairResult(m));
    room.onMessage('repairReject', m=>repairRejected(m));
    room.onMessage('blacksmithRepairResult', m=>applyBlacksmithRepairResult(m));
    room.onMessage('blacksmithUpgradeResult', m=>applyBlacksmithUpgradeResult(m));
    room.onMessage('blacksmithReforgeResult', m=>applyBlacksmithReforgeResult(m));
    room.onMessage('blacksmithSalvageResult',m=>applyBlacksmithSalvageResult(m));
    room.onMessage('lootRecoveryState',m=>{
      applyLootRecoveryState(m);
      if(m&&m.queued){
        const stack=rewardGearStack(m.queued);
        if(stack)GEAR_REWARDS.present({stack,slot:-1,recovered:true,baseline:ITEMS[stack.id].armor?armorSlot:(()=>{
          const selected=inv[combatState.selectedSlot],selectedItem=selected&&ITEMS[selected.id];
          return selectedItem&&selectedItem.tool&&['sword','axe'].includes(selectedItem.tool.cls)?selected:null;
        })()});
      }
    });
    room.onMessage('lootRecoveryResult',m=>applyLootRecoveryResult(m));
    room.onMessage('gearLockResult',m=>applyGearLockResult(m));
    room.onMessage('blacksmithReject', m=>blacksmithServiceRejected(m));
    room.onMessage('hatchDragonReject', m=>dragonHatchRejected(m));
    room.onMessage('dragonIncubationStart', m=>applyDragonIncubationStart(m));
    room.onMessage('dragonIncubationReady', m=>applyDragonIncubationReady(m));
    room.onMessage('dragonIncubationRemove', m=>{ if(m) removeDragonIncubationMesh(m.x|0,m.y|0,m.z|0); });
    room.onMessage('dragonIncubationComplete', m=>applyDragonIncubationComplete(m));
    room.onMessage('dragonRenameResult', m=>applyDragonRenameResult(m));
    room.onMessage('dragonRenameReject', m=>dragonRenameRejected(m));
    room.onMessage('dragonPerchAdd', m=>{ if(m) addPerchedDragon(m.key, m.x|0, m.y|0, m.z|0, m.slot|0, m.type, m.loveUntil||0); });
    room.onMessage('dragonPerchRemove', m=>{ if(m) removePerchedDragon(m.key); });
    room.onMessage('dragonPerchLove', m=>{ const e=m&&perchedDragons[m.key]; if(e){ e.loveUntil=m.loveUntil||0; sysMsg('The <b>'+(DRAGON_TYPES[e.type]||{}).name+'</b> is smitten ❤'); } });
    room.onMessage('dragonPerchBreed', m=>{ if(m) dragonBreedFx(m.x|0, m.y|0, m.z|0, m.offspring); });
    room.onMessage('perchReject', m=>perchRejected(m));
    room.onMessage('familiarBound', m=>{ const kind=(m&&m.kind)||'shade'; const sig=FAMILIARS[kind]&&FAMILIARS[kind].sigil; const i=inv.findIndex(s=>s&&s.id===sig); if(i>=0){ const s=inv[i]; s.count--; if(s.count<=0) inv[i]=null; refreshHUD(); if(uiOpen) renderUI(); } familiarBoundLocal(kind); });
    room.onMessage('familiarReject', m=>{ const r=m&&m.reason; sysMsg(r==='owned'?'Shade is already bound to you':r==='item'?'You need a <b>Shadow Sigil</b>':'Shade will not answer that call'); });
    room.onMessage('blackholeReject', m=>{
      blackholeCd=0;
      const r=(m&&m.reason)||'invalid';
      if(r==='cooldown') sysMsg('Blackhole Staff is still recharging');
      else if(r==='range') sysMsg('Target is too far for <b>Blackhole Staff</b>');
      else if(r==='staff') sysMsg('Select the <b>Blackhole Staff</b> to cast');
      else sysMsg('Blackhole Staff has no valid target');
    });
    room.onMessage('legendaryReject', m=>{
      const kind=(m&&m.kind)||'weapon';
      legendaryWeaponCd[kind]=0;
      const r=(m&&m.reason)||'invalid';
      if(r==='cooldown') sysMsg('Legendary weapon is still recharging');
      else if(r==='range') sysMsg('Target is too far for that <b>legendary weapon</b>');
      else if(r==='weapon') sysMsg('Select the matching <b>legendary weapon</b> first');
      else sysMsg('Legendary weapon failed');
    });
    room.onMessage('abilitySync', m=>applyAbilitySync(m));
    room.onMessage('devMana', m=>{
      if(typeof m.int==='number') S.int=Math.max(S.int|0, m.int|0);   // raise client INT so maxMp/cast checks allow it
      if(typeof m.mp==='number') mp=Math.min(maxMp(), m.mp);
      renderBars(); refreshHUD(); renderAbilities();
      sysMsg('Mana set to <b>'+Math.round(maxMp())+'</b> for testing');
    });
    room.onMessage('abilityReject', m=>abilityRejected(m));
    room.onMessage('abilityResult', m=>abilityResolved(m));
    room.onMessage('dragonAbilityReject', m=>dragonAbilityRejected(m));
    room.onMessage('dragonAbilityResult', m=>dragonAbilityResolved(m));
    room.onMessage('dragonCare', m=>applyDragonCare(m));
    room.onMessage('feedDragonResult', m=>applyFeedDragonResult(m));
    room.onMessage('feedDragonReject', m=>feedDragonRejected(m));
    room.onMessage('editReject', m=>netEditReject(m));
    room.onMessage('craftResult', m=>applyServerCraft(m));
    room.onMessage('craftReject', m=>{ SFX.error(); sysMsg(m&&m.reason==='profession'?'Equip <b>'+((JOBS[m.job]&&JOBS[m.job].name)||'Cook')+'</b> and reach Lv '+(m.level||1)+' for that recipe':'Crafting failed: missing server-side ingredients'); });
    room.onMessage('shopResult', m=>applyShopResult(m));
    room.onMessage('shopReject', m=>shopRejected(m));
    room.onMessage('landClaims', m=>applyLandClaims(m));
    room.onMessage('landClaimUpdate', m=>applyLandClaimUpdate(m));
    room.onMessage('landClaimResult', m=>applyLandClaimResult(m));
    room.onMessage('landClaimReject', m=>landClaimRejected(m));
    room.onMessage('farmResult', m=>applyFarmResult(m));
    room.onMessage('farmReject', m=>farmRejected(m));
    room.onMessage('foodResult', m=>applyFoodResult(m));
    room.onMessage('foodBuff', m=>{
      const secs=Math.max(1,Math.round(((m&&m.durationMs)||0)/1000));buffs.dmg=Math.max(buffs.dmg,secs);buffs.gather=Math.max(buffs.gather||0,secs);
      if(typeof m.hp==='number')hp=Math.min(maxHp(),Math.max(0,m.hp));if(typeof m.hunger==='number')hunger=Math.min(maxHunger(),Math.max(0,m.hunger));renderBars();
      SFX.success();sysMsg('<b>'+escHTML((m&&m.by)||'Your cook')+'</b> shares a feast. <b>Well Fed</b> boosts combat and gathering for '+Math.ceil(secs/60)+' min.');
    });
    room.onMessage('meditateFocus', m=>{
      const secs=Math.max(1,Math.round(((m&&m.durationMs)||0)/1000));
      if(m&&m.regen)buffs.regen=Math.max(buffs.regen,secs);if(m&&m.speed)buffs.spd=Math.max(buffs.spd,secs);if(m&&m.stone)buffs.stone=Math.max(buffs.stone,secs);
      showJobPerk('monk',m&&m.shared?'shared focus':'shrine focus');
      if(m&&m.shared)sysMsg('<b>'+escHTML(m.by||'A monk')+'</b> shares tranquillity: '+[m.regen?'Restoration':'',m.speed?'Flow':'',m.stone?'Stone':''].filter(Boolean).join(', ')+' for '+secs+' sec.');
    });
    room.onMessage('prospectResult',m=>showProspectMarkers(m));
    room.onMessage('prospectReject',m=>{
      const reason=m&&m.reason;
      if(reason==='profession')sysMsg('Equip <b>Miner</b> to survey for ore.');
      else if(reason==='level')sysMsg('Ore Sense unlocks at <b>Miner Lv '+(m.level||2)+'</b>.');
      else if(reason==='cooldown')sysMsg('Ore Sense recharges in <b>'+Math.max(1,Math.ceil((m.remainingMs||0)/1000))+' sec</b>.');
      else sysMsg('The ore survey could not begin.');
    });
    room.onMessage('foodReject', m=>foodRejected(m));
    room.onMessage('hunger', m=>{
      if(tutorialSafe()){ hunger=maxHunger(); renderBars(); return; }
      if(m&&typeof m.hunger==='number'){ hunger=Math.max(0,Math.min(maxHunger(),m.hunger)); renderBars(); }
    });
    room.onMessage('gateKeyResult', m=>applyGateKeyResult(m));
    room.onMessage('gateKeyReject', m=>gateKeyRejected(m));
    room.onMessage('chestState', m=>applyChestState(m));
    room.onMessage('chestTx', m=>applyChestTx(m));
    room.onMessage('chestReject', ()=>{ SFX.error(); sysMsg('Chest transaction failed'); });
    room.onMessage('furnaceState', m=>applyFurnaceState(m));
    room.onMessage('furnaceStarted', m=>applyFurnaceStarted(m));
    room.onMessage('furnaceResult', m=>applyFurnaceResult(m));
    room.onMessage('furnaceReject', ()=>{ SFX.error(); sysMsg('Furnace transaction failed'); });
    room.onMessage('fx', m=>netFx(m));
    room.onMessage('dmgnum', m=>spawnDamageNumber(m));
    room.onMessage('weaponIdentity',m=>{
      if(!m)return;
      if(m.kind==='momentum'){
        const bonus=Math.max(0,Math.round(((Number(m.multiplier)||1)-1)*100));
        showName('Momentum '+Math.max(1,m.stacks|0)+'/'+Math.max(1,m.max|0)+(bonus?' · +'+bonus+'% damage':''));
      }else if(m.kind==='stagger')showName(m.boss?'Stagger · boss slowed':'Stagger!');
    });
    room.onMessage('arrow', m=>netSpawnProjectile(m));
    room.onMessage('weather', m=>applyWeather(m));
    room.onMessage('weatherBolt', m=>weatherBoltFx(m));
    room.onMessage('hurt', m=>{
      if(tutorialSafe() && (!m || m.n>=0)){ hp=maxHp(); sp=maxSp(); hunger=maxHunger(); renderBars(); return; }
      if(m&&m.reason==='second_wind'){
        swCd=60;                                   // drive the passive's HUD cooldown
        sysMsg('<b>Second Wind</b> restores your strength');
        healingPlusVfx(player.pos.x, player.pos.y, player.pos.z, 1.05, 1.15);
      }
      if(m&&m.n>0){COMBAT_FEEDBACK.showImpact(m);if(m.armor)COMBAT_FEEDBACK.syncArmor(m.armor);if(/^(flanker|quickshot|brute)(_arrow)?$/.test(m.reason||''))netBiomeHitFx(m.reason);}
      if(m&&m.reason==='mire_poison')biomeStatus.pulseVenom();
      damagePlayer(m.n,'server:'+((m&&m.reason)||'combat'),m);
    });
    room.onMessage('biomeStatus',m=>{biomeStatus.apply(m);netBiomeStatusFx(m);});
    room.onMessage('xp',   m=>gainXP(m.n));
    room.onMessage('chat', m=>{
      if(!gateSystemUnlocked() && (m&&m.name)==='[System]' && /Gate has opened/i.test((m&&m.text)||'')) return;
      chatLine(m.name, m.text);
    });
    room.onMessage('tchat', m=>chatLine('\u2766 '+m.name, m.text));
    room.onMessage('comms',m=>{
      if(!m)return;
      const channel=(globalThis.BlockcraftCommsRules.CHANNELS[m.mode]||globalThis.BlockcraftCommsRules.CHANNELS.local),label=channel.icon+' '+channel.label;
      chatLine(label+' · '+(m.name||'Hunter'),m.text||'',m.mode||'local');SOCIAL.playCommsCue(m.mode||'local');
      if(m.fromSid&&m.fromSid!==room.sessionId)SOCIAL.showChatBubble(m.fromSid,m.text||'',m.mode||'local');
    });
    room.onMessage('commsReject',m=>chatLine('[Comms]',m&&m.reason==='party'?'Join a party before using Party chat.':m&&m.reason==='target'?'That whisper target is no longer online.':m&&m.reason==='muted'?'That player has muted your communications.':m&&m.reason==='duplicate'?'Please avoid repeating the same phrase.':m&&m.reason==='rate'?'Communication cooldown active.':'Only approved quick-chat phrases are allowed.','blocked'));
    room.onMessage('commsMuteResult',m=>SOCIAL.applyMuteResult(m));
    room.onMessage('commsBlockList',m=>SOCIAL.applyBlockList(m));
    room.onMessage('commsReportResult',m=>chatLine('[Safety]',m&&m.ok?'Report submitted for moderator review.':m&&m.reason==='rate'?'You recently reported this player.':'Report could not be submitted.',m&&m.ok?'whisper':'blocked'));
    room.onMessage('teamInvite', m=>{
      if(m&&m.id) pendingTeamInvites[m.id]=Date.now();
      sysMsg('<b>'+escHTML(m&&m.from||'A team leader')+'</b> invited you to <b>'+escHTML(m&&m.name||'a team')+'</b>. Open Teams (T) to join.');
      chatLine('[Team]', 'Invite received: /team join '+((m&&m.id)||'team'));
      SFX.level();
    });
    room.onMessage('teamLeft', m=>{
      sysMsg((m&&m.kicked)?'You were removed from <b>'+escHTML(m.name||'your team')+'</b>.':(m&&m.disbanded)?'<b>'+escHTML(m.name||'Your team')+'</b> disbanded.':'You left <b>'+escHTML(m&&m.name||'your team')+'</b>.');
      if(qOpen) openTeamUI();
    });
    room.onMessage('teamResult', m=>{
      if(!m||!m.ok){
        const r=m&&m.reason;
        sysMsg(r==='leader'?'Only the <b>team leader</b> can do that.':
               r==='full'?'That team is already <b>full</b>.':
               r==='target'?'Could not find that online hunter.':
               r==='member'?'That hunter is already on your team.':
               r==='leader_self'?'Transfer leadership before removing yourself.':
               'Team action failed.');
        return;
      }
      if(m.action==='invite') sysMsg('Invited <b>'+escHTML(m.target||'hunter')+'</b> to the team.');
      else if(m.action==='privacy') sysMsg('Team is now <b>'+(m.private?'invite-only':'open')+'</b>.');
      else if(m.action==='lfg') sysMsg(m.lfg?'Team marked <b>looking for dungeon</b>.':'Team dungeon status cleared.');
      else if(m.action==='transfer') sysMsg('Team leadership transferred.');
      else if(m.action==='leader') sysMsg('You now lead <b>'+escHTML(m.name||'your team')+'</b>.');
      if(qOpen) openTeamUI();
    });
    if(onboardingActive){
      resetTrainingMeadowLocal();
      room.send('tutorialEnter',{kind:'onboarding'});
    }else if(abilityTrainingActive&&dim==='ability'){
      room.send('tutorialEnter',{kind:'ability'});
    }
}

function netConnectionFailed(err){
  NET.tried=false;NET.on=false;locked=false;lockFallback=false;
  loadscreen.classList.add('hidden');overlay.classList.remove('hidden');
  const authError=err&&/auth/i.test(String(err.message||err));
  setAuthStatus(authError?'SESSION EXPIRED - SIGN IN AGAIN':'COULD NOT JOIN THE SERVER','bad');
  if(authError)AUTH_UI.expire();
  eventLog('Server connection failed');
}

// ---- persistence: restore on join, snapshot on a timer ----
function netRestoreProfile(m){
  try{
    applyServerTutorials(m&&m.tutorials);
    if(!onboardingDone()){
      if(!onboardingActive) beginOnboarding();
      eventLog('Tutorial active - saved profile ignored until training is complete');
      finishWorldLoading('tutorial');
      return;
    }
    if(onboardingActive) cancelOnboardingForProfileRestore();
    if(m.S){
      S.lvl=m.S.lvl||1; S.xp=m.S.xp||0; S.pts=m.S.pts||0;
      S.str=m.S.str||1; S.agi=m.S.agi||1; S.vit=m.S.vit||1; S.int=m.S.int||1;
      S.path=['shadow','mage','guardian'].includes(m.S.path)?m.S.path:'';
    }
    if(Array.isArray(m.inv)){
      for(let i=0;i<36;i++){
        const s=m.inv[i];
        if(s && ITEMS[s.id]){
          inv[i]={id:s.id, count:Math.max(1,Math.min(64,s.count|0))};
          if(ITEMS[s.id].tool) inv[i].dur=(s.dur!=null)?s.dur:ITEMS[s.id].tool.dur;
          if(ITEMS[s.id].armor)inv[i].dur=(s.dur!=null)?s.dur:armorMaxDur(inv[i]);
          if((ITEMS[s.id].tool||ITEMS[s.id].armor) && s.plus) inv[i].plus=Math.max(0,Math.min(3,s.plus|0));
          if((ITEMS[s.id].tool||ITEMS[s.id].armor)&&GEAR_SYSTEM.RANKS.some((r,j)=>j<6&&r.id===s.gearRank))inv[i].gearRank=s.gearRank;
          if(ITEMS[s.id].armor&&GEAR_SYSTEM.ARMOR_ARCHETYPES[s.armorType])inv[i].armorType=s.armorType;
          if((ITEMS[s.id].tool||ITEMS[s.id].armor)&&GEAR_SYSTEM.RARITIES.some(r=>r.id===s.rarity))inv[i].rarity=s.rarity;
          if(ITEMS[s.id].tool&&JOB_SYSTEM.reforgeModifier(s.forge))inv[i].forge=s.forge;
          if(ITEMS[s.id].tool&&s.masterwork&&inv[i].forge)inv[i].masterwork=true;
          if((ITEMS[s.id].tool||ITEMS[s.id].armor)&&s.locked)inv[i].locked=true;
          if((ITEMS[s.id].tool||ITEMS[s.id].armor)&&typeof s.source==='string'&&s.source)inv[i].source=s.source;
        } else inv[i]=null;
      }
    }
    equipmentModel.restore(m.armor);
    applyLootRecoveryState(m&&m.lootRecovery||[],true);
    COMPANIONS.dragonUnlocks=[];
    if(Array.isArray(m.mountUnlocks)) for(const k of m.mountUnlocks){
      const t = k==='dragon' ? 'ember' : (typeof k==='string' && k.slice(0,7)==='dragon:') ? k.slice(7) : '';
      if(DRAGON_TYPES[t] && !COMPANIONS.dragonUnlocks.includes(t)) COMPANIONS.dragonUnlocks.push(t);
    }
    COMPANIONS.familiarUnlocks = Array.isArray(m.familiarUnlocks) ? m.familiarUnlocks.filter(k=>['shade','fang','mote','sprite'].includes(k)) : [];
    COMPANIONS.activeFamiliar='';   // summon state isn't persisted; recall with K
    COMPANIONS.dragonCare={};
    if(m.dragonCare && typeof m.dragonCare==='object'){
      for(const t in m.dragonCare) if(DRAGON_TYPES[t]){
        COMPANIONS.dragonCare[t]={happiness:Math.max(0,Math.min(100,(m.dragonCare[t].happiness==null?50:m.dragonCare[t].happiness)|0)), fedAt:m.dragonCare[t].fedAt||0};
      }
    }
    COMPANIONS.dragonNames={};
    if(m.dragonNames && typeof m.dragonNames==='object'){
      for(const t in m.dragonNames) if(DRAGON_TYPES[t]){
        const n=cleanDragonDisplayName(m.dragonNames[t]);
        if(n) COMPANIONS.dragonNames[t]=n;
      }
    }
    playerJob=m.job&&m.job!=='adventurer'&&JOBS[m.job]?m.job:'';
    for(const id of Object.keys(jobXpByJob))jobXpByJob[id]=Math.max(0,(m.jobXpByJob&&m.jobXpByJob[id])|0);
    if(!m.jobXpByJob)jobXpByJob[playerJob||'adventurer']=Math.max(0,m.jobXp|0);
    jobXp=jobXpFor(playerJob||'adventurer');
    jobContract=clampJobContract(m.jobContract);
    jobContractOffers=Array.isArray(m.jobContractOffers)?m.jobContractOffers.map(clampJobContract).filter(Boolean):[];
    jobContractOffersJob=String(m.jobContractOfferJob||'');
    jobContractRefreshAt=Math.max(0,Number(m.jobContractOffersAt)||0)+JOB_SYSTEM.OFFER_REFRESH_MS;
    progressionFocus=PROGRESSION_FOCUS_STATES.includes(m.progressionFocus)?m.progressionFocus:'';
    ONBOARD.setSeen(m.firstPromotionSeen===true);
    applyServerNpcQuestChains(m.npcQuestChains);
    if(!quest||quest.source!=='guardian')quest=m.activeNpcQuest||null;
    if(m.aegisTrialReady&&!quest)quest={source:'guardian',type:'pvp_bounty',have:1,need:1,giver:'Aegis Guardian',role:'guardian',title:'Silent Bounty',gold:135+(S.lvl||1)*8,xp:130+(S.lvl||1)*12};
    regionalContract=clampRegionalContract(m.regionalContract);
    roadWardenRep=Math.max(0,m.roadWardenRep|0);
    utilityUnlocks=clampUtilityUnlocks(m.utilityUnlocks);
    utilityLoadout=clampUtilityLoadout(m.utilityLoadout);
    removeEquippedArmorCopies();
    if(typeof m.gold==='number') gold=Math.max(0,m.gold|0);
    serverFirstQuestComplete=m.firstQuestRewardClaimed===true;
    firstQuestRewardRequestPending=false;
    if(typeof m.highestGateRankCleared==='number') highestGateRankCleared=Math.max(-1,Math.min(4,m.highestGateRankCleared|0));
    discoveredIds.clear();if(Array.isArray(m.discoveries))for(const id of m.discoveries)if(typeof id==='string')discoveredIds.add(id);
    if(Array.isArray(m.pos) && !onboardingActive){
      player.pos.set(m.pos[0], m.pos[1]+.01, m.pos[2]);
      player.vel.set(0,0,0);
    }
    hp=maxHp(); mp=maxMp(); sp=maxSp(); hunger=maxHunger();
    if(onboardingActive) prepareOnboardingStep();
    refreshHUD(); renderBars(); refreshPlayUi(); updateLandMinimap();
    if(Number((npcQuestChains&&npcQuestChains['Mara Vale'])||0)>0) awardFirstVillagerQuestBonus();
    if(gateSystemUnlocked() && !gateCutsceneSeen()) queueGateUnlockCutscene();
    syncLocalTutorialsToServer();
    startTownGuidance();
    if(progressionFocus&&!ONBOARD.isSeen())setTimeout(()=>ONBOARD.showFirstPromotion(),80);
    eventLog((m.name||'Hunter')+' returned — progress restored');
    finishWorldLoading('profile');
  }catch(e){ console.warn('profile restore failed', e); finishWorldLoading('profile-error'); }
}
function applyAbilitySync(m){
  if(!m) return;
  if(typeof m.mp==='number') mp=Math.max(0, Math.min(maxMp(), m.mp));
  if(m.cds && typeof m.cds==='object'){
    const path=activeAbilityPath();
    for(let i=0;i<3;i++){
      const key=path+':'+i;
      if(typeof m.cds[key]==='number') abCd[i]=Math.max(0,m.cds[key]);
    }
  }
  renderBars(); updateAbilityHUD();
}
function abilityRejected(m){
  SFX.error();
  const i=Math.max(0,Math.min(2,(m&&m.slot)|0));
  abCd[i]=0;
  const r=(m&&m.reason)||'invalid';
  if(r==='mana') sysMsg('Not enough <b>mana</b>');
  else if(r==='cooldown') sysMsg('Ability is still recharging');
  else if(r==='target') sysMsg('No valid target in sight');
  else if(r==='level') sysMsg('That ability is not unlocked yet');
  else sysMsg('Ability failed');
  renderBars(); updateAbilityHUD();
}
function abilityResolved(m){
  if(!m) return;
  if(typeof m.mp==='number') mp=Math.max(0,Math.min(maxMp(),m.mp));
  renderBars(); updateAbilityHUD();
}
function dragonAbilityRejected(m){
  SFX.error();
  COMPANIONS.dragonAbilityReadyAt=0;
  const r=(m&&m.reason)||'invalid';
  if(r==='cooldown') showName('Dragon ability ready in '+((m&&m.left)||1)+'s');
  else if(r==='mount') sysMsg('Mount a <b>dragon</b> to use its ability');
  else if(r==='unowned') sysMsg('That dragon is not bonded to you');
  else sysMsg('Dragon ability failed');
}
function dragonAbilityResolved(m){
  if(m && typeof m.cd==='number') COMPANIONS.dragonAbilityReadyAt=performance.now()+Math.max(0,m.cd)*1000;
  if(m && m.type && typeof m.happiness==='number') setDragonCare(m.type, m.happiness, Date.now());
}
function applyDragonCare(m){
  if(!m || !DRAGON_TYPES[m.type]) return;
  setDragonCare(m.type, m.happiness, m.fedAt||Date.now());
}
function applyFeedDragonResult(m){
  if(!m || !DRAGON_TYPES[m.type]) return;
  const slot=Math.max(0,Math.min(35,m.slot|0));
  if(inv[slot] && inv[slot].id===I.DRAGON_TREAT){ inv[slot].count--; if(inv[slot].count<=0) inv[slot]=null; }
  setDragonCare(m.type, m.happiness, m.fedAt||Date.now());
  refreshHUD(); if(uiOpen) renderUI();
  sysMsg('You feed your <b>'+DRAGON_TYPES[m.type].name+'</b>. Happiness: <b>'+dragonHappiness(m.type)+'</b>');
}
function feedDragonRejected(m){
  SFX.error();
  const r=(m&&m.reason)||'invalid';
  if(r==='treat') sysMsg('Hold a <b>Dragon Treat</b> to feed your dragon');
  else if(r==='mount') sysMsg('Mount a <b>dragon</b> before feeding it');
  else sysMsg('Could not feed that dragon');
}
function applyLandClaimResult(m){
  if(!m) return;
  if(typeof m.gold==='number') gold=Math.max(0,m.gold|0);
  SFX.coin();
  sysMsg('Purchased land at <b>'+((m.x|0))+', '+((m.z|0))+'</b> for <b>'+(m.price|0)+' gold</b>');
  clearTownTutorialStep('land');
  updateClaimHud();
}
function landClaimRejected(m){
  SFX.error();
  const r=(m&&m.reason)||'invalid';
  if(r==='border') sysMsg('The <b>world border</b> cannot be claimed');
  else if(r==='town') sysMsg('The <b>Town of Beginnings</b> cannot be claimed');
  else if(r==='owned') sysMsg('That land is already claimed');
  else if(r==='gold') sysMsg('Not enough <b>gold</b> for this claim');
  else if(r==='range') sysMsg('Move closer before claiming that land');
  else sysMsg('Land claim failed');
  const detail=r==='town'?'Town tiles are protected — choose a tile marked Available.':
    r==='gold'?'This tile costs '+((m&&m.price)||landPrice(claimHover&&claimHover.x||0,claimHover&&claimHover.z||0))+' gold; you have '+gold+'.':
    r==='owned'?'That tile already belongs to someone — choose another Available tile.':
    r==='range'?'That tile is too far from your character — choose a closer Available tile.':'Land purchase rejected: '+r+'.';
  eventLog(detail,'[Land]');
  updateClaimHud();
}
function applyFarmResult(m){
  if(!m) return;
  if(m.action==='till'){ gainJobXP('farmer',1,'till'); jobContractProgress('farm', 1, B.FARMLAND); }
  if(m.action==='plant'){ gainJobXP('farmer',1,'plant'); jobContractProgress('farm', 1, I.WHEAT_SEEDS); }
  if(m.action==='harvest'){ gainJobXP('farmer',5,'harvest'); jobContractProgress('farm', 1, B.WHEAT_3); }
  if(m.action==='plant' || m.action==='fertilize'){
    const i=Math.max(0,Math.min(35,m.slot==null?selected:(m.slot|0)));
    const s=inv[i];
    const consumed=m.action==='fertilize'?I.COMPOST:(m.seedId||I.WHEAT_SEEDS);
    if(s && s.id===consumed){ s.count--; if(s.count<=0) inv[i]=null; refreshHUD(); if(uiOpen) renderUI(); }
  }
  if(m.action==='harvest'&&m.golden) showJobPerk('farmer','Golden Wheat');
  else if(m.action==='harvest'&&m.kind==='windseed') showJobPerk('farmer','rich Windseed harvest');
  else if(m.action==='fertilize') showJobPerk('farmer','crop advanced');
}
function farmRejected(m){
  SFX.error();
  const r=(m&&m.reason)||'invalid';
  if(r==='protected') sysMsg('That land is protected');
  else if(r==='hoe') sysMsg('Equip a <b>hoe</b> to till soil');
  else if(r==='seeds') sysMsg('You need <b>wheat seeds</b>');
  else if(r==='compost') sysMsg('Hold <b>Compost</b> to fertilize this crop');
  else if(r==='growing') sysMsg('Compost works only on a growing crop');
  else if(r==='farmer_level') sysMsg('Equip Farmer and reach <b>Farmer Lv '+((m&&m.level)||1)+'</b> first');
  else if(r==='ripe') sysMsg('That crop is not ready');
  else sysMsg('Farming action failed');
}
function netSnapshot(){
  return {
    name:(document.getElementById('playername').value||'Hunter').slice(0,16),
  };
}

// ---- block edit sync ----
function netSendEdit(x,y,z,id){
  if(!NET.on) return;
  if(dim==='overworld') NET.room.send('edit',{x,y,z,id,slot:selected});
  else if(dim==='dungeon' && NET.dgn) NET.room.send('dedit',{x,y,z,id,slot:selected});
}
function netEditReject(m){
  SFX.error();
  if(!m) return;
  const x=m.x|0, y=m.y|0, z=m.z|0, id=m.id|0;
  if(m.requested && m.requested!==B.AIR && ITEMS[m.requested]) addItem(m.requested, 1);
  if(isLightBlock(getB(x,y,z)) && !isLightBlock(id)) removeTorchMesh(x,y,z);
  removeCropMesh(x,y,z);
  removeInsulatorMesh(x,y,z);
  setB(x,y,z,id);
  if(isLightBlock(id)) addTorchMesh(x,y,z);
  syncCropMesh(x,y,z,id);
  syncInsulatorMesh(x,y,z,id);
  rebuildAround(x,z);
}
function netApplyEdit(key,id){
  const [x,y,z]=key.split(',').map(Number);
  if(dim!=='overworld'){ NET.pending.push([x,y,z,id]); return; }
  netWriteEdit(x,y,z,id);
}
function netWriteEdit(x,y,z,id){
  if(getB(x,y,z)===id) return;
  if(isLightBlock(getB(x,y,z))) removeTorchMesh(x,y,z);
  removeCropMesh(x,y,z);
  removeInsulatorMesh(x,y,z);
  setB(x,y,z,id);
  if(isLightBlock(id)) addTorchMesh(x,y,z);
  syncCropMesh(x,y,z,id);
  syncInsulatorMesh(x,y,z,id);
  rebuildAround(x,z);
  if(id===B.AIR) triggerFalls(x,y,z);          // remote breaks drop sand locally (deterministic)
  else if(id===B.SAND) maybeFall(x,y,z);
}
function netFlushPending(){
  for(const [x,y,z,id] of NET.pending){
    if(isLightBlock(getB(x,y,z)) && !isLightBlock(id)) removeTorchMesh(x,y,z);
    removeInsulatorMesh(x,y,z);
    setB(x,y,z,id);
    if(isLightBlock(id)) addTorchMesh(x,y,z);
    syncInsulatorMesh(x,y,z,id);
  }
  NET.pending.length=0;
}

// ---- remote players ----
function makeNameTag(text, col, team, teamColr, opts){
  opts=opts||{};
  const lvl=Math.max(1,opts.lvl|0);
  const rank=opts.rank||playerRankName(lvl);
  const jobLabel=opts.jobTitle || (opts.job ? (opts.jobLvl ? opts.job+' '+opts.jobLvl : opts.job) : 'Adventurer');
  const c=document.createElement('canvas'); c.width=320; c.height=96;
  const g=c.getContext('2d');
  const accent=col||'#ffffff';
  const teamColor=teamColr||'#ffd24a';
  g.textAlign='center';
  g.shadowColor='rgba(0,0,0,.75)';
  g.shadowBlur=6;

  roundedRect(g,42,12,236,team?70:54,8);
  const grad=g.createLinearGradient(42,12,42,82);
  grad.addColorStop(0,'rgba(12,20,34,.92)');
  grad.addColorStop(1,'rgba(4,8,16,.86)');
  g.fillStyle=grad; g.fill();
  g.shadowBlur=0;
  g.strokeStyle='rgba(255,255,255,.18)';
  g.lineWidth=1.5; g.stroke();
  g.strokeStyle=accent;
  g.globalAlpha=.72; g.strokeRect(49.5,19.5,221,team?57:41); g.globalAlpha=1;

  fitCanvasText(g,text,184,17,'bold');
  g.lineWidth=3; g.strokeStyle='rgba(0,0,0,.82)';
  g.strokeText(text,160,36);
  g.fillStyle=accent; g.fillText(text,160,36);

  const pillText='Lv '+lvl+'  '+rank+(jobLabel?'  ·  '+jobLabel:'');
  const pillW=jobLabel?196:130, pillX=(320-pillW)/2;
  fitCanvasText(g,pillText,pillW-8,11,'bold');
  roundedRect(g,pillX,44,pillW,18,5);
  g.fillStyle='rgba(154,210,107,.16)'; g.fill();
  g.strokeStyle='rgba(154,210,107,.45)'; g.stroke();
  g.fillStyle='#d8f8c8'; g.fillText(pillText,160,57);

  if(team){
    roundedRect(g,62,65,196,18,5);
    g.fillStyle='rgba(255,255,255,.07)'; g.fill();
    g.strokeStyle=teamColor; g.globalAlpha=.75; g.stroke(); g.globalAlpha=1;
    fitCanvasText(g,team,142,11,'bold');
    g.fillStyle=teamColor;
    g.fillText('TEAM  '+team,160,78);
  }
  const tex=new THREE.CanvasTexture(c);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex, transparent:true, depthWrite:false, depthTest:false}));
  sp.scale.set(1.6,.48,1); sp.position.y=2.34; sp.renderOrder=20;
  return sp;
}
function appearanceForPath(path){
  path=path&&PATHS[path]?path:'';
  const shirt=path?PATHS[path].col:'#3a6ea8';
  const dark=path?shadeHex(shirt,-34):'#2e5a8a';
  const light=path?shadeHex(shirt,34):'#5a96c7';
  return {
    skin:'#c98952',
    skinDark:'#a9693f',
    skinShadow:'#805032',
    face:'#185f68',
    nose:'#7a432e',
    hair:'#e7d574',
    hairLight:'#fff099',
    hairDark:'#b68142',
    shirt:path?'#24152f':'#26283f',
    shirtLight:path?shadeHex(PATHS[path].col,18):'#3b4268',
    shirtDark:path?'#170c20':'#191a2c',
    shirtShadow:path?'#0f0816':'#11111e',
    pants:'#17182a',
    pantsDark:'#0e0e18',
    boot:'#5a2628',
    bootLight:'#7a3838',
    belt:'#5c2c24',
    beltBuckle:'#d0a348',
    trim:path==='mage'?'#9bdcff':path==='shadow'?'#9b6be8':path==='guardian'?'#d49a42':'#8f6aa7',
    scarf:path==='mage'?'#bfe8ff':path==='shadow'?'#b8a0ff':path==='guardian'?'#ffd27a':'#7d3155',
  };
}
function playerAppearance(){
  const look=appearanceForPath(S.path);
  look.armorId=armorSlot?armorSlot.id:0;
  look.armorType=armorSlot?GEAR_SYSTEM.armorProfile(ITEMS[armorSlot.id].armor,armorSlot).type.id:'';
  look.heldId=displayHeldId();
  return look;
}
function remoteAppearance(ref){
  const look=appearanceForPath(ref&&ref.path);
  look.armorId=ref?(ref.armorId|0):0;
  look.armorType=ref&&GEAR_SYSTEM.ARMOR_ARCHETYPES[ref.armorType]?ref.armorType:'';
  look.heldId=ref?(ref.heldId|0):0;
  return look;
}
function equipmentKind(id){
  id=id|0;
  if(id>=122&&id<=125 || id===136) return 'sword';
  if(id===160) return 'dagger';
  if(id===161) return 'hammer';
  if(id===163) return 'scythe';
  if(id===164) return 'bow';
  if(id===165) return 'cleaver';
  if(id===166) return 'katana';
  if(id===167) return 'phoenix';
  if(id===168) return 'chakram';
  if(id===169) return 'midas';
  if(id===170) return 'trident';
  if(id===171) return 'anchor';
  if(id===138 || id===162) return 'staff';
  if(id>=110&&id<=113) return 'pick';
  if(id>=114&&id<=117) return 'axe';
  if(id>=118&&id<=121) return 'shovel';
  return '';
}
function faceTexture(look){
  return npcTex(g=>{
    g.fillStyle=look.skin; g.fillRect(0,0,16,16);
    g.fillStyle=look.skinDark; g.fillRect(0,12,16,4); g.fillRect(0,4,2,8); g.fillRect(14,4,2,8);
    g.fillStyle=look.hairLight; g.fillRect(0,0,16,2);
    g.fillStyle=look.hair; g.fillRect(0,2,5,3); g.fillRect(11,2,5,3); g.fillRect(2,1,4,4); g.fillRect(8,1,5,3);
    g.fillStyle=look.hairDark; g.fillRect(0,5,2,5); g.fillRect(14,5,2,5);
    g.fillStyle=look.face; g.fillRect(4,6,2,2); g.fillRect(10,6,2,2);
    g.fillStyle='#f4e0c4'; g.fillRect(6,6,1,1); g.fillRect(12,6,1,1);
    g.fillStyle=look.nose; g.fillRect(7,8,2,1);
    g.fillStyle='#5e2f28'; g.fillRect(6,11,4,1);
    g.fillStyle='rgba(255,180,160,.35)'; g.fillRect(2,10,2,1); g.fillRect(12,10,2,1);
  });
}
const REPLICATION_VISUALS=createReplicationVisuals({NET,player});
const {isAnimalKind,netAddMob,netRemoveMob,netMobTick,netFx,netDragonAbilityFx,netDragonCareFx,addLightningBeam,netSpawnProjectile,netBiomeStatusFx,netBiomeHitFx,netMirrorGate}=REPLICATION_VISUALS;

const COMPANIONS=createCompanionSystem({
  NET,
  player,
  inv,
  gearSystem:GEAR_SYSTEM,
  refreshHUD,
  equipmentKind,
  faceTexture,
  forwardFacingYaw,
  isAnimalKind,
  localDisplayName,
  makeNameTag,
  netDragonAbilityFx,
  netDragonCareFx,
  netSpawnProjectile,
  playerAppearance,
  remoteAppearance,
});
const {DRAGON_TYPES_LIST,DRAGON_TYPES,DRAGON_EGG_TO_TYPE,dragonType,dragonTrailColor,emitDragonTrail,emitDragonAura,mountLift,mountEye,animateMountWings,ensureRemoteMount,applyMount,toggleMount,cycleDragon,DRAGON_ABILITIES,dragonHappiness,setDragonCare,castDragonAbility,feedMountedDragon,firstDragonEggSlot,hatchDragonEgg,claimLocalIncubation,applyDragonIncubationStart,applyDragonIncubationReady,applyDragonIncubationComplete,dragonHatchRejected,applyDragonRenameResult,dragonRenameRejected,perchRejected,tickLocalMount,tickDragonRoost,DRAGON_PERCH_SLOTS_C,perchedDragons,perchKeysAt,addPerchedDragon,removePerchedDragon,tickPerchedDragons,dragonBreedFx,perchMyDragon,feedNestDragon,recallNestDragon,dragonBreathe,spriteForageChance,FAMILIARS,FAMILIAR_BY_SIGIL,tickFamiliars,spriteForage,fangSnap,tickWatchfulShade,cycleFamiliar,updateFamiliarHUD,shadowStep,bindFamiliarItem,familiarBoundLocal,makeRemoteAvatar,netAddRemote,netRefreshRemoteAvatar,netUpdateTag,pulseAegisGlow,netRemoveRemote}=COMPANIONS;

// ---- local third-person appearance dummy ----
var appearanceDummy=null, appearanceBackDummy=null;
let appearancePreviewActive=false, meditationOwnedAppearance=false;
const APPEARANCE_DUMMY_GROUND_OFFSET=-0.12;
function localDisplayName(){
  return (document.getElementById('playername').value||'Hunter').slice(0,16);
}
function appearanceSignature(){
  const held=inv[selected]?inv[selected].id:0;
  const armor=armorSlot?armorSlot.id:0;
  const armorType=armorSlot&&ITEMS[armorSlot.id]&&ITEMS[armorSlot.id].armor?GEAR_SYSTEM.armorProfile(ITEMS[armorSlot.id].armor,armorSlot).type.id:'';
  return [localDisplayName(), S.lvl, highestGateRankCleared, S.path||'', S.str, S.agi, S.vit, S.int, armor, armorType, held, playerJob||'', jobLevelFromXp(jobXp)].join('|');
}
function buildAppearanceDummy(){
  const d={...makeRemoteAvatar(playerAppearance()), phase:Math.random()*10, sig:'', tag:null};
  d.grp.scale.setScalar(1.04);
  scene.add(d.grp);
  return d;
}
function disposeAppearanceDummy(){
  if(appearanceDummy) scene.remove(appearanceDummy.grp);
  if(appearanceBackDummy) scene.remove(appearanceBackDummy.grp);
  appearanceDummy=null;
  appearanceBackDummy=null;
  meditationOwnedAppearance=false;
}
function toggleAppearanceDummy(){
  if(appearanceDummy){
    appearancePreviewActive=false;
    disposeAppearanceDummy();
    sysMsg('Appearance preview hidden');
  } else {
    appearancePreviewActive=true;
    appearanceDummy=buildAppearanceDummy();
    appearanceBackDummy=buildAppearanceDummy();
    updateAppearanceDummy(0, performance.now(), true);
    sysMsg('Appearance preview: front and back views');
  }
}
function refreshAppearanceDummy(){
  if(!appearanceDummy) return;
  const sig=appearanceSignature();
  if(sig===appearanceDummy.sig) return;
  const pos=appearanceDummy.grp.position.clone(), rot=appearanceDummy.grp.rotation.y;
  const backPos=appearanceBackDummy?appearanceBackDummy.grp.position.clone():pos.clone();
  const backRot=appearanceBackDummy?appearanceBackDummy.grp.rotation.y:rot+Math.PI;
  scene.remove(appearanceDummy.grp);
  if(appearanceBackDummy) scene.remove(appearanceBackDummy.grp);
  appearanceDummy=buildAppearanceDummy();
  appearanceBackDummy=buildAppearanceDummy();
  appearanceDummy.grp.position.copy(pos);
  appearanceDummy.grp.rotation.y=rot;
  appearanceBackDummy.grp.position.copy(backPos);
  appearanceBackDummy.grp.rotation.y=backRot;
  appearanceDummy.sig=sig;
  appearanceBackDummy.sig=sig;
  const pathCol=S.path&&PATHS[S.path]?PATHS[S.path].col:'#ffffff';
  const teamId=myTeamId();
  const displayName=localDisplayName();
  const labelTeam=teamId ? teamName(teamId) : '';
  const labelColor=teamId ? teamCol(teamId) : '#ffd24a';
  const jd=activeJob(), jl=playerJob?jobLevelFromXp(jobXp):0;
  const jt=playerJob?jobTitleFor(playerJob,jl):'Adventurer';
  appearanceDummy.tag=makeNameTag(displayName, pathCol, labelTeam, labelColor, { lvl:S.lvl, rank:localPlayerRankName(), job:jd&&jd.name, jobLvl:jl, jobTitle:jt });
  appearanceBackDummy.tag=makeNameTag(displayName, pathCol, labelTeam, labelColor, { lvl:S.lvl, rank:localPlayerRankName(), job:jd&&jd.name, jobLvl:jl, jobTitle:jt });
  appearanceDummy.grp.add(appearanceDummy.tag);
  appearanceBackDummy.grp.add(appearanceBackDummy.tag);
}
function poseAppearanceDummy(dmy, x, y, z, rot, dt, now, snap, backView){
  if(!dmy) return;
  const p=dmy.grp.position;
  if(snap) p.set(x,y,z);
  else {
    p.x+=(x-p.x)*Math.min(1,dt*8);
    p.y+=(y-p.y)*Math.min(1,dt*8);
    p.z+=(z-p.z)*Math.min(1,dt*8);
  }
  dmy.grp.rotation.y += angDiff(rot, dmy.grp.rotation.y)*Math.min(1,dt*10);
  const moving=Math.hypot(player.vx||0, player.vz||0)>.08;
  const sw=moving?Math.sin(now/1000*8+dmy.phase)*.55:Math.sin(now/1000*1.5)*(backView?-.018:.025);
  const idleT=now/1000+dmy.phase;
  const breath=Math.sin(idleT*1.6)*.004;
  dmy.grp.position.y += breath;
  if(dmy.legs&&dmy.legs.length>=2){
    dmy.legs[0].position.x=-.13; dmy.legs[1].position.x=.13;
    dmy.legs[0].rotation.set(sw,0,0);
    dmy.legs[1].rotation.set(-sw,0,0);
  }
  for(let i=0;i<dmy.arms.length;i++) dmy.arms[i].rotation.set(-sw*.65*(i?1:-1),0,i?-.08:.08);
  if(dmy.sword) dmy.sword.visible=true;
  for(let i=0;i<(dmy.hair||[]).length;i++) dmy.hair[i].rotation.x=Math.sin(idleT*1.8+i)*.004;
  if(dmy.sword) dmy.sword.rotation.z=Math.sin(idleT*1.3)*.006;
  if(buffs.dmg>0) shadowWeaponPulse(dmy,.8);
  if(dmy.idle) for(let i=0;i<dmy.idle.length;i++) dmy.idle[i].rotation.z=Math.sin(idleT*1.2+i)*.0015;
  pulseAegisGlow(dmy, now);
  if(dmy.blink){
    const blinkNow=(Math.sin(idleT*.95)>0.992);
    for(const e of dmy.blink) e.scale.y=blinkNow?.16:1;
  }
  if(dmy.head) dmy.head.rotation.y=Math.sin(now/1000*1.1)*(backView?-.018:.035);
}
function poseMeditationDummy(dmy, dt, now, snap){
  if(!dmy) return;
  const p=dmy.grp.position;
  const x=player.pos.x, y=TOWN.G+1.18, z=player.pos.z;
  if(snap) p.set(x,y,z);
  else {
    p.x+=(x-p.x)*Math.min(1,dt*8);
    p.y+=(y-p.y)*Math.min(1,dt*8);
    p.z+=(z-p.z)*Math.min(1,dt*8);
  }
  const targetRot=Math.PI;
  dmy.grp.rotation.y += angDiff(targetRot, dmy.grp.rotation.y)*Math.min(1,dt*8);
  const t=now/1000+(dmy.phase||0);
  const breath=Math.sin(t*1.15)*.018;
  if(dmy.head){
    dmy.head.rotation.x=-.16+Math.sin(t*.9)*.018;
    dmy.head.rotation.y=Math.sin(t*.7)*.025;
  }
  if(dmy.legs&&dmy.legs.length>=2){
    dmy.legs[0].rotation.set(-1.22,0,.92);
    dmy.legs[1].rotation.set(-1.22,0,-.92);
    dmy.legs[0].position.x=-.18; dmy.legs[1].position.x=.18;
  }
  if(dmy.arms&&dmy.arms.length>=2){
    dmy.arms[0].rotation.set(.82,0,.56);
    dmy.arms[1].rotation.set(.82,0,-.56);
  }
  if(dmy.sword) dmy.sword.visible=false;
  dmy.grp.position.y=y+breath;
  if(dmy.idle) for(let i=0;i<dmy.idle.length;i++) dmy.idle[i].rotation.z=Math.sin(t*.9+i)*.002;
  pulseAegisGlow(dmy, now);
  if(meditateRing){
    meditateMat.opacity=.1+.05*Math.sin(t*1.2);
    if(meditateRing.userData.glow&&meditateRing.userData.glow.material) meditateRing.userData.glow.material.opacity=.1+.06*Math.sin(t*1.05);
  }
  if(Math.random()<dt*18){
    const a=Math.random()*Math.PI*2, r=.25+Math.random()*1.15;
    spawnParticle({x:x+Math.cos(a)*r,y:TOWN.G+1.18+Math.random()*.25,z:z+Math.sin(a)*r,
      vx:Math.cos(a)*.08,vy:.35+Math.random()*.35,vz:Math.sin(a)*.08,life:.75+Math.random()*.55,grav:-.12,r:.55,g:.86,b:1});
  }
}
function updateAppearanceDummy(dt, now, snap){
  if(!appearanceDummy) return;
  if(!isMeditating && !appearancePreviewActive){
    disposeAppearanceDummy();
    return;
  }
  refreshAppearanceDummy();
  if(isMeditating){
    appearanceDummy.grp.visible=true;
    if(appearanceBackDummy) appearanceBackDummy.grp.visible=false;
    poseMeditationDummy(appearanceDummy, dt, now, snap);
    return;
  } else if(appearanceBackDummy && !appearanceBackDummy.grp.visible) {
    appearanceBackDummy.grp.visible=true;
    if(appearanceDummy.sword) appearanceDummy.sword.visible=true;
  }
  const d=viewDir(false);
  const side=new THREE.Vector3(d.z,0,-d.x);
  const baseX=player.pos.x+d.x*3.4;
  const baseZ=player.pos.z+d.z*3.4;
  let fx=baseX-side.x*.62, fz=baseZ-side.z*.62;
  let bx=baseX+side.x*.62, bz=baseZ+side.z*.62;
  fx=Math.max(2,Math.min(WX-3,fx)); fz=Math.max(2,Math.min(WX-3,fz));
  bx=Math.max(2,Math.min(WX-3,bx)); bz=Math.max(2,Math.min(WX-3,bz));
  const fy0=standHeight(fx,fz,player.pos.y+4), by0=standHeight(bx,bz,player.pos.y+4);
  const fy=(fy0>0?fy0:player.pos.y)+APPEARANCE_DUMMY_GROUND_OFFSET;
  const by=(by0>0?by0:player.pos.y)+APPEARANCE_DUMMY_GROUND_OFFSET;
  const frontFace=Math.atan2(player.pos.x-fx, player.pos.z-fz);
  poseAppearanceDummy(appearanceDummy, fx, fy, fz, frontFace+Math.PI, dt, now, snap, false);
  poseAppearanceDummy(appearanceBackDummy, bx, by, bz, frontFace, dt, now, snap, true);
}

// ---- third-person ability demo bot ----
var abilityDemo=null;
const DEMO_STEPS=[
  {path:'shadow', slot:0, name:'Shadow Dash'},
  {path:'shadow', slot:1, name:'Umbral Edge'},
  {path:'shadow', slot:2, name:'Shadow Soldier'},
  {path:'mage', slot:0, name:'Fireball'},
  {path:'mage', slot:1, name:'Frost Nova'},
  {path:'mage', slot:2, name:'Chain Lightning'},
  {path:'guardian', slot:0, name:'Iron Skin'},
  {path:'guardian', slot:1, name:'Shockwave'},
  {path:'guardian', slot:2, name:'Second Wind'},
  {path:'guardian', slot:3, name:'Aegis Pulse'},
  {path:'shadow', slot:4, name:'Blackhole Staff'},
  {path:'shadow', slot:5, name:'Chrono Dagger'},
  {path:'guardian', slot:5, name:'Titan Hammer'},
  {path:'mage', slot:5, name:'Meteor Staff'},
  {path:'shadow', slot:6, name:'Soul Reaper Scythe'},
  {path:'mage', slot:6, name:'Gravity Bow'},
  {path:'guardian', slot:6, name:'Warden Cleaver'},
  {path:'shadow', slot:7, name:'Eclipse Katana'},
  {path:'guardian', slot:7, name:'Phoenix Sword'},
  {path:'mage', slot:7, name:'Frostbite Chakram'},
  {path:'shadow', slot:8, name:'Midas Blade'},
  {path:'mage', slot:8, name:'Leviathan Trident'},
  {path:'guardian', slot:8, name:'Void Anchor'},
];
function demoLook(path, heldId, armorId, armorType){
  const look=appearanceForPath(path);
  look.heldId=heldId||0;
  look.armorId=armorId||0;
  look.armorType=armorType||(armorId===137?'aegis':armorId===184?'bulwark':armorId?'vanguard':'');
  return look;
}
function avatarFacingYaw(dx,dz){
  return Math.atan2(dx,dz)+Math.PI;
}
function forwardFacingYaw(dx,dz){
  return Math.atan2(dx,dz);
}
function makeAbilityTargetDummy(index=0){
  const grp=new THREE.Group(), mats=[];
  const mat=(color)=>{ const m=new THREE.MeshLambertMaterial({color}); mats.push(m); return m; };
  const wood=mat(0x8b5a2b), darkWood=mat(0x5a351b), cloth=mat(0xd7b56d), red=mat(0xd44832), white=mat(0xf7efd6), glow=mat(0x7dd3fc);
  const add=(geo,m,x,y,z,rot)=>{
    const mesh=new THREE.Mesh(geo,m);
    mesh.position.set(x,y,z);
    if(rot) mesh.rotation.set(rot[0]||0,rot[1]||0,rot[2]||0);
    grp.add(mesh);
    return mesh;
  };
  add(new THREE.CylinderGeometry(.16,.2,.22,8),darkWood,0,.1,0);
  add(new THREE.BoxGeometry(.2,1.35,.2),wood,0,.78,0);
  add(new THREE.BoxGeometry(1.2,.16,.16),wood,0,1.46,0);
  add(new THREE.BoxGeometry(.92,.68,.24),cloth,0,1.28,-.03);
  add(new THREE.BoxGeometry(.46,.42,.26),cloth,0,1.88,-.03);
  add(new THREE.BoxGeometry(.64,.46,.035),white,0,1.31,-.175);
  add(new THREE.BoxGeometry(.42,.3,.04),red,0,1.31,-.2);
  add(new THREE.BoxGeometry(.18,.13,.045),white,0,1.31,-.225);
  add(new THREE.TorusGeometry(.78,.035,8,32),glow,0,.08,0,[Math.PI/2,0,0]);
  add(new THREE.TorusGeometry(.98,.025,8,32),red,0,.08,0,[Math.PI/2,0,0]);
  const tag=makeNameTag('Target Dummy '+(index+1), '#ffd24a', 'training target', '#7dd3fc', { lvl:S.lvl, rank:'Dummy' });
  tag.position.y=2.35;
  grp.add(tag);
  grp.add(blobShadow(1.1));
  return {grp,mats,legs:[],arms:[],head:null,baseCol:[.84,.70,.42],resetColors:mats.map(m=>m.color.clone())};
}
function makeDemoTarget(x,y,z,index=0){
  const m={...makeAbilityTargetDummy(index), kind:'target_dummy', hp:999, maxHp:999, demo:true, demoDummy:true, noLoot:true,
    kb:new THREE.Vector3(), wait:0, alert:false, sx:x, sz:z, tx:x, tz:z, speed:0,
    phase:Math.random()*10, hitT:0, atkCd:0, slowT:0};
  m.grp.position.set(x,y,z);
  scene.add(m.grp);
  mobs.push(m);
  return m;
}
function stopAbilityDemo(silent=false){
  if(!abilityDemo) return;
  if(abilityDemo.bot) scene.remove(abilityDemo.bot.grp);
  for(const m of abilityDemo.targets||[]){
    const i=mobs.indexOf(m);
    if(i>=0) removeMob(i);
    else if(m.grp) scene.remove(m.grp);
  }
  if(abilityDemo.ally && abilityDemo.ally.grp) scene.remove(abilityDemo.ally.grp);
  abilityDemo=null;
  if(!silent) sysMsg('Ability demo hidden');
}
function startAbilityDemo(silent=false){
  stopAbilityDemo(silent);
  const d=viewDir(false), side=new THREE.Vector3(d.z,0,-d.x);
  const bx=Math.max(4,Math.min(WX-5,player.pos.x+d.x*5));
  const bz=Math.max(4,Math.min(WX-5,player.pos.z+d.z*5));
  const by0=standHeight(bx,bz,player.pos.y+6);
  const by=(by0>0?by0:player.pos.y)-.12;
  const bot={...makeRemoteAvatar(demoLook('mage',0,137)), phase:Math.random()*10, tag:null};
  bot.grp.position.set(bx,by,bz);
  bot.grp.rotation.y=avatarFacingYaw(player.pos.x-bx, player.pos.z-bz);
  bot.tag=makeNameTag('Ability Demo', '#38bdf8', 'U to hide', '#ffd24a', { lvl:S.lvl, rank:'Demo' });
  bot.grp.add(bot.tag);
  scene.add(bot.grp);
  const targets=[];
  for(let i=0;i<3;i++){
    const tx=bx+d.x*(3.2+i*1.7)+side.x*(i-1)*.75;
    const tz=bz+d.z*(3.2+i*1.7)+side.z*(i-1)*.75;
    const ty0=standHeight(tx,tz,by+5);
    const m=makeDemoTarget(tx,ty0>0?ty0:by,tz,i);
    m.grp.rotation.y=avatarFacingYaw(bx-tx,bz-tz);
    targets.push(m);
  }
  abilityDemo={bot, targets, dir:d, side, step:-1, stepT:0, totalT:0, casted:false, ally:null, base:{x:bx,y:by,z:bz}};
  if(!silent) sysMsg('Ability demo started: cycling every class power');
}
function toggleAbilityDemo(){
  if(abilityDemo) stopAbilityDemo();
  else startAbilityDemo();
}
function rebuildDemoBot(path, heldId, armorId){
  if(!abilityDemo) return;
  const old=abilityDemo.bot, pos=old.grp.position.clone(), rot=old.grp.rotation.y;
  scene.remove(old.grp);
  const bot={...makeRemoteAvatar(demoLook(path,heldId,armorId)), phase:old.phase, tag:null};
  bot.grp.position.copy(pos);
  bot.grp.rotation.y=rot;
  bot.tag=makeNameTag('Ability Demo', PATHS[path]?PATHS[path].col:'#ffffff', PATHS[path]?PATHS[path].name:'Legendary', '#ffd24a', { lvl:S.lvl, rank:'Demo' });
  bot.grp.add(bot.tag);
  scene.add(bot.grp);
  abilityDemo.bot=bot;
}
function resetDemoTargets(){
  if(!abilityDemo) return;
  const {targets}=abilityDemo;
  for(let i=0;i<targets.length;i++){
    const m=targets[i], p=m.grp.position;
    m.hp=999; m.hitT=0; m.slowT=0; m.blackhole=null; m.grp.visible=true; m.grp.scale.setScalar(1);
    if(m.resetColors) m.mats.forEach((mm,mi)=>mm.color.copy(m.resetColors[mi]||mm.color));
    else { const bc=m.baseCol||[1,1,1]; m.mats.forEach(mm=>mm.color.setRGB(bc[0],bc[1],bc[2])); }
    p.x=abilityDemo.base.x+abilityDemo.dir.x*(3.2+i*1.7)+abilityDemo.side.x*(i-1)*.75;
    p.z=abilityDemo.base.z+abilityDemo.dir.z*(3.2+i*1.7)+abilityDemo.side.z*(i-1)*.75;
    const gy=standHeight(p.x,p.z,abilityDemo.base.y+5);
    p.y=gy>0?gy:abilityDemo.base.y;
    m.grp.rotation.y=avatarFacingYaw(abilityDemo.base.x-p.x,abilityDemo.base.z-p.z);
  }
}
function demoCastPose(bot,t){
  const pulse=Math.sin(Math.min(1,t/.55)*Math.PI);
  if(bot.arms[0]) bot.arms[0].rotation.x=-1.1*pulse;
  if(bot.arms[1]) bot.arms[1].rotation.x=-1.25*pulse;
  if(bot.head) bot.head.rotation.x=-.08*pulse;
  if(bot.sword) bot.sword.rotation.z=.22*pulse;
}
function demoImpactPoint(){
  const m=abilityDemo.targets[0], p=m.grp.position;
  return {x:p.x,y:p.y+1,z:p.z};
}
function destroyDemoDummy(m,yaw){
  if(!m || !m.grp || !m.grp.visible) return;
  const p=m.grp.position.clone();
  m.hitT=.35;
  shadowSoldierStrikeVfx(p.x,p.y,p.z,yaw||0);
  burst(p.x,p.y+1.1,p.z,[.62,.36,1],40,4.0,2.8,.75);
  burst(p.x,p.y+.9,p.z,[.9,.72,.42],24,3.3,2.4,.65);
  for(let k=0;k<16;k++){
    const a=Math.random()*Math.PI*2, sp=1.2+Math.random()*2.4;
    const shard=new THREE.Mesh(new THREE.BoxGeometry(.12,.12,.12),
      new THREE.MeshBasicMaterial({color:Math.random()<.5?0x8b5cf6:0x9b7a45,transparent:true,opacity:1,blending:THREE.AdditiveBlending,depthWrite:false}));
    shard.position.set(p.x+(Math.random()-.5)*.5,p.y+.6+Math.random()*1.2,p.z+(Math.random()-.5)*.5);
    shard.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,Math.random()*Math.PI);
    scene.add(shard);
    beams.push({mesh:shard,life:.72,vel:new THREE.Vector3(Math.cos(a)*sp,1.5+Math.random()*2.4,Math.sin(a)*sp),grav:8,spin:8});
  }
  for(let k=0;k<18;k++) setTimeout(()=>{
    if(!m.grp) return;
    const s=Math.max(.04,1-k/17);
    m.grp.scale.setScalar(s);
    if(k===17) m.grp.visible=false;
  }, k*28);
}
function runDemoEffect(step){
  const bot=abilityDemo.bot, b=bot.grp.position, d=abilityDemo.dir;
  const target=abilityDemo.targets[0], tp=target.grp.position;
  SFX.cast();
  if(!cutscene){ showName(step.name); sysMsg('<b>'+step.name+'</b> demo'); }
  if(step.name==='Shadow Dash'){
    const start=bot.grp.position.clone();
    const dashDir=new THREE.Vector3(d.x,0,d.z).normalize();
    const dashLen=8.35;
    for(let i=0;i<abilityDemo.targets.length;i++){
      const m=abilityDemo.targets[i], p=m.grp.position;
      const dist=2.55+i*1.55;
      const sideNudge=(i-1)*.08;
      p.x=start.x+dashDir.x*dist+abilityDemo.side.x*sideNudge;
      p.z=start.z+dashDir.z*dist+abilityDemo.side.z*sideNudge;
      const gy=standHeight(p.x,p.z,abilityDemo.base.y+5);
      p.y=gy>0?gy:abilityDemo.base.y;
      p.x-=dashDir.x*.03; p.z-=dashDir.z*.03;
      m.grp.rotation.y=avatarFacingYaw(start.x-p.x,start.z-p.z);
    }
    const end=start.clone().add(dashDir.clone().multiplyScalar(dashLen));
    const endY=standHeight(end.x,end.z,start.y+5);
    if(endY>0) end.y=endY;
    if(cutscene) cutscene.dashCam={start:start.clone(),end:end.clone(),startedAt:cutscene.t,dur:.86};
    shadowDashVfx(start,end);
    for(const m of abilityDemo.targets){
      const p=m.grp.position.clone();
      const u=Math.max(0,Math.min(1,((p.x-start.x)*dashDir.x+(p.z-start.z)*dashDir.z)/dashLen));
      setTimeout(()=>{
        if(!abilityDemo || !m.grp) return;
        m.hitT=.28;
        m.mats.forEach(mm=>mm.color.setRGB(.62,.28,1));
        shadowSoldierStrikeVfx(p.x,p.y,p.z,bot.grp.rotation.y);
        p.x+=dashDir.x*.38; p.z+=dashDir.z*.38;
        m.grp.position.x=p.x; m.grp.position.z=p.z;
      }, 130+u*520);
    }
    for(let k=0;k<38;k++){
      setTimeout(()=>{
        if(!abilityDemo || !bot.grp) return;
        const u=k/37, ease=1-Math.pow(1-u,3);
        bot.grp.position.x=start.x+(end.x-start.x)*ease;
        bot.grp.position.y=start.y+(end.y-start.y)*ease;
        bot.grp.position.z=start.z+(end.z-start.z)*ease;
        spawnParticle({x:bot.grp.position.x,y:bot.grp.position.y+.8,z:bot.grp.position.z,
          vx:0,vy:.4,vz:0,life:.35,grav:0,r:.55,g:.35,b:1});
      }, k*16);
    }
    setTimeout(()=>{ if(abilityDemo && !cutscene) bot.grp.position.set(abilityDemo.base.x,abilityDemo.base.y,abilityDemo.base.z); }, 1850);
  } else if(step.name==='Umbral Edge'){
    if(bot.sword) bot.sword.rotation.z=.15;
    burst(b.x,b.y+1,b.z,[.55,.35,1],18,2.2,2.1,.55);
    umbralEdgeVfx(b.x,b.y,b.z,.85,bot.grp.rotation.y);
    for(let k=0;k<22;k++){
      setTimeout(()=>{
        if(!abilityDemo || abilityDemo.bot!==bot) return;
        if(bot.sword) bot.sword.rotation.z=.18+.42*Math.sin(k/21*Math.PI);
        shadowWeaponPulse(bot,1.45);
      },k*45);
    }
    setTimeout(()=>{
      if(!abilityDemo || !target || !target.grp) return;
      if(bot.arms[0]) bot.arms[0].rotation.x=-1.25;
      if(bot.arms[1]) bot.arms[1].rotation.x=-.55;
      if(bot.sword) bot.sword.rotation.z=1.05;
      const p=target.grp.position;
      energyTrailVfx(b.x,b.y+1.35,b.z,p.x,p.y+1.25,p.z,0xd8b4fe,.075,.38,.95);
      energyTrailVfx(b.x,b.y+1.05,b.z,p.x,p.y+1.0,p.z,0x2e1065,.16,.45,.72);
      shadowClawVfx(p.x,p.y,p.z,bot.grp.rotation.y,.7);
      target.mats.forEach(mm=>mm.color.setRGB(.62,.28,1));
    },720);
    setTimeout(()=>{
      if(!abilityDemo || !target || !target.grp) return;
      destroyDemoDummy(target,bot.grp.rotation.y);
    },980);
    setTimeout(()=>{ if(bot.sword) bot.sword.rotation.z=0; },1450);
  } else if(step.name==='Shadow Soldier'){
    if(abilityDemo.ally) scene.remove(abilityDemo.ally.grp);
    const a={...makeShadow(), life:999, atkCd:0, phase:Math.random()*10};
    const sx=b.x-abilityDemo.dir.x*.55+abilityDemo.side.x*.95;
    const sz=b.z-abilityDemo.dir.z*.55+abilityDemo.side.z*.95;
    a.grp.position.set(sx,b.y,sz);
    a.grp.rotation.y=forwardFacingYaw(tp.x-sx,tp.z-sz);
    const tag=makeNameTag('Shadow Soldier','#b08aff','summoned ally','#8b5cf6',{lvl:S.lvl,rank:'Ally'});
    tag.position.y=2.05; a.grp.add(tag);
    scene.add(a.grp); abilityDemo.ally=a;
    shadowSummonPortalVfx(a.grp.position.x,a.grp.position.y,a.grp.position.z);
    burst(a.grp.position.x,a.grp.position.y+1,a.grp.position.z,[.45,.3,.9],24,2.4,2.4,.6);
    const start=a.grp.position.clone();
    const end=new THREE.Vector3(tp.x-abilityDemo.dir.x*.85,tp.y,tp.z-abilityDemo.dir.z*.85);
    for(let k=0;k<34;k++){
      setTimeout(()=>{
        if(!abilityDemo || abilityDemo.ally!==a || !a.grp) return;
        const u=k/33, ease=1-Math.pow(1-u,3);
        a.grp.position.x=start.x+(end.x-start.x)*ease;
        a.grp.position.y=start.y+(end.y-start.y)*ease;
        a.grp.position.z=start.z+(end.z-start.z)*ease;
        a.grp.rotation.y=forwardFacingYaw(tp.x-a.grp.position.x,tp.z-a.grp.position.z);
        const sw=Math.sin(u*Math.PI*5)*.65;
        if(a.legs[0]) a.legs[0].rotation.x=sw;
        if(a.legs[1]) a.legs[1].rotation.x=-sw;
        if(Math.random()<.65) spawnParticle({x:a.grp.position.x,y:a.grp.position.y+.75+Math.random()*.8,z:a.grp.position.z,
          vx:0,vy:.32,vz:0,life:.42,grav:0,r:.42,g:.28,b:.9});
      }, k*24);
    }
    setTimeout(()=>{
      if(!abilityDemo || abilityDemo.ally!==a || !target || !target.grp) return;
      a.grp.rotation.y=forwardFacingYaw(target.grp.position.x-a.grp.position.x,target.grp.position.z-a.grp.position.z);
      if(a.arms[0]) a.arms[0].rotation.x=-1.2;
      if(a.arms[1]) a.arms[1].rotation.x=-.85;
      const p=target.grp.position;
      shadowSoldierStrikeVfx(p.x,p.y,p.z,a.grp.rotation.y);
      burst(p.x,p.y+1.25,p.z,[.55,.35,1],28,3.0,2.4,.65);
      shadowDashVfx({x:a.grp.position.x,y:a.grp.position.y,z:a.grp.position.z},{x:p.x,y:p.y,z:p.z});
      target.hitT=.25;
      target.mats.forEach(mm=>mm.color.setRGB(.62,.28,1));
      p.x+=abilityDemo.dir.x*.45; p.z+=abilityDemo.dir.z*.45;
    }, 900);
    setTimeout(()=>{
      if(!abilityDemo || abilityDemo.ally!==a || !a.grp) return;
      if(a.arms[0]) a.arms[0].rotation.x=0;
      if(a.arms[1]) a.arms[1].rotation.x=0;
      const guard={x:b.x+abilityDemo.dir.x*.75,y:b.y,z:b.z+abilityDemo.dir.z*.75};
      a.grp.position.set(guard.x,guard.y,guard.z);
      if(target && target.grp) a.grp.rotation.y=forwardFacingYaw(target.grp.position.x-guard.x,target.grp.position.z-guard.z);
      shadowGuardRing(guard.x,guard.y,guard.z);
    }, 1350);
  } else if(step.name==='Fireball'){
    const grp=new THREE.Group();
    grp.add(new THREE.Mesh(new THREE.SphereGeometry(.18,8,8), new THREE.MeshBasicMaterial({color:0xff8c20})));
    const gl=new THREE.Sprite(fireGlowMat.clone()); gl.material.opacity=.85; gl.scale.set(1.5,1.5,1); grp.add(gl);
    grp.position.set(b.x+d.x*.7,b.y+1.35,b.z+d.z*.7);
    scene.add(grp);
    const vel=new THREE.Vector3(tp.x-grp.position.x,tp.y+1-grp.position.y,tp.z-grp.position.z).normalize().multiplyScalar(15);
    projectiles.push({grp, vel, life:1.4});
  } else if(step.name==='Frost Nova'){
    frostNovaVfx(b.x,b.y,b.z,true);
    for(const m of abilityDemo.targets){
      m.slowT=2.5;
      m.mats.forEach(mm=>mm.color.setRGB(.55,.78,1));
      const p=m.grp.position;
      iceLockVfx(p.x,p.y,p.z);
    }
  } else if(step.name==='Chain Lightning' || step.name==='Lightning'){
    const pts=abilityDemo.targets.map(m=>({m,p:m.grp.position.clone()}));
    const jumps=[];
    for(let i=1;i<pts.length;i++){
      jumps.push({fromX:pts[i-1].p.x,fromY:pts[i-1].p.y+1.15,fromZ:pts[i-1].p.z,x:pts[i].p.x,y:pts[i].p.y,z:pts[i].p.z});
    }
    lightningStrikeVfx(pts[0].p.x,pts[0].p.y,pts[0].p.z,jumps);
    addLightningBeam(b.x,b.y+1.35,b.z,pts[0].p.x,pts[0].p.y+1.15,pts[0].p.z,1.65);
    pts.forEach(({m,p},i)=>{
      setTimeout(()=>{
        if(!abilityDemo || !m.grp) return;
        m.hitT=.35;
        m.slowT=2.2;
        m.mats.forEach(mm=>mm.color.setRGB(.72,.9,1));
        glowFlash(p.x,p.y+1.05,p.z,0xeaf6ff,3.2,.25);
        ringPulse(p.x,p.y+.08,p.z,1.15,0xbfe8ff,.42);
        burst(p.x,p.y+1.05,p.z,[.82,.94,1],28,3.8,3.2,.58);
        for(let k=0;k<3;k++){
          setTimeout(()=>addLightningBeam(
            p.x+(Math.random()-.5)*.6,p.y+1.6+Math.random()*.6,p.z+(Math.random()-.5)*.6,
            p.x+(Math.random()-.5)*1.2,p.y+.25+Math.random()*1.1,p.z+(Math.random()-.5)*1.2,
            .75
          ),k*55);
        }
        const push=.28+i*.08;
        m.grp.position.x+=abilityDemo.dir.x*push;
        m.grp.position.z+=abilityDemo.dir.z*push;
      },i*180);
    });
    camShake=Math.max(camShake,.42);
  } else if(step.name==='Iron Skin'){
    burst(b.x,b.y+1,b.z,[.95,.78,.3],30,2.6,2.4,.7);
    guardShellVfx(b.x,b.y,b.z,1.4);
  } else if(step.name==='Shockwave'){
    glowFlash(b.x,b.y+1.15,b.z,0xffd24a,2.8,.32);
    ringPulse(b.x,b.y+.08,b.z,.9,0xffd24a,.55);
    if(bot.arms[0]) bot.arms[0].rotation.x=-1.45;
    if(bot.arms[1]) bot.arms[1].rotation.x=-1.35;
    if(bot.sword) bot.sword.rotation.z=-.7;
    for(let k=0;k<8;k++){
      setTimeout(()=>{
        if(!abilityDemo || abilityDemo.bot!==bot) return;
        glowFlash(b.x,b.y+1.25,b.z,0xffd24a,1.7,.12);
        if(bot.sword) bot.sword.rotation.z=-.7+.18*Math.sin(k*.9);
      },k*70);
    }
    setTimeout(()=>{
      if(!abilityDemo || abilityDemo.bot!==bot) return;
      if(bot.arms[0]) bot.arms[0].rotation.x=-.35;
      if(bot.arms[1]) bot.arms[1].rotation.x=-.25;
      if(bot.sword) bot.sword.rotation.z=.85;
      shockwaveEarthVfx(b.x,b.y,b.z,true);
      for(const m of abilityDemo.targets){
        const start=m.grp.position.clone();
        const dx=start.x-b.x, dz=start.z-b.z, len=Math.hypot(dx,dz)||1;
        const delay=Math.min(520,Math.max(90,(len/5.5)*360));
        setTimeout(()=>{
          if(!abilityDemo || !m.grp) return;
          m.hitT=.28;
          m.mats.forEach(mm=>mm.color.setRGB(1,.72,.28));
          ringPulse(start.x,start.y+.08,start.z,.95,0xe0b15a,.45);
          burst(start.x,start.y+.55,start.z,[.86,.58,.28],18,2.8,2.4,.55);
          for(let k=0;k<18;k++){
            setTimeout(()=>{
              if(!abilityDemo || !m.grp) return;
              const u=k/17, ease=1-Math.pow(1-u,2);
              m.grp.position.x=start.x+dx/len*2.35*ease;
              m.grp.position.z=start.z+dz/len*2.35*ease;
              m.grp.position.y=start.y+Math.sin(u*Math.PI)*.55;
            },k*22);
          }
        },delay);
      }
      camShake=Math.max(camShake,.62);
    },620);
    setTimeout(()=>{ if(bot.sword) bot.sword.rotation.z=0; },1500);
  } else if(step.name==='Second Wind'){
    burst(b.x,b.y+1,b.z,[1,.12,.12],20,2.4,2.2,.55);
    glowFlash(b.x,b.y+1,b.z,0xff3030,2.4,.22);
    ringPulse(b.x,b.y+.08,b.z,1.05,0xff3030,.42);
    if(bot.arms[0]) bot.arms[0].rotation.x=.75;
    if(bot.arms[1]) bot.arms[1].rotation.x=.65;
    setTimeout(()=>{
      if(!abilityDemo) return;
      if(bot.arms[0]) bot.arms[0].rotation.x=-.55;
      if(bot.arms[1]) bot.arms[1].rotation.x=-.55;
      healingPlusVfx(b.x,b.y,b.z,1.2,1.25);
      setTimeout(()=>healingPlusVfx(b.x,b.y,b.z,.95,.95),260);
      showName('Second Wind: healed');
    },700);
    setTimeout(()=>{ if(bot.arms){ bot.arms[0].rotation.x=0; bot.arms[1].rotation.x=0; } },1650);
  } else if(step.name==='Aegis Pulse'){
    burst(b.x,b.y+1,b.z,[1,.82,.25],42,3.4,2.8,.9);
  } else if(step.name==='Blackhole Staff'){
    startBlackholeMob(target,false);
  } else if(step.name==='Chrono Dagger'){
    chronoSnapVfx(tp.x,tp.y,tp.z);
    const snap=tp.clone();
    target.slowT=2.5;
    target.mats.forEach(mm=>mm.color.setRGB(.35,1,.92));
    setTimeout(()=>{ if(target.grp){ target.grp.position.copy(snap); chronoSnapVfx(snap.x,snap.y,snap.z); } },1200);
  } else if(step.name==='Titan Hammer'){
    titanHammerVfx(b.x,b.y,b.z);
    for(const m of abilityDemo.targets){
      const p=m.grp.position, dx=p.x-b.x, dz=p.z-b.z, len=Math.hypot(dx,dz)||1;
      p.x+=dx/len*.9; p.z+=dz/len*.9; p.y+=.25;
    }
  } else if(step.name==='Meteor Staff'){
    meteorMarkVfx(tp.x,tp.y,tp.z);
    setTimeout(()=>{ if(target.grp){ const p=target.grp.position; meteorImpactVfx(p.x,p.y,p.z); } },1250);
  } else if(step.name==='Soul Reaper Scythe'){
    soulReapVfx(tp.x,tp.y,tp.z);
    target.mats.forEach(mm=>mm.color.setRGB(.62,.28,1));
  } else if(step.name==='Gravity Bow'){
    gravityBowVfx(tp.x,tp.y,tp.z);
    const start=tp.clone();
    for(let k=0;k<34;k++) setTimeout(()=>{ if(target.grp){ const u=k/33; target.grp.position.y=start.y+Math.sin(u*Math.PI)*4; } },k*45);
  } else if(step.name==='Warden Cleaver'){
    wardenSonicVfx(b.x,b.y,b.z,abilityDemo.dir.x,abilityDemo.dir.z);
    for(const m of abilityDemo.targets) m.mats.forEach(mm=>mm.color.setRGB(.2,.9,.85));
  } else if(step.name==='Eclipse Katana'){
    const behind={x:tp.x+abilityDemo.dir.x*1.3,y:tp.y,z:tp.z+abilityDemo.dir.z*1.3};
    eclipseDashVfx(b.x,b.y,b.z,behind.x,behind.y,behind.z);
    bot.grp.position.set(behind.x,behind.y,behind.z);
    target.mats.forEach(mm=>mm.color.setRGB(.45,.18,.9));
  } else if(step.name==='Phoenix Sword'){
    phoenixFlameVfx(tp.x,tp.y,tp.z,false);
    setTimeout(()=>phoenixFlameVfx(b.x,b.y,b.z,true),900);
  } else if(step.name==='Frostbite Chakram'){
    const pts=abilityDemo.targets.map(m=>{ const p=m.grp.position; m.slowT=2; m.mats.forEach(mm=>mm.color.setRGB(.55,.82,1)); return {x:p.x,y:p.y,z:p.z}; });
    frostbiteChakramVfx([{x:b.x,y:b.y,z:b.z},...pts]);
  } else if(step.name==='Midas Blade'){
    midasStrikeVfx(tp.x,tp.y,tp.z,12);
    target.mats.forEach(mm=>mm.color.setRGB(1,.82,.18));
  } else if(step.name==='Leviathan Trident'){
    const pts=abilityDemo.targets.map(m=>{ const p=m.grp.position; m.mats.forEach(mm=>mm.color.setRGB(.45,.85,1)); return {x:p.x,y:p.y,z:p.z}; });
    leviathanStormVfx([{x:b.x,y:b.y,z:b.z},...pts]);
  } else if(step.name==='Void Anchor'){
    const ax=b.x+abilityDemo.dir.x*2.4, az=b.z+abilityDemo.dir.z*2.4, ay=standHeight(ax,az,b.y+4);
    voidAnchorVfx(ax,ay>0?ay:b.y,az);
    for(const m of abilityDemo.targets) m.mats.forEach(mm=>mm.color.setRGB(.45,.18,.9));
  }
}
function updateAbilityDemo(dt, now){
  if(!abilityDemo || cutscene) return;
  abilityDemo.totalT+=dt; abilityDemo.stepT+=dt;
  const stepDur=3.4;
  const wanted=Math.floor(abilityDemo.totalT/stepDur)%DEMO_STEPS.length;
  if(wanted!==abilityDemo.step){
    abilityDemo.step=wanted; abilityDemo.stepT=0; abilityDemo.casted=false;
    const step=DEMO_STEPS[wanted];
    resetDemoTargets();
    const heldId=step.name==='Blackhole Staff'?138:step.name==='Umbral Edge'?136:step.name==='Chrono Dagger'?160:step.name==='Titan Hammer'?161:step.name==='Meteor Staff'?162:step.name==='Soul Reaper Scythe'?163:step.name==='Gravity Bow'?164:step.name==='Warden Cleaver'?165:step.name==='Eclipse Katana'?166:step.name==='Phoenix Sword'?167:step.name==='Frostbite Chakram'?168:step.name==='Midas Blade'?169:step.name==='Leviathan Trident'?170:step.name==='Void Anchor'?171:0;
    rebuildDemoBot(step.path, heldId, step.name==='Aegis Pulse'||step.path==='guardian'?137:0);
  }
  const step=DEMO_STEPS[abilityDemo.step];
  const bot=abilityDemo.bot;
  const b=abilityDemo.base;
  bot.grp.position.x+=(b.x-bot.grp.position.x)*Math.min(1,dt*6);
  bot.grp.position.y+=(b.y-bot.grp.position.y)*Math.min(1,dt*6);
  bot.grp.position.z+=(b.z-bot.grp.position.z)*Math.min(1,dt*6);
  bot.grp.rotation.y=avatarFacingYaw(abilityDemo.dir.x,abilityDemo.dir.z);
  const sw=Math.sin(now/1000*1.4+bot.phase)*.03;
  bot.legs[0].rotation.x=sw; bot.legs[1].rotation.x=-sw;
  for(const a of bot.arms) a.rotation.x*=.82;
  pulseAegisGlow(bot, now);
  if(step && abilityDemo.stepT>.55 && !abilityDemo.casted){
    abilityDemo.casted=true;
    runDemoEffect(step);
  }
  demoCastPose(bot, Math.max(0,abilityDemo.stepT-.45));
}

// ---------------- intro cutscene: a cinematic ability showcase on first reaching Level 2 ----------------
let cutscene=null;
let gateCutscenePending=false;
let gateCutsceneReturn=null;
function queueGateUnlockCutscene(){
  gateCutscenePending=true;
  setTimeout(()=>tryStartQueuedGateCutscene(),650);
}
function tryStartQueuedGateCutscene(){
  if(!gateCutscenePending || gateCutsceneSeen() || !gateSystemUnlocked()) return false;
  if(cutscene || dim!=='overworld' || qOpen || uiOpen || statOpen || pathChoiceOpen || abilityAwakeningOpen || abilityTrainingActive) return false;
  if(startGateUnlockCutscene(false)){ gateCutscenePending=false; markGateCutsceneSeen(); return true; }
  return false;
}
function cutscenePreviewLoadout(path, slot){
  if(path==='shadow') return slot===1 ? {held:136, armor:0} : slot===2 ? {held:0, armor:0} : {held:166, armor:0};
  if(path==='guardian') return slot===1 ? {held:161, armor:137} : {held:0, armor:137};
  return slot===1 ? {held:0, armor:0} : slot===2 ? {held:0, armor:0} : {held:162, armor:0};
}
function abilityCutsceneDescription(path, slot){
  const copy={
    shadow:[
      'Blink forward to reposition or close the gap.',
      'Your weapon glows with bonus melee damage.',
      'Summon an ally that attacks, then guards your front.'
    ],
    mage:[
      'Fire a ranged projectile that explodes on impact.',
      'Freeze nearby enemies and slow the fight down.',
      'Strike one target, then chain lightning to others.'
    ],
    guardian:[
      'Wrap yourself in armor and reduce incoming damage.',
      'Slam the ground to push enemies back.',
      'Near defeat, recover and turn the fight around.'
    ]
  };
  return copy[path]&&copy[path][slot] || (PATHS[path]&&PATHS[path].ab[slot]&&PATHS[path].ab[slot].txt) || '';
}
function buildCutsceneShots(path){
  path=PATHS[path]?path:'shadow';
  const ab=PATHS[path].ab;
  const q=cutscenePreviewLoadout(path,0), r=cutscenePreviewLoadout(path,1), h=cutscenePreviewLoadout(path,2);
  return [
    {cap:PATHS[path].name, sub:'Your path awakens in the training meadow. Watch the target dummies.', path, held:q.held, armor:q.armor, name:null, dur:4.0, cam:'wide'},
    {cap:'Unlocked now: Q - '+ab[0].n, sub:abilityCutsceneDescription(path,0), path, held:q.held, armor:q.armor, name:ab[0].n, dur:7.0, castAt:2.6, cam:'hero', slot:0},
    {cap:'Later: Level 5 - '+ab[1].n, sub:abilityCutsceneDescription(path,1), path, held:r.held, armor:r.armor, name:ab[1].n, dur:6.0, castAt:2.4, cam:'side', slot:1, preview:true},
    {cap:'Later: Level 8 - '+ab[2].n, sub:abilityCutsceneDescription(path,2), path, held:h.held, armor:h.armor, name:ab[2].n, dur:6.0, castAt:2.4, cam:'side2', slot:2, preview:true},
  ];
}
function cineSetBars(on){ const o=document.getElementById('cine'); if(o) o.classList.toggle('show',!!on); }
function cineTitle(t,sub){ const a=document.getElementById('cinetitle'),b=document.getElementById('cinetitlesub'),w=document.getElementById('cinetitlewrap'); if(a)a.textContent=t||''; if(b)b.textContent=sub||''; if(w)w.style.opacity=t?1:0; }
function cineSub(s){ const e=document.getElementById('cinesub'); if(e){ e.textContent=s||''; e.style.opacity=s?1:0; } }
function cineFade(a){ const e=document.getElementById('cinefade'); if(e) e.style.opacity=a; }
function cutsceneSeen(){ try{ return serverTutorials.intro>=1||localStorage.getItem('bc_introcut')==='1'; }catch(e){ return serverTutorials.intro>=1; } }
function markCutsceneSeen(){ try{ localStorage.setItem('bc_introcut','1'); }catch(e){} markTutorialComplete('intro',1); }
function resetCutsceneSeen(){ try{ localStorage.removeItem('bc_introcut'); }catch(e){} }
function runLevel2CutsceneThenTutorial(){
  if(S.lvl<2 || !S.path || dim!=='overworld' || cutsceneSeen()) return false;
  markCutsceneSeen();
  return startIntroCutscene(false);
}
function generateGateVisionRoom(){
  const cx=64, z0=38, z1=92, y=8;
  const minX=cx-13,maxX=cx+13,minZ=z0-4,maxZ=z1+4;
  const w=new DimensionGrid({kind:'event',id:'gate-cutscene',originX:minX,originZ:minZ,width:maxX-minX+1,height:y+9,depth:maxZ-minZ+1,empty:B.AIR,outside:B.AIR});
  for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++) w.setB(x,0,z,B.BEDROCK);
  carveBox(w,cx-11,1,z0-4,cx+11,y-2,z1+4,B.STONE);
  carveBox(w,cx-8,y,z0,cx+8,y,z1,B.COBBLE);
  carveBox(w,cx-7,y+1,z0+1,cx+7,y+7,z1-1,B.AIR);
  carveBox(w,cx-10,y+1,z0-3,cx+10,y+8,z0+5,B.AIR);
  carveBox(w,cx-13,y,z1-12,cx+13,y,z1+4,B.BRICK);
  carveBox(w,cx-12,y+1,z1-11,cx+12,y+8,z1+3,B.AIR);
  for(let z=z0;z<=z1;z+=7){ w.setB(cx-8,y+1,z,B.TORCH); w.setB(cx+8,y+1,z,B.TORCH); }
  for(let x=cx-9;x<=cx+9;x++){ w.setB(x,y+1,z1+4,B.BRICK); w.setB(x,y+5,z1+4,B.BRICK); }
  return w;
}
function gateBossTexture(base='#1a0715', crack='#5a1832', rune='#ff315f'){
  const c=document.createElement('canvas'); c.width=c.height=64;
  const g=c.getContext('2d');
  g.fillStyle=base; g.fillRect(0,0,64,64);
  for(let i=0;i<42;i++){
    const x=(i*17+9)%64, y=(i*29+13)%64;
    g.fillStyle=i%4===0?'rgba(255,49,95,.42)':'rgba(255,255,255,.055)';
    g.fillRect(x,y,1+(i%3),1);
  }
  g.strokeStyle=crack; g.lineWidth=1;
  for(let i=0;i<9;i++){
    const x=(i*11+7)%64, y=(i*19+5)%64;
    g.beginPath(); g.moveTo(x,y); g.lineTo((x+8+i*3)%64,(y+5+i*7)%64); g.lineTo((x+14+i*5)%64,(y+11+i*3)%64); g.stroke();
  }
  g.strokeStyle=rune; g.globalAlpha=.55;
  for(let i=0;i<5;i++){
    const x=8+i*11, y=10+(i%2)*25;
    g.strokeRect(x,y,5,9);
    g.beginPath(); g.moveTo(x+2,y); g.lineTo(x+2,y+9); g.moveTo(x,y+5); g.lineTo(x+5,y+5); g.stroke();
  }
  g.globalAlpha=1;
  const tex=new THREE.CanvasTexture(c);
  tex.magFilter=THREE.NearestFilter; tex.minFilter=THREE.NearestFilter;
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  tex.repeat.set(2,2);
  return tex;
}
function gateLegendaryTexture(base='#ffd24a', line='#fff1a8', rune='#ffffff'){
  const c=document.createElement('canvas'); c.width=c.height=64;
  const g=c.getContext('2d');
  const gr=g.createLinearGradient(0,0,64,64);
  gr.addColorStop(0,base); gr.addColorStop(.45,line); gr.addColorStop(1,'#b36b16');
  g.fillStyle=gr; g.fillRect(0,0,64,64);
  g.globalAlpha=.45; g.strokeStyle='#ffffff'; g.lineWidth=1;
  for(let i=0;i<10;i++){ g.beginPath(); g.moveTo((i*13)%64,0); g.lineTo((i*13+28)%64,64); g.stroke(); }
  g.globalAlpha=.7; g.strokeStyle=rune;
  for(let i=0;i<6;i++){
    const x=7+i*9, y=8+(i%3)*13;
    g.strokeRect(x,y,4,8);
    g.beginPath(); g.moveTo(x+2,y); g.lineTo(x+2,y+8); g.moveTo(x,y+4); g.lineTo(x+4,y+4); g.stroke();
  }
  g.globalAlpha=1;
  const tex=new THREE.CanvasTexture(c);
  tex.magFilter=THREE.NearestFilter; tex.minFilter=THREE.NearestFilter;
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  tex.repeat.set(1,2);
  return tex;
}
function gateObsidianTexture(base='#14121b', vein='#ff5a1e', spark='#ff9a4d'){
  const c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d');
  g.fillStyle=base; g.fillRect(0,0,64,64);
  for(let i=0;i<64;i++){ const x=(i*23+7)%64,y=(i*41+11)%64; g.fillStyle=i%5===0?'rgba(255,255,255,.06)':'rgba(0,0,0,.20)'; g.fillRect(x,y,1+(i%2),1); }
  g.strokeStyle=vein; g.lineWidth=1; g.globalAlpha=.8;
  for(let i=0;i<6;i++){ let x=(i*13+5)%64,y=(i*7)%64; g.beginPath(); g.moveTo(x,y); for(let k=0;k<4;k++){ x=(x+6+i)%64; y=(y+9+k*2)%64; g.lineTo(x,y);} g.stroke(); }
  g.globalAlpha=1; g.fillStyle=spark;
  for(let i=0;i<10;i++){ g.fillRect((i*19+3)%64,(i*27+9)%64,1,1); }
  const tex=new THREE.CanvasTexture(c); tex.magFilter=THREE.NearestFilter; tex.minFilter=THREE.NearestFilter;
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(2,2);
  return tex;
}
function gateVisionBossGroup(x,y,z){
  // "Refined knight": tapered obsidian plate armour, horned helm with a glowing
  // visor, tattered cape, and a planted greatsword the gauntlets rest on. Cool
  // dark armour with molten-ember accents instead of the old muddy maroon blob.
  const grp=new THREE.Group();
  const plateTex=gateObsidianTexture('#14121b','#ff5a1e','#ff9a4d');
  const darkMat =new THREE.MeshLambertMaterial({color:0x17151f,emissive:0x070608,map:plateTex});
  const plateMat=new THREE.MeshLambertMaterial({color:0x2a2735,emissive:0x0c0a12,map:plateTex});
  const steelMat=new THREE.MeshLambertMaterial({color:0x3a3950,emissive:0x0e0d16});
  const bladeMat=new THREE.MeshLambertMaterial({color:0xb8c0d4,emissive:0x1a1d28});
  const capeMat =new THREE.MeshLambertMaterial({color:0x24101a,emissive:0x0a0306,side:THREE.DoubleSide});
  const ember   =new THREE.MeshBasicMaterial({color:0xff6a22,transparent:true,opacity:.95,blending:THREE.AdditiveBlending,depthWrite:false});
  const emberHot=new THREE.MeshBasicMaterial({color:0xffd28a,transparent:true,opacity:.98,blending:THREE.AdditiveBlending,depthWrite:false});
  const add=(geo,mat,px,py,pz,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0,parent=grp)=>{
    const m=new THREE.Mesh(geo,mat);
    m.position.set(px,py,pz); m.scale.set(sx,sy,sz); m.rotation.set(rx,ry,rz);
    parent.add(m); return m;
  };
  // ---- legs (planted, sabatons) ----
  ['L','R'].forEach(side=>{
    const s=side==='L'?-1:1;
    const leg=new THREE.Group(); leg.position.set(s*.5,.95,0); grp.add(leg);
    add(new THREE.BoxGeometry(.5,1.0,.55),darkMat,0,-.4,0,1,1,1,0,0,0,leg);
    add(new THREE.BoxGeometry(.46,.95,.5),plateMat,0,-1.35,.02,1,1,1,0,0,0,leg);
    add(new THREE.BoxGeometry(.6,.22,.82),plateMat,0,-1.92,-.16,1,1,1,0,0,0,leg);
    add(new THREE.BoxGeometry(.14,.55,.12),ember,0,-1.3,-.28,1,1,1,0,0,0,leg);
  });
  // ---- hips / belt / tassets ----
  add(new THREE.BoxGeometry(1.25,.5,.62),plateMat,0,1.15,0,1,1,1,0,0,0);
  add(new THREE.BoxGeometry(1.45,.3,.7),steelMat,0,1.45,0,1,1,1,0,0,0);
  add(new THREE.BoxGeometry(.2,.34,.12),ember,0,1.45,-.36,1,1,1,0,0,0);
  [-1,1].forEach(s=>add(new THREE.BoxGeometry(.42,.62,.2),plateMat,s*.42,1.0,-.34,1,1,1,0,0,s*.06));
  // ---- torso: tapered chestplate, V-shape ----
  const torso=new THREE.Group(); torso.position.y=2.45; grp.add(torso);
  add(new THREE.BoxGeometry(1.45,1.3,.78),darkMat,0,0,0,1,1,1,0,0,0,torso);
  add(new THREE.BoxGeometry(1.75,.55,.86),plateMat,0,.5,0,1,1,1,0,0,0,torso);
  add(new THREE.BoxGeometry(1.3,1.0,.22),plateMat,0,.05,-.4,1,1,1,0,0,0,torso);
  add(new THREE.BoxGeometry(.92,.3,.5),steelMat,0,.78,-.04,1,1,1,0,0,0,torso);
  const chest=add(new THREE.OctahedronGeometry(.32,0),ember,0,.18,-.52,1,1,.5,0,0,0,torso); chest.userData.pulse=true;
  for(let i=0;i<3;i++){ add(new THREE.BoxGeometry(.7-i*.13,.07,.12),ember,0,-.18-i*.22,-.5,1,1,1,0,0,0,torso); }
  // ---- pauldrons + arms gripping the sword ----
  ['L','R'].forEach(side=>{
    const s=side==='L'?-1:1;
    const pa=add(new THREE.BoxGeometry(.98,.72,.98),plateMat,s*1.35,3.0,0,1,1,1,0,0,s*.18); pa.userData.float=s>0?1:0;
    add(new THREE.BoxGeometry(1.04,.28,1.04),steelMat,s*1.4,3.32,0,1,1,1,0,0,s*.2);
    for(let c=0;c<3;c++){ add(new THREE.ConeGeometry(.1,.6,4),steelMat,s*(1.12+c*.22),3.5,(c-1)*.32,1,1,1,0,0,s*.25); }
    add(new THREE.ConeGeometry(.13,.5,4),ember,s*1.4,3.18,-.5,1,1,1,Math.PI*.5,0,0);
    const arm=new THREE.Group(); arm.position.set(s*1.25,2.85,0); grp.add(arm);
    add(new THREE.BoxGeometry(.4,1.0,.42),darkMat,-s*.18,-.5,-.06,1,1,1,0,0,s*.16,arm);
    add(new THREE.BoxGeometry(.36,.46,.4),plateMat,-s*.62,-.95,-.5,1,1,1,.7,0,s*.05,arm);
    add(new THREE.BoxGeometry(.36,.36,.4),steelMat,-s*1.05,-1.1,-.92,1,1,1,0,0,0,arm);
  });
  // ---- neck + horned helm with glowing visor ----
  add(new THREE.BoxGeometry(.4,.32,.4),darkMat,0,3.35,-.05,1,1,1,0,0,0);
  const helm=new THREE.Group(); helm.position.set(0,3.78,-.05); grp.add(helm);
  add(new THREE.BoxGeometry(.72,.7,.72),darkMat,0,0,0,1,1,1,0,0,0,helm);
  add(new THREE.BoxGeometry(.78,.26,.78),plateMat,0,.3,0,1,1,1,0,0,0,helm);
  add(new THREE.BoxGeometry(.52,.46,.22),plateMat,0,-.12,-.34,1,1,1,.16,0,0,helm);
  add(new THREE.BoxGeometry(.5,.08,.12),emberHot,0,.02,-.4,1,1,1,0,0,0,helm);
  add(new THREE.BoxGeometry(.08,.3,.12),emberHot,0,-.14,-.4,1,1,1,0,0,0,helm);
  [-1,1].forEach(s=>{
    add(new THREE.ConeGeometry(.12,1.1,4),steelMat,s*.32,.42,.26,1,1,1,-.5,0,s*.3,helm);
    add(new THREE.ConeGeometry(.09,.78,4),steelMat,s*.16,.48,.2,1,1,1,-.62,0,s*.16,helm);
  });
  add(new THREE.ConeGeometry(.1,.72,4),steelMat,0,.52,.22,1,1,1,-.55,0,0,helm);
  // ---- tattered cape behind ----
  const cape=new THREE.Group(); cape.position.set(0,3.05,.46); grp.add(cape);
  add(new THREE.BoxGeometry(1.85,2.6,.08),capeMat,0,-1.1,0,1,1,1,.13,0,0,cape);
  for(let i=0;i<4;i++){ add(new THREE.BoxGeometry(.38,.72,.06),capeMat,(i-1.5)*.44,-2.55,.07,1,1,1,.13,0,0,cape); }
  add(new THREE.BoxGeometry(1.5,.2,.1),ember,0,.22,-.06,1,1,1,0,0,0,cape);
  // ---- planted greatsword (point down, gauntlets at the grip) ----
  const sword=new THREE.Group(); sword.position.set(0,0,-.98); grp.add(sword);
  add(new THREE.BoxGeometry(.34,2.7,.1),bladeMat,0,1.0,0,1,1,1,0,0,0,sword);
  add(new THREE.ConeGeometry(.18,.55,4),bladeMat,0,-.6,0,1,1,1,Math.PI,Math.PI/4,0,sword);
  add(new THREE.BoxGeometry(.06,2.5,.13),ember,0,1.0,0,1,1,1,0,0,0,sword);
  add(new THREE.BoxGeometry(1.15,.18,.24),steelMat,0,2.42,0,1,1,1,0,0,0,sword);
  add(new THREE.ConeGeometry(.09,.32,4),ember,-.6,2.42,0,1,1,1,0,0,Math.PI/2,sword);
  add(new THREE.ConeGeometry(.09,.32,4),ember,.6,2.42,0,1,1,1,0,0,-Math.PI/2,sword);
  add(new THREE.CylinderGeometry(.08,.08,.6,8),darkMat,0,2.8,0,1,1,1,0,0,0,sword);
  add(new THREE.OctahedronGeometry(.15,0),emberHot,0,3.16,0,1,1,1,0,0,0,sword);
  // ---- ambient rings + aura ----
  const ring1=add(new THREE.TorusGeometry(1.7,.03,6,32),ember,0,.18,0,1,1,.3,Math.PI/2,0,0); ring1.userData.spinRing=.5;
  const ring2=add(new THREE.TorusGeometry(2.2,.025,6,32),ember,0,.42,0,1,1,.25,Math.PI/2,0,0); ring2.userData.spinRing=-.35;
  const aura=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas), color:0xff5320, transparent:true, opacity:.4, blending:THREE.AdditiveBlending, depthWrite:false}));
  aura.position.y=2.4; aura.scale.set(8.8,8.8,1); aura.userData.aura=true; grp.add(aura);
  const label=makeTextSprite('GATE LORD: VAELGOR','#ff9a5a');
  label.position.set(0,5.3,0); label.scale.set(5.2,1.25,1); grp.add(label);
  grp.userData={baseScale:.6, chest, aura, model:true};
  grp.scale.setScalar(grp.userData.baseScale);
  grp.position.set(x,y,z);
  return grp;
}
function gateVisionWeaponGroup(x,y,z){
  const grp=new THREE.Group();
  const goldTex=gateLegendaryTexture();
  const base=new THREE.Mesh(new THREE.CylinderGeometry(1.15,1.45,.28,8),new THREE.MeshLambertMaterial({color:0x2b2538}));
  base.position.y=.14; grp.add(base);
  const floatY=.72;
  const baseGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas), color:0xffb000, transparent:true, opacity:.34, blending:THREE.AdditiveBlending, depthWrite:false}));
  baseGlow.position.y=.45; baseGlow.scale.set(4.4,2.2,1); baseGlow.userData.aura=true; grp.add(baseGlow);
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas), color:0xffd24a, transparent:true, opacity:.68, blending:THREE.AdditiveBlending, depthWrite:false}));
  glow.position.y=1.58+floatY; glow.scale.set(5.8,5.8,1); glow.userData.aura=true; grp.add(glow);
  const bladeMat=new THREE.MeshLambertMaterial({color:0xffd24a,emissive:0x5a2a00,map:goldTex});
  const edgeMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.75,blending:THREE.AdditiveBlending,depthWrite:false});
  const core=new THREE.Group(); core.position.y=floatY; core.rotation.z=-.2; core.userData.weaponCore=true; grp.add(core);
  const blade=new THREE.Mesh(new THREE.ConeGeometry(.26,2.55,4),bladeMat);
  blade.position.y=1.72; blade.rotation.y=Math.PI/4; blade.userData.spin=true; core.add(blade);
  const bladeEdgeL=new THREE.Mesh(new THREE.BoxGeometry(.035,2.25,.035),edgeMat);
  bladeEdgeL.position.set(-.15,1.6,-.02); bladeEdgeL.rotation.z=.03; core.add(bladeEdgeL);
  const bladeEdgeR=bladeEdgeL.clone(); bladeEdgeR.position.x=.15; bladeEdgeR.rotation.z=-.03; core.add(bladeEdgeR);
  const hilt=new THREE.Mesh(new THREE.BoxGeometry(1.05,.15,.18),new THREE.MeshLambertMaterial({color:0xfff0bc,emissive:0x6b3500,map:goldTex}));
  hilt.position.set(0,.55,0); core.add(hilt);
  const grip=new THREE.Mesh(new THREE.CylinderGeometry(.095,.12,.68,8),new THREE.MeshLambertMaterial({color:0x3b2348,emissive:0x120618}));
  grip.position.y=.2; core.add(grip);
  const pommel=new THREE.Mesh(new THREE.OctahedronGeometry(.18,0),edgeMat);
  pommel.position.y=-.2; core.add(pommel);
  const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.18,0),new THREE.MeshBasicMaterial({color:0xff4a6a,transparent:true,opacity:.95,blending:THREE.AdditiveBlending}));
  gem.position.y=.58; gem.userData.pulse=true; core.add(gem);
  const ring1=new THREE.Mesh(new THREE.TorusGeometry(.78,.025,6,32),edgeMat);
  ring1.position.y=1.2+floatY; ring1.rotation.x=Math.PI/2; ring1.userData.spinRing=.9; grp.add(ring1);
  const ring2=new THREE.Mesh(new THREE.TorusGeometry(1.05,.022,6,32),edgeMat);
  ring2.position.y=1.55+floatY; ring2.rotation.x=Math.PI/2; ring2.userData.spinRing=-.55; grp.add(ring2);
  const label=makeTextSprite('A LEGENDARY WEAPON SLEEPS','#ffd24a');
  label.position.set(0,3.45,0); label.scale.set(5.2,1.15,1); grp.add(label);
  grp.position.set(x,y,z);
  return grp;
}
function addGateCutsceneLights(set,cx){
  const fill=new THREE.AmbientLight(0x8b7fb8,.38);
  set.add(fill);
  const top=new THREE.PointLight(0xa698ff,1.25,65,1.35);
  top.position.set(cx,18,66); set.add(top);
  const portalL=new THREE.PointLight(0x6ee06a,2.0,32,1.55);
  portalL.position.set(cx,12.0,45); set.add(portalL);
  const hallL=new THREE.PointLight(0x7b6dff,.92,45,1.7);
  hallL.position.set(cx,13.5,64); set.add(hallL);
  const bossKey=new THREE.PointLight(0xff3d68,2.8,44,1.45);
  bossKey.position.set(cx-4.5,14.3,76); set.add(bossKey);
  const bossRim=new THREE.PointLight(0xff9ab0,1.75,36,1.35);
  bossRim.position.set(cx+6.5,15.5,89); set.add(bossRim);
  const lootL=new THREE.PointLight(0xffd24a,2.25,34,1.45);
  lootL.position.set(cx+8.4,12.9,82.2); set.add(lootL);
  set.userData.cutsceneLights={top,portalL,hallL,bossKey,bossRim,lootL};
}
function startGateUnlockCutscene(replay=false){
  if(cutscene || typeof THREE==='undefined' || dim!=='overworld') return false;
  const ret={world, dungeon, exitPortal, gate, pos:player.pos.clone(), yaw:player.yaw, pitch:player.pitch};
  gateCutsceneReturn=ret;
  if(COMPANIONS.mounted){ COMPANIONS.mounted=false; COMPANIONS.mountKind=''; if(COMPANIONS.localMountObj) COMPANIONS.localMountObj.visible=false; }
  const cx=64, y=9.01;
  owWorld=world; world=generateGateVisionRoom(); dungeon=null; dim='gatecutscene';
  rebuildAllChunks(); refreshTorchMeshes(); applyDim();
  player.pos.set(cx,y,43); player.vel.set(0,0,0); player.yaw=0; player.pitch=0;
  const set=new THREE.Group();
  const portal=makeGateMesh(RANKS[0].col);
  portal.position.set(cx,9,45);
  portal.scale.setScalar(1.15);
  set.add(portal);
  const gateLabel=makeTextSprite('THE FIRST GATE HAS OPENED','#9dffb4');
  gateLabel.position.set(cx,12.3,45); gateLabel.scale.set(5.4,1.25,1); set.add(gateLabel);
  const boss=gateVisionBossGroup(cx,9.05,84);
  boss.visible=false; set.add(boss);
  const weapon=gateVisionWeaponGroup(cx+8.4,9.08,82.2);
  weapon.visible=false; set.add(weapon);
  addGateCutsceneLights(set,cx);
  scene.add(set);
  cutscene={
    kind:'gateUnlock', phase:'gate', t:0, totalT:0, replay:!!replay,
    set, portal, boss, weapon,
    shots:{
      gateA:{x:cx-7.6,y:12.7,z:36.2, look:{x:cx,y:11.15,z:45.1}},
      gateB:{x:cx-.35,y:11.25,z:42.25, look:{x:cx,y:11.0,z:46.7}},
      hallA:{x:cx-.2,y:10.75,z:48.0, look:{x:cx,y:10.55,z:64}},
      hallB:{x:cx+2.7,y:11.15,z:67.5, look:{x:cx,y:11.25,z:82.5}},
      bossWideA:{x:cx-6.4,y:15.8,z:36.5, look:{x:cx,y:12.25,z:84.0}},
      bossWideB:{x:cx+6.2,y:16.15,z:42.5, look:{x:cx,y:12.35,z:84.0}},
      lootA:{x:cx+12.0,y:13.45,z:76.4, look:{x:cx+8.4,y:11.3,z:82.2}},
      lootB:{x:cx+11.6,y:12.65,z:78.8, look:{x:cx+8.4,y:11.15,z:82.2}},
    }
  };
  document.body.classList.add('cutscene');
  cineFade(0); cineSetBars(true);
  cineTitle('LEVEL 3 - A GATE ANSWERS','The air folds open. Something below the world looks back.');
  cineSub('Gather at Gates to enter dungeons, face bosses, and claim weapons no shop can sell.');
  if(typeof SFX!=='undefined'){ if(SFX.portal) SFX.portal(); if(SFX.level) SFX.level(); }
  burst(portal.position.x, portal.position.y+1.8, portal.position.z, hex01(RANKS[0].col), 64, 4.8, 4.6, 1.1);
  return true;
}
function gateCutsceneCamera(cs, a, b, u, drift=0){
  u=Math.max(0,Math.min(1,u));
  const e=u<.5 ? 2*u*u : 1-Math.pow(-2*u+2,2)/2;
  const p={x:a.x+(b.x-a.x)*e,y:a.y+(b.y-a.y)*e,z:a.z+(b.z-a.z)*e};
  const la=a.look||a, lb=b.look||b;
  const l={x:la.x+(lb.x-la.x)*e,y:la.y+(lb.y-la.y)*e,z:la.z+(lb.z-la.z)*e};
  if(drift){
    p.x+=Math.sin((cs.totalT||0)*1.7)*drift;
    p.y+=Math.sin((cs.totalT||0)*1.15+.8)*drift*.28;
    l.x+=Math.sin((cs.totalT||0)*1.25+1.5)*drift*.22;
  }
  camera.up.set(0,1,0);
  camera.position.set(p.x,p.y,p.z);
  camera.lookAt(l.x,l.y,l.z);
}
function tickGateCutscene(now,dt){
  const cs=cutscene; if(!cs) return;
  cs.t+=dt; cs.totalT=(cs.totalT||0)+dt;
  if(cs.portal){
    cs.portal.rotation.y+=dt*.75;
    const s=1+Math.sin(now*.006)*.06;
    cs.portal.userData.ring.scale.set(s,s,1);
  }
  const ls=cs.set&&cs.set.userData&&cs.set.userData.cutsceneLights;
  if(ls){
    if(ls.portalL) ls.portalL.intensity=1.8+Math.sin(now*.006)*.35;
    if(ls.bossKey) ls.bossKey.intensity=2.45+Math.sin(now*.004+1.1)*.55;
    if(ls.bossRim) ls.bossRim.intensity=1.45+Math.sin(now*.005+2.4)*.35;
    if(ls.lootL) ls.lootL.intensity=1.45+Math.sin(now*.007)*.3;
  }
  if(cs.loot){
    cs.loot.rotation.y+=dt*.35;
    cs.loot.children.forEach(ch=>{ if(ch.userData&&ch.userData.spin) ch.rotation.y+=dt*2.6; });
  }
  if(cs.weapon){
    cs.weapon.rotation.y+=dt*.25;
    cs.weapon.traverse(ch=>{
      if(!ch.userData) return;
      if(ch.userData.spin) ch.rotation.y+=dt*1.2;
      if(ch.userData.spinRing) ch.rotation.z+=dt*ch.userData.spinRing;
      if(ch.userData.pulse){
        const s=1+Math.sin(now*.008)*.2;
        ch.scale.set(s,s,s);
      }
      if(ch.userData.aura){
        if(ch.userData.baseScale===undefined) ch.userData.baseScale=ch.scale.x||1;
        if(ch.userData.baseOpacity===undefined && ch.material) ch.userData.baseOpacity=ch.material.opacity||.5;
        const s=1+Math.sin(now*.004)*.08;
        ch.scale.set(ch.userData.baseScale*s,ch.userData.baseScale*s,1);
        if(ch.material) ch.material.opacity=Math.max(.22,Math.min(.78,(ch.userData.baseOpacity||.5)+Math.sin(now*.004)*.08));
      }
    });
    if(Math.random()<dt*18){
      const p=cs.weapon.position;
      spawnParticle({x:p.x+(Math.random()-.5)*1.6,y:p.y+.6+Math.random()*2.1,z:p.z+(Math.random()-.5)*1.6,vx:(Math.random()-.5)*.25,vy:.25+Math.random()*.28,vz:(Math.random()-.5)*.25,life:.8,grav:0,r:1,g:.78,b:.2});
    }
  }
  if(cs.boss){
    cs.boss.rotation.y=Math.sin(now*.0016)*.18;
    const pulse=1+Math.sin(now*.005)*.035;
    cs.boss.scale.setScalar((cs.boss.userData&&cs.boss.userData.baseScale||1)*pulse);
    cs.boss.traverse(ch=>{
      if(!ch.userData) return;
      if(ch.userData.spinRing) ch.rotation.z+=dt*ch.userData.spinRing;
      if(ch.userData.pulse){
        const s=1+Math.sin(now*.009)*.18;
        ch.scale.set(s,s,.28);
      }
      if(ch.userData.aura){
        const s=8.8+Math.sin(now*.0035)*.55;
        ch.scale.set(s,s,1);
        if(ch.material) ch.material.opacity=.34+Math.sin(now*.004)*.1;
      }
      if(ch.userData.float!==undefined){
        if(ch.userData.baseY===undefined) ch.userData.baseY=ch.position.y;
        ch.position.y=ch.userData.baseY+Math.sin(now*.003+ch.userData.float)*.08;
      }
      if(ch.userData.armSide) ch.rotation.z=ch.userData.armSide*(.24+Math.sin(now*.003)*.08);
      if(ch.userData.legSide) ch.rotation.z=ch.userData.legSide*(.035+Math.sin(now*.0024+1.2)*.025);
    });
  }
  const sh=cs.shots||{};
  if(cs.phase==='gate'){
    gateCutsceneCamera(cs, sh.gateA, sh.gateB, cs.t/2.35, .04);
    cineFade(Math.max(0,1-cs.t/1.2));
    if(cs.t>2.35){ cs.phase='dive'; cs.t=0; cineTitle('',''); cineSub('The camera passes through the Gate. The dungeon answers with stone and silence.'); if(SFX.portal)SFX.portal(); }
  } else if(cs.phase==='dive'){
    gateCutsceneCamera(cs, sh.hallA, sh.hallB, cs.t/3.0, .055);
    cineFade(cs.t<.28 ? Math.max(0,1-cs.t/.28) : 0);
    if(cs.t>3.0){ cs.phase='boss'; cs.t=0; if(cs.boss)cs.boss.visible=true; cineSub('At the end of each dungeon waits a boss built to test the whole party.'); if(SFX.boom)SFX.boom(); camShake=Math.max(camShake,1.0); }
  } else if(cs.phase==='boss'){
    gateCutsceneCamera(cs, sh.bossWideA, sh.bossWideB, cs.t/4.3, .055);
    camShake=Math.max(camShake, cs.t<.8 ? .22 : .1);
    if(Math.random()<dt*30 && cs.boss){
      const p=cs.boss.position;
      spawnParticle({x:p.x+(Math.random()-.5)*4,y:p.y+1+Math.random()*3,z:p.z+(Math.random()-.5)*4,vx:(Math.random()-.5)*.5,vy:.35+Math.random()*.4,vz:(Math.random()-.5)*.5,life:.9,grav:0,r:1,g:.18,b:.28});
    }
    if(cs.t>4.3){ cs.phase='loot'; cs.t=0; if(cs.boss)cs.boss.visible=false; if(cs.weapon)cs.weapon.visible=true; cineSub('Clear the Gate and the dungeon can answer with unique legendary weapons.'); if(SFX.coin)SFX.coin(); }
  } else if(cs.phase==='loot'){
    gateCutsceneCamera(cs, sh.lootA, sh.lootB, cs.t/3.2, .035);
    if(cs.t>3.2){ cs.phase='out'; cs.t=0; cineSub('Find a Gate in the wilderness. Ready up. Enter together.'); }
  } else {
    gateCutsceneCamera(cs, sh.gateB, sh.gateB, 1);
    cineFade(Math.min(1,cs.t/1.0));
    if(cs.t>=1.2) endGateCutscene();
  }
}
function endGateCutscene(){
  const cs=cutscene; cutscene=null;
  if(cs&&cs.set) scene.remove(cs.set);
  const ret=gateCutsceneReturn;
  world=(ret&&ret.world)||owWorld||world;
  dungeon=ret?ret.dungeon:null;
  dim='overworld';
  gate=(ret&&ret.gate)||null;
  if(gate&&gate.grp) scene.add(gate.grp);
  exitPortal=ret?ret.exitPortal:null;
  owWorld=world;
  rebuildAllChunks(); refreshTorchMeshes(); applyDim();
  if(ret&&player){
    player.pos.copy(ret.pos); player.yaw=ret.yaw; player.pitch=ret.pitch; player.vel.set(0,0,0);
  }
  gateCutsceneReturn=null;
  document.body.classList.remove('cutscene');
  cineSetBars(false); cineTitle('',''); cineSub(''); cineFade(0);
  sysMsg('<b>Gates unlocked.</b> Public Gates can now appear in the wilderness.');
}
function startIntroCutscene(replay, previewPath){
  if(cutscene || typeof THREE==='undefined' || (dim!=='overworld' && dim!=='ability')) return false;
  if(dim==='overworld' && !enterAbilityRoom()) return false;
  const ret=abilityRoomReturn ? {x:abilityRoomReturn.pos.x,y:abilityRoomReturn.pos.y,z:abilityRoomReturn.pos.z,yaw:abilityRoomReturn.yaw,pitch:abilityRoomReturn.pitch} :
    {x:player.pos.x,y:player.pos.y,z:player.pos.z,yaw:player.yaw,pitch:player.pitch};
  const M=ABILITY_MEADOW;
  const gy=standHeight(M.x,M.z+10,M.G+8);
  player.pos.set(M.x,(gy>0?gy:M.G)+0.01,M.z+10); player.vel.set(0,0,0);
  player.yaw=0; player.pitch=0;                 // face -z toward the meadow centre
  updateVisibleChunks(true);
  startAbilityDemo(true);                       // bot + dummy targets spawn ahead, toward centre
  if(abilityDemo&&abilityDemo.bot&&abilityDemo.bot.tag) abilityDemo.bot.tag.visible=false;
  const b=abilityDemo?abilityDemo.base:{x:M.x,y:M.G,z:M.z};
  const d=abilityDemo?abilityDemo.dir:{x:0,z:-1};
  if(abilityDemo&&abilityDemo.bot) abilityDemo.bot.grp.rotation.y=avatarFacingYaw(d.x,d.z);
  const path=PATHS[previewPath] ? previewPath : (activeAbilityPath()||S.path||'shadow');
  cutscene={ ret, path, shots:buildCutsceneShots(path), stage:{x:b.x+d.x*2.2, y:b.y+1.15, z:b.z+d.z*2.2}, i:-1, t:0, phase:'in', _cast:false, replay:!!replay };
  document.body.classList.add('cutscene');
  cineFade(0); cineSetBars(true); cineSub(''); cineTitle('AWAKENING',PATHS[path]?PATHS[path].name:'Your power stirs.');
  if(typeof SFX!=='undefined'&&SFX.level) SFX.level();
  return true;
}
function enterCutsceneShot(sh){
  cutscene._cast=false;
  cutscene.dashCam=null;
  cineSub(sh.cap&&sh.sub ? sh.cap+' - '+sh.sub : (sh.cap||''));
  if(abilityDemo){
    resetDemoTargets();
    rebuildDemoBot(sh.path, sh.held||0, sh.armor||0);
    if(abilityDemo.bot){
      abilityDemo.bot.grp.position.set(abilityDemo.base.x,abilityDemo.base.y,abilityDemo.base.z);
      abilityDemo.bot.grp.rotation.y=avatarFacingYaw(abilityDemo.dir.x,abilityDemo.dir.z);
      if(abilityDemo.bot.tag) abilityDemo.bot.tag.visible=false;
    }
  }
}
function setCutsceneCamera(cs, sh, t){
  if(!abilityDemo || !abilityDemo.bot) return;
  const b=abilityDemo.base, d=abilityDemo.dir, side=abilityDemo.side;
  const target=abilityDemo.targets && abilityDemo.targets[0];
  const tp=target ? target.grp.position : {x:b.x+d.x*4,y:b.y,z:b.z+d.z*4};
  if(sh.name==='Shadow Dash' && cs.dashCam){
    const dc=cs.dashCam;
    const u=Math.max(0,Math.min(1,(t-dc.startedAt)/(dc.dur||.86)));
    const ease=1-Math.pow(1-u,3);
    const px=dc.start.x+(dc.end.x-dc.start.x)*ease;
    const py=dc.start.y+(dc.end.y-dc.start.y)*ease;
    const pz=dc.start.z+(dc.end.z-dc.start.z)*ease;
    const lookX=px+d.x*1.9, lookY=py+1.1, lookZ=pz+d.z*1.9;
    const sideSweep=-2.65+Math.sin(u*Math.PI)*.65;
    camera.up.set(0,1,0);
    camera.position.set(
      px-d.x*3.2+side.x*sideSweep,
      py+2.0,
      pz-d.z*3.2+side.z*sideSweep
    );
    camera.lookAt(lookX,lookY,lookZ);
    return;
  }
  const focus={
    x:b.x+d.x*(sh.cam==='wide'?2.8:1.85),
    y:b.y+(sh.cam==='wide'?1.6:1.35),
    z:b.z+d.z*(sh.cam==='wide'?2.8:1.85)
  };
  let back=4.8, sideAmt=-3.2, height=2.3;
  if(sh.cam==='wide'){ back=8.4; sideAmt=-4.6; height=4.4; }
  else if(sh.cam==='hero'){ back=3.0; sideAmt=-3.6; height=2.15; }
  else if(sh.cam==='side'){ back=4.0; sideAmt=4.2; height=2.45; }
  else if(sh.cam==='side2'){ back=4.4; sideAmt=-4.2; height=2.55; }
  const drift=Math.sin(Math.min(1,t/(sh.dur||2))*Math.PI)*.55;
  camera.up.set(0,1,0);
  camera.position.set(
    focus.x-d.x*back+side.x*(sideAmt+drift),
    b.y+height,
    focus.z-d.z*back+side.z*(sideAmt+drift)
  );
  camera.lookAt(
    sh.cam==='hero' ? b.x+d.x*.8 : (focus.x+tp.x)*.5,
    sh.cam==='hero' ? b.y+1.35 : focus.y,
    sh.cam==='hero' ? b.z+d.z*.8 : (focus.z+tp.z)*.5
  );
}
function tickCutscene(now, dt){
  const cs=cutscene; if(!cs) return;
  if(cs.kind==='gateUnlock') return tickGateCutscene(now,dt);
  cs.t+=dt;
  if(cs.phase==='in'){
    setCutsceneCamera(cs, {cam:'wide', dur:1.7}, cs.t);
    if(cs.t>=1.7){ cs.phase='play'; cs.i=-1; cs.t=0; cineTitle('',''); }
  } else if(cs.phase==='play'){
    const shots=cs.shots||[];
    if(cs.i<0 || cs.t>=shots[cs.i].dur){
      cs.i++; cs.t=0;
      if(cs.i>=shots.length){ cs.phase='out'; cs.t=0; cineSub(''); }
      else enterCutsceneShot(shots[cs.i]);
    }
    if(cs.phase==='play'){
      const sh=shots[cs.i];
      setCutsceneCamera(cs, sh, cs.t);
      if(abilityDemo&&abilityDemo.bot) abilityDemo.bot.grp.rotation.y=avatarFacingYaw(abilityDemo.dir.x,abilityDemo.dir.z);
      if(sh.name && !cs._cast && cs.t>(sh.castAt||1.8)){ cs._cast=true; runDemoEffect({name:sh.name, path:sh.path, slot:sh.slot||0}); }
    }
  } else { // out
    setCutsceneCamera(cs, {cam:'wide', dur:1.3}, cs.t);
    cineFade(Math.min(1,cs.t/1.0));
    if(cs.t>=1.3){ endCutscene(); return; }
  }
  if(abilityDemo&&abilityDemo.bot) demoCastPose(abilityDemo.bot, Math.max(0, cs.t-0.45));
}
function endCutscene(){
  const cs=cutscene; cutscene=null;
  if(cs && cs.kind==='gateUnlock'){ cutscene=cs; return endGateCutscene(); }
  stopAbilityDemo(true);
  document.body.classList.remove('cutscene');
  cineSetBars(false); cineTitle('',''); cineSub(''); cineFade(0);
  if(cs && !cs.replay && abilityHudAvailable() && !abilityTutorialDone()){
    setTimeout(()=>showAbilityAwakening(), 350);
  } else {
    exitAbilityRoom();
  }
}
function skipCutscene(){ if(cutscene && cutscene.phase!=='out'){ cutscene.phase='out'; cutscene.t=0; cineSub(''); cineTitle('',''); } }
function resetLevel2AbilityFlow(){
  resetCutsceneSeen();
  resetAbilityTutorialDone();
  awakeningWin.classList.add('hidden');
  abilityAwakeningOpen=false;
  if(abilityTrainingActive){
    abilityTrainingActive=false;
    abilityTrainingUsed=false;
    abilityTrainingFinishAt=0;
    tutorialDummyGroup.visible=false;
    tutorialPillarGroup.visible=false;
    tutorialEl.classList.add('hidden');
    abilityTrainingReturn=null;
  }
  if(S.lvl<2){
    sysMsg('Level 2 cutscene and tutorial reset. Reach <b>Level 2</b> to see them again.');
    return;
  }
  if(!S.path){
    sysMsg('Level 2 cutscene reset. Choose a <b>path</b> with C to unlock the ability tutorial.');
    return;
  }
  if(dim!=='overworld'){
    sysMsg('Level 2 cutscene reset. Return to the <b>overworld</b> to replay it.');
    return;
  }
  markCutsceneSeen();
  if(!startIntroCutscene(false)) showAbilityAwakening();
}

const SOCIAL=createSocialSystem({
  network:NET,
  dragonTypes:DRAGON_TYPES,
  resetGateCutsceneSeen,
  startGateUnlockCutscene,
  markGateCutsceneSeen,
  startIntroCutscene,
  resetLevel2AbilityFlow,
});
globalThis.startQuickChatWheel=SOCIAL.startQuickChatWheel;
const {chatLine,openChat,closeChat,pendingTeamInvites,teamCol,teamName,myTeamId,isMyTeamLeader,netTeamHud,openTeamUI}=SOCIAL;

// ---- smart top-screen player suggestions ----
const SMART_SUGGESTION_KEY='bc_smart_suggestions_v1';
const SMART_SUGGESTION_COOLDOWN=42000;
const SMART_SUGGESTION_CHECK_MS=1600;
let smartSuggestionState={dismissed:{}, lastActionAt:0};
let smartSuggestion=null, smartSuggestionNextCheck=0;
function loadSmartSuggestionState(){
  try{
    const raw=JSON.parse(localStorage.getItem(SMART_SUGGESTION_KEY)||'{}');
    smartSuggestionState={
      dismissed:raw&&raw.dismissed&&typeof raw.dismissed==='object'?raw.dismissed:{},
      lastActionAt:Number(raw&&raw.lastActionAt)||0
    };
  }catch(e){ smartSuggestionState={dismissed:{},lastActionAt:0}; }
}
function saveSmartSuggestionState(){
  try{ localStorage.setItem(SMART_SUGGESTION_KEY, JSON.stringify(smartSuggestionState)); }catch(e){}
}
function smartSuggestionDismissed(id){
  return !!(id && smartSuggestionState.dismissed && smartSuggestionState.dismissed[id]);
}
function markSmartSuggestionDone(id){
  if(!id) return;
  smartSuggestionState.dismissed[id]=Date.now();
  smartSuggestionState.lastActionAt=Date.now();
  saveSmartSuggestionState();
}
function hideSmartSuggestion(){
  smartSuggestion=null;
  if(coachHud) coachHud.classList.add('hidden');
}
function hasAnyArmorItem(){
  return !!equippedArmor() || countItem(I.IRON_ARMOR)>0 || countItem(I.DIA_ARMOR)>0 || countItem(I.LEGEND_ARMOR)>0;
}
function acknowledgeSmartSuggestionKey(code){
  if(!smartSuggestion || !smartSuggestion.code || smartSuggestion.code!==code) return;
  markSmartSuggestionDone(smartSuggestion.id);
  hideSmartSuggestion();
}
function activateSmartSuggestionTrail(s){
  if(!s || !s.target || dim!=='overworld') return;
  coachTrail={
    target:{x:s.target.x,z:s.target.z},
    color:s.color||0x9ad26b,
    suggestionId:s.id,
    expiresAt:performance.now()+45000
  };
}
function activeCoachObjective(){
  try{
    const obj=currentObjective();
    if(obj && obj.text) return obj;
  }catch(e){}
  return null;
}
function smartSuggestionCandidates(){
  const out=[];
  const obj=activeCoachObjective();
  const hasUtility=utilityUnlocks.some(id=>UTILITY_DEFS[id]);
  const hasEquippedUtility=!!(utilityLoadout.active || utilityLoadout.passive.length);
  const lowLevel=((S&&S.lvl)||1)<=3;
  if(NET.on && !myTeamId() && lowLevel){
    out.push({
      id:'team-new-player',
       title:'New Hunter Tip - Team Up',
       text:'Press T to create or join a team. Teams share discoveries and make public gates safer.',
       key:'T', code:'KeyT'
    });
  }
  if(obj && (quest || jobContract || regionalContract || townGuidanceActive)){
    out.push({
      id:'quest-log-first-use',
       title:'Lost? Open The Quest Log',
       text:'Press O to see Story, Job, Guild, Aegis, and Tutorial objectives in one place.',
       key:'O', code:'KeyO'
    });
  }
  if(countItem(B.TABLE)<=0 && (countItem(B.LOG)>0 || countItem(B.PLANKS)>0 || lowLevel)){
    out.push({
      id:'craft-table',
       title:'Next Crafting Step',
       text:'Craft a Crafting Table with E. It unlocks bigger recipes like tools, furnaces, and armor.',
       key:'E', code:'KeyE'
    });
  }
  if(hasUtility && !hasEquippedUtility){
    out.push({
       id:'equip-utility',
       title:'Utility Ready',
       text:'Follow the green light to the Job Board. Press G or right-click there, then choose Utilities.',
       target:HUB.jobs, color:0x9ad26b
    });
  }
  if(((S&&S.lvl)||1)>=3 && !hasAnyArmorItem()){
    out.push({
       id:'armor-progression',
       title:'Survival Upgrade',
       text:'Press E to open crafting. Mine ore, smelt ingots, then select an armor recipe.',
       key:'E', code:'KeyE'
    });
  }
  if(firstQuestMilestoneComplete() && !jobContract){
    out.push({
       id:'choose-job',
       title:'Take Hunter Work',
       text:'Follow the green light to the Job Board for a Hunter contract or equip a trade profession.',
       target:HUB.jobs, color:0x9ad26b
    });
  }
  if(!regionalContract && firstQuestMilestoneComplete()){
    out.push({
       id:'guild-contract',
       title:'Try A Guild Contract',
       text:'Follow the green light to the Job Board. Press G or right-click, then choose Guild Contracts.',
       target:HUB.jobs, color:0x9ad26b
    });
  }
  return out;
}
function chooseSmartSuggestion(){
  const candidates=smartSuggestionCandidates();
  return candidates.find(s=>s && !smartSuggestionDismissed(s.id)) || null;
}
function smartSuggestionsAllowed(){
  if(!coachHud) return false;
  if(abilityAwakeningOpen || abilityTrainingActive) return false;
  if(!overlay || !overlay.classList.contains('hidden')) return false;
  if(!(locked || lockFallback)) return false;
  if(onboardingActive || pathChoiceOpen || claimMode || uiOpen || statOpen || qOpen) return false;
  if(rewardWin && !rewardWin.classList.contains('hidden')) return false;
  return true;
}
function showSmartSuggestion(s){
  if(!s || !coachHud) return;
  smartSuggestion=s;
  coachTitle.textContent=s.title||'Next Step';
  coachSub.textContent=s.text||'There is something useful you can do next.';
  coachLearnBtn.textContent=s.key?('PRESS '+s.key):'FOLLOW LIGHT';
  coachLearnBtn.classList.toggle('trail',!!s.target);
  if(s.target) activateSmartSuggestionTrail(s);
  coachHud.classList.remove('hidden');
}
function tickSmartSuggestions(now){
  if(!coachHud) return;
  if(!smartSuggestionsAllowed()){
    coachHud.classList.add('hidden');
    return;
  }
  if(now<smartSuggestionNextCheck) return;
  smartSuggestionNextCheck=now+SMART_SUGGESTION_CHECK_MS;
  if(Date.now()-(smartSuggestionState.lastActionAt||0)<SMART_SUGGESTION_COOLDOWN){
    hideSmartSuggestion();
    return;
  }
  const next=chooseSmartSuggestion();
  if(!next){ hideSmartSuggestion(); return; }
  if(!smartSuggestion || smartSuggestion.id!==next.id) showSmartSuggestion(next);
  else coachHud.classList.remove('hidden');
}
loadSmartSuggestionState();
if(coachDismissBtn) coachDismissBtn.addEventListener('click', ()=>{
  if(smartSuggestion) markSmartSuggestionDone(smartSuggestion.id);
  coachTrail=null;
  hideSmartSuggestion();
});

// ---- per-frame network pump ----
const netTick=createNetworkFramePump({
  connection:NET,
  snapshot:netSnapshot,
  refreshRemoteAvatar:netRefreshRemoteAvatar,
  mountLift,
  ensureRemoteMount,
  animateMountWings,
  emitDragonAura,
  dragonType,
  emitDragonTrail,
  pulseAegisGlow,
  updateTag:netUpdateTag,
});

gameContext.registerState('networking', Object.freeze({
  connection:NET,
  controller:NETWORK,
  onboarding:ONBOARD,
  get journeyResult(){ return e2eJourneyResult; },
  get restartRecovery(){ return dungeonRestartRecovery; },
}));
gameContext.registerModule('networking', Object.freeze({
  connect:netConnect,
  tick:netTick,
  snapshot:netSnapshot,
  send(type,payload={}){ if(NET.on&&NET.room)NET.room.send(type,payload); },
  pauseReconnect(){ return NETWORK.pauseReconnect(); },
  shutdown(){ return NETWORK.shutdown(); },
}));

export const state=gameContext.requireState('networking');
export const api=gameContext.requireModule('networking');
export {worldApi,worldState,dimensionsApi,dimensionsState,combatApi,combatState,hudApi,hudState,menusApi,menusState};
export default api;
