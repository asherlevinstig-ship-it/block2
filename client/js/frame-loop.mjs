import {api as worldApi,state as worldState} from './world.mjs';
import {api as dimensionsApi,state as dimensionsState} from './dimensions.mjs';
import {api as combatApi,state as combatState} from './combat.mjs';
import {api as hudApi,state as hudState} from './hud.mjs';
import {api as menusApi,state as menusState} from './menus.mjs';
import {api as networkingApi,state as networkingState} from './networking.mjs';
import {createPerformanceDiagnostics} from './performance-budget.mjs';
import {biomeStatus} from './biome-status.mjs';
const gameContext=window.BlockcraftGameContext;
const QUEST_OBJECTIVES=globalThis.BlockcraftQuestObjectives;
const JOBS_ENABLED=!!(globalThis.BlockcraftJobSystem&&globalThis.BlockcraftJobSystem.ENABLED);
const player=combatState.player,inv=combatState.inventory;
const getB=worldApi.getBlock,setB=worldApi.setBlock;
const refreshHUD=hudApi.refresh;
const setRecallRechargeNudge=hudApi.setRecallRechargeNudge||(()=>{});
const NET=networkingState.connection,NETWORK=networkingState.controller,ONBOARD=networkingState.onboarding;
const netTick=networkingApi.tick;
/* Blockcraft frame-loop ES module. Runtime scheduling, simulation pumping, rendering, and diagnostics. */
// ---------------- main loop ----------------
const coordsEl=document.getElementById('coords');
const currentQuestEl=document.getElementById('currentquest');
const homeworkHudEl=document.createElement('div');
homeworkHudEl.id='homeworkhud';
homeworkHudEl.className='hidden';
homeworkHudEl.setAttribute('aria-live','polite');
document.body.appendChild(homeworkHudEl);
const locationEl=document.getElementById('locationhud');
const activityTrackerEl=document.getElementById('activitytracker');
const zoneNameEl=document.getElementById('zonename');
const zoneMetaEl=document.getElementById('zonemeta');
const gatePromptEl=document.getElementById('gateprompt');
const encounterPromptEl=document.getElementById('encounterprompt');
const dungeonPartyEl=document.getElementById('dungeonparty');
const dungeonPingEl=document.getElementById('dungeonping');
const HUD_UPDATE_INTERVAL_MS=125;
let nextInfoHudAt=0,nextDungeonHudAt=0;
let lastCoordsHudHTML='',lastCoordsHudHidden=false,lastDungeonPartyHTML='',lastDungeonPartyHidden=false;
let lastObjectiveHudHTML='',lastObjectiveHudHidden=false;
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
const pantherOverlay=document.createElement('div');
pantherOverlay.id='pantherformfx';
pantherOverlay.setAttribute('aria-hidden','true');
pantherOverlay.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:42;opacity:0;background:radial-gradient(circle at 50% 55%,rgba(134,239,172,.2),rgba(20,83,45,.12) 32%,rgba(2,6,23,0) 67%),linear-gradient(90deg,rgba(5,46,22,.34),rgba(0,0,0,0) 18%,rgba(0,0,0,0) 82%,rgba(5,46,22,.34));mix-blend-mode:screen;transition:opacity .12s ease';
document.body.appendChild(pantherOverlay);
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
const PANTHER_FORM={eye:0.68,height:0.96,width:0.24,speed:8.15,strafe:1.14,accel:46,brake:42,airAccel:12,jump:9.35,pounce:1.8,landingDip:.075,shiftMs:900};
let pantherLocalUntil=0,pantherShiftStart=-1e9,pantherShiftMs=PANTHER_FORM.shiftMs,pantherProwlT=0;
const MOVEMENT_FEEL={walk:4.3,sprint:6.2,sprintRampUp:.25,sprintRampDown:.18,exhaustedWalk:.8,recoverSprintAt:.12,groundAccel:22,groundSprintAccel:28,groundBrake:34,airAccel:6.5,airBrake:2.8,waterAccel:10};
const FALL_DAMAGE={safeDrop:5,featherAbsorbDrop:16,hardScale:1.25,featherScale:.5,maxDamage:18};
let sprintRamp=0,staminaExhausted=false,locomotionBobT=0,locomotionBob=0,locomotionRoll=0,locomotionPitch=0,landingDip=0,lastPlanarSpeed=0,localFallPeakY=0,localFallAirborne=false;
let lastTabletSprintDrainTraceAt=0;
const movementState={grounded:false,airborne:true,swimming:false,sprinting:false,exhausted:false,panther:false,state:'airborne',speed:0,targetSpeed:0,sprintFactor:0};
function pantherFormActive(now=performance.now()){
  return pantherLocalUntil>now || !!(buffs&&buffs.panther>0);
}
function setLocalPantherForm(durationMs=14000){
  const now=performance.now(),dur=Math.max(1000,Number(durationMs)||14000);
  const nextUntil=now+dur;
  const duplicate=pantherLocalUntil>now&&Math.abs(pantherLocalUntil-nextUntil)<650&&now-pantherShiftStart<650;
  pantherLocalUntil=Math.max(pantherLocalUntil,nextUntil);
  if(buffs)buffs.panther=Math.max(Number(buffs.panther)||0,dur/1000);
  if(duplicate)return;
  pantherShiftStart=now;
  pantherShiftMs=Math.min(1400,Math.max(450,dur*.16));
  camShake=Math.max(camShake,.34);
  showName('Panther Form');
  ringPulse(player.pos.x,player.pos.y+.08,player.pos.z,1.25,0x22c55e,.45);
  ringPulse(player.pos.x,player.pos.y+.1,player.pos.z,2.3,0x052e16,.62);
  glowFlash(player.pos.x,player.pos.y+.85,player.pos.z,0x22c55e,4.5,.38);
  burst(player.pos.x,player.pos.y+.7,player.pos.z,[.08,.92,.35],42,3.6,2.4,.7);
  if(SFX&&SFX.growl)SFX.growl();else if(SFX&&SFX.cast)SFX.cast();
}
globalThis.BlockcraftPantherFormFx=setLocalPantherForm;
function tickLocalPantherForm(now,dt,moving){
  const active=pantherFormActive(now);
  const targetEye=active?PANTHER_FORM.eye:1.62,targetHeight=active?PANTHER_FORM.height:1.8,targetWidth=active?PANTHER_FORM.width:.3;
  const ease=Math.min(1,dt*(active?8:5));
  player.eye+=(targetEye-player.eye)*ease;
  player.h+=(targetHeight-player.h)*ease;
  player.w+=(targetWidth-player.w)*ease;
  if(buffs&&buffs.panther>0)buffs.panther=Math.max(0,buffs.panther-dt);
  const shiftT=Math.max(0,Math.min(1,(now-pantherShiftStart)/Math.max(1,pantherShiftMs)));
  const shiftGlow=shiftT<1?Math.sin(shiftT*Math.PI):0;
  const ending=active&&pantherLocalUntil-now<1200?Math.max(0,(pantherLocalUntil-now)/1200):1;
  pantherOverlay.style.opacity=String(Math.max(0,Math.min(.72,shiftGlow*.72+(active?0.16*ending:0))));
  if(!active)return {active:false,shiftGlow:0,bob:0,tilt:0};
  pantherProwlT+=dt*(moving?10.8:2.1);
  const bob=(moving?Math.sin(pantherProwlT)*.045:Math.sin(pantherProwlT*.7)*.012);
  const tilt=moving?Math.sin(pantherProwlT*.5)*.025:0;
  if(Math.random()<dt*(shiftGlow?42:(moving?16:5))){
    const side=(Math.random()-.5)*1.25,forward=.25+Math.random()*.8;
    const sx=Math.sin(player.yaw),cz=Math.cos(player.yaw),px=player.pos.x-sx*forward+cz*side,pz=player.pos.z-cz*forward-sx*side;
    spawnParticle({x:px,y:player.pos.y+.12+Math.random()*.45,z:pz,vx:(Math.random()-.5)*.35,vy:.18+Math.random()*.48,vz:(Math.random()-.5)*.35,life:.45+Math.random()*.35,grav:-.04,r:.17,g:.92,b:.38,priority:2});
  }
  return {active:true,shiftGlow,bob,tilt};
}
function approach(current,target,rate,dt){
  return current+(target-current)*(1-Math.exp(-Math.max(0,rate)*Math.max(0,dt)));
}
function approachAngle(current,target,rate,dt){
  const delta=Math.atan2(Math.sin(target-current),Math.cos(target-current));
  return current+delta*(1-Math.exp(-Math.max(0,rate)*Math.max(0,dt)));
}
let cameraYaw=player.yaw,cameraPitch=player.pitch;

const DIRECTOR_CAMERA_MODES=['first','third','orbit','side','topdown','freefly'];
const directorCamera={
  enabled:false,
  mode:'third',
  distance:7.5,
  height:2.6,
  side:3.6,
  orbitAngle:0,
  cleanHud:false,
  lastHudHTML:'',
  _pos:null,        // persistent smoothed camera position (fixes per-frame reset)
  freePos:null,     // free-fly camera position
  freeYaw:0,
  freePitch:0,
  freeSeeded:false
};
function directorCameraActive(){ return !!directorCamera.enabled; }
function directorFreeFlyActive(){ return !!(directorCamera.enabled&&directorCamera.mode==='freefly'); }
let directorHudEl=null,directorStyleEl=null;
function ensureDirectorCameraStyle(){
  if(directorStyleEl)return;
  directorStyleEl=document.createElement('style');
  directorStyleEl.textContent=
    '#directorhud{position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:120;min-width:360px;padding:10px 14px;border:1px solid rgba(255,210,74,.55);border-radius:10px;background:rgba(5,10,18,.72);box-shadow:0 16px 40px rgba(0,0,0,.42),0 0 20px rgba(255,210,74,.12);color:#fff7c8;font-family:inherit;text-align:center;text-shadow:0 2px 0 #000;pointer-events:none}'+
    '#directorhud.hidden{display:none}#directorhud b{display:block;color:#ffd24a;letter-spacing:2.5px;font-size:12px}#directorhud span{display:block;margin-top:4px;color:#dbeafe;font-size:11px;letter-spacing:.6px}'+
    'body.director-clean-hud #locationhud,body.director-clean-hud #coords,body.director-clean-hud #currentquest,body.director-clean-hud #homeworkhud,body.director-clean-hud #activitytracker,body.director-clean-hud #bugreportbtn,body.director-clean-hud #stuckrescuebtn,body.director-clean-hud #eventhud,body.director-clean-hud #keyprompthud,body.director-clean-hud #encounterprompt,body.director-clean-hud #gateprompt,body.director-clean-hud #stats,body.director-clean-hud #abilities,body.director-clean-hud #hotbar,body.director-clean-hud #utilitybar,body.director-clean-hud #statpointnudge,body.director-clean-hud #recallrechargenudge,body.director-clean-hud #sysmsgs,body.director-clean-hud #coachhud,body.director-clean-hud #tutorialhud,body.director-clean-hud #landmap{display:none!important}';
  document.head.appendChild(directorStyleEl);
}
function directorHud(){
  ensureDirectorCameraStyle();
  if(directorHudEl)return directorHudEl;
  directorHudEl=document.createElement('div');
  directorHudEl.id='directorhud';
  directorHudEl.className='hidden';
  document.body.appendChild(directorHudEl);
  return directorHudEl;
}
function directorModeLabel(){
  return String(directorCamera.mode||'first').toUpperCase()+' · '+directorCamera.distance.toFixed(1)+'m · height '+directorCamera.height.toFixed(1)+'m'+(directorCamera.cleanHud?' · CLEAN HUD':'');
}
function refreshDirectorCameraHud(){
  const el=directorHud();
  el.classList.toggle('hidden',!directorCamera.enabled);
  document.body.classList.toggle('director-camera-active',directorCamera.enabled);
  document.body.classList.toggle('director-clean-hud',directorCamera.enabled&&directorCamera.cleanHud);
  if(!directorCamera.enabled)return;
  const controls=directorCamera.mode==='freefly'
    ?'F6 mode · WASD fly · Arrows look · Space up · Shift down · F7 clean HUD · F10 off'
    :directorCamera.mode==='topdown'
    ?'F6 mode · [ ] altitude · - = height · F7 clean HUD · F10 off'
    :'F6 mode · [ ] distance · - = height · F7 clean HUD · F10 off';
  const html='<b>DIRECTOR CAMERA</b><span>'+controls+'<br>'+directorModeLabel()+'</span>';
  if(el.innerHTML!==html)el.innerHTML=html;
}
function directorCameraNotify(text){
  if(typeof showName==='function')showName(text);
  try{globalThis.BlockcraftTrace&&globalThis.BlockcraftTrace('director.camera',{text,status:directorCameraStatus()});}catch(e){}
}
function directorCameraStatus(){
  return {enabled:!!directorCamera.enabled,mode:directorCamera.mode,distance:+directorCamera.distance.toFixed(2),height:+directorCamera.height.toFixed(2),cleanHud:!!directorCamera.cleanHud};
}
function toggleDirectorCamera(){
  directorCamera.enabled=!directorCamera.enabled;
  if(directorCamera.enabled&&directorCamera.mode==='first')directorCamera.mode='third';
  if(directorCamera.enabled){
    directorCamera.orbitAngle=player.yaw+Math.PI;
    directorCamera._pos=null;       // reseed smoothed position on enable
    directorCamera.freeSeeded=false;
  }else{
    if(globalThis.BlockcraftSelfAvatar&&globalThis.BlockcraftSelfAvatar.setVisible)globalThis.BlockcraftSelfAvatar.setVisible(false);
  }
  refreshDirectorCameraHud();
  directorCameraNotify(directorCamera.enabled?'Director camera: '+directorCamera.mode.toUpperCase():'Director camera off');
  return directorCamera.enabled;
}
function setDirectorCameraMode(mode){
  if(DIRECTOR_CAMERA_MODES.includes(mode))directorCamera.mode=mode;
  if(directorCamera.mode==='freefly')directorCamera.freeSeeded=false; // reseed free camera from current view
  refreshDirectorCameraHud();
  directorCameraNotify('Director: '+directorCamera.mode.toUpperCase());
  return directorCamera.mode;
}
function cycleDirectorCameraMode(){
  const i=DIRECTOR_CAMERA_MODES.indexOf(directorCamera.mode);
  return setDirectorCameraMode(DIRECTOR_CAMERA_MODES[(i+1+DIRECTOR_CAMERA_MODES.length)%DIRECTOR_CAMERA_MODES.length]);
}
function adjustDirectorCameraDistance(delta){
  directorCamera.distance=Math.max(2.5,Math.min(18,directorCamera.distance+(Number(delta)||0)));
  refreshDirectorCameraHud();
  directorCameraNotify('Director distance '+directorCamera.distance.toFixed(1)+'m');
  return directorCamera.distance;
}
function adjustDirectorCameraHeight(delta){
  directorCamera.height=Math.max(.5,Math.min(8,directorCamera.height+(Number(delta)||0)));
  refreshDirectorCameraHud();
  directorCameraNotify('Director height '+directorCamera.height.toFixed(1)+'m');
  return directorCamera.height;
}
function toggleDirectorCleanHud(){
  directorCamera.cleanHud=!directorCamera.cleanHud;
  refreshDirectorCameraHud();
  directorCameraNotify(directorCamera.cleanHud?'Clean HUD on':'Clean HUD off');
  return directorCamera.cleanHud;
}
function updateDirectorSelfAvatar(show,moving,now,dt){
  const av=globalThis.BlockcraftSelfAvatar;
  if(!av||!av.ensure)return;
  if(!show){ if(av.setVisible)av.setVisible(false); return; }
  av.ensure();
  av.setVisible(true);
  const eye=(player&&player.eye)||1.6;
  av.update(player.pos.x,player.pos.y,player.pos.z,Number(player.yaw)||0,!!moving,now,dt,eye);
}
function applyDirectorCamera(now,dt){
  if(!directorCamera.enabled||directorCamera.mode==='first'||claimMode||cutscene){
    updateDirectorSelfAvatar(false);
    return false;
  }
  const focus=new THREE.Vector3(player.pos.x,player.pos.y+Math.max(.8,player.eye*.72),player.pos.z);
  const yaw=Number(player.yaw)||0;
  const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw));
  const behind=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));
  const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
  // Self-avatar so there's a character to film (first-person game has no local body).
  const moving=!!(player&&player.vel&&Math.hypot(player.vel.x||0,player.vel.z||0)>.6);
  updateDirectorSelfAvatar(true,moving,now,dt);
  if(directorCamera.mode==='freefly'){
    // Free-fly is driven from the tick input branch; just keep the avatar updated here.
    return true;
  }
  let pos;
  if(directorCamera.mode==='orbit'){
    directorCamera.orbitAngle+=dt*.34;
    pos=new THREE.Vector3(
      focus.x+Math.sin(directorCamera.orbitAngle)*directorCamera.distance,
      focus.y+directorCamera.height,
      focus.z+Math.cos(directorCamera.orbitAngle)*directorCamera.distance
    );
  }else if(directorCamera.mode==='side'){
    pos=focus.clone().addScaledVector(right,directorCamera.side).addScaledVector(behind,directorCamera.distance*.52);
    pos.y+=directorCamera.height*.82;
  }else if(directorCamera.mode==='topdown'){
    // Sky/bird's-eye: high above the player, looking down. [ ]/-= adjust altitude. A small `behind`
    // offset keeps the look-down orientation stable (player's forward reads toward screen-top).
    const alt=12+directorCamera.distance*2.2+directorCamera.height;
    pos=focus.clone().addScaledVector(behind,Math.max(.6,alt*.05));
    pos.y=focus.y+alt;
  }else{
    pos=focus.clone().addScaledVector(behind,directorCamera.distance).addScaledVector(forward,-.35);
    pos.y+=directorCamera.height;
  }
  // Persistent smoothed position: the normal camera path resets camera.position to the player eye
  // every frame, so we must keep our own accumulator and assign it (lerping camera.position directly
  // would restart from the player each frame and never reach the framing).
  if(!directorCamera._pos)directorCamera._pos=pos.clone();
  else directorCamera._pos.lerp(pos,1-Math.exp(-dt*8));
  camera.position.copy(directorCamera._pos);
  camera.lookAt(focus.x,focus.y+.35,focus.z);
  return true;
}
// Free-fly camera: flown directly from the tick input branch (player stays put).
function applyDirectorFreeFly(now,dt,move,mouse){
  if(!directorFreeFlyActive())return false;
  const d=directorCamera;
  if(!d.freeSeeded||!d.freePos){
    d.freePos=camera.position.clone();
    d.freeYaw=cameraYaw; d.freePitch=cameraPitch;
    d.freeSeeded=true;
  }
  const sens=0.0022,rotSpeed=1.8; // arrow-key rotation rad/sec (mouse still works too)
  d.freeYaw-= (mouse&&mouse.x||0)*sens;
  d.freeYaw+= (move&&move.rotY||0)*rotSpeed*dt;
  d.freePitch-= (mouse&&mouse.y||0)*sens;
  d.freePitch+= (move&&move.rotX||0)*rotSpeed*dt;
  d.freePitch=Math.max(-Math.PI/2+0.02,Math.min(Math.PI/2-0.02,d.freePitch));
  const yaw=d.freeYaw,pitch=d.freePitch;
  const fwd=new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
  const rgt=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
  const speed=9*dt;
  d.freePos.addScaledVector(fwd,(move&&move.f||0)*speed);
  d.freePos.addScaledVector(rgt,(move&&move.s||0)*speed);
  d.freePos.y+=(move&&move.up||0)*speed;
  camera.position.copy(d.freePos);
  camera.rotation.order='YXZ';
  camera.rotation.set(pitch,yaw,0);
  return true;
}
globalThis.BlockcraftDirectorCamera={
  toggle:toggleDirectorCamera,
  cycle:cycleDirectorCameraMode,
  setMode:setDirectorCameraMode,
  distance:adjustDirectorCameraDistance,
  height:adjustDirectorCameraHeight,
  cleanHud:toggleDirectorCleanHud,
  status:directorCameraStatus,
  active:()=>!!directorCamera.enabled,
  modes:()=>DIRECTOR_CAMERA_MODES.slice()
};
refreshDirectorCameraHud();

