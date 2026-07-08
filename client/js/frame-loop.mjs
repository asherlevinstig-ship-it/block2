import {api as worldApi,state as worldState} from './world.mjs';
import {api as dimensionsApi,state as dimensionsState} from './dimensions.mjs';
import {api as combatApi,state as combatState} from './combat.mjs';
import {api as hudApi,state as hudState} from './hud.mjs';
import {api as menusApi,state as menusState} from './menus.mjs';
import {api as networkingApi,state as networkingState} from './networking.mjs';
import {createPerformanceDiagnostics} from './performance-budget.mjs';
import {biomeStatus} from './biome-status.mjs';
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
const treasureClueGroup=new THREE.Group();
const treasureBeamMat=new THREE.MeshBasicMaterial({color:0xffd24a,transparent:true,opacity:.24,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
const treasureCoreMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.28,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
const treasureBeam=new THREE.Mesh(new THREE.CylinderGeometry(.42,.9,18,18,1,true),treasureBeamMat);
const treasureCore=new THREE.Mesh(new THREE.CylinderGeometry(.08,.18,20,12,1,true),treasureCoreMat);
const treasureRing=new THREE.Mesh(new THREE.TorusGeometry(2.2,.08,8,54),new THREE.MeshBasicMaterial({color:0xfff0a8,transparent:true,opacity:.82,depthWrite:false,blending:THREE.AdditiveBlending}));
const treasureCache=new THREE.Group();
function makeHudSprite(text,color='#ffd24a',bg='rgba(7,10,16,.74)'){
  const c=document.createElement('canvas');c.width=256;c.height=72;const g=c.getContext('2d');
  g.clearRect(0,0,c.width,c.height);g.fillStyle=bg;roundedRect(g,8,14,240,42,8);g.fill();g.strokeStyle=color;g.lineWidth=2;g.stroke();
  g.font='bold 19px Courier New';g.textAlign='center';g.fillStyle=color;g.fillText(text,128,43);
  const tex=new THREE.CanvasTexture(c);tex.magFilter=THREE.NearestFilter;tex.minFilter=THREE.LinearFilter;
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false,depthTest:false}));
  sp.scale.set(4.2,1.18,1);sp.userData={canvas:c,tex,text,color,bg};return sp;
}
function retitleSprite(sp,text,color){
  if(!sp||!sp.userData||sp.userData.text===text&&(!color||sp.userData.color===color))return;
  const d=sp.userData,c=d.canvas,g=c.getContext('2d'),col=color||d.color;d.text=text;d.color=col;
  g.clearRect(0,0,c.width,c.height);g.fillStyle=d.bg||'rgba(7,10,16,.74)';roundedRect(g,8,14,240,42,8);g.fill();g.strokeStyle=col;g.lineWidth=2;g.stroke();
  g.font='bold 19px Courier New';g.textAlign='center';g.fillStyle=col;g.fillText(text,128,43);d.tex.needsUpdate=true;
}
{
  const base=new THREE.Mesh(new THREE.BoxGeometry(1.25,.65,.85),new THREE.MeshLambertMaterial({color:0x6d411f}));
  const lid=new THREE.Mesh(new THREE.BoxGeometry(1.35,.26,.95),new THREE.MeshLambertMaterial({color:0x8f5f2c}));
  const trim=new THREE.Mesh(new THREE.BoxGeometry(1.45,.1,1.02),new THREE.MeshLambertMaterial({color:0xd8ad48}));
  const lock=new THREE.Mesh(new THREE.BoxGeometry(.18,.22,.08),new THREE.MeshLambertMaterial({color:0xffe083}));
  base.position.y=.34;lid.position.y=.8;trim.position.y=.98;lock.position.set(0,.72,.47);
  treasureCache.add(base,lid,trim,lock);
}
const treasureLabel=makeHudSprite('TREASURE CLUE','#ffd24a');
treasureBeam.position.y=9;treasureCore.position.y=10;treasureRing.rotation.x=Math.PI/2;treasureRing.position.y=.16;treasureLabel.position.y=3.2;treasureCache.position.y=.18;
treasureClueGroup.add(treasureBeam,treasureCore,treasureRing,treasureCache,treasureLabel);treasureClueGroup.visible=false;scene.add(treasureClueGroup);
const weatherDiscoveryFx=new Map();
const weatherDiscoveryReq={rain_bloom:'rain',storm_crystal:'storm',sun_dial:'clear'};
const weatherDiscoveryName={rain_bloom:'RAINWAKE BLOOM',storm_crystal:'STORMGLASS',sun_dial:'SUN DIAL'};
const weatherDiscoveryItem={rain_bloom:'Rainwake Petals',storm_crystal:'Stormglass Shards',sun_dial:'Solar Glyphs'};
const weatherDiscoveryAction={rain_bloom:'gather',storm_crystal:'harvest',sun_dial:'read'};
function weatherLabelFor(kind,active){return active?weatherDiscoveryName[kind]:'DORMANT: '+weatherDiscoveryReq[kind].toUpperCase();}
function makeWeatherDiscoveryFx(s){
  const color={rain_bloom:0x67d6ff,storm_crystal:0xb79cff,sun_dial:0xffd24a}[s.type]||0xffffff;
  const group=new THREE.Group();
  const halo=new THREE.Mesh(new THREE.TorusGeometry(1.3,.065,8,44),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.52,depthWrite:false,blending:THREE.AdditiveBlending}));
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.18,.44,4.6,12,1,true),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.16,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));
  const label=makeHudSprite(weatherLabelFor(s.type,false),'#8fa1b2','rgba(5,8,13,.66)');
  halo.rotation.x=Math.PI/2;halo.position.y=.2;beam.position.y=2.35;label.position.y=3.05;
  group.add(halo,beam,label);group.position.set(s.x+.5,s.y+1.05,s.z+.5);group.userData={halo,beam,label,type:s.type,phase:Math.random()*10};
  scene.add(group);weatherDiscoveryFx.set(s.id,group);return group;
}
function tickExplorationPresentation(now,dt){
  const map=globalThis.BlockcraftTreasureMap,site=map&&map.targetId?[...regionalLandmarks,...smallDiscoveries].find(s=>s.id===map.targetId):null;
  treasureClueGroup.visible=!!(dim==='overworld'&&site);
  if(site){
    const y=surfaceY(site.x,site.z),dist=Math.hypot(player.pos.x-site.x,player.pos.z-site.z),pulse=.5+.5*Math.sin(now*.0048);
    treasureClueGroup.position.set(site.x+.5,y+.03,site.z+.5);
    treasureRing.rotation.z+=dt*1.9;treasureRing.scale.setScalar(1+pulse*.12);
    treasureBeam.material.opacity=.16+pulse*.13;treasureCore.material.opacity=.18+pulse*.22;
    treasureCache.visible=((map.stage|0)+1)>=(map.total|0)||dist<(site.radius||8)+6;
    treasureCache.rotation.y+=dt*.65;
    retitleSprite(treasureLabel,dist<(site.radius||8)+5?'PRESS G TO SOLVE':'TREASURE CLUE','#ffd24a');
    if(dist<70&&Math.random()<dt*13)spawnParticle({x:site.x+.5+(Math.random()-.5)*2.8,y:y+.4+Math.random()*7,z:site.z+.5+(Math.random()-.5)*2.8,vx:(Math.random()-.5)*.25,vy:.6+Math.random()*.6,vz:(Math.random()-.5)*.25,life:.8,grav:-.15,r:1,g:.78,b:.22});
  }
  if(dim!=='overworld'){
    weatherDiscoveryFx.forEach(g=>g.visible=false);
    return;
  }
  const currentWeather=weather||'clear';
  for(const s of smallDiscoveries){
    const req=weatherDiscoveryReq[s.type];if(!req)continue;
    const dist=Math.hypot(player.pos.x-s.x,player.pos.z-s.z);
    const g=weatherDiscoveryFx.get(s.id)||makeWeatherDiscoveryFx(s),ud=g.userData,active=currentWeather===req;
    g.visible=dist<85;
    if(!g.visible)continue;
    const pulse=.5+.5*Math.sin(now*.004+ud.phase);
    ud.halo.visible=active||dist<12;ud.beam.visible=active;ud.label.visible=dist<13;
    ud.halo.rotation.z+=dt*(active?1.8:.55);ud.halo.scale.setScalar(active?1.08+pulse*.32:.86+pulse*.05);
    ud.halo.material.opacity=active?.36+pulse*.42:.18;ud.beam.material.opacity=active?.12+pulse*.2:0;
    retitleSprite(ud.label,weatherLabelFor(s.type,active),active?'#eafcff':'#8fa1b2');
    if(active&&dist<60&&Math.random()<dt*(s.type==='storm_crystal'?18:10)){
      const col=s.type==='rain_bloom'?[.38,.86,1]:s.type==='storm_crystal'?[.78,.58,1]:[1,.82,.22];
      spawnParticle({x:s.x+.5+(Math.random()-.5)*1.7,y:s.y+1.3+Math.random()*2.3,z:s.z+.5+(Math.random()-.5)*1.7,vx:(Math.random()-.5)*.2,vy:.35+Math.random()*.7,vz:(Math.random()-.5)*.2,life:.65,grav:-.1,r:col[0],g:col[1],b:col[2]});
    }
  }
}
globalThis.BlockcraftExplorationFx={
  treasureSolved(site){
    if(!site)return;const y=surfaceY(site.x,site.z);
    burst(site.x+.5,y+.8,site.z+.5,[1,.82,.22],28,4.2,3.6,.8);
    for(let i=0;i<24;i++)spawnParticle({x:site.x+.5+(Math.random()-.5)*2.6,y:y+.4+Math.random()*2.2,z:site.z+.5+(Math.random()-.5)*2.6,vx:(Math.random()-.5)*1.4,vy:1+Math.random()*2.2,vz:(Math.random()-.5)*1.4,life:1.1,grav:.55,r:1,g:.78,b:.22});
  },
  treasureComplete(){
    const map=globalThis.BlockcraftTreasureMap,site=map&&map.targetId?[...regionalLandmarks,...smallDiscoveries].find(s=>s.id===map.targetId):null;
    if(site)this.treasureSolved(site);
  },
  dormantWeather(type){
    const site=nearbySmallDiscovery(10);if(!site)return;
    const y=surfaceY(site.x,site.z),col=type==='rain_bloom'?[.38,.72,1]:type==='storm_crystal'?[.75,.55,1]:[1,.82,.24];
    burst(site.x+.5,y+1.1,site.z+.5,col,10,1.5,1.6,.38);
  }
};
function applyDungeonPing(message){
  if(!message||!['group','boss','loot'].includes(message.kind))return;
  activeDungeonPing={...message,expires:performance.now()+5000};
  const labels={group:'GROUP UP',boss:'FOCUS BOSS',loot:'LOOT HERE'};
  dungeonPingEl.textContent=(message.from||'Hunter')+' · '+labels[message.kind];dungeonPingEl.classList.remove('hidden');
}
globalThis.applyDungeonPing=applyDungeonPing;
refreshHUD();
hudState.slots[0].classList.add('sel');
let nextRecallRechargeHintAt=0;
let nextTreasureMapHintAt=0;
let nextFirstHandsProtectedHintAt=0;
let nextWeatherDiscoveryHintAt=0;
let lastWeatherDiscoveryPromptWeather=null;
const weatherDiscoveryHintCooldowns=new Map();
function firstHandsQuestActive(){
  return !!(quest&&quest.giver==='Mara Vale'&&quest.title==='First Hands'&&!questDone());
}
function maybePromptRecallRecharge(now){
  if(!NET.on||!NET.room||!locked||cutscene)return;
  if(globalThis.BlockcraftRecall&&globalThis.BlockcraftRecall.active)return;
  if(now<nextRecallRechargeHintAt)return;
  const manaMax=Math.max(1,maxMp()),staminaMax=Math.max(1,maxSp());
  const manaLow=mp/manaMax<=.28,staminaLow=sp/staminaMax<=.24;
  if(!manaLow&&!staminaLow)return;
  nextRecallRechargeHintAt=now+18000;
  const what=manaLow&&staminaLow?'mana and stamina':manaLow?'mana':'stamina';
  sysMsg('Low <b>'+what+'</b> — press <b>P</b> for a Recall recharge question.','minor');
}
function maybePromptTreasureMap(now){
  const map=globalThis.BlockcraftTreasureMap;
  if(!map||!map.targetId||dim!=='overworld'||!locked||cutscene)return;
  if(now<nextTreasureMapHintAt)return;
  const site=[...regionalLandmarks,...smallDiscoveries].find(s=>s.id===map.targetId);
  if(!site)return;
  const near=Math.hypot(player.pos.x-site.x,player.pos.z-site.z)<(site.radius||8)+12;
  nextTreasureMapHintAt=now+(near?18000:30000);
  sysMsg(near?'<b>Treasure clue nearby.</b> Search the gold beam and press <b>G</b>.':'<b>Treasure clue active.</b> Follow the gold mark on your map.','minor');
}
function maybePromptWeatherDiscovery(now){
  if(dim!=='overworld'||!locked||cutscene)return;
  const currentWeather=weather||'clear';
  if(lastWeatherDiscoveryPromptWeather!==currentWeather){
    lastWeatherDiscoveryPromptWeather=currentWeather;
    nextWeatherDiscoveryHintAt=now+2400;
  }
  if(now<nextWeatherDiscoveryHintAt)return;
  let best=null,bestDist=Infinity;
  const maxDist=currentWeather==='clear'?58:96;
  for(const s of smallDiscoveries){
    if(!s||discoveredIds.has(s.id)||weatherDiscoveryReq[s.type]!==currentWeather)continue;
    const key=s.id+'|'+currentWeather;
    if((weatherDiscoveryHintCooldowns.get(key)||0)>now)continue;
    const d=Math.hypot(player.pos.x-s.x,player.pos.z-s.z);
    if(d<maxDist&&d<bestDist){best=s;bestDist=d;}
  }
  if(!best)return;
  const key=best.id+'|'+currentWeather,near=bestDist<18,name=weatherDiscoveryName[best.type]||'WEATHER DISCOVERY';
  weatherDiscoveryHintCooldowns.set(key,now+90000);
  nextWeatherDiscoveryHintAt=now+(near?18000:32000);
  if(near)sysMsg('<b>'+name+'</b> is active now - press <b>G</b> to '+escHTML(weatherDiscoveryAction[best.type]||'investigate')+' <b>'+escHTML(weatherDiscoveryItem[best.type]||'weather materials')+'</b>.','minor');
  else sysMsg('<b>'+escHTML(currentWeather==='storm'?'The storm':currentWeather==='rain'?'The rain':'Clear sunlight')+'</b> has woken a <b>'+name+'</b> nearby. Look for its beam before the weather changes.','minor');
}
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
    const treasure=globalThis.BlockcraftTreasureMap,treasureSite=treasure&&[...regionalLandmarks,...smallDiscoveries].find(s=>s.id===treasure.targetId);
    if(treasureSite&&Math.hypot(player.pos.x-treasureSite.x,player.pos.z-treasureSite.z)<(treasureSite.radius||8)+5)return {cls:'event',name:'Treasure Clue',meta:'Search this landmark and press G to investigate'};
    const discovery=nearbySmallDiscovery(8);
    if(discovery){
      const names={rare_plant:'Rare Wildgrowth',buried_chest:'Disturbed Earth',lore_tablet:'Weathered Lore Tablet',monster_nest:'Monster Nest',fishing_pool:'Hidden Fishing Pool',ore_outcrop:'Ore Outcrop',traveling_merchant:'Road Merchant Camp',puzzle_shrine:'Odd-Flame Shrine',rain_bloom:'Rainwake Bloom',storm_crystal:'Stormglass Crystal',sun_dial:'Ancient Sun Dial'};
      const hints={rare_plant:'Right-click to gather',buried_chest:'A torch marks soil worth digging',lore_tablet:'Right-click to read',monster_nest:'Hostile activity nearby',fishing_pool:'Right-click the water to fish',ore_outcrop:'Valuable exposed ore',traveling_merchant:'Right-click the merchant to trade',puzzle_shrine:'Two flames agree; touch the odd one',rain_bloom:'Awakens in rain · G to gather',storm_crystal:'Charges in storms · G to harvest',sun_dial:'Aligns under clear skies · G to read'};
      const req=weatherDiscoveryReq[discovery.type],weatherHint=req&&weather!==req?('Dormant until '+req+' weather'):hints[discovery.type];
      return {cls:'wild danger'+ring,name:names[discovery.type],meta:(weatherHint||hints[discovery.type])+' - '+danger.name};
    }
    let found=null, best=Infinity;
    for(const lm of regionalLandmarks){ const d=Math.hypot(player.pos.x-lm.x,player.pos.z-lm.z); if(d<(lm.radius||12)&&d<best){found=lm;best=d;} }
    if(found) return {cls:(found.major?'event':'wild')+' danger'+ring,name:found.name,meta:(found.type==='ruins'?'Press G to decipher the ruins for a knowledge bonus':(found.major?'Major landmark':'Discovery')+' - '+danger.name+' / '+danger.threat)};
  }
  if(dim==='overworld' && Math.hypot(player.pos.x-HUB.skyport.x, player.pos.z-HUB.skyport.z)<12){
    return { cls:'town', name:'Westwind Skyport', meta:'G to board - requires S-Rank and 1,000 gold' };
  }
  if(dim==='overworld' && Math.hypot(player.pos.x-HUB.jobs.x, player.pos.z-HUB.jobs.z)<6){
    return { cls:'town', name:'Job Board', meta:'Profession contracts and non-combat work' };
  }
  if(dim==='overworld' && Math.hypot(player.pos.x-HUB.cartographer.x, player.pos.z-HUB.cartographer.z)<7){
    return { cls:'town', name:'Royal Cartographer', meta:'Speak to Orin for map leads, surveys and regional rewards' };
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
  if(quest.giver==='Mara Vale'&&quest.title==='First Hands'){
    const have=Math.min(quest.need,countItem(quest.item||B.LOG));
    return escHTML(have>=quest.need?'Story Quest: First Hands return to Mara':'Story Quest: First Hands leave town, gather logs '+have+'/'+quest.need);
  }
  const done=questDone();
  const label=quest.source==='guardian'?'Aegis Trial':'Story Quest';
  return escHTML(label+': '+questTypeLabel(quest)+' '+quest.giver+' '+questProgressText(quest)+(done?' turn in':''));
}
function compactJobContractHud(){
  const c=clampJobContract(jobContract);
  if(!c || (c.job!=='adventurer'&&c.job!==playerJob)) return '';
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
  if(townGuidanceStep==='quest') return {label:'Tutorial Guide', text:'Accept Mara’s first quest'};
  return {label:'Tutorial Guide', text:'Follow the glowing pillar'};
}
function questObjective(){
  if(!quest) return null;
  if(questExpired()){ failAegisBounty('time'); return null; }
  const qLabel=quest.title||(quest.source==='guardian'?'Aegis Trial':'Story Quest');
  if(questDone()) return {label:qLabel, text:'Turn in '+questTypeLabel(quest)+' to '+quest.giver};
  if(quest.type==='pvp_bounty') return {label:qLabel, text:'Assassinate '+(quest.targetName||'target')+' - '+fmtTimeLeft((quest.expiresAt||0)-Date.now())};
  if(quest.type==='gate'){
    const gateName=quest.gateRank===0?'the E-rank Gate':'a Gate';
    return {label:qLabel, text:gate?('Reach '+gateName+' - '+gateCompass()):('Find and clear '+gateName+' for '+quest.giver)};
  }
  if(quest.type==='kill') return {label:qLabel, text:'Defeat enemies for '+quest.giver+' '+quest.have+'/'+quest.need};
  if(quest.type==='mine') return {label:qLabel, text:'Mine '+quest.have+'/'+quest.need+' for '+quest.giver};
  if(quest.giver==='Mara Vale'&&quest.title==='First Hands'){
    const have=Math.min(quest.need,countItem(quest.item||B.LOG));
    if(have>=quest.need) return {label:'First Hands', text:'Return to Mara with '+have+'/'+quest.need+' logs'};
    return {label:'First Hands', text:(isTownLand(Math.floor(player.pos.x),Math.floor(player.pos.z))?'Leave through the north gate and gather logs ':'Gather logs beyond town ')+have+'/'+quest.need};
  }
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
  if(!c || (c.job!=='adventurer'&&c.job!==playerJob)) return null;
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
let trackedRegionalOpportunity=null;
let displayedRegionalOpportunity=null;
function nearbyRegionalOpportunity(){
  if(dim!=='overworld')return null;
  const a=overworldActivity||{},choices=[];
  const add=(target,title,kind,danger=true)=>{if(target&&Number.isFinite(target.x)&&Number.isFinite(target.z))choices.push({target,title,kind,danger});};
  const encounter=a.encounter;
  if(encounter&&encounter.type==='wounded_hunter')add(encounter,'Wounded Hunter','Road Warden rescue',false);
  else if(encounter&&encounter.type==='merchant_rescue')add(encounter,'Merchant Under Attack','Road Warden rescue');
  else if(encounter&&encounter.type==='pursuit')add(encounter,'Stolen Supply Pursuit','Road Warden recovery');
  const activeCaravanContract=clampRegionalContract(regionalContract);
  if(a.caravan&&activeCaravanContract&&activeCaravanContract.type==='road_escort'&&(!activeCaravanContract.targetId||activeCaravanContract.targetId===a.caravan.id))
    add(a.caravan,a.caravan.state==='ambushed'?'Caravan Under Attack':'Road Caravan','Active caravan escort',a.caravan.state==='ambushed');
  if(a.recoveryCamp)add(a.recoveryCamp,'Stolen Supplies Camp','Road Warden recovery');
  if(a.camp&&a.camp.phase!=='cleared')add(a.camp,a.camp.phase==='captain'?'Bandit Captain':'Bandit Camp','Road Warden camp');
  if(a.patrol)add(a.patrol,'Roaming Bandit Patrol','Road Warden patrol');
  for(const site of regionalLandmarks){
    if(!['bandit_camp','hunter_camp'].includes(site.type))continue;
    add(site,site.name||(site.type==='bandit_camp'?'Bandit Camp':'Hunter Camp'),'Regional contract',site.type==='bandit_camp');
  }
  let best=null,bestDistance=181;
  for(const choice of choices){const d=Math.hypot(choice.target.x-player.pos.x,choice.target.z-player.pos.z);if(d<bestDistance){best={...choice,distance:d};bestDistance=d;}}
  if(!best)return null;
  const ring=dangerRingAtClient(best.target.x,best.target.z),rank=RANKS[Math.max(0,Math.min(4,ring))].n;
  return {...best,x:best.target.x,z:best.target.z,rank,tracked:!!(trackedRegionalOpportunity&&trackedRegionalOpportunity.x===best.target.x&&trackedRegionalOpportunity.z===best.target.z)};
}
globalThis.toggleRegionalOpportunityTracking=()=>{
  const opportunity=displayedRegionalOpportunity||nearbyRegionalOpportunity();
  if(!opportunity){showName('No regional trouble nearby');return false;}
  if(opportunity.tracked){trackedRegionalOpportunity=null;showName('Regional tracking cleared');return true;}
  trackedRegionalOpportunity={x:opportunity.x,z:opportunity.z,label:opportunity.title};
  showName('Tracking '+opportunity.title);return true;
};
globalThis.resolveRegionalOpportunity=(id='')=>{
  if(!trackedRegionalOpportunity)return false;
  const trackedId=trackedRegionalOpportunity.target&&trackedRegionalOpportunity.target.id||'';
  if(id&&trackedId&&id!==trackedId)return false;
  trackedRegionalOpportunity=null;displayedRegionalOpportunity=null;return true;
};
function utilityCompassTarget(){
  if(progressionFocus==='e_rank_climb'||progressionFocus==='first_promotion_job'||progressionFocus==='first_promotion_contract'||progressionFocus==='next_adventurer_contract'){
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
  if(trackedRegionalOpportunity)return {label:trackedRegionalOpportunity.label,x:trackedRegionalOpportunity.x,z:trackedRegionalOpportunity.z};
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
  const journey=worldState.skyshipJourney;
  if(journey&&journey.boarded){
    const waiting=journey.phase==='boarding', seconds=Math.max(0,Math.ceil(((waiting?journey.departAt:journey.arriveAt)-Date.now())/1000));
    gatePromptEl.innerHTML=waiting
      ?'<span class="key">G</span>Leave Westwind <span class="gate-status ready">BOARDED</span><span class="gate-preview">Departs in '+seconds+'s · 1,000 gold paid</span>'
      :'<span class="gate-status ready">WESTWIND UNDERWAY</span><span class="gate-preview">Western Frontier · arriving in '+seconds+'s · movement locked</span>';
    gatePromptEl.classList.remove('hidden');return;
  }
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
  if(dim!=='overworld'||onboardingActive){displayedRegionalOpportunity=null;activityTrackerEl.classList.add('hidden');return;}
  const acceptedRegionalContract=clampRegionalContract(regionalContract);
  if(!acceptedRegionalContract){displayedRegionalOpportunity=null;activityTrackerEl.classList.add('hidden');return;}
  const a=overworldActivity||{},rawCaravan=a.caravan,caravanContract=clampRegionalContract(regionalContract),c=rawCaravan&&caravanContract&&caravanContract.type==='road_escort'&&(!caravanContract.targetId||caravanContract.targetId===rawCaravan.id)?rawCaravan:null,camp=a.camp,patrol=a.patrol,encounter=a.encounter;
  let title='',text='',target=null,danger=false;
  if(encounter&&encounter.type==='wounded_hunter'){title='Wounded Hunter';text='Reach the hunter and provide aid before nightfall.';target=encounter;}
  else if(encounter&&encounter.type==='merchant_rescue'){title='Merchant Rescue';text='Defeat '+(encounter.remaining|0)+' attackers before the merchant falls.';target=encounter;danger=true;}
  else if(encounter&&encounter.type==='pursuit'){title='Stolen Supply Pursuit';text='Catch '+(encounter.remaining|0)+' fleeing bandits before they escape.';target=encounter;danger=true;}
  else if(c&&c.state==='ambushed'){title='Caravan Under Attack';text='Defend the wagon and its remaining guards.';target=c;danger=true;}
  else if(a.recoveryCamp){title='Stolen Supplies';text='Clear the marked bandit camp to recover the caravan cargo.';target=a.recoveryCamp;danger=true;}
  else if(c){title='Road Caravan';text='Escort the convoy · '+Math.round((c.progress||0)*100)+'% · wagon '+Math.max(0,Math.ceil(c.hp||0))+'/'+Math.max(1,Math.ceil(c.maxHp||1));target=c;}
  else if(camp&&camp.phase==='captain'){title='Bandit Captain';text='Defeat the leader to unlock the camp chest.';target=camp;danger=true;}
  else if(camp&&camp.phase==='guards'){title='Bandit Camp';text='Guards remaining: '+(camp.guards|0)+'. Clear them to draw out the captain.';target=camp;danger=true;}
  else if(patrol){title='Bandit Tracks';text='A roaming patrol is active nearby.';target=patrol;danger=true;}
  else if((a.discountUntil||0)>Date.now()){title='Merchant Favour';text='Road merchant discount active for '+Math.max(1,Math.ceil((a.discountUntil-Date.now())/60000))+' min.';}
  if(!title){
    const opportunity=nearbyRegionalOpportunity();
    if(opportunity){title=opportunity.title;text=opportunity.kind;target=opportunity.target;danger=opportunity.danger;}
    else {displayedRegionalOpportunity=null;activityTrackerEl.classList.add('hidden');return;}
  }
  let nav='';
  if(target){const d=Math.hypot(target.x-player.pos.x,target.z-player.pos.z);nav=d<35?'Nearby':d<90?'In the surrounding region':'Far away';if(utilityEquipped('compass')||(target===patrol&&utilityEquipped('trail_sense')))nav=bearingLabelTo(target.x,target.z)+' · '+Math.round(d)+'m';}
  const mapOn=utilityEquipped('minimap')||utilityEquipped('world_map');if(target)nav+=(nav?' · ':'')+(mapOn?'shown on map':'equip Mini Map to plot');
  activityTrackerEl.classList.remove('hidden');activityTrackerEl.classList.toggle('danger',danger);
  let detail='';displayedRegionalOpportunity=null;
  if(target){
    const ring=dangerRingAtClient(target.x,target.z),rank=RANKS[Math.max(0,Math.min(4,ring))].n;
    const rc=clampRegionalContract(regionalContract),relevant=rc&&(!rc.targetId||rc.targetId===target.id)?'ACTIVE CONTRACT':'ROAD WARDEN WORK';
    const tracked=!!(trackedRegionalOpportunity&&trackedRegionalOpportunity.x===target.x&&trackedRegionalOpportunity.z===target.z);
    displayedRegionalOpportunity={target,x:target.x,z:target.z,title,kind:relevant,rank,tracked,danger};
    detail='<div class="ar"><b>'+escHTML(rank)+'-RANK AREA</b><span>'+escHTML(relevant)+'</span><kbd>P</kbd> '+(tracked?'UNTRACK':'TRACK')+'</div>';
  }
  activityTrackerEl.innerHTML='<div class="at">'+escHTML(title)+'</div><div class="av">'+escHTML(text)+'</div>'+(nav?'<div class="am">'+escHTML(nav)+'</div>':'')+detail;
}
function updateEncounterPrompt(){
  if(!encounterPromptEl)return;
  const table=locked&&!uiOpen&&!statOpen&&!qOpen&&!claimMode&&!onboardingActive?combatApi.nearbyTavernGameTable():null;
  if(table){
    encounterPromptEl.classList.remove('danger','hidden');
    encounterPromptEl.innerHTML='<span class="key">G</span><b>'+escHTML(table.label)+'</b><small>Press G to interact</small>';
    return;
  }
  if(dim!=='overworld'||!overworldActivity){encounterPromptEl.classList.add('hidden');encounterPromptEl.innerHTML='';return;}
  const encounter=overworldActivity.encounter;
  if(encounter){
    const distance=Math.hypot(encounter.x-player.pos.x,encounter.z-player.pos.z),range=encounter.type==='wounded_hunter'?8:24;
    if(distance<=range){
      const danger=encounter.type!=='wounded_hunter';encounterPromptEl.classList.toggle('danger',danger);
      encounterPromptEl.textContent=encounter.type==='wounded_hunter'?'Aid Wounded Hunter · aim and use secondary action':encounter.type==='merchant_rescue'?'Merchant Rescue · defeat every attacker':'Supply Pursuit · catch the fleeing bandits';
      encounterPromptEl.classList.remove('hidden');return;
    }
  }
  const c=overworldActivity.caravan;
  if(!c){encounterPromptEl.classList.add('hidden');return;}
  const d=Math.hypot(c.x-player.pos.x,c.z-player.pos.z);
  if(d>18){encounterPromptEl.classList.add('hidden');return;}
  const danger=c.state==='ambushed';encounterPromptEl.classList.toggle('danger',danger);
  const rc=clampRegionalContract(regionalContract),accepted=rc&&rc.type==='road_escort'&&(!rc.targetId||rc.targetId===c.id);
  encounterPromptEl.textContent=danger?'Caravan Under Attack · defeat the attacking bandits':accepted?'Escort Accepted · remain near the convoy':'G · Talk to Caravan Merchant · escort work available';
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
const perfDiagnostics=createPerformanceDiagnostics({renderer:rendering.renderer,getCounts:()=>({remotes:Object.keys(NET.remotes||{}).length,scene:scene.children.length})});
function tick(now){
  requestAnimationFrame(tick);
  const dt=Math.max(0,Math.min((now-last)/1000,.05)); last=now;
  perfDiagnostics.sample(now);
  biomeStatus.tick(now);
  globalThis.BlockcraftRecall.tick(now);
  if(globalThis.BlockcraftDeathDrops)globalThis.BlockcraftDeathDrops.tick(now);
  if(biomeStatus.active('frost',now)&&Math.random()<dt*14)spawnParticle({x:player.pos.x+(Math.random()-.5)*1.5,y:player.pos.y+.15+Math.random()*1.8,z:player.pos.z+(Math.random()-.5)*1.5,vx:(Math.random()-.5)*.18,vy:.12,vz:(Math.random()-.5)*.18,life:.7,grav:0,r:.56,g:.92,b:1});
  if(biomeStatus.active('venom',now)&&Math.random()<dt*9)spawnParticle({x:player.pos.x+(Math.random()-.5)*1.1,y:player.pos.y+.1+Math.random()*1.4,z:player.pos.z+(Math.random()-.5)*1.1,vx:0,vy:.28,vz:0,life:.6,grav:0,r:.51,g:.66,b:.29});
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
    if(biomeStatus.rooted(now)){f=0;s=0;}
    if(cutscene||eventStartLocked()||(worldState.skyshipJourney&&worldState.skyshipJourney.boarded)){ f=0; s=0; player.vel.set(0,0,0); }
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
        if(!NET.on){
          const mt=jobPerkTier('monk'),seconds=(JOB_SYSTEM.MONK_RULES.durationByTier[mt]||0);
          if(mt){buffs.regen=Math.max(buffs.regen,seconds);if(mt>=2)buffs.spd=Math.max(buffs.spd,seconds);if(mt>=3)buffs.stone=Math.max(buffs.stone,seconds);showJobPerk('monk','focus buff');}
        }
      }
    }
    const flying = mounted && isDragon(mountKind);
    const sprint=sprintKey && (f!==0||s!==0) && sp>1 && !mounted;
    sprintingNow=sprint;
    if(globalThis.COMBAT_FEEDBACK)globalThis.COMBAT_FEEDBACK.updateMovement(camera,sprint,f!==0||s!==0,dt);
    const armorMovement=!mounted&&equippedArmor()?armorProfileFor(equippedArmor()):null;
    const armorStamina=armorMovement?armorMovement.staminaCostMultiplier:1;
    if(sprint) sp=Math.max(0,sp-stCost(8)*armorStamina*dt);
    const dragFly=flying?((DRAGON_TYPES[dragonType(mountKind)]||{}).fly||13):0;
    const baseSpd=flying?dragFly:(mounted?9.6:(sprint?6.2:4.3));
    const speed=baseSpd*(1+0.015*(S.agi-1))*(buffs.spd>0?1.25:1)*(armorMovement?armorMovement.moveMultiplier:1);
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
        if(!mounted) sp=Math.max(0,sp-stCost(5)*armorStamina);
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
    if(player.pos.y<-12){ player.pos.set(TOWN.TC+.5, TOWN.G+2, TOWN.TC+14.5); player.vel.set(0,0,0); }
    updateAppearanceDummy(dt, now, false);
    tickLocalMount(now, dt);
    tickDragonRoost(now, dt);

    if(worldState.skyshipJourney&&worldState.skyshipJourney.boarded&&worldState.skyshipJourney.phase==='flight'&&skyShip){
      const a=now*.00016, focus=skyShip.grp.position;
      camera.position.set(focus.x+Math.cos(a)*25,focus.y+12,focus.z+Math.sin(a)*25);
      camera.lookAt(focus.x,focus.y+5,focus.z);
    } else if(cutscene){
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
    } else {
      if(mouseL && hit && BREAK[hit.id] && dim==='overworld' && !canBreakHere(hit.x,hit.z,hit.y,hit.id)
        && firstHandsQuestActive() && hit.id===B.LOG && isTownLand(hit.x,hit.z) && now>=nextFirstHandsProtectedHintAt){
        nextFirstHandsProtectedHintAt=now+4500;
        sysMsg('Mara: town trees are protected. Follow the north gate trail and gather logs <b>outside the wall</b>.','minor');
      }
      mining=null; crack.visible=false; crack.userData.st=-1; hideMineUI();
    }

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
  tickExplorationPresentation(now,dt);
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
  worldApi.tickRoadSafetyScenes(dt, now/1000);
  tickCropTimers(now);
  updateAbilityHUD();
  if(hp>0){
    if(hp<maxHp() && performance.now()-lastHurt>8000){
      regenAcc+=dt;
      if(regenAcc>=3){ regenAcc=0; hp=Math.min(maxHp(), hp+1+Math.floor((S.vit-1)/5)); }
    }
    maybePromptRecallRecharge(now);
    maybePromptTreasureMap(now);
    maybePromptWeatherDiscovery(now);
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
    else if(kind==='subject')onboardingFlags.subject=true;
    else if(kind==='recall')onboardingFlags.recall=true;
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
    const steps=Math.max(1,Math.ceil(Math.hypot(tx-sx,tz-sz)/.6));
    for(let step=1;step<=steps;step++){
      const t=step/steps;
      const x=sx+(tx-sx)*t,z=sz+(tz-sz)*t;
      const y=dim==='overworld'?surfaceY(x,z)+1.01:sy+(ty-sy)*t;
      player.pos.set(x,y,z);
      NET.room.send('move',{x:player.pos.x,y:player.pos.y,z:player.pos.z,yaw:player.yaw});
      await new Promise(resolve=>setTimeout(resolve,75));
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
    if(isTownLand(Math.floor(player.pos.x),Math.floor(player.pos.z)))
      await e2eWalkTo({x:HUB.northGate.x,y:TOWN.G+1,z:HUB.northGate.z+2});
    return await e2eWalkTo({x:target.x+1.5,y:target.y+.5,z:target.z},3)&&target.id;
  };
  const e2eWalkToGate=async(id)=>{
    const target=e2eGates().find(g=>g.id===id);
    if(!target) return false;
    const requestId='gate-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
    NET.room.send('e2eJourney',{action:'positionAtGate',requestId,id});
    for(let settle=0;settle<50;settle++){
      await new Promise(resolve=>setTimeout(resolve,100));
      const ack=networkingState.journeyResult;
      if(ack&&ack.requestId===requestId&&ack.ok&&ack.id===id){player.pos.set(target.x+1.5,target.y+.5,target.z);return id;}
    }
    return false;
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
    status:()=>{const self=NET.room&&NET.room.state&&NET.room.state.players&&NET.room.state.players.get(NET.room.sessionId);return {connected:NET.on&&NET.profileReady===true,reconnecting:NET.reconnecting,attachCount:NET.attachCount,sessionId:NET.room&&NET.room.sessionId||'',team:self&&self.team||'',job:playerJob,jobXp,contract:jobContract?JSON.parse(JSON.stringify(jobContract)):null,progressionFocus,firstPromotionSeen:ONBOARD.isSeen(),currentObjective:currentObjective(),dRankPrep:progressionFocus==='first_d_gate'?ONBOARD.dRankPrepStatus():null,rankProgress:currentRankProgress(),utilityUnlocks:[...utilityUnlocks],utilityLoadout:{active:utilityLoadout.active,passive:[...utilityLoadout.passive]},compassTarget:utilityCompassTarget(),armor:armorSlot&&armorSlot.id,level:S.lvl,xp:S.xp,points:S.pts,path:S.path||'',gold,onboarding:onboardingActive,onboardingStep,onboardingTotal:ONBOARDING_STEPS.length,onboardingKind:onboardingKind(),tutorials:{...serverTutorials},townTutorials:{job:townTutorialStepDone('job'),tavern:townTutorialStepDone('tavern'),land:townTutorialStepDone('land'),all:townTutorialsDone()},quest:quest?JSON.parse(JSON.stringify(quest)):null,maraStep:Number((npcQuestChains&&npcQuestChains['Mara Vale'])||0),abilityTraining:abilityTrainingActive,abilityTutorialDone:abilityTutorialDone(),dimension:dim,inTown:dim==='overworld'&&isTownLand(Math.floor(player.pos.x),Math.floor(player.pos.z)),dungeonId:NET.dgn||'',dungeonSeed:dungeon?(dungeon.seed>>>0):null,dungeonCleared:!!(dungeon&&dungeon.cleared),dungeonStatus:dungeon&&dungeon.status?JSON.parse(JSON.stringify(dungeon.status)):null,dungeonBossCount:e2eDungeonBossCount(),dungeonRestartRecovery:networkingState.restartRecovery?JSON.parse(JSON.stringify(networkingState.restartRecovery)):null,e2eJourneyResult:networkingState.journeyResult?JSON.parse(JSON.stringify(networkingState.journeyResult)):null,lobby:dungeonLobbyState?JSON.parse(JSON.stringify(dungeonLobbyState)):null,highestGateRankCleared,gateRanks:e2eGateRanks(),gates:e2eGates(),firstGate:e2eFirstGate(),roomName:NET.roomName||''};},
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
