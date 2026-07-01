import {api as worldApi,state as worldState} from './world.mjs';
import {api as dimensionsApi,state as dimensionsState} from './dimensions.mjs';
import {api as combatApi,state as combatState} from './combat.mjs';
import {api as hudApi,state as hudState} from './hud.mjs';
import {api as menusApi,state as menusState} from './menus.mjs';
import {api as networkingApi,state as networkingState} from './networking.mjs';
const gameContext=window.BlockcraftGameContext;
const player=combatState.player,inv=combatState.inventory;
const getB=worldApi.getBlock,setB=worldApi.setBlock;
const refreshHUD=hudApi.refresh;
const NET=networkingState.connection,NETWORK=networkingState.controller,ONBOARD=networkingState.onboarding;
const netTick=networkingApi.tick;
/* Blockcraft frame-loop ES module. Runtime scheduling, simulation pumping, rendering, and diagnostics. */
// ---------------- main loop ----------------
const coordsEl=document.getElementById('coords');
const currentQuestEl=document.getElementById('currentquest');
const locationEl=document.getElementById('locationhud');
const activityTrackerEl=document.getElementById('activitytracker');
const zoneNameEl=document.getElementById('zonename');
const zoneMetaEl=document.getElementById('zonemeta');
const gatePromptEl=document.getElementById('gateprompt');
const encounterPromptEl=document.getElementById('encounterprompt');
const dungeonPartyEl=document.getElementById('dungeonparty');
const dungeonPingEl=document.getElementById('dungeonping');
const gateRallyGroup=new THREE.Group();
const gateRallyBeam=new THREE.Mesh(new THREE.CylinderGeometry(.22,.5,14,12,1,true),new THREE.MeshBasicMaterial({color:0x7dd3fc,transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));
const gateRallyRing=new THREE.Mesh(new THREE.TorusGeometry(2.2,.07,8,48),new THREE.MeshBasicMaterial({color:0xffd24a,transparent:true,opacity:.82,depthWrite:false,blending:THREE.AdditiveBlending}));
gateRallyBeam.position.y=7;gateRallyRing.rotation.x=Math.PI/2;gateRallyRing.position.y=.18;gateRallyGroup.add(gateRallyBeam,gateRallyRing);gateRallyGroup.visible=false;scene.add(gateRallyGroup);
const dungeonPingGroup=new THREE.Group();
const dungeonPingBeam=new THREE.Mesh(new THREE.CylinderGeometry(.12,.34,7,10,1,true),new THREE.MeshBasicMaterial({color:0xffd24a,transparent:true,opacity:.34,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));
const dungeonPingRing=new THREE.Mesh(new THREE.TorusGeometry(1.15,.07,8,36),new THREE.MeshBasicMaterial({color:0xffd24a,transparent:true,opacity:.9,depthWrite:false,blending:THREE.AdditiveBlending}));
dungeonPingBeam.position.y=3.5;dungeonPingRing.rotation.x=Math.PI/2;dungeonPingRing.position.y=.12;dungeonPingGroup.add(dungeonPingBeam,dungeonPingRing);dungeonPingGroup.visible=false;scene.add(dungeonPingGroup);
let activeDungeonPing=null;
function applyDungeonPing(message){
  if(!message||!['group','boss','loot'].includes(message.kind))return;
  activeDungeonPing={...message,expires:performance.now()+5000};
  const labels={group:'GROUP UP',boss:'FOCUS BOSS',loot:'LOOT HERE'};
  dungeonPingEl.textContent=(message.from||'Hunter')+' · '+labels[message.kind];dungeonPingEl.classList.remove('hidden');
}
globalThis.applyDungeonPing=applyDungeonPing;
refreshHUD();
hudState.slots[0].classList.add('sel');
function currentLocationInfo(){
  if(dim==='dungeon'){
    const st=dungeon&&dungeon.status;
    const ri=st?st.rank:(dungeon?dungeon.rank:0);
    const kind=st?st.kind:(dungeon&&dungeon.kind)||'public';
    const shard=dungeon&&dungeon.shard;
    const name=shard ? (shard.name+' +'+shard.plus+' Shard Gate') : (RANKS[ri].n+'-Rank '+gateKindLabel(kind)+' Gate');
    const mods=shard&&shard.mods&&shard.mods.length ? ' - '+shard.mods.join(', ') : '';
    return { cls:'dungeon', name, meta:RANKS[ri].n+'-Rank '+gateKindLabel(kind)+' Dungeon'+mods };
  }
  if(dim==='event'){
    const name=serverEvent&&serverEvent.name ? serverEvent.name : 'Server Event';
    const left=serverEvent&&serverEvent.endsAt?(' - '+fmtTimeLeft(serverEvent.endsAt-Date.now())+' left'):'';
    return { cls:'event', name:name+' Arena', meta:'Timed event instance'+left };
  }
  if(dim==='ability'){
    return { cls:'event', name:'Ability Training Room', meta:'Private tutorial instance' };
  }
  if(dim==='tutorial' && onboardingActive && isTrainingMeadowLand(player.pos.x,player.pos.z,4)){
    return { cls:'town', name:'Hunter Training Meadow', meta:'Safe training grounds' };
  }
  if(serverEvent&&serverEvent.kind==='king'&&serverEvent.phase==='active'&&serverEvent.participating){
    return { cls:'event', name:'King of the Hill Arena', meta:'Fight for crown control' };
  }
  if(dim==='overworld'){
    const ring=dangerRingAtClient(player.pos.x,player.pos.z), danger=DANGER_RINGS[ring];
    const discovery=nearbySmallDiscovery(8);
    if(discovery){
      const names={rare_plant:'Rare Wildgrowth',buried_chest:'Disturbed Earth',lore_tablet:'Weathered Lore Tablet',monster_nest:'Monster Nest',fishing_pool:'Hidden Fishing Pool',ore_outcrop:'Ore Outcrop',traveling_merchant:'Road Merchant Camp',puzzle_shrine:'Odd-Flame Shrine'};
      const hints={rare_plant:'Right-click to gather',buried_chest:'A torch marks soil worth digging',lore_tablet:'Right-click to read',monster_nest:'Hostile activity nearby',fishing_pool:'Right-click the water to fish',ore_outcrop:'Valuable exposed ore',traveling_merchant:'Right-click the merchant to trade',puzzle_shrine:'Two flames agree; touch the odd one'};
      return {cls:'wild danger'+ring,name:names[discovery.type],meta:hints[discovery.type]+' - '+danger.name};
    }
    let found=null, best=Infinity;
    for(const lm of regionalLandmarks){ const d=Math.hypot(player.pos.x-lm.x,player.pos.z-lm.z); if(d<(lm.radius||12)&&d<best){found=lm;best=d;} }
    if(found) return {cls:(found.major?'event':'wild')+' danger'+ring,name:found.name,meta:(found.major?'Major landmark':'Discovery')+' - '+danger.name+' / '+danger.threat};
  }
  if(dim==='overworld' && Math.hypot(player.pos.x-HUB.skyport.x, player.pos.z-HUB.skyport.z)<12){
    return { cls:'town', name:'Westwind Skyport', meta:'G to board - requires S-Rank and 1,000 gold' };
  }
  if(dim==='overworld' && Math.hypot(player.pos.x-HUB.jobs.x, player.pos.z-HUB.jobs.z)<6){
    return { cls:'town', name:'Job Board', meta:'Profession contracts and non-combat work' };
  }
  if(dim==='overworld' && Math.hypot(player.pos.x-HUB.quarry.x, player.pos.z-HUB.quarry.z)<7){
    return { cls:'town', name:'Quarry Worksite', meta:'Miner contracts and stone orders' };
  }
  if(dim==='overworld' && Math.hypot(player.pos.x-HUB.farm.x, player.pos.z-HUB.farm.z)<7){
    return { cls:'town', name:'Town Farm', meta:'Farmer contracts and crop work' };
  }
  if(dim==='overworld' && Math.hypot(player.pos.x-HUB.roost.x, player.pos.z-HUB.roost.z)<22){
    return { cls:'town', name:'Dragon Roost', meta:'Bonded dragons perch here - press B for bonds' };
  }
  if(dim==='overworld' && Math.hypot(player.pos.x-HUB.shrine.x, player.pos.z-HUB.shrine.z)<9){
    return { cls:'town', name:'Town Shrine', meta:'Meditation and quiet focus' };
  }
  if(dim==='overworld' && Math.hypot(player.pos.x-HUB.guardian.x, player.pos.z-HUB.guardian.z)<9){
    return { cls:'town', name:'Aegis Forge', meta:'Legendary quests and relic forging' };
  }
  if(dim==='overworld' && Math.hypot(player.pos.x-HUB.guild.x, player.pos.z-HUB.guild.z)<20){
    return { cls:'town', name:'Hunters Guild Hall', meta:'Found a guild or claim a permanent guild floor' };
  }
  if(isTownLand(Math.floor(player.pos.x), Math.floor(player.pos.z))){
    return { cls:'town', name:'Town of Beginnings', meta:'Safe town - quests, market, tavern, shards' };
  }
  if(gate){
    const ring=dangerRingAtClient(player.pos.x,player.pos.z);
    return { cls:'wild danger'+ring, name:'Wilderness Gate Approach', meta:RANKS[gate.rank].n+'-Rank '+gateKindLabel(gate.kind)+' - '+DANGER_RINGS[ring].name };
  }
  const ring=dangerRingAtClient(player.pos.x,player.pos.z), danger=DANGER_RINGS[ring];
  return { cls:'wild danger'+ring, name:danger.name, meta:danger.threat };
}
function hudRow(label, value, cls){
  return '<div class="hudrow'+(cls?' '+cls:'')+'"><span>'+escHTML(label)+'</span><b>'+value+'</b></div>';
}
function compactQuestHud(){
  if(!quest) return '';
  if(questExpired()){ failAegisBounty('time'); return ''; }
  if(quest.type==='pvp_bounty'){
    const done=questDone();
    return escHTML('Aegis Trial: Silent Bounty '+(quest.targetName||'Unknown')+' '+(done?'turn in':fmtTimeLeft((quest.expiresAt||0)-Date.now())));
  }
  const done=questDone();
  const label=quest.source==='guardian'?'Aegis Trial':'Story Quest';
  return escHTML(label+': '+questTypeLabel(quest)+' '+quest.giver+' '+questProgressText(quest)+(done?' turn in':''));
}
function compactJobContractHud(){
  const c=clampJobContract(jobContract);
  if(!c || !playerJob || c.job!==playerJob) return '';
  return escHTML('Job Board: '+c.title+' '+Math.min(c.need,c.have)+'/'+c.need+(jobContractReady()?' claim':''));
}
function compactRegionalContractHud(){
  const c=clampRegionalContract(regionalContract);
  if(!c) return '';
  return escHTML('Guild: '+c.title+' '+Math.min(c.need,c.have)+'/'+c.need+(c.ready?' claim':''));
}
function tutorialObjective(){
  if(!townGuidanceActive) return null;
  if(townGuidanceStep==='job') return {label:'Tutorial Guide', text:'Follow the lit path to the Job Board'};
  if(townGuidanceStep==='tavern') return {label:'Tutorial Guide', text:'Go to the tavern and buy an item'};
  if(townGuidanceStep==='land') return {label:'Tutorial Guide', text:'Leave town, press L, and buy land'};
  if(townGuidanceStep==='menu') return {label:'Tutorial Guide', text:'Choose a town tutorial'};
  if(townGuidanceStep==='quest') return {label:'Tutorial Guide', text:'Follow the lit path to the Quest Giver'};
  return {label:'Tutorial Guide', text:'Follow the glowing pillar'};
}
function questObjective(){
  if(!quest) return null;
  if(questExpired()){ failAegisBounty('time'); return null; }
  const qLabel=quest.source==='guardian'?'Aegis Trial':'Story Quest';
  if(questDone()) return {label:qLabel, text:'Turn in '+questTypeLabel(quest)+' to '+quest.giver};
  if(quest.type==='pvp_bounty') return {label:qLabel, text:'Assassinate '+(quest.targetName||'target')+' - '+fmtTimeLeft((quest.expiresAt||0)-Date.now())};
  if(quest.type==='gate'){
    const gateName=quest.gateRank===0?'the E-rank Gate':'a Gate';
    return {label:qLabel, text:gate?('Reach '+gateName+' - '+gateCompass()):('Find and clear '+gateName+' for '+quest.giver)};
  }
  if(quest.type==='kill') return {label:qLabel, text:'Defeat enemies for '+quest.giver+' '+quest.have+'/'+quest.need};
  if(quest.type==='mine') return {label:qLabel, text:'Mine '+quest.have+'/'+quest.need+' for '+quest.giver};
  if(quest.type==='fetch') return {label:qLabel, text:'Bring '+Math.min(quest.need,countItem(quest.item))+'/'+quest.need+' to '+quest.giver};
  if(quest.type==='sell'){
    const has=countItem(quest.item||I.MONSTER_MEAT)>0;
    return {label:qLabel, text:has?'Bring Monster Meat to Greta and sell it':'Go beyond the gate and hunt for Monster Meat'};
  }
  if(quest.type==='utility') return {label:qLabel, text:utilityUnlocked(quest.utility)?'Return to '+quest.giver:'Follow the trail to the Job Board and complete a Guild Contract'};
  if(quest.type==='familiar') return {label:qLabel, text:familiarUnlocks.includes(quest.familiar)?'Return to '+quest.giver:'Use the Shadow Sigil from your hotbar, then press K'};
  if(quest.type==='mount') return {label:qLabel, text:dragonUnlocks.length?'Return to '+quest.giver:'Follow the trail, place the Egg Insulator, then use the Dragon Egg'};
  if(quest.type==='mount_use') return {label:qLabel, text:(mounted&&isDragon(mountKind))?'Return to '+quest.giver:'Press X to summon your dragon and mount up'};
  return {label:qLabel, text:questTypeLabel(quest)+' for '+quest.giver};
}
function guildContractObjective(){
  const rc=clampRegionalContract(regionalContract);
  if(!rc) return null;
  if(rc.ready) return {label:'Guild Contract', text:'Claim reward: '+rc.title};
  return {label:'Guild Contract', text:rc.title+' '+Math.min(rc.need,rc.have)+'/'+rc.need};
}
function jobContractObjective(){
  const c=clampJobContract(jobContract);
  if(!c || !playerJob || c.job!==playerJob) return null;
  if(jobContractReady()) return {label:'Job Contract', text:'Claim reward: '+c.title};
  return {label:'Job Contract', text:c.title+' '+Math.min(c.need,c.have)+'/'+c.need};
}
function currentObjective(){
  if(dim==='gatecutscene') return {label:'Gate Vision', text:'The first dungeon reveals itself'};
  if(dim==='dungeon'){
    const st=dungeon&&dungeon.status;
    const boss=st?(st.cleared?'Cleared':st.bossAlive?'Boss alive':'Boss down'):(dungeon&&dungeon.cleared?'Cleared':'Boss alive');
    const chests=st?(' - chests '+st.remainingChests):'';
    let party=st&&st.party?st.party.length:1;
    if(!st&&NET.on&&NET.dgn) for(const sid in NET.remotes) if((NET.remotes[sid].ref.dgn||'')===NET.dgn) party++;
    return {label:'Current Goal', text:boss+' - party '+party+chests};
  }
  if(dim==='event'){
    const left=serverEvent&&serverEvent.endsAt?(' - '+fmtTimeLeft(serverEvent.endsAt-Date.now())+' left'):'';
    const text=serverEvent&&serverEvent.kind==='king' ? 'Hold the crown longer than every team'+left : 'Reach the finish before time runs out'+left;
    return {label:'Current Goal', text};
  }
  const guided=tutorialObjective();
  if(guided) return guided;
  const story=questObjective();
  if(story) return story;
  const guild=guildContractObjective();
  if(guild) return guild;
  const job=jobContractObjective();
  if(job) return job;
  const promotion=ONBOARD.firstPromotionObjective();
  if(promotion) return promotion;
  if(dim==='overworld' && Math.hypot(player.pos.x-HUB.jobs.x, player.pos.z-HUB.jobs.z)<6)
    return {label:'Current Goal', text:'Choose or claim work at the Job Board'};
  if(dim==='overworld' && Math.hypot(player.pos.x-HUB.quarry.x, player.pos.z-HUB.quarry.z)<7)
    return {label:'Current Goal', text:'Speak with Garrik for miner work'};
  if(dim==='overworld' && Math.hypot(player.pos.x-HUB.farm.x, player.pos.z-HUB.farm.z)<7)
    return {label:'Current Goal', text:'Speak with Liss for farmer work'};
  if(dim==='overworld' && Math.hypot(player.pos.x-HUB.shrine.x, player.pos.z-HUB.shrine.z)<9)
    return {label:'Current Goal', text:inMeditationSpot()?'Meditate with G / right-click':'Stand inside the shrine to meditate'};
  if(dim==='overworld' && Math.hypot(player.pos.x-HUB.guardian.x, player.pos.z-HUB.guardian.z)<9)
    return {label:'Current Goal', text:'Speak with the Aegis Guardian'};
  if(gate) return {label:'Current Goal', text:RANKS[gate.rank].n+'-Rank '+gateKindLabel(gate.kind)+' Gate - '+gateCompass()};
  if(dim==='overworld' && isTownLand(Math.floor(player.pos.x), Math.floor(player.pos.z)) &&
     Math.hypot(player.pos.x-TOWN.TC, player.pos.z-(TOWN.TC+4))<18){
    if(!playerJob && S.lvl<=1 && highestGateRankCleared<0) return {label:'Current Goal', text:'Follow the lit path to the Quest Giver'};
    return {label:'Current Goal', text:gateSystemUnlocked()?'Pick a quest, job, gate, or town activity':'Pick a quest, job, or town activity'};
  }
  return null;
}
let nextDiscoverySightAt=0;
function updateDiscoverySight(){
  const now=performance.now();if(dim!=='overworld'||now<nextDiscoverySightAt)return;nextDiscoverySightAt=now+900;
  let seen=null;
  for(const s of [...smallDiscoveries,...regionalLandmarks])if(!discoveredIds.has(s.id)&&Math.hypot(player.pos.x-s.x,player.pos.z-s.z)<(s.radius||8)+2){seen=s;break;}
  if(!seen)return;
  if(NET.on&&NET.room)NET.room.send('discoverySight',{id:seen.id});
  else{discoveredIds.add(seen.id);sysMsg('Mapped: <b>'+escHTML(seen.name||seen.type.replace(/_/g,' '))+'</b>');updateLandMinimap();}
}
function updateLocationHud(){
  updateDiscoverySight();
  if(!locationEl) return;
  const loc=currentLocationInfo();
  const hidden=locationEl.classList.contains('hidden');
  locationEl.className=(hidden?'hidden ':'')+(loc.cls||'');
  if(zoneNameEl) zoneNameEl.textContent=loc.name;
  if(zoneMetaEl) zoneMetaEl.textContent=loc.meta;
}
function bearingLabelTo(x,z){
  const dx=x-player.pos.x, dz=z-player.pos.z;
  const dist=Math.round(Math.hypot(dx,dz));
  const ang=(Math.atan2(dx,-dz)+Math.PI*2)%(Math.PI*2);
  const dirs=['N','NE','E','SE','S','SW','W','NW'];
  const dir=dirs[Math.round(ang/(Math.PI/4))%8];
  return dir+' '+dist+'m';
}
function findKnownSite(id){
  return [...regionalLandmarks,...smallDiscoveries].find(s=>s.id===id)||null;
}
function utilityCompassTarget(){
  if(progressionFocus==='first_promotion_job'||progressionFocus==='first_promotion_contract'||progressionFocus==='next_adventurer_contract'){
    return {label:'Board',x:HUB.jobs.x,z:HUB.jobs.z};
  }
  if(dim==='overworld'&&dungeonLobbyState&&dungeonLobbyState.rally){
    const rally=dungeonLobbyState.rally,distance=Math.round(Math.hypot(rally.x-player.pos.x,rally.z-player.pos.z));
    const waiting=Math.max(0,(dungeonLobbyState.needed|0)-(dungeonLobbyState.readyCount|0));
    return distance<=6
      ? {label:'Gate Rally',text:'At the Gate · '+waiting+' hunter'+(waiting===1?'':'s')+' still preparing'}
      : {label:'Gate Rally',text:'Rendezvous with '+(dungeonLobbyState.members&&dungeonLobbyState.members[0]?dungeonLobbyState.members[0].name:'your party')+' · '+bearingLabelTo(rally.x,rally.z)+' · '+distance+'m'};
  }
  if(progressionFocus==='first_d_gate'){
    const prep=ONBOARD.dRankPrepStatus();
    if(prep.next.target)return {label:'D Prep',x:prep.next.target.x,z:prep.next.target.z};
  }
  const rc=clampRegionalContract(regionalContract);
  if(rc && !rc.ready && rc.targetId){
    const s=findKnownSite(rc.targetId);
    if(s) return {label:'Guild', x:s.x, z:s.z};
  }
  if(rc && rc.ready) return {label:'Board', x:HUB.jobs.x, z:HUB.jobs.z};
  if(gate) return {label:'Gate', x:gate.x||TOWN.TC, z:gate.z||TOWN.TC};
  if(dim==='overworld') return {label:'Town', x:TOWN.TC, z:TOWN.TC};
  return null;
}
function nearestTeammate(){
  if(!NET.on || !NET.room) return null;
  const mine=myTeamId(); if(!mine) return null;
  let best=null, bd=1e9;
  for(const sid in NET.remotes){
    const r=NET.remotes[sid], ref=r&&r.ref;
    if(!ref || ref.team!==mine || (ref.dgn||'')!==NET.dgn) continue;
    const d=Math.hypot((ref.x||0)-player.pos.x,(ref.z||0)-player.pos.z);
    if(d<bd){ bd=d; best=ref; }
  }
  return best?{label:best.name||'Teammate', x:best.x, z:best.z, d:bd}:null;
}
function rankHudProgress(){
  const progress=currentRankProgress();
  if(progress.maxRank)return {label:'Hunter Rank',value:'S-Rank · MAX'};
  return {
    label:'Next Rank',
    value:hunterRankLetter(progress.nextRank)+' in '+progress.remaining.toLocaleString('en-US')+' XP',
  };
}
function updateGatePrompt(){
  if(!gatePromptEl)return;
  const visible=locked&&dim==='overworld'&&gate&&!uiOpen&&!statOpen&&!qOpen&&!claimMode&&!onboardingActive&&!document.body.classList.contains('cutscene');
  const distance=visible?Math.hypot(gate.x-player.pos.x,gate.z-player.pos.z):Infinity;
  if(distance>6){gatePromptEl.classList.add('hidden');gatePromptEl.innerHTML='';return;}
  const readiness=gateReadinessLocal(gate.rank|0),preview=gatePreviewLocal(gate.rank|0,gate.kind),statusClass=readiness.ready?'ready':'warning';
  const party=preview.recommendedParty,partyText=party[0]===party[1]?String(party[0]):party[0]+'-'+party[1];
  gatePromptEl.innerHTML='<span class="key">G</span>Inspect '+escHTML(RANKS[gate.rank|0].n)+'-Rank '+escHTML(gateKindLabel(gate.kind))+' Gate <span class="gate-status '+statusClass+'">'+escHTML(readiness.status)+'</span><span class="gate-preview">Enemy Lv '+preview.enemyLevels[0]+'-'+preview.enemyLevels[1]+' · Recommended party '+partyText+' · '+escHTML(readiness.difficulty)+'</span>';
  gatePromptEl.classList.remove('hidden');
}
function updateGateRally(now){
  const rally=dim==='overworld'&&dungeonLobbyState&&dungeonLobbyState.rally;
  if(!rally){gateRallyGroup.visible=false;return;}
  const distance=Math.hypot(rally.x-player.pos.x,rally.z-player.pos.z);
  gateRallyGroup.visible=distance>6;
  if(!gateRallyGroup.visible)return;
  gateRallyGroup.position.set(rally.x,(rally.y||16)+.15,rally.z);
  const pulse=1+Math.sin(now*.004)*.1;gateRallyRing.scale.setScalar(pulse);gateRallyRing.rotation.z=now*.00045;
  gateRallyBeam.material.opacity=.14+Math.sin(now*.003)*.05;
}
function updateDungeonCoordination(now){
  const status=dim==='dungeon'&&dungeon&&dungeon.status;
  if(!status||!Array.isArray(status.party)){
    dungeonPartyEl.classList.add('hidden');dungeonPartyEl.innerHTML='';
  }else{
    const mine=NET.room&&NET.room.sessionId;
    dungeonPartyEl.innerHTML='<div class="partytitle">GATE PARTY · F1 GROUP · F2 BOSS · F3 LOOT</div>'+status.party.map(member=>{
      let distance=0;
      if(member.sid!==mine){const remote=NET.remotes[member.sid],ref=remote&&remote.ref;distance=ref?Math.round(Math.hypot((ref.x||0)-player.pos.x,(ref.z||0)-player.pos.z)):0;}
      const hp=Math.max(0,member.hp|0),max=Math.max(1,member.maxHp|0),pct=Math.max(0,Math.min(100,hp/max*100));
      return '<div class="partycard'+(member.downed?' downed':'')+'"><div class="partyline"><b>'+escHTML(member.name||'Hunter')+'</b><small>'+escHTML(member.role||'Striker')+(member.sid===mine?' · YOU':' · '+distance+'m')+'</small></div><div class="partyhp"><i style="width:'+pct+'%"></i></div><div class="partyline"><small>'+(member.downed?'DOWNED':hp+'/'+max+' HP')+'</small><span class="partycontrib">Boss '+Math.max(0,member.contribution|0)+'</span></div></div>';
    }).join('');
    dungeonPartyEl.classList.remove('hidden');
  }
  if(!activeDungeonPing||dim!=='dungeon'||now>=activeDungeonPing.expires){
    activeDungeonPing=null;dungeonPingGroup.visible=false;dungeonPingEl.classList.add('hidden');return;
  }
  dungeonPingGroup.visible=true;dungeonPingGroup.position.set(activeDungeonPing.x||0,(activeDungeonPing.y||8)+.1,activeDungeonPing.z||0);
  const pulse=1+Math.sin(now*.009)*.18;dungeonPingRing.scale.setScalar(pulse);dungeonPingRing.rotation.z=now*.001;
}
function updateOverworldActivityTracker(){
  if(!activityTrackerEl)return;
  if(dim!=='overworld'||!overworldActivity||onboardingActive){activityTrackerEl.classList.add('hidden');return;}
  const a=overworldActivity,c=a.caravan,camp=a.camp,patrol=a.patrol;
  let title='',text='',target=null,danger=false;
  if(c&&c.state==='ambushed'){title='Caravan Under Attack';text='Defend the wagon and its remaining guards.';target=c;danger=true;}
  else if(a.recoveryCamp){title='Stolen Supplies';text='Clear the marked bandit camp to recover the caravan cargo.';target=a.recoveryCamp;danger=true;}
  else if(c){title='Road Caravan';text='Escort the convoy · '+Math.round((c.progress||0)*100)+'% · wagon '+Math.max(0,Math.ceil(c.hp||0))+'/'+Math.max(1,Math.ceil(c.maxHp||1));target=c;}
  else if(camp&&camp.phase==='captain'){title='Bandit Captain';text='Defeat the leader to unlock the camp chest.';target=camp;danger=true;}
  else if(camp&&camp.phase==='guards'){title='Bandit Camp';text='Guards remaining: '+(camp.guards|0)+'. Clear them to draw out the captain.';target=camp;danger=true;}
  else if(patrol){title='Bandit Tracks';text='A roaming patrol is active nearby.';target=patrol;danger=true;}
  else if((a.discountUntil||0)>Date.now()){title='Merchant Favour';text='Road merchant discount active for '+Math.max(1,Math.ceil((a.discountUntil-Date.now())/60000))+' min.';}
  if(!title){activityTrackerEl.classList.add('hidden');return;}
  let nav='';
  if(target){const d=Math.hypot(target.x-player.pos.x,target.z-player.pos.z);nav=d<35?'Nearby':d<90?'In the surrounding region':'Far away';if(utilityEquipped('compass')||(target===patrol&&utilityEquipped('trail_sense')))nav=bearingLabelTo(target.x,target.z)+' · '+Math.round(d)+'m';}
  const mapOn=utilityEquipped('minimap')||utilityEquipped('world_map');if(target)nav+=(nav?' · ':'')+(mapOn?'shown on map':'equip Mini Map to plot');
  activityTrackerEl.classList.remove('hidden');activityTrackerEl.classList.toggle('danger',danger);
  activityTrackerEl.innerHTML='<div class="at">'+escHTML(title)+'</div><div class="av">'+escHTML(text)+'</div>'+(nav?'<div class="am">'+escHTML(nav)+'</div>':'');
}
function updateEncounterPrompt(){
  if(!encounterPromptEl||dim!=='overworld'||!overworldActivity||!overworldActivity.caravan){if(encounterPromptEl)encounterPromptEl.classList.add('hidden');return;}
  const c=overworldActivity.caravan,d=Math.hypot(c.x-player.pos.x,c.z-player.pos.z);
  if(d>18){encounterPromptEl.classList.add('hidden');return;}
  const danger=c.state==='ambushed';encounterPromptEl.classList.toggle('danger',danger);
  encounterPromptEl.textContent=danger?'Defend Wagon · defeat the attacking bandits':'Escort Caravan · remain nearby to earn escort credit';
  encounterPromptEl.classList.remove('hidden');
}
function updateInfoHud(held){
  document.body.classList.toggle('calm-town', (locked || uiOpen || statOpen || qOpen || claimMode) && calmTownHud());
  if(onboardingActive){
    if(activityTrackerEl)activityTrackerEl.classList.add('hidden');
    coordsEl.innerHTML='<div class="statuschip time"><i class="ico">T</i><span>Time</span><b>'+escHTML(clockStr())+'</b></div>';
    if(currentQuestEl){currentQuestEl.classList.add('hidden');currentQuestEl.innerHTML='';}
    return;
  }
  updateOverworldActivityTracker();
  updateEncounterPrompt();
  if(calmTownHud()){
    const rank=rankHudProgress();
    coordsEl.innerHTML=[
      '<div class="statuschip time"><i class="ico">T</i><span>Time</span><b>'+escHTML(clockStr())+'</b></div>',
      '<div class="statuschip gold"><i class="ico">G</i><span>Gold</span><b>'+escHTML(String(gold|0))+'</b></div>',
      '<div class="statuschip rank"><i class="ico">R</i><span>'+escHTML(rank.label)+'</span><b>'+escHTML(rank.value)+'</b></div>'
    ].join('');
    if(currentQuestEl){
      const obj=(quest||jobContract||regionalContract||townGuidanceActive||progressionFocus||dungeonLobbyState)?currentObjective():null;
      if(obj){
        currentQuestEl.classList.remove('hidden');
        currentQuestEl.innerHTML=ONBOARD.objectiveHudHTML(obj);
      } else {
        currentQuestEl.classList.add('hidden');
        currentQuestEl.innerHTML='';
      }
    }
    return;
  }
  const rank=rankHudProgress();
  const rows=[
    '<div class="statuschip time"><i class="ico">T</i><span>Time</span><b>'+escHTML(clockStr())+'</b></div>',
    '<div class="statuschip gold"><i class="ico">G</i><span>Gold</span><b>'+escHTML(String(gold|0))+'</b></div>',
    '<div class="statuschip rank"><i class="ico">R</i><span>'+escHTML(rank.label)+'</span><b>'+escHTML(rank.value)+'</b></div>'
  ];
  if(utilityEquipped('compass')){
    const t=utilityCompassTarget();
    if(t) rows.push('<div class="statuschip utility"><i class="ico">C</i><span>'+escHTML(t.label)+'</span><b>'+escHTML(bearingLabelTo(t.x,t.z))+'</b></div>');
  }
  if(utilityEquipped('party_compass')){
    const t=nearestTeammate();
    if(t) rows.push('<div class="statuschip utility"><i class="ico">P</i><span>'+escHTML(t.label)+'</span><b>'+escHTML(bearingLabelTo(t.x,t.z))+'</b></div>');
  }
  if(dim==='overworld'&&dungeonLobbyState&&dungeonLobbyState.rally){
    const rally=dungeonLobbyState.rally,distance=Math.round(Math.hypot(rally.x-player.pos.x,rally.z-player.pos.z));
    rows.push('<div class="statuschip utility"><i class="ico">G</i><span>Gate Rally</span><b>'+escHTML(bearingLabelTo(rally.x,rally.z)+' · '+distance+'m')+'</b></div>');
  }
  if(utilityEquipped('feather_step')) rows.push('<div class="statuschip utility"><i class="ico">F</i><span>Feather</span><b>Safe fall</b></div>');
  coordsEl.innerHTML=rows.join('');
  const obj=currentObjective();
  if(currentQuestEl){
    if(obj){
      currentQuestEl.classList.remove('hidden');
      currentQuestEl.innerHTML=ONBOARD.objectiveHudHTML(obj);
    } else {
      currentQuestEl.classList.add('hidden');
      currentQuestEl.innerHTML='';
    }
  }
}
let last=performance.now();
function tick(now){
  requestAnimationFrame(tick);
  const dt=Math.max(0,Math.min((now-last)/1000,.05)); last=now;

  tickFurnaces(dt);
  tickOnboarding(now);
  tickAbilityTraining(now);
  tickTownGuidance(now);
  if(shouldOpenLevel2PathChoice()) showPathSelection();
  else if(!cutscene && !abilityTrainingActive && !abilityAwakeningOpen && abilityHudAvailable() && !abilityTutorialDone()){
    if(!runLevel2CutsceneThenTutorial()) showAbilityAwakening();
  }
  if(!cutscene) tryStartQueuedGateCutscene();
  renderEventHud();
  tickSmartSuggestions(now);
  updateDayNight(dt);
  if(now-lavaAnimT>80){ lavaAnimT=now; paintLavaTile(now*0.0045); }   // animate lava ~12fps
  tickTorches(now/1000, dt);
  tickDragonIncubationMeshes(now);
  tickPerchedDragons(now, dt);
  tickFamiliars(now, dt);
  tickWatchfulShade(now);
  updateFamiliarHUD();
  if(cutscene) tickCutscene(now, dt);   // cinematic drives its own camera, regardless of pointer-lock
  tickDungeonAmbient(dt, now/1000);

  if(claimMode){
    camera.position.set(claimCam.x, claimCam.h, claimCam.z);
    camera.rotation.order='YXZ';
    camera.rotation.set(-Math.PI/2, 0, 0);
    highlight.visible=false;
    crack.visible=false;
    updateAppearanceDummy(dt, now, false);
    updateClaimHover();
  }

  if(locked){
    const lookX=(keys['ArrowLeft']?1:0)-(keys['ArrowRight']?1:0);
    const lookY=(keys['ArrowUp']?1:0)-(keys['ArrowDown']?1:0);
    if(!cutscene && (lookX||lookY)){
      const lookSpeed=(keys['ShiftLeft']||keys['ShiftRight'])?3.1:1.85;
      if(onboardingActive&&onboardingArrived&&onboardingKind()==='arrows'&&lookX){
        onboardingArrowTurn+=Math.abs(lookX*lookSpeed*dt);
        if(onboardingArrowTurn>=ONBOARDING_FULL_TURN) onboardingFlags.arrowLook=true;
        updateOnboardingHud();
      }
      player.yaw += lookX*lookSpeed*dt;
      player.pitch += lookY*lookSpeed*.85*dt;
      player.pitch = Math.max(-Math.PI/2+0.01, Math.min(Math.PI/2-0.01, player.pitch));
    }
    const sprintKey=keys['ShiftLeft']||keys['ShiftRight'];
    let f=(keys['KeyW']?1:0)-(keys['KeyS']?1:0);
    let s=(keys['KeyD']?1:0)-(keys['KeyA']?1:0);
    if(cutscene||eventStartLocked()){ f=0; s=0; }
    if(isMeditating && (f!==0 || s!==0 || keys['Space'])){
      stopMeditation();
    }
    if(isMeditating){
      f=0; s=0; player.vel.set(0,0,0);
      meditateJobAcc+=dt;
      while(meditateJobAcc>=5){
        meditateJobAcc-=5;
        if(NET.on&&NET.room) NET.room.send('meditateTick',{});
        else { gainJobXP('monk', 2, 'meditate'); jobContractProgress('meditate', 5, 0); }
        const mt=jobPerkTier('monk');
        if(mt){
          buffs.regen=Math.max(buffs.regen, 4+mt*2);
          if(mt>=2) buffs.spd=Math.max(buffs.spd, 4+mt*2);
          if(mt>=3) buffs.stone=Math.max(buffs.stone, 4+mt*2);
          showJobPerk('monk','focus buff');
        }
      }
    }
    const flying = mounted && isDragon(mountKind);
    const sprint=sprintKey && (f!==0||s!==0) && sp>1 && !mounted;
    sprintingNow=sprint;
    if(sprint) sp=Math.max(0,sp-stCost(8)*dt);
    const dragFly=flying?((DRAGON_TYPES[dragonType(mountKind)]||{}).fly||13):0;
    const baseSpd=flying?dragFly:(mounted?9.6:(sprint?6.2:4.3));
    const speed=baseSpd*(1+0.015*(S.agi-1))*(buffs.spd>0?1.25:1);
    const sin=Math.sin(player.yaw), cos=Math.cos(player.yaw);
    let vx=(-sin*f + cos*s), vz=(-cos*f - sin*s);
    const len=Math.hypot(vx,vz)||1;
    vx=vx/len*speed; vz=vz/len*speed;
    if(f===0&&s===0){vx=0;vz=0;}
    // --- water & jump physics ---
    const waistWater = getB(Math.floor(player.pos.x), Math.floor(player.pos.y+0.8), Math.floor(player.pos.z))===B.WATER;
    const feetWater  = waistWater || getB(Math.floor(player.pos.x), Math.floor(player.pos.y+0.2), Math.floor(player.pos.z))===B.WATER;
    const inWater = feetWater;
    if(feetWater && !wasInWater && player.vel.y<-5){          // entry splash
      burst(player.pos.x, player.pos.y+.4, player.pos.z, [.45,.62,.85], 16, 2.6, 2.2, .5);
      SFX.splash(player.vel.y<-10);
    }
    wasInWater=feetWater;
    if(flying){
      // dragon flight: no gravity. Space climbs, Shift descends, otherwise hover.
      const climb=(keys['Space']?1:0)-((keys['ShiftLeft']||keys['ShiftRight'])?1:0);
      if(climb!==0) player.vel.y=climb*9;
      else player.vel.y += (0-player.vel.y)*Math.min(1,dt*8);
    } else {
    let grav = waistWater?9 : feetWater?14 : 26;
    if(!feetWater && player.vel.y>0 && !keys['Space']) grav*=1.7;   // tap = short hop, hold = full arc
    player.vel.y -= grav*dt;
    if(waistWater) player.vel.y=Math.max(player.vel.y,-2.2);
    else if(feetWater) player.vel.y=Math.max(player.vel.y,-3.5);
    const wantJump = keys['Space'] || (now-jumpPressT<130);         // buffered taps
    if(wantJump){
      const canJump = player.onGround || (!feetWater && now-lastGroundT<120);  // coyote time
      if(canJump && (mounted || sp>=5)){
        player.vel.y=mounted?9.4:8.2; player.onGround=false;
        lastGroundT=-1e9; jumpPressT=-1e9;
        if(!mounted) sp=Math.max(0,sp-stCost(5));
      } else if(feetWater && !player.onGround){
        // swim up: accelerate, and keep thrusting while breaching the surface
        player.vel.y=Math.min(player.vel.y+30*dt, waistWater?3.6:4.6);
        // climb out: pushing toward a low bank boosts you over the lip
        if(f!==0||s!==0){
          const hl=Math.hypot(vx,vz)||1;
          const ax=Math.floor(player.pos.x+vx/hl*.75), az=Math.floor(player.pos.z+vz/hl*.75);
          const fy=Math.floor(player.pos.y);
          let wallY=-1;
          if(isSolid(getB(ax,fy,az))) wallY=fy;
          else if(isSolid(getB(ax,fy+1,az))) wallY=fy+1;
          if(wallY>=0 && !isSolid(getB(ax,wallY+1,az)) && !isSolid(getB(ax,wallY+2,az))){
            player.vel.y=Math.max(player.vel.y, 8.4);
            SFX.splash(false);
            burst(player.pos.x, player.pos.y+.3, player.pos.z, [.45,.62,.85], 10, 2.2, 2, .4);
          }
        }
      }
    }
    }
    const wasGround=player.onGround;
    const prevVy=player.vel.y;
    player.onGround=false;
    if(playerKb.lengthSq()>.001){
      moveAxis('x', playerKb.x*dt);
      moveAxis('z', playerKb.z*dt);
      playerKb.multiplyScalar(Math.max(0,1-dt*5));
    }
    player.vx=vx; player.vz=vz;
    moveAxis('x', vx*(inWater?.6:1)*dt);
    moveAxis('z', vz*(inWater?.6:1)*dt);
    moveAxis('y', player.vel.y*dt);
    if(eventStartLocked()){holdEventStartPosition();player.onGround=true;}
    if(player.onGround) lastGroundT=now;
    if(player.onGround && !wasGround && prevVy<-9){             // landing feedback
      const feather=utilityEquipped('feather_step');
      const hard=!feather && prevVy<-15;
      const bid=getB(Math.floor(player.pos.x), Math.floor(player.pos.y-.5), Math.floor(player.pos.z));
      burst(player.pos.x, player.pos.y+.1, player.pos.z, BLOCK_COLORS[bid]||[.5,.5,.5], feather?4:(hard?14:7), feather?1.1:2.2, feather?.8:1.4, feather?.28:.45);
      SFX.land(hard);
      camShake=Math.max(camShake, feather?.04:(hard?.3:.14));
      if(feather && prevVy<-15) showName('Feather Step');
    }
    if(player.onGround && (f!==0||s!==0)){                      // footsteps
      stepAcc+=Math.hypot(vx,vz)*dt;
      if(stepAcc>=(sprint?2.6:2.1)){
        stepAcc=0;
        const bid=getB(Math.floor(player.pos.x), Math.floor(player.pos.y-.5), Math.floor(player.pos.z));
        SFX.step(feetWater?'water':stepKind(bid));
      }
    } else if(!player.onGround) stepAcc=1.6;
    // --- end water & jump physics ---
    tickLavaBorder(now);
    if(player.pos.y<-12){ player.pos.set(TOWN.TC+.5, TOWN.G+2, TOWN.TC+7.5); player.vel.set(0,0,0); }
    updateAppearanceDummy(dt, now, false);
    tickLocalMount(now, dt);
    tickDragonRoost(now, dt);

    if(cutscene){
      /* camera is driven by tickCutscene at the top of the frame */
    } else {
    camera.position.set(player.pos.x, player.pos.y+player.eye+(mounted?mountEye(mountKind):0), player.pos.z);
    camera.rotation.order='YXZ';
    camera.rotation.set(player.pitch, player.yaw, 0);
    if(isMeditating){
      applyMeditationCamera();
    }
    }
    if(camShake>0){
      camShake=Math.max(0,camShake-dt*2.2);
      const s2=camShake*camShake;
      camera.position.x+=(Math.random()-.5)*s2*.5;
      camera.position.y+=(Math.random()-.5)*s2*.5;
      camera.rotation.z+=(Math.random()-.5)*s2*.06;
    }
    if(tipsyT>0){ tipsyT-=dt; camera.rotation.z+=Math.sin(now/420)*.028*Math.min(1,tipsyT/2); }

    const hit=raycast(6);
    if(hit){ highlight.visible=true; highlight.position.set(hit.x+.5,hit.y+.5,hit.z+.5); }
    else { highlight.visible=false; }

    // mining (a mounted dragon breathes instead of mining while you hold the primary action)
    if(cutscene){ /* controls suspended during the cinematic */ }
    else if(isDragon(mountKind)){ if(mouseL) dragonBreathe(); }
    else if(mouseL && !suppressMine && hit && hit.id!==B.BEDROCK && BREAK[hit.id] && (dim!=='overworld' || canBreakHere(hit.x,hit.z,hit.y,hit.id))){
      if(!mining || mining.x!==hit.x || mining.y!==hit.y || mining.z!==hit.z) startMine(hit);
      if(mining){
        mining.progress+=dt*(1+comboN()*.1);                     // momentum
        sp=Math.max(0,sp-1.5*dt);
        mining.chipT=(mining.chipT||0)+dt;
        if(mining.chipT>.13){
          mining.chipT=0;
          burst(mining.x+.5, mining.y+.6, mining.z+.5, BLOCK_COLORS[mining.id]||[.5,.5,.5], 2, 1.5, 1.1, .35);
          SFX.chip(BREAK[mining.id]?BREAK[mining.id].cls:null);
          vmSwingT=Math.max(vmSwingT,.5);                        // punch with every chip
          const critC=Math.min(.45, .10+S.str*.012);             // STR scales crit chance
          if(mining.effective && Math.random()<critC){
            mining.progress+=mining.total*.12;
            mining.crit=.2;
            burst(mining.x+.5, mining.y+.6, mining.z+.5, [1,.85,.3], 6, 2.2, 1.8, .35);
            SFX.crit();
            camShake=Math.max(camShake,.18);
          }
        }
        if(mining.crit>0) mining.crit-=dt;
        const frac=Math.min(1, mining.progress/mining.total);
        crack.visible=true;
        crack.position.set(mining.x+.5,mining.y+.5,mining.z+.5);
        const st=Math.min(3,Math.floor(frac*4));
        if(crack.userData.st!==st){
          crack.userData.st=st;
          crackMat.map=crackTexs[st];
          crackMat.needsUpdate=true;
        }
        updateMineUI(frac);
        if(mining.progress>=mining.total){
          finishMine();
          crack.visible=false; crack.userData.st=-1;
          hideMineUI();
          if(!hintDone){ hintDone=true; hintEl.style.opacity=0; setTimeout(()=>hintEl.classList.add('hidden'),1100); }
        }
      }
    } else { mining=null; crack.visible=false; crack.userData.st=-1; hideMineUI(); }

    const held=inv[combatState.selectedSlot];
    let gateLine='';
    if(dim==='event') gateLine='<br>Event: Parkour course - reach the finish platform before time runs out';
    else if(dim==='dungeon'){
      let party=1;
      if(NET.on&&NET.dgn) for(const sid in NET.remotes) if((NET.remotes[sid].ref.dgn||'')===NET.dgn) party++;
      gateLine='<br>Gate: '+(dungeon&&dungeon.cleared?'CLEARED — return to the portal':'slay the boss')+' ['+RANKS[dungeon?dungeon.rank:0].n+']'+(party>1?' — party of '+party:'');
    }
    else if(gate) gateLine='<br>Nearest Gate: '+RANKS[gate.rank].n+'-Rank '+gateKindLabel(gate.kind)+' — '+gateCompass()+' — right-click / G to enter';
    if(dim==='dungeon'){
      const st=dungeon&&dungeon.status;
      const ri=st?st.rank:(dungeon?dungeon.rank:0);
      const kind=st?st.kind:(dungeon&&dungeon.kind)||'public';
      let party=st&&st.party?st.party.length:1;
      let partyNames='';
      if(st&&st.party&&st.party.length) partyNames=' ('+st.party.map(p=>escHTML(p.name||'Hunter')).join(', ')+')';
      else if(NET.on&&NET.dgn) for(const sid in NET.remotes) if((NET.remotes[sid].ref.dgn||'')===NET.dgn) party++;
      const boss=st?(st.cleared?'Cleared':st.bossAlive?'Boss alive':'Boss down'):(dungeon&&dungeon.cleared?'Cleared':'Boss alive');
      const chest=st?(' - Chests '+st.remainingChests):'';
      gateLine='<br>Dungeon: '+RANKS[ri].n+'-Rank '+gateKindLabel(kind)+' - '+boss+' - Party '+party+partyNames+chest;
    }
    tickQuestTimers();
    updateLocationHud();
    updateInfoHud(held);
  } else { crack.visible=false; }
  updateGatePrompt();
  updateGateRally(now);
  updateDungeonCoordination(now);

  tickVillagers(dt, now/1000);
  tickTownInteractLabels(dt);
  tickGuidancePath(dt, now);
  if(locked || uiOpen) tickMobs(dt, now/1000);   // sim pauses on the menu screen
  tickBlackholes(dt);
  updateParticles(dt);
  updateDamageNumbers(dt);
  updateEmitters(dt);
  updateRoadBirds(dt,now/1000);
  updateTavernNightEffects(dt, now);
  { // flame flicker
    const tt=now/1000;
    torchGlowMat.opacity=.5+Math.sin(tt*11)*.05+Math.sin(tt*23.7)*.04;
    fireGlowMat.opacity=.45+Math.sin(tt*9)*.09+Math.sin(tt*27.3)*.07;
    for(const key in torches){
      const fl=torches[key].children[1];
      fl.scale.setScalar(1+Math.sin(tt*13+key.length*2.7+torches[key].position.x)*.16);
    }
  }
  attackCd-=dt;
  netTick(dt, now);
  tickArrows(dt);
  tickMining(dt);
  tickFalling(dt);
  tickShards(dt, now);
  updateAbilityDemo(dt, now);
  vmTick(dt, now);
  { // ambience: nearest fire source + crickets after dark
    let fd=Infinity;
    if(dim==='overworld'){
      const tavernFire=tavernNightLevel()>.05 ? Math.hypot(player.pos.x-tp(79.5), player.pos.z-tp(85.4)) : Infinity;
      fd=Math.min(
        tavernFire,                                                // tavern hearth
        Math.hypot(player.pos.x-tp(81.7), player.pos.z-tp(48.5))); // smithy forge
    }
    for(const key in torches){
      const tp=torches[key].position;
      const d2=Math.hypot(player.pos.x-tp.x, player.pos.z-tp.z);
      if(d2<fd) fd=d2;
    }
    const inTown=dim==='overworld' && isTownLand(Math.floor(player.pos.x),Math.floor(player.pos.z));
    const inMenu=overlay && !overlay.classList.contains('hidden');
    SFX.tick(dt, fd, 1-gDayF, dim==='overworld', inTown, isInsideTavern(), inMenu, !!cutscene);
  }
  tickGates(dt, now);
  tickAbilities(dt, now/1000);
  tickCropTimers(now);
  updateAbilityHUD();
  if(hp>0){
    mp=Math.min(maxMp(), mp+1.2*(1+0.04*(S.int-1))*dt);
    if(!sprintingNow) sp=Math.min(maxSp(), sp+14*dt);
    if(hp<maxHp() && performance.now()-lastHurt>8000){
      regenAcc+=dt;
      if(regenAcc>=3){ regenAcc=0; hp=Math.min(maxHp(), hp+1+Math.floor((S.vit-1)/5)); }
    }
    renderBars();
  }
  cloudGroup.children.forEach((c,i)=>{ c.position.x += dt*(.6+ i*.04); if(c.position.x>WX+20) c.position.x=-20; });
  updateVisibleChunks(false);
  updateLandMinimap();
  updateBossUI();
  rendering.render();
}
requestAnimationFrame(tick);

addEventListener('resize', ()=>{
  rendering.resize(innerWidth,innerHeight);
});
if((location.hostname==='127.0.0.1'||location.hostname==='localhost')&&new URLSearchParams(location.search).has('e2e')){
  const e2eCompleteOnboardingStep=()=>{
    if(!onboardingActive) return false;
    const target=onboardingRoute[onboardingStep],kind=onboardingKind();
    if(!target||!player) return false;
    player.pos.set(target.x,surfaceY(target.x,target.z)+2,target.z);
    onboardingArrived=true;
    if(kind==='arrows')onboardingFlags.arrowLook=true;
    else if(kind==='jump')onboardingFlags.jumped=true;
    else if(kind==='tree')onboardingFlags.tree=true;
    else if(kind==='craft')onboardingFlags.crafted=true;
    else if(kind==='build'){
      const m=TRAINING_MEADOW;
      for(let i=0;i<3;i++) setB(m.x+40,m.G+1+i,m.z-18,B.PLANKS);
      rebuildAround(m.x+40,m.z-18);
      onboardingFlags.built=3;
    }
    else if(kind==='farm')onboardingFlags.farmed=true;
    else if(kind==='eat')onboardingFlags.ate=true;
    else if(kind==='combat')onboardingFlags.dummy=true;
    onboardingNextAt=performance.now()-1;
    tickOnboarding(performance.now());
    return true;
  };
  const e2eGateRanks=()=>{
    const ranks=[];
    const gates=NET.room&&NET.room.state&&NET.room.state.gates;
    if(gates&&gates.forEach)gates.forEach(g=>{if(g&&g.active&&!ranks.includes(g.rank|0))ranks.push(g.rank|0);});
    return ranks.sort((a,b)=>a-b);
  };
  const e2eGates=()=>{
    const found=[];
    const gates=NET.room&&NET.room.state&&NET.room.state.gates;
    if(gates&&gates.forEach)gates.forEach(g=>{
      if(g&&g.active)found.push({id:g.id,rank:g.rank|0,x:+g.x,y:+g.y,z:+g.z,kind:g.kind||'public'});
    });
    return found;
  };
  const e2eFirstGate=()=>{
    return e2eGates().find(g=>g.rank===0)||null;
  };
  const e2eWalkTo=async(target,arrivalRadius=null)=>{
    if(!target||!NET.on||!NET.room) return false;
    const sx=player.pos.x,sy=player.pos.y,sz=player.pos.z;
    const tx=target.x,ty=target.y,tz=target.z;
    const steps=Math.max(1,Math.ceil(Math.hypot(tx-sx,tz-sz)/1.8));
    for(let step=1;step<=steps;step++){
      const t=step/steps;
      player.pos.set(sx+(tx-sx)*t,sy+(ty-sy)*t,sz+(tz-sz)*t);
      NET.room.send('move',{x:player.pos.x,y:player.pos.y,z:player.pos.z,yaw:player.yaw});
      await new Promise(resolve=>setTimeout(resolve,80));
    }
    if(arrivalRadius==null) return true;
    // Range checks use the server position, so finish only after an ordered
    // test-only acknowledgement confirms the authoritative player arrived.
    const requestId='walk-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
    for(let settle=0;settle<100;settle++){
      player.pos.set(tx,ty,tz);
      NET.room.send('move',{x:tx,y:ty,z:tz,yaw:player.yaw});
      NET.room.send('e2eJourney',{action:'positionAck',requestId});
      await new Promise(resolve=>setTimeout(resolve,100));
      const ack=networkingState.journeyResult;
      if(ack&&ack.requestId===requestId&&ack.ok&&Math.hypot(ack.x-tx,ack.z-tz)<arrivalRadius) return true;
    }
    return false;
  };
  const e2eWalkToFirstGate=async()=>{
    const target=e2eFirstGate();
    if(!target) return false;
    return await e2eWalkTo({x:target.x+1.5,y:target.y+.5,z:target.z},3)&&target.id;
  };
  const e2eWalkToGate=async(id)=>{
    const target=e2eGates().find(g=>g.id===id);
    if(!target) return false;
    return await e2eWalkTo({x:target.x+1.5,y:target.y+.5,z:target.z},3)&&target.id;
  };
  const e2eUseDungeonExit=()=>{
    if(dim!=='dungeon'||!dungeon||!dungeon.cleared||!exitPortal) return false;
    player.pos.set(exitPortal.position.x,exitPortal.position.y+.5,exitPortal.position.z);
    exitDungeon(false);
    return true;
  };
  // Flees the dungeon via the entrance portal without requiring a clear, mirroring the real
  // proximity-triggered right-click in combat.mjs. Drives the DungeonRoom 2c-i flag-gated path,
  // which enters/exits through NETWORK.switchRoom()/returnToPrimary() instead of enterGate/exitGate.
  const e2eFleeDungeon=()=>{
    if(dim!=='dungeon'||!exitPortal) return false;
    player.pos.set(exitPortal.position.x,exitPortal.position.y+.5,exitPortal.position.z);
    exitDungeon(false);
    return true;
  };
  // Calls the real client enterDungeon() (what a right-click near the gate triggers) instead of
  // sending 'enterGate' directly, so the flag-gated switchRoom path (which never sends 'enterGate')
  // is actually exercised.
  const e2eEnterTrackedGate=()=>{
    if(!gate||!gate.id) return false;
    enterDungeon();
    return true;
  };
  const e2eDungeonBossCount=()=>{
    let count=0;
    const synced=NET.room&&NET.room.state&&NET.room.state.mobs;
    if(synced&&synced.forEach)synced.forEach(m=>{if(m&&m.dgn===NET.dgn&&m.kind==='boss')count++;});
    return count;
  };
  window.__BLOCKCRAFT_E2E__={
    status:()=>{const self=NET.room&&NET.room.state&&NET.room.state.players&&NET.room.state.players.get(NET.room.sessionId);return {connected:NET.on,reconnecting:NET.reconnecting,attachCount:NET.attachCount,sessionId:NET.room&&NET.room.sessionId||'',team:self&&self.team||'',job:playerJob,jobXp,contract:jobContract?JSON.parse(JSON.stringify(jobContract)):null,progressionFocus,firstPromotionSeen:ONBOARD.isSeen(),currentObjective:currentObjective(),dRankPrep:progressionFocus==='first_d_gate'?ONBOARD.dRankPrepStatus():null,rankProgress:currentRankProgress(),utilityUnlocks:[...utilityUnlocks],utilityLoadout:{active:utilityLoadout.active,passive:[...utilityLoadout.passive]},compassTarget:utilityCompassTarget(),armor:armorSlot&&armorSlot.id,level:S.lvl,xp:S.xp,points:S.pts,path:S.path||'',gold,onboarding:onboardingActive,onboardingStep,onboardingTotal:ONBOARDING_STEPS.length,onboardingKind:onboardingKind(),tutorials:{...serverTutorials},townTutorials:{job:townTutorialStepDone('job'),tavern:townTutorialStepDone('tavern'),land:townTutorialStepDone('land'),all:townTutorialsDone()},quest:quest?JSON.parse(JSON.stringify(quest)):null,maraStep:Number((npcQuestChains&&npcQuestChains['Mara Vale'])||0),abilityTraining:abilityTrainingActive,abilityTutorialDone:abilityTutorialDone(),dimension:dim,inTown:dim==='overworld'&&isTownLand(Math.floor(player.pos.x),Math.floor(player.pos.z)),dungeonId:NET.dgn||'',dungeonSeed:dungeon?(dungeon.seed>>>0):null,dungeonCleared:!!(dungeon&&dungeon.cleared),dungeonStatus:dungeon&&dungeon.status?JSON.parse(JSON.stringify(dungeon.status)):null,dungeonBossCount:e2eDungeonBossCount(),dungeonRestartRecovery:networkingState.restartRecovery?JSON.parse(JSON.stringify(networkingState.restartRecovery)):null,e2eJourneyResult:networkingState.journeyResult?JSON.parse(JSON.stringify(networkingState.journeyResult)):null,lobby:dungeonLobbyState?JSON.parse(JSON.stringify(dungeonLobbyState)):null,highestGateRankCleared,gateRanks:e2eGateRanks(),gates:e2eGates(),firstGate:e2eFirstGate(),roomName:NET.roomName||''};},
    inventoryCount:id=>inventoryModel.count(id),
    inventorySlot:id=>inventoryModel.slots.findIndex(stack=>stack&&stack.id===id),
    trackedGate:()=>gate?{id:gate.id||'',rank:gate.rank|0,kind:gate.kind||'public'}:null,
    send:(type,message={})=>{if(!NET.on||!NET.room)throw new Error('not connected');NET.room.send(type,message);},
    disconnect:()=>{if(!NET.room||!NET.room.connection)throw new Error('no active connection');NET.room.connection.close();},
    pauseReconnect:()=>NETWORK.pauseReconnect(),
    shutdown:()=>NETWORK.shutdown(),
    finishOnboarding:()=>completeOnboarding(),
    completeOnboardingStep:e2eCompleteOnboardingStep,
    completeTownTutorialStep:step=>completeTownTutorialStep(step),
    useFirstAbility:()=>cast(0),
    walkOutsideTown:()=>e2eWalkTo({x:TOWN.TC+TOWN.HS+12,y:TOWN.G+1,z:TOWN.TC}),
    walkToFirstGate:e2eWalkToFirstGate,
    walkToGate:e2eWalkToGate,
    walkToMara:()=>e2eWalkTo({x:HUB.guide.x,y:TOWN.G+1,z:HUB.guide.z}),
    walkToTavern:()=>e2eWalkTo({x:HUB.tavern.x,y:TOWN.G+1,z:HUB.tavern.z},7.5),
    walkToJobs:()=>e2eWalkTo({x:HUB.jobs.x,y:TOWN.G+1,z:HUB.jobs.z}),
    usePrepRepairKit:()=>{const slot=inv.findIndex(s=>s&&s.id===I.REPAIR_KIT);return slot>=0&&useRepairKit(slot);},
    useDungeonExit:e2eUseDungeonExit,
    fleeDungeon:e2eFleeDungeon,
    enterTrackedGate:e2eEnterTrackedGate,
  };
}

gameContext.registerState('ui', Object.freeze({
  get mode(){ return menusState.mode; },
  get open(){ return menusState.open; },
  get network(){ return NET; },
  get quest(){ return menusState.questModel; },
}));
gameContext.registerModule('ui', Object.freeze({
  open:menusApi.open,
  close:menusApi.close,
  render:menusApi.render,
  refreshHUD,
  currentObjective,
}));

export const state=gameContext.requireState('ui');
export const api=gameContext.requireModule('ui');
export {worldApi,worldState,dimensionsApi,dimensionsState,combatApi,combatState,hudApi,hudState,menusApi,menusState,networkingApi,networkingState};
export default api;