let lastFishingCameraDebugAt=0,lastFishingCameraPitch=player.pitch,lastFishingHeartbeatAt=0;
function fishingCameraDebug(reason,extra={},now=performance.now()){
  if(dimensionsState.kind!=='fishing_lake')return;
  if(reason==='look-update'&&now-lastFishingCameraDebugAt<180)return;
  lastFishingCameraDebugAt=now;
  const payload={
    reason,
    at:Date.now(),
    tickNow:Math.round(now),
    pos:player&&player.pos?{x:+player.pos.x.toFixed(3),y:+player.pos.y.toFixed(3),z:+player.pos.z.toFixed(3)}:null,
    vel:player&&player.vel?{x:+player.vel.x.toFixed(3),y:+player.vel.y.toFixed(3),z:+player.vel.z.toFixed(3)}:null,
    yaw:player&&Number.isFinite(player.yaw)?+player.yaw.toFixed(4):null,
    pitch:player&&Number.isFinite(player.pitch)?+player.pitch.toFixed(4):null,
    camera:(typeof camera!=='undefined'&&camera&&camera.rotation)?{x:+camera.rotation.x.toFixed(4),y:+camera.rotation.y.toFixed(4),z:+camera.rotation.z.toFixed(4)}:null,
    inputLocked:!!combatState.inputLocked,
    cursorReleased:!!combatState.cursorReleased,
    cameraInputAllowed:combatState.cameraInputAllowed,
    movementAllowed:combatState.movementAllowed,
    bodyClass:document.body.className,
    extra
  };
  if(globalThis.BlockcraftVerboseDebug)console.warn('[bc-fishing-camera-debug]',payload);
  try{globalThis.BlockcraftTrace&&globalThis.BlockcraftTrace('fishing.camera-debug',payload);}catch(e){}
}
function updateMovementStateSnapshot(state, speed, targetSpeed, sprintFactor, grounded, swimming, panther, exhausted){
  state.grounded=!!grounded;state.airborne=!grounded&&!swimming;state.swimming=!!swimming;state.panther=!!panther;state.exhausted=!!exhausted;state.sprinting=sprintFactor>.55||panther;
  state.speed=Math.round(speed*100)/100;state.targetSpeed=Math.round(targetSpeed*100)/100;state.sprintFactor=Math.round(sprintFactor*100)/100;
  state.state=panther?'panther':swimming?'swimming':state.sprinting?'sprinting':exhausted?'exhausted':grounded?'grounded':'airborne';
  globalThis.BlockcraftMovementState=state;
}
function localFallDamageFor(drop, featherStep=false){
  const d=Math.max(0,Number(drop)||0);
  if(d<=FALL_DAMAGE.safeDrop)return {damage:0,kind:'safe'};
  if(featherStep){
    if(d<=FALL_DAMAGE.featherAbsorbDrop)return {damage:0,kind:'absorbed'};
    return {damage:Math.max(1,Math.ceil((d-FALL_DAMAGE.featherAbsorbDrop)*FALL_DAMAGE.featherScale)),kind:'softened'};
  }
  return {damage:Math.min(FALL_DAMAGE.maxDamage,Math.ceil((d-FALL_DAMAGE.safeDrop)*FALL_DAMAGE.hardScale)),kind:'hard'};
}
function resolveLocalFallLanding(drop, featherStep=false){
  if(NET.on||tutorialSafe()||drop<=FALL_DAMAGE.safeDrop)return;
  if(dim==='overworld'&&isTownLand(Math.floor(player.pos.x),Math.floor(player.pos.z)))return;
  const result=localFallDamageFor(drop,featherStep);
  if(featherStep&&result.kind!=='safe'){
    showFeatherStepLandingFx({kind:result.kind,drop,damage:result.damage});
    showName(result.damage>0?'Feather Step softened fall':'Feather Step absorbed fall');
  }
  if(result.damage>0){
    showName('Hard landing -'+result.damage+' HP');
    damagePlayer(result.damage,'local:fall',{fallDrop:Math.round(drop*10)/10,fallKind:result.kind});
  }
}
function tryStepAssist(fromX,fromY,fromZ,dx,dz,wasGround,feetWater,flying){
  if(!wasGround||feetWater||flying||Math.hypot(dx,dz)<.03||!combatApi.collides)return false;
  const currentX=player.pos.x,currentY=player.pos.y,currentZ=player.pos.z;
  const currentDist=Math.hypot(currentX-fromX,currentZ-fromZ),wantDist=Math.hypot(dx,dz);
  if(currentDist>wantDist*.55)return false;
  for(const stepHeight of [.52,1.02]){
    player.pos.set(fromX,fromY+stepHeight,fromZ);
    player.onGround=false;
    if(combatApi.collides(player.pos))continue;
    moveAxis('x',dx);
    moveAxis('z',dz);
    const steppedDist=Math.hypot(player.pos.x-fromX,player.pos.z-fromZ);
    if(steppedDist<=currentDist+.035)continue;
    for(let i=0;i<10&&!player.onGround;i++)moveAxis('y',-.13);
    if(!combatApi.collides(player.pos)&&player.pos.y<=fromY+1.08){
      landingDip=Math.max(landingDip,.018);
      return true;
    }
  }
  player.pos.set(currentX,currentY,currentZ);
  return false;
}
function tickCameraLocomotion(dt, moving, grounded, swimming, sprintFactor, pantherView, f, s, planarSpeed){
  const pantherActive=!!(pantherView&&pantherView.active);
  const walkMix=Math.max(0,Math.min(1,(planarSpeed-1.2)/Math.max(1,MOVEMENT_FEEL.sprint-MOVEMENT_FEEL.walk)));
  const amp=pantherActive&&grounded&&moving?(.011+walkMix*.009):(grounded&&moving?(.012+walkMix*.014+sprintFactor*.014):(swimming&&moving?.018:0));
  const freq=pantherActive?13.6:(swimming?5.5:(8.2+sprintFactor*3.4));
  locomotionBobT+=dt*freq*(moving?1:.35);
  const targetBob=amp?(pantherActive?Math.abs(Math.sin(locomotionBobT))*amp*.75-Math.abs(Math.cos(locomotionBobT*.5))*amp*.22:Math.sin(locomotionBobT)*amp+Math.abs(Math.cos(locomotionBobT*.5))*amp*.35):0;
  locomotionBob=approach(locomotionBob,targetBob,pantherActive?14:10,dt);
  const accel=planarSpeed-lastPlanarSpeed;lastPlanarSpeed=planarSpeed;
  const targetPitch=grounded?(pantherActive?Math.max(-.04,Math.min(.024,-accel*.024)):Math.max(-.025,Math.min(.018,-accel*.016))):0;
  locomotionPitch=approach(locomotionPitch,targetPitch,pantherActive?11:8,dt);
  const targetRoll=pantherActive?(s*.035):(s*.018+sprintFactor*s*.014);
  locomotionRoll=approach(locomotionRoll,targetRoll,pantherActive?13:9,dt);
  landingDip=approach(landingDip,0,9,dt);
  return {bob:locomotionBob-landingDip,pitch:locomotionPitch,roll:locomotionRoll};
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
let weatherDiscoveryQuietUntil=0;
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
function disposeWeatherDiscoveryFx(){
  weatherDiscoveryFx.forEach(g=>{
    scene.remove(g);
    g.traverse(o=>{
      if(o.geometry)o.geometry.dispose();
      if(o.material){
        if(o.material.map)o.material.map.dispose();
        o.material.dispose();
      }
    });
  });
  weatherDiscoveryFx.clear();
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
  if(dim!=='overworld'||now<weatherDiscoveryQuietUntil){
    weatherDiscoveryFx.forEach(g=>g.visible=false);
    return;
  }
  const currentWeather=weather||'clear';
  const weatherSense=utilityUnlocked('weather_sense');
  for(const s of smallDiscoveries){
    const req=weatherDiscoveryReq[s.type];if(!req)continue;
    const dist=Math.hypot(player.pos.x-s.x,player.pos.z-s.z);
    const g=weatherDiscoveryFx.get(s.id)||makeWeatherDiscoveryFx(s),ud=g.userData,active=currentWeather===req;
    g.visible=dist<(weatherSense?85:42);
    if(!g.visible)continue;
    const pulse=.5+.5*Math.sin(now*.004+ud.phase);
    ud.halo.visible=active||dist<12;ud.beam.visible=active&&(weatherSense||dist<28);ud.label.visible=dist<13;
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
  },
  weatherChanged(){
    disposeWeatherDiscoveryFx();
    weatherDiscoveryHintCooldowns.clear();
    lastWeatherDiscoveryPromptWeather=null;
    weatherDiscoveryQuietUntil=performance.now()+9000;
    nextWeatherDiscoveryHintAt=weatherDiscoveryQuietUntil+2500;
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
  if(dim!=='overworld'||!NET.on||!NET.room||!locked||cutscene){setRecallRechargeNudge(false);return;}
  if(globalThis.BlockcraftRecall&&globalThis.BlockcraftRecall.active){setRecallRechargeNudge(false);return;}
  const manaMax=Math.max(1,maxMp()),staminaMax=Math.max(1,maxSp());
  const manaLow=mp/manaMax<=.28,staminaLow=sp/staminaMax<=.24;
  if(!manaLow&&!staminaLow){setRecallRechargeNudge(false);return;}
  const what=manaLow&&staminaLow?'mana and stamina':manaLow?'mana':'stamina';
  setRecallRechargeNudge(true,what);
  if(now<nextRecallRechargeHintAt)return;
  nextRecallRechargeHintAt=now+10000;
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
  if(dim==='taming_land'){
    return { cls:'event', name:'Taming Land', meta:'Dragon and familiar sanctuary - press G at the green portal to return' };
  }
  if(dim==='fishing_lake'){
    return { cls:'event', name:'Fishing Lake', meta:'Peaceful fishing waters - press G at the blue portal to return' };
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
  if(JOBS_ENABLED&&dim==='overworld' && Math.hypot(player.pos.x-HUB.jobs.x, player.pos.z-HUB.jobs.z)<6){
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
    if(HUB.tamingPortal&&Math.hypot(player.pos.x-HUB.tamingPortal.x, player.pos.z-HUB.tamingPortal.z)<6)
      return { cls:'town', name:'Taming Land Portal', meta:'Press G to visit the dragon and familiar sanctuary' };
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
  const labels={kill:'Wilderness roads',hunt:'Wild animal routes',gate:'Active Gate',event:'Server event',mine:'Quarry caves and ore seams',cave_survey:'Cave entrance',ancient_map:'Ancient City clue',treasure:'Treasure clue',farm:'Town Farm',cook:'Kitchen or crafting station',sell:'Tavern counter',smith:'Smithy forge',repair:'Smithy workbench',upgrade:"Tobin's forge",salvage:"Tobin's salvage bench",meditate:'Meditation Hall',tame:'Wild pet trails',pet_care:'Dragon Roost'};
  return labels[c.type]||'contract marker';
}
function jobContractActionText(c){
  if(!c)return 'Follow the marker and complete the contract action.';
  const target=c.target&&ITEMS[c.target]&&ITEMS[c.target].name||c.target&&B&&Object.keys(B).find(k=>B[k]===c.target)||'';
  const targetPart=target?' '+target:'';
  const text={
    kill:'Defeat hostile creatures outside town.',
    hunt:'Hunt wild animals outside town for kitchen supplies.',
    gate:'Enter and clear an active Gate.',
    event:'Join and finish a public server event.',
    mine:'Equip a pickaxe and mine'+targetPart+'.',
    cave_survey:'Follow cave markers underground and record survey pulses.',
    ancient_map:'Follow ancient map clues below the surface and investigate with G.',
    treasure:'Follow treasure clues and press G at the marked cache.',
    farm:'Till soil, plant seeds, or harvest mature crops.',
    cook:'Craft or cook the requested food item.',
    sell:'Sell prepared food at the tavern counter.',
    smith:'Craft, smelt, or prepare forge supplies.',
    repair:'Use Repair Kits on damaged tools.',
    upgrade:'Improve eligible weapons or tools at Tobin.',
    salvage:'Salvage unwanted non-legendary gear at Tobin.',
    meditate:'Stand in the Meditation Hall circle and meditate.',
    tame:'Bind a familiar with a collar, sigil, charm, or totem.',
    pet_care:'Craft treats, feed dragons, or care for companions.',
  }[c.type];
  return text||'Follow the contract description.';
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
  if(c.type==='tame')return {label:'Wild pet trails',x:HUB.northGate.x+12,z:HUB.northGate.z-18};
  if(c.type==='pet_care')return {label:'Dragon Roost',x:HUB.roost.x,z:HUB.roost.z};
  return null;
}
function jobContractObjective(){
  const c=clampJobContract(jobContract);
  if(!c || (c.job!=='adventurer'&&c.job!==playerJob)) return null;
  if(jobContractReady()) return {label:'Job Contract', text:'Claim reward: '+c.title};
  if(c.type==='cave_survey') return {label:'Miner Contract', text:'Survey underground cave routes '+Math.min(c.need,c.have)+'/'+c.need};
  if(c.type==='ancient_map') return {label:'Miner Contract', text:'Complete Ancient City map clues '+Math.min(c.need,c.have)+'/'+c.need};
  return {label:'Job Contract', text:c.title+' '+Math.min(c.need,c.have)+'/'+c.need+' at '+jobContractDestinationLabel(c)+' - '+jobContractActionText(c)};
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
function homeworkObjectiveForHud(){
  return activeObjectiveList()
    .filter(o=>o.source==='homework'||o.questType==='homework'||String(o.id||'').startsWith('homework:'))
    .sort((a,b)=>(a.priority|0)-(b.priority|0)||String(a.title||'').localeCompare(String(b.title||'')))[0] || null;
}
function refreshHomeworkHud(){
  if(!homeworkHudEl)return;
  const o=homeworkObjectiveForHud(),p=o&&serverObjectiveProgressParts(o);
  if(!o||!p){
    homeworkHudEl.classList.add('hidden');
    homeworkHudEl.innerHTML='';
    return;
  }
  const complete=p.current>=p.required;
  const period=(o.location&&o.location!=='Recall Cast')?o.location:(o.title||'Information Technology Basics');
  const desc=o.text||o.description||'Answer questions to earn XP.';
  homeworkHudEl.classList.toggle('complete',complete);
  homeworkHudEl.classList.remove('hidden');
  homeworkHudEl.innerHTML=
    '<button type="button" data-objective-action="'+(complete?'questlog':'recall')+'" aria-label="View homework quest">'+
      '<span class="hwkicker">Homework Quest</span>'+
      '<strong>'+escHTML(period)+'</strong>'+
      '<small>'+escHTML(desc)+'</small>'+
      '<div class="hwprogress"><b>'+escHTML(String(p.current)+' / '+String(p.required))+'</b><em>Questions</em></div>'+
      '<i><em style="width:'+p.pct+'%"></em></i>'+
      '<div class="hwfooter"><span class="hwbook">▰</span><span class="hwcta">'+(complete?'View Results':'View Quest')+'</span></div>'+
    '</button>';
}
globalThis.BlockcraftRefreshHomeworkHud=refreshHomeworkHud;
function serverObjectiveProgressText(o){
  const p=o&&o.progress;
  if(!p||!Number.isFinite(p.current)||!Number.isFinite(p.required))return '';
  return Math.min(p.required,p.current)+'/'+p.required+' - ';
}
function serverObjectiveHudText(o){
  if(!o)return '';
  if(o.id==='progression:first_profession_contract'){
    const handoff=professionHandoffObjective();
    if(handoff&&handoff.text)return handoff.text;
  }
  if(o.hudText)return o.hudText;
  const legacy={
    'progression:first_land_claim':'Leave town and buy one protected wilderness tile',
    'progression:first_claim_expand':'Buy two connected tiles beside your first claim to make a 3-tile Homestead',
    'progression:first_base_setup':'Inside your Homestead: place storage, light, and a station',
    'progression:first_homestead_upgrade':'Choose your first Homestead upgrade from Land Claims',
    'progression:first_profession_contract':'Take your first profession or Adventurer contract at the Job Board'
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
  if(type==='find_gate')return {type:'find_gate',label:explicit.label||'FIND GATE',rank:explicit.rank};
  if(type==='jobs')return {type:'jobs',label:explicit.label||(o.status==='claimable'?'CLAIM AT JOB BOARD':'OPEN JOB BOARD')};
  if(type==='guild_contracts')return {type:'guild_contracts',label:explicit.label||(o.status==='claimable'?'CLAIM GUILD CONTRACT':'OPEN GUILD CONTRACTS')};
  if(type==='land')return {type:'land',label:explicit.label||'CLAIM LAND'};
  if(type==='gate_prep')return {type:'gate_prep',label:explicit.label||'PREP CHECK',rank:explicit.rank==null?gatePrepTargetRank():explicit.rank|0};
  if(type==='choose_spec')return {type:'choose_spec',label:explicit.label||'CHOOSE SPEC'};
  if(type==='regional_track')return {type:'regional_track',label:explicit.label||'TRACK'};
  if(type==='recall')return {type:'recall',label:explicit.label||'START RECALL'};
  if(type==='track_npc')return {type:'track_npc',label:explicit.label||'TRACK NPC',location:o.location||'',source:o.source||''};
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
function objectiveLine(kind,label,title,text,action,progress=null,meta=null){
  return {kind,label,title:title||label,text:text||'',action,progress,...(meta&&typeof meta==='object'?meta:{})};
}
function professionHandoffObjective(){
  const job=String(playerJob||'');
  if(job==='miner')return {
    title:'Quarry Contract',
    text:'Open the Job Board for your first mining contract, then head to the quarry for ore seams, hidden routes, and map clues.',
    target:{label:'Quarry',x:HUB.quarry.x,z:HUB.quarry.z}
  };
  if(job==='farmer')return {
    title:'Farm Supply Task',
    text:'Open the Job Board for a farm supply task, then work the farm plots to grow food for cooks, traders, and town stores.',
    target:{label:'Farm',x:HUB.farm.x,z:HUB.farm.z}
  };
  if(job==='cook')return {
    title:'Tavern Meal Shift',
    text:'Open the Job Board for a cooking contract, then use the tavern counter to turn ingredients into buffs, recovery, and gold.',
    target:{label:'Tavern',x:HUB.tavern.x,z:HUB.tavern.z}
  };
  if(job==='blacksmith')return {
    title:'Forge Work Order',
    text:'Open the Job Board for a forge order, then visit Tobin to repair, upgrade, craft, or sell gear.',
    target:{label:'Forge',x:HUB.smith.x,z:HUB.smith.z}
  };
  if(job==='monk')return S&&S.lvl>=4 ? {
    title:'Meditation Hall',
    text:'Return to the Meditation Hall and press G in the focus circle to restore resources and train long-term mana growth.',
    target:{label:'Meditation Hall',x:HUB.shrine.x,z:HUB.shrine.z}
  } : {
    title:'Support Contract',
    text:'Meditation Hall growth unlocks at E-Rank Level 4. For now, open the Job Board for your first support contract.',
    target:{label:'Job Board',x:HUB.jobs.x,z:HUB.jobs.z}
  };
  if(job==='pet_tamer')return {
    title:'Roost Care Route',
    text:'Open the Job Board for pet care work, then travel to Taming Land or the Dragon Roost for eggs, bonds, and training services.',
    target:{label:'Dragon Roost',x:HUB.roost.x,z:HUB.roost.z}
  };
  return null;
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
  if(progressionFocus==='first_land_claim')return objectiveLine('progression','Next','First Claim','Leave town and buy one protected wilderness tile',{type:'land',label:'CLAIM LAND'});
  if(progressionFocus==='first_claim_expand')return objectiveLine('progression','Next','Expand Claim','Buy two connected tiles beside your first claim to make a 3-tile Homestead',{type:'land',label:'EXPAND LAND'});
  if(progressionFocus==='first_base_setup')return objectiveLine('progression','Next','Base Setup','Inside your Homestead: place storage, light, and a station',{type:'land',label:'OPEN LAND'});
  if(progressionFocus==='first_homestead_upgrade')return objectiveLine('progression','Next','Homestead Upgrade','Your Homestead is ready. Choose your first upgrade from Land Claims',{type:'land',label:'OPEN HOMESTEAD'});
  if(progressionFocus==='first_craft_station'){
    const craft=objectiveCraftAction('what_next');
    return objectiveLine('progression','Next','Craft Station','Craft your first table or furnace',craft||{type:'questlog',label:'OPEN QUEST LOG'});
  }
  if(progressionFocus==='first_profession_contract'||progressionFocus==='first_promotion_job'||progressionFocus==='first_promotion_contract'||progressionFocus==='next_adventurer_contract'){
    const handoff=professionHandoffObjective();
    if(handoff)return objectiveLine('progression','Next',handoff.title,handoff.text,{type:'jobs',label:'OPEN JOB BOARD'});
    return objectiveLine('progression','Next','Profession Work','Take your first profession or Adventurer contract at the Job Board',{type:'jobs',label:'OPEN JOB BOARD'});
  }
  if(progressionFocus==='c_rank_climb'){
    const prep=menusApi.gateReadiness&&menusApi.gateReadiness(2);
    const rankProgress=currentRankProgress&&currentRankProgress();
    const progress=rankProgress&&rankProgress.nextRank===2?objectiveProgressParts(rankProgress.earned,rankProgress.required):null;
    return objectiveLine('progression','Next','C-rank Climb',prep&&prep.ready?'Ready - find or open a C-rank Gate':'Earn Hunter XP and prep for C-rank positioning checks',prep&&prep.ready?{type:'find_gate',label:'FIND C GATE',rank:2}:{type:'gate_prep',label:'C PREP CHECK',rank:2},progress);
  }
  if(progressionFocus==='c_rank_specialization'){
    return objectiveLine('progression','Next','C-rank Specialization','Choose one permanent specialization for your combat path',{type:'choose_spec',label:'CHOOSE SPEC'});
  }
  if(progressionFocus==='b_rank_pressure'){
    const pressure=overworldActivity&&overworldActivity.gateBreach;
    if(pressure)return objectiveLine('progression','Next','Gate Pressure','A Gate breach is active. Track and contain the escaped boss before roads worsen',{type:'regional_track',label:'TRACK BREACH'});
    const rank=midgameGateRank(),rankName=RANKS[rank]&&RANKS[rank].n||'C';
    const prep=menusApi.gateReadiness&&menusApi.gateReadiness(rank);
    if(prep&&!prep.ready)return objectiveLine('progression','Next','Gate Pressure',rankName+'-Rank pressure is rising. Fix your Gate kit before the next clear',{type:'gate_prep',label:rankName+' PREP CHECK',rank});
    if(gate)return objectiveLine('progression','Next','Gate Pressure','Clear higher-rank Gates, Road Warden work, and regional trouble to stabilize the climb',{type:'find_gate',label:'FIND GATE',rank});
    return objectiveLine('progression','Next','Gate Pressure','No breach is active. Take Adventurer or Road Warden work so B-rank pressure keeps moving',{type:'jobs',label:'OPEN JOB BOARD'});
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
  const chapter=quest.giver==='Mara Vale'&&quest.chainStep>=0&&quest.chainStep<=2?chapterOneMeta((quest.chainStep|0)+1):null;
  let target=null;
  if(isAegis)target={label:'Aegis Guardian',x:HUB.aegisApproach.x,z:HUB.aegisApproach.z};
  else if(questDone())target={label:quest.giver==='Mara Vale'?'Mara Vale':'Quest Giver',x:HUB.guide.x,z:HUB.guide.z};
  else if(quest.giver==='Mara Vale'&&quest.title==='First Hands')target={label:'Logging Area',x:HUB.northGate.x,z:HUB.northGate.z-15};
  else if(quest.type==='gate')target=gate?{label:'Active Gate',x:gate.x||TOWN.TC,z:gate.z||TOWN.TC}:{label:'North Gate',x:HUB.northGate.x,z:HUB.northGate.z+1.2};
  else if(quest.type==='kill'||quest.type==='fetch'||quest.type==='mine'||quest.type==='pvp_bounty')target={label:'Wilderness',x:HUB.northGate.x,z:HUB.northGate.z-15};
  return objectiveLine(isAegis?'aegis':'story',isAegis?'Aegis':'Story',story.label,story.text,action,progress,{chapter,target});
}
function localJobObjectiveLine(){
  const c=clampJobContract(jobContract),job=jobContractObjective();
  if(!c||!job)return null;
  const action=jobContractReady()?{type:'jobs',label:'CLAIM AT JOB BOARD'}:(objectiveCraftAction('job')||{type:'follow_marker',label:'FOLLOW MARKER'});
  return objectiveLine('job','Job',job.label,job.text,action,objectiveProgressParts(c.have,c.need),{chapter:starterJobChapter(c),target:jobContractReady()?{label:'Job Board',x:HUB.jobs.x,z:HUB.jobs.z}:jobContractCompassTarget(c)});
}
function localGuildObjectiveLine(){
  const c=clampRegionalContract(regionalContract),guild=guildContractObjective();
  if(!c||!guild)return null;
  return objectiveLine('guild','Guild',guild.label,guild.text,{type:'guild_contracts',label:c.ready?'CLAIM GUILD':'GUILD WORK'},objectiveProgressParts(c.have,c.need));
}
function serverObjectiveLine(o,labelOverride=''){
  if(!o)return null;
  const action=serverObjectiveHudAction(o)||{type:'questlog',label:'QUEST LOG'};
  const source=String(o.source||''),loc=String(o.location||'').toLowerCase(),title=String(o.title||'').toLowerCase(),text=String(o.text||o.hudText||'').toLowerCase();
  let target=null;
  if(source==='story'&&(loc.includes('mara')||title.includes('mara')||text.includes('mara'))&&(o.status==='offered'||o.status==='claimable'||o.status==='complete'||['track_npc','quest_log','turn_in'].includes(action.type))){
    target={label:'Mara Vale',x:HUB.guide.x,z:HUB.guide.z};
  }
  return objectiveLine(o.source||'server',labelOverride||((o.source||'Objective').toUpperCase()),o.title||'Objective',serverObjectiveHudText(o),action,serverObjectiveProgressParts(o),{chapter:o.chapter||null,checklist:Array.isArray(o.checklist)?o.checklist:null,serverObjective:o,target});
}
function chapterOneMeta(step=8){
  return {id:'chapter_1_town_beginnings',title:'Chapter 1: Town of Beginnings',step:Math.max(1,step|0),total:9};
}
function starterJobChapter(c){
  return c&&(c.difficulty==='starter'||c.difficultyLabel==='First Real Shift')?chapterOneMeta(8):null;
}
function chapterProgressionObjectiveLine(){
  const line=serverObjectiveLine(serverObjectiveBySource('progression'),'Next');
  return line&&line.chapter?line:null;
}
function gatePrepTargetRank(){
  if(menusApi.nextGatePrepRank){
    const rank=menusApi.nextGatePrepRank();
    if(rank>=0)return rank;
  }
  if(quest&&quest.type==='gate'&&quest.gateRank!=null)return Math.max(0,Math.min(4,quest.gateRank|0));
  if(progressionFocus==='first_d_gate')return 1;
  if(progressionFocus==='c_rank_climb')return 2;
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
function postDRankGuidanceReady(){
  return !!(dim==='overworld'&&highestGateRankCleared>=1&&!quest&&!jobContract&&!clampRegionalContract(regionalContract)&&progressionFocus!=='c_rank_climb'&&progressionFocus!=='b_rank_pressure');
}
function midgameGateRank(){
  if(menusApi.nextGatePrepRank){
    const rank=menusApi.nextGatePrepRank();
    if(rank>=0)return Math.max(1,Math.min(4,rank|0));
  }
  return Math.max(1,Math.min(4,localPlayerHunterRankIndex?localPlayerHunterRankIndex():1));
}
function midgameObjectiveLine(){
  if(!postDRankGuidanceReady())return null;
  const rank=midgameGateRank(),rankName=RANKS[rank]&&RANKS[rank].n||'?';
  const prep=menusApi.gateReadiness&&menusApi.gateReadiness(rank);
  if(prep&&!prep.ready){
    const missing=prep.next&&prep.next.label?prep.next.label:'your kit';
    return objectiveLine('midgame','Next','Sharpen '+rankName+'-Rank Kit',rankName+'-Rank Gates are open. '+prep.status+' '+prep.score+'/'+prep.total+' - fix '+missing,{type:'gate_prep',label:'PREP CHECK',rank},objectiveProgressParts(prep.score,prep.total),{target:{label:'Gate Prep',x:HUB.smith.x,z:HUB.smith.z}});
  }
  if(gate&&((gate.rank|0)<=rank||!prep)){
    return objectiveLine('midgame','Next','Clear a '+(RANKS[gate.rank]&&RANKS[gate.rank].n||rankName)+'-Rank Gate','You are between contracts. Inspect the nearby Gate, rally if needed, then clear the boss for loot and Hunter XP',{type:'find_gate',label:'FIND GATE'},null,{target:{label:'Gate',x:gate.x||TOWN.TC,z:gate.z||TOWN.TC}});
  }
  const opportunity=typeof nearbyRegionalOpportunity==='function'?nearbyRegionalOpportunity():null;
  if(opportunity&&opportunity.distance<120){
    return objectiveLine('midgame','Next','Handle Regional Trouble',opportunity.title+' nearby - track it for Road Warden progress, loot, and safer roads',{type:'regional_track',label:opportunity.tracked?'CLEAR TRACK':'TRACK'},null,{target:{label:opportunity.title,x:opportunity.x,z:opportunity.z}});
  }
  const level=S&&S.lvl|0,rankProgress=currentRankProgress&&currentRankProgress();
  const nextRankName=rankProgress&&rankProgress.nextRank!=null&&RANKS[rankProgress.nextRank]?RANKS[rankProgress.nextRank].n+'-Rank':'the next rank';
  const progressText=rankProgress&&!rankProgress.maxRank
    ? 'Current climb: '+rankName+'-Rank toward '+nextRankName+'. '
    : '';
  return objectiveLine('midgame','Next','Take Rotating Adventurer Work',progressText+'Open the Job Board for Gates, patrols, events, and field contracts so the rank climb keeps moving',{type:'jobs',label:'OPEN JOB BOARD'},null,{target:{label:'Job Board',x:HUB.jobs.x,z:HUB.jobs.z},level});
}
function idleObjectiveLine(){
  if(dim!=='overworld')return null;
  const inTown=isTownLand(Math.floor(player.pos.x),Math.floor(player.pos.z));
  if(inTown)return objectiveLine('progression','Next','Choose Work','Open your Quest Log or visit the Job Board for the clearest task',{type:'questlog',label:'OPEN QUEST LOG'});
  return objectiveLine('progression','Next','Find A Lead','Return to town, follow a landmark, or open your Quest Log',{type:'questlog',label:'OPEN QUEST LOG'});
}
function tutorialRoomHudSuppressed(){
  return dim!=='overworld'||dimensionsState.kind!=='overworld'||(combatState.jobTutorialActive&&combatState.jobTutorialJob);
}
function transitionPanelActuallyOpen(type){
  const panels=transitionPanelState();
  return type==='choose_job'&&panels.jobOpen || type==='choose_path'&&panels.pathOpen || type==='start_awakening'&&panels.awakeningOpen || type==='continue_panel'&&panels.rewardOpen;
}
function shouldDeferTransitionAction(transition,{story=null,job=null}={}){
  if(!transition)return false;
  if(transition.type==='continue_panel'||transition.type==='use_ability')return false;
  const baseOnboardingFocus=['first_craft_station','first_land_claim','first_claim_expand','first_base_setup','first_homestead_upgrade'].includes(progressionFocus);
  if(transition.type==='choose_job')return !!story || baseOnboardingFocus || progressionFocus==='first_d_gate' || progressionFocus==='c_rank_climb' || progressionFocus==='b_rank_pressure' || progressionFocus==='next_adventurer_contract';
  if(transitionPanelActuallyOpen(transition.type))return false;
  if(transition.type==='choose_path'||transition.type==='start_awakening'){
    return !!story || !!job || baseOnboardingFocus || progressionFocus==='first_profession_contract' || progressionFocus==='first_promotion_job' || progressionFocus==='first_promotion_contract' || progressionFocus==='c_rank_climb' || progressionFocus==='b_rank_pressure' || progressionFocus==='next_adventurer_contract' || progressionFocus==='first_d_gate';
  }
  return false;
}
function nextBestObjectiveLine(){
  if(tutorialRoomHudSuppressed()||dim==='dungeon'||dim==='event'||dim==='gatecutscene')return null;
  const transition=transitionRecoveryAction();
  const story=localStoryObjectiveLine()||serverObjectiveLine(serverObjectiveBySource('story','manhunt'),'Story');
  const localJob=localJobObjectiveLine();
  if(transition && !shouldDeferTransitionAction(transition,{story,job:localJob})){
    const title=transition.type==='continue_panel'?'Continue Reward':
      transition.type==='choose_path'?'Choose Path':
      transition.type==='start_awakening'?'Start Awakening':
      transition.type==='use_ability'?'Ability Training':'Continue';
    const text=transition.type==='use_ability'?(combatState.abilityTrainingUsed?'Finish the training meadow':'Use your Q ability in the training meadow'):'Finish the open step so the next objective can appear';
    return objectiveLine('transition','Now',title,text,transition);
  }
  if(story)return story;
  if(townGuidanceActive&&!jobContract){
    const tutorial=tutorialObjective();
    if(tutorial)return objectiveLine('tutorial','Guide',tutorial.label,tutorial.text,{type:'follow_marker',label:'FOLLOW MARKER'});
  }
  const chapterProgression=chapterProgressionObjectiveLine();
  if(chapterProgression)return chapterProgression;
  if(localJob)return localJob;
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
  const midgame=midgameObjectiveLine();
  if(midgame)return midgame;
  const style=playerStyleObjectiveLine();
  if(style)return style;
  return progression||idleObjectiveLine();
}
function unifiedObjectiveList(){
  if(tutorialRoomHudSuppressed()||dim==='dungeon'||dim==='event'||dim==='gatecutscene')return [];
  const transition=transitionRecoveryAction();
  const lines=[];
  const story=localStoryObjectiveLine()||serverObjectiveLine(serverObjectiveBySource('story','manhunt'),'Story');
  const job=localJobObjectiveLine()||serverObjectiveLine(serverObjectiveBySource('job'),'Job');
  if((townGuidanceActive&&!jobContract)||(transition&&!shouldDeferTransitionAction(transition,{story,job})))return [];
  if(story)lines.push(story);
  const chapterProgression=chapterProgressionObjectiveLine();
  if(chapterProgression)lines.push(chapterProgression);
  const prep=gatePrepObjectiveLine();
  if(prep)lines.push(prep);
  const aegis=!story||story.kind!=='aegis'?serverObjectiveLine(serverObjectiveBySource('aegis'),'Aegis'):null;
  if(aegis)lines.push(aegis);
  if(job)lines.push(job);
  const guild=localGuildObjectiveLine()||serverObjectiveLine(serverObjectiveBySource('guild'),'Guild');
  if(guild)lines.push(guild);
  const progression=serverObjectiveLine(serverObjectiveBySource('progression'),'Next')||progressionObjectiveFallback();
  if(progression&&progression!==chapterProgression)lines.push(progression);
  const midgame=midgameObjectiveLine();
  if(midgame)lines.push(midgame);
  const seen=new Set();
  return lines.filter(line=>{const key=line.kind+':'+line.title;if(seen.has(key))return false;seen.add(key);return true;}).slice(0,6);
}
function unifiedObjectiveHud(){
  const lines=unifiedObjectiveList();
  if(lines.length)return {label:'Objective Tracker',text:'Active quest categories',unified:true,lines};
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
  const jobOpen=!!(path&&!path.classList.contains('hidden')&&path.classList.contains('jobselect'));
  const pathOpen=!!(path&&!path.classList.contains('hidden')&&!jobOpen);
  const awakeningOpen=!!(awakening&&!awakening.classList.contains('hidden'));
  return {rewardOpen,pathOpen,jobOpen,awakeningOpen};
}
function transitionRecoveryAction(){
  const panels=transitionPanelState();
  if(panels.rewardOpen) return {type:'continue_panel',label:'CONTINUE'};
  if(panels.jobOpen || combatState.jobChoiceOpen) return {type:'choose_job',label:'CHOOSE JOB'};
  if(panels.pathOpen || (S&&S.lvl>=2&&!S.path)) return {type:'choose_path',label:'CHOOSE PATH'};
  if(panels.awakeningOpen || (S&&S.lvl>=2&&S.path&&combatState.abilityReady&&!combatState.abilityTutorialDone&&!combatState.abilityTrainingActive)) return {type:'start_awakening',label:'START AWAKENING'};
  if(combatState.abilityTrainingActive) return {type:'use_ability',label:combatState.abilityTrainingUsed?'FINISH TRAINING':'USE ABILITY'};
  return null;
}
function currentObjectiveAction(){
  if(dim==='dungeon') return null;
  const transition=transitionRecoveryAction();
  const storyActive=!!(localStoryObjectiveLine()||serverObjectiveLine(serverObjectiveBySource('story','manhunt'),'Story'));
  if(transition && !shouldDeferTransitionAction(transition,{story:storyActive,job:!!jobContract})) return transition;
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
  if(progressionFocus==='first_land_claim'||progressionFocus==='first_claim_expand'||progressionFocus==='first_base_setup'||progressionFocus==='first_homestead_upgrade') return {type:'land',label:progressionFocus==='first_homestead_upgrade'?'OPEN HOMESTEAD':'CLAIM LAND'};
  if(progressionFocus==='first_profession_contract'||progressionFocus==='first_promotion_job'||progressionFocus==='first_promotion_contract'||progressionFocus==='next_adventurer_contract') return {type:'jobs',label:'OPEN JOB BOARD'};
  if(progressionFocus==='c_rank_specialization') return {type:'choose_spec',label:'CHOOSE SPEC'};
  if(progressionFocus==='b_rank_pressure') return progressionObjectiveFallback().action || {type:'jobs',label:'OPEN JOB BOARD'};
  if(progressionFocus==='c_rank_climb'){
    const prep=menusApi.gateReadiness&&menusApi.gateReadiness(2);
    return prep&&prep.ready?{type:'find_gate',label:'FIND C GATE',rank:2}:{type:'gate_prep',label:'C PREP CHECK',rank:2};
  }
  if(progressionFocus==='first_d_gate'){
    const craft=objectiveCraftAction('what_next');
    if(craft) return craft;
    const prep=ONBOARD.dRankPrepStatus&&ONBOARD.dRankPrepStatus();
    return prep&&prep.ready ? {type:'find_gate',label:'FIND GATE'} : {type:'questlog',label:'OPEN GATE PREP'};
  }
  const midgame=midgameObjectiveLine();
  if(midgame&&midgame.action)return midgame.action;
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
function trackerGuideButton(line,index){
  if(!line)return '';
  const server=line.serverObjective||null;
  const attrs=['type="button"','class="qaction guide"','data-objective-guide="1"','data-guide-title="'+escHTML(line.title||line.label||'Objective')+'"'];
  if(server&&server.id)attrs.push('data-guide-id="'+escHTML(server.id)+'"');
  if(line.target&&Number.isFinite(Number(line.target.x))&&Number.isFinite(Number(line.target.z))){
    attrs.push('data-guide-x="'+Number(line.target.x)+'"');
    attrs.push('data-guide-z="'+Number(line.target.z)+'"');
    attrs.push('data-guide-label="'+escHTML(line.target.label||line.title||'Objective')+'"');
  }
  return '<button '+attrs.join(' ')+'>GUIDE ME</button>';
}
function objectiveHudHTML(obj){
  if(!obj) return '';
  const checklistHTML=line=>Array.isArray(line&&line.checklist)?'<div class="prepchecklist">'+line.checklist.map(c=>'<div class="'+(c.done?'done':'todo')+'"><b>'+(c.done?'&#10003;':'&#9675;')+'</b><span>'+escHTML(c.label||'Check')+'</span></div>').join('')+'</div>':'';
  const activeQuestCard=line=>{
    const progress=line&&line.progress?line.progress:null;
    const progressBar=progress?'<div class="activequest-progress"><b>'+progress.current+' / '+progress.required+' '+escHTML(progress.label||'')+'</b><i><em style="width:'+progress.pct+'%"></em></i></div>':'';
    const objective=line&&line.text?line.text:'Continue the active objective.';
    return '<div class="activequest-card '+escHTML(line&&line.kind||'objective')+'">'+
      '<div class="activequest-head"><span>Active Quest</span><button type="button" class="activequest-open" data-objective-action="questlog" title="View all quests (O)" aria-label="View all quests">✦<b>O</b></button></div>'+
      '<h3>'+escHTML(line&&line.title||line&&line.label||'Current Quest')+'</h3>'+
      '<p>'+escHTML(objective)+'</p>'+
      progressBar+
      '</div>';
  };
  if(obj.nextBest&&obj.line){
    const line=obj.line;
    const progress=line.progress?'<i style="width:'+line.progress.pct+'%"></i>':'';
    const progressText=line.progress?'<em>'+line.progress.current+'/'+line.progress.required+'</em>':'';
    const chapter=line.chapter?'<div class="chapter-kicker">'+escHTML(line.chapter.title||'Chapter')+(line.chapter.step?'<span>'+Math.max(1,line.chapter.step|0)+'/'+Math.max(1,line.chapter.total|0)+'</span>':'')+'</div>':'';
    return '<div class="qt">Next Best Action</div><div class="objective-list next-best-list">'+
      '<div class="objective-line next-best '+escHTML(line.kind||'objective')+'">'+
        '<div class="olabel">'+escHTML(line.label||'Next')+'</div>'+
        '<div class="obody">'+chapter+'<b>'+escHTML(line.title||'Next Step')+'</b><span>'+escHTML(line.text||'')+'</span>'+checklistHTML(line)+(line.progress?'<div class="obar">'+progress+'</div>':'')+'</div>'+
        '<div class="oact">'+progressText+trackerActionButton(line.action)+'</div>'+
      '</div>'+
    '</div>';
  }
  if(obj.unified&&Array.isArray(obj.lines)){
    const primary=obj.lines[0];
    return primary?activeQuestCard(primary):'';
  }
  const action=currentObjectiveAction(obj);
  return ONBOARD.objectiveHudHTML(action?{...obj,actionHTML:trackerActionButton(action)}:obj);
}
function currentObjectiveHud(){
  if(tutorialRoomHudSuppressed())return null;
  if(dim==='dungeon'){
    const dungeonObj=currentObjective();
    return dungeonObj?{...dungeonObj,label:'Next Best Action'}:null;
  }
  const unified=unifiedObjectiveHud();
  if(unified)return unified;
  if(townGuidanceActive&&!jobContract)return null;
  const current=currentObjective();
  return current?{...current,label:'Next Best Action'}:null;
}
function debugObjectiveHudSummary(obj){
  if(!obj)return null;
  const line=obj.line||null;
  const server=line&&line.serverObjective||obj.serverObjective||null;
  return {
    label:obj.label||'',
    text:obj.text||'',
    nextBest:!!obj.nextBest,
    unified:!!obj.unified,
    line:line?{
      kind:line.kind||'',
      label:line.label||'',
      title:line.title||'',
      text:line.text||'',
      action:line.action?{type:line.action.type||'',label:line.action.label||''}:null,
      progress:line.progress||null,
      chapter:line.chapter||null,
      serverObjective:server?{id:server.id||'',source:server.source||'',status:server.status||'',title:server.title||''}:null,
    }:null,
  };
}
let lastObjectiveHudDebugSig='';
function refreshObjectiveTracker(){
  if(!currentQuestEl)return;
  let html='',hidden=false,obj=null;
  if(tutorialRoomHudSuppressed()){
    hidden=true;
  }else{
    obj=currentObjectiveHud();
    if(obj)html=objectiveHudHTML(obj);
    else hidden=true;
  }
  if(html!==lastObjectiveHudHTML||hidden!==lastObjectiveHudHidden){
    lastObjectiveHudHTML=html;lastObjectiveHudHidden=hidden;
    currentQuestEl.classList.toggle('hidden',hidden);
    if(currentQuestEl.innerHTML!==html)currentQuestEl.innerHTML=html;
  }
  if(globalThis.BlockcraftTrace){
    const summary=debugObjectiveHudSummary(obj);
    const text=(currentQuestEl.textContent||'').replace(/\s+/g,' ').trim();
    const sig=JSON.stringify({summary,text,hidden:currentQuestEl.classList.contains('hidden')});
    if(sig!==lastObjectiveHudDebugSig){
      lastObjectiveHudDebugSig=sig;
      globalThis.BlockcraftTrace('ui.objective-hud', { hidden:currentQuestEl.classList.contains('hidden'), text, hud:summary });
    }
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
  if(action==='choose_job'){
    if(combatState.jobChoiceOpen || transitionPanelState().jobOpen){ sysMsg('<b>Choose Job:</b> pick a job tutorial card, choose later, or open the Job Board.'); return; }
    if(combatApi.openLevel2JobChoice&&combatApi.openLevel2JobChoice(true)) return;
    sysMsg('<b>Choose Job:</b> open the Job Board when you are ready to try a profession.');
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
    if(progressionFocus==='first_base_setup') sysMsg('<b>Base setup:</b> build inside the highlighted Homestead. Place storage, light, and a station to finish.');
    else if(progressionFocus==='first_homestead_upgrade') sysMsg('<b>Homestead upgrade:</b> stand in your base and choose a starter upgrade.');
    else sysMsg('<b>Land claiming:</b> choose an available tile near your base. The overlay shows owned, shared, and wilderness land.');
    return;
  }
  if(action==='gate_prep'){
    menusApi.openGatePrep&&menusApi.openGatePrep(+(btn.dataset.rank||0));
    return;
  }
  if(action==='choose_spec'){
    if(dimensionsApi.openStat){dimensionsApi.openStat();return;}
    sysMsg('<b>Specialization:</b> open Character and choose one permanent path specialization.');
    return;
  }
  if(action==='player_style'){
    menusApi.openPlayerStyleGuide&&menusApi.openPlayerStyleGuide();
    return;
  }
  if(action==='regional_track'){
    if(globalThis.toggleRegionalOpportunityTracking&&globalThis.toggleRegionalOpportunityTracking())return;
    menusApi.openRegionalContracts&&menusApi.openRegionalContracts();
    sysMsg('<b>Regional work:</b> no nearby trouble is ready to track. Open Guild Contracts for Road Warden leads.');
    return;
  }
  if(action==='recall'){
    if(globalThis.BlockcraftRecall&&typeof globalThis.BlockcraftRecall.start==='function'){
      globalThis.BlockcraftRecall.start();
      return;
    }
    sysMsg('<b>Recall:</b> press P to answer homework questions.');
    return;
  }
  if(action==='questlog'){menusApi.openQuestLog&&menusApi.openQuestLog();return;}
  if(action==='track_npc'){
    menusApi.openQuestLog&&menusApi.openQuestLog();
    const location=btn&&btn.dataset&&btn.dataset.location || 'the story NPC';
    sysMsg('<b>Main Story:</b> talk to '+escHTML(location)+'. Quest Log opened for context.');
    return;
  }
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
    const guide=e.target&&e.target.closest&&e.target.closest('[data-objective-guide]');
    if(guide){
      e.preventDefault();
      e.stopPropagation();
      const api=globalThis.BlockcraftGuideObjective;
      const title=guide.dataset.guideTitle||guide.dataset.guideLabel||'Objective';
      let ok=false;
      if(api&&guide.dataset.guideX!=null&&guide.dataset.guideZ!=null){
        ok=api.setTarget({x:Number(guide.dataset.guideX),z:Number(guide.dataset.guideZ)},guide.dataset.guideLabel||title);
      }
      if(!ok&&api&&guide.dataset.guideId)ok=api.setObjective(guide.dataset.guideId,title);
      if(ok)sysMsg('<b>Guide active:</b> follow the glowing trail for '+escHTML(title)+'.');
      else {
        menusApi.openQuestLog&&menusApi.openQuestLog();
        sysMsg('<b>Guide unavailable:</b> Quest Log opened for this objective.');
      }
      return;
    }
    const btn=e.target&&e.target.closest&&e.target.closest('[data-objective-action]');
    if(!btn) return;
    e.preventDefault();
    e.stopPropagation();
    handleObjectiveAction(btn.dataset.objectiveAction,btn);
  };
  currentQuestEl.addEventListener('pointerdown',triggerObjectiveAction,{capture:true});
  currentQuestEl.addEventListener('click',triggerObjectiveAction);
}
if(homeworkHudEl){
  const triggerHomeworkAction=e=>{
    const btn=e.target&&e.target.closest&&e.target.closest('[data-objective-action]');
    if(!btn)return;
    e.preventDefault();
    e.stopPropagation();
    handleObjectiveAction(btn.dataset.objectiveAction,btn);
  };
  homeworkHudEl.addEventListener('pointerdown',triggerHomeworkAction,{capture:true});
  homeworkHudEl.addEventListener('click',triggerHomeworkAction);
}
function currentObjective(){
  if(dim==='gatecutscene') return {label:'Gate Vision', text:'The first dungeon reveals itself'};
  if(dim==='dungeon'){
    const st=dungeon&&dungeon.status;
    if(st&&Array.isArray(st.party)){
      const me=dungeonStatusMember(st,NET.room&&NET.room.sessionId);
      const runState=dungeonObjectiveState(st,me,Math.max(0,st.remainingChests|0));
      if(runState)return {label:runState.label||'Current Goal', text:runState.text||''};
    }
    if(firstGateQuestDungeon()){
      if(dungeon&&dungeon.cleared)return {label:'First Gate Cleared', text:'First Gate cleared. Exit through the portal and return to Mara for the next step.'};
      return {label:'First Gate: Clear Rooms', text:'Move room to room. Defeat enemies to open the boss route.'};
    }
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
  if(dim==='taming_land') return {label:'Taming Land', text:'Explore the sanctuary, then press G at the green return portal to go back to town'};
  if(dim==='fishing_lake') return {label:'Fishing Lake', text:'Walk the docks and press G at the blue return portal to go back to town'};
  const townArrival=globalThis.BlockcraftTownArrivalGuide&&globalThis.BlockcraftTownArrivalGuide.objective
    ?globalThis.BlockcraftTownArrivalGuide.objective():null;
  if(dim==='overworld'&&townArrival)return townArrival;
  const transition=transitionRecoveryAction();
  const deferTransition=shouldDeferTransitionAction(transition,{story:!!quest||!!serverObjectiveBySource('story','manhunt'),job:!!jobContract});
  if(transition&&!deferTransition){
    if(transition.type==='continue_panel') return {label:'Reward Pending', text:'Continue the open reward panel to unlock the next step'};
    if(transition.type==='choose_job'&&progressionFocus!=='first_d_gate'&&progressionFocus!=='c_rank_climb'&&progressionFocus!=='b_rank_pressure'&&progressionFocus!=='next_adventurer_contract') return {label:'Job Tutorial Choice', text:'Choose a first job tutorial, choose later, or open the Job Board'};
    if(transition.type==='choose_path') return {label:'Path Choice', text:'Choose a combat path to unlock your first ability'};
    if(transition.type==='start_awakening') return {label:'Ability Awakening', text:'Start ability training for your chosen path'};
    if(transition.type==='use_ability') return {label:'Ability Training', text:combatState.abilityTrainingUsed?'Finish the training meadow':'Use your Q ability in the training meadow'};
  }
  const job=jobContractObjective();
  if(job) return job;
  const server=serverObjectiveHud();
  if(server) return server;
  const guided=tutorialObjective();
  if(guided) return guided;
  const story=questObjective();
  if(story) return story;
  const guild=guildContractObjective();
  if(guild) return guild;
  const promotion=ONBOARD.firstPromotionObjective();
  if(promotion) return promotion;
  if(JOBS_ENABLED&&dim==='overworld' && Math.hypot(player.pos.x-HUB.jobs.x, player.pos.z-HUB.jobs.z)<6)
    return {label:'Current Goal', text:'Choose or claim work at the Job Board'};
  if(dim==='overworld' && Math.hypot(player.pos.x-HUB.quarry.x, player.pos.z-HUB.quarry.z)<7)
    return {label:'Current Goal', text:'Speak with Garrik for miner work'};
  if(dim==='overworld' && Math.hypot(player.pos.x-HUB.farm.x, player.pos.z-HUB.farm.z)<7)
    return {label:'Current Goal', text:'Speak with Liss for farmer work'};
  if(dim==='overworld' && Math.hypot(player.pos.x-HUB.shrine.x, player.pos.z-HUB.shrine.z)<9)
    return {label:'Current Goal', text:inMeditationSpot()?'Meditate with G / right-click':'Stand inside the Meditation Hall to meditate'};
  if(dim==='overworld' && HUB.tamingPortal && Math.hypot(player.pos.x-HUB.tamingPortal.x, player.pos.z-HUB.tamingPortal.z)<7)
    return {label:'Current Goal', text:'Press G at the Taming Land portal to visit the dragon and familiar sanctuary'};
  if(dim==='overworld' && HUB.fishingPortal && Math.hypot(player.pos.x-HUB.fishingPortal.x, player.pos.z-HUB.fishingPortal.z)<7)
    return {label:'Current Goal', text:'Press G at the Fishing Lake portal to visit the peaceful fishing room'};
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
  if(dim==='overworld'&&quest&&quest.type==='gate'){
    const rank=Math.max(0,quest.gateRank|0), gates=NET.room&&NET.room.state&&NET.room.state.gates;
    let target=null;
    if(gates&&gates.forEach)gates.forEach(g=>{
      if(!g||!g.active||(g.rank|0)!==rank)return;
      const d=Math.hypot(g.x-player.pos.x,g.z-player.pos.z);
      if(!target||d<target.d)target={label:rank===0?'First E-rank Gate':'Gate',x:g.x,z:g.z,d};
    });
    if(target)return {label:target.label,x:target.x,z:target.z};
  }
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
  if(progressionFocus==='first_land_claim'||progressionFocus==='first_claim_expand'||progressionFocus==='first_base_setup'||progressionFocus==='first_homestead_upgrade') return {label:progressionFocus==='first_homestead_upgrade'?'Homestead':'Claim Land',x:TOWN.TC,z:TOWN.TC+TOWN.HS+10};
  if(progressionFocus==='first_profession_contract'){
    const handoff=professionHandoffObjective();
    return handoff&&handoff.target ? handoff.target : {label:'Board',x:HUB.jobs.x,z:HUB.jobs.z};
  }
  if(progressionFocus==='c_rank_specialization')return {label:'Aegis',x:HUB.aegisApproach.x,z:HUB.aegisApproach.z};
  if(progressionFocus==='b_rank_pressure'){
    const midgame=midgameObjectiveLine();
    if(midgame&&midgame.target)return midgame.target;
    const breach=overworldActivity&&overworldActivity.gateBreach;
    if(breach)return {label:'Breach',x:breach.x,z:breach.z};
    if(gate)return {label:'Gate',x:gate.x||TOWN.TC,z:gate.z||TOWN.TC};
    return {label:'Board',x:HUB.jobs.x,z:HUB.jobs.z};
  }
  if(progressionFocus==='e_rank_climb'||progressionFocus==='first_promotion_job'||progressionFocus==='first_promotion_contract'||progressionFocus==='c_rank_climb'||progressionFocus==='next_adventurer_contract'){
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
  const midgame=midgameObjectiveLine();
  if(midgame&&midgame.target)return midgame.target;
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
  if(progress.maxRank)return {label:'Hunter Rank',value:'S-Rank - Deity at S-Rank Lv 10'};
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
function firstGateQuestDungeon(){
  return dim==='dungeon'&&dungeon&&((dungeon.rank|0)===0)&&(quest&&quest.giver==='Mara Vale'&&quest.title==='The First Gate');
}
function firstGateDungeonActive(status){
  return firstGateQuestDungeon()&&status;
}
function dungeonObjectiveState(status,me,chestCount){
  const firstGate=firstGateDungeonActive(status);
  if(status.wipe||status.party.length>0&&status.aliveCount===0)return {cls:'danger',label:firstGate?'First Gate Failed':'Party Wiped',text:firstGate?'You are safe. Return to town, restock if needed, and try the first Gate again.':'Return to town, repair, and challenge another Gate.',target:status.exit,targetLabel:'Exit'};
  if(me&&me.spirit)return {cls:'danger',label:'Spirit Form',text:firstGate?'Stay for credit if the party can still finish, or return safely and retry.':'Stay as spirit for party credit, or return to town now to repair and restock.',target:nearestDungeonAlly(status,me),targetLabel:'Ally'};
  if(me&&me.downed)return {cls:'danger',label:'Downed',text:firstGate?'Hold position. If the run fails, you keep your gear and can retry.':'Hold position while allies finish the fight or return safely.',target:nearestDungeonAlly(status,me),targetLabel:'Ally'};
  if(status.cleared){
    const chest=chestCount>0?nearestDungeonChest(status):null;
    return {cls:'cleared',label:firstGate?'First Gate Cleared':'Boss Defeated',text:firstGate?(chestCount>0?'First Gate cleared. Open optional chests, then exit and return to Mara.':'First Gate cleared. Exit through the portal and return to Mara for the next step.'):(chestCount>0?'Boss down. Open remaining chests, then exit through the portal.':'Boss down. Exit through the portal to return safely.'),target:chest||status.exit,targetLabel:chest?'Chest':'Exit'};
  }
  if(status.bossAlive){
    if(status.bossGateState==='locked')return {cls:'active',label:firstGate?'First Gate: Clear Rooms':'Boss Locked',text:firstGate?'Move room to room. Defeat enemies to open the boss route.':'Clear rooms to open the boss route.',target:status.bossRoom,targetLabel:'Boss'};
    const contrib=Math.max(0,me&&me.contribution|0);
    if(contrib<=0)return {cls:'active',label:firstGate?'First Gate: Boss Open':'Boss Open',text:firstGate?'Hit the boss at least once, then stay near the fight to earn the clear.':'Hit the boss to qualify for reward, then stay near the fight.',target:status.bossRoom,targetLabel:'Boss'};
    return {cls:'active',label:firstGate?'First Gate: Finish Boss':'Boss Open',text:firstGate?'You are reward eligible. Finish the boss, then return to Mara.':'Reward eligible. Stay near the boss and finish the fight.',target:status.bossRoom,targetLabel:'Boss'};
  }
  const chest=chestCount>0?nearestDungeonChest(status):null;
  return {cls:'active',label:firstGate?'First Gate: Exit':'Regroup',text:firstGate?(chestCount>0?'Boss down. Open optional chests, then exit and return to Mara.':'Boss down. Exit through the portal and return to Mara.'):(chestCount>0?'Boss down. Open remaining chests, then exit through the portal.':'Boss down. Exit through the portal to complete the run.'),target:chest||status.exit,targetLabel:chest?'Chest':'Exit'};
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
  let partyHTML='',partyHidden=false;
  if(!status||!Array.isArray(status.party)){
    partyHidden=true;
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
    partyHTML='<div class="partytitle">GATE PARTY · F1 GROUP · F2 BOSS · F3 LOOT</div>'+summary+warning+status.party.map(member=>{
      let distance=0;
      if(member.sid!==mine){const remote=NET.remotes[member.sid],ref=remote&&remote.ref,pos=ref||member;distance=Number.isFinite(pos.x)&&Number.isFinite(pos.z)?Math.round(Math.hypot((pos.x||0)-player.pos.x,(pos.z||0)-player.pos.z)):0;}
      const hp=Math.max(0,member.hp|0),max=Math.max(1,member.maxHp|0),pct=Math.max(0,Math.min(100,hp/max*100));
      const state=member.spirit?'SPIRIT':member.downed?'DOWNED':'ALIVE';
      const stateClass=member.spirit?' spirit':member.downed?' downed':'';
      const where=member.sid===mine?'YOU':(member.spirit?'SPIRIT · ':'')+distance+'m';
      return '<div class="partycard'+stateClass+'"><div class="partyline"><b>'+escHTML(member.name||'Hunter')+'</b><small>'+escHTML(member.role||'Striker')+' · '+where+'</small></div><div class="partyhp"><i style="width:'+pct+'%"></i></div><div class="partyline"><small>'+state+(member.spirit?' · bound in place':member.downed?'':' · '+hp+'/'+max+' HP')+'</small><span class="partycontrib">Boss '+Math.max(0,member.contribution|0)+'</span></div></div>';
    }).join('')+returnedCard;
    updateDungeonSpiritMarkers(status,now);
  }
  if(partyHTML!==lastDungeonPartyHTML||partyHidden!==lastDungeonPartyHidden){
    lastDungeonPartyHTML=partyHTML;lastDungeonPartyHidden=partyHidden;
    dungeonPartyEl.classList.toggle('hidden',partyHidden);
    if(dungeonPartyEl.innerHTML!==partyHTML)dungeonPartyEl.innerHTML=partyHTML;
  }
  if(!activeDungeonPing||dim!=='dungeon'||now>=activeDungeonPing.expires){
    activeDungeonPing=null;dungeonPingGroup.visible=false;dungeonPingEl.classList.add('hidden');return;
  }
  dungeonPingGroup.visible=true;dungeonPingGroup.position.set(activeDungeonPing.x||0,(activeDungeonPing.y||8)+.1,activeDungeonPing.z||0);
  const pulse=1+Math.sin(now*.009)*.18;dungeonPingRing.scale.setScalar(pulse);dungeonPingRing.rotation.z=now*.001;
}
function updateOverworldActivityTracker(){
  if(!activityTrackerEl)return;
  if(tutorialRoomHudSuppressed()||dim!=='overworld'||onboardingActive){displayedRegionalOpportunity=null;activityTrackerEl.classList.add('hidden');activityTrackerEl.innerHTML='';return;}
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
    const target=quest.source==='guardian'?HUB.aegisApproach:quest.giver==='Mara Vale'?HUB.guide:null;
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
  const wildTrack=locked&&!uiOpen&&!statOpen&&!qOpen&&!claimMode&&!onboardingActive&&globalThis.BlockcraftTamingLandTracks&&globalThis.BlockcraftTamingLandTracks.nearby&&globalThis.BlockcraftTamingLandTracks.nearby();
  if(wildTrack){
    encounterPromptEl.classList.remove('danger','hidden');
    encounterPromptEl.innerHTML='<span class="key">G</span><b>Wild Pet Tracks</b><small>'+escHTML(wildTrack.label||'Read tracks')+' - press G to inspect</small>';
    return;
  }
  const fishingPrompt=nearbyFishingWaterPrompt();
  if(fishingPrompt){
    encounterPromptEl.classList.remove('danger','hidden');
    encounterPromptEl.innerHTML='<span class="key">'+escHTML(fishingPrompt.key)+'</span><b>'+escHTML(fishingPrompt.title)+'</b><small>'+escHTML(fishingPrompt.small)+'</small>';
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
let nextFishingLakeBoundsDebugAt=0;
function fishingLakeRoomDef(){
  return worldState&&worldState.FISHING_LAKE||{x:345,z:925,G:18,R:62,spawn:{dx:0,dz:-23}};
}
function fishingLakeSafePoint(){
  const lake=fishingLakeRoomDef(),spawn=lake&&lake.spawn||{dx:0,dz:-23};
  return {x:(lake&&lake.x||345)+(spawn.dx||0)+.5,y:(lake&&lake.G||18)+1.05,z:(lake&&lake.z||925)+(spawn.dz||0)+.5};
}
function enforceFishingLakeBounds(now=performance.now()){
  if(dim!=='fishing_lake'||!player||!player.pos)return false;
  const lake=fishingLakeRoomDef();
  const lx=Number(lake&&lake.x)||345,lz=Number(lake&&lake.z)||925,lg=Number(lake&&lake.G)||18,lr=Number(lake&&lake.R)||62;
  const dx=player.pos.x-lx,dz=player.pos.z-lz;
  const outside=Math.hypot(dx,dz)>lr+10||player.pos.y<lg-4||player.pos.y>lg+34;
  if(!outside)return false;
  const before={x:+player.pos.x.toFixed(3),y:+player.pos.y.toFixed(3),z:+player.pos.z.toFixed(3),yaw:Number.isFinite(player.yaw)?+player.yaw.toFixed(4):null,pitch:Number.isFinite(player.pitch)?+player.pitch.toFixed(4):null};
  const safe=fishingLakeSafePoint();
  player.pos.set(safe.x,safe.y,safe.z);
  if(player.vel)player.vel.set(0,0,0);
  player.yaw=Math.PI;
  player.pitch=0;
  if(combatApi&&combatApi.suppressMouseLook)combatApi.suppressMouseLook(900,'fishingLakeBounds');
  if(now>=nextFishingLakeBoundsDebugAt){
    nextFishingLakeBoundsDebugAt=now+1200;
    fishingCameraDebug('bounds-rescue',{before,safe,room:{x:lx,z:lz,g:lg,r:lr}},now);
  }
  return true;
}
function equippedFishingRod(){
  const slot=Math.max(0,Math.min(8,(combatState&&combatState.selectedSlot)|0));
  const held=inv&&inv[slot];
  return !!(held&&held.id===I.FISHING_ROD);
}
function fishingRodHotbarSlot(){
  if(!inv)return -1;
  for(let s=0;s<9;s++)if(inv[s]&&inv[s].id===I.FISHING_ROD)return s;
  return -1;
}
function ensureFishingRodEquipped(){
  if(equippedFishingRod())return true;
  const slot=fishingRodHotbarSlot();
  if(slot<0)return false;
  if(typeof selectSlot==='function')selectSlot(slot);
  else if(combatState)combatState.selectedSlot=slot;
  return equippedFishingRod();
}
function nearbyFishingWaterPrompt(){
  if(globalThis.BlockcraftFishing&&globalThis.BlockcraftFishing.active&&globalThis.BlockcraftFishing.active()){
    return globalThis.BlockcraftFishing.prompt();
  }
  if(!locked||uiOpen||statOpen||qOpen||claimMode||onboardingActive)return null;
  if(dim!=='fishing_lake'&&dim!=='overworld')return null;
  const water=nearbyFishingWaterInfo(12);
  if(!water)return null;
  const ownsRod=typeof countItem==='function'&&countItem(I.FISHING_ROD)>0;
  if(!ownsRod)return {key:'CRAFT',title:'Need a Fishing Rod',small:'Craft one at a Crafting Table: 3 sticks + 1 wheat.'};
  if(fishingRodHotbarSlot()<0)return {key:'ROD',title:'Equip Fishing Rod',small:'Move the rod into your hotbar (1-9) to fish.'};
  return {key:'G',title:'Cast Fishing Rod',small:'Aim at the water, then move the target with WASD. Uses stamina.'};
}
function nearbyFishingWaterInfo(radius=7){
  if(dim!=='fishing_lake'&&dim!=='overworld')return null;
  const px=Math.floor(player.pos.x),py=Math.floor(player.pos.y),pz=Math.floor(player.pos.z);
  let best=null;
  const yaw=Number(player.yaw)||0,fx=Math.sin(yaw),fz=Math.cos(yaw);
  for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++){
    const flat=dx*dx+dz*dz;
    if(flat>radius*radius)continue;
    for(let dy=-4;dy<=2;dy++){
      if(getB(px+dx,py+dy,pz+dz)!==B.WATER)continue;
      const wx=px+dx+.5,wz=pz+dz+.5,wy=py+dy+.5;
      const dist=Math.hypot(wx-player.pos.x,wz-player.pos.z);
      const align=dist>.01?((wx-player.pos.x)/dist*fx+(wz-player.pos.z)/dist*fz):0;
      const depth=Math.max(1,Math.min(5,player.pos.y-wy+2));
      const score=(1-Math.abs(dist-5.2)/7)+align*.32+depth*.05+(dim==='fishing_lake'?.18:0);
      if(!best||score>best.score)best={x:wx,y:wy,z:wz,dist,align,depth,score};
      break;
    }
  }
  return best&&best.dist<=radius+.6?best:null;
}
const FISHING_FISH=[
  {id:'school',name:'School Silverfin',chance:.34,hook:950,stamina:48,power:.65,reel:.95,reward:1,style:'easy to hook, easily frightened'},
  {id:'sprinter',name:'River Sprinter',chance:.20,hook:780,stamina:72,power:1.18,reel:1.08,reward:1,style:'sudden races away'},
  {id:'diver',name:'Deep Diver',chance:.15,hook:860,stamina:82,power:1.05,reel:.85,reward:2,style:'pulls hard downward'},
  {id:'heavy',name:'Old Heavy Carp',chance:.13,hook:1050,stamina:105,power:1.28,reel:.62,reward:2,style:'slow but powerful'},
  {id:'erratic',name:'Erratic Flashfish',chance:.10,hook:690,stamina:64,power:.95,reel:1.2,reward:2,style:'changes direction repeatedly'},
  {id:'minnow',name:'Glass Minnow',chance:.16,hook:1000,stamina:38,power:.5,reel:1.0,reward:1,style:'tiny and skittish'},
  {id:'perch',name:'Sunset Perch',chance:.11,hook:820,stamina:70,power:1.0,reel:.9,reward:2,style:'steady, stubborn pull'},
  {id:'ambusher',name:'Ambusher Pike',chance:.06,hook:520,stamina:88,power:1.45,reel:.82,reward:3,style:'calm, then one violent escape'},
  {id:'bottom',name:'Rockbelly Bottom-Dweller',chance:.02,hook:900,stamina:96,power:1.12,reel:.72,reward:3,style:'dives toward rocks'},
  {id:'eel',name:'Shadow Eel',chance:.05,hook:700,stamina:92,power:1.3,reel:1.15,reward:3,style:'whips side to side'},
  {id:'goldfin',name:'Goldscale Titan',chance:.02,hook:600,stamina:120,power:1.6,reel:.68,reward:4,style:'a legendary, relentless fighter'},
  {id:'sturgeon',name:'Moonlit Sturgeon',chance:.01,hook:760,stamina:135,power:1.5,reel:.6,reward:4,style:'ancient, immensely heavy'}
];
const fishingState={phase:'idle',fish:null,startedAt:0,nextAt:0,biteAt:0,hookUntil:0,castQuality:0,tension:0,progress:0,fishStamina:0,burstAt:0,biteCue:'',lastCueAt:0,earlyHooks:0,reelHeld:false,landingUntil:0,qualityBonus:0,target:null,castVisualStart:0,aimOrigin:null};
let fishingHudEl=null;
let fishingTargetScreenEl=null;
let fishingVisuals=null;
let lastFishingTargetDebugAt=0;
function fishingHud(){
  if(fishingHudEl)return fishingHudEl;
  fishingHudEl=document.createElement('div');
  fishingHudEl.id='fishinghud';
  fishingHudEl.className='hidden';
  fishingHudEl.style.cssText='position:fixed;left:50%;bottom:292px;transform:translateX(-50%);z-index:78;min-width:min(560px,80vw);max-width:80vw;padding:14px 18px;border:1px solid rgba(95,210,255,.65);border-radius:14px;background:rgba(4,13,24,.72);box-shadow:0 0 22px rgba(34,211,238,.18);color:#e8fbff;font-family:inherit;pointer-events:none;text-shadow:0 2px 2px #000;';
  document.body.appendChild(fishingHudEl);
  return fishingHudEl;
}
function setFishingHud(html){
  const el=fishingHud();
  const show=!!html;
  el.classList.toggle('hidden',!show);
  document.body.classList.toggle('fishing-placement-active',fishingState.phase==='aim');
  if(show&&el.innerHTML!==html)el.innerHTML=html;
}
function fishingTargetScreenHud(){
  if(fishingTargetScreenEl)return fishingTargetScreenEl;
  fishingTargetScreenEl=document.createElement('div');
  fishingTargetScreenEl.id='fishingtargethud';
  fishingTargetScreenEl.className='hidden';
  fishingTargetScreenEl.style.cssText='position:fixed;z-index:92;display:flex;flex-direction:column;align-items:center;gap:3px;color:#8af2ff;font-size:12px;font-weight:700;letter-spacing:1.5px;text-align:center;pointer-events:none;transform:translate(-50%,-50%);filter:drop-shadow(0 0 7px rgba(34,211,238,.95));';
  fishingTargetScreenEl.innerHTML='<div style="font-size:40px;line-height:.7;text-shadow:0 0 10px #22d3ee">◎</div><div class="fishingtargetlabel" style="padding:3px 9px;border-radius:999px;background:rgba(3,12,22,.72);border:1px solid rgba(34,211,238,.86);text-shadow:0 2px 0 #000;white-space:nowrap">CAST TARGET</div>';
  document.body.appendChild(fishingTargetScreenEl);
  return fishingTargetScreenEl;
}
function setFishingTargetScreenHud(show,x=0,y=0,text='CAST TARGET'){
  const el=fishingTargetScreenHud();
  const shouldShow=show&&fishingState.phase==='aim';
  el.classList.toggle('hidden',!shouldShow);
  if(!shouldShow)return;
  const margin=26;
  const clampedX=Math.max(margin,Math.min(innerWidth-margin,Number(x)||innerWidth*.5));
  const clampedY=Math.max(margin,Math.min(innerHeight-margin,Number(y)||innerHeight*.5));
  el.style.left=Math.round(clampedX)+'px';
  el.style.top=Math.round(clampedY)+'px';
  const label=el.querySelector('.fishingtargetlabel');
  if(label&&label.textContent!==text)label.textContent=text;
}
function fishingTargetDebug(reason,extra={},now=performance.now()){
  const payload={reason,at:Date.now(),phase:fishingState.phase,target:fishingState.target?{x:+fishingState.target.x.toFixed(3),y:+fishingState.target.y.toFixed(3),z:+fishingState.target.z.toFixed(3)}:null,dim,dgn:NET&&NET.dgn||'',extra};
  try{globalThis.BlockcraftTrace&&globalThis.BlockcraftTrace('fishing.target-debug',payload);}catch(e){}
  if(globalThis.BlockcraftVerboseDebug)console.warn('[bc-fishing-target]',payload);
  return payload;
}
// ---- Live on-screen fishing debug (target + rod). On by default during a cast; set
// globalThis.BlockcraftFishingDebug=false to hide, =true to force. Data also at BlockcraftFishingDebugData.
let fishingDebugEl=null;
const _fishFwd=new THREE.Vector3();
function fishFmt3(v,p=1){return '('+v.x.toFixed(p)+', '+v.y.toFixed(p)+', '+v.z.toFixed(p)+')';}
function fishingDebugHud(){
  if(fishingDebugEl)return fishingDebugEl;
  fishingDebugEl=document.createElement('div');
  fishingDebugEl.id='fishingdebughud';
  fishingDebugEl.className='hidden';
  fishingDebugEl.style.cssText='position:fixed;left:10px;bottom:10px;z-index:96;max-width:520px;padding:8px 11px;border:1px solid rgba(34,211,238,.55);border-radius:8px;background:rgba(2,9,16,.86);color:#a9edff;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;line-height:1.5;white-space:pre;pointer-events:none;text-shadow:0 1px 0 #000;';
  document.body.appendChild(fishingDebugEl);
  return fishingDebugEl;
}
function updateFishingDebugHud(now){
  const active=fishingState.phase&&fishingState.phase!=='idle'&&fishingState.phase!=='cooldown';
  const auth=globalThis.BlockcraftAuthUI||globalThis.AUTH_UI;
  const isAdmin=!!(auth&&auth.isAdminAccount&&auth.isAdminAccount());
  // Shows during a cast for admins by default; anyone can force with BlockcraftFishingDebug=true, or hide with =false.
  const on=active&&globalThis.BlockcraftFishingDebug!==false&&(globalThis.BlockcraftFishingDebug===true||isAdmin);
  const el=fishingDebugHud();
  el.classList.toggle('hidden',!on);
  if(!on)return;
  const R=180/Math.PI, t=fishingState.target;
  const fwd=camera.getWorldDirection(_fishFwd).clone();
  let d3=0,dh=0,yawDelta=0,pitchToT=0,onScreen=false,sx=0,sy=0,pz=0;
  if(t){
    const dx=t.x-camera.position.x,dy=t.y-camera.position.y,dz=t.z-camera.position.z;
    d3=Math.hypot(dx,dy,dz); dh=Math.hypot(dx,dz);
    const fyaw=Math.atan2(fwd.x,fwd.z),tyaw=Math.atan2(dx,dz);
    yawDelta=Math.atan2(Math.sin(tyaw-fyaw),Math.cos(tyaw-fyaw))*R;
    pitchToT=Math.atan2(dy,dh)*R;
    const p=new THREE.Vector3(t.x,t.y+1.15,t.z).project(camera);
    pz=p.z; onScreen=p.z>-1&&p.z<1&&Math.abs(p.x)<=1&&Math.abs(p.y)<=1;
    sx=Math.round((p.x*.5+.5)*innerWidth); sy=Math.round((-p.y*.5+.5)*innerHeight);
  }
  const v=makeFishingVisuals(), rodTip=fishingRodTipWorld();
  const side=yawDelta>3?('RIGHT '+Math.round(yawDelta)+'°'):yawDelta<-3?('LEFT '+Math.round(-yawDelta)+'°'):'AHEAD';
  const lines=[
    'FISH DEBUG  phase='+fishingState.phase+'  dim='+dim,
    'player  '+fishFmt3(player.pos)+'  yaw '+(player.yaw*R).toFixed(0)+'°  pitch '+(player.pitch*R).toFixed(0)+'°',
    'camera  '+fishFmt3(camera.position)+'  fwd '+fishFmt3(fwd,2),
    t?('target  '+fishFmt3(t)+'  dist '+d3.toFixed(1)+'m (flat '+dh.toFixed(1)+')'):'target  <none>',
    t?('  vs look:  '+side+'   pitch-to-target '+pitchToT.toFixed(0)+'°'):'',
    t?('  project: z='+pz.toFixed(2)+' screen '+sx+','+sy+'  '+(onScreen?'ON-SCREEN':'OFF-SCREEN (behind='+(pz>1)+')')):'',
    'targetGrp vis='+!!(v.targetGroup&&v.targetGroup.visible)+'   reticle='+(document.getElementById('fishingtargethud')&&!document.getElementById('fishingtargethud').classList.contains('hidden')),
    'rod     grpVis='+!!(v.rodGroup&&v.rodGroup.visible)+'   tip '+fishFmt3(rodTip)
  ].filter(Boolean);
  const text=lines.join('\n');
  if(el.textContent!==text)el.textContent=text;
  globalThis.BlockcraftFishingDebugData={phase:fishingState.phase,target:t?{x:+t.x.toFixed(2),y:+t.y.toFixed(2),z:+t.z.toFixed(2)}:null,distM:+d3.toFixed(2),yawDeltaDeg:+yawDelta.toFixed(1),pitchDeg:+pitchToT.toFixed(1),onScreen,screen:{x:sx,y:sy},rodGrpVisible:!!(v.rodGroup&&v.rodGroup.visible),rodTip:{x:+rodTip.x.toFixed(2),y:+rodTip.y.toFixed(2),z:+rodTip.z.toFixed(2)}};
}
function fishByCastQuality(q){
  let roll=Math.random()*(.72+q*.46),acc=0;
  for(const f of FISHING_FISH){acc+=f.chance*(f.reward>1?(.65+q*.65):1);if(roll<=acc)return f;}
  return FISHING_FISH[0];
}
function fishingCastQuality(water){
  const distanceScore=1-Math.min(1,Math.abs((water&&water.dist||3)-5.5)/5.5);
  const aimScore=Math.max(0,Math.min(1,((water&&water.align||0)+1)/2));
  const depthScore=Math.max(0,Math.min(1,(water&&water.depth||1)/4));
  const rippleLuck=Math.random()<(.18+distanceScore*.16)?1:0;
  return Math.max(.08,Math.min(1,distanceScore*.42+aimScore*.3+depthScore*.16+rippleLuck*.12));
}

const FISHING_CAST_PLACE_RADIUS=12;
function fishingWaterAtPoint(x,z,search=1.6){
  if(dim!=='fishing_lake'&&dim!=='overworld')return null;
  const px=Math.floor(x),pz=Math.floor(z),py=Math.floor(player.pos.y),r=Math.max(1,Math.ceil(search));
  let best=null;
  const yaw=Number(player.yaw)||0,fx=Math.sin(yaw),fz=Math.cos(yaw);
  for(let dx=-r;dx<=r;dx++)for(let dz=-r;dz<=r;dz++){
    if(dx*dx+dz*dz>(search+.75)*(search+.75))continue;
    for(let dy=-5;dy<=3;dy++){
      if(getB(px+dx,py+dy,pz+dz)!==B.WATER)continue;
      const wx=px+dx+.5,wz=pz+dz+.5,wy=py+dy+.5;
      const dist=Math.hypot(wx-player.pos.x,wz-player.pos.z);
      const align=dist>.01?((wx-player.pos.x)/dist*fx+(wz-player.pos.z)/dist*fz):0;
      const depth=Math.max(1,Math.min(5,player.pos.y-wy+2));
      const close=Math.hypot(wx-x,wz-z);
      const score=1-close*.55+depth*.05;
      if(!best||score>best.score)best={x:wx,y:wy,z:wz,dist,align,depth,score};
      break;
    }
  }
  return best;
}
// Cast where the player is LOOKING: march the camera's real forward ray and return the first water
// cell it crosses. (The camera faces (-sin,-cos); nearbyFishingWaterInfo uses (+sin,+cos), which is
// why the old placement landed ~90-170° off the crosshair.)
function fishingLookWater(maxDist=20){
  if(dim!=='fishing_lake'&&dim!=='overworld')return null;
  const fwd=camera.getWorldDirection(new THREE.Vector3());
  const ox=camera.position.x,oy=camera.position.y,oz=camera.position.z;
  const hit=(gx,gy,gz)=>{
    const wx=gx+.5,wy=gy+.5,wz=gz+.5;
    const dist=Math.hypot(wx-player.pos.x,wz-player.pos.z);
    return {x:wx,y:wy,z:wz,dist,align:1,depth:Math.max(1,Math.min(5,player.pos.y-wy+2))};
  };
  // Walk the crosshair ray across the lake; the water surface sits a few blocks below the camera, so
  // at each step drop straight down to find the first water surface the crosshair passes over.
  // A solid block above water in a column means it's land/dock — skip it and keep marching.
  for(let d=1.0;d<=maxDist;d+=0.4){
    const gx=Math.floor(ox+fwd.x*d),ry=oy+fwd.y*d,gz=Math.floor(oz+fwd.z*d);
    const top=Math.floor(ry);
    if(getB(gx,top,gz)===B.WATER)return hit(gx,top,gz);
    for(let gy=top;gy>=top-8;gy--){
      const b=getB(gx,gy,gz);
      if(b===B.WATER)return hit(gx,gy,gz);
      if(isSolid(b))break;
    }
  }
  return null;
}
function beginFishingCastPlacement(){
  if(!locked||uiOpen||statOpen||qOpen||claimMode||onboardingActive)return false;
  const strayQ=document.getElementById('qwin');
  if(strayQ&&!strayQ.classList.contains('hidden')){
    strayQ.classList.add('hidden');
    document.body.classList.remove('game-modal-open');
    fishingTargetDebug('aim.closed-stray-qwin',{reason:'fishing-start'});
  }
  if(!ensureFishingRodEquipped())return false;
  const gate=nearbyFishingWaterInfo(12);
  if(!gate)return false;
  const water=fishingLookWater()||gate; // start the target where you're aiming; fall back to nearest water
  if(!water)return false;
  const now=performance.now();
  Object.assign(fishingState,{phase:'aim',fish:null,startedAt:now,nextAt:0,biteAt:0,hookUntil:0,castQuality:fishingCastQuality(water),tension:0,progress:0,fishStamina:0,burstAt:0,biteCue:'Move the target with WASD. Press G to cast, Escape to cancel.',lastCueAt:0,earlyHooks:0,reelHeld:false,landingUntil:0,qualityBonus:0,target:{x:water.x,y:water.y+.18,z:water.z},aimOrigin:{x:player.pos.x,z:player.pos.z},aimCursor:{x:water.x,z:water.z},castVisualStart:now});
  if(combatApi&&combatApi.suppressMouseLook)combatApi.suppressMouseLook(900,'fishingAim');
  if(player&&player.vel)player.vel.set(0,0,0);
  fishingTargetDebug('aim.begin',{water:{x:+water.x.toFixed(3),y:+water.y.toFixed(3),z:+water.z.toFixed(3),dist:+water.dist.toFixed(3)}});
  showName('Choose Cast Spot');
  return true;
}
function confirmFishingCast(){
  if(fishingState.phase!=='aim')return false;
  const water=fishingWaterAtPoint(fishingState.target&&fishingState.target.x||player.pos.x,fishingState.target&&fishingState.target.z||player.pos.z,1.7);
  if(!water){showName('Place target on water');return true;}
  if(sp<4){showName('Too exhausted to cast');sysMsg('Fishing needs a little stamina. Rest before casting.','minor');return true;}
  sp=Math.max(0,sp-4); renderBars();
  const q=fishingCastQuality(water),fish=fishByCastQuality(q),now=performance.now();
  Object.assign(fishingState,{phase:'wait',fish,startedAt:now,nextAt:now+500+Math.random()*850,biteAt:now+1250+Math.random()*1900-q*650,hookUntil:0,castQuality:q,tension:28,progress:0,fishStamina:fish.stamina,burstAt:now+900+Math.random()*1200,biteCue:'Line settles...',lastCueAt:0,earlyHooks:0,reelHeld:false,landingUntil:0,qualityBonus:0,target:{x:water.x,y:water.y+.18,z:water.z},aimOrigin:null,aimCursor:null,castVisualStart:now});
  setFishingTargetScreenHud(false);
  fishingTargetDebug('aim.confirm',{quality:+q.toFixed(3),fish:fish&&fish.id});
  showName(q>.78?'Perfect cast':'Cast');
  if(SFX&&SFX.splash)SFX.splash(false);
  burst(water.x,water.y+.25,water.z,[.35,.72,1],8+Math.floor(q*10),1.4,1.1,.35);
  return true;
}
function cancelFishingPlacement(){
  if(fishingState.phase!=='aim')return false;
  Object.assign(fishingState,{phase:'idle',fish:null,target:null,aimOrigin:null,aimCursor:null,biteCue:'',castQuality:0});
  document.body.classList.remove('fishing-placement-active');
  setFishingHud('');
  setFishingTargetScreenHud(false);
  fishingTargetDebug('aim.cancel');
  showName('Cast cancelled');
  return true;
}
function updateFishingPlacementTarget(dt){
  if(fishingState.phase!=='aim')return;
  if(player&&player.vel)player.vel.set(0,0,0);
  const f=(keys.KeyW?1:0)-(keys.KeyS?1:0),s=(keys.KeyD?1:0)-(keys.KeyA?1:0);
  if(!f&&!s)return;
  const origin=fishingState.aimOrigin||{x:player.pos.x,z:player.pos.z};
  // The visible target snaps to a water block each frame, so movement is accumulated on a
  // separate free-floating cursor; snapping the cursor itself would freeze WASD in place.
  if(!fishingState.aimCursor){
    const t=fishingState.target;
    fishingState.aimCursor=t?{x:t.x,z:t.z}:{x:origin.x,z:origin.z};
  }
  const yaw=Number(player.yaw)||0,sin=Math.sin(yaw),cos=Math.cos(yaw),speed=((keys.ShiftLeft||keys.ShiftRight)?7.2:4.6)*dt;
  let cx=fishingState.aimCursor.x+(sin*f+cos*s)*speed,cz=fishingState.aimCursor.z+(cos*f-sin*s)*speed;
  const dx=cx-origin.x,dz=cz-origin.z,dist=Math.hypot(dx,dz);
  if(dist>FISHING_CAST_PLACE_RADIUS){cx=origin.x+dx/dist*FISHING_CAST_PLACE_RADIUS;cz=origin.z+dz/dist*FISHING_CAST_PLACE_RADIUS;}
  fishingState.aimCursor={x:cx,z:cz};
  const water=fishingWaterAtPoint(cx,cz,2.4);
  if(water){
    fishingState.target={x:water.x,y:water.y+.18,z:water.z};
    fishingState.castQuality=fishingCastQuality(water);
    fishingState.biteCue='Target set: '+Math.round(water.dist)+'m · quality '+Math.round(fishingState.castQuality*100)+'%. G to cast · Esc to cancel.';
  }else{
    fishingState.biteCue='Off the water · move the target back over the lake.';
  }
}

function startFishingCast(){
  return beginFishingCastPlacement();
}
function hookFishing(){
  const now=performance.now();
  if(fishingState.phase==='wait'){
    fishingState.earlyHooks++;
    fishingState.tension+=16;
    fishingState.biteCue=fishingState.earlyHooks>1?'Too much noise - the fish fled.':'Small nibble - wait for the real pull.';
    if(fishingState.earlyHooks>1)loseFishing('Spooked');
    return true;
  }
  if(fishingState.phase==='bite'){
    if(now<=fishingState.hookUntil){
      fishingState.phase='fight';
      fishingState.startedAt=now;
      fishingState.nextAt=now+450;
      fishingState.burstAt=now+500+Math.random()*1200;
      fishingState.biteCue=fishingState.fish.name+' hooked - '+fishingState.fish.style;
      fishingState.tension=42+fishingState.fish.power*6;
      fishingState.progress=4+fishingState.castQuality*8;
      showName('Hook set!');
      if(SFX&&SFX.crit)SFX.crit();
    }else loseFishing('Too late');
    return true;
  }
  if(fishingState.phase==='land'){
    completeFishing();
    return true;
  }
  return false;
}
const FISH_TIER_ITEM={1:I.SMALL_FISH,2:I.RIVER_FISH,3:I.PRIZED_FISH,4:I.TROPHY_FISH};
function completeFishing(){
  const f=fishingState.fish||FISHING_FISH[0];
  const tier=Math.max(1,Math.min(4,f.reward|0));
  const count=Math.max(1,Math.min(4,f.reward+(fishingState.castQuality>.82?1:0)+(fishingState.qualityBonus>1?1:0)));
  const fishId=FISH_TIER_ITEM[tier]||I.RIVER_FISH;
  // Server-authoritative when online (keeps inventory in sync — no client-only drift); local grant
  // only as a solo/offline fallback.
  if(NET.on&&NET.room)NET.room.send('fishCatch',{tier,count});
  else if(typeof addItem==='function')addItem(fishId,count);
  showName('Landed: '+f.name);
  sysMsg('Fishing: caught <b>'+escHTML(f.name)+'</b> x'+count+' ('+escHTML(ITEMS[fishId]&&ITEMS[fishId].name||'fish')+').','good');
  Object.assign(fishingState,{phase:'cooldown',nextAt:performance.now()+900,fish:null,target:null});
  document.body.classList.remove('fishing-placement-active');
  setFishingTargetScreenHud(false);
}
function loseFishing(reason){
  const f=fishingState.fish;
  showName(reason||'Fish escaped');
  if(f)sysMsg('Fishing: '+escHTML(f.name)+' escaped. Watch tension and hook timing.','minor');
  Object.assign(fishingState,{phase:'cooldown',nextAt:performance.now()+850,fish:null,reelHeld:false,target:null});
  document.body.classList.remove('fishing-placement-active');
  setFishingTargetScreenHud(false);
}
function fishingPrompt(){
  const p=fishingState.phase,f=fishingState.fish;
  if(p==='aim')return {key:'WASD',title:'Choose Cast Spot',small:fishingState.biteCue||'Move target on water. G casts - Escape cancels.'};
  if(p==='wait')return {key:'WAIT',title:'Watch the Bobber',small:fishingState.biteCue||'Ignore small nibbles. Hook the real pull with G.'};
  if(p==='bite')return {key:'G',title:'BITE - Set Hook!',small:fishingState.biteCue||'Press G now.'};
  if(p==='fight')return {key:'F',title:'Hold F to Reel',small:'Release F when tension is high. Keep it out of red.'};
  if(p==='land')return {key:'G',title:'Land the Fish',small:'Press G to net '+(f&&f.name||'the fish')+'.'};
  return null;
}
function fishingHudHTML(){
  const p=fishingState.phase,f=fishingState.fish;
  if(p==='idle'||p==='cooldown')return '';
  if(p==='aim'){
    const q=Math.max(0,Math.min(100,(fishingState.castQuality||0)*100));
    return '<div style="display:flex;justify-content:space-between;gap:16px;align-items:center;margin-bottom:6px"><b style="letter-spacing:.16em;color:#7dd3fc">CHOOSE CAST SPOT</b><span>WASD target · G cast · Esc cancel</span></div>'+
      '<div style="font-size:12px;color:#bfdbfe;margin-bottom:7px">'+escHTML(fishingState.biteCue||'Move the glowing target with WASD.')+'</div>'+
      '<div>Cast Quality <span style="float:right">'+Math.round(q)+'%</span><div style="height:8px;background:rgba(255,255,255,.12);border-radius:999px;overflow:hidden"><i style="display:block;height:100%;width:'+q+'%;background:#22d3ee"></i></div></div>';
  }
  const tension=Math.max(0,Math.min(100,fishingState.tension));
  const progress=Math.max(0,Math.min(100,fishingState.progress));
  const fishStam=Math.max(0,Math.min(100,(fishingState.fishStamina/(f&&f.stamina||100))*100));
  const danger=tension>84?'#ef4444':tension<18?'#facc15':'#22d3ee';
  return '<div style="display:flex;justify-content:space-between;gap:16px;align-items:center;margin-bottom:8px"><b style="letter-spacing:.16em;color:#7dd3fc">'+escHTML(p==='bite'?'REAL BITE':p==='fight'?'FISH ON':p==='land'?'LANDING':'FISHING')+'</b><span>'+(f?escHTML(f.name):'')+'</span></div>'+
    '<div style="font-size:13px;color:#bfdbfe;margin-bottom:8px">'+escHTML(fishingState.biteCue||'')+'</div>'+
    '<div style="display:grid;gap:6px">'+
    '<div>Tension <span style="float:right">'+Math.round(tension)+'%</span><div style="height:8px;background:rgba(255,255,255,.12);border-radius:999px;overflow:hidden"><i style="display:block;height:100%;width:'+tension+'%;background:'+danger+'"></i></div></div>'+
    '<div>Catch Progress <span style="float:right">'+Math.round(progress)+'%</span><div style="height:8px;background:rgba(255,255,255,.12);border-radius:999px;overflow:hidden"><i style="display:block;height:100%;width:'+progress+'%;background:#34d399"></i></div></div>'+
    '<div>Fish Stamina <span style="float:right">'+Math.round(fishStam)+'%</span><div style="height:8px;background:rgba(255,255,255,.12);border-radius:999px;overflow:hidden"><i style="display:block;height:100%;width:'+fishStam+'%;background:#a78bfa"></i></div></div>'+
    '</div>';
}
function tickFishing(now,dt){
  if(fishingState.phase==='cooldown'&&now>=fishingState.nextAt){fishingState.phase='idle';document.body.classList.remove('fishing-placement-active');setFishingTargetScreenHud(false);}
  if(fishingState.phase==='aim'){
    updateFishingPlacementTarget(dt);
    tickFishingVisuals(now,dt);
    setFishingHud(fishingHudHTML());
    return;
  }
  if(fishingState.phase==='wait'){
    if(now>=fishingState.biteAt){
      fishingState.phase='bite';
      fishingState.hookUntil=now+(fishingState.fish&&fishingState.fish.hook||850);
      fishingState.biteCue=(fishingState.fish&&fishingState.fish.id)==='ambusher'?'Predator strike - hook now!':(fishingState.fish&&fishingState.fish.id)==='heavy'?'The float sinks heavily - hook now!':'The line snaps tight - hook now!';
      showName('BITE!');
    }else if(now>=fishingState.nextAt){
      const cues=['Tiny nibble... wait.','Bobber twitches sideways.','A shadow circles below.','Line taps once, not yet.'];
      fishingState.biteCue=cues[Math.floor(Math.random()*cues.length)];
      fishingState.nextAt=now+520+Math.random()*850;
      fishingState.tension=Math.max(12,fishingState.tension-2+Math.random()*4);
    }
  }else if(fishingState.phase==='bite'){
    fishingState.tension+=dt*28;
    if(now>fishingState.hookUntil)loseFishing('Missed bite');
  }else if(fishingState.phase==='fight'){
    const f=fishingState.fish||FISHING_FISH[0];
    const reeling=!!(keys&&keys.KeyF)&&sp>0;
    fishingState.reelHeld=reeling;
    const behaviour=f.id;
    if(reeling){
      const drain=(behaviour==='heavy'?7.2:behaviour==='sprinter'?6.2:5.2)*dt;
      sp=Math.max(0,sp-drain);
      fishingState.progress+=dt*(8+f.reel*9)*(fishingState.fishStamina<f.stamina*.55?1.35:.76);
      fishingState.tension+=dt*(16+f.power*15);
      fishingState.fishStamina-=dt*(7+f.reel*4);
    }else{
      fishingState.tension-=dt*(18+(fishingState.tension>78?16:0));
      fishingState.progress-=dt*(behaviour==='sprinter'?5:2.2);
      fishingState.fishStamina-=dt*2.2;
    }
    if(now>=fishingState.burstAt){
      const burstPower=f.power*(behaviour==='ambusher'&&fishingState.progress>38?2.2:behaviour==='erratic'?1.45:1);
      fishingState.tension+=12+burstPower*14;
      fishingState.progress-=behaviour==='sprinter'?9:behaviour==='bottom'?7:4;
      fishingState.biteCue=behaviour==='diver'?'It dives deep - stop reeling and let the rod absorb it.':behaviour==='sprinter'?'It sprints away - release F!':behaviour==='erratic'?'It changes direction wildly.':behaviour==='bottom'?'It pulls toward rocks - keep steady pressure.':behaviour==='heavy'?'Heavy surge - steady, not greedy.':'Sudden escape - manage tension.';
      fishingState.burstAt=now+900+Math.random()*1700;
      camShake=Math.max(camShake,.08);
    }
    fishingState.tension=Math.max(0,fishingState.tension);
    fishingState.progress=Math.max(-18,fishingState.progress);
    fishingState.fishStamina=Math.max(0,fishingState.fishStamina);
    if(fishingState.tension>104)loseFishing('Line snapped');
    else if(fishingState.progress<-12)loseFishing('Too much slack');
    else if(fishingState.progress>=100){
      fishingState.phase='land';
      fishingState.landingUntil=now+2200;
      fishingState.qualityBonus=(fishingState.tension>30&&fishingState.tension<82?1:0)+(sp>10?1:0);
      fishingState.biteCue='Fish is tired. Press G to land it with the net.';
      showName('Net it!');
    }
  }else if(fishingState.phase==='land'){
    if(now>fishingState.landingUntil)loseFishing('Lost at the net');
  }
  tickFishingVisuals(now,dt);
  setFishingHud(fishingHudHTML());
}
function makeFishingVisuals(){
  if(fishingVisuals)return fishingVisuals;
  const rodGroup=new THREE.Group();
  rodGroup.name='fishing-rod-worldspace';
  const woodMat=new THREE.MeshLambertMaterial({color:0x7c4a21});
  const wrapMat=new THREE.MeshLambertMaterial({color:0xd6b15f});
  const reelMat=new THREE.MeshLambertMaterial({color:0xd7e7f7,emissive:0x111827});
  const rod=new THREE.Mesh(new THREE.CylinderGeometry(.018,.034,1.18,8),woodMat);
  rod.position.set(0,.2,0);rod.rotation.z=-.34;
  const tip=new THREE.Mesh(new THREE.CylinderGeometry(.007,.014,.42,8),woodMat);
  tip.position.set(.21,.82,0);tip.rotation.z=-.56;
  const grip=new THREE.Mesh(new THREE.CylinderGeometry(.045,.052,.25,8),wrapMat);
  grip.position.set(-.18,-.34,0);grip.rotation.z=-.34;
  const reel=new THREE.Mesh(new THREE.TorusGeometry(.072,.012,8,18),reelMat);
  reel.position.set(-.045,-.1,.05);reel.rotation.y=Math.PI/2;
  const tipAnchor=new THREE.Object3D();tipAnchor.position.set(.36,1.03,0);
  rodGroup.add(rod,tip,grip,reel,tipAnchor);
  rodGroup.visible=false;rodGroup.frustumCulled=false;scene.add(rodGroup);
  const lineMat=new THREE.LineBasicMaterial({color:0xdaf7ff,transparent:true,opacity:.82});
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),lineMat);
  line.name='fishing-line';
  line.frustumCulled=false;
  line.visible=false;
  scene.add(line);
  const bobberGroup=new THREE.Group();
  bobberGroup.name='fishing-bobber';
  const red=new THREE.MeshLambertMaterial({color:0xef4444,emissive:0x300000});
  const white=new THREE.MeshLambertMaterial({color:0xf8fafc,emissive:0x111111});
  const bobTop=new THREE.Mesh(new THREE.SphereGeometry(.13,12,8),red);
  bobTop.scale.y=.55;bobTop.position.y=.06;
  const bobBot=new THREE.Mesh(new THREE.SphereGeometry(.12,12,8),white);
  bobBot.scale.y=.48;bobBot.position.y=-.045;
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.34,.01,8,32),new THREE.MeshBasicMaterial({color:0x67e8f9,transparent:true,opacity:.38}));
  ring.rotation.x=Math.PI/2;ring.position.y=-.08;
  bobberGroup.add(bobTop,bobBot,ring);
  bobberGroup.visible=false;
  scene.add(bobberGroup);
  const targetGroup=new THREE.Group();
  targetGroup.name='fishing-cast-target';
  const targetMat=new THREE.MeshBasicMaterial({color:0x22d3ee,transparent:true,opacity:.98,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending});
  const targetRing=new THREE.Mesh(new THREE.TorusGeometry(1.35,.09,10,80),targetMat);
  targetRing.rotation.x=Math.PI/2;
  const targetInner=new THREE.Mesh(new THREE.TorusGeometry(.5,.05,10,56),targetMat);
  targetInner.rotation.x=Math.PI/2;targetInner.position.y=.04;
  const targetBeam=new THREE.Mesh(new THREE.CylinderGeometry(.11,.34,3.6,14,1,true),targetMat);
  targetBeam.position.y=1.75;
  const targetCore=new THREE.Mesh(new THREE.SphereGeometry(.26,16,12),targetMat);
  targetCore.position.y=.1;
  targetGroup.add(targetRing,targetInner,targetBeam,targetCore);
  targetGroup.visible=false;targetGroup.frustumCulled=false;scene.add(targetGroup);
  fishingVisuals={rodGroup,rod,tip,grip,reel,tipAnchor,line,bobberGroup,ring,targetGroup,targetRing,targetInner,targetBeam,targetCore};
  return fishingVisuals;
}
function fishingRodTipWorld(){
  const v=makeFishingVisuals();
  if(v&&v.tipAnchor&&v.rodGroup&&v.rodGroup.visible){
    v.rodGroup.updateMatrixWorld(true);
    return v.tipAnchor.getWorldPosition(new THREE.Vector3());
  }
  const yaw=Number(player.yaw)||0;
  return new THREE.Vector3(
    player.pos.x+Math.sin(yaw)*.55+Math.cos(yaw)*.34,
    player.pos.y+player.eye-.18,
    player.pos.z+Math.cos(yaw)*.55-Math.sin(yaw)*.34
  );
}
function updateFishingRodVisual(v,now,dt,active){
  v.rodGroup.visible=active&&equippedFishingRod();
  if(!v.rodGroup.visible)return;
  const forward=new THREE.Vector3();camera.getWorldDirection(forward).normalize();
  const right=new THREE.Vector3().crossVectors(forward,camera.up).normalize();
  const up=new THREE.Vector3().copy(camera.up).normalize();
  const castAge=(now-(fishingState.castVisualStart||now))/1000;
  const cast=Math.max(0,1-Math.min(1,castAge/.55));
  const fight=fishingState.phase==='fight'?1:0;
  const aim=fishingState.phase==='aim'?1:0;
  const reel=!!(keys&&keys.KeyF)&&fight;
  const base=new THREE.Vector3().copy(camera.position)
    .addScaledVector(forward,.82-cast*.08)
    .addScaledVector(right,.44)
    .addScaledVector(up,-.42+cast*.08+Math.sin(now*.012)*.01);
  v.rodGroup.position.copy(base);
  v.rodGroup.rotation.order='YXZ';
  let rodYaw=Number(player.yaw)||0,rodPitch=Number(player.pitch)||0;
  if(aim&&fishingState.target){
    const dx=fishingState.target.x-base.x,dz=fishingState.target.z-base.z,dy=fishingState.target.y+.3-base.y,h=Math.max(.001,Math.hypot(dx,dz));
    rodYaw=Math.atan2(dx,dz);
    rodPitch=Math.atan2(dy,h);
  }
  v.rodGroup.rotation.set(rodPitch-.86-cast*.48-fight*.1,rodYaw-.22,-.42-cast*.85+fight*.13+aim*.28+Math.sin(now*.02)*(reel?.055:.018));
  v.tip.rotation.z=-.56-(fishingState.tension||0)/100*.24-fight*.08;
  v.reel.rotation.x+=dt*(reel?18:2.8);
}
function tickFishingVisuals(now,dt){
  const v=makeFishingVisuals();
  const active=fishingState.phase&&fishingState.phase!=='idle'&&fishingState.phase!=='cooldown';
  updateFishingRodVisual(v,now,dt,active);
  updateFishingDebugHud(now);
  v.line.visible=active&&!!fishingState.target&&fishingState.phase!=='aim';
  v.bobberGroup.visible=active&&!!fishingState.target&&fishingState.phase!=='aim';
  if(v.targetGroup)v.targetGroup.visible=fishingState.phase==='aim'&&!!fishingState.target;
  const fight=fishingState.phase==='fight'?1:0;
  const bite=fishingState.phase==='bite'?1:0;
  if(!fishingState.target){setFishingTargetScreenHud(false);return;}
  const target=fishingState.target;
  const aim=fishingState.phase==='aim'?1:0;
  const bob=aim?Math.sin(now*.006)*.018:Math.sin(now*.006)*.035+(bite?Math.sin(now*.04)*.09:0)+(fight?Math.sin(now*.014)*.055:0);
  const flee=fight?Math.sin(now*.0027)*(fishingState.fish&&fishingState.fish.power||1)*.18:0;
  v.bobberGroup.position.set(target.x+flee,target.y+bob,target.z+Math.cos(now*.0022)*flee);
  if(v.targetGroup){
    v.targetGroup.position.set(target.x,target.y+.08,target.z);
    v.targetGroup.rotation.y=now*.002;
    const pulse=1+Math.sin(now*.009)*.1;
    v.targetRing.scale.setScalar(pulse);
    v.targetInner.scale.setScalar(1.15-pulse*.12);
    if(v.targetCore)v.targetCore.scale.setScalar(.9+Math.sin(now*.012)*.22);
    v.targetBeam.material.opacity=aim?.82:.18;
    if(aim){
      const projected=new THREE.Vector3(target.x,target.y+1.15,target.z).project(camera);
      const onScreen=projected.z>-1&&projected.z<1&&projected.x>=-1.25&&projected.x<=1.25&&projected.y>=-1.25&&projected.y<=1.25;
      const sx=(projected.x*.5+.5)*innerWidth,sy=(-projected.y*.5+.5)*innerHeight;
      setFishingTargetScreenHud(true,sx,sy,onScreen?('CAST · '+Math.round((fishingState.castQuality||0)*100)+'%'):'TARGET OFF-SCREEN · turn to face it');
      if(now-lastFishingTargetDebugAt>900){
        lastFishingTargetDebugAt=now;
        fishingTargetDebug('aim.visible',{targetGroupVisible:!!v.targetGroup.visible,bobberVisible:!!v.bobberGroup.visible,onScreen,screen:{x:Math.round(sx),y:Math.round(sy)},camera:{x:+camera.position.x.toFixed(3),y:+camera.position.y.toFixed(3),z:+camera.position.z.toFixed(3)}} ,now);
      }
    }else setFishingTargetScreenHud(false);
  }
  v.ring.scale.setScalar(1+(bite?.45:0)+Math.sin(now*.008)*.08);
  v.ring.material.opacity=bite?.65:.28;
  const start=fishingRodTipWorld();
  const end=v.bobberGroup.position;
  const pos=v.line.geometry.attributes.position;
  pos.setXYZ(0,start.x,start.y,start.z);
  pos.setXYZ(1,end.x,end.y,end.z);
  pos.needsUpdate=true;
}
setInterval(()=>{if(fishingState.phase==='idle')setFishingHud('');},1200);
globalThis.BlockcraftFishing={
  active:()=>fishingState.phase&&fishingState.phase!=='idle'&&fishingState.phase!=='cooldown',
  prompt:fishingPrompt,
  start:startFishingCast,
  hook:hookFishing,
  placementActive:()=>fishingState.phase==='aim',
  handleKeyDown(code){
    if(code==='KeyG'){
      if(fishingState.phase==='aim')return confirmFishingCast();
      if(fishingState.phase==='idle'||fishingState.phase==='cooldown')return startFishingCast();
      if(fishingState.phase==='wait'||fishingState.phase==='bite'||fishingState.phase==='land')return hookFishing();
      return fishingState.phase==='fight';
    }
    if(code==='Escape')return cancelFishingPlacement();
    if(['KeyW','KeyA','KeyS','KeyD'].includes(code))return fishingState.phase==='aim';
    if(code==='KeyF')return fishingState.phase==='fight';
    return false;
  },
  handleKeyUp(code){ if(code==='KeyF')fishingState.reelHeld=false; return fishingState.phase==='fight'||fishingState.phase==='aim'; },
  tick:tickFishing,
  state:fishingState
};
function updateInfoHud(held){
  document.body.classList.toggle('calm-town', (locked || uiOpen || statOpen || qOpen || claimMode) && calmTownHud());
  let coordsHTML='',coordsHidden=false;
  refreshHomeworkHud();
  const dayState=(()=>{const t=((Number(worldState.tod)||0)%1+1)%1;return t>=.23&&t<.75?'Day':'Night';})();
  if(onboardingActive&&dim==='tutorial'){
    if(activityTrackerEl)activityTrackerEl.classList.add('hidden');
    coordsHTML='<div class="statuschip time"><i class="ico">T</i><span>Time</span><b>'+escHTML(clockStr()+' '+dayState)+'</b></div>';
    if(currentQuestEl){
      lastObjectiveHudHTML='';lastObjectiveHudHidden=true;
      currentQuestEl.classList.add('hidden');
      if(currentQuestEl.innerHTML!=='')currentQuestEl.innerHTML='';
    }
  }else{
    updateOverworldActivityTracker();
    updateEncounterPrompt();
    const rank=rankHudProgress();
    const rows=[
      '<div class="statuschip time"><i class="ico">T</i><span>Time</span><b>'+escHTML(clockStr()+' '+dayState)+'</b></div>',
      '<div class="statuschip gold"><i class="ico">G</i><span>Gold</span><b>'+escHTML(String(gold|0))+'</b></div>',
      '<div class="statuschip rank"><i class="ico">R</i><span>'+escHTML(rank.label)+'</span><b>'+escHTML(rank.value)+'</b></div>'
    ];
    if(!calmTownHud()){
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
    }
    coordsHTML=rows.join('');
    if(currentQuestEl)refreshObjectiveTracker();
  }
  if(coordsHTML!==lastCoordsHudHTML||coordsHidden!==lastCoordsHudHidden){
    lastCoordsHudHTML=coordsHTML;lastCoordsHudHidden=coordsHidden;
    coordsEl.classList.toggle('hidden',coordsHidden);
    if(coordsEl.innerHTML!==coordsHTML)coordsEl.innerHTML=coordsHTML;
  }
  return;
}
let last=performance.now();
const perfDiagnostics=createPerformanceDiagnostics({renderer:rendering.renderer,getCounts:()=>({remotes:Object.keys(NET.remotes||{}).length,scene:scene.children.length,...worldApi.particleBudgetStats()})});
function tickPetTamerTutorialVisuals(now, dt){
  if(!networkingApi.tickPetTamerTutorialDragons)return;
  const petRoom=(worldState.JOB_TUTORIAL_MEADOWS&&worldState.JOB_TUTORIAL_MEADOWS.pet_tamer)||null;
  const petTamerActive=dimensionsState.kind==='job'&&combatState.jobTutorialActive&&combatState.jobTutorialJob==='pet_tamer';
  networkingApi.tickPetTamerTutorialDragons(petTamerActive, petRoom, now, dt);
  if(networkingApi.tickPetTamerTutorialGroundDragon)networkingApi.tickPetTamerTutorialGroundDragon(petTamerActive, petRoom, now, dt);
}
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
  if(globalThis.BlockcraftFishing)globalThis.BlockcraftFishing.tick(now,dt);
  enforceFishingLakeBounds(now);
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
  tickPetTamerTutorialVisuals(now, dt);
  if(globalThis.BlockcraftTamingLandTracks&&globalThis.BlockcraftTamingLandTracks.tick)globalThis.BlockcraftTamingLandTracks.tick(now,dt);
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

  const deathControlLocked=hp<=0||document.body.classList.contains('death-active')||!!(document.getElementById('deathlimbo')&&document.getElementById('deathlimbo').classList.contains('show'))||!!(document.getElementById('dungeonspirit')&&document.getElementById('dungeonspirit').classList.contains('show'));
  if(deathControlLocked&&player&&player.vel)player.vel.set(0,0,0);
  const fishingPlacementLocked=!!(globalThis.BlockcraftFishing&&globalThis.BlockcraftFishing.placementActive&&globalThis.BlockcraftFishing.placementActive());
  if(fishingPlacementLocked&&player&&player.vel)player.vel.set(0,0,0);
  const directorFree=directorFreeFlyActive();
  if(directorFree&&player&&player.vel)player.vel.set(0,0,0);
  let directorFreeMouse={x:0,y:0};
  const gameplayMoveAllowed=!deathControlLocked&&!fishingPlacementLocked&&!directorFree&&(combatApi.gameplayMovementAllowed?combatApi.gameplayMovementAllowed():(combatApi.gameplayCameraInputAllowed?combatApi.gameplayCameraInputAllowed():true));
  if(!deathControlLocked&&(locked||gameplayMoveAllowed||directorFree)){
    const mouseLook=combatApi.consumeMouseLookDelta?combatApi.consumeMouseLookDelta():{x:0,y:0};
    if(directorFree)directorFreeMouse=mouseLook;
    const lookX=gameplayMoveAllowed?((keys['ArrowLeft']?1:0)-(keys['ArrowRight']?1:0)):0;
    const lookY=gameplayMoveAllowed?((keys['ArrowUp']?1:0)-(keys['ArrowDown']?1:0)):0;
    const mouseLookSensitivity=combatState.mouseLookSensitivity||.00215;
    const mouseYaw=-(mouseLook.x||0)*mouseLookSensitivity,mousePitch=-(mouseLook.y||0)*mouseLookSensitivity;
    if(gameplayMoveAllowed&&!cutscene && (lookX||lookY||mouseYaw||mousePitch)){
      const lookSpeed=(keys['ShiftLeft']||keys['ShiftRight'])?4.4:2.85;
      const yawDelta=lookX*lookSpeed*dt+mouseYaw;
      if(onboardingActive&&onboardingArrived&&onboardingKind()==='arrows'&&(lookX||mouseYaw)){
        onboardingArrowTurn+=Math.abs(yawDelta);
        if(onboardingArrowTurn>=ONBOARDING_FULL_TURN) onboardingFlags.arrowLook=true;
        updateOnboardingHud();
      }
      player.yaw = Math.atan2(Math.sin(player.yaw+yawDelta),Math.cos(player.yaw+yawDelta));
      player.pitch += lookY*lookSpeed*.85*dt+mousePitch;
      player.pitch = Math.max(-Math.PI/2+0.01, Math.min(Math.PI/2-0.01, player.pitch));
      if(dimensionsState.kind==='fishing_lake'){
        const pitchJump=Math.abs(player.pitch-lastFishingCameraPitch);
        if(Math.abs(player.pitch)>1.35||Math.abs(mousePitch)>0.08||Math.abs(mouseYaw)>0.08||pitchJump>.18){
          fishingCameraDebug('look-update',{mouseLook,lookX,lookY,mouseYaw:+mouseYaw.toFixed(5),mousePitch:+mousePitch.toFixed(5),pitchJump:+pitchJump.toFixed(4),gameplayMoveAllowed,cutscene},now);
        }
      }
    }
    if(dimensionsState.kind==='fishing_lake'&&now-lastFishingHeartbeatAt>1000){
      lastFishingHeartbeatAt=now;
      fishingCameraDebug('heartbeat',{gameplayMoveAllowed,deathControlLocked,locked:!!locked,mouseLook,keys:{w:!!keys.KeyW,a:!!keys.KeyA,s:!!keys.KeyS,d:!!keys.KeyD,shift:!!(keys.ShiftLeft||keys.ShiftRight)}},now);
    }
    if(dimensionsState.kind==='fishing_lake')lastFishingCameraPitch=player.pitch;
    const sprintKey=gameplayMoveAllowed&&(keys['ShiftLeft']||keys['ShiftRight']);
    let f=gameplayMoveAllowed?((keys['KeyW']?1:0)-(keys['KeyS']?1:0)):0;
    let s=gameplayMoveAllowed?((keys['KeyD']?1:0)-(keys['KeyA']?1:0)):0;
    if(biomeStatus.rooted(now)){f=0;s=0;}
    if(cutscene||eventStartLocked()||(worldState.skyshipJourney&&worldState.skyshipJourney.boarded)){ f=0; s=0; player.vel.set(0,0,0); }
    if(isMeditating && (f!==0 || s!==0 || keys['Space'])){
      stopMeditation();
    }
    if(isMeditating){
      f=0; s=0; player.vel.set(0,0,0);
      if(meditationFocusReady){
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
    }
    const deityActive=globalThis.BlockcraftDeityState&&globalThis.BlockcraftDeityState.active;
    const deityFlying=!mounted&&deityActive&&deityActive.flight===true;
    const flying = deityFlying || (mounted && isDragon(mountKind));
    const movementInput=f!==0||s!==0;
    const pantherMove=pantherFormActive(now)&&!mounted&&movementInput;
    const parkourFreeMovement=!!(worldApi.isParkourEventActive&&worldApi.isParkourEventActive());
    const outOfFood=!parkourFreeMovement&&!mounted && hunger<=0;
    const sprintIntent=!!(sprintKey && movementInput && !mounted);
    if(parkourFreeMovement)staminaExhausted=false;
    else if(!pantherMove&&!mounted&&sp<=1){
      staminaExhausted=true;
      if(combatState.tabletInput&&combatState.tabletInput.sprintToggled&&combatApi.setTabletSprintToggle){
        combatApi.setTabletSprintToggle(false);
        globalThis.BlockcraftTrace&&globalThis.BlockcraftTrace('tablet.sprint-auto-off',{reason:'stamina-empty',sp:Math.round(sp*100)/100});
      }
    }
    else if(staminaExhausted&&sp>=maxSp()*MOVEMENT_FEEL.recoverSprintAt)staminaExhausted=false;
    const exhausted=!pantherMove&&!mounted&&staminaExhausted;
    const sprintReady=parkourFreeMovement||(!staminaExhausted&&sp>0);
    const sprintTarget=pantherMove?1:(sprintIntent&&sprintReady?(parkourFreeMovement?1:Math.max(.18,Math.min(1,sp/8))):0);
    const sprintRate=sprintTarget>sprintRamp?1/MOVEMENT_FEEL.sprintRampUp:1/MOVEMENT_FEEL.sprintRampDown;
    sprintRamp=approach(sprintRamp,sprintTarget,sprintRate,dt);
    if(!movementInput&&!pantherMove)sprintRamp=approach(sprintRamp,0,10,dt);
    const sprintFactor=pantherMove?1:sprintRamp;
    const sprint=sprintFactor>.55||pantherMove;
    if(onboardingActive&&onboardingArrived&&onboardingKind()==='sprint'&&sprintIntent){
      onboardingFlags.sprint=true;
      updateOnboardingHud();
    }
    sprintingNow=sprint;
    if(globalThis.COMBAT_FEEDBACK)globalThis.COMBAT_FEEDBACK.updateMovement(camera,sprint,movementInput,dt);
    const armorMovement=!mounted&&equippedArmor()?armorProfileFor(equippedArmor()):null;
    const armorStamina=armorMovement?armorMovement.staminaCostMultiplier:1;
    if(!parkourFreeMovement&&sprintFactor>.05&&!pantherMove&&movementInput){
      const beforeSp=sp;
      sp=Math.max(0,sp-stCost(3.5)*armorStamina*sprintFactor*dt);
      if(now-(NET.lastSprintDrainTraceAt||0)>1500){
        NET.lastSprintDrainTraceAt=now;
        globalThis.BlockcraftTrace&&globalThis.BlockcraftTrace('movement.sprint-drain',{
          before:Math.round(beforeSp*100)/100,
          after:Math.round(sp*100)/100,
          drain:Math.round((beforeSp-sp)*100)/100,
          sprintFactor:Math.round(sprintFactor*100)/100,
          hunger:Math.round(hunger*100)/100,
          outOfFood,
          tablet:!!(combatState.tabletInput&&combatState.tabletInput.gameplayTouch),
        });
      }
      if(combatState.tabletInput&&combatState.tabletInput.sprintToggled&&now-lastTabletSprintDrainTraceAt>1000){
        lastTabletSprintDrainTraceAt=now;
        globalThis.BlockcraftTrace&&globalThis.BlockcraftTrace('tablet.sprint-drain',{sp:Math.round(sp*100)/100,sprintFactor:Math.round(sprintFactor*100)/100,movementInput,keys:{w:!!keys.KeyW,a:!!keys.KeyA,s:!!keys.KeyS,d:!!keys.KeyD,shift:!!keys.ShiftLeft}});
      }
      if(sp<=1&&combatState.tabletInput&&combatState.tabletInput.sprintToggled&&combatApi.setTabletSprintToggle){
        combatApi.setTabletSprintToggle(false);
        globalThis.BlockcraftTrace&&globalThis.BlockcraftTrace('tablet.sprint-auto-off',{reason:'stamina-drained',sp:Math.round(sp*100)/100});
      }
    }
    const dragFly=flying?(deityFlying?12:((DRAGON_TYPES[dragonType(mountKind)]||{}).fly||13)):0;
    const baseSpd=flying?dragFly:(mounted?9.6:(pantherMove?PANTHER_FORM.speed:(MOVEMENT_FEEL.walk+(MOVEMENT_FEEL.sprint-MOVEMENT_FEEL.walk)*sprintFactor)));
    const speed=baseSpd*(exhausted?MOVEMENT_FEEL.exhaustedWalk:1)*(outOfFood&&!pantherMove?0.62:1)*(1+0.015*(S.agi-1))*(buffs.spd>0?1.25:1)*(armorMovement?armorMovement.moveMultiplier:1);
    const sin=Math.sin(player.yaw), cos=Math.cos(player.yaw);
    const sideScale=pantherMove?PANTHER_FORM.strafe:1;
    let targetVx=(-sin*f + cos*s*sideScale), targetVz=(-cos*f - sin*s*sideScale);
    const len=Math.hypot(targetVx,targetVz)||1;
    const pantherStrafeBoost=pantherMove&&Math.abs(s)>Math.abs(f)?.08:0;
    targetVx=targetVx/len*speed*(1+pantherStrafeBoost); targetVz=targetVz/len*speed*(1+pantherStrafeBoost);
    if(!movementInput){targetVx=0;targetVz=0;}
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
      if(mounted && isDragon(mountKind)){
        // Dragon flight naturally glides downward. Hold Shift to climb.
        const dragonClimbing=sprintKey;
        const targetVy=dragonClimbing?8.4:-2.8;
        const accel=dragonClimbing?7.5:3.2;
        player.vel.y += (targetVy-player.vel.y)*Math.min(1,dt*accel);
        player.onGround=false;
      }else{
        const climb=(keys['Space']?1:0)-((keys['ShiftLeft']||keys['ShiftRight'])?1:0);
        if(climb!==0) player.vel.y=climb*9;
        else player.vel.y += (0-player.vel.y)*Math.min(1,dt*8);
      }
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
        player.vel.y=mounted?9.4:(pantherFormActive(now)?PANTHER_FORM.jump:8.2); player.onGround=false;
        if(pantherMove){
          const pounceLen=Math.hypot(targetVx,targetVz)||1;
          player.vel.x+=targetVx/pounceLen*PANTHER_FORM.pounce;
          player.vel.z+=targetVz/pounceLen*PANTHER_FORM.pounce;
          landingDip=Math.max(landingDip,.035);
        }
        lastGroundT=-1e9; jumpPressT=-1e9;
      } else if(feetWater && !player.onGround){
        // swim up: strong, snappy thrust so a player who falls in can breach and hop out on their own
        player.vel.y=Math.min(player.vel.y+38*dt, waistWater?4.8:6.6);
        // climb out: pushing toward a bank vaults you over the lip. Probe the direction the player is
        // steering (falls back to velocity) so it fires immediately, and only needs one clear block above.
        if(f!==0||s!==0){
          const yaw=Number(player.yaw)||0;
          let pdx=Math.sin(yaw)*f+Math.cos(yaw)*s, pdz=Math.cos(yaw)*f-Math.sin(yaw)*s;
          const pl=Math.hypot(pdx,pdz);
          if(pl<.1){ const vl=Math.hypot(player.vel.x,player.vel.z)||1; pdx=player.vel.x/vl; pdz=player.vel.z/vl; }
          else { pdx/=pl; pdz/=pl; }
          const ax=Math.floor(player.pos.x+pdx*.75), az=Math.floor(player.pos.z+pdz*.75);
          const fy=Math.floor(player.pos.y);
          let wallY=-1;
          if(isSolid(getB(ax,fy,az))) wallY=fy;
          else if(isSolid(getB(ax,fy+1,az))) wallY=fy+1;
          if(wallY>=0 && !isSolid(getB(ax,wallY+1,az))){
            player.vel.y=Math.max(player.vel.y, 9.6);
            player.vel.x+=pdx*2.2; player.vel.z+=pdz*2.2;   // nudge onto the bank
            SFX.splash(false);
            burst(player.pos.x, player.pos.y+.3, player.pos.z, [.45,.62,.85], 10, 2.2, 2, .4);
          }
        }
      }
    }
    }
    const wasGround=player.onGround;
    const prevVy=player.vel.y;
    if(wasGround){localFallPeakY=player.pos.y;localFallAirborne=false;}
    player.onGround=false;
    if(playerKb.lengthSq()>.001){
      moveAxis('x', playerKb.x*dt);
      moveAxis('z', playerKb.z*dt);
      playerKb.multiplyScalar(Math.max(0,1-dt*5));
    }
    const groundedForMove=wasGround||player.onGround||(!feetWater&&now-lastGroundT<90);
    const controlRate=pantherMove?(groundedForMove?(movementInput?PANTHER_FORM.accel:PANTHER_FORM.brake):PANTHER_FORM.airAccel):(inWater?MOVEMENT_FEEL.waterAccel:(groundedForMove?(movementInput?(sprint?MOVEMENT_FEEL.groundSprintAccel:MOVEMENT_FEEL.groundAccel):MOVEMENT_FEEL.groundBrake):(movementInput?MOVEMENT_FEEL.airAccel:MOVEMENT_FEEL.airBrake)));
    player.vel.x=approach(player.vel.x,targetVx,controlRate,dt);
    player.vel.z=approach(player.vel.z,targetVz,controlRate,dt);
    if(!movementInput&&groundedForMove&&Math.hypot(player.vel.x,player.vel.z)<.035){player.vel.x=0;player.vel.z=0;}
    const moveScale=inWater?.6:1,stepFromX=player.pos.x,stepFromY=player.pos.y,stepFromZ=player.pos.z;
    const moveDx=player.vel.x*moveScale*dt,moveDz=player.vel.z*moveScale*dt;
    player.vx=player.vel.x; player.vz=player.vel.z;
    moveAxis('x', moveDx);
    moveAxis('z', moveDz);
    tryStepAssist(stepFromX,stepFromY,stepFromZ,moveDx,moveDz,wasGround,feetWater,flying);
    moveAxis('y', player.vel.y*dt);
    if(eventStartLocked()){holdEventStartPosition();player.onGround=true;}
    if(player.onGround) lastGroundT=now;
    if(!player.onGround&&!feetWater&&!flying){
      if(!localFallAirborne){localFallAirborne=true;localFallPeakY=player.pos.y;}
      else localFallPeakY=Math.max(localFallPeakY,player.pos.y);
    }
    if(player.onGround && !wasGround && prevVy<-9){             // landing feedback
      const feather=utilityEquipped('feather_step');
      const fallDrop=Math.max(0,localFallPeakY-player.pos.y);
      const hard=!feather && prevVy<-15;
      const bid=getB(Math.floor(player.pos.x), Math.floor(player.pos.y-.5), Math.floor(player.pos.z));
      burst(player.pos.x, player.pos.y+.1, player.pos.z, BLOCK_COLORS[bid]||[.5,.5,.5], feather?4:(hard?14:7), feather?1.1:2.2, feather?.8:1.4, feather?.28:.45);
      SFX.land(hard);
      camShake=Math.max(camShake, feather?.04:(hard?.3:.14));
      landingDip=Math.max(landingDip,pantherFormActive(now)?PANTHER_FORM.landingDip:(feather?.025:(hard?.085:.045)));
      resolveLocalFallLanding(fallDrop,feather);
      if(feather && prevVy<-15) showName('Feather Step ready');
    }
    if(player.onGround){localFallPeakY=player.pos.y;localFallAirborne=false;}
    const planarSpeed=Math.hypot(player.vel.x,player.vel.z);
    updateMovementStateSnapshot(movementState,planarSpeed,speed,sprintFactor,player.onGround,inWater,pantherMove,exhausted);
    if(player.onGround && movementInput && planarSpeed>.25){                      // footsteps
      stepAcc+=planarSpeed*dt;
      if(stepAcc>=(sprint?2.6:2.1)){
        stepAcc=0;
        const bid=getB(Math.floor(player.pos.x), Math.floor(player.pos.y-.5), Math.floor(player.pos.z));
        SFX.step(feetWater?'water':stepKind(bid));
      }
    } else if(!player.onGround) stepAcc=1.6;
    // --- end water & jump physics ---
    tickLavaBorder(now);
    if(player.pos.y<-12){ player.pos.set(TOWN.TC+.5, TOWN.G+1, TOWN.TC+62.5); player.vel.set(0,0,0); player.yaw=0; }
    updateAppearanceDummy(dt, now, false);
    tickLocalMount(now, dt);
    const pantherView=tickLocalPantherForm(now,dt,f!==0||s!==0);
    if(networkingApi.tickLocalPantherFormVisual) networkingApi.tickLocalPantherFormVisual(now, dt, pantherView.active);
    if(networkingApi.tickCompanionDragons) networkingApi.tickCompanionDragons(now, dt);
    tickDragonRoost(now, dt);

    if(worldState.skyshipJourney&&worldState.skyshipJourney.boarded&&worldState.skyshipJourney.phase==='flight'&&skyShip){
      const a=now*.00016, focus=skyShip.grp.position;
      camera.position.set(focus.x+Math.cos(a)*25,focus.y+12,focus.z+Math.sin(a)*25);
      camera.lookAt(focus.x,focus.y+5,focus.z);
    } else if(cutscene){
      /* camera is driven by tickCutscene at the top of the frame */
    } else if(directorFree){
      applyDirectorCamera(now,dt); // keeps the self-avatar updated (returns early for freefly)
      applyDirectorFreeFly(now,dt,{
        f:(keys['KeyW']?1:0)-(keys['KeyS']?1:0),
        s:(keys['KeyD']?1:0)-(keys['KeyA']?1:0),
        up:((keys['Space']?1:0)-((keys['ShiftLeft']||keys['ShiftRight'])?1:0)),
        rotY:(keys['ArrowLeft']?1:0)-(keys['ArrowRight']?1:0),
        rotX:(keys['ArrowUp']?1:0)-(keys['ArrowDown']?1:0)
      },directorFreeMouse);
      refreshDirectorCameraHud();
    } else {
    camera.position.set(player.pos.x, player.pos.y+player.eye+(mounted?mountEye(mountKind):0)+(pantherView&&pantherView.bob||0), player.pos.z);
    cameraYaw=approachAngle(cameraYaw,player.yaw,18,dt);
    cameraPitch=approach(cameraPitch,player.pitch,18,dt);
    camera.rotation.order='YXZ';
    camera.rotation.set(cameraPitch-(pantherView&&pantherView.shiftGlow||0)*.08, cameraYaw, pantherView&&pantherView.tilt||0);
    const locomotionCam=tickCameraLocomotion(dt,movementInput,player.onGround,inWater,sprintFactor,pantherView,f,s,planarSpeed);
    camera.position.y+=locomotionCam.bob;
    camera.rotation.x+=locomotionCam.pitch;
    camera.rotation.z+=locomotionCam.roll;
    if(isMeditating){
      applyMeditationCamera();
    }
    applyDirectorCamera(now,dt);
    refreshDirectorCameraHud();
    }
    if(camShake>0){
      camShake=Math.max(0,camShake-dt*2.2);
      const s2=camShake*camShake;
      camera.position.x+=(Math.random()-.5)*s2*.5;
      camera.position.y+=(Math.random()-.5)*s2*.5;
      camera.rotation.z+=(Math.random()-.5)*s2*.06;
    }
    if(tipsyT>0){ tipsyT-=dt; camera.rotation.z+=Math.sin(now/420)*.028*Math.min(1,tipsyT/2); }

    const hit=raycast(4.5);
    if(worldApi.setTargetBlockHighlight)worldApi.setTargetBlockHighlight(hit);
    else if(hit){ highlight.visible=true; highlight.position.set(hit.x+.5,hit.y+.5,hit.z+.5); }
    else { highlight.visible=false; }
    combatApi.updateBuildPreview(!cutscene);
    if(!cutscene&&combatApi.heldPlaceAction)combatApi.heldPlaceAction(now);

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
          if(globalThis.BlockcraftSelfAvatar&&globalThis.BlockcraftSelfAvatar.swing)globalThis.BlockcraftSelfAvatar.swing(.55);
          if(NET.on&&NET.room)NET.room.send('playerAction',{kind:'mine',strength:.55});
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
        const stages=Array.isArray(crackTexs)?crackTexs.length:4;
        const st=Math.max(0,Math.min(stages-1,Math.floor(frac*stages)));
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
    if(now>=nextInfoHudAt){nextInfoHudAt=now+HUD_UPDATE_INTERVAL_MS;updateInfoHud(held);}
  } else { crack.visible=false; combatApi.updateBuildPreview(false); }
  updateGatePrompt();
  updateGateRally(now);
  if(now>=nextDungeonHudAt){nextDungeonHudAt=now+HUD_UPDATE_INTERVAL_MS;updateDungeonCoordination(now);}
  else if(activeDungeonPing&&dim==='dungeon'&&now<activeDungeonPing.expires){
    dungeonPingGroup.visible=true;dungeonPingGroup.position.set(activeDungeonPing.x||0,(activeDungeonPing.y||8)+.1,activeDungeonPing.z||0);
    const pulse=1+Math.sin(now*.009)*.18;dungeonPingRing.scale.setScalar(pulse);dungeonPingRing.rotation.z=now*.001;
  }
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
  updateSkyDragons(dt,now/1000);
  updateFishSchools(dt,now/1000);
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
    const tutorialJob=dim==='job'&&combatState.jobTutorialActive ? combatState.jobTutorialJob : '';
    const inMeditation=typeof inMeditationSpot==='function'&&inMeditationSpot();
    SFX.tick(dt, fd, 1-gDayF, dim==='overworld', inTown, isInsideTavern(), inMenu, !!cutscene, worldApi.inOverworldBattle(), tutorialJob, dim, inMeditation);
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
  updateLandMinimap(false);
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
  const debugSnapshot=()=>{
    const overlayEl=document.getElementById('overlay');
    const pathEl=document.getElementById('pathselect');
    const awakeningEl=document.getElementById('awakeningwin');
    const self=NET.room&&NET.room.state&&NET.room.state.players&&NET.room.sessionId&&NET.room.state.players.get(NET.room.sessionId);
    return {
      connected:!!(NET.on&&NET.profileReady),
      roomName:NET.roomName||'',
      sessionId:NET.room&&NET.room.sessionId||'',
      player:{name:self&&self.name||'',level:S&&S.lvl,path:S&&S.path||'',xp:S&&S.xp,job:playerJob||'',gold,dim,x:Math.round((player&&player.pos&&player.pos.x||0)*10)/10,z:Math.round((player&&player.pos&&player.pos.z||0)*10)/10},
      quest:quest?{source:quest.source||'npc',giver:quest.giver||'',title:quest.title||'',type:quest.type||'',have:quest.have|0,need:quest.need|0,chainStep:quest.chainStep|0}:null,
      progression:{focus:progressionFocus||'',maraStep:Number((npcQuestChains&&npcQuestChains['Mara Vale'])||0),firstPromotionSeen:ONBOARD.isSeen(),objectives:Array.isArray(activeObjectives)?activeObjectives.map(o=>({source:o.source,status:o.status,title:o.title,type:o.type})).slice(0,5):[]},
      objective:{
        current:currentObjective(),
        hud:debugObjectiveHudSummary(currentObjectiveHud()),
        action:e2eCurrentObjectiveAction(),
        hidden:!!(currentQuestEl&&currentQuestEl.classList.contains('hidden')),
        text:(currentQuestEl&&currentQuestEl.textContent||'').replace(/\s+/g,' ').trim(),
      },
      modal:{overlayVisible:!!(overlayEl&&!overlayEl.classList.contains('hidden')),pathVisible:!!(pathEl&&!pathEl.classList.contains('hidden')),pathIsJob:!!(pathEl&&pathEl.classList.contains('jobselect')),awakeningVisible:!!(awakeningEl&&!awakeningEl.classList.contains('hidden')),ui:menusState.open,uiMode:menusState.mode,q:menusState.modalOpen,transition:transitionPanelState()},
      input:{locked:combatState.inputLocked,pointerLock:document.pointerLockElement===renderer.domElement},
      tutorial:{onboarding:onboardingActive,abilityTraining:combatState.abilityTrainingActive,abilityDone:abilityTutorialDone(),tutorials:{...serverTutorials}},
    };
  };
  globalThis.BlockcraftDebugSnapshot=debugSnapshot;
  globalThis.BlockcraftTrace&&globalThis.BlockcraftTrace('debug.snapshot.ready');
  window.__BLOCKCRAFT_E2E__={
    status:()=>{const self=NET.room&&NET.room.state&&NET.room.state.players&&NET.room.sessionId&&NET.room.state.players.get(NET.room.sessionId);let bossState='';const dungeonMobs=[];if(NET.room&&NET.room.state&&NET.room.state.mobs)NET.room.state.mobs.forEach((m,id)=>{if(m.dgn===NET.dgn){dungeonMobs.push({id:String(id),kind:m.kind||'',variant:m.variant||'',bossStyle:m.bossStyle||'',displayName:m.displayName||'',elite:!!m.elite,state:m.state||''});if(m.kind==='boss')bossState=m.state||'';}});return {connected:NET.on&&NET.profileReady===true,reconnecting:NET.reconnecting,attachCount:NET.attachCount,sessionId:NET.room&&NET.room.sessionId||'',team:self&&self.team||'',job:playerJob,jobXp,contract:jobContract?JSON.parse(JSON.stringify(jobContract)):null,jobContractOffers:Array.isArray(jobContractOffers)?jobContractOffers.map(c=>JSON.parse(JSON.stringify(c))):[],jobContractOffersJob,jobContractRefreshAt,lastProgressionReject:String(globalThis.__BLOCKCRAFT_LAST_PROGRESSION_REJECT__||''),progressionFocus,activeObjectives:Array.isArray(activeObjectives)?JSON.parse(JSON.stringify(activeObjectives)):[],firstPromotionSeen:ONBOARD.isSeen(),currentObjective:currentObjective(),currentObjectiveHud:currentObjectiveHud(),objectiveText:currentQuestEl&&currentQuestEl.textContent||'',objectiveAction:e2eCurrentObjectiveAction(),transitionPanels:transitionPanelState(),menu:{open:menusState.open,mode:menusState.mode,modalOpen:menusState.modalOpen,craftResult:menusState.craftResult?JSON.parse(JSON.stringify(menusState.craftResult)):null},landClaimOverlay:!!worldState.landClaimOverlay,baseSetup:worldApi.baseSetupStatus?worldApi.baseSetupStatus():null,dRankPrep:progressionFocus==='first_d_gate'?ONBOARD.dRankPrepStatus():null,rankProgress:currentRankProgress(),utilityUnlocks:[...utilityUnlocks],utilityLoadout:{active:utilityLoadout.active,passive:[...utilityLoadout.passive]},compassTarget:utilityCompassTarget(),partyCompassTarget:partyCompassTarget(),armor:armorSlot&&armorSlot.id,level:S.lvl,xp:S.xp,points:S.pts,path:S.path||'',gold,onboarding:onboardingActive,onboardingStep,onboardingTotal:ONBOARDING_STEPS.length,onboardingKind:onboardingKind(),tutorials:{...serverTutorials},townTutorials:{job:townTutorialStepDone('job'),tavern:townTutorialStepDone('tavern'),land:townTutorialStepDone('land'),all:townTutorialsDone()},quest:quest?JSON.parse(JSON.stringify(quest)):null,maraStep:Number((npcQuestChains&&npcQuestChains['Mara Vale'])||0),abilityTraining:abilityTrainingActive,abilityTrainingUsed:combatState.abilityTrainingUsed,abilityTutorialDone:abilityTutorialDone(),dimension:dim,inTown:dim==='overworld'&&isTownLand(Math.floor(player.pos.x),Math.floor(player.pos.z)),dungeonId:NET.dgn||'',dungeonContentId:dungeon&&dungeon.dungeonId||'',dungeonSeed:dungeon?(dungeon.seed>>>0):null,dungeonCleared:!!(dungeon&&dungeon.cleared),dungeonStatus:dungeon&&dungeon.status?JSON.parse(JSON.stringify(dungeon.status)):null,dungeonBossCount:e2eDungeonBossCount(),dungeonBossState:bossState,dungeonMobs,dungeonRestartRecovery:networkingState.restartRecovery?JSON.parse(JSON.stringify(networkingState.restartRecovery)):null,e2eJourneyResult:networkingState.journeyResult?JSON.parse(JSON.stringify(networkingState.journeyResult)):null,lobby:dungeonLobbyState?JSON.parse(JSON.stringify(dungeonLobbyState)):null,highestGateRankCleared,gateRanks:e2eGateRanks(),gates:e2eGates(),firstGate:e2eFirstGate(),roomName:NET.roomName||''};},
    petTamerVisualDebug:()=>combatApi.petTamerVisualDebug?combatApi.petTamerVisualDebug():null,
    inventoryCount:id=>inventoryModel.count(id),
    inventorySlot:id=>inventoryModel.slots.findIndex(stack=>stack&&stack.id===id),
    landTutorialTarget:()=>{const info=combatApi.townTutorialInfo?combatApi.townTutorialInfo('land'):null,t=info&&info.target,x=t&&Number.isFinite(Number(t.x))?Math.round(Number(t.x)):null,z=t&&Number.isFinite(Number(t.z))?Math.round(Number(t.z)):null;return x!==null&&z!==null?{x,z}:{x:TOWN.TC,z:TOWN.TC-TOWN.HS-9};},
    clearInventoryItems:ids=>{const clear=new Set((Array.isArray(ids)?ids:[]).map(id=>id|0));for(let i=0;i<inv.length;i++)if(inv[i]&&clear.has(inv[i].id|0))inv[i]=null;refreshHUD();return true;},
    isDungeonSpirit:()=>{const p=NET.room&&NET.room.state&&NET.room.state.players&&NET.room.state.players.get(NET.room.sessionId);return !!(p&&p.spirit);},
    hasLocalSpiritVisual:()=>!!globalThis.BlockcraftLocalSpiritFxActive,
    selfPosition:()=>{const p=NET.room&&NET.room.state&&NET.room.state.players&&NET.room.state.players.get(NET.room.sessionId);return p?{x:p.x,y:p.y,z:p.z}:player&&player.pos?{x:player.pos.x,y:player.pos.y,z:player.pos.z}:null;},
    moveSelfTo:(x,y,z)=>{if(!player||!player.pos)return false;player.pos.set(Number(x)||0,Number(y)||0,Number(z)||0);player.vel&&player.vel.set&&player.vel.set(0,0,0);if(NET.on&&NET.room)NET.room.send('move',{x:player.pos.x,y:player.pos.y,z:player.pos.z,yaw:player.yaw||0,pitch:player.pitch||0});return true;},
    remoteSummary:()=>{const out=[];if(NET&&NET.remotes)for(const sid in NET.remotes){const r=NET.remotes[sid],ref=r&&r.ref||{};out.push({sid,name:String(ref.name||''),dgn:String(ref.dgn||''),visible:!!(r&&r.grp&&r.grp.visible),x:r&&r.grp?Math.round(r.grp.position.x*10)/10:0,y:r&&r.grp?Math.round(r.grp.position.y*10)/10:0,z:r&&r.grp?Math.round(r.grp.position.z*10)/10:0});}return out;},
    nearbySocialTarget:()=>typeof townSocialTargetNear==='function'?townSocialTargetNear(4.8):null,
    trackedGate:()=>gate?{id:gate.id||'',rank:gate.rank|0,kind:gate.kind||'public'}:null,
    send:(type,message={})=>{if(!NET.on||!NET.room)throw new Error('not connected');NET.room.send(type,message);},
    disconnect:()=>{if(!NET.room||!NET.room.connection)throw new Error('no active connection');NET.room.connection.close();},
    pauseReconnect:()=>NETWORK.pauseReconnect(),
    shutdown:()=>NETWORK.shutdown(),
    finishOnboarding:()=>completeOnboarding(),
    completeOnboardingStep:e2eCompleteOnboardingStep,
    completeTownTutorialStep:step=>completeTownTutorialStep(step),
    openJobChoice:()=>combatApi.openLevel2JobChoice?combatApi.openLevel2JobChoice(true):false,
    startJobTutorial:jobId=>combatApi.startJobTutorial?combatApi.startJobTutorial(jobId):false,
    resumeJobTutorial:(jobId,state={})=>combatApi.resumeJobTutorial?combatApi.resumeJobTutorial(jobId,state):false,
    minerTutorialVisualDebug:()=>combatApi.minerTutorialVisualDebug?combatApi.minerTutorialVisualDebug():null,
    minerTutorialAction:()=>combatApi.performMinerTutorialStepForTest?combatApi.performMinerTutorialStepForTest():{ok:false,reason:'missing miner tutorial hook'},
    farmerTutorialVisualDebug:()=>combatApi.farmerTutorialVisualDebug?combatApi.farmerTutorialVisualDebug():null,
    farmerTutorialAction:()=>combatApi.performFarmerTutorialStepForTest?combatApi.performFarmerTutorialStepForTest():{ok:false,reason:'missing farmer tutorial hook'},
    cookTutorialVisualDebug:()=>combatApi.cookTutorialVisualDebug?combatApi.cookTutorialVisualDebug():null,
    cookTutorialAction:()=>combatApi.performCookTutorialStepForTest?combatApi.performCookTutorialStepForTest():{ok:false,reason:'missing cook tutorial hook'},
    blacksmithTutorialVisualDebug:()=>combatApi.blacksmithTutorialVisualDebug?combatApi.blacksmithTutorialVisualDebug():null,
    blacksmithTutorialAction:()=>combatApi.performBlacksmithTutorialStepForTest?combatApi.performBlacksmithTutorialStepForTest():{ok:false,reason:'missing blacksmith tutorial hook'},
    monkTutorialVisualDebug:()=>combatApi.monkTutorialVisualDebug?combatApi.monkTutorialVisualDebug():null,
    monkTutorialAction:()=>combatApi.performMonkTutorialStepForTest?combatApi.performMonkTutorialStepForTest():{ok:false,reason:'missing monk tutorial hook'},
    monkTutorialStartFocus:()=>combatApi.startMonkTutorialFocusForTest?combatApi.startMonkTutorialFocusForTest():{ok:false,reason:'missing monk start hook'},
    enterTamingLand:()=>dimensionsApi.enterTamingLand?dimensionsApi.enterTamingLand():false,
    enterTamingLandInstant:()=>dimensionsApi.enterTamingLand?dimensionsApi.enterTamingLand({instant:true}):false,
    exitTamingLand:()=>dimensionsApi.exitTamingLand?dimensionsApi.exitTamingLand():false,
    walkToTamingPortal:()=>e2eWalkTo({x:HUB.tamingPortal.x,y:TOWN.G+1,z:HUB.tamingPortal.z}),
    walkToTamingExit:()=>e2eWalkTo({x:TAMING_LAND.x+TAMING_LAND.exit.dx+.5,y:TAMING_LAND.G+1,z:TAMING_LAND.z+TAMING_LAND.exit.dz+.5}),
    petTamerTutorialAction:()=>combatApi.performPetTamerDragonTutorialAction?combatApi.performPetTamerDragonTutorialAction():false,
    petTamerFinishRoost:()=>combatApi.finishPetTamerRoostLessonForTest?combatApi.finishPetTamerRoostLessonForTest():false,
    useFirstAbility:()=>cast(0),
    walkOutsideTown:e2ePositionOutsideTown,
    walkToFirstGate:e2eWalkToFirstGate,
    walkToGate:e2eWalkToGate,
    walkToMara:e2ePositionAtMara,
    walkToTavern:()=>e2eWalkTo({x:HUB.tavern.x,y:TOWN.G+1,z:HUB.tavern.z},7.5),
    walkToJobs:()=>e2eWalkTo({x:HUB.jobs.x,y:TOWN.G+1,z:HUB.jobs.z}),
    walkToFarm:()=>e2eWalkTo({x:HUB.farm.x,y:TOWN.G+1,z:HUB.farm.z},3),
    usePrepRepairKit:()=>{const slot=inv.findIndex(s=>s&&s.id===I.REPAIR_KIT);return slot>=0&&useRepairKit(slot);},
    useDungeonExit:e2eUseDungeonExit,
    fleeDungeon:e2eFleeDungeon,
    enterTrackedGate:e2eEnterTrackedGate,
    debugTrace:()=>globalThis.BlockcraftDebug&&globalThis.BlockcraftDebug.dump?globalThis.BlockcraftDebug.dump():[],
    clearDebugTrace:()=>{if(globalThis.BlockcraftDebug&&globalThis.BlockcraftDebug.clear)globalThis.BlockcraftDebug.clear();return true;},
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
