import {api as worldApi,state as worldState} from './world.mjs';
import {api as dimensionsApi,state as dimensionsState} from './dimensions.mjs';
import {api as combatApi,state as combatState} from './combat.mjs';
import {api as hudApi,state as hudState} from './hud.mjs';
import {api as menusApi,state as menusState} from './menus.mjs';
import {api as networkingApi,state as networkingState} from './networking.mjs';
import {createPerformanceDiagnostics} from './performance-budget.mjs';
import {biomeStatus} from './biome-status.mjs';
import {DEITY_LEVEL} from './progression.mjs';
const gameContext=window.BlockcraftGameContext;
const QUEST_OBJECTIVES=globalThis.BlockcraftQuestObjectives;
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
const landBoundaryToastEl=document.createElement('div');
landBoundaryToastEl.id='landboundarytoast';
landBoundaryToastEl.setAttribute('aria-live','polite');
document.body.appendChild(landBoundaryToastEl);
const gateRallyGroup=new THREE.Group();
const gateRallyBeam=new THREE.Mesh(new THREE.CylinderGeometry(.22,.5,14,12,1,true),new THREE.MeshBasicMaterial({color:0x7dd3fc,transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));
const gateRallyRing=new THREE.Mesh(new THREE.TorusGeometry(2.2,.07,8,48),new THREE.MeshBasicMaterial({color:0xffd24a,transparent:true,opacity:.82,depthWrite:false,blending:THREE.AdditiveBlending}));
gateRallyBeam.position.y=7;gateRallyRing.rotation.x=Math.PI/2;gateRallyRing.position.y=.18;gateRallyGroup.add(gateRallyBeam,gateRallyRing);gateRallyGroup.visible=false;scene.add(gateRallyGroup);
const dungeonPingGroup=new THREE.Group();
const dungeonPingBeam=new THREE.Mesh(new THREE.CylinderGeometry(.12,.34,7,10,1,true),new THREE.MeshBasicMaterial({color:0xffd24a,transparent:true,opacity:.34,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));
const dungeonPingRing=new THREE.Mesh(new THREE.TorusGeometry(1.15,.07,8,36),new THREE.MeshBasicMaterial({color:0xffd24a,transparent:true,opacity:.9,depthWrite:false,blending:THREE.AdditiveBlending}));
dungeonPingBeam.position.y=3.5;dungeonPingRing.rotation.x=Math.PI/2;dungeonPingRing.position.y=.12;dungeonPingGroup.add(dungeonPingBeam,dungeonPingRing);dungeonPingGroup.visible=false;scene.add(dungeonPingGroup);
let activeDungeonPing=null;
const trailSenseGroup=new THREE.Group();
const trailSenseBeam=new THREE.Mesh(new THREE.CylinderGeometry(.18,.44,7.5,12,1,true),new THREE.MeshBasicMaterial({color:0x8ff7c7,transparent:true,opacity:.2,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));
const trailSenseRing=new THREE.Mesh(new THREE.TorusGeometry(1.5,.07,8,44),new THREE.MeshBasicMaterial({color:0x8ff7c7,transparent:true,opacity:.86,depthWrite:false,blending:THREE.AdditiveBlending}));
trailSenseBeam.position.y=3.75;trailSenseRing.rotation.x=Math.PI/2;trailSenseRing.position.y=.13;trailSenseGroup.add(trailSenseBeam,trailSenseRing);trailSenseGroup.visible=false;scene.add(trailSenseGroup);
const partyCompassGroup=new THREE.Group();
const partyCompassBeam=new THREE.Mesh(new THREE.CylinderGeometry(.13,.32,6.5,10,1,true),new THREE.MeshBasicMaterial({color:0xd7b5ff,transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));
const partyCompassRing=new THREE.Mesh(new THREE.TorusGeometry(1.25,.065,8,40),new THREE.MeshBasicMaterial({color:0xd7b5ff,transparent:true,opacity:.8,depthWrite:false,blending:THREE.AdditiveBlending}));
partyCompassBeam.position.y=3.25;partyCompassRing.rotation.x=Math.PI/2;partyCompassRing.position.y=.12;partyCompassGroup.add(partyCompassBeam,partyCompassRing);partyCompassGroup.visible=false;scene.add(partyCompassGroup);
const featherStepLandings=[];
const dungeonSpiritMarkers=new Map();
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
function makeDungeonSpiritMarker(){
  const group=new THREE.Group();
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.16,.42,8,12,1,true),new THREE.MeshBasicMaterial({color:0x7dd3fc,transparent:true,opacity:.22,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1.05,.065,8,42),new THREE.MeshBasicMaterial({color:0x9bdcff,transparent:true,opacity:.86,depthWrite:false,blending:THREE.AdditiveBlending}));
  const label=makeHudSprite('SPIRIT','#9bdcff','rgba(4,13,25,.72)');
  beam.position.y=4;ring.rotation.x=Math.PI/2;ring.position.y=.13;label.position.y=2.9;
  group.add(beam,ring,label);group.userData={beam,ring,label,phase:Math.random()*10};
  scene.add(group);
  return group;
}
function showFeatherStepLandingFx(m={}){
  const softened=Math.max(0,(m&&m.damage)|0)>0,color=softened?0xffd24a:0x9bdcff;
  const group=new THREE.Group();
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.85,.055,8,40),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.92,depthWrite:false,blending:THREE.AdditiveBlending}));
  const pulse=new THREE.Mesh(new THREE.TorusGeometry(1.25,.04,8,44),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.48,depthWrite:false,blending:THREE.AdditiveBlending}));
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.08,.2,1.9,10,1,true),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.28,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));
  ring.rotation.x=Math.PI/2;pulse.rotation.x=Math.PI/2;ring.position.y=.09;pulse.position.y=.1;beam.position.y=.95;
  group.add(ring,pulse,beam);group.position.set(player.pos.x,player.pos.y+.03,player.pos.z);scene.add(group);
  featherStepLandings.push({group,ring,pulse,beam,created:performance.now(),expires:performance.now()+900});
}
function tickFeatherStepLandingFx(now){
  for(let i=featherStepLandings.length-1;i>=0;i--){
    const fx=featherStepLandings[i],age=Math.max(0,now-fx.created),life=Math.max(.001,fx.expires-fx.created),t=age/life;
    if(t>=1){
      scene.remove(fx.group);
      fx.group.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});
      featherStepLandings.splice(i,1);continue;
    }
    const ease=1-t;
    fx.ring.scale.setScalar(1+t*.75);fx.pulse.scale.setScalar(1+t*1.55);fx.beam.scale.setScalar(1+t*.25);
    fx.ring.material.opacity=.78*ease;fx.pulse.material.opacity=.4*ease;fx.beam.material.opacity=.22*ease;
  }
}
globalThis.BlockcraftUtilityFeedback={showFeatherStepLandingFx};
function clearDungeonSpiritMarkers(keep=null){
  for(const [sid,marker] of dungeonSpiritMarkers){
    if(keep&&keep.has(sid))continue;
    scene.remove(marker);
    marker.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});
    dungeonSpiritMarkers.delete(sid);
  }
}
function updateDungeonSpiritMarkers(status,now){
  if(dim!=='dungeon'||!status||!Array.isArray(status.party)){clearDungeonSpiritMarkers();return;}
  const mine=NET.room&&NET.room.sessionId,keep=new Set();
  for(const member of status.party){
    if(!member||member.sid===mine||!member.spirit)continue;
    const marker=dungeonSpiritMarkers.get(member.sid)||makeDungeonSpiritMarker();
    dungeonSpiritMarkers.set(member.sid,marker);keep.add(member.sid);
    const x=Number.isFinite(member.x)?member.x:0,y=Number.isFinite(member.y)?member.y:8,z=Number.isFinite(member.z)?member.z:0;
    marker.position.set(x,y+.05,z);
    const ud=marker.userData||{},pulse=.5+.5*Math.sin(now*.006+(ud.phase||0));
    if(ud.ring){ud.ring.rotation.z=now*.0012;ud.ring.scale.setScalar(1+pulse*.15);ud.ring.material.opacity=.52+pulse*.3;}
    if(ud.beam)ud.beam.material.opacity=.12+pulse*.12;
  }
  clearDungeonSpiritMarkers(keep);
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
  const map=globalThis.BlockcraftTreasureMap,site=map&&map.targetId?[...regionalLandmarks,...smallDiscoveries,...(ancientCities||[])].find(s=>s.id===map.targetId):null;
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
    const map=globalThis.BlockcraftTreasureMap,site=map&&map.targetId?[...regionalLandmarks,...smallDiscoveries,...(ancientCities||[])].find(s=>s.id===map.targetId):null;
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
let nextLandProtectedHintAt=0;
let nextWeatherDiscoveryHintAt=0;
let lastLandBoundarySig='';
let lastLandBoundaryTile='';
let landBoundaryToastUntil=0;
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
  nextRecallRechargeHintAt=now+10000;
  const what=manaLow&&staminaLow?'mana and stamina':manaLow?'mana':'stamina';
  showName('LOW '+what.toUpperCase()+' - PRESS P');
  sysMsg('Low <b>'+what+'</b> — press <b>P</b> for a Recall recharge question.','minor');
}
function maybePromptTreasureMap(now){
  const map=globalThis.BlockcraftTreasureMap;
  if(!map||!map.targetId||dim!=='overworld'||!locked||cutscene)return;
  if(now<nextTreasureMapHintAt)return;
  const site=[...regionalLandmarks,...smallDiscoveries,...(ancientCities||[])].find(s=>s.id===map.targetId);
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
  const weatherSense=utilityUnlocked('weather_sense');
  const maxDist=weatherSense?(currentWeather==='clear'?110:180):(currentWeather==='clear'?58:96);
  for(const s of smallDiscoveries){
    if(!s||claimedDiscoveryIds.has(s.id)||weatherDiscoveryReq[s.type]!==currentWeather)continue;
    if(discoveredIds.has(s.id)&&!weatherSense)continue;
    const key=s.id+'|'+currentWeather;
    if((weatherDiscoveryHintCooldowns.get(key)||0)>now)continue;
    const d=Math.hypot(player.pos.x-s.x,player.pos.z-s.z);
    if(d<maxDist&&d<bestDist){best=s;bestDist=d;}
  }
  if(!best)return;
  const key=best.id+'|'+currentWeather,near=bestDist<18,name=weatherDiscoveryName[best.type]||'WEATHER DISCOVERY';
  const spotted=discoveredIds.has(best.id);
  weatherDiscoveryHintCooldowns.set(key,now+90000);
  nextWeatherDiscoveryHintAt=now+(near?18000:32000);
  if(near)sysMsg('<b>'+name+'</b> is active now - press <b>G</b> to '+escHTML(weatherDiscoveryAction[best.type]||'investigate')+' <b>'+escHTML(weatherDiscoveryItem[best.type]||'weather materials')+'</b>.','minor');
  else if(spotted)sysMsg('<b>Weather Sense:</b> '+escHTML(currentWeather==='storm'?'The storm':currentWeather==='rain'?'The rain':'Clear sunlight')+' has woken your spotted <b>'+name+'</b>. Track it on the map before the weather changes.','minor');
  else sysMsg('<b>'+escHTML(currentWeather==='storm'?'The storm':currentWeather==='rain'?'The rain':'Clear sunlight')+'</b> has woken a <b>'+name+'</b> nearby. Look for its beam before the weather changes.','minor');
}
function landBoundarySignature(status){
  if(!status) return '';
  if(status.kind==='available') return 'wilderness';
  if(status.kind==='abandoned') return 'abandoned:'+(status.claim&&status.claim.title||status.claim&&status.claim.name||status.label||'');
  if(status.kind==='own') return 'own:'+(status.group&&status.group.key||status.claim&&status.claim.title||'');
  if(status.kind==='shared') return 'shared:'+(status.claim&&status.claim.title||status.claim&&status.claim.name||status.label||'');
  if(status.kind==='other') return 'other:'+(status.claim&&status.claim.title||status.claim&&status.claim.name||status.label||'');
  return status.kind||'';
}
function landClaimToastName(status){
  const claim=status&&status.claim;
  if(!claim) return '';
  const groupSize=status&&status.group&&status.group.size||1;
  return claim.title || (claim.name ? claim.name+'\'s '+(groupSize>=3?'Homestead':'land') : '');
}
function landBoundaryToastText(status){
  if(!status) return null;
  if(status.kind==='available') return {title:'Entering Wilderness', meta:'Unclaimed land - buildable, not protected', cls:'wild'};
  if(status.kind==='abandoned') return {title:'Entering '+(landClaimToastName(status)||'Abandoned Land'), meta:'Abandoned claim - buildable and reclaimable', cls:'wild'};
  if(status.kind==='own') return {title:'Entering '+(landClaimToastName(status)||'Your Land'), meta:'Protected claim - you can build here', cls:'own'};
  if(status.kind==='shared') return {title:'Entering '+(landClaimToastName(status)||'Shared Land'), meta:(status.claim&&status.claim.name?status.claim.name:'Owner')+' trusts you here', cls:'shared'};
  if(status.kind==='other') return {title:'Entering '+(landClaimToastName(status)||'Claimed Land'), meta:'Protected claim - permission required', cls:'other'};
  if(status.kind==='town') return {title:'Entering Town Land', meta:'Protected by the Town of Beginnings', cls:'town'};
  if(status.kind==='border') return {title:'World Border', meta:'Protected edge of the realm', cls:'other'};
  return null;
}
function tickLandBoundaryToast(now){
  if(dim!=='overworld'||!player||typeof landClaimStatusAt!=='function'){
    lastLandBoundarySig='';lastLandBoundaryTile='';landBoundaryToastEl.classList.remove('show');return;
  }
  const x=Math.floor(player.pos.x), z=Math.floor(player.pos.z), tile=x+','+z;
  if(tile!==lastLandBoundaryTile){
    lastLandBoundaryTile=tile;
    const status=landClaimStatusAt(x,z,Math.floor(player.pos.y));
    const sig=landBoundarySignature(status);
    if(lastLandBoundarySig && sig!==lastLandBoundarySig){
      const text=landBoundaryToastText(status);
      if(text){
        landBoundaryToastEl.className='show '+text.cls;
        landBoundaryToastEl.innerHTML='<b>'+escHTML(text.title)+'</b><span>'+escHTML(text.meta)+'</span>';
        landBoundaryToastUntil=now+2600;
      }
    }
    lastLandBoundarySig=sig;
  }
  if(landBoundaryToastUntil && now>landBoundaryToastUntil){
    landBoundaryToastEl.classList.remove('show');
    landBoundaryToastUntil=0;
  }
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
    const treasure=globalThis.BlockcraftTreasureMap,treasureSite=treasure&&[...regionalLandmarks,...smallDiscoveries,...(ancientCities||[])].find(s=>s.id===treasure.targetId);
    if(treasureSite&&Math.hypot(player.pos.x-treasureSite.x,player.pos.z-treasureSite.z)<(treasureSite.radius||8)+5)return {cls:'event',name:'Treasure Clue',meta:'Search this landmark and press G to investigate'};
    const ancient=(ancientCities||[]).find(s=>Math.hypot(player.pos.x-s.x,player.pos.z-s.z)<(s.radius||24));
    if(ancient)return {cls:'event danger'+ring,name:'Ancient City',meta:'Deep ruins - read tablets, open vaults, and approach the core carefully'};
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
    return { cls:'town', name:'Meditation Hall', meta:'Meditation and quiet focus' };
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
  if(quest.type==='farm') return {label:qLabel, text:'Farm crops for '+quest.giver+' '+quest.have+'/'+quest.need};
  if(quest.type==='cook') return {label:qLabel, text:'Cook food for '+quest.giver+' '+quest.have+'/'+quest.need};
  if(quest.type==='smith') return {label:qLabel, text:'Forge supplies for '+quest.giver+' '+quest.have+'/'+quest.need};
  if(quest.type==='treasure') return {label:qLabel, text:'Recover caches for '+quest.giver+' '+quest.have+'/'+quest.need};
  if(quest.giver==='Mara Vale'&&quest.title==='First Hands'){
    const have=Math.min(quest.need,countItem(quest.item||B.LOG));
    if(have>=quest.need) return {label:'First Hands', text:'Return to Mara with '+have+'/'+quest.need+' logs'};
    return {label:'First Hands', text:(isTownLand(Math.floor(player.pos.x),Math.floor(player.pos.z))?'Leave through the north gate and gather logs ':'Gather logs beyond town ')+have+'/'+quest.need};
  }
  if(quest.type==='fetch') return {label:qLabel, text:'Bring '+Math.min(quest.need,countItem(quest.item))+'/'+quest.need+' to '+quest.giver};
  if(quest.type==='sell'){
    const has=countItem(quest.item||I.MONSTER_MEAT)>0;
    const item=ITEMS[quest.item]&&ITEMS[quest.item].name||'goods';
    return {label:qLabel, text:has?'Bring '+item+' to Greta and sell it':'Gather '+item+' for Greta'};
  }
  if(quest.type==='utility') return {label:qLabel, text:utilityUnlocked(quest.utility)?'Return to '+quest.giver:'Follow the trail to the Job Board and complete a Guild Contract'};
  if(quest.type==='familiar'){
    const def=FAMILIARS&&FAMILIARS[quest.familiar], item=def&&ITEMS[def.sigil]&&ITEMS[def.sigil].name||'binding item';
    return {label:qLabel, text:familiarUnlocks.includes(quest.familiar)?'Return to '+quest.giver:'Use '+item+' from your hotbar, then press K'};
  }
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
function jobContractDestinationLabel(c){
  if(!c)return 'the marker';
  if(jobContractReady())return 'Job Board';
  if(c.targetName)return c.targetName;
  if(c.location)return c.location;
    const labels={kill:'Wilderness roads',hunt:'Wild animal routes',gate:'Active Gate',event:'Server event',mine:'Caves and ore seams',cave_survey:'Cave entrance',ancient_map:'Ancient City clue',treasure:'Treasure clue',farm:'Town Farm',cook:'Crafting or kitchen',sell:'Tavern counter',smith:'Smithy forge',repair:'Smithy workbench',upgrade:"Tobin's forge",salvage:"Tobin's salvage bench",meditate:'Meditation Hall'};
  return labels[c.type]||'contract marker';
}
function jobContractCompassTarget(c=clampJobContract(jobContract)){
  if(!c || (c.job!=='adventurer'&&c.job!==playerJob))return null;
  if(jobContractReady())return {label:'Job Board',x:HUB.jobs.x,z:HUB.jobs.z};
  if((c.targetX||c.targetZ)&&Number.isFinite(c.targetX)&&Number.isFinite(c.targetZ))return {label:jobContractDestinationLabel(c),x:c.targetX,z:c.targetZ};
  if(c.type==='farm')return {label:'Town Farm',x:HUB.farm.x,z:HUB.farm.z};
  if(c.type==='cook'||c.type==='sell')return {label:c.type==='sell'?'Tavern counter':'Kitchen',x:HUB.tavern.x,z:HUB.tavern.z};
  if(c.type==='smith'||c.type==='repair'||c.type==='upgrade'||c.type==='salvage')return {label:'Smithy',x:HUB.smith.x,z:HUB.smith.z};
  if(c.type==='meditate')return {label:'Meditation Hall',x:HUB.shrine.x,z:HUB.shrine.z};
  if(c.type==='mine'||c.type==='cave_survey'||c.type==='ancient_map'||c.type==='treasure')return {label:jobContractDestinationLabel(c),x:HUB.quarry.x,z:HUB.quarry.z};
  if(c.type==='gate')return gate?{label:'Active Gate',x:gate.x||TOWN.TC,z:gate.z||TOWN.TC}:{label:'North Gate',x:HUB.northGate.x,z:HUB.northGate.z+1.2};
  if(c.type==='kill'||c.type==='hunt')return {label:jobContractDestinationLabel(c),x:HUB.northGate.x,z:HUB.northGate.z-15};
  return null;
}
function jobContractObjective(){
  const c=clampJobContract(jobContract);
  if(!c || (c.job!=='adventurer'&&c.job!==playerJob)) return null;
  if(jobContractReady()) return {label:'Job Contract', text:'Claim reward: '+c.title};
  if(c.type==='cave_survey') return {label:'Miner Contract', text:'Survey underground cave routes '+Math.min(c.need,c.have)+'/'+c.need};
  if(c.type==='ancient_map') return {label:'Miner Contract', text:'Complete Ancient City map clues '+Math.min(c.need,c.have)+'/'+c.need};
  return {label:'Job Contract', text:c.title+' '+Math.min(c.need,c.have)+'/'+c.need+' - follow marker to '+jobContractDestinationLabel(c)};
}
function activeObjectiveList(){
  const list=QUEST_OBJECTIVES&&QUEST_OBJECTIVES.normalizeObjectiveList?QUEST_OBJECTIVES.normalizeObjectiveList(activeObjectives):activeObjectives;
  return Array.isArray(list) ? list
    .filter(o=>o&&typeof o==='object'&&o.id&&o.title&&o.status!=='failed')
    .slice(0,12) : [];
}
function serverObjectiveForHud(){
  const list=activeObjectiveList();
  if(!list.length)return null;
  return list
    .filter(o=>o.source!=='tutorial')
    .sort((a,b)=>(a.priority|0)-(b.priority|0)||String(a.title||'').localeCompare(String(b.title||'')))[0] || null;
}
function serverObjectiveProgressText(o){
  const p=o&&o.progress;
  if(!p||!Number.isFinite(p.current)||!Number.isFinite(p.required))return '';
  return Math.min(p.required,p.current)+'/'+p.required+' - ';
}
function serverObjectiveHudText(o){
  if(!o)return '';
  if(o.hudText)return o.hudText;
  const legacy={
    'progression:first_land_claim':'Leave town and buy your first land claim',
    'progression:first_claim_expand':'Expand your protected base to 3 connected land claims',
    'progression:first_base_setup':'Inside claimed land: place storage, light, and a station',
    'progression:first_profession_contract':'Take your first repeatable contract at the Job Board'
  };
  if(legacy[o.id])return legacy[o.id];
  const prefix=serverObjectiveProgressText(o);
  if(o.status==='claimable'){
    const location=o.location||'the turn-in point';
    if(o.source==='job')return 'Complete - claim at the Job Board';
    if(o.source==='guild')return 'Complete - claim at Guild Contracts';
    if(o.source==='aegis')return 'Complete - claim from the Aegis Guardian';
    return 'Complete - turn in to '+location;
  }
  const state=o.status==='offered'?'Available - ':'';
  return prefix+state+(o.text||'Follow the objective.');
}
function objectiveTurnInLabel(o){
  if(!o)return 'TURN IN';
  const location=String(o.location||'').trim();
  if(o.source==='job')return 'CLAIM AT JOB BOARD';
  if(o.source==='guild')return 'CLAIM GUILD CONTRACT';
  if(o.source==='aegis')return 'CLAIM AT AEGIS';
  if(location==='Mara Vale')return 'TURN IN TO MARA';
  if(location)return 'TURN IN TO '+location.toUpperCase().slice(0,18);
  return 'TURN IN';
}
function serverObjectiveHudAction(o){
  if(!o)return null;
  if(o.id==='progression:first_d_gate'){
    const craft=objectiveCraftAction('what_next');
    if(craft)return craft;
    const prep=ONBOARD.dRankPrepStatus&&ONBOARD.dRankPrepStatus();
    return prep&&prep.ready ? {type:'find_gate',label:'FIND GATE'} : {type:'questlog',label:'OPEN GATE PREP'};
  }
  const explicit=o.hudAction||o.claimAction||o.action;
  const type=explicit&&explicit.type||'';
  if(type==='turn_in')return {type:'turn_in',label:objectiveTurnInLabel(o),location:o.location||'',source:o.source||''};
  if(type==='find_gate')return {type:'find_gate',label:explicit.label||'FIND GATE'};
  if(type==='jobs')return {type:'jobs',label:explicit.label||(o.status==='claimable'?'CLAIM AT JOB BOARD':'OPEN JOB BOARD')};
  if(type==='guild_contracts')return {type:'guild_contracts',label:explicit.label||(o.status==='claimable'?'CLAIM GUILD CONTRACT':'OPEN GUILD CONTRACTS')};
  if(type==='land')return {type:'land',label:explicit.label||'CLAIM LAND'};
  if(type==='craft'){
    const craft=objectiveCraftAction('what_next');
    return craft || {type:'questlog',label:explicit.label||'OPEN QUEST LOG'};
  }
  if(type==='claim_aegis')return {type:'claim_aegis',label:explicit.label||'CLAIM AT AEGIS'};
  if(type==='quest_log')return {type:'questlog',label:explicit.label||'OPEN QUEST LOG'};
  return explicit&&explicit.label ? {type:'questlog',label:explicit.label} : null;
}
function serverObjectiveHud(){
  const obj=serverObjectiveForHud();
  return obj ? {label:obj.title||'Objective', text:serverObjectiveHudText(obj), serverObjective:obj} : null;
}
function objectiveProgressParts(current,required){
  current=Math.max(0,current|0);required=Math.max(1,required|0);
  return {current:Math.min(required,current),required,pct:Math.max(0,Math.min(100,Math.round((Math.min(required,current)/required)*100)))};
}
function serverObjectiveProgressParts(o){
  const p=o&&o.progress;
  return p&&Number.isFinite(p.current)&&Number.isFinite(p.required)?objectiveProgressParts(p.current,p.required):null;
}
function objectiveLine(kind,label,title,text,action,progress=null){
  return {kind,label,title:title||label,text:text||'',action,progress};
}
function currentPlayerStyleGuide(){
  if(menusApi.playerStyleGuide){
    const guide=menusApi.playerStyleGuide();
    if(guide&&guide.id)return guide;
  }
  const api=globalThis.BlockcraftPlayerStyleGuide;
  return api&&typeof api.current==='function'?api.current():null;
}
function playerStyleTargetPoint(target){
  if(target==='mara')return {label:'Mara',x:HUB.guide.x,z:HUB.guide.z};
  if(target==='land')return {label:'Land Claim',x:TOWN.TC,z:TOWN.TC+TOWN.HS+10};
  if(target==='farm')return {label:'Farm',x:HUB.farm.x,z:HUB.farm.z};
  if(target==='quarry')return {label:'Quarry',x:HUB.quarry.x,z:HUB.quarry.z};
  if(target==='social')return {label:'Aelin',x:HUB.socialMentor.x,z:HUB.socialMentor.z};
  if(target==='roost')return {label:'Roost',x:HUB.roost.x,z:HUB.roost.z};
  if(target==='cartographer')return {label:'Cartographer',x:HUB.cartographer.x,z:HUB.cartographer.z};
  if(target==='shrine')return {label:'Meditation Hall',x:HUB.shrine.x,z:HUB.shrine.z};
  return {label:'Town Guide',x:HUB.guide.x,z:HUB.guide.z};
}
function playerStyleObjectiveLine(){
  if(dim!=='overworld')return null;
  const guide=currentPlayerStyleGuide();
  if(guide)return objectiveLine('player_style','Style',guide.title,guide.action,{type:'player_style',label:guide.label||'FOLLOW STYLE'});
  if(isTownLand(Math.floor(player.pos.x),Math.floor(player.pos.z)))return objectiveLine('player_style','Style','Choose Your First Style','Pick fighter, builder, farmer, miner, social, collector, explorer, or learner guidance',{type:'player_style',label:'CHOOSE STYLE'});
  return null;
}
function serverObjectiveBySource(...sources){
  const set=new Set(sources);
  return activeObjectiveList()
    .filter(o=>set.has(o.source)||sources.some(src=>String(o.id||'').startsWith(src+':')))
    .sort((a,b)=>(a.priority|0)-(b.priority|0)||String(a.title||'').localeCompare(String(b.title||'')))[0] || null;
}
function progressionObjectiveFallback(){
  if(progressionFocus==='first_land_claim')return objectiveLine('progression','Next','First Claim','Leave town and buy your first land claim',{type:'land',label:'CLAIM LAND'});
  if(progressionFocus==='first_claim_expand')return objectiveLine('progression','Next','Expand Claim','Expand your protected base to 3 connected land claims',{type:'land',label:'CLAIM LAND'});
  if(progressionFocus==='first_base_setup')return objectiveLine('progression','Next','Base Setup','Inside claimed land: place storage, light, and a station',{type:'land',label:'CLAIM LAND'});
  if(progressionFocus==='first_craft_station'){
    const craft=objectiveCraftAction('what_next');
    return objectiveLine('progression','Next','Craft Station','Craft your first table or furnace',craft||{type:'questlog',label:'OPEN QUEST LOG'});
  }
  if(progressionFocus==='first_profession_contract'||progressionFocus==='first_promotion_job'||progressionFocus==='first_promotion_contract'||progressionFocus==='next_adventurer_contract'){
    return objectiveLine('progression','Next','Profession Work','Take or claim repeatable work at the Job Board',{type:'jobs',label:'OPEN JOB BOARD'});
  }
  if(progressionFocus==='first_d_gate'){
    const craft=objectiveCraftAction('what_next'),prep=ONBOARD.dRankPrepStatus&&ONBOARD.dRankPrepStatus();
    return objectiveLine('progression','Next','D-Rank Prep',prep&&prep.ready?'Ready - find and clear a D-rank Gate':'Prepare food, gear, repairs, and a D-rank key',craft||(prep&&prep.ready?{type:'find_gate',label:'FIND GATE'}:{type:'questlog',label:'OPEN GATE PREP'}));
  }
  const promotion=ONBOARD.firstPromotionObjective&&ONBOARD.firstPromotionObjective();
  return promotion?objectiveLine('progression','Next',promotion.label,promotion.text,currentObjectiveAction()):null;
}
function localStoryObjectiveLine(){
  if(!quest)return null;
  if(questExpired()){failAegisBounty('time');return null;}
  const story=questObjective();if(!story)return null;
  const isAegis=quest.source==='guardian'||quest.type==='pvp_bounty';
  let action;
  if(questDone())action=isAegis?{type:'claim_aegis',label:'CLAIM AT AEGIS'}:{type:'turn_in',label:quest.giver==='Mara Vale'?'TURN IN TO MARA':'TURN IN',location:quest.giver||'',source:quest.source||'npc'};
  else if(quest.type==='gate')action={type:'find_gate',label:'FIND GATE'};
  else action=objectiveCraftAction('story')||{type:'questlog',label:'QUEST LOG'};
  const progress=quest.need?objectiveProgressParts(quest.have||countItem(quest.item)||0,quest.need):null;
  return objectiveLine(isAegis?'aegis':'story',isAegis?'Aegis':'Story',story.label,story.text,action,progress);
}
function localJobObjectiveLine(){
  const c=clampJobContract(jobContract),job=jobContractObjective();
  if(!c||!job)return null;
  const action=jobContractReady()?{type:'jobs',label:'CLAIM AT JOB BOARD'}:(objectiveCraftAction('job')||{type:'follow_marker',label:'FOLLOW MARKER'});
  return objectiveLine('job','Job',job.label,job.text,action,objectiveProgressParts(c.have,c.need));
}
function localGuildObjectiveLine(){
  const c=clampRegionalContract(regionalContract),guild=guildContractObjective();
  if(!c||!guild)return null;
  return objectiveLine('guild','Guild',guild.label,guild.text,{type:'guild_contracts',label:c.ready?'CLAIM GUILD':'GUILD WORK'},objectiveProgressParts(c.have,c.need));
}
function serverObjectiveLine(o,labelOverride=''){
  if(!o)return null;
  return objectiveLine(o.source||'server',labelOverride||((o.source||'Objective').toUpperCase()),o.title||'Objective',serverObjectiveHudText(o),serverObjectiveHudAction(o)||{type:'questlog',label:'QUEST LOG'},serverObjectiveProgressParts(o));
}
function gatePrepTargetRank(){
  if(menusApi.nextGatePrepRank){
    const rank=menusApi.nextGatePrepRank();
    if(rank>=0)return rank;
  }
  if(quest&&quest.type==='gate'&&quest.gateRank!=null)return Math.max(0,Math.min(4,quest.gateRank|0));
  if(progressionFocus==='first_d_gate')return 1;
  return -1;
}
function gatePrepObjectiveLine(){
  const rank=gatePrepTargetRank();
  if(rank<0||!menusApi.gateReadiness)return null;
  const prep=menusApi.gateReadiness(rank);
  if(!prep||prep.ready&&!(quest&&quest.type==='gate')&&progressionFocus!=='first_d_gate')return null;
  const rankName=RANKS[rank]&&RANKS[rank].n||'?';
  const next=prep.next?'Next: '+prep.next.label:'Ready - find or join a Gate';
  const action=prep.ready?{type:'find_gate',label:'FIND GATE'}:{type:'gate_prep',label:'PREP CHECK',rank};
  return objectiveLine('prep','Prep',rankName+'-Rank Prep',prep.status+' '+prep.score+'/'+prep.total+' - '+next,action,objectiveProgressParts(prep.score,prep.total));
}
function idleObjectiveLine(){
  if(dim!=='overworld')return null;
  const inTown=isTownLand(Math.floor(player.pos.x),Math.floor(player.pos.z));
  if(inTown)return objectiveLine('progression','Next','Choose Work','Open your Quest Log or visit the Job Board for the clearest task',{type:'questlog',label:'OPEN QUEST LOG'});
  return objectiveLine('progression','Next','Find A Lead','Return to town, follow a landmark, or open your Quest Log',{type:'questlog',label:'OPEN QUEST LOG'});
}
function nextBestObjectiveLine(){
  if(dim==='dungeon'||dim==='event'||dim==='gatecutscene')return null;
  if(townGuidanceActive&&!jobContract)return null;
  const transition=transitionRecoveryAction();
  if(transition){
    const title=transition.type==='continue_panel'?'Continue Reward':
      transition.type==='choose_path'?'Choose Path':
      transition.type==='start_awakening'?'Start Awakening':
      transition.type==='use_ability'?'Ability Training':'Continue';
    const text=transition.type==='use_ability'?(combatState.abilityTrainingUsed?'Finish the training meadow':'Use your Q ability in the training meadow'):'Finish the open step so the next objective can appear';
    return objectiveLine('transition','Now',title,text,transition);
  }
  const localJob=localJobObjectiveLine();
  if(localJob)return localJob;
  const story=localStoryObjectiveLine()||serverObjectiveLine(serverObjectiveBySource('story','manhunt'),'Story');
  if(story)return story;
  const progression=serverObjectiveLine(serverObjectiveBySource('progression'),'Next')||progressionObjectiveFallback();
  if(progression&&progressionFocus&&progressionFocus!=='first_d_gate')return progression;
  const prep=gatePrepObjectiveLine();
  if(prep)return prep;
  const aegis=serverObjectiveLine(serverObjectiveBySource('aegis'),'Aegis');
  if(aegis)return aegis;
  const job=serverObjectiveLine(serverObjectiveBySource('job'),'Job');
  if(job)return job;
  const guild=localGuildObjectiveLine()||serverObjectiveLine(serverObjectiveBySource('guild'),'Guild');
  if(guild)return guild;
  const style=playerStyleObjectiveLine();
  if(style)return style;
  return progression||idleObjectiveLine();
}
function unifiedObjectiveList(){
  if(dim==='dungeon'||dim==='event'||dim==='gatecutscene')return [];
  if((townGuidanceActive&&!jobContract)||transitionRecoveryAction())return [];
  const lines=[];
  const story=localStoryObjectiveLine()||serverObjectiveLine(serverObjectiveBySource('story','manhunt'),'Story');
  if(story)lines.push(story);
  const prep=gatePrepObjectiveLine();
  if(prep)lines.push(prep);
  const aegis=!story||story.kind!=='aegis'?serverObjectiveLine(serverObjectiveBySource('aegis'),'Aegis'):null;
  if(aegis)lines.push(aegis);
  const job=localJobObjectiveLine()||serverObjectiveLine(serverObjectiveBySource('job'),'Job');
  if(job)lines.push(job);
  const guild=localGuildObjectiveLine()||serverObjectiveLine(serverObjectiveBySource('guild'),'Guild');
  if(guild)lines.push(guild);
  const progression=serverObjectiveLine(serverObjectiveBySource('progression'),'Next')||progressionObjectiveFallback();
  if(progression)lines.push(progression);
  const seen=new Set();
  return lines.filter(line=>{const key=line.kind+':'+line.title;if(seen.has(key))return false;seen.add(key);return true;}).slice(0,4);
}
function unifiedObjectiveHud(){
  const line=nextBestObjectiveLine();
  return line?{label:'Next Best Action',text:line.title||line.text||'Choose your next step',nextBest:true,line}:null;
}
function trackerActionButton(action){
  if(!action) return '';
  const attrs=['type="button"','class="qaction"','data-objective-action="'+escHTML(action.type||'')+'"'];
  if(action.outputId!=null) attrs.push('data-output-id="'+(action.outputId|0)+'"');
  if(action.rank!=null) attrs.push('data-rank="'+(action.rank|0)+'"');
  if(action.kind) attrs.push('data-kind="'+escHTML(action.kind)+'"');
  if(action.location) attrs.push('data-location="'+escHTML(action.location)+'"');
  if(action.source) attrs.push('data-source="'+escHTML(action.source)+'"');
  return '<button '+attrs.join(' ')+'>'+escHTML(action.label||'OPEN')+'</button>';
}
function objectiveCraftAction(scope='what_next'){
  const action=menusApi.trackerCraftAction&&menusApi.trackerCraftAction(scope);
  return action ? {type:'craft',label:action.label,outputId:action.outputId,kind:action.kind} : null;
}
function transitionPanelState(){
  const reward=document.getElementById('rewardwin');
  const path=document.getElementById('pathselect');
  const awakening=document.getElementById('awakeningwin');
  const rewardOpen=!!(reward&&!reward.classList.contains('hidden'));
  const pathOpen=!!(path&&!path.classList.contains('hidden'));
  const awakeningOpen=!!(awakening&&!awakening.classList.contains('hidden'));
  return {rewardOpen,pathOpen,awakeningOpen};
}
function transitionRecoveryAction(){
  const panels=transitionPanelState();
  if(panels.rewardOpen) return {type:'continue_panel',label:'CONTINUE'};
  if(panels.pathOpen || (S&&S.lvl>=2&&!S.path)) return {type:'choose_path',label:'CHOOSE PATH'};
  if(panels.awakeningOpen || (S&&S.lvl>=2&&S.path&&combatState.abilityReady&&!combatState.abilityTutorialDone&&!combatState.abilityTrainingActive)) return {type:'start_awakening',label:'START AWAKENING'};
  if(combatState.abilityTrainingActive) return {type:'use_ability',label:combatState.abilityTrainingUsed?'FINISH TRAINING':'USE ABILITY'};
  return null;
}
function currentObjectiveAction(){
  const transition=transitionRecoveryAction();
  if(transition) return transition;
  if(jobContract){
    if(jobContractReady()) return {type:'jobs',label:'CLAIM AT JOB BOARD'};
    const craft=objectiveCraftAction('job');
    return craft || {type:'follow_marker',label:'FOLLOW MARKER'};
  }
  const server=serverObjectiveForHud(),serverAction=serverObjectiveHudAction(server);
  if(serverAction)return serverAction;
  if(quest && questDone()) return {type:'turn_in',label:quest.giver==='Mara Vale'?'TURN IN TO MARA':'TURN IN',location:quest.giver||'',source:quest.source||'npc'};
  const rc=clampRegionalContract(regionalContract);
  if(rc&&rc.ready) return {type:'guild_contracts',label:'CLAIM GUILD CONTRACT'};
  if(progressionFocus==='first_craft_station'){
    const craft=objectiveCraftAction('what_next');
    if(craft) return craft;
  }
  if(progressionFocus==='first_land_claim'||progressionFocus==='first_claim_expand'||progressionFocus==='first_base_setup') return {type:'land',label:'CLAIM LAND'};
  if(progressionFocus==='first_profession_contract'||progressionFocus==='first_promotion_job'||progressionFocus==='first_promotion_contract'||progressionFocus==='next_adventurer_contract') return {type:'jobs',label:'OPEN JOB BOARD'};
  if(progressionFocus==='first_d_gate'){
    const craft=objectiveCraftAction('what_next');
    if(craft) return craft;
    const prep=ONBOARD.dRankPrepStatus&&ONBOARD.dRankPrepStatus();
    return prep&&prep.ready ? {type:'find_gate',label:'FIND GATE'} : {type:'questlog',label:'OPEN GATE PREP'};
  }
  if(quest&&!questDone()){
    if(quest.type==='gate') return {type:'find_gate',label:'FIND GATE'};
    const craft=objectiveCraftAction('story');
    if(craft) return craft;
  }
  return null;
}
function e2eCurrentObjectiveAction(){
  const action=currentObjectiveAction();
  return action ? {type:action.type||'',label:action.label||'',outputId:action.outputId||0,kind:action.kind||''} : null;
}
function objectiveHudHTML(obj){
  if(!obj) return '';
  if(obj.nextBest&&obj.line){
    const line=obj.line;
    const progress=line.progress?'<i style="width:'+line.progress.pct+'%"></i>':'';
    const progressText=line.progress?'<em>'+line.progress.current+'/'+line.progress.required+'</em>':'';
    return '<div class="qt">Next Best Action</div><div class="objective-list next-best-list">'+
      '<div class="objective-line next-best '+escHTML(line.kind||'objective')+'">'+
        '<div class="olabel">'+escHTML(line.label||'Next')+'</div>'+
        '<div class="obody"><b>'+escHTML(line.title||'Next Step')+'</b><span>'+escHTML(line.text||'')+'</span>'+(line.progress?'<div class="obar">'+progress+'</div>':'')+'</div>'+
        '<div class="oact">'+progressText+trackerActionButton(line.action)+'</div>'+
      '</div>'+
    '</div>';
  }
  if(obj.unified&&Array.isArray(obj.lines)){
    const rows=obj.lines.map(line=>{
      const progress=line.progress?'<i style="width:'+line.progress.pct+'%"></i>':'';
      const progressText=line.progress?'<em>'+line.progress.current+'/'+line.progress.required+'</em>':'';
      return '<div class="objective-line '+escHTML(line.kind||'objective')+'">'+
        '<div class="olabel">'+escHTML(line.label||'Objective')+'</div>'+
        '<div class="obody"><b>'+escHTML(line.title||'Objective')+'</b><span>'+escHTML(line.text||'')+'</span>'+(line.progress?'<div class="obar">'+progress+'</div>':'')+'</div>'+
        '<div class="oact">'+progressText+trackerActionButton(line.action)+'</div>'+
      '</div>';
    }).join('');
    return '<div class="qt">Objective Tracker</div><div class="objective-list">'+rows+'</div>';
  }
  const action=currentObjectiveAction(obj);
  return ONBOARD.objectiveHudHTML(action?{...obj,actionHTML:trackerActionButton(action)}:obj);
}
function currentObjectiveHud(){
  const unified=unifiedObjectiveHud();
  if(unified)return unified;
  const current=currentObjective();
  return current?{...current,label:'Next Best Action'}:null;
}
function refreshObjectiveTracker(){
  if(!currentQuestEl)return;
  const obj=currentObjectiveHud();
  if(obj){
    currentQuestEl.classList.remove('hidden');
    currentQuestEl.innerHTML=objectiveHudHTML(obj);
  }else{
    currentQuestEl.classList.add('hidden');
    currentQuestEl.innerHTML='';
  }
}
globalThis.BlockcraftRefreshObjectiveTracker=refreshObjectiveTracker;
function handleObjectiveAction(action,btn){
  if(action==='craft'){menusApi.activateCraftShortcut&&menusApi.activateCraftShortcut(+(btn.dataset.outputId||0),btn.dataset.kind||'craft');return;}
  if(action==='jobs'){menusApi.openJobs&&menusApi.openJobs();return;}
  if(action==='guild_contracts'){menusApi.openRegionalContracts&&menusApi.openRegionalContracts();return;}
  if(action==='claim_aegis'){menusApi.openGuardian&&menusApi.openGuardian();return;}
  if(action==='continue_panel'){
    const btn=document.getElementById('milestonecontinue')||document.getElementById('rewardclose')||document.getElementById('trainingcontinue')||document.getElementById('promotioncontinue')||document.getElementById('graduationcontinue');
    if(btn){ btn.click(); return; }
    sysMsg('<b>Continue:</b> close the open reward panel to resume the next objective.');
    return;
  }
  if(action==='choose_path'){
    if(combatState.pathChoiceOpen || transitionPanelState().pathOpen){ sysMsg('<b>Choose Path:</b> select Shadow, Mage, or Guardian to unlock your first ability.'); return; }
    if(combatApi.showPathSelection&&combatApi.showPathSelection()) return;
    sysMsg('<b>Choose Path:</b> finish the current panel, then choose your combat path.');
    return;
  }
  if(action==='start_awakening'){
    if(transitionPanelState().awakeningOpen){ const b=document.getElementById('awakeningbegin'); if(b){ b.click(); return; } }
    if(combatApi.showAbilityAwakening&&combatApi.showAbilityAwakening()) return;
    if(combatApi.startAbilityTraining&&combatApi.startAbilityTraining()) return;
    sysMsg('<b>Awakening:</b> choose your path first, then start ability training.');
    return;
  }
  if(action==='use_ability'){ combatApi.primaryAction&&combatApi.primaryAction(); return; }
  if(action==='follow_marker'){
    const t=utilityCompassTarget();
    if(t&&Number.isFinite(t.x)&&Number.isFinite(t.z))sysMsg('<b>Follow marker:</b> '+escHTML(t.label||'Objective')+' is '+escHTML(utilityTargetHudLine(t))+'.');
    else sysMsg('<b>Follow marker:</b> use the compass trail in the world to continue.');
    return;
  }
  if(action==='land'){
    worldApi.toggleLandClaims&&worldApi.toggleLandClaims(true);
    worldApi.openLandClaims&&worldApi.openLandClaims();
    sysMsg('<b>Land claiming:</b> choose an available tile near your base. The overlay shows owned, shared, and wilderness land.');
    return;
  }
  if(action==='gate_prep'){
    menusApi.openGatePrep&&menusApi.openGatePrep(+(btn.dataset.rank||0));
    return;
  }
  if(action==='player_style'){
    menusApi.openPlayerStyleGuide&&menusApi.openPlayerStyleGuide();
    return;
  }
  if(action==='questlog'){menusApi.openQuestLog&&menusApi.openQuestLog();return;}
  if(action==='find_gate'){
    if(gate){sysMsg('<b>Gate target:</b> '+escHTML(RANKS[gate.rank].n+'-Rank '+gateKindLabel(gate.kind))+' Gate is '+escHTML(gateCompass())+'.');return;}
    menusApi.openQuestLog&&menusApi.openQuestLog();
    sysMsg('<b>Find Gate:</b> no nearby Gate is currently tracked. Open the Quest Log and follow the active Gate objective.');
    return;
  }
  if(action==='turn_in'||action==='return_mara'){
    menusApi.openQuestLog&&menusApi.openQuestLog();
    const location=btn&&btn.dataset&&btn.dataset.location || quest&&quest.giver || 'the quest giver';
    sysMsg('<b>Ready to claim:</b> return to '+escHTML(location)+'. Quest Log opened for context.');
  }
}
if(currentQuestEl){
  const triggerObjectiveAction=e=>{
    const btn=e.target&&e.target.closest&&e.target.closest('[data-objective-action]');
    if(!btn) return;
    e.preventDefault();
    e.stopPropagation();
    handleObjectiveAction(btn.dataset.objectiveAction,btn);
  };
  currentQuestEl.addEventListener('pointerdown',triggerObjectiveAction,{capture:true});
  currentQuestEl.addEventListener('click',triggerObjectiveAction);
}
function currentObjective(){
  if(dim==='gatecutscene') return {label:'Gate Vision', text:'The first dungeon reveals itself'};
  if(dim==='dungeon'){
    const st=dungeon&&dungeon.status;
    const boss=st?(st.cleared?'Cleared':st.bossAlive?'Boss alive':'Boss down'):(dungeon&&dungeon.cleared?'Cleared':'Boss alive');
    const chests=st?(' - chests '+st.remainingChests):'';
    let party=st&&st.party?st.party.length:1;
    if(!st&&NET.on&&NET.dgn) for(const sid in NET.remotes) if((NET.remotes[sid].ref.dgn||'')===NET.dgn) party++;
    const spirits=st&&Number.isFinite(st.spiritCount)?(' - spirits '+st.spiritCount):'';
    const alive=st&&Number.isFinite(st.aliveCount)?(' - alive '+st.aliveCount):'';
    return {label:'Current Goal', text:boss+' - party '+party+alive+spirits+chests};
  }
  if(dim==='event'){
    const left=serverEvent&&serverEvent.endsAt?(' - '+fmtTimeLeft(serverEvent.endsAt-Date.now())+' left'):'';
    const text=serverEvent&&serverEvent.kind==='king' ? 'Hold the crown longer than every team'+left : 'Reach the finish before time runs out'+left;
    return {label:'Current Goal', text};
  }
  const transition=transitionRecoveryAction();
  if(transition){
    if(transition.type==='continue_panel') return {label:'Reward Pending', text:'Continue the open reward panel to unlock the next step'};
    if(transition.type==='choose_path') return {label:'Path Choice', text:'Choose a combat path to unlock your first ability'};
    if(transition.type==='start_awakening') return {label:'Ability Awakening', text:'Start ability training for your chosen path'};
    if(transition.type==='use_ability') return {label:'Ability Training', text:combatState.abilityTrainingUsed?'Finish the training meadow':'Use your Q ability in the training meadow'};
  }
  const job=jobContractObjective();
  if(job) return job;
  const guided=tutorialObjective();
  if(guided) return guided;
  const server=serverObjectiveHud();
  if(server) return server;
  const story=questObjective();
  if(story) return story;
  const guild=guildContractObjective();
  if(guild) return guild;
  const promotion=ONBOARD.firstPromotionObjective();
  if(promotion) return promotion;
  if(dim==='overworld' && Math.hypot(player.pos.x-HUB.jobs.x, player.pos.z-HUB.jobs.z)<6)
    return {label:'Current Goal', text:'Choose or claim work at the Job Board'};
  if(dim==='overworld' && Math.hypot(player.pos.x-HUB.quarry.x, player.pos.z-HUB.quarry.z)<7)
    return {label:'Current Goal', text:'Speak with Garrik for miner work'};
  if(dim==='overworld' && Math.hypot(player.pos.x-HUB.farm.x, player.pos.z-HUB.farm.z)<7)
    return {label:'Current Goal', text:'Speak with Liss for farmer work'};
  if(dim==='overworld' && Math.hypot(player.pos.x-HUB.shrine.x, player.pos.z-HUB.shrine.z)<9)
    return {label:'Current Goal', text:inMeditationSpot()?'Meditate with G / right-click':'Stand inside the Meditation Hall to meditate'};
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
let lastLocationFeedKey='', lastLocationFeedAt=0;
function locationFeedKey(loc){
  if(!loc||!loc.name)return '';
  const cls=String(loc.cls||'').split(/\s+/)[0]||'zone';
  return cls+':'+String(loc.name||'').toLowerCase();
}
function locationFeedLabel(loc){
  const cls=String(loc&&loc.cls||'');
  if(cls.includes('dungeon'))return '[Dungeon]';
  if(cls.includes('event'))return '[Event]';
  if(cls.includes('town'))return '[Town]';
  return '[Explore]';
}
function announceLocationEnter(loc){
  const key=locationFeedKey(loc), now=performance.now();
  if(!key||key===lastLocationFeedKey||now-lastLocationFeedAt<2800)return;
  lastLocationFeedKey=key;lastLocationFeedAt=now;
  if(typeof eventLog==='function')eventLog('Entered '+String(loc.name||'new area')+(loc.meta?' - '+String(loc.meta):''),locationFeedLabel(loc));
}
function updateDiscoverySight(){
  const now=performance.now();if(dim!=='overworld'||now<nextDiscoverySightAt)return;nextDiscoverySightAt=now+900;
  let seen=null;
  for(const s of [...smallDiscoveries,...regionalLandmarks,...(ancientCities||[])])if(!discoveredIds.has(s.id)&&Math.hypot(player.pos.x-s.x,player.pos.z-s.z)<(s.radius||8)+2){seen=s;break;}
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
  announceLocationEnter(loc);
}
function bearingLabelTo(x,z){
  const dx=x-player.pos.x, dz=z-player.pos.z;
  const dist=Math.round(Math.hypot(dx,dz));
  const ang=(Math.atan2(dx,-dz)+Math.PI*2)%(Math.PI*2);
  const dirs=['N','NE','E','SE','S','SW','W','NW'];
  const dir=dirs[Math.round(ang/(Math.PI/4))%8];
  return dir+' '+dist+'m';
}
function activityTimeLeft(expiresAt){
  const ms=(expiresAt||0)-Date.now();
  if(!expiresAt||ms<=0)return 'expiring now';
  const sec=Math.ceil(ms/1000), min=Math.floor(sec/60), s=sec%60;
  return min+':'+String(s).padStart(2,'0');
}
function gateCollapseHint(expiresAt){
  const ms=(expiresAt||0)-Date.now();
  if(!expiresAt||ms>24*3600*1000)return '';
  if(ms<=0)return 'Gate is breaching now';
  const sec=Math.ceil(ms/1000), min=Math.floor(sec/60), s=sec%60, time=min+':'+String(s).padStart(2,'0');
  if(ms<=60000)return 'Collapse imminent: '+time;
  if(ms<=180000)return 'Unstable: '+time+' until collapse';
  return 'Collapses in '+time;
}
function findKnownSite(id){
  return [...regionalLandmarks,...smallDiscoveries,...(ancientCities||[])].find(s=>s.id===id)||null;
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
  if(a.gateBreach)add(a.gateBreach,'Gate Breach: '+(a.gateBreach.bossName||'Escaped Boss'),'Containment cleanup');
  if(!a.gateBreach&&a.gateScar)add(a.gateScar,'Gate Scar: '+(a.gateScar.bossName||'Collapsed Gate'),'Breach aftermath');
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
  const trail=dim==='overworld'&&overworldActivity&&overworldActivity.trailSense;
  if(trail&&Number.isFinite(trail.x)&&Number.isFinite(trail.z)&&(!trail.expiresAt||trail.expiresAt>Date.now())){
    return {label:trail.kind==='breach'?'Breach Trail':'Trail Sense',x:trail.x,z:trail.z};
  }
  if(dim==='overworld'&&overworldActivity&&overworldActivity.gateBreach){
    const b=overworldActivity.gateBreach;
    return {label:'Breach',x:b.x,z:b.z};
  }
  if(dim==='overworld'&&overworldActivity&&overworldActivity.gateScar){
    const s=overworldActivity.gateScar;
    return {label:'Gate Scar',x:s.x,z:s.z};
  }
  if(progressionFocus==='first_road_ready'||progressionFocus==='first_e_gate'){
    const mara=HUB.mara||HUB.guide;
    return mara?{label:'Mara',x:mara.x,z:mara.z}:null;
  }
  if(progressionFocus==='first_craft_station') return {label:'Crafting',x:HUB.smith.x,z:HUB.smith.z};
  if(progressionFocus==='first_land_claim'||progressionFocus==='first_claim_expand'||progressionFocus==='first_base_setup') return {label:'Claim Land',x:TOWN.TC,z:TOWN.TC+TOWN.HS+10};
  if(progressionFocus==='first_profession_contract') return {label:'Board',x:HUB.jobs.x,z:HUB.jobs.z};
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
  const style=currentPlayerStyleGuide();
  if(style){
    const target=playerStyleTargetPoint(style.target);
    if(target)return target;
  }
  const jobTarget=jobContractCompassTarget();
  if(jobTarget)return jobTarget;
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
function partyCompassTarget(){
  if(!NET.on || !NET.room) return null;
  if(dim==='dungeon'&&activeDungeonPing&&performance.now()<activeDungeonPing.expires&&Number.isFinite(activeDungeonPing.x)&&Number.isFinite(activeDungeonPing.z)){
    const labels={group:'Regroup',boss:'Boss Ping',loot:'Loot Ping'};
    return {label:labels[activeDungeonPing.kind]||'Party Ping', x:activeDungeonPing.x, z:activeDungeonPing.z, priority:'ping'};
  }
  const mine=myTeamId();
  const mineSid=NET.room.sessionId;
  if(dim==='dungeon'&&dungeon&&dungeon.status&&Array.isArray(dungeon.status.party)){
    const status=dungeon.status, me=dungeonStatusMember(status,mineSid), party=status.party.filter(m=>m&&m.sid!==mineSid);
    const urgent=party.find(m=>m.downed||m.spirit);
    if(urgent&&Number.isFinite(urgent.x)&&Number.isFinite(urgent.z)){
      return {label:(urgent.name||'Ally')+' '+(urgent.downed?'downed':'spirit'), x:urgent.x, z:urgent.z, priority:urgent.downed?'downed':'spirit'};
    }
    const objective=dungeonObjectiveState(status,me,Math.max(0,status.remainingChests|0));
    if(objective&&objective.target&&Number.isFinite(objective.target.x)&&Number.isFinite(objective.target.z)){
      return {label:objective.targetLabel==='Ally'?'Regroup':objective.targetLabel||objective.label, x:objective.target.x, z:objective.target.z, priority:'objective'};
    }
  }
  if(dim==='overworld'&&dungeonLobbyState&&dungeonLobbyState.rally){
    const rally=dungeonLobbyState.rally,distance=Math.round(Math.hypot(rally.x-player.pos.x,rally.z-player.pos.z));
    return {label:distance<=6?'At Gate Rally':'Gate Rally', x:rally.x, z:rally.z, priority:'rally'};
  }
  if(!mine) return null;
  let best=null, bd=-1;
  for(const sid in NET.remotes){
    const r=NET.remotes[sid], ref=r&&r.ref;
    if(!ref || ref.team!==mine || (ref.dgn||'')!==NET.dgn) continue;
    const d=Math.hypot((ref.x||0)-player.pos.x,(ref.z||0)-player.pos.z);
    if(d>bd){ bd=d; best=ref; }
  }
  return best?{label:(bd>70?'Split: ':'')+(best.name||'Teammate'), x:best.x, z:best.z, d:bd, priority:'teammate'}:null;
}
function utilityTargetHudLine(t){
  if(!t||!Number.isFinite(t.x)||!Number.isFinite(t.z))return t&&t.text||'Active';
  const d=Math.round(Math.hypot(t.x-player.pos.x,t.z-player.pos.z));
  return bearingLabelTo(t.x,t.z)+' · '+d+'m';
}
function utilityPriorityClass(priority){
  return priority==='downed'||priority==='spirit'?' urgent':priority==='rally'||priority==='ping'?' active':'';
}
function updateUtilityWorldFeedback(now,dt){
  const trail=dim==='overworld'&&overworldActivity&&overworldActivity.trailSense&&(!overworldActivity.trailSense.expiresAt||overworldActivity.trailSense.expiresAt>Date.now())?overworldActivity.trailSense:null;
  trailSenseGroup.visible=!!(trail&&Number.isFinite(trail.x)&&Number.isFinite(trail.z));
  if(trailSenseGroup.visible){
    const y=surfaceY(trail.x,trail.z),pulse=.5+.5*Math.sin(now*.007);
    trailSenseGroup.position.set(trail.x,y+.1,trail.z);
    trailSenseRing.rotation.z+=dt*1.8;trailSenseRing.scale.setScalar(1+pulse*.2);
    trailSenseRing.material.opacity=.56+pulse*.28;trailSenseBeam.material.opacity=.12+pulse*.15;
    if(Math.random()<dt*9)spawnParticle({x:trail.x+(Math.random()-.5)*1.6,y:y+.35+Math.random()*3,z:trail.z+(Math.random()-.5)*1.6,vx:(Math.random()-.5)*.18,vy:.28+Math.random()*.45,vz:(Math.random()-.5)*.18,life:.6,grav:-.08,r:.56,g:.97,b:.78});
  }
  const party=utilityEquipped('party_compass')?partyCompassTarget():null;
  const partyVisible=party&&Number.isFinite(party.x)&&Number.isFinite(party.z)&&Math.hypot(party.x-player.pos.x,party.z-player.pos.z)>8;
  partyCompassGroup.visible=!!partyVisible;
  if(partyVisible){
    const urgent=party.priority==='downed'||party.priority==='spirit',color=urgent?0xff8fa3:party.priority==='rally'?0x7dd3fc:0xd7b5ff;
    partyCompassBeam.material.color.setHex(color);partyCompassRing.material.color.setHex(color);
    const y=dim==='overworld'?surfaceY(party.x,party.z):(Number.isFinite(party.y)?party.y:player.pos.y);
    const pulse=.5+.5*Math.sin(now*(urgent ? .011 : .006));
    partyCompassGroup.position.set(party.x,y+.1,party.z);
    partyCompassRing.rotation.z+=dt*(urgent?2.5:1.25);partyCompassRing.scale.setScalar(1+pulse*(urgent?.36:.16));
    partyCompassRing.material.opacity=(urgent?.68:.5)+pulse*.24;partyCompassBeam.material.opacity=(urgent?.18:.1)+pulse*.14;
  }
  tickFeatherStepLandingFx(now);
}
function rankHudProgress(){
  const progress=currentRankProgress();
  if(globalThis.BlockcraftDeityState&&globalThis.BlockcraftDeityState.unlocked)return {label:'Ascension',value:'Deity'};
  if(progress.maxRank)return {label:'Hunter Rank',value:'S-Rank - Deity at Lv '+DEITY_LEVEL};
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
  const missing=readiness.next&&!readiness.next.done?(' · Missing: '+readiness.next.label):'';
  gatePromptEl.innerHTML='<span class="key">G</span>Inspect '+escHTML(RANKS[gate.rank|0].n)+'-Rank '+escHTML(gateKindLabel(gate.kind))+' Gate <span class="gate-status '+statusClass+'">'+escHTML(readiness.status)+'</span><span class="gate-preview">Enemy Lv '+preview.enemyLevels[0]+'-'+preview.enemyLevels[1]+' · Recommended party '+partyText+' · '+escHTML(readiness.difficulty+missing)+'</span>';
  const collapse=gateCollapseHint(gate.expiresAt),collapseClass=collapse&&collapse.indexOf('imminent')>=0?' danger':'';
  if(collapse)gatePromptEl.innerHTML='<span class="key">G</span>Inspect '+escHTML(RANKS[gate.rank|0].n)+'-Rank '+escHTML(gateKindLabel(gate.kind))+' Gate <span class="gate-status '+statusClass+collapseClass+'">'+escHTML(collapse)+'</span><span class="gate-preview">Enemy Lv '+preview.enemyLevels[0]+'-'+preview.enemyLevels[1]+' - Recommended party '+partyText+' - '+escHTML(readiness.difficulty+missing)+'</span>';
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
function dungeonStatusMember(status,sid){
  if(!status||!Array.isArray(status.party)||!sid)return null;
  return status.party.find(m=>m&&m.sid===sid)||null;
}
function dungeonObjectiveState(status,me,chestCount){
  if(status.wipe||status.party.length>0&&status.aliveCount===0)return {cls:'danger',label:'Party Wiped',text:'Return to town, repair, and challenge another Gate.',target:status.exit,targetLabel:'Exit'};
  if(me&&me.spirit)return {cls:'danger',label:'Spirit Form',text:'Stay as spirit for party credit, or return to town now to repair and restock.',target:nearestDungeonAlly(status,me),targetLabel:'Ally'};
  if(me&&me.downed)return {cls:'danger',label:'Downed',text:'Hold position while allies finish the fight or return safely.',target:nearestDungeonAlly(status,me),targetLabel:'Ally'};
  if(status.cleared){
    const chest=chestCount>0?nearestDungeonChest(status):null;
    return {cls:'cleared',label:'Boss Defeated',text:chestCount>0?'Boss down. Open remaining chests, then exit through the portal.':'Boss down. Exit through the portal to return safely.',target:chest||status.exit,targetLabel:chest?'Chest':'Exit'};
  }
  if(status.bossAlive){
    if(status.bossGateState==='locked')return {cls:'active',label:'Boss Locked',text:'Clear rooms to open the boss route.',target:status.bossRoom,targetLabel:'Boss'};
    const contrib=Math.max(0,me&&me.contribution|0);
    if(contrib<=0)return {cls:'active',label:'Boss Open',text:'Hit the boss to qualify for reward, then stay near the fight.',target:status.bossRoom,targetLabel:'Boss'};
    return {cls:'active',label:'Boss Open',text:'Reward eligible. Stay near the boss and finish the fight.',target:status.bossRoom,targetLabel:'Boss'};
  }
  const chest=chestCount>0?nearestDungeonChest(status):null;
  return {cls:'active',label:'Regroup',text:chestCount>0?'Boss down. Open remaining chests, then exit through the portal.':'Boss down. Exit through the portal to complete the run.',target:chest||status.exit,targetLabel:chest?'Chest':'Exit'};
}
function nearestDungeonAlly(status,me){
  if(!status||!Array.isArray(status.party))return null;
  let best=null,bd=1e9;
  for(const member of status.party){
    if(!member||member.sid===(me&&me.sid)||member.spirit||member.downed)continue;
    const d=Math.hypot((member.x||0)-player.pos.x,(member.z||0)-player.pos.z);
    if(d<bd){bd=d;best={x:member.x,z:member.z};}
  }
  return best;
}
function dungeonEligibilityState(status,me){
  if(status.wipe)return {cls:'bad',text:'Run failed'};
  if(status.cleared)return {cls:'good',text:'Loot awarded'};
  if(me&&me.spirit)return {cls:'warn',text:'Stay for party credit'};
  if(me&&me.downed)return {cls:'warn',text:'Downed'};
  if(status.bossAlive&&Math.max(0,me&&me.contribution|0)>0)return {cls:'good',text:'Reward eligible'};
  if(status.bossAlive)return {cls:'warn',text:'Hit boss to qualify'};
  return {cls:'warn',text:'Stay near boss room'};
}
function dungeonBossRangeText(status){
  const target=status&&status.boss||status&&status.bossRoom;
  if(!target||!Number.isFinite(target.x)||!Number.isFinite(target.z))return '';
  const d=Math.round(Math.hypot(target.x-player.pos.x,target.z-player.pos.z));
  return d<=18?'Near boss room':'Boss room '+bearingLabelTo(target.x,target.z);
}
function nearestDungeonChest(status){
  if(!status||!Array.isArray(status.unopenedChests))return null;
  let best=null,bd=1e9;
  for(const ch of status.unopenedChests){
    if(!ch||!Number.isFinite(ch.x)||!Number.isFinite(ch.z))continue;
    const d=Math.hypot(ch.x-player.pos.x,ch.z-player.pos.z);
    if(d<bd){bd=d;best=ch;}
  }
  return best;
}
function dungeonBossGateLabel(status){
  const s=status&&status.bossGateState;
  return s==='defeated'?'Boss defeated':s==='locked'?'Boss locked':'Boss open';
}
function dungeonBossHud(status){
  const boss=status&&status.boss;
  if(!boss||status.cleared)return '';
  const pct=Math.max(0,Math.min(100,boss.pct|0));
  return '<div class="dungeonboss"><div><b>'+escHTML(boss.phaseLabel||'Phase 1')+'</b><span>'+pct+'%</span></div><i><em style="width:'+pct+'%"></em></i><small>'+escHTML(boss.action||'Engaged')+' - '+escHTML(dungeonBossRangeText(status)||'Boss room')+'</small></div>';
}
function dungeonNavLine(state){
  if(!state||!state.target||!Number.isFinite(state.target.x)||!Number.isFinite(state.target.z))return '';
  return '<small class="dungeonnav">Objective '+escHTML(state.targetLabel||'Target')+' - '+escHTML(bearingLabelTo(state.target.x,state.target.z))+'</small>';
}
function updateDungeonCoordination(now){
  const status=dim==='dungeon'&&dungeon&&dungeon.status;
  if(!status||!Array.isArray(status.party)){
    dungeonPartyEl.classList.add('hidden');dungeonPartyEl.innerHTML='';
    updateDungeonSpiritMarkers(null,now);
  }else{
    const mine=NET.room&&NET.room.sessionId;
    const alive=Number.isFinite(status.aliveCount)?status.aliveCount:status.party.filter(m=>m&&!m.downed&&!m.spirit).length;
    const spirits=Number.isFinite(status.spiritCount)?status.spiritCount:status.party.filter(m=>m&&m.spirit).length;
    const returned=Math.max(0,status.returnedCount|0);
    const total=Math.max(status.totalPlayers|0,status.party.length+returned);
    const chestCount=Math.max(0,status.remainingChests|0);
    const me=dungeonStatusMember(status,mine);
    const runState=dungeonObjectiveState(status,me,chestCount);
    const eligibility=dungeonEligibilityState(status,me);
    const roomsLine=(status.roomTotal|0)>0?'Rooms Cleared '+Math.max(0,status.roomsCleared|0)+'/'+Math.max(0,status.roomTotal|0)+' - ':'';
    const runCard='<div class="dungeonrun '+runState.cls+'"><div><b>OBJECTIVE</b><span>'+escHTML(runState.label)+'</span></div><p>'+escHTML(runState.text)+'</p>'+dungeonBossHud(status)+'<small class="dungeonnav">'+roomsLine+escHTML(dungeonBossGateLabel(status))+'</small><small class="dungeonnav">Chests '+chestCount+' - Alive '+alive+' - Spirits '+spirits+'</small>'+dungeonNavLine(runState)+'<span class="dungeonelig '+eligibility.cls+'">'+escHTML(eligibility.text)+'</span></div>';
    const summary=runCard+'<div class="partysummary"><span>'+alive+' alive</span><span>'+spirits+' spirit'+(spirits===1?'':'s')+'</span>'+(returned?'<span>'+returned+' returned</span>':'')+'</div>';
    const warning=(status.wipe||status.party.length>0&&alive===0)?'<div class="partywipe">PARTY WIPED · CHOOSE RETURN TO TOWN</div>':'';
    const returnedCard=returned?'<div class="partycard returned"><div class="partyline"><b>Returned to Town</b><small>'+returned+'/'+total+'</small></div><div class="partyline"><small>Left the dungeon instance</small><span class="partycontrib">Safe</span></div></div>':'';
    dungeonPartyEl.innerHTML='<div class="partytitle">GATE PARTY · F1 GROUP · F2 BOSS · F3 LOOT</div>'+summary+warning+status.party.map(member=>{
      let distance=0;
      if(member.sid!==mine){const remote=NET.remotes[member.sid],ref=remote&&remote.ref,pos=ref||member;distance=Number.isFinite(pos.x)&&Number.isFinite(pos.z)?Math.round(Math.hypot((pos.x||0)-player.pos.x,(pos.z||0)-player.pos.z)):0;}
      const hp=Math.max(0,member.hp|0),max=Math.max(1,member.maxHp|0),pct=Math.max(0,Math.min(100,hp/max*100));
      const state=member.spirit?'SPIRIT':member.downed?'DOWNED':'ALIVE';
      const stateClass=member.spirit?' spirit':member.downed?' downed':'';
      const where=member.sid===mine?'YOU':(member.spirit?'SPIRIT · ':'')+distance+'m';
      return '<div class="partycard'+stateClass+'"><div class="partyline"><b>'+escHTML(member.name||'Hunter')+'</b><small>'+escHTML(member.role||'Striker')+' · '+where+'</small></div><div class="partyhp"><i style="width:'+pct+'%"></i></div><div class="partyline"><small>'+state+(member.spirit?' · bound in place':member.downed?'':' · '+hp+'/'+max+' HP')+'</small><span class="partycontrib">Boss '+Math.max(0,member.contribution|0)+'</span></div></div>';
    }).join('')+returnedCard;
    dungeonPartyEl.classList.remove('hidden');
    updateDungeonSpiritMarkers(status,now);
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
  const a=overworldActivity||{};
  const acceptedRegionalContract=clampRegionalContract(regionalContract);
  const trail=a.trailSense&&(!a.trailSense.expiresAt||a.trailSense.expiresAt>Date.now())?a.trailSense:null;
  if(!acceptedRegionalContract&&!a.gateBreach&&!a.gateScar&&!trail){displayedRegionalOpportunity=null;activityTrackerEl.classList.add('hidden');return;}
  const rawCaravan=a.caravan,caravanContract=clampRegionalContract(regionalContract),c=rawCaravan&&caravanContract&&caravanContract.type==='road_escort'&&(!caravanContract.targetId||caravanContract.targetId===rawCaravan.id)?rawCaravan:null,camp=a.camp,patrol=a.patrol,encounter=a.encounter,breach=a.gateBreach,scar=a.gateScar;
  let title='',text='',target=null,danger=false;
  if(breach){
    const hp=Math.max(0,Math.ceil(breach.hp||0)),max=Math.max(1,Math.ceil(breach.maxHp||1)),pct=Math.round(hp/max*100);
    title='Gate Breach: '+(breach.bossName||'Escaped Boss');
    text='Contain the boss · '+hp+'/'+max+' HP · '+pct+'% · '+activityTimeLeft(breach.expiresAt)+' left · cleanup reward';
    text='Emergency bounty - boss '+hp+'/'+max+' HP ('+pct+'%) - '+Math.max(0,breach.remaining|0)+' threat'+((breach.remaining|0)===1?'':'s')+' active - '+activityTimeLeft(breach.expiresAt)+' left';
    target=breach;danger=true;
  }
  else if(scar){
    title='Gate Scar: '+(scar.bossName||'Collapsed Gate');
    text='Aftermath zone - unstable ground from a lost breach - fades in '+activityTimeLeft(scar.expiresAt);
    target=scar;danger=true;
  }
  else if(encounter&&encounter.type==='wounded_hunter'){title='Wounded Hunter';text='Reach the hunter and provide aid before nightfall.';target=encounter;}
  else if(encounter&&encounter.type==='merchant_rescue'){title='Merchant Rescue';text='Defeat '+(encounter.remaining|0)+' attackers before the merchant falls.';target=encounter;danger=true;}
  else if(encounter&&encounter.type==='pursuit'){title='Stolen Supply Pursuit';text='Catch '+(encounter.remaining|0)+' fleeing bandits before they escape.';target=encounter;danger=true;}
  else if(c&&c.state==='ambushed'){title='Caravan Under Attack';text='Defend the wagon and its remaining guards.';target=c;danger=true;}
  else if(a.recoveryCamp){title='Stolen Supplies';text='Clear the marked bandit camp to recover the caravan cargo.';target=a.recoveryCamp;danger=true;}
  else if(c){title='Road Caravan';text='Escort the convoy · '+Math.round((c.progress||0)*100)+'% · wagon '+Math.max(0,Math.ceil(c.hp||0))+'/'+Math.max(1,Math.ceil(c.maxHp||1));target=c;}
  else if(camp&&camp.phase==='captain'){title='Bandit Captain';text='Defeat the leader to unlock the camp chest.';target=camp;danger=true;}
  else if(camp&&camp.phase==='guards'){title='Bandit Camp';text='Guards remaining: '+(camp.guards|0)+'. Clear them to draw out the captain.';target=camp;danger=true;}
  else if(trail){title='Trail Sense: '+(trail.label||'Fresh Tracks');text='Tracks stay readable for '+Math.max(1,Math.ceil((trail.expiresAt-Date.now())/1000))+'s.';target=trail;danger=trail.kind!=='recovery';}
  else if(patrol){title='Bandit Tracks';text='A roaming patrol is active nearby.';target=patrol;danger=true;}
  else if((a.discountUntil||0)>Date.now()){title='Merchant Favour';text='Road merchant discount active for '+Math.max(1,Math.ceil((a.discountUntil-Date.now())/60000))+' min.';}
  if(!title){
    const opportunity=nearbyRegionalOpportunity();
    if(opportunity){title=opportunity.title;text=opportunity.kind;target=opportunity.target;danger=opportunity.danger;}
    else {displayedRegionalOpportunity=null;activityTrackerEl.classList.add('hidden');return;}
  }
  let nav='';
  if(target){const d=Math.hypot(target.x-player.pos.x,target.z-player.pos.z);nav=d<35?'Nearby':d<90?'In the surrounding region':'Far away';if(utilityEquipped('compass')||target===trail||(target===patrol&&utilityEquipped('trail_sense')))nav=bearingLabelTo(target.x,target.z)+' · '+Math.round(d)+'m';}
  const mapOn=utilityEquipped('minimap')||utilityEquipped('world_map');if(target)nav+=(nav?' · ':'')+(mapOn?'shown on map':'equip Mini Map to plot');
  activityTrackerEl.classList.remove('hidden');activityTrackerEl.classList.toggle('danger',danger);
  let detail='';displayedRegionalOpportunity=null;
  if(target){
    const ring=dangerRingAtClient(target.x,target.z),rank=RANKS[Math.max(0,Math.min(4,ring))].n;
    const rc=clampRegionalContract(regionalContract),relevant=target===breach?'PUBLIC CLEANUP':target===scar?'BREACH AFTERMATH':target===trail?'TRAIL SENSE':rc&&(!rc.targetId||rc.targetId===target.id)?'ACTIVE CONTRACT':'ROAD WARDEN WORK';
    const tracked=!!(trackedRegionalOpportunity&&trackedRegionalOpportunity.x===target.x&&trackedRegionalOpportunity.z===target.z);
    displayedRegionalOpportunity={target,x:target.x,z:target.z,title,kind:relevant,rank,tracked,danger};
    const reward=target===breach?' · XP + materials':'';
    const rewardDetail=target===breach?' - reduced XP + materials, no keys':target===scar?' - temporary danger scar':reward;
    detail='<div class="ar"><b>'+escHTML(rank)+'-RANK AREA</b><span>'+escHTML(relevant+rewardDetail)+'</span><kbd>P</kbd> '+(tracked?'UNTRACK':'TRACK')+'</div>';
  }
  activityTrackerEl.innerHTML='<div class="at">'+escHTML(title)+'</div><div class="av">'+escHTML(text)+'</div>'+(nav?'<div class="am">'+escHTML(nav)+'</div>':'')+detail;
}
function nearbyQuestClaimPrompt(){
  if(!locked||uiOpen||statOpen||qOpen||claimMode||onboardingActive||dim!=='overworld')return null;
  if(quest&&questDone&&questDone()){
    const qTitle=quest.title||questTypeLabel(quest)||'Quest';
    const target=quest.source==='guardian'?HUB.guardian:quest.giver==='Mara Vale'?HUB.guide:null;
    if(target&&Math.hypot(player.pos.x-target.x,player.pos.z-target.z)<5.2){
      return {title:'Turn In '+qTitle,small:'Quest complete - claim reward'};
    }
  }
  if(jobContract&&jobContractReady&&jobContractReady()&&Math.hypot(player.pos.x-HUB.jobs.x,player.pos.z-HUB.jobs.z)<4.6){
    return {title:'Claim Job Reward',small:String(jobContract.title||'Contract complete')};
  }
  const rc=clampRegionalContract(regionalContract);
  if(rc&&rc.ready){
    const nearBoard=Math.hypot(player.pos.x-HUB.jobs.x,player.pos.z-HUB.jobs.z)<4.6;
    const nearGuild=Math.hypot(player.pos.x-HUB.guild.x,player.pos.z-HUB.guild.z)<8.5;
    if(nearBoard||nearGuild)return {title:'Claim Guild Contract',small:String(rc.title||'Contract complete')};
  }
  const claimable=activeObjectiveList().find(o=>o&&(o.status==='claimable'||o.status==='complete'));
  if(claimable){
    const source=claimable.source||'',action=claimable.action&&claimable.action.type||'';
    if((source==='job'||action==='jobs')&&Math.hypot(player.pos.x-HUB.jobs.x,player.pos.z-HUB.jobs.z)<4.6)return {title:'Claim Job Reward',small:String(claimable.title||'Ready to claim')};
    if((source==='guild'||action==='guild_contracts')&&(Math.hypot(player.pos.x-HUB.jobs.x,player.pos.z-HUB.jobs.z)<4.6||Math.hypot(player.pos.x-HUB.guild.x,player.pos.z-HUB.guild.z)<8.5))return {title:'Claim Guild Contract',small:String(claimable.title||'Ready to claim')};
    if((source==='aegis'||action==='claim_aegis')&&Math.hypot(player.pos.x-HUB.guardian.x,player.pos.z-HUB.guardian.z)<9)return {title:'Claim Aegis Trial',small:String(claimable.title||'Ready to claim')};
  }
  return null;
}
function updateEncounterPrompt(){
  if(!encounterPromptEl)return;
  const claimPrompt=nearbyQuestClaimPrompt();
  if(claimPrompt){
    encounterPromptEl.classList.remove('danger','hidden');
    encounterPromptEl.innerHTML='<span class="key">G</span><b>'+escHTML(claimPrompt.title)+'</b><small>'+escHTML(claimPrompt.small)+'</small>';
    return;
  }
  const interactionPrompt=combatApi.nearbyInteractionPrompt&&combatApi.nearbyInteractionPrompt();
  if(interactionPrompt){
    encounterPromptEl.classList.toggle('danger',!!interactionPrompt.danger);
    encounterPromptEl.classList.remove('hidden');
    encounterPromptEl.innerHTML='<span class="key">'+escHTML(interactionPrompt.key||'G')+'</span><b>'+escHTML(interactionPrompt.title||'Interact')+'</b><small>'+escHTML(interactionPrompt.small||'Press G to interact')+'</small>';
    return;
  }
  const weeklyCache=locked&&!uiOpen&&!statOpen&&!qOpen&&!claimMode&&!onboardingActive&&combatApi.nearFellowshipWeeklyCache&&combatApi.nearFellowshipWeeklyCache();
  if(weeklyCache){
    encounterPromptEl.classList.remove('danger','hidden');
    encounterPromptEl.innerHTML='<span class="key">G</span><b>Fellowship Weekly Cache</b><small>Press G to claim unlocked rewards</small>';
    return;
  }
  const noticeBoard=locked&&!uiOpen&&!statOpen&&!qOpen&&!claimMode&&!onboardingActive&&combatApi.nearFellowshipNoticeBoard&&combatApi.nearFellowshipNoticeBoard();
  if(noticeBoard){
    encounterPromptEl.classList.remove('danger','hidden');
    encounterPromptEl.innerHTML='<span class="key">G</span><b>Fellowship Notice Board</b><small>Press G to view pinned objectives</small>';
    return;
  }
  const recallLectern=locked&&!uiOpen&&!statOpen&&!qOpen&&!claimMode&&!onboardingActive&&combatApi.nearRecallLectern&&combatApi.nearRecallLectern();
    if(recallLectern){
      encounterPromptEl.classList.remove('danger','hidden');
      encounterPromptEl.innerHTML='<span class="key">G</span><b>Fellowship Study Lectern</b><small>Press G for Recall mastery and practice</small>';
      return;
    }
    const fellowshipMapTable=locked&&!uiOpen&&!statOpen&&!qOpen&&!claimMode&&!onboardingActive&&combatApi.nearFellowshipMapTable&&combatApi.nearFellowshipMapTable();
    if(fellowshipMapTable){
      encounterPromptEl.classList.remove('danger','hidden');
      encounterPromptEl.innerHTML='<span class="key">G</span><b>Fellowship Map Table</b><small>Press G to plan leads, treasure and discoveries</small>';
      return;
    }
    const fellowshipArmory=locked&&!uiOpen&&!statOpen&&!qOpen&&!claimMode&&!onboardingActive&&combatApi.nearFellowshipArmoryRack&&combatApi.nearFellowshipArmoryRack();
    if(fellowshipArmory){
      encounterPromptEl.classList.remove('danger','hidden');
      encounterPromptEl.innerHTML='<span class="key">G</span><b>Fellowship Armory Rack</b><small>Press G for Gate readiness, repairs and loadout checks</small>';
      return;
    }
    const fellowshipPantry=locked&&!uiOpen&&!statOpen&&!qOpen&&!claimMode&&!onboardingActive&&combatApi.nearFellowshipPantryShelf&&combatApi.nearFellowshipPantryShelf();
    if(fellowshipPantry){
      encounterPromptEl.classList.remove('danger','hidden');
      encounterPromptEl.innerHTML='<span class="key">G</span><b>Fellowship Pantry Shelf</b><small>Press G for hunger, rations and Cook prep</small>';
      return;
    }
    const fellowshipWeather=locked&&!uiOpen&&!statOpen&&!qOpen&&!claimMode&&!onboardingActive&&combatApi.nearFellowshipWeatherVane&&combatApi.nearFellowshipWeatherVane();
    if(fellowshipWeather){
      encounterPromptEl.classList.remove('danger','hidden');
      encounterPromptEl.innerHTML='<span class="key">G</span><b>Fellowship Weather Vane</b><small>Press G for active weather sites and sky planning</small>';
      return;
    }
  const table=locked&&!uiOpen&&!statOpen&&!qOpen&&!claimMode&&!onboardingActive?combatApi.nearbyTavernGameTable():null;
  if(table){
    encounterPromptEl.classList.remove('danger','hidden');
    encounterPromptEl.innerHTML='<span class="key">G</span><b>'+escHTML(table.label)+'</b><small>Press G to interact</small>';
    return;
  }
  const ancient=locked&&!uiOpen&&!statOpen&&!qOpen&&!claimMode&&!onboardingActive&&combatApi.nearbyAncientCityInteractable&&combatApi.nearbyAncientCityInteractable(6.5);
  if(ancient){
    const prompt=ancient.type==='ancient_vault'
      ? ['Ancient Vault','Press G to open the sealed cache']
      : ancient.type==='ancient_core'
        ? ['Ancient Core','Press G to inspect the Warden seal']
        : ['Lore Tablet','Press G to read and trigger Recall'];
    encounterPromptEl.classList.remove('danger','hidden');
    encounterPromptEl.innerHTML='<span class="key">G</span><b>'+escHTML(prompt[0])+'</b><small>'+escHTML(prompt[1])+'</small>';
    return;
  }
  const dragon=locked&&!uiOpen&&!statOpen&&!qOpen&&!claimMode&&!onboardingActive&&globalThis.BlockcraftDragonWorld&&typeof globalThis.BlockcraftDragonWorld.nearestOwned==='function'
    ? globalThis.BlockcraftDragonWorld.nearestOwned(3.4)
    : null;
  if(dragon){
    encounterPromptEl.classList.remove('danger','hidden');
    encounterPromptEl.innerHTML='<span class="key">G</span><b>'+escHTML(dragon.name||'Dragon')+'</b><small>'+escHTML((dragon.stage||'adult').toUpperCase()+' - '+(dragon.role||'follow').toUpperCase())+'</small>';
    return;
  }
  if(dim!=='overworld'||!overworldActivity){encounterPromptEl.classList.add('hidden');encounterPromptEl.innerHTML='';return;}
  const breach=overworldActivity.gateBreach;
  if(breach){
    const distance=Math.hypot(breach.x-player.pos.x,breach.z-player.pos.z);
    if(distance<=34){
      encounterPromptEl.classList.add('danger');encounterPromptEl.classList.remove('hidden');
      encounterPromptEl.textContent='Gate Breach · contain '+(breach.bossName||'the escaped boss')+' · cleanup reward';
      encounterPromptEl.textContent='Gate Breach - contain '+(breach.bossName||'the escaped boss')+' - reduced cleanup bounty';
      return;
    }
  }
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
  if(onboardingActive&&dim==='tutorial'){
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
      refreshObjectiveTracker();
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
    if(t) rows.push('<div class="statuschip utility"><i class="ico">C</i><span>'+escHTML(t.label)+'</span><b>'+escHTML(utilityTargetHudLine(t))+'</b></div>');
  }
  if(utilityEquipped('party_compass')){
    const t=partyCompassTarget();
    if(t) rows.push('<div class="statuschip utility'+utilityPriorityClass(t.priority)+'"><i class="ico">P</i><span>'+escHTML(t.label)+'</span><b>'+escHTML(utilityTargetHudLine(t))+'</b></div>');
  }
  if(dim==='overworld'&&dungeonLobbyState&&dungeonLobbyState.rally){
    const rally=dungeonLobbyState.rally,distance=Math.round(Math.hypot(rally.x-player.pos.x,rally.z-player.pos.z));
    rows.push('<div class="statuschip utility"><i class="ico">G</i><span>Gate Rally</span><b>'+escHTML(bearingLabelTo(rally.x,rally.z)+' · '+distance+'m')+'</b></div>');
  }
  if(utilityEquipped('feather_step')) rows.push('<div class="statuschip utility"><i class="ico">F</i><span>Feather</span><b>Landing guard</b></div>');
  coordsEl.innerHTML=rows.join('');
  const obj=currentObjectiveHud();
  if(currentQuestEl){
    if(obj){
      currentQuestEl.classList.remove('hidden');
      currentQuestEl.innerHTML=objectiveHudHTML(obj);
    } else {
      currentQuestEl.classList.add('hidden');
      currentQuestEl.innerHTML='';
    }
  }
}
let last=performance.now();
const perfDiagnostics=createPerformanceDiagnostics({renderer:rendering.renderer,getCounts:()=>({remotes:Object.keys(NET.remotes||{}).length,scene:scene.children.length,...worldApi.particleBudgetStats()})});
function tick(now){
  requestAnimationFrame(tick);
  const dt=Math.max(0,Math.min((now-last)/1000,.05)); last=now;
  worldApi.resetParticleBudget();
  perfDiagnostics.beginFrame(now);
  biomeStatus.tick(now);
  globalThis.BlockcraftRecall.tick(now);
  if(globalThis.BlockcraftDeathDrops)globalThis.BlockcraftDeathDrops.tick(now);
  if(biomeStatus.active('frost',now)&&Math.random()<dt*14)spawnParticle({x:player.pos.x+(Math.random()-.5)*1.5,y:player.pos.y+.15+Math.random()*1.8,z:player.pos.z+(Math.random()-.5)*1.5,vx:(Math.random()-.5)*.18,vy:.12,vz:(Math.random()-.5)*.18,life:.7,grav:0,r:.56,g:.92,b:1});
  if(biomeStatus.active('venom',now)&&Math.random()<dt*9)spawnParticle({x:player.pos.x+(Math.random()-.5)*1.1,y:player.pos.y+.1+Math.random()*1.4,z:player.pos.z+(Math.random()-.5)*1.1,vx:0,vy:.28,vz:0,life:.6,grav:0,r:.51,g:.66,b:.29});
  tickFurnaces(dt);
  tickOnboarding(now);
  tickAbilityTraining(now);
  tickJobTutorial(now);
  tickTownGuidance(now);
  tickLandBoundaryToast(now);
  if(!cutscene && combatApi.shouldOpenLevel2JobChoice && combatApi.shouldOpenLevel2JobChoice()){
    combatApi.openLevel2JobChoice();
  }else if(shouldOpenLevel2PathChoice()) showPathSelection();
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
    combatApi.updateBuildPreview(false);
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
    const deityActive=globalThis.BlockcraftDeityState&&globalThis.BlockcraftDeityState.active;
    const deityFlying=!mounted&&deityActive&&deityActive.flight===true;
    const flying = deityFlying || (mounted && isDragon(mountKind));
    const outOfFood=!mounted && hunger<=0;
    const sprint=sprintKey && (f!==0||s!==0) && sp>1 && !mounted && !outOfFood;
    if(onboardingActive&&onboardingArrived&&onboardingKind()==='sprint'&&sprint){
      onboardingFlags.sprint=true;
      updateOnboardingHud();
    }
    sprintingNow=sprint;
    if(globalThis.COMBAT_FEEDBACK)globalThis.COMBAT_FEEDBACK.updateMovement(camera,sprint,f!==0||s!==0,dt);
    const armorMovement=!mounted&&equippedArmor()?armorProfileFor(equippedArmor()):null;
    const armorStamina=armorMovement?armorMovement.staminaCostMultiplier:1;
    if(sprint) sp=Math.max(0,sp-stCost(3.5)*armorStamina*dt);
    const dragFly=flying?(deityFlying?12:((DRAGON_TYPES[dragonType(mountKind)]||{}).fly||13)):0;
    const baseSpd=flying?dragFly:(mounted?9.6:(sprint?6.2:4.3));
    const speed=baseSpd*(outOfFood?0.62:1)*(1+0.015*(S.agi-1))*(buffs.spd>0?1.25:1)*(armorMovement?armorMovement.moveMultiplier:1);
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
      // Divine/dragon flight: no gravity. Space climbs, Shift descends, otherwise hover.
      const climb=(keys['Space']?1:0)-((keys['ShiftLeft']||keys['ShiftRight'])?1:0);
      if(climb!==0) player.vel.y=climb*9;
      else player.vel.y += (0-player.vel.y)*Math.min(1,dt*8);
      if(deityFlying&&Math.random()<dt*22){
        spawnParticle({x:player.pos.x+(Math.random()-.5)*.9,y:player.pos.y+.05+Math.random()*.55,z:player.pos.z+(Math.random()-.5)*.9,
          vx:(Math.random()-.5)*.35,vy:-.25-Math.random()*.45,vz:(Math.random()-.5)*.35,life:.55,grav:-.05,r:1,g:.82,b:.34});
      }
    } else {
    let grav = waistWater?9 : feetWater?14 : 26;
    if(!feetWater && player.vel.y>0 && !keys['Space']) grav*=1.7;   // tap = short hop, hold = full arc
    player.vel.y -= grav*dt;
    if(waistWater) player.vel.y=Math.max(player.vel.y,-2.2);
    else if(feetWater) player.vel.y=Math.max(player.vel.y,-3.5);
    const wantJump = keys['Space'] || (now-jumpPressT<130);         // buffered taps
    if(wantJump){
      const canJump = player.onGround || (!feetWater && now-lastGroundT<120);  // coyote time
      if(canJump){
        player.vel.y=mounted?9.4:8.2; player.onGround=false;
        lastGroundT=-1e9; jumpPressT=-1e9;
        if(!mounted && sp>0) sp=Math.max(0,sp-stCost(5)*armorStamina);
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
      if(feather && prevVy<-15) showName('Feather Step ready');
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
    if(networkingApi.tickCompanionDragons) networkingApi.tickCompanionDragons(now, dt);
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
    combatApi.updateBuildPreview(!cutscene);

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
      if(mouseL && hit && BREAK[hit.id] && dim==='overworld' && !canBreakHere(hit.x,hit.z,hit.y,hit.id)){
        if(firstHandsQuestActive() && hit.id===B.LOG && isTownLand(hit.x,hit.z) && now>=nextFirstHandsProtectedHintAt){
          nextFirstHandsProtectedHintAt=now+4500;
          sysMsg('Mara: town trees are protected. Follow the north gate trail and gather logs <b>outside the wall</b>.','minor');
        } else if(now>=nextLandProtectedHintAt){
          nextLandProtectedHintAt=now+3500;
          showLandEditDenied(hit.x,hit.z,'break',hit.y,hit.id);
        }
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
  } else { crack.visible=false; combatApi.updateBuildPreview(false); }
  updateGatePrompt();
  updateGateRally(now);
  updateDungeonCoordination(now);
  updateUtilityWorldFeedback(now,dt);

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
      const tavernFire=tavernNightLevel()>.05 ? Math.hypot(player.pos.x-HUB.tavernHearth.x, player.pos.z-HUB.tavernHearth.z) : Infinity;
      fd=Math.min(
        tavernFire,                                                // tavern hearth
        Math.hypot(player.pos.x-HUB.forgeFire.x, player.pos.z-HUB.forgeFire.z)); // smithy forge
    }
    for(const key in torches){
      const tp=torches[key].position;
      const d2=Math.hypot(player.pos.x-tp.x, player.pos.z-tp.z);
      if(d2<fd) fd=d2;
    }
    const inTown=dim==='overworld' && isTownLand(Math.floor(player.pos.x),Math.floor(player.pos.z));
    const inMenu=overlay && !overlay.classList.contains('hidden');
    SFX.tick(dt, fd, 1-gDayF, dim==='overworld', inTown, isInsideTavern(), inMenu, !!cutscene, worldApi.inOverworldBattle());
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
  if(worldApi.tickLandClaimOverlay) worldApi.tickLandClaimOverlay();
  updateLandMinimap();
  updateBossUI();
  perfDiagnostics.beginRender(performance.now());
  rendering.render();
  perfDiagnostics.endRender(performance.now());
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
    if(kind==='sprint')onboardingFlags.sprint=true;
    else if(kind==='arrows')onboardingFlags.arrowLook=true;
    else if(kind==='jump')onboardingFlags.jumped=true;
    else if(kind==='cursor')onboardingFlags.cursor=true;
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
    else if(kind==='combat')onboardingFlags.dummy=3;
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
      if(g&&g.active)found.push({id:g.id,dungeonId:g.dungeonId||'',rank:g.rank|0,x:+g.x,y:+g.y,z:+g.z,kind:g.kind||'public',shardPlus:g.shardPlus|0,shardName:g.shardName||'',shardMods:(g.shardMods||'').split(',').filter(Boolean)});
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
    const steps=Math.max(1,Math.ceil(Math.hypot(tx-sx,tz-sz)/4));
    for(let step=1;step<=steps;step++){
      if(!NET.on||!NET.room) return false;
      const t=step/steps;
      const x=sx+(tx-sx)*t,z=sz+(tz-sz)*t;
      const y=dim==='overworld'?surfaceY(x,z)+1.01:sy+(ty-sy)*t;
      player.pos.set(x,y,z);
      NET.room.send('move',{x:player.pos.x,y:player.pos.y,z:player.pos.z,yaw:player.yaw});
      await new Promise(resolve=>setTimeout(resolve,16));
    }
    if(arrivalRadius==null) return true;
    // Range checks use the server position, so finish only after an ordered
    // test-only acknowledgement confirms the authoritative player arrived.
    const requestId='walk-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
    for(let settle=0;settle<100;settle++){
      if(!NET.on||!NET.room) return false;
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
      if(ack&&ack.requestId===requestId&&ack.ok&&ack.id===id){player.pos.set(target.x+1.5,target.y+.5,target.z);gate=netGates[id]||target;return id;}
    }
    return false;
  };
  const e2ePositionOutsideTown=async()=>{
    if(!NET.on||!NET.room) return false;
    const requestId='outside-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
    NET.room.send('e2eJourney',{action:'positionOutsideTown',requestId});
    for(let settle=0;settle<50;settle++){
      await new Promise(resolve=>setTimeout(resolve,100));
      const ack=networkingState.journeyResult;
      if(ack&&ack.requestId===requestId&&ack.ok){player.pos.set(ack.x,ack.y,ack.z);return true;}
    }
    return false;
  };
  const e2ePositionAtMara=async()=>{
    if(!NET.on||!NET.room) return false;
    const requestId='mara-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
    NET.room.send('e2eJourney',{action:'positionAtMara',requestId});
    for(let settle=0;settle<50;settle++){
      await new Promise(resolve=>setTimeout(resolve,100));
      const ack=networkingState.journeyResult;
      if(ack&&ack.requestId===requestId&&ack.ok){player.pos.set(ack.x,ack.y,ack.z);return true;}
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
    status:()=>{const self=NET.room&&NET.room.state&&NET.room.state.players&&NET.room.sessionId&&NET.room.state.players.get(NET.room.sessionId);let bossState='';const dungeonMobs=[];if(NET.room&&NET.room.state&&NET.room.state.mobs)NET.room.state.mobs.forEach((m,id)=>{if(m.dgn===NET.dgn){dungeonMobs.push({id:String(id),kind:m.kind||'',variant:m.variant||'',bossStyle:m.bossStyle||'',displayName:m.displayName||'',elite:!!m.elite,state:m.state||''});if(m.kind==='boss')bossState=m.state||'';}});return {connected:NET.on&&NET.profileReady===true,reconnecting:NET.reconnecting,attachCount:NET.attachCount,sessionId:NET.room&&NET.room.sessionId||'',team:self&&self.team||'',job:playerJob,jobXp,contract:jobContract?JSON.parse(JSON.stringify(jobContract)):null,jobContractOffers:Array.isArray(jobContractOffers)?jobContractOffers.map(c=>JSON.parse(JSON.stringify(c))):[],jobContractOffersJob,jobContractRefreshAt,lastProgressionReject:String(globalThis.__BLOCKCRAFT_LAST_PROGRESSION_REJECT__||''),progressionFocus,activeObjectives:Array.isArray(activeObjectives)?JSON.parse(JSON.stringify(activeObjectives)):[],firstPromotionSeen:ONBOARD.isSeen(),currentObjective:currentObjective(),currentObjectiveHud:currentObjectiveHud(),objectiveText:currentQuestEl&&currentQuestEl.textContent||'',objectiveAction:e2eCurrentObjectiveAction(),transitionPanels:transitionPanelState(),menu:{open:menusState.open,mode:menusState.mode,modalOpen:menusState.modalOpen,craftResult:menusState.craftResult?JSON.parse(JSON.stringify(menusState.craftResult)):null},landClaimOverlay:!!worldState.landClaimOverlay,dRankPrep:progressionFocus==='first_d_gate'?ONBOARD.dRankPrepStatus():null,rankProgress:currentRankProgress(),utilityUnlocks:[...utilityUnlocks],utilityLoadout:{active:utilityLoadout.active,passive:[...utilityLoadout.passive]},compassTarget:utilityCompassTarget(),partyCompassTarget:partyCompassTarget(),armor:armorSlot&&armorSlot.id,level:S.lvl,xp:S.xp,points:S.pts,path:S.path||'',gold,onboarding:onboardingActive,onboardingStep,onboardingTotal:ONBOARDING_STEPS.length,onboardingKind:onboardingKind(),tutorials:{...serverTutorials},townTutorials:{job:townTutorialStepDone('job'),tavern:townTutorialStepDone('tavern'),land:townTutorialStepDone('land'),all:townTutorialsDone()},quest:quest?JSON.parse(JSON.stringify(quest)):null,maraStep:Number((npcQuestChains&&npcQuestChains['Mara Vale'])||0),abilityTraining:abilityTrainingActive,abilityTrainingUsed:combatState.abilityTrainingUsed,abilityTutorialDone:abilityTutorialDone(),dimension:dim,inTown:dim==='overworld'&&isTownLand(Math.floor(player.pos.x),Math.floor(player.pos.z)),dungeonId:NET.dgn||'',dungeonContentId:dungeon&&dungeon.dungeonId||'',dungeonSeed:dungeon?(dungeon.seed>>>0):null,dungeonCleared:!!(dungeon&&dungeon.cleared),dungeonStatus:dungeon&&dungeon.status?JSON.parse(JSON.stringify(dungeon.status)):null,dungeonBossCount:e2eDungeonBossCount(),dungeonBossState:bossState,dungeonMobs,dungeonRestartRecovery:networkingState.restartRecovery?JSON.parse(JSON.stringify(networkingState.restartRecovery)):null,e2eJourneyResult:networkingState.journeyResult?JSON.parse(JSON.stringify(networkingState.journeyResult)):null,lobby:dungeonLobbyState?JSON.parse(JSON.stringify(dungeonLobbyState)):null,highestGateRankCleared,gateRanks:e2eGateRanks(),gates:e2eGates(),firstGate:e2eFirstGate(),roomName:NET.roomName||''};},
    inventoryCount:id=>inventoryModel.count(id),
    inventorySlot:id=>inventoryModel.slots.findIndex(stack=>stack&&stack.id===id),
    clearInventoryItems:ids=>{const clear=new Set((Array.isArray(ids)?ids:[]).map(id=>id|0));for(let i=0;i<inv.length;i++)if(inv[i]&&clear.has(inv[i].id|0))inv[i]=null;refreshHUD();return true;},
    isDungeonSpirit:()=>{const p=NET.room&&NET.room.state&&NET.room.state.players&&NET.room.state.players.get(NET.room.sessionId);return !!(p&&p.spirit);},
    hasLocalSpiritVisual:()=>!!globalThis.BlockcraftLocalSpiritFxActive,
    selfPosition:()=>{const p=NET.room&&NET.room.state&&NET.room.state.players&&NET.room.state.players.get(NET.room.sessionId);return p?{x:p.x,y:p.y,z:p.z}:player&&player.pos?{x:player.pos.x,y:player.pos.y,z:player.pos.z}:null;},
    trackedGate:()=>gate?{id:gate.id||'',rank:gate.rank|0,kind:gate.kind||'public'}:null,
    send:(type,message={})=>{if(!NET.on||!NET.room)throw new Error('not connected');NET.room.send(type,message);},
    disconnect:()=>{if(!NET.room||!NET.room.connection)throw new Error('no active connection');NET.room.connection.close();},
    pauseReconnect:()=>NETWORK.pauseReconnect(),
    shutdown:()=>NETWORK.shutdown(),
    finishOnboarding:()=>completeOnboarding(),
    completeOnboardingStep:e2eCompleteOnboardingStep,
    completeTownTutorialStep:step=>completeTownTutorialStep(step),
    useFirstAbility:()=>cast(0),
    walkOutsideTown:e2ePositionOutsideTown,
    walkToFirstGate:e2eWalkToFirstGate,
    walkToGate:e2eWalkToGate,
    walkToMara:e2ePositionAtMara,
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
