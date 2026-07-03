import {api as worldApi,state as worldState} from './world.mjs';
const gameContext=window.BlockcraftGameContext;
const getB=worldApi.getBlock,setB=worldApi.setBlock;
/* Blockcraft dimensions runtime module. Ability spaces, dungeon dimensions, gates, decoration, and dimension HUD state.
 * Exposes a temporary live-binding compatibility surface for modules not yet migrated to ESM.
 */
// ---------------- ability pathways ----------------
const PATHS={
  shadow:{name:'Shadow Monarch', col:'#8b5cf6',
    desc:'Strike from darkness. Speed, lethality, and an army of shadows.',
    ab:[{n:'Shadow Dash',    g:'\u00bb',   mp:8,  sp:10, cd:4,  txt:'Rift forward to dodge, escape, or close distance'},
        {n:'Umbral Edge',    g:'\u25c8',   mp:15, sp:0,  cd:18, txt:'Empower melee hits with shadow damage for 10s'},
        {n:'Shadow Soldier', g:'\u265e',   mp:30, sp:0,  cd:40, txt:'Summon an ally that chases enemies and strikes for 30s'}]},
  mage:{name:'Arcane Magus', col:'#38bdf8',
    desc:'Bend fire, frost and storm to your will.',
    ab:[{n:'Fireball',   g:'\u2738', mp:10, sp:0, cd:2.5, txt:'Explosive bolt of flame'},
        {n:'Frost Nova', g:'\u2746', mp:22, sp:0, cd:14,  txt:'Chill and slow nearby foes'},
        {n:'Lightning',  g:'\u21af', mp:30, sp:0, cd:20,  txt:'Smite the target under your crosshair'}]},
  guardian:{name:'Iron Guardian', col:'#f59e0b',
    desc:'Endure all. Protect the town. Never fall.',
    ab:[{n:'Iron Skin',   g:'\u25a3', mp:12, sp:0,  cd:25, txt:'Halve damage taken for 15s'},
        {n:'Shockwave',   g:'\u25ce', mp:18, sp:15, cd:12, txt:'Slam the ground to blast nearby foes away'},
        {n:'Second Wind', g:'\u271a', mp:0,  sp:0,  cd:60, passive:true, txt:'Auto-heal when near death'}]},
};
const AB_UNLOCK=[2,5,8];
const abCd=[0,0,0];
let armorCd=0;
const projectiles=[], beams=[], allies=[], blackHoles=[];
const BETA_ABILITY_TEST=false;
let betaAbilityPath='shadow';
const BETA_LEGENDARY_TEST=true;
let betaLegendaryIndex=-1; // -1 = normal inventory hand

function viewDir(withPitch=true){
  return new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(withPitch?player.pitch:0, player.yaw, 0, 'YXZ'));
}
function activeAbilityPath(){
  return BETA_ABILITY_TEST ? (betaAbilityPath||S.path||'shadow') : (S.path||'');
}
function cycleBetaAbilityPath(){
  const paths=['shadow','mage','guardian'];
  const cur=activeAbilityPath();
  betaAbilityPath=paths[(paths.indexOf(cur)+1+paths.length)%paths.length];
  renderAbilities(); updateAbilityHUD();
  sysMsg('Beta abilities: <b>'+PATHS[betaAbilityPath].name+'</b>');
}
function sendProfileSaveNow(){
  if(!NET.on||!NET.room) return;
  try{
    const snap=netSnapshot();
    NET.room.send('save', snap);
    NET.lastSnap=JSON.stringify(snap);
    NET.lastSave=performance.now();
  }catch(e){}
}
function sendPlayerMetaNow(){
  if(!NET.on||!NET.room) return;
  try{
    const heldId=displayHeldId();
    NET.lastMeta=[S.path||'', heldId].join('|');
    NET.room.send('meta',{name:(document.getElementById('playername').value||'Hunter').slice(0,16), path:S.path||'', heldId});
  }catch(e){}
}
function setAbilityPath(path, opts={}){
  if(!PATHS[path]) return false;
  const firstPick=!S.path;
  S.path=path;
  betaAbilityPath=path;
  if(opts.message!==false){
    sysMsg((firstPick?'You walk':'You continue')+' the path of the <b>'+PATHS[S.path].name+'</b>');
  }
  if(player) burst(player.pos.x, player.pos.y+1, player.pos.z, [.4,.8,1], 30, 3, 3, .9);
  renderAbilities();
  if(typeof renderStat==='function' && statOpen) renderStat();
  if(typeof refreshAppearanceDummy==='function') refreshAppearanceDummy();
  sendPlayerMetaNow();
  sendProfileSaveNow();
  return true;
}
function equippedArmor(){
  return armorSlot && ITEMS[armorSlot.id] && ITEMS[armorSlot.id].armor ? armorSlot : null;
}
function equippedAegisArmor(){
  const armor=equippedArmor();
  return armor && ITEMS[armor.id].armor.power==='aegis' ? armor : null;
}
function removeEquippedArmorCopies(){
  const armor=equippedArmor();
  if(!armor) return false;
  let changed=false;
  for(let i=0;i<inv.length;i++){
    if(inv[i] && inv[i].id===armor.id){
      inv[i]=null;
      changed=true;
    }
  }
  return changed;
}
function selectedBlackholeStaff(){
  const testId=currentTestLegendaryId();
  if(testId===I.BLACKHOLE_STAFF) return {id:I.BLACKHOLE_STAFF,count:1,test:true};
  const s=inv[selected];
  return s && s.id===I.BLACKHOLE_STAFF ? s : null;
}
function selectedLegendaryWeapon(){
  const testId=currentTestLegendaryId();
  if(testId && ITEMS[testId] && ITEMS[testId].legendary)
    return {slot:{id:testId,count:1,test:true}, info:ITEMS[testId], kind:ITEMS[testId].legendary.kind, test:true};
  const s=inv[selected];
  if(!s || !ITEMS[s.id] || !ITEMS[s.id].legendary) return null;
  return {slot:s, info:ITEMS[s.id], kind:ITEMS[s.id].legendary.kind, test:false};
}
function legendaryTestIds(){
  return [I.BLACKHOLE_STAFF,I.CHRONO_DAGGER,I.TITAN_HAMMER,I.METEOR_STAFF,I.SOUL_REAPER_SCYTHE,I.GRAVITY_BOW,I.WARDEN_CLEAVER,I.ECLIPSE_KATANA,I.PHOENIX_SWORD,I.FROSTBITE_CHAKRAM,I.MIDAS_BLADE,I.LEVIATHAN_TRIDENT,I.VOID_ANCHOR].filter(id=>ITEMS[id]&&ITEMS[id].legendary);
}
function currentTestLegendaryId(){
  if(!BETA_LEGENDARY_TEST || betaLegendaryIndex<0) return 0;
  const ids=legendaryTestIds();
  return ids.length ? ids[betaLegendaryIndex%ids.length] : 0;
}
function displayHeldId(){
  return currentTestLegendaryId() || (inv[selected]?inv[selected].id:0);
}
function cycleBetaLegendaryWeapon(){
  const ids=legendaryTestIds();
  betaLegendaryIndex++;
  if(betaLegendaryIndex>=ids.length) betaLegendaryIndex=-1;
  vmLastId=-999; updateViewModel(); renderAbilities(); updateAbilityHUD(); refreshAppearanceDummy();
  const id=currentTestLegendaryId();
  sysMsg(id ? 'Test weapon: <b>'+ITEMS[id].name+'</b> <span class="hint">F / LMB to cast</span>' : 'Test weapon cycle: <b>normal hand</b>');
}
const legendaryWeaponCd={};
function makeBlackholeVisual(x,y,z){
  const grp=new THREE.Group();
  const core=new THREE.Mesh(new THREE.SphereGeometry(.38,18,12),
    new THREE.MeshBasicMaterial({color:0x020006, transparent:true, opacity:.96, depthWrite:false}));
  grp.add(core);
  const ringMat=new THREE.MeshBasicMaterial({color:0x9b6be8, transparent:true, opacity:.72, blending:THREE.AdditiveBlending, depthWrite:false});
  for(let i=0;i<3;i++){
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.62+i*.16,.025,8,36), ringMat.clone());
    ring.rotation.set(Math.PI/2, i*.7, i*.35);
    grp.add(ring);
  }
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({
    map:new THREE.CanvasTexture(glowTexCanvas), color:0x8b5cff, transparent:true,
    opacity:.55, depthWrite:false, depthTest:false, blending:THREE.AdditiveBlending
  }));
  glow.scale.set(2.2,2.2,1); grp.add(glow);
  grp.position.set(x,y,z); scene.add(grp);
  blackHoles.push({grp, life:3, t:0});
  return grp;
}
function chronoSnapVfx(x,y,z){
  SFX.cast();
  ringPulse(x,y+.08,z,1.1,0x53fff6,.35);
  ringPulse(x,y+.08,z,1.8,0xb86cff,.45);
  glowFlash(x,y+1,z,0x67fff2,3.2,.28);
  burst(x,y+1,z,[.35,1,.9],28,2.7,2.5,.55);
  for(let k=0;k<18;k++){
    const a=Math.random()*Math.PI*2;
    spawnParticle({x:x+Math.cos(a)*.8,y:y+.4+Math.random()*1.7,z:z+Math.sin(a)*.8,
      vx:Math.cos(a)*1.5,vy:.6+Math.random()*1.3,vz:Math.sin(a)*1.5,life:.55,grav:.5,r:.35,g:1,b:.9});
  }
}
function titanHammerVfx(x,y,z){
  shockwaveEarthVfx(x,y,z,true);
  ringPulse(x,y+.08,z,5.2,0xffd24a,.45);
  for(let k=0;k<18;k++){
    const a=Math.random()*Math.PI*2, r=1.4+Math.random()*3.8;
    spawnParticle({x:x+Math.cos(a)*r,y:y+.1,z:z+Math.sin(a)*r,
      vx:Math.cos(a)*4,vy:2.8+Math.random()*3,vz:Math.sin(a)*4,life:.6,grav:8,r:.95,g:.74,b:.36});
  }
}
function meteorMarkVfx(x,y,z){
  SFX.cast();
  for(let i=0;i<4;i++) setTimeout(()=>ringPulse(x,y+.08,z,1.3+i*.45,0xff6a1a,.34),i*120);
  glowFlash(x,y+.5,z,0xff6a1a,4.5,.8);
  for(let k=0;k<26;k++){
    const a=Math.random()*Math.PI*2, r=.5+Math.random()*2.6;
    spawnParticle({x:x+Math.cos(a)*r,y:y+.2,z:z+Math.sin(a)*r,vx:0,vy:1.2+Math.random()*2,vz:0,
      life:.65+Math.random()*.4,grav:0,r:1,g:.38,b:.08});
  }
}
function meteorImpactVfx(x,y,z){
  SFX.boom(); camShake=Math.max(camShake,.75);
  addLightningBeam(x,y+14,z,x,y+.2,z,1.7);
  fireballExplodeVfx(x,y+.25,z);
  ringPulse(x,y+.08,z,4.8,0xffd24a,.4);
  burst(x,y+.5,z,[1,.36,.05],64,7,4.8,.8);
}
function soulReapVfx(x,y,z){
  SFX.cast();
  ringPulse(x,y+.08,z,1.5,0xc084fc,.42);
  ringPulse(x,y+1.05,z,.62,0x3b0764,.48);
  glowFlash(x,y+1,z,0x8b5cf6,4.0,.35);
  burst(x,y+1,z,[.62,.28,1],36,3.2,3.2,.7);
  for(let k=0;k<8;k++){
    const a=(k/8)*Math.PI*2+Math.random()*.22, r=1.25+Math.random()*.75;
    const sx=x+Math.cos(a)*r, sy=y+.45+Math.random()*1.65, sz=z+Math.sin(a)*r;
    energyTrailVfx(sx,sy,sz,x,y+1.05,z,0x7e22ce,.025+.018*Math.random(),.38,.62);
    energyTrailVfx(sx*.35+x*.65,sy*.7+(y+1.05)*.3,sz*.35+z*.65,x,y+1.2,z,0xd8b4fe,.012,.28,.75);
  }
  for(let k=0;k<32;k++){
    const a=Math.random()*Math.PI*2, r=.5+Math.random()*1.8;
    spawnParticle({x:x+Math.cos(a)*r,y:y+.5+Math.random()*1.5,z:z+Math.sin(a)*r,
      vx:-Math.cos(a)*2.2,vy:.4+Math.random()*1.6,vz:-Math.sin(a)*2.2,life:.7,grav:0,r:.48,g:.16,b:.9});
  }
}
function gravityBowVfx(x,y,z){
  SFX.cast();
  const column=new THREE.Mesh(new THREE.CylinderGeometry(.85,1.18,2.7,20,1,true),
    new THREE.MeshBasicMaterial({color:0x7dd3fc, transparent:true, opacity:.18, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide}));
  column.position.set(x,y+1.45,z);
  scene.add(column); beams.push({mesh:column,life:.5,spin:1.8});
  ringPulse(x,y+.1,z,1.2,0x7dd3fc,.4);
  [0,.18,.36,.54].forEach((delay,i)=>setTimeout(()=>{
    ringPulse(x,y+.65+i*.55,z,1.1+i*.22,i%2?0xd8b4fe:0x7dd3fc,.5);
  },delay*1000));
  glowFlash(x,y+2.2,z,0x7dd3fc,4.2,.38);
  for(let k=0;k<42;k++){
    const a=Math.random()*Math.PI*2, r=.4+Math.random()*1.5;
    spawnParticle({x:x+Math.cos(a)*r,y:y+.15,z:z+Math.sin(a)*r,
      vx:Math.cos(a)*.5,vy:3+Math.random()*3.5,vz:Math.sin(a)*.5,life:.75,grav:0,r:.45,g:.78,b:1});
  }
}
function wardenSonicVfx(x,y,z,dx,dz){
  SFX.boom(); camShake=Math.max(camShake,.42);
  const len=13, nx=dx||1, nz=dz||0;
  for(let i=1;i<=9;i++){
    const px=x+nx*i*1.35, pz=z+nz*i*1.35, gy=standHeight(px,pz,y+3);
    setTimeout(()=>{ ringPulse(px,(gy>0?gy:y)+.08,pz,.65+i*.08,0x35d0c8,.28); burst(px,(gy>0?gy:y)+.5,pz,[.2,.9,.85],10,2.4,2.1,.35); },i*35);
  }
  addLightningBeam(x,y+1.2,z,x+nx*len,y+1.2,z+nz*len,1.1);
}
function eclipseDashVfx(x1,y1,z1,x2,y2,z2){
  SFX.cast(); camShake=Math.max(camShake,.24);
  shadowDashVfx({x:x1,y:y1,z:z1},{x:x2,y:y2,z:z2});
  energyTrailVfx(x1,y1+.25,z1,x2,y2+.25,z2,0x14051f,.11,.42,.8);
  energyTrailVfx(x1,y1+1.15,z1,x2,y2+1.15,z2,0xa855f7,.035,.28,.85);
  ringPulse(x1,y1+.08,z1,1.0,0x8b5cf6,.35);
  ringPulse(x2,y2+.08,z2,1.5,0x0f0618,.4);
  glowFlash(x2,y2+1,z2,0x8b5cf6,3.6,.28);
  burst(x2,y2+1,z2,[.45,.18,.9],32,3.6,2.8,.65);
}
function phoenixFlameVfx(x,y,z,rebirth){
  SFX.boom(); camShake=Math.max(camShake,rebirth?.6:.32);
  ringPulse(x,y+.08,z,rebirth?3.2:1.6,0xffd24a,.42);
  glowFlash(x,y+1,z,0xff7a1a,rebirth?5.5:3.8,.38);
  const wing=rebirth?2.8:1.7;
  for(const side of [-1,1]){
    energyTrailVfx(x,y+.95,z,x+side*wing,y+1.45,z-.45,0xffd24a,.055,.36,.9);
    energyTrailVfx(x+side*.4,y+1.15,z,x+side*wing*.82,y+.55,z+.55,0xff6a1a,.045,.42,.78);
    glowFlash(x+side*wing*.72,y+1.02,z+.05,0xff9f1a,rebirth?2.8:1.8,.24);
  }
  burst(x,y+1,z,[1,.38,.05],rebirth?62:34,rebirth?5.8:3.8,3.6,.78);
  for(let k=0;k<(rebirth?55:28);k++){
    const a=Math.random()*Math.PI*2, r=Math.random()*(rebirth?2.6:1.4);
    spawnParticle({x:x+Math.cos(a)*r,y:y+.2,z:z+Math.sin(a)*r,vx:Math.cos(a)*2,vy:2+Math.random()*3.8,vz:Math.sin(a)*2,life:.7,grav:1,r:1,g:.45,b:.08});
  }
}
function frostbiteChakramVfx(points){
  SFX.cast();
  if(!Array.isArray(points) || !points.length) return;
  for(let i=0;i<points.length;i++){
    const p=points[i];
    flatDiscVfx(p.x,p.y+1.05,p.z,0xdff8ff,.36,.42,Math.PI/2);
    flatDiscVfx(p.x,p.y+1.05,p.z,0x60d8ff,.58,.36,Math.PI/2);
    ringPulse(p.x,p.y+.08,p.z,1.1,0x9bdcff,.35);
    burst(p.x,p.y+1,p.z,[.65,.9,1],22,2.9,2.4,.55);
    if(i>0){
      const q=points[i-1];
      energyTrailVfx(q.x,q.y+1.05,q.z,p.x,p.y+1.05,p.z,0xdff8ff,.035,.36,.8);
      energyTrailVfx(q.x,q.y+.9,q.z,p.x,p.y+.9,p.z,0x38bdf8,.018,.42,.75);
      for(let j=0;j<8;j++){
        const f=(j+1)/9, tx=q.x+(p.x-q.x)*f, ty=q.y+1+(p.y-q.y)*f, tz=q.z+(p.z-q.z)*f;
        spawnParticle({x:tx+(Math.random()-.5)*.25,y:ty+(Math.random()-.5)*.2,z:tz+(Math.random()-.5)*.25,
          vx:(Math.random()-.5)*.6,vy:.15+Math.random()*.6,vz:(Math.random()-.5)*.6,life:.42,grav:.5,r:.7,g:.93,b:1});
      }
    }
  }
}
function midasStrikeVfx(x,y,z,bonus){
  SFX.coin(); camShake=Math.max(camShake,.22);
  ringPulse(x,y+.08,z,1.4,0xffd24a,.36);
  glowFlash(x,y+1,z,0xffd24a,3.8+(bonus||0)*.08,.28);
  coinBurstVfx(x,y,z,8+Math.min(10,bonus||0));
  burst(x,y+1,z,[1,.82,.2],28+(bonus||0),3.2,2.8,.55);
  for(let k=0;k<18;k++){
    const a=Math.random()*Math.PI*2;
    spawnParticle({x:x+Math.cos(a)*.8,y:y+.5+Math.random(),z:z+Math.sin(a)*.8,
      vx:Math.cos(a)*2,vy:1.4+Math.random()*2.4,vz:Math.sin(a)*2,life:.55,grav:4,r:1,g:.82,b:.18});
  }
}
function leviathanStormVfx(points){
  SFX.cast(); camShake=Math.max(camShake,.32);
  if(!Array.isArray(points)||!points.length) return;
  for(let i=0;i<points.length;i++){
    const p=points[i];
    ringPulse(p.x,p.y+.08,p.z,1.2,0x7dd3fc,.34);
    ringPulse(p.x,p.y+.1,p.z,1.75,0x1d9bf0,.46);
    splashBurstVfx(p.x,p.y,p.z,22,1.35);
    flatDiscVfx(p.x,p.y+.16,p.z,0x7dd3fc,.8,.36,Math.PI/2);
    burst(p.x,p.y+1,p.z,[.45,.85,1],24,3.1,3.0,.5);
    addLightningBeam(p.x,p.y+9,p.z,p.x,p.y+1,p.z,1.25);
    if(i>0){
      const q=points[i-1];
      energyTrailVfx(q.x,q.y+.55,q.z,p.x,p.y+.55,p.z,0x0ea5e9,.07,.48,.62);
      addLightningBeam(q.x,q.y+1,q.z,p.x,p.y+1,p.z,.85);
    }
  }
}
function voidAnchorVfx(x,y,z){
  SFX.cast(); camShake=Math.max(camShake,.28);
  ringPulse(x,y+.08,z,2.2,0x8b5cf6,.55);
  ringPulse(x,y+.08,z,4.4,0x3b1b60,.7);
  glowFlash(x,y+.8,z,0x8b5cf6,5.2,.6);
  burst(x,y+.6,z,[.45,.18,.9],42,3.4,2.5,.8);
  for(let k=0;k<42;k++){
    const a=Math.random()*Math.PI*2, r=1+Math.random()*4.2;
    spawnParticle({x:x+Math.cos(a)*r,y:y+.15+Math.random()*1.4,z:z+Math.sin(a)*r,
      vx:-Math.cos(a)*1.8,vy:.5+Math.random(),vz:-Math.sin(a)*1.8,life:.9,grav:0,r:.45,g:.18,b:.9});
  }
}
function castLegendaryWeapon(){
  const lw=selectedLegendaryWeapon();
  if(!lw) return false;
  if(lw.kind==='blackhole') return castBlackholeStaff();
  const now=performance.now()/1000;
  const cd=lw.info.legendary.cd||10;
  if((legendaryWeaponCd[lw.kind]||0)>now) return true;
  const mob=mobUnderCrosshair(lw.kind==='titan'?5:28);
  if((lw.kind==='chrono'||lw.kind==='meteor'||lw.kind==='soul'||lw.kind==='gravity'||lw.kind==='eclipse'||lw.kind==='phoenix'||lw.kind==='frostbite'||lw.kind==='midas'||lw.kind==='leviathan') && !mob){
    sysMsg('No target in sight for <b>'+lw.info.name+'</b>');
    return true;
  }
  legendaryWeaponCd[lw.kind]=now+cd;
  vmSwing();
  const pos=mob?mob.grp.position:player.pos;
  if(lw.kind==='chrono'){
    chronoSnapVfx(pos.x,pos.y,pos.z);
    if(mob.net && NET.room) NET.room.send('legendaryWeapon',{kind:'chrono', id:mob.netId, slot:selected, testWeapon:!!lw.test});
    else {
      const snap={x:pos.x,y:pos.y,z:pos.z};
      mob.slowT=Math.max(mob.slowT||0,4);
      sysMsg('<b>Chrono Dagger</b>: target marked for rewind');
      setTimeout(()=>{ if(mob.grp){ mob.grp.position.set(snap.x,snap.y,snap.z); chronoSnapVfx(snap.x,snap.y,snap.z); damageMob(mob,10,null); } },4000);
    }
  } else if(lw.kind==='titan'){
    const p=player.pos;
    titanHammerVfx(p.x,p.y,p.z);
    if(NET.on && NET.room) NET.room.send('legendaryWeapon',{kind:'titan', slot:selected, testWeapon:!!lw.test});
    else {
      for(const m of mobs){
        const mp=m.grp.position, d=Math.hypot(mp.x-p.x,mp.z-p.z);
        if(d<5.5){ m.kb&&m.kb.add(new THREE.Vector3((mp.x-p.x)/(d||1)*5,0,(mp.z-p.z)/(d||1)*5)); damageMob(m,14,null); }
      }
      breakAbilityBlocks(p.x,p.y+.2,p.z,2.9,18);
    }
  } else if(lw.kind==='meteor'){
    meteorMarkVfx(pos.x,pos.y,pos.z);
    if(mob.net && NET.room) NET.room.send('legendaryWeapon',{kind:'meteor', id:mob.netId, slot:selected, testWeapon:!!lw.test});
    else {
      sysMsg('<b>Meteor Staff</b>: impact incoming');
      setTimeout(()=>{ const p=mob.grp?mob.grp.position:pos; meteorImpactVfx(p.x,p.y,p.z); for(const m of mobs){ const mp=m.grp.position; if(Math.hypot(mp.x-p.x,mp.z-p.z)<4.4) damageMob(m,22,null); } breakAbilityBlocks(p.x,p.y,p.z,2.4,14); },1250);
    }
  } else if(lw.kind==='soul'){
    soulReapVfx(pos.x,pos.y,pos.z);
    if(mob.net && NET.room) NET.room.send('legendaryWeapon',{kind:'soul', id:mob.netId, slot:selected, testWeapon:!!lw.test});
    else { hp=Math.min(maxHp(),hp+8); renderBars(); damageMob(mob,18,null); sysMsg('<b>Soul Reaper Scythe</b>: life stolen'); }
  } else if(lw.kind==='gravity'){
    gravityBowVfx(pos.x,pos.y,pos.z);
    if(mob.net && NET.room) NET.room.send('legendaryWeapon',{kind:'gravity', id:mob.netId, slot:selected, testWeapon:!!lw.test});
    else {
      mob.slowT=Math.max(mob.slowT||0,2.5);
      const start=pos.clone();
      for(let k=0;k<34;k++) setTimeout(()=>{ if(mob.grp){ const u=k/33; mob.grp.position.y=start.y+Math.sin(u*Math.PI)*4; } },k*45);
      setTimeout(()=>{ if(mob.grp){ damageMob(mob,14,null); } },1600);
    }
  } else if(lw.kind==='warden'){
    const d=viewDir(false);
    wardenSonicVfx(player.pos.x,player.pos.y,player.pos.z,d.x,d.z);
    if(NET.on && NET.room) NET.room.send('legendaryWeapon',{kind:'warden', slot:selected, dx:d.x, dz:d.z, testWeapon:!!lw.test});
    else {
      for(const m of mobs){
        const mp=m.grp.position, rx=mp.x-player.pos.x, rz=mp.z-player.pos.z, along=rx*d.x+rz*d.z;
        if(along>0 && along<14 && Math.abs(rx*d.z-rz*d.x)<1.5) damageMob(m,20,null);
      }
      for(let k=1;k<=8;k++) breakAbilityBlocks(player.pos.x+d.x*k*1.4,player.pos.y+.8,player.pos.z+d.z*k*1.4,1.1,4);
    }
  } else if(lw.kind==='eclipse'){
    const p=mob.grp.position, d=viewDir(false);
    const sx=player.pos.x, sy=player.pos.y, sz=player.pos.z;
    const bx=p.x+d.x*1.4, bz=p.z+d.z*1.4, by=standHeight(bx,bz,p.y+4);
    eclipseDashVfx(sx,sy,sz,bx,by>0?by:p.y,bz);
    if(mob.net && NET.room) NET.room.send('legendaryWeapon',{kind:'eclipse', id:mob.netId, slot:selected, dx:d.x, dz:d.z, testWeapon:!!lw.test});
    else { player.pos.x=bx; player.pos.z=bz; if(by>0) player.pos.y=by; mob.slowT=Math.max(mob.slowT||0,2); damageMob(mob,16,null); }
  } else if(lw.kind==='phoenix'){
    phoenixFlameVfx(pos.x,pos.y,pos.z,false);
    if(mob.net && NET.room) NET.room.send('legendaryWeapon',{kind:'phoenix', id:mob.netId, slot:selected, testWeapon:!!lw.test});
    else { damageMob(mob,18,null); for(const m of mobs){ const mp=m.grp.position; if(m!==mob && Math.hypot(mp.x-pos.x,mp.z-pos.z)<2.8) damageMob(m,8,null); } }
  } else if(lw.kind==='frostbite'){
    const pts=[{x:pos.x,y:pos.y,z:pos.z}];
    if(NET.room && mob.net) NET.room.send('legendaryWeapon',{kind:'frostbite', id:mob.netId, slot:selected, testWeapon:!!lw.test});
    else {
      let prev=mob; const hit=new Set();
      for(let i=0;i<4 && prev;i++){
        const pp=prev.grp.position; pts.push({x:pp.x,y:pp.y,z:pp.z}); hit.add(prev);
        prev.slowT=Math.max(prev.slowT||0,3); damageMob(prev,Math.max(6,14-i*2),null);
        let best=null, bd=6;
        for(const m of mobs){ if(hit.has(m)) continue; const mp=m.grp.position; const d2=Math.hypot(mp.x-pp.x,mp.z-pp.z); if(d2<bd){ bd=d2; best=m; } }
        prev=best;
      }
      frostbiteChakramVfx(pts);
    }
  } else if(lw.kind==='midas'){
    const bonus=Math.min(18, Math.floor((gold||0)/50));
    midasStrikeVfx(pos.x,pos.y,pos.z,bonus);
    if(mob.net && NET.room) NET.room.send('legendaryWeapon',{kind:'midas', id:mob.netId, slot:selected, testWeapon:!!lw.test});
    else { damageMob(mob,12+bonus,null); sysMsg('<b>Midas Blade</b>: gold-fed strike +'+bonus); }
  } else if(lw.kind==='leviathan'){
    const pts=[{x:player.pos.x,y:player.pos.y,z:player.pos.z}];
    if(mob.net && NET.room) NET.room.send('legendaryWeapon',{kind:'leviathan', id:mob.netId, slot:selected, testWeapon:!!lw.test});
    else {
      let prev=mob; const hit=new Set();
      for(let i=0;i<4 && prev;i++){
        const pp=prev.grp.position; pts.push({x:pp.x,y:pp.y,z:pp.z}); hit.add(prev);
        prev.slowT=Math.max(prev.slowT||0,1.2); damageMob(prev,Math.max(8,18-i*3),null);
        let best=null, bd=7;
        for(const m of mobs){ if(hit.has(m)) continue; const mp=m.grp.position; const d2=Math.hypot(mp.x-pp.x,mp.z-pp.z); if(d2<bd){ bd=d2; best=m; } }
        prev=best;
      }
      leviathanStormVfx(pts);
    }
  } else if(lw.kind==='anchor'){
    const d=viewDir(false);
    const ax=player.pos.x+d.x*3.2, az=player.pos.z+d.z*3.2, ay=standHeight(ax,az,player.pos.y+4);
    voidAnchorVfx(ax,ay>0?ay:player.pos.y,az);
    if(NET.on && NET.room) NET.room.send('legendaryWeapon',{kind:'anchor', slot:selected, x:ax, y:ay>0?ay:player.pos.y, z:az, testWeapon:!!lw.test});
    else {
      for(const m of mobs){ const mp=m.grp.position; if(Math.hypot(mp.x-ax,mp.z-az)<4.8){ m.slowT=Math.max(m.slowT||0,4); damageMob(m,8,null); } }
      breakAbilityBlocks(ax,(ay>0?ay:player.pos.y)+.2,az,1.6,8);
    }
  }
  return true;
}
function startBlackholeMob(mob, serverOwned=false){
  if(!mob || mob.blackhole) return;
  const p=mob.grp.position;
  mob.blackhole={t:0,total:2.8,sx:p.x,sy:p.y,sz:p.z,cx:p.x,cy:p.y+4.8,cz:p.z,serverOwned};
  mob.slowT=Math.max(mob.slowT||0,2.8);
  if(mob.mats) mob.mats.forEach(mm=>mm.color.setRGB(.42,.18,.8));
  makeBlackholeVisual(p.x,p.y+4.8,p.z);
  SFX.cast();
  burst(p.x,p.y+1,p.z,[.45,.18,.9],24,2.4,3.4,.7);
}
function tickBlackholedMob(mob, dt){
  const bh=mob.blackhole; if(!bh) return false;
  bh.t+=dt;
  const u=Math.min(1,bh.t/bh.total);
  const swirl=u*Math.PI*9;
  const r=Math.max(0,(1-u)*1.05);
  mob.grp.position.set(bh.cx+Math.cos(swirl)*r, bh.sy+(bh.cy-bh.sy)*Math.sin(u*Math.PI*.85), bh.cz+Math.sin(swirl)*r);
  mob.grp.rotation.y+=dt*10;
  mob.grp.scale.setScalar(Math.max(.08,1-u*.55));
  if(Math.random()<dt*80){
    const a=Math.random()*Math.PI*2, rr=.6+Math.random()*1.8;
    spawnParticle({x:bh.cx+Math.cos(a)*rr,y:bh.cy+(Math.random()-.5)*2,z:bh.cz+Math.sin(a)*rr,
      vx:-Math.cos(a)*3,vy:(Math.random()-.5)*1.4,vz:-Math.sin(a)*3,life:.45,grav:0,r:.45,g:.18,b:.9});
  }
  if(u>=1 && !bh.serverOwned){
    burst(bh.cx,bh.cy,bh.cz,[.55,.18,1],42,4.8,1.2,.75);
    damageMob(mob, mob.boss?34:9999, null);
    if(mob.grp) mob.grp.scale.setScalar(1);
    mob.blackhole=null;
  } else if(u>=1 && bh.serverOwned && mob.ref && (mob.ref.state||'')!=='blackhole'){
    if(mob.grp) mob.grp.scale.setScalar(1);
    mob.blackhole=null;
    return false;
  }
  return true;
}
function tickBlackholes(dt){
  for(let i=blackHoles.length-1;i>=0;i--){
    const h=blackHoles[i]; h.t+=dt; h.life-=dt;
    h.grp.rotation.y+=dt*2.8;
    h.grp.rotation.x+=dt*.7;
    const pulse=1+Math.sin(h.t*8)*.08;
    h.grp.scale.setScalar(pulse);
    for(let j=0;j<h.grp.children.length;j++){
      const c=h.grp.children[j];
      if(c.material && c.material.opacity!=null) c.material.opacity=Math.max(0, c.material.opacity-(dt*.12));
      if(c.geometry && c.geometry.type==='TorusGeometry') c.rotation.z+=dt*(2+j);
    }
    if(h.life<=0){ scene.remove(h.grp); blackHoles.splice(i,1); }
  }
}
function castBlackholeStaff(){
  if(!selectedBlackholeStaff()) return false;
  if(blackholeCd>0) return true;
  const mob=mobUnderCrosshair(26);
  if(!mob){ sysMsg('No target in sight for <b>Blackhole Staff</b>'); return true; }
  blackholeCd=9;
  vmSwing();
  startBlackholeMob(mob, !!mob.net);
  if(mob.net && NET.room) NET.room.send('blackhole',{id:mob.netId, slot:selected, testWeapon:!!selectedBlackholeStaff().test});
  else sysMsg('<b>Blackhole Staff</b>: gravity collapses around the target');
  return true;
}
function castArmorPower(){
  const armor=equippedAegisArmor();
  if(!armor){ sysMsg('Equip legendary armor to use <b>Aegis Pulse</b>'); return; }
  if(armorCd>0) return;
  armorCd=28;
  buffs.aegis=8;
  buffs.regen=Math.max(buffs.regen,8);
  hp=Math.min(maxHp(), hp+Math.round(maxHp()*.18));
  renderBars();
  SFX.cast();
  burst(player.pos.x, player.pos.y+1, player.pos.z, [1,.82,.25], 34, 3.2, 2.8, .9);
  sysMsg('<b>Aegis Pulse</b> surges from your legendary armor');
}
function cast(i){
  const path=activeAbilityPath();
  if(!path){ if(S.lvl>=2) sysMsg('Press <b>C</b> to choose your path first'); return; }
  if(!BETA_ABILITY_TEST && S.lvl<AB_UNLOCK[i]){ sysMsg('Unlocks at <b>Level '+AB_UNLOCK[i]+'</b>'); return; }
  const a=PATHS[path].ab[i];
  if(a.passive){ sysMsg('<b>'+a.n+'</b> is passive'); return; }
  if(abCd[i]>0) return;
  if(mp<a.mp){ sysMsg('Not enough <b>mana</b>'); return; }
  if(sp<a.sp){ sysMsg('Not enough <b>stamina</b>'); return; }
  if(abilityTrainingActive && i===0) noteAbilityTrainingCast();
  if(NET.on && NET.room){
    sendAbilityRequest(path,i,a);
    return;
  }
  if(doAbility(path,i)===false) return;
  mp-=a.mp; sp=Math.max(0,sp-a.sp); abCd[i]=a.cd;
  SFX.cast();
  renderBars();
}
function sendAbilityRequest(path,i,a){
  const d=viewDir();
  const target=mobUnderCrosshair(path==='mage'&&i===2?22:24);
  NET.room.send('ability',{
    path, slot:i,
    targetId:target&&target.net?target.netId:'',
    dx:d.x, dy:d.y, dz:d.z
  });
  mp-=a.mp; sp=Math.max(0,sp-a.sp); abCd[i]=a.cd;
  if((path==='shadow' && (i===0||i===1||i===2)) || (path==='guardian' && i===0)){
    doAbility(path,i);
  }
  SFX.cast();
  renderBars(); updateAbilityHUD();
}
// solo block destruction on ability impact (mirrors the server's breakBlocksInRadius)
const ABILITY_BREAKABLE_C=new Set([B.GRASS,B.DIRT,B.STONE,B.SAND,B.LOG,B.LEAVES,B.PLANKS,B.COBBLE,B.GLASS,B.BRICK,B.TABLE,B.COAL_ORE,B.IRON_ORE,B.DIAMOND_ORE,B.CONCRETE,B.TORCH,B.BED,B.SNOW,B.ICE,B.RED_SAND,B.TERRACOTTA,B.CACTUS,B.LANTERN,B.CAMPFIRE,B.EGG_INSULATOR]);
function breakAbilityBlocks(x,y,z,radius,maxBreaks){
  if(NET.on) return 0;                                   // server breaks blocks authoritatively in multiplayer
  const cands=[];
  const minX=Math.floor(x-radius),maxX=Math.ceil(x+radius);
  const minY=Math.max(1,Math.floor(y-radius)),maxY=Math.ceil(y+radius);
  const minZ=Math.floor(z-radius),maxZ=Math.ceil(z+radius);
  for(let bx=minX;bx<=maxX;bx++)for(let by=minY;by<=maxY;by++)for(let bz=minZ;bz<=maxZ;bz++){
    if(!inWorld(bx,by,bz)) continue;
    const d=Math.hypot(bx+.5-x,by+.5-y,bz+.5-z);
    if(d>radius) continue;
    if(!ABILITY_BREAKABLE_C.has(getB(bx,by,bz))) continue;
    cands.push({x:bx,y:by,z:bz,d});
  }
  cands.sort((a,b)=>a.d-b.d);
  const hit=cands.slice(0,maxBreaks);
  if(!hit.length) return 0;
  const chunks=new Set();
  for(const b of hit){
    setB(b.x,b.y,b.z,B.AIR);
    const cx=Math.floor(b.x/CHUNK),cz=Math.floor(b.z/CHUNK);
    chunks.add(cx+','+cz);
    if(b.x%CHUNK===0)chunks.add((cx-1)+','+cz); if(b.x%CHUNK===CHUNK-1)chunks.add((cx+1)+','+cz);
    if(b.z%CHUNK===0)chunks.add(cx+','+(cz-1)); if(b.z%CHUNK===CHUNK-1)chunks.add(cx+','+(cz+1));
    for(let k=0;k<4;k++) spawnParticle({x:b.x+.5+(Math.random()-.5)*.6,y:b.y+.4+Math.random()*.4,z:b.z+.5+(Math.random()-.5)*.6,
      vx:(Math.random()-.5)*3,vy:1+Math.random()*2.2,vz:(Math.random()-.5)*3,life:.5,grav:9,r:.55,g:.46,b:.34});
  }
  chunks.forEach(ck=>{ const a=ck.split(','); rebuildChunk(+a[0],+a[1]); });
  return hit.length;
}
function doAbility(path,i){
  const px=player.pos.x, py=player.pos.y, pz=player.pos.z;
  if(path==='shadow'){
    if(i===0){
      const d=viewDir(false);
      const start={x:player.pos.x,y:player.pos.y,z:player.pos.z};
      for(let st=0;st<26;st++){
        moveAxis('x', d.x*.24); moveAxis('z', d.z*.24);
        if(st%2===0) spawnParticle({x:player.pos.x, y:player.pos.y+.5+Math.random(), z:player.pos.z,
          vx:(Math.random()-.5)*.25, vy:.3, vz:(Math.random()-.5)*.25, life:.4, grav:0, r:.55, g:.35, b:1});
      }
      shadowDashVfx(start,{x:player.pos.x,y:player.pos.y,z:player.pos.z});
      camShake=Math.max(camShake,.16);
    } else if(i===1){
      buffs.dmg=10;
      burst(px,py+1,pz,[.55,.35,1],22,2.6,2.4,.6);
      umbralEdgeVfx(px,py,pz,.95,player.yaw);
      sysMsg('<b>Umbral Edge</b>: your strikes are empowered');
    } else spawnAlly();
  } else if(path==='mage'){
    if(i===0){
      const d=viewDir();
      const grp=fireballMesh();
      grp.position.set(px+d.x*.7, py+player.eye+d.y*.7, pz+d.z*.7);
      scene.add(grp);
      projectiles.push({grp, vel:d.multiplyScalar(15), life:2.4});
    } else if(i===1){
      frostNovaVfx(px,py,pz,true);
      for(const m of [...mobs]){
        const d2=Math.hypot(m.grp.position.x-px, m.grp.position.z-pz);
        if(d2<6.5){
          m.slowT=4;
          m.mats.forEach(mm=>mm.color.setRGB(.55,.75,1));
          iceLockVfx(m.grp.position.x,m.grp.position.y,m.grp.position.z);
          damageMob(m, 6+(S.int-1)*.4, null);
        }
      }
      breakAbilityBlocks(px,py+.4,pz,2.0,8);
    } else {
      const mob=mobUnderCrosshair(22);
      if(!mob){ sysMsg('No target in sight'); return false; }
      lightningStrikeVfx(mob.grp.position.x, mob.grp.position.y, mob.grp.position.z, null);
      addLightningBeam(player.pos.x,player.pos.y+1.3,player.pos.z,mob.grp.position.x,mob.grp.position.y+1,mob.grp.position.z,1.45);
      damageMob(mob, 18+(S.int-1)*.8, null);
      breakAbilityBlocks(mob.grp.position.x,mob.grp.position.y+.5,mob.grp.position.z,1.4,5);
    }
  } else {
    if(i===0){
      buffs.armor=15;
      burst(px,py+1,pz,[.95,.78,.3],20,2.2,2.4,.6);
      guardShellVfx(px,py,pz,1.1);
      sysMsg('<b>Iron Skin</b>: damage halved');
    } else if(i===1){
      shockwaveEarthVfx(px,py,pz,true);
      for(const m of [...mobs]){
        const dx=m.grp.position.x-px, dz=m.grp.position.z-pz, d2=Math.hypot(dx,dz);
        if(d2<5.5 && d2>0.01){
          ringPulse(m.grp.position.x,m.grp.position.y+.08,m.grp.position.z,.85,0xe0b15a,.35);
          damageMob(m, 5+(S.str-1)*.3, new THREE.Vector3(dx/d2*3.5,0,dz/d2*3.5));
        }
      }
      breakAbilityBlocks(px,py+.2,pz,2.8,16);
    }
  }
}
// the Shadow Soldier
function makeShadow(){
  const grp=new THREE.Group(), mats=[], legs=[], arms=[];
  const reg=m=>{mats.push(m);return m;};
  const darkM=reg(lam(solidTex('#241c3a','#181228')));
  const skinM=reg(lam(solidTex('#3a2f5e','#2c2348')));
  const head=new THREE.Mesh(new THREE.BoxGeometry(.5,.5,.5), skinM); head.position.y=1.65; grp.add(head);
  for(const ex of [-.1,.1]){
    const eye=new THREE.Mesh(new THREE.BoxGeometry(.07,.06,.02), new THREE.MeshBasicMaterial({color:0xb08aff}));
    eye.position.set(ex,.04,.26); head.add(eye);
  }
  const torso=new THREE.Mesh(new THREE.BoxGeometry(.5,.7,.26), darkM); torso.position.y=1.05; grp.add(torso);
  for(const sx of [-.13,.13]){
    const lg=new THREE.BoxGeometry(.2,.7,.2); lg.translate(0,-.35,0);
    const leg=new THREE.Mesh(lg, darkM); leg.position.set(sx,.7,0); grp.add(leg); legs.push(leg);
  }
  for(const sx of [-.21,.21]){
    const ag=new THREE.BoxGeometry(.16,.16,.62); ag.translate(0,0,.31);
    const arm=new THREE.Mesh(ag, skinM); arm.position.set(sx,1.28,.05); grp.add(arm); arms.push(arm);
  }
  grp.add(blobShadow(1));
  return {grp, mats, legs, arms};
}
function spawnAlly(){
  while(allies.length){ scene.remove(allies[0].grp); allies.shift(); }
  const a={...makeShadow(), life:30, atkCd:0, phase:Math.random()*10};
  const d=viewDir(false), side=new THREE.Vector3(d.z,0,-d.x);
  a.grp.position.set(player.pos.x-d.x*.45+side.x*.95, player.pos.y, player.pos.z-d.z*.45+side.z*.95);
  a.grp.rotation.y=forwardFacingYaw(d.x,d.z);
  scene.add(a.grp); allies.push(a);
  shadowSummonPortalVfx(a.grp.position.x, a.grp.position.y, a.grp.position.z);
  burst(a.grp.position.x, a.grp.position.y+1, a.grp.position.z, [.45,.3,.9], 24, 2.4, 2.4, .65);
  sysMsg('<b>Shadow Soldier</b> rises');
}
function tickAbilities(dt,t){
  for(let i=0;i<3;i++) abCd[i]=Math.max(0,abCd[i]-dt);
  buffs.dmg=Math.max(0,buffs.dmg-dt);
  buffs.armor=Math.max(0,buffs.armor-dt);
  buffs.aegis=Math.max(0,buffs.aegis-dt);
  armorCd=Math.max(0,armorCd-dt);
  blackholeCd=Math.max(0,blackholeCd-dt);
  buffs.spd=Math.max(0,buffs.spd-dt);
  buffs.stone=Math.max(0,buffs.stone-dt);
  if(buffs.regen>0){ buffs.regen=Math.max(0,buffs.regen-dt); hp=Math.min(maxHp(),hp+2*dt); }
  if(buffs.dmg>0 && Math.random()<dt*2.2) umbralEdgeVfx(player.pos.x,player.pos.y,player.pos.z,.34,player.yaw);
  if(buffs.armor>0 && Math.random()<dt*3.5) guardShellVfx(player.pos.x,player.pos.y,player.pos.z,.32);
  if(!NET.on && locked && hp>0 && !sleeping && !tutorialSafe()){
    const moveRate=sprintingNow?1.8:(keys['KeyW']||keys['KeyA']||keys['KeyS']||keys['KeyD'])?1.25:.55;
    hunger=Math.max(0,hunger-dt*.055*moveRate);
    hungerAcc+=dt;
    if(hunger<=0){
      starvationAcc+=dt;
      if(starvationAcc>=5){ starvationAcc=0; damagePlayer(1,'local:starvation'); sysMsg('You are <b>starving</b>'); }
    } else starvationAcc=0;
    if(hungerAcc>=1){ hungerAcc=0; renderBars(); }
  }
  swCd=Math.max(0,swCd-dt);
  // fireballs
  for(let i=projectiles.length-1;i>=0;i--){
    const p=projectiles[i];
    p.life-=dt;
    p.grp.position.addScaledVector(p.vel,dt);
    const pos=p.grp.position;
    if(Math.random()<dt*85) spawnParticle({x:pos.x,y:pos.y,z:pos.z,
      vx:(Math.random()-.5)*.5, vy:.2, vz:(Math.random()-.5)*.5, life:.3, grav:-1, r:1, g:.5, b:.12});
    if(Math.random()<dt*28) glowFlash(pos.x,pos.y,pos.z,0xff7a1a,1.6,.16);
    let boom=p.life<=0 || isSolid(getB(Math.floor(pos.x),Math.floor(pos.y),Math.floor(pos.z)));
    if(!boom) for(const m of mobs)
      if(Math.hypot(m.grp.position.x-pos.x,(m.grp.position.y+1)-pos.y,m.grp.position.z-pos.z)<1.1){ boom=true; break; }
    if(boom){
      fireballExplodeVfx(pos.x,pos.y,pos.z);
      breakAbilityBlocks(pos.x,pos.y,pos.z,1.8,8);
      for(const m of [...mobs]){
        const d2=Math.hypot(m.grp.position.x-pos.x, m.grp.position.z-pos.z);
        if(d2<2.8){
          const kb=d2>0.01?new THREE.Vector3((m.grp.position.x-pos.x)/d2*2,0,(m.grp.position.z-pos.z)/d2*2):null;
          damageMob(m, 8+(S.int-1)*.6, kb);
        }
      }
      scene.remove(p.grp);
      projectiles.splice(i,1);
    }
  }
  // lightning beams
  for(let i=beams.length-1;i>=0;i--){
    const b=beams[i]; b.life-=dt;
    if(b.vel){ b.mesh.position.addScaledVector(b.vel,dt); if(b.grav) b.vel.y-=b.grav*dt; }
    if(b.spin){ b.mesh.rotation.x+=b.spin*dt; b.mesh.rotation.z+=b.spin*dt; }
    b.mesh.material.opacity=Math.max(0,b.life/.2);
    if(b.life<=0){ scene.remove(b.mesh); beams.splice(i,1); }
  }
  // shadow soldier
  for(let i=allies.length-1;i>=0;i--){
    const a=allies[i], p=a.grp.position;
    a.life-=dt; a.atkCd-=dt;
    if(a.life<=0){
      burst(p.x,p.y+1,p.z,[.45,.3,.9],16,2.2,2.2,.6);
      scene.remove(a.grp); allies.splice(i,1); continue;
    }
    let target=null, bd=16;
    for(const m of mobs){
      const d2=Math.hypot(m.grp.position.x-p.x, m.grp.position.z-p.z);
      if(d2<bd){ bd=d2; target=m; }
    }
    let tx,tz;
    if(target){ tx=target.grp.position.x; tz=target.grp.position.z; }
    else {
      const pd=Math.hypot(player.pos.x-p.x, player.pos.z-p.z);
      if(pd<3){ a.legs[0].rotation.x*=.9; a.legs[1].rotation.x*=.9; continue; }
      tx=player.pos.x; tz=player.pos.z;
    }
    const dx=tx-p.x, dz=tz-p.z, d=Math.hypot(dx,dz);
    if(target && d<1.4){
      if(a.atkCd<=0){
        const nd=d||1;
        a.atkCd=.8;
        damageMob(target, 4+(S.lvl*.3), new THREE.Vector3(dx/nd,0,dz/nd));
        shadowSoldierStrikeVfx(target.grp.position.x,target.grp.position.y,target.grp.position.z,a.grp.rotation.y);
        if(a.arms[0]) a.arms[0].rotation.x=-.9;
        if(a.arms[1]) a.arms[1].rotation.x=-.6;
        setTimeout(()=>{ if(a.arms){ a.arms[0].rotation.x=0; a.arms[1].rotation.x=0; } },160);
      }
      a.legs[0].rotation.x*=.9; a.legs[1].rotation.x*=.9;
    } else if(d>.05){
      let nx=p.x+dx/d*3.2*dt, nz=p.z+dz/d*3.2*dt;
      let gy=standHeight(nx,nz,p.y+1);
      if(gy>0 && gy-p.y<=1.05){
        p.x=nx; p.z=nz; p.y+=(gy-p.y)*Math.min(1,dt*12);
        const sw=Math.sin(t*9+a.phase)*.6;
        a.legs[0].rotation.x=sw; a.legs[1].rotation.x=-sw;
      }
    }
    a.grp.rotation.y += angDiff(forwardFacingYaw(dx,dz), a.grp.rotation.y)*Math.min(1,dt*8);
    if(Math.random()<dt*4) spawnParticle({x:p.x,y:p.y+1+Math.random(),z:p.z,
      vx:0,vy:.25,vz:0,life:.5,grav:0,r:.4,g:.28,b:.8});
  }
}

// ability HUD
const abEl=document.getElementById('abilities');
const abSlots=[];
function renderAbilities(){
  abEl.innerHTML=''; abSlots.length=0;
  const rows=[];
  const path=activeAbilityPath();
  if(path){
    const P=PATHS[path];
    P.ab.forEach((a,i)=>rows.push({a,i,key:['Q','R','H'][i], col:P.col, locked:!BETA_ABILITY_TEST&&S.lvl<AB_UNLOCK[i]}));
  } else if(S.lvl>=2){
    ['Q','R','H'].forEach((key,i)=>rows.push({
      a:{g:'?',n:'Choose a path'}, i, key, col:'#7385a3', locked:true, pathPending:true
    }));
  }
  if(equippedAegisArmor()) rows.push({a:{n:'Aegis Pulse', g:'A', cd:28, txt:'Armor power: heal, regen, reduce damage'}, i:3, key:'J', col:'#ffd24a', locked:false});
  const lw=selectedLegendaryWeapon();
  if(lw){
    const meta={
      blackhole:{n:'Blackhole', g:'O', col:'#b86cff', txt:'Suspend and collapse a target'},
      chrono:{n:'Chrono Mark', g:'C', col:'#53fff6', txt:'Mark a target and rewind it after 4s'},
      titan:{n:'Titan Slam', g:'T', col:'#ffd24a', txt:'Ground slam, launch, and break terrain'},
      meteor:{n:'Meteor', g:'M', col:'#ff6a1a', txt:'Call a delayed meteor onto a target'},
      soul:{n:'Soul Reap', g:'S', col:'#c084fc', txt:'Drain a target and collect souls on kills'},
      gravity:{n:'Gravity Shot', g:'G', col:'#7dd3fc', txt:'Lift and suspend a target'},
      warden:{n:'Sonic Boom', g:'W', col:'#35d0c8', txt:'Pierce forward through enemies and blocks'},
      eclipse:{n:'Eclipse Dash', g:'E', col:'#9b5cff', txt:'Dash through a target and strike from behind'},
      phoenix:{n:'Phoenix Flame', g:'P', col:'#ff7a1a', txt:'Burn a target; carrying it can revive you once'},
      frostbite:{n:'Frostbite', g:'F', col:'#9bdcff', txt:'Bounce a freezing chakram between targets'},
      midas:{n:'Midas Strike', g:'$', col:'#ffd24a', txt:'Damage scales with carried gold'},
      leviathan:{n:'Storm Throw', g:'L', col:'#7dd3fc', txt:'Chain storm lightning through targets'},
      anchor:{n:'Void Anchor', g:'V', col:'#8b5cf6', txt:'Drop an anti-mobility anchor zone'},
    }[lw.kind] || {n:lw.info.name, g:'*', col:'#ffd24a', txt:'Legendary weapon power'};
    rows.push({a:{n:meta.n, g:meta.g, cd:lw.info.legendary.cd||10, txt:meta.txt}, i:4, key:'F', col:meta.col, locked:false, legendaryKind:lw.kind});
  }
  rows.forEach(row=>{
    const d=document.createElement('div'); d.className='abslot'+(row.pathPending?' path-pending':'');
    d.style.borderColor=row.col; d.style.color=row.col;
    d.title=row.pathPending?'Choose your ability path with C':(row.a.n||'Ability');
    d.innerHTML='<span class="k">'+row.key+'</span>'+row.a.g+'<div class="cdov"></div><span class="lk">'+(row.pathPending?'PATH':'')+'</span>';
    abEl.appendChild(d); abSlots.push(d);
  });
}
function updateAbilityHUD(){
  let idx=0;
  const path=activeAbilityPath();
  if(!path && S.lvl>=2) idx=3;
  if(path) PATHS[path].ab.forEach((a,i)=>{
    const d=abSlots[idx++]; if(!d) return;
    const locked=!BETA_ABILITY_TEST&&S.lvl<AB_UNLOCK[i];
    d.classList.toggle('locked',locked);
    d.querySelector('.lk').textContent=locked?('Lv'+AB_UNLOCK[i]):'';
    const cd=a.passive ? swCd/60 : abCd[i]/a.cd;
    d.querySelector('.cdov').style.height=(Math.max(0,Math.min(1,cd))*100)+'%';
  });
  if(equippedAegisArmor()){
    const d=abSlots[idx]; if(!d) return;
    d.classList.remove('locked');
    d.querySelector('.lk').textContent='';
    d.querySelector('.cdov').style.height=(Math.max(0,Math.min(1,armorCd/28))*100)+'%';
    idx++;
  }
  const lw=selectedLegendaryWeapon();
  if(lw){
    const d=abSlots[idx]; if(!d) return;
    d.classList.remove('locked');
    d.querySelector('.lk').textContent='';
    const cd=lw.kind==='blackhole' ? blackholeCd : Math.max(0,(legendaryWeaponCd[lw.kind]||0)-performance.now()/1000);
    d.querySelector('.cdov').style.height=(Math.max(0,Math.min(1,cd/(lw.info.legendary.cd||10)))*100)+'%';
  }
}

// the Status Window (C)
const statEl=document.getElementById('statwin');
const statPanel=document.getElementById('statpanel');
let statOpen=false;
function openStat(){
  if(!statOpen) SFX.uiOpen();
  statOpen=true;
  if(document.pointerLockElement) document.exitPointerLock();
  lockFallback=false; locked=false;
  statEl.classList.remove('hidden');
  refreshPlayUi();
  renderStat();
}
function closeStat(relock=true){
  if(statOpen) SFX.uiClose();
  statOpen=false;
  statEl.classList.add('hidden');
  if(relock) renderer.domElement.requestPointerLock();
  else {
    overlay.classList.remove('hidden');
    for(const id of ['hotbar','stats','abilities','locationhud','coords','currentquest','landmap']) document.getElementById(id).classList.add('hidden');
  }
}
function renderStat(){
  const ATTRS=[
    ['str','STRENGTH','+6% melee damage per point'],
    ['agi','AGILITY','+1.5% speed, cheaper stamina'],
    ['vit','VITALITY','+2 max HP per point'],
    ['int','INTELLIGENCE','+3 max MP, stronger spells'],
  ];
  let h='<h2>S T A T U S</h2><div class="sub2">HUNTER PROFILE &middot; PRESS C TO CLOSE</div>';
  h+='<div class="srow"><span>NAME</span><b>HUNTER</b></div>';
  const ji=jobXpIntoLevel(jobXp), jd=activeJob();
  h+='<div class="srow"><span>CLASS</span><b>'+(S.path?PATHS[S.path].name:'None &mdash; Unawakened')+'</b></div>';
  h+='<div class="srow"><span>JOB</span><b style="color:'+(jd?jd.col:'#d8f2ff')+'">'+(jd?jobTitleFor(playerJob,ji.lvl):'Adventurer')+(jd?' &middot; '+jd.name+' Lv '+ji.lvl+' &middot; '+ji.xp+' / '+ji.need:'')+'</b></div>';
  h+='<div class="srow"><span>LEVEL</span><b>'+S.lvl+'</b></div>';
  const rankIdx=localPlayerRankIndex(), hunterRankIdx=localPlayerHunterRankIndex();
  const nextLvl=nextRankLevel(hunterRankIdx);
  const rankProgress=currentRankProgress();
  const clearedGate=highestGateRankCleared>=0 ? gateRankLetter(highestGateRankCleared)+' cleared' : 'none cleared';
  h+='<div class="srow"><span>PLAYER RANK</span><b style="color:#d8f2ff">'+localPlayerRankName()+'</b></div>';
  h+='<div class="srow"><span>GATE ACCESS</span><b>'+gateRankLetter(rankIdx)+'-Rank available &middot; '+clearedGate+(nextLvl?' &middot; next Hunter rank at Lv '+nextLvl:' &middot; top Hunter rank')+'</b></div>';
  h+='<div class="srow"><span>XP</span><b>'+Math.floor(S.xp)+' / '+xpNeed()+'</b></div>';
  if(rankProgress.maxRank){
    h+='<div class="rankjourney max"><div class="rjhead"><span>HUNTER RANK</span><b>S-RANK ACHIEVED</b></div><div class="rjbar"><i style="width:100%"></i></div><p>Hunter XP still advances levels, stat points, and mastery.</p></div>';
  }else{
    const nextLetter=hunterRankLetter(rankProgress.nextRank);
    h+='<div class="rankjourney"><div class="rjhead"><span>NEXT RANK</span><b>'+nextLetter+'-RANK AT LEVEL '+rankProgress.nextRankLevel+'</b></div>'+
      '<div class="rjbar"><i style="width:'+Math.round(rankProgress.progress*100)+'%"></i></div>'+
      '<div class="rjcount"><b>'+rankProgress.remaining.toLocaleString('en-US')+' HUNTER XP REMAINING</b><span>'+rankProgress.earned.toLocaleString('en-US')+' / '+rankProgress.required.toLocaleString('en-US')+'</span></div>'+
      '<p>Earn Hunter XP your way: town quests, job and Guild contracts, Gates, server events, or hostile threats. Gate clears award XP; rank advances when your level crosses the threshold.</p></div>';
  }
  h+='<div class="srow"><span>HP / MP / SP / Food</span><b>'+Math.ceil(hp)+'/'+maxHp()+' &middot; '+Math.floor(mp)+'/'+maxMp()+' &middot; '+Math.floor(sp)+'/'+maxSp()+' &middot; '+Math.floor(hunger)+'/'+maxHunger()+'</b></div>';
  const armor=equippedArmor(), armorInfo=armor?ITEMS[armor.id].armor:null;
  h+='<div class="srow"><span>ARMOR</span><b>'+(armor?ITEMS[armor.id].name+' &middot; -'+Math.round((armorInfo.mitigation||0)*100)+'% damage'+(armorInfo.power==='aegis'?' &middot; J Aegis Pulse':''):'None')+'</b></div>';
  h+='<div class="srow"><span>STAT POINTS</span><b>'+S.pts+'</b></div>';
  for(const [k,nm,fx] of ATTRS)
    h+='<div class="attr"><span class="nm">'+nm+' &middot; '+S[k]+'</span><span class="fx">'+fx+'</span><button data-attr="'+k+'" '+(S.pts<=0?'disabled':'')+'>+</button></div>';
  if(!S.path){
    if(S.lvl>=2){
      h+='<div class="sub2" style="margin-top:14px">CHOOSE YOUR PATH &mdash; THIS CANNOT BE UNDONE</div>';
      for(const key in PATHS){
        const P=PATHS[key];
        h+='<div class="pathcard" data-path="'+key+'" style="border-color:'+P.col+'">'
          +'<h3 style="color:'+P.col+'">'+P.name+'</h3><p>'+P.desc+'</p>'
          +'<div class="abl">'+P.ab.map((a,i)=>a.g+' '+a.n+' (Lv'+AB_UNLOCK[i]+')').join(' &middot; ')+'</div></div>';
      }
    } else h+='<div class="sub2" style="margin-top:14px">REACH LEVEL 2 TO AWAKEN A PATH</div>';
  } else {
    const P=PATHS[S.path];
    h+='<div class="sub2" style="margin-top:14px;color:'+P.col+'">'+P.name.toUpperCase()+' ABILITIES</div>';
    P.ab.forEach((a,i)=>{
      const got=S.lvl>=AB_UNLOCK[i];
      h+='<div class="ablist"><span'+(got?'':' class="dim"')+'>'+['Q','R','F'][i]+' &middot; '+a.g+' '+a.n+(a.passive?' (passive)':'')+'</span>'
        +'<span class="dim">'+(got ? a.txt+' &middot; '+(a.mp?a.mp+' MP ':'')+(a.sp?a.sp+' SP ':'')+'&middot; '+a.cd+'s cd' : 'Unlocks at Level '+AB_UNLOCK[i])+'</span></div>';
    });
  }
  h+='<div class="qrow"><button id="jobopen">JOBS</button><button id="statclose">CLOSE</button></div>';
  statPanel.innerHTML=h;
  statPanel.querySelectorAll('button[data-attr]').forEach(b=>b.addEventListener('click',()=>{
    if(S.pts<=0) return;
    if(NET.on&&NET.room){ NET.room.send('spendStat',{stat:b.dataset.attr,amount:1}); return; }
    S.pts--; S[b.dataset.attr]++;
    if(b.dataset.attr==='vit') hp=Math.min(maxHp(),hp+2);
    if(b.dataset.attr==='int') mp=Math.min(maxMp(),mp+3);
    renderBars(); renderStat();
  }));
  statPanel.querySelectorAll('.pathcard').forEach(c=>c.addEventListener('click',()=>{
    setAbilityPath(c.dataset.path);
  }));
  document.getElementById('statclose').addEventListener('click',()=>closeStat());
  document.getElementById('jobopen').addEventListener('click',()=>openJobsUI());
}

// ---------------- dungeon gates ----------------
let dim='overworld', owWorld=null, gate=null, dungeon=null, exitPortal=null, gateTimer=40;
const netGates={};
function clearNetGates(){
  for(const id in netGates){ scene.remove(netGates[id].grp); delete netGates[id]; }
}
const RANKS=[
  {n:'E', col:0x6ee06a, mul:1.0},
  {n:'D', col:0x4fd8ff, mul:1.6},
  {n:'C', col:0xffd24a, mul:2.4},
  {n:'B', col:0xff8c3a, mul:3.4},
  {n:'A', col:0xff4a6a, mul:4.6},
];
const GATE_DISTANCE_BANDS=[
  {min:90, max:160},
  {min:180, max:280},
  {min:300, max:400},
  {min:420, max:470},
  {min:460, max:480},
];
const hex01=h=>[(h>>16&255)/255,(h>>8&255)/255,(h&255)/255];
function makeGateMesh(col){
  const g=new THREE.Group();
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1.5,.13,8,28),
    new THREE.MeshBasicMaterial({color:col, transparent:true, opacity:.95, blending:THREE.AdditiveBlending, depthWrite:false}));
  ring.position.y=1.9; g.add(ring);
  const disc=new THREE.Mesh(new THREE.CircleGeometry(1.38,24),
    new THREE.MeshBasicMaterial({color:0x0a0418, transparent:true, opacity:.85, side:THREE.DoubleSide}));
  disc.position.y=1.9; g.add(disc);
  const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas), color:col, transparent:true, opacity:.5, blending:THREE.AdditiveBlending, depthWrite:false}));
  gl.scale.set(6,6,1); gl.position.y=1.9; g.add(gl);
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.25,.5,46,8,1,true),
    new THREE.MeshBasicMaterial({color:col, transparent:true, opacity:.09, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide}));
  beam.position.y=23; g.add(beam);
  g.userData={ring, disc};
  return g;
}
function gateKindLabel(kind){
  return kind==='solo' ? 'Solo' : kind==='team' ? 'Team' : kind==='shard' ? 'Shard' : 'Public';
}
function makeGateLabel(rank, kind, shard){
  const c=document.createElement('canvas'); c.width=192; c.height=64;
  const g=c.getContext('2d');
  g.font='bold 24px Courier New';
  g.textAlign='center';
  g.fillStyle='rgba(6,8,16,.72)';
  g.fillRect(10,8,172,48);
  g.strokeStyle='rgba(255,255,255,.24)';
  g.lineWidth=2; g.strokeRect(10,8,172,48);
  g.fillStyle='#ffffff';
  if(shard) g.fillText(shard.name+' +'+shard.plus,96,30);
  else g.fillText(RANKS[rank].n+'-Rank Gate',96,30);
  g.font='bold 16px Courier New';
  if(shard){
    g.fillStyle=(SHARD_TIERS[shard.plus-1]||SHARD_TIERS[0]).col;
    g.fillText((shard.mods||[]).join(' ').slice(0,22)||'Sharded',96,50);
  } else {
    g.fillStyle=kind==='solo'?'#9ad0ff':kind==='team'?'#ffd24a':'#8cff9a';
    g.fillText(gateKindLabel(kind),96,50);
  }
  const tex=new THREE.CanvasTexture(c);
  tex.magFilter=THREE.NearestFilter; tex.minFilter=THREE.NearestFilter;
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex, transparent:true, depthWrite:false}));
  sp.position.y=3.85;
  sp.scale.set(3.6,1.2,1);
  return sp;
}
function setGateLabel(local){
  const kind=local.kind||'public';
  const shard=local.shard||null;
  const key=local.rank+':'+kind+':'+(shard?shard.plus+','+(shard.mods||[]).join(','):'');
  if(local.label && local.labelKey===key) return;
  if(local.label) local.grp.remove(local.label);
  local.label=makeGateLabel(local.rank, kind, shard);
  local.labelKey=key;
  local.grp.add(local.label);
}
function spawnGate(){
  if(!gateSystemUnlocked()) return;
  const ri=localPlayerRankIndex();
  for(let i=0;i<40;i++){
    const band=GATE_DISTANCE_BANDS[ri]||GATE_DISTANCE_BANDS[0];
    const a=Math.random()*Math.PI*2, d=band.min+Math.random()*(band.max-band.min);
    const x=Math.floor(TOWN.TC+Math.cos(a)*d), z=Math.floor(TOWN.TC+Math.sin(a)*d);
    if(x<LAVA_BORDER_WIDTH+6||x>WX-LAVA_BORDER_WIDTH-6||z<LAVA_BORDER_WIDTH+6||z>WX-LAVA_BORDER_WIDTH-6) continue;
    const distance=townDistanceClient(x,z);
    if(distance<band.min||distance>band.max) continue;
    const gy=standHeight(x+.5,z+.5,WH-2);
    if(gy<3||gy>34) continue;
    gate={x:x+.5, y:gy, z:z+.5, rank:ri, kind:'public', colArr:hex01(RANKS[ri].col), grp:makeGateMesh(RANKS[ri].col)};
    setGateLabel(gate);
    gate.grp.position.set(gate.x, gy, gate.z);
    scene.add(gate.grp);
    sysMsg('A <b>'+RANKS[ri].n+'-Rank Gate</b> has opened in the wilderness');
    burst(gate.x, gy+1.5, gate.z, gate.colArr, 30, 3, 3, .9);
    return;
  }
  gateTimer=20; // retry soon
}
const DungeonRules=window.BlockcraftDungeonGeneration.createDungeonGeneration({
  B,hash2
});
const DUNGEON_GRID_WIDTH=DungeonRules.DUNGEON_WIDTH;
const DUNGEON_GRID_HEIGHT=DungeonRules.DUNGEON_HEIGHT;
const carveBox=DungeonRules.carveBox;
const generateDungeon=DungeonRules.generateDungeon;
function rebuildAllChunks(){
  lastVisibleChunkKey='';
  updateVisibleChunks(true);
}
// ---------------- dungeon decoration & atmosphere (client-only cosmetics) ----------------
const dungeonDecor=[];
function clearDungeonDecor(){ for(const m of dungeonDecor) scene.remove(m); dungeonDecor.length=0; }
function dDecor(m){ scene.add(m); dungeonDecor.push(m); return m; }
const AFFIX_STYLE={
  Empowered:{col:0xa855f7,label:'POWER'},
  Frenzied:{col:0xff3b3b,label:'FRENZY'},
  Fortified:{col:0x9ca3af,label:'FORTIFY'},
  Tyrannical:{col:0xff264d,label:'TYRANT'},
  Volatile:{col:0xff5a1f,label:'VOLATILE'},
  Sanguine:{col:0x9f1239,label:'SANGUINE'},
  Spiteful:{col:0x7dd3fc,label:'SPITE'},
  Bursting:{col:0xdc2626,label:'BURST'},
  Grievous:{col:0xbe123c,label:'GRIEVOUS'},
  Quaking:{col:0xf59e0b,label:'QUAKE'},
  Explosive:{col:0xffaa33,label:'EXPLODE'},
  Bolstering:{col:0xf97316,label:'BOLSTER'},
};
function dungeonMods(dgn){ return dgn&&dgn.shard&&Array.isArray(dgn.shard.mods) ? dgn.shard.mods : []; }
function hasAffix(dgn,name){ return dungeonMods(dgn).includes(name); }
// dark, desaturated cousins of the rank gate colors — every rank gets its own base atmosphere
const DUNGEON_RANK_MOOD=[0x081006,0x060e15,0x130d04,0x130704,0x120510];
function dungeonMoodColor(dgn){
  const mods=dungeonMods(dgn);
  if(mods.includes('Sanguine')||mods.includes('Grievous')||mods.includes('Bursting')) return 0x16070c;
  if(mods.includes('Spiteful')) return 0x06111b;
  if(mods.includes('Volatile')||mods.includes('Explosive')||mods.includes('Bolstering')) return 0x190b05;
  if(mods.includes('Quaking')||mods.includes('Fortified')) return 0x100d09;
  if(mods.includes('Empowered')||mods.includes('Tyrannical')||mods.includes('Frenzied')) return 0x120817;
  return DUNGEON_RANK_MOOD[(dgn&&dgn.rank)|0]||0x070811;
}
function affixMat(col,opacity){
  return new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:opacity==null?.5:opacity,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
}
function addFloorCircle(x,z,rad,col,opacity){
  const m=new THREE.Mesh(new THREE.CircleGeometry(rad,24),affixMat(col,opacity));
  m.rotation.x=-Math.PI/2; m.position.set(x,9.075,z); return dDecor(m);
}
function addFloorCrack(x,z,len,col,rot,opacity){
  const m=new THREE.Mesh(new THREE.BoxGeometry(.08,.025,len),affixMat(col,opacity));
  m.position.set(x,9.09,z); m.rotation.y=rot||0; return dDecor(m);
}
function addAffixObelisk(x,z,mod,i,total){
  const st=AFFIX_STYLE[mod]||{col:0xffffff,label:mod};
  const grp=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(.34,1.45,.34),new THREE.MeshLambertMaterial({color:0x24242c}));
  body.position.y=.72; grp.add(body);
  const rune=new THREE.Mesh(new THREE.BoxGeometry(.2,.44,.03),affixMat(st.col,.88));
  rune.position.set(0,.82,-.19); grp.add(rune);
  const cap=new THREE.Mesh(new THREE.OctahedronGeometry(.24,0),affixMat(st.col,.7));
  cap.position.y=1.62; grp.add(cap);
  const label=makeTextSprite(st.label,'#'+st.col.toString(16).padStart(6,'0'));
  label.position.set(0,2.18,0); label.scale.set(1.45,.72,1); grp.add(label);
  const a=(i/Math.max(1,total))*Math.PI*2;
  grp.position.set(x+Math.cos(a)*2.2,9,z+Math.sin(a)*2.2);
  grp.rotation.y=a+Math.PI;
  return dDecor(grp);
}
function addDungeonMist(x,z,rx,rz,col,opacity){
  const m=new THREE.Mesh(new THREE.CircleGeometry(1,28),affixMat(col||0x5f6f86,opacity||.12));
  m.rotation.x=-Math.PI/2;
  m.position.set(x,9.045,z);
  m.scale.set(Math.max(1,rx)*.95,Math.max(1,rz)*.95,1);
  m.userData.mist={base:opacity||.12,phase:hash2(x,z)*Math.PI*2,sx:m.scale.x,sy:m.scale.y};
  return dDecor(m);
}
function addStalactite(x,y,z,h,col){
  const m=new THREE.Mesh(new THREE.ConeGeometry(.14+Math.min(.22,h*.06),h,5),
    new THREE.MeshLambertMaterial({color:col||0x3f4148}));
  m.position.set(x,y-h*.5,z);
  m.rotation.x=Math.PI;
  return dDecor(m);
}
function addWallBanner(x,y,z,w,h,col,rot){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({
    color:col,transparent:true,opacity:.42,side:THREE.DoubleSide,depthWrite:false
  }));
  m.position.set(x,y,z);
  m.rotation.y=rot||0;
  m.userData.banner={baseY:y,phase:hash2(x*13,z*17)*Math.PI*2};
  return dDecor(m);
}
function addHallLantern(x,ceilY,z){
  const grp=new THREE.Group();
  const chain=new THREE.Mesh(new THREE.BoxGeometry(.05,.7,.05),new THREE.MeshLambertMaterial({color:0x2f343a}));
  chain.position.y=-.35; grp.add(chain);
  const body=new THREE.Mesh(new THREE.BoxGeometry(.24,.3,.24),new THREE.MeshLambertMaterial({color:0x26262e}));
  body.position.y=-.85; grp.add(body);
  const flame=new THREE.Mesh(new THREE.BoxGeometry(.14,.18,.14),torchFlameMat);
  flame.position.y=-.84; grp.add(flame);
  grp.position.set(x,ceilY,z); dDecor(grp);
  const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas),color:0xffa64d,transparent:true,opacity:.26,blending:THREE.AdditiveBlending,depthWrite:false}));
  gl.scale.set(3,3,1); gl.position.set(x,ceilY-.85,z);
  gl.userData.pulse={base:.26,phase:hash2(x*7,z*11)*6.28};
  return dDecor(gl);
}
// Reconstruct the L-shaped corridors carved between consecutive *main* rooms (x-leg at the
// previous room's z, then z-leg at the current room's x — mirrors carveDungeonHall exactly)
// and hang warm lanterns down their centerlines so the halls read as travelled arteries.
function placeHallLanterns(dgn){
  const seed=(dgn.seed||0)>>>0, mains=dgn.rooms.filter(rm=>rm.main);
  const insideRoom=(x,z)=>mains.some(rm=>Math.abs(x-rm.x)<=rm.rx+1.2&&Math.abs(z-rm.z)<=rm.rz+1.2);
  for(let i=1;i<mains.length;i++){
    const a=mains[i-1], b=mains[i];
    const ceilY=9+(hash2(i*23+seed,31)<.38?4:3);     // wide halls are carved one block taller
    const legs=[
      {fx:Math.min(a.x,b.x),tx:Math.max(a.x,b.x),z:a.z,alongX:true},
      {fz:Math.min(a.z,b.z),tz:Math.max(a.z,b.z),x:b.x,alongX:false},
    ];
    for(const leg of legs){
      const from=leg.alongX?leg.fx:leg.fz, to=leg.alongX?leg.tx:leg.tz;
      for(let d=from+3;d<=to-3;d+=6){
        if(hash2(d*13+i,seed%997)<.22) continue;      // occasional dark gaps
        const x=leg.alongX?d:leg.x, z=leg.alongX?leg.z:d;
        if(insideRoom(x,z)) continue;
        addHallLantern(x+.5,ceilY,z+.5);
      }
    }
  }
}
function placeDungeonDecor(dgn){
  clearDungeonDecor();
  if(!dgn || !dgn.rooms) return;
  const FLOOR=9;
  const mods=dungeonMods(dgn);
  const webMat=new THREE.MeshBasicMaterial({color:0xc6ccd6,transparent:true,opacity:.28,depthWrite:false,side:THREE.DoubleSide});
  const boneMat=new THREE.MeshLambertMaterial({color:0xdcd6c0});
  const rubbleMat=new THREE.MeshLambertMaterial({color:0x53535a});
  const mossMat=new THREE.MeshLambertMaterial({color:0x35583f});
  const chainMat=new THREE.MeshLambertMaterial({color:0x2f343a});
  const shrineMat=new THREE.MeshBasicMaterial({color:0x58d7ff,transparent:true,opacity:.72,blending:THREE.AdditiveBlending,depthWrite:false});
  const moodCol=dungeonMoodColor(dgn);
  const mistCol=mods.includes('Sanguine')?0x7f1d1d:mods.includes('Spiteful')?0x6bdcff:mods.includes('Explosive')?0xff8a1a:0x596275;
  const rankCol=(RANKS[dgn.rank|0]||RANKS[0]).col;
  placeHallLanterns(dgn);
  if(mods.length && dgn.entrance){
    const banner=makeTextSprite(mods.join('  '),'#ffd24a');
    banner.position.set(dgn.entrance.x,FLOOR+3.3,dgn.entrance.z-2.2);
    banner.scale.set(4.8,1.15,1);
    dDecor(banner);
    mods.forEach((mod,i)=>addAffixObelisk(dgn.entrance.x,dgn.entrance.z,mod,i,mods.length));
  }
  if(dgn.entrance){
    // rank-lit waystone in a corner of the entrance room: marks the way home from anywhere
    const e=dgn.entrance, erx=e.rx||e.r||3, erz=e.rz||e.r||3;
    const side=hash2(e.x,e.z)<.5?-1:1;
    const wx=e.x+side*(erx-1.2), wz=e.z-(erz-1.2);
    const base=new THREE.Mesh(new THREE.BoxGeometry(1.05,.3,1.05),new THREE.MeshLambertMaterial({color:0x2c2c34}));
    base.position.set(wx,FLOOR+.15,wz); dDecor(base);
    const mono=new THREE.Mesh(new THREE.BoxGeometry(.5,1.9,.5),new THREE.MeshLambertMaterial({color:0x232329}));
    mono.position.set(wx,FLOOR+1.25,wz); dDecor(mono);
    const rune=new THREE.Mesh(new THREE.BoxGeometry(.2,1.2,.04),affixMat(rankCol,.85));
    rune.position.set(wx,FLOOR+1.3,wz+.26); dDecor(rune);
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(.24,.24,5.4,8),affixMat(rankCol,.1));
    beam.position.set(wx,FLOOR+2.9,wz); dDecor(beam);
    addFloorCircle(wx,wz,.85,rankCol,.26);
    const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas),color:rankCol,transparent:true,opacity:.3,blending:THREE.AdditiveBlending,depthWrite:false}));
    gl.position.set(wx,FLOOR+2.2,wz); gl.scale.set(3.4,3.4,1);
    gl.userData.pulse={base:.3,phase:hash2(wx,wz)*6.28};
    dDecor(gl);
  }
  dgn.rooms.forEach((rm,ri2)=>{
    const isBoss=rm.type==='boss', x0=rm.x, z0=rm.z, rx=rm.rx||rm.r, rz=rm.rz||rm.r, r=rm.r||Math.max(rx,rz), top=FLOOR+(rm.h||(isBoss?5:4));
    addDungeonMist(x0,z0,rx,rz,mistCol,isBoss?.15:.09);
    if(ri2%2===0 || isBoss){
      const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas), color:isBoss?0xff5a3a:rankCol, transparent:true,
        opacity:isBoss?.22:.1, blending:THREE.AdditiveBlending, depthWrite:false}));
      gl.position.set(x0,top-.35,z0); gl.scale.set(Math.max(rx,rz)*2.1,Math.max(rx,rz)*2.1,1);
      gl.userData.pulse={base:gl.material.opacity,phase:hash2(x0,z0)*6.28};
      dDecor(gl);
    }
    for(let k=0;k<(isBoss?7:3);k++){
      if(hash2(x0*11+k,z0*13+ri2)<.42) continue;
      addStalactite(x0+(hash2(k+x0,ri2)-.5)*rx*1.7,top-.05,z0+(hash2(k+z0,ri2)-.5)*rz*1.7,.45+hash2(k*3+x0,z0)*.95,isBoss?0x4b3030:0x3c3f48);
    }
    if(ri2>0 && hash2(x0*7,z0*19+ri2)<.55){
      const side=hash2(x0,z0)<.5?-1:1;
      addWallBanner(x0+side*(rx+.02),FLOOR+2.15,z0+(hash2(x0,ri2)-.5)*rz,1.1,1.7,mods.length?(AFFIX_STYLE[mods[ri2%mods.length]]||{}).col||0x47315f:0x3b2746,side>0?Math.PI/2:-Math.PI/2);
    }
    // cobwebs tucked into the upper corners
    for(const sx of [-1,1]) for(const sz of [-1,1]){
      if(hash2(x0*7+ri2*3+sx, z0*5+sz)<0.55) continue;
      const w=new THREE.Mesh(new THREE.PlaneGeometry(1.5,1.5),webMat);
      w.position.set(x0+sx*(rx-0.5), top-0.7, z0+sz*(rz-0.5));
      w.rotation.set(0.25, Math.PI/4*sx*sz, 0); dDecor(w);
    }
    // a bone pile in one corner
    if(hash2(x0*3+ri2, z0*5)<0.6){
      const bx=x0+(rx-1.2)*(hash2(x0,z0)<.5?-1:1), bz=z0+(rz-1.2)*(hash2(z0,x0)<.5?-1:1);
      const skull=new THREE.Mesh(new THREE.BoxGeometry(.32,.3,.32),boneMat); skull.position.set(bx,FLOOR+.15,bz); dDecor(skull);
      for(let k=0;k<3;k++){ const rib=new THREE.Mesh(new THREE.BoxGeometry(.55,.08,.09),boneMat);
        rib.position.set(bx+(hash2(k+x0,z0)-.5)*.8, FLOOR+.05, bz+(hash2(k+z0,x0)-.5)*.8); rib.rotation.y=hash2(k,x0)*3.1; dDecor(rib); }
    }
    // scattered rubble
    for(let k=0;k<3;k++){ if(hash2(x0+k*5, z0*2+k)<0.45) continue;
      const rk=new THREE.Mesh(new THREE.BoxGeometry(.32,.22,.32),rubbleMat);
      rk.position.set(x0+(hash2(k*3+x0,z0)-.5)*1.9*(rx-1), FLOOR+.1, z0+(hash2(k*3+z0,x0)-.5)*1.9*(rz-1)); rk.rotation.y=hash2(k,z0)*3.1; dDecor(rk); }
    if(rm.type==='pit'){
      const edge=new THREE.Mesh(new THREE.TorusGeometry(Math.min(rx,rz)-1,.035,6,32),new THREE.MeshBasicMaterial({color:0x0d1117,transparent:true,opacity:.55,depthWrite:false}));
      edge.rotation.x=Math.PI/2; edge.position.set(x0,FLOOR+.08,z0); edge.scale.x=rx/Math.max(1,Math.min(rx,rz)); edge.scale.y=rz/Math.max(1,Math.min(rx,rz)); dDecor(edge);
      addFloorCircle(x0,z0,Math.max(1.4,Math.min(rx,rz)-1),0x020307,.32);
    }
    if(rm.type==='crypt'){
      for(let k=0;k<4;k++){
        const sx=k<2?-1:1, zz=z0+(k%2?-1:1)*(rz-.9);
        const sarc=new THREE.Mesh(new THREE.BoxGeometry(1.15,.38,.55),new THREE.MeshLambertMaterial({color:0x555862}));
        sarc.position.set(x0+sx*(1.2+hash2(k+x0,z0)*Math.max(1,rx-2)),FLOOR+.19,zz); sarc.rotation.y=Math.PI/2; dDecor(sarc);
      }
    }
    if(rm.type==='guard'){
      // abandoned weapon rack against a wall: two posts, a crossbar, and leaning blades
      const side=hash2(x0*9,z0*3)<.5?-1:1, rackX=x0+side*(rx-.55), rackZ=z0+(hash2(x0,z0*7)-.5)*(rz-2);
      const postMat=new THREE.MeshLambertMaterial({color:0x3d2f1e}), steelMat=new THREE.MeshLambertMaterial({color:0x9aa2ad});
      for(const dz of [-.55,.55]){
        const post=new THREE.Mesh(new THREE.BoxGeometry(.12,1.15,.12),postMat);
        post.position.set(rackX,FLOOR+.57,rackZ+dz); dDecor(post);
      }
      const bar=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,1.28),postMat);
      bar.position.set(rackX,FLOOR+1.05,rackZ); dDecor(bar);
      for(let k=0;k<2;k++){
        const blade=new THREE.Mesh(new THREE.BoxGeometry(.06,1,.14),steelMat);
        blade.position.set(rackX-side*.16,FLOOR+.55,rackZ-.3+k*.6);
        blade.rotation.z=side*.28; blade.rotation.y=hash2(k,x0)*.4; dDecor(blade);
      }
    }
    if(rm.type==='shrine'){
      const base=new THREE.Mesh(new THREE.BoxGeometry(1.2,.35,1.2),new THREE.MeshLambertMaterial({color:0x56515c}));
      base.position.set(x0,FLOOR+.18,z0); dDecor(base);
      const crystal=new THREE.Mesh(new THREE.OctahedronGeometry(.48,0),shrineMat);
      crystal.position.set(x0,FLOOR+.95,z0); dDecor(crystal);
      crystal.userData.spin={speed:.8+hash2(x0,z0),bob:.1,baseY:crystal.position.y,phase:hash2(x0*3,z0)*6.28};
      const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas), color:0x58d7ff, transparent:true, opacity:.34, blending:THREE.AdditiveBlending, depthWrite:false}));
      gl.position.set(x0,FLOOR+1,z0); gl.scale.set(3,3,1); dDecor(gl);
    }
    if(rm.type==='treasure'||rm.type==='vault'){
      for(let k=0;k<3;k++){
        const m=new THREE.Mesh(new THREE.BoxGeometry(.42,.18,.42),mossMat);
        m.position.set(x0+(hash2(k+x0,z0)-.5)*(rx*1.4),FLOOR+.09,z0+(hash2(k+z0,x0)-.5)*(rz*1.4)); dDecor(m);
      }
      const glint=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas),color:0xffd24a,transparent:true,opacity:.22,blending:THREE.AdditiveBlending,depthWrite:false}));
      glint.position.set(x0,FLOOR+.7,z0); glint.scale.set(2.4,2.4,1);
      glint.userData.pulse={base:.22,phase:hash2(x0*3,z0*5)*6.28};
      dDecor(glint);
    }
    if(hash2(x0*5+ri2,z0*7)<.35){
      const chain=new THREE.Mesh(new THREE.BoxGeometry(.08,top-FLOOR-.7,.08),chainMat);
      chain.position.set(x0+(hash2(x0,ri2)-.5)*rx, FLOOR+(top-FLOOR)/2+.2, z0+(hash2(z0,ri2)-.5)*rz); dDecor(chain);
    }
    if(hasAffix(dgn,'Volatile')){
      for(let k=0;k<2;k++){
        addFloorCrack(x0+(hash2(k+x0,z0)-.5)*rx*1.35,z0+(hash2(k+z0,x0)-.5)*rz*1.35,1.8+hash2(k,ri2)*1.4,0xff5a1f,hash2(k+x0,ri2)*Math.PI,.62);
      }
      if(hash2(x0,z0+ri2)<.45) addFloorCircle(x0+(hash2(x0,ri2)-.5)*rx,z0+(hash2(z0,ri2)-.5)*rz,.48,0xff3a1f,.34);
    }
    if(hasAffix(dgn,'Sanguine')){
      for(let k=0;k<2;k++) addFloorCircle(x0+(hash2(k+x0,9)-.5)*rx*1.45,z0+(hash2(k+z0,11)-.5)*rz*1.45,.55+hash2(k,ri2)*.55,0x9f1239,.32);
    }
    if(hasAffix(dgn,'Spiteful')){
      for(let k=0;k<2;k++){
        const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas),color:0x7dd3fc,transparent:true,opacity:.22,blending:THREE.AdditiveBlending,depthWrite:false}));
        sp.position.set(x0+(hash2(k+x0,23)-.5)*rx*1.6,FLOOR+1.3+hash2(k,z0)*1.2,z0+(hash2(k+z0,29)-.5)*rz*1.6);
        sp.scale.set(1.1,1.8,1); dDecor(sp);
      }
    }
    if(hasAffix(dgn,'Bursting')||hasAffix(dgn,'Grievous')){
      const col=hasAffix(dgn,'Grievous')?0xbe123c:0xdc2626;
      for(let k=0;k<2;k++){
        const drip=new THREE.Mesh(new THREE.BoxGeometry(.08,.46,.08),affixMat(col,.62));
        drip.position.set(x0+(hash2(k+x0,31)-.5)*rx*1.6,top-.35,z0+(hash2(k+z0,37)-.5)*rz*1.6);
        dDecor(drip);
      }
    }
    if(hasAffix(dgn,'Quaking')){
      for(let k=0;k<3;k++) addFloorCrack(x0+(hash2(k+x0,41)-.5)*rx*1.5,z0+(hash2(k+z0,43)-.5)*rz*1.5,1.2+hash2(k,47)*2.2,0xf59e0b,hash2(k+ri2,53)*Math.PI,.4);
    }
    if(hasAffix(dgn,'Explosive')){
      const crystal=new THREE.Mesh(new THREE.OctahedronGeometry(.34,0),affixMat(0xffaa33,.74));
      crystal.position.set(x0+(hash2(x0,ri2)-.5)*rx*1.1,FLOOR+.55,z0+(hash2(z0,ri2)-.5)*rz*1.1);
      crystal.userData.spin={speed:1.4,bob:.08,baseY:crystal.position.y,phase:hash2(x0,z0)*6.28};
      dDecor(crystal);
      addFloorCircle(crystal.position.x,crystal.position.z,.75,0xff7a1a,.22);
    }
    if(hasAffix(dgn,'Empowered')){
      const rune=new THREE.Mesh(new THREE.TorusGeometry(.7,.04,8,28),affixMat(0xa855f7,.55));
      rune.rotation.x=Math.PI/2; rune.position.set(x0,FLOOR+.12,z0); dDecor(rune);
    }
    if(hasAffix(dgn,'Frenzied')){
      for(let k=0;k<2;k++){
        const slash=new THREE.Mesh(new THREE.BoxGeometry(.06,.9,.035),affixMat(0xff3b3b,.48));
        slash.position.set(x0+(hash2(k+x0,61)-.5)*rx*1.8,FLOOR+1.35,z0+(hash2(k+z0,67)-.5)*rz*1.8);
        slash.rotation.set(.35,hash2(k,ri2)*Math.PI,.55); dDecor(slash);
      }
    }
    if(hasAffix(dgn,'Fortified')){
      for(const sx of [-1,1]){
        const brace=new THREE.Mesh(new THREE.BoxGeometry(.18,1.1,.18),new THREE.MeshLambertMaterial({color:0x747b86}));
        brace.position.set(x0+sx*(rx-.45),FLOOR+.55,z0); dDecor(brace);
      }
    }
    if(isBoss){
      if(hasAffix(dgn,'Tyrannical')){
        const tyr=new THREE.Mesh(new THREE.TorusGeometry(Math.max(2.2,Math.min(rx,rz)*.65),.08,8,44),affixMat(0xff264d,.68));
        tyr.rotation.x=Math.PI/2; tyr.position.set(x0,FLOOR+.12,z0); dDecor(tyr);
        const crown=makeTextSprite('TYRANT','#ff5a7a'); crown.position.set(x0,FLOOR+5.2,z0); crown.scale.set(3.2,1.1,1); dDecor(crown);
      }
      // corner braziers
      for(const sx of [-1,1]) for(const sz of [-1,1]){
        const grp=new THREE.Group();
        const post=new THREE.Mesh(new THREE.BoxGeometry(.18,1,.18),new THREE.MeshLambertMaterial({color:0x2a2a30})); post.position.y=.5; grp.add(post);
        const bowl=new THREE.Mesh(new THREE.CylinderGeometry(.32,.2,.36,8),new THREE.MeshLambertMaterial({color:0x3a3a42})); bowl.position.y=1.05; grp.add(bowl);
        const flame=new THREE.Mesh(new THREE.BoxGeometry(.4,.5,.4),torchFlameMat); flame.position.y=1.4; grp.add(flame);
        const gl=new THREE.Sprite(campfireGlowMat.clone()); gl.scale.set(5.5,5.5,1); gl.position.y=1.4; grp.add(gl);
        grp.position.set(x0+sx*(rx-1), FLOOR, z0+sz*(rz-1)); dDecor(grp);
      }
      // stone pillars near the walls (cosmetic)
      for(const [sx,sz] of [[-1,0],[1,0],[0,-1],[0,1]]){
        const pil=new THREE.Mesh(new THREE.BoxGeometry(.8,top-FLOOR,.8),new THREE.MeshLambertMaterial({color:0x6a6a72}));
        pil.position.set(x0+sx*(rx-0.5), FLOOR+(top-FLOOR)/2, z0+sz*(rz-0.5)); dDecor(pil);
      }
      // iron chandelier over the arena: chain, ring, and four guttering flames
      const ch=new THREE.Group();
      const chChain=new THREE.Mesh(new THREE.BoxGeometry(.07,1.3,.07),new THREE.MeshLambertMaterial({color:0x2f343a}));
      chChain.position.y=.65; ch.add(chChain);
      const hoop=new THREE.Mesh(new THREE.TorusGeometry(.85,.06,6,20),new THREE.MeshLambertMaterial({color:0x26262e}));
      hoop.rotation.x=Math.PI/2; ch.add(hoop);
      for(let k=0;k<4;k++){
        const a=k/4*Math.PI*2;
        const fl=new THREE.Mesh(new THREE.BoxGeometry(.16,.22,.16),torchFlameMat);
        fl.position.set(Math.cos(a)*.85,.16,Math.sin(a)*.85); ch.add(fl);
      }
      ch.position.set(x0,top-1.55,z0); dDecor(ch);
      const chGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas),color:0xffa64d,transparent:true,opacity:.24,blending:THREE.AdditiveBlending,depthWrite:false}));
      chGlow.position.set(x0,top-1.4,z0); chGlow.scale.set(4.6,4.6,1);
      chGlow.userData.pulse={base:.24,phase:hash2(x0*17,z0*19)*6.28};
      dDecor(chGlow);
      // glowing floor sigil + a tall locator beacon so you can find the boss
      const ring=new THREE.Mesh(new THREE.TorusGeometry(r*0.5,0.12,8,44),new THREE.MeshBasicMaterial({color:0xc23838,transparent:true,opacity:.6,blending:THREE.AdditiveBlending,depthWrite:false}));
      ring.rotation.x=Math.PI/2; ring.position.set(x0,FLOOR+.06,z0); dDecor(ring);
      const beam=new THREE.Mesh(new THREE.CylinderGeometry(.32,.32,7,8),new THREE.MeshBasicMaterial({color:0xff5a3a,transparent:true,opacity:.14,blending:THREE.AdditiveBlending,depthWrite:false}));
      beam.position.set(x0,FLOOR+3.4,z0); dDecor(beam);
      addDungeonMist(x0,z0,rx*.75,rz*.75,mods.length?mistCol:0x7f1d1d,.18);
    }
  });
}
// ---------------- boss UI: health bar + objective compass ----------------
const bossBar=document.createElement('div');
bossBar.style.cssText='position:fixed;top:60px;left:50%;transform:translateX(-50%);width:360px;max-width:60vw;display:none;z-index:8;text-align:center;font-family:Courier New,monospace';
bossBar.innerHTML='<div style="color:#ff9486;font-size:12px;letter-spacing:3px;text-shadow:0 0 8px #ff3b2f;margin-bottom:3px">☠ <span id="bossname">DUNGEON BOSS</span></div>'+
  '<div style="height:14px;border:1px solid rgba(255,96,84,.65);background:rgba(20,4,4,.74);border-radius:3px;overflow:hidden;box-shadow:0 0 14px rgba(255,40,30,.45),inset 0 0 10px rgba(0,0,0,.5)"><i id="bossfill" style="display:block;height:100%;width:100%;background:linear-gradient(#ff7a6a,#a81f14);transition:width .15s"></i></div>';
document.body.appendChild(bossBar);
const bossFill=bossBar.querySelector('#bossfill'), bossName=bossBar.querySelector('#bossname');
const bossMark=document.createElement('div');
bossMark.style.cssText='position:fixed;display:none;z-index:7;pointer-events:none;transform:translate(-50%,-50%);font-family:Courier New,monospace;text-align:center';
bossMark.innerHTML='<div id="bossarrow" style="color:#ff7a5e;font-size:22px;text-shadow:0 0 8px #ff3b2f,0 0 2px #000;line-height:1">▲</div><div id="bossdist" style="color:#ffb4a4;font-size:10px;letter-spacing:1px;text-shadow:0 0 4px #000">0m</div>';
document.body.appendChild(bossMark);
const bossArrow=bossMark.querySelector('#bossarrow'), bossDist=bossMark.querySelector('#bossdist');
const _bossVec=new THREE.Vector3(), _camTmp=new THREE.Vector3();
function findBoss(){
  for(const m of mobs){
    if(!m.boss) continue;
    if(m.net){ if(!m.ref) continue; return {hp:m.ref.hp, max:m.ref.maxHp||1, x:m.ref.x, y:m.ref.y, z:m.ref.z}; }
    return {hp:m.hp, max:m.maxHp||1, x:m.grp.position.x, y:m.grp.position.y, z:m.grp.position.z};
  }
  return null;
}
function updateBossUI(){
  const active = dim==='dungeon' && dungeon && !dungeon.cleared;
  const b = active ? findBoss() : null;
  if(!b || b.hp<=0){ if(bossBar.style.display!=='none'){bossBar.style.display='none'; bossMark.style.display='none';} return; }
  bossBar.style.display='block';
  bossFill.style.width=(Math.max(0,Math.min(1,b.hp/b.max))*100)+'%';
  bossName.textContent=(dungeon.shard?(dungeon.shard.name+' +'+dungeon.shard.plus+' '):'')+((RANKS[dungeon.rank]?RANKS[dungeon.rank].n+'-RANK ':'')+'BOSS');
  // objective marker: project boss to screen, clamp to edge when off-screen
  _bossVec.set(b.x, b.y+2.2, b.z);
  const behind=_camTmp.copy(_bossVec).applyMatrix4(camera.matrixWorldInverse).z > 0;  // camera-space z>0 = behind
  _bossVec.project(camera);
  let nx=_bossVec.x, ny=_bossVec.y;
  if(behind){ nx=-nx; ny=-ny; }
  const W=innerWidth, H=innerHeight, mgn=50;
  const onScreen=!behind && Math.abs(_bossVec.x)<=1 && Math.abs(_bossVec.y)<=1;
  let sx, sy, ang=0, edge=false;
  if(onScreen){ sx=(nx*.5+.5)*W; sy=(-ny*.5+.5)*H; }
  else { ang=Math.atan2(ny,nx); const hw=W/2-mgn, hh=H/2-mgn;
    const tt=Math.min(hw/Math.max(1e-3,Math.abs(Math.cos(ang))), hh/Math.max(1e-3,Math.abs(Math.sin(ang))));
    sx=W/2+Math.cos(ang)*tt; sy=H/2-Math.sin(ang)*tt; edge=true; }
  sx=Math.max(mgn, Math.min(W-mgn, sx)); sy=Math.max(72, Math.min(H-104, sy));   // keep clear of event HUD + hotbar
  bossMark.style.display='block'; bossMark.style.left=sx+'px'; bossMark.style.top=sy+'px';
  bossDist.textContent=Math.round(Math.hypot(b.x-player.pos.x, b.z-player.pos.z))+'m';
  if(edge){ bossArrow.textContent='➤'; bossArrow.style.transform='rotate('+(-ang)+'rad)'; }
  else { bossArrow.textContent='☠'; bossArrow.style.transform='none'; }
}
function tickTorches(t,dt){
  const fl=0.82+0.13*Math.sin(t*9)+0.07*Math.sin(t*23+1.3);   // shared torch flicker
  torchGlowMat.opacity=0.55*fl; campfireGlowMat.opacity=0.78*fl;
  torchFlameMat.color.setRGB(1,0.5+0.14*fl,0.16);
  if(dim!=='dungeon') return;
  let n=0;
  for(const key in torches){ if(n++>48) break;
    const g=torches[key], dx=g.position.x-player.pos.x, dz=g.position.z-player.pos.z;
    if(dx*dx+dz*dz>180) continue;
    if(Math.random()<dt*2.4) spawnParticle({x:g.position.x,y:g.position.y+.7,z:g.position.z,
      vx:(Math.random()-.5)*.3, vy:.55+Math.random()*.5, vz:(Math.random()-.5)*.3, life:.7, grav:-0.4, r:1, g:.6, b:.2});
  }
}
function tickDungeonAmbient(dt,t){
  if(dim!=='dungeon') return;
  const mods=dungeonMods(dungeon);
  for(const m of dungeonDecor){
    if(m.userData&&m.userData.mist&&m.material){
      const u=m.userData.mist;
      m.material.opacity=u.base*(.75+.25*Math.sin(t*.55+u.phase));
      const s=1+.025*Math.sin(t*.4+u.phase);
      m.scale.x=u.sx*s; m.scale.y=u.sy*(1+.02*Math.cos(t*.33+u.phase));
      m.rotation.z+=dt*.012;
    }
    if(m.userData&&m.userData.banner){
      const u=m.userData.banner;
      m.position.y=u.baseY+Math.sin(t*1.2+u.phase)*.025;
      m.rotation.z=Math.sin(t*1.7+u.phase)*.025;
    }
    if(m.userData&&m.userData.spin){
      const u=m.userData.spin;
      m.rotation.y+=dt*u.speed;
      m.position.y=u.baseY+Math.sin(t*1.6+u.phase)*(u.bob||.06);
      if(m.material) m.material.opacity=.55+.22*Math.sin(t*2.1+u.phase);
    }
    if(m.userData&&m.userData.pulse&&m.material){
      const u=m.userData.pulse;
      m.material.opacity=u.base*(.75+.25*Math.sin(t*1.1+u.phase));
    }
  }
  if(Math.random()<dt*9){                                      // drifting dust motes
    const a=Math.random()*6.283, r=2+Math.random()*8;
    spawnParticle({x:player.pos.x+Math.cos(a)*r, y:player.pos.y+.4+Math.random()*3.2, z:player.pos.z+Math.sin(a)*r,
      vx:(Math.random()-.5)*.12, vy:.04+Math.random()*.08, vz:(Math.random()-.5)*.12, life:2.6, grav:-0.015, r:.5, g:.47, b:.56});
  }
  if(Math.random()<dt*1.3){                                    // ceiling drips
    const a=Math.random()*6.283, r=Math.random()*7;
    spawnParticle({x:player.pos.x+Math.cos(a)*r, y:player.pos.y+3.6, z:player.pos.z+Math.sin(a)*r,
      vx:0, vy:-.1, vz:0, life:1.3, grav:9, r:.42, g:.56, b:.72});
  }
  if(mods.includes('Volatile') && Math.random()<dt*7){
    const a=Math.random()*6.283, r=2+Math.random()*9;
    spawnParticle({x:player.pos.x+Math.cos(a)*r,y:player.pos.y+.12,z:player.pos.z+Math.sin(a)*r,
      vx:(Math.random()-.5)*.35,vy:.55+Math.random()*.9,vz:(Math.random()-.5)*.35,life:.75,grav:-.2,r:1,g:.32,b:.08});
  }
  if(mods.includes('Sanguine') && Math.random()<dt*7){
    const a=Math.random()*6.283, r=Math.random()*8;
    spawnParticle({x:player.pos.x+Math.cos(a)*r,y:player.pos.y+.08,z:player.pos.z+Math.sin(a)*r,
      vx:(Math.random()-.5)*.08,vy:.08,vz:(Math.random()-.5)*.08,life:1.6,grav:0,r:.55,g:.04,b:.12});
  }
  if(mods.includes('Spiteful') && Math.random()<dt*4.5){
    const a=Math.random()*6.283, r=3+Math.random()*8;
    spawnParticle({x:player.pos.x+Math.cos(a)*r,y:player.pos.y+.7+Math.random()*2.5,z:player.pos.z+Math.sin(a)*r,
      vx:(Math.random()-.5)*.18,vy:.18+Math.random()*.22,vz:(Math.random()-.5)*.18,life:1.4,grav:-.05,r:.48,g:.86,b:1});
  }
  if((mods.includes('Bursting')||mods.includes('Grievous')) && Math.random()<dt*5){
    const a=Math.random()*6.283, r=1+Math.random()*7;
    spawnParticle({x:player.pos.x+Math.cos(a)*r,y:player.pos.y+1.5+Math.random()*1.8,z:player.pos.z+Math.sin(a)*r,
      vx:0,vy:-.12,vz:0,life:1.1,grav:.15,r:.75,g:.05,b:.12});
  }
  if(mods.includes('Quaking') && Math.random()<dt*3){
    const a=Math.random()*6.283, r=2+Math.random()*7;
    spawnParticle({x:player.pos.x+Math.cos(a)*r,y:player.pos.y+.12,z:player.pos.z+Math.sin(a)*r,
      vx:(Math.random()-.5)*.7,vy:.18+Math.random()*.4,vz:(Math.random()-.5)*.7,life:.6,grav:1.2,r:.75,g:.52,b:.25});
  }
  if(mods.includes('Explosive') && Math.random()<dt*4.5){
    const a=Math.random()*6.283, r=2+Math.random()*8;
    spawnParticle({x:player.pos.x+Math.cos(a)*r,y:player.pos.y+.4+Math.random()*2.4,z:player.pos.z+Math.sin(a)*r,
      vx:(Math.random()-.5)*.25,vy:.45+Math.random()*.65,vz:(Math.random()-.5)*.25,life:.65,grav:-.1,r:1,g:.62,b:.08});
  }
  if(mods.includes('Empowered') && Math.random()<dt*3.5){
    const a=Math.random()*6.283, r=3+Math.random()*8;
    spawnParticle({x:player.pos.x+Math.cos(a)*r,y:player.pos.y+.6+Math.random()*2.8,z:player.pos.z+Math.sin(a)*r,
      vx:0,vy:.25,vz:0,life:1.0,grav:0,r:.62,g:.28,b:1});
  }
  if(mods.includes('Frenzied') && Math.random()<dt*4){
    const a=Math.random()*6.283, r=2+Math.random()*8;
    spawnParticle({x:player.pos.x+Math.cos(a)*r,y:player.pos.y+.5+Math.random()*1.8,z:player.pos.z+Math.sin(a)*r,
      vx:Math.cos(a)*.35,vy:.18,vz:Math.sin(a)*.35,life:.55,grav:0,r:1,g:.08,b:.08});
  }
  if(mods.includes('Fortified') && Math.random()<dt*2.4){
    const a=Math.random()*6.283, r=3+Math.random()*8;
    spawnParticle({x:player.pos.x+Math.cos(a)*r,y:player.pos.y+.15,z:player.pos.z+Math.sin(a)*r,
      vx:(Math.random()-.5)*.18,vy:.25+Math.random()*.25,vz:(Math.random()-.5)*.18,life:.9,grav:1.5,r:.58,g:.62,b:.68});
  }
  if(mods.includes('Tyrannical') && Math.random()<dt*2.5 && dungeon&&dungeon.bossRoom){
    const br=dungeon.bossRoom, a=Math.random()*6.283, r=Math.random()*Math.max(2,br.r||5);
    spawnParticle({x:br.x+Math.cos(a)*r,y:9.3+Math.random()*3.8,z:br.z+Math.sin(a)*r,
      vx:0,vy:.18,vz:0,life:1.2,grav:0,r:1,g:.12,b:.24});
  }
}
function refreshTorchMeshes(){
  for(const key in torches){ scene.remove(torches[key]); delete torches[key]; }
  for(const key of Object.keys(chunkMeshes)){
    const [cx,cz]=key.split(',').map(Number);
    syncTorchesForChunk(cx,cz);
  }
}
function applyDim(){
  townGroup.visible = dim==='overworld';
  if(roadSafetySceneGroup)roadSafetySceneGroup.visible=dim==='overworld';
  cropGroup.visible = dim==='overworld' || dim==='tutorial';
  const underground = dim==='dungeon' || dim==='gatecutscene';
  cloudGroup.visible = !underground;
  sky.visible = !underground;
  stars.visible = !underground;
  if(dim==='overworld'){ scene.fog.near=40; scene.fog.far=110; }
  else if(dim==='event'){ scene.fog.near=45; scene.fog.far=150; }
  else if(dim==='tutorial'){ scene.fog.near=30; scene.fog.far=100; }
  else if(dim==='ability'){ scene.fog.near=28; scene.fog.far=92; }
  else if(dim==='gatecutscene'){ scene.fog.near=18; scene.fog.far=115; scene.fog.color.set(0x151022); }
  else { scene.fog.near=8; scene.fog.far=36; }
}
let onboardingRoomReturn=null;
function localTutorialSpaceId(kind){
  return 'tutorial-'+kind+'-'+(NET.room&&NET.room.sessionId||'local');
}
function generateOnboardingRoom(){
  const {x:cx,z:cz,G,R}=TRAINING_MEADOW;
  const minX=Math.floor(cx-R-8),maxX=Math.ceil(cx+R+8),minZ=Math.floor(cz-R-8),maxZ=Math.ceil(cz+R+8);
  const w=new DimensionGrid({kind:'tutorial',id:'onboarding',originX:minX,originZ:minZ,width:maxX-minX+1,height:WH,depth:maxZ-minZ+1,empty:B.AIR,outside:B.AIR});
  buildTrainingMeadow((x,y,z,v)=>w.setB(x,y,z,v));
  for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){
    const d=Math.hypot(x-cx,z-cz);
    if(d>R&&d<=R+6){
      const y=G-Math.max(0,Math.round((d-R)*.8));
      for(let yy=1;yy<y;yy++) w.setB(x,yy,z,yy<y-3?B.STONE:B.DIRT);
      w.setB(x,y,z,d>R+3?B.STONE:B.GRASS);
    }
  }
  return w;
}
function enterOnboardingRoom(){
  if(dim==='tutorial') return true;
  if(dim!=='overworld') return false;
  onboardingRoomReturn={world,pos:player.pos.clone(),yaw:player.yaw,pitch:player.pitch};
  owWorld=world;
  world=generateOnboardingRoom();
  dim='tutorial';
  NET.dgn=localTutorialSpaceId('onboarding');
  world.id=NET.dgn;
  rebuildAllChunks();refreshTorchMeshes();applyDim();
  if(NET.on&&NET.room) NET.room.send('tutorialEnter',{kind:'onboarding'});
  return true;
}
function clearOnboardingCropMeshes(){
  for(const key of Object.keys(cropMeshes)){
    const [x,y,z]=key.split(',').map(Number);
    if(isTrainingMeadowLand(x,z,2)) removeCropMesh(x,y,z);
  }
}
function exitOnboardingRoom(notify=true){
  if(dim!=='tutorial') return;
  clearOnboardingCropMeshes();
  const ret=onboardingRoomReturn;
  world=(ret&&ret.world)||owWorld||world;
  dim='overworld';
  owWorld=world;
  NET.dgn='';
  rebuildAllChunks();refreshTorchMeshes();applyDim();
  if(notify&&NET.on&&NET.room) NET.room.send('tutorialExit',{});
  onboardingRoomReturn=null;
}
let abilityRoomReturn=null;
function generateAbilityRoom(){
  const {x:cx,z:cz,G,R}=ABILITY_MEADOW;
  const minX=Math.floor(cx-R-8),maxX=Math.ceil(cx+R+8),minZ=Math.floor(cz-R-8),maxZ=Math.ceil(cz+R+8);
  const w=new DimensionGrid({kind:'tutorial',id:'ability',originX:minX,originZ:minZ,width:maxX-minX+1,height:WH,depth:maxZ-minZ+1,empty:B.AIR,outside:B.AIR});
  buildAbilityMeadow((x,y,z,v)=>w.setB(x,y,z,v));
  for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){
    const d=Math.hypot(x-cx,z-cz);
    if(d>R && d<=R+6){
      const y=G-Math.max(0,Math.round((d-R)*.8));
      for(let yy=1;yy<y;yy++) w.setB(x,yy,z,yy<y-3?B.STONE:B.DIRT);
      w.setB(x,y,z,d>R+3?B.STONE:B.GRASS);
    }
  }
  return w;
}
function enterAbilityRoom(){
  if(dim==='ability') return true;
  if(dim!=='overworld') return false;
  abilityRoomReturn={world, pos:player.pos.clone(), yaw:player.yaw, pitch:player.pitch};
  for(let i=mobs.length-1;i>=0;i--) if(!mobs[i].net) removeMob(i);
  if(mounted){ mounted=false; mountKind=''; if(localMountObj) localMountObj.visible=false; }
  owWorld=world;
  world=generateAbilityRoom();
  dim='ability';
  NET.dgn=localTutorialSpaceId('ability');
  world.id=NET.dgn;
  rebuildAllChunks(); refreshTorchMeshes(); applyDim();
  if(NET.on&&NET.room) NET.room.send('tutorialEnter',{kind:'ability'});
  return true;
}
function exitAbilityRoom(){
  if(dim!=='ability') return;
  stopAbilityDemo(true);
  tutorialDummyGroup.visible=false;
  tutorialPillarGroup.visible=false;
  for(let i=mobs.length-1;i>=0;i--) if(!mobs[i].net) removeMob(i);
  const ret=abilityRoomReturn;
  world=(ret&&ret.world)||owWorld||world;
  dim='overworld';
  owWorld=world;
  NET.dgn='';
  rebuildAllChunks(); refreshTorchMeshes(); applyDim();
  if(ret&&player){
    player.pos.copy(ret.pos);
    player.yaw=ret.yaw;
    player.pitch=ret.pitch;
    player.vel.set(0,0,0);
  }
  abilityRoomReturn=null;
  if(NET.on&&NET.room) NET.room.send('tutorialExit',{});
}
function spawnDungeonMob(x,z,boss,ri){
  const mul=RANKS[ri].mul;
  const skel=!boss && ri>=1 && Math.random()<.35;
  const sh2=dungeon?dungeon.shard:null;
  let hpMul2=1, dmgMul2=1;
  if(sh2){
    hpMul2=1+.35*sh2.plus; dmgMul2=1+.22*sh2.plus;
    if(sh2.mods.includes('Empowered')) dmgMul2*=1.5;
    if(!boss && sh2.mods.includes('Fortified')) hpMul2*=1.8;
    if(boss && sh2.mods.includes('Tyrannical')){ hpMul2*=1.6; dmgMul2*=1.3; }
  }
  const hpv=Math.round((boss ? 50*mul : (skel?6:8)+8*mul)*hpMul2);
  const m=tintMob({...(boss?makeGateBoss():skel?makeSkeleton():makeZombie()), dungeon:true, boss,
    kind: boss?'boss':skel?'skeleton':'zombie',
    hp:hpv, maxHp:hpv,
    dmg: Math.round((boss ? 5+ri*2 : 3+ri)*dmgMul2),
    arrowDmg:Math.round((2+ri)*dmgMul2), shootCd:1+Math.random(),
    kb:new THREE.Vector3(), wait:0, tx:x, tz:z,
    alert:!!boss, sx:x, sz:z,
    flank:(Math.random()<.5?-1:1)*(.5+Math.random()*.7),
    strafe:Math.random()<.5?-1:1, strafeT:2+Math.random()*2,
    drawT:0, lungeT:0, lunging:0, losT:Math.random()*.25, patrolT:0,
    state:'chase', stateT:0, gcd:2.5,
    speed: boss?1.3:(skel?1.3:1.6)+Math.random()*.5, phase:Math.random()*10, hitT:0, atkCd:0, slowT:0});
  if(boss){
    m.grp.scale.setScalar(1.6);
    m.baseCol=[1,1,1];                          // the Gate Monarch model carries its own palette
    m.slamCd=5; m.slamT=0; m.sum1=false; m.sum2=false; m.enraged=false; m.slamDmg=Math.round((6+ri*2)*dmgMul2);
  }
  const gy=standHeight(x,z,12);  // scan inside the room, below the bedrock cap
  m.grp.position.set(x, gy>0?gy:9, z);
  scene.add(m.grp);
  mobs.push(m);
}
// DungeonRoom 2c-i: opt-in flag (off by default) to route gate entry through a real `dungeon`
// Colyseus room instead of the in-room instance. Enable with ?dungeonRoom or bc_dungeon_room=1.
const USE_DUNGEON_ROOM=(()=>{ try{ return new URLSearchParams(location.search).has('dungeonRoom')||localStorage.getItem('bc_dungeon_room')==='1'; }catch(e){ return false; } })();
// Clear the room-specific synced entities (remote hunters + their net mobs) before swapping the
// live connection between the overworld `blockcraft` room and a `dungeon` room, so the destination
// room's state.onAdd rebuilds cleanly. beginDungeon handles gates + non-net mobs on arrival.
function clearRoomEntitiesForSwitch(){
  for(const sid in NET.remotes) netRemoveRemote(sid);
  for(let i=mobs.length-1;i>=0;i--) if(mobs[i].net) removeMob(i);
}
// Switch into the dedicated DungeonRoom for a gate. Takes an explicit descriptor so it works both
// for a walk-up entry (built from the local `gate`) and for a lobby-driven entry (the server's
// dungeonLobbyStart payload for a ready party). Field names match DungeonRoom.gateFromOptions.
function enterDungeonRoomWith(desc){
  if(!(NET.on && desc && desc.gateId && NETWORK.switchRoom)) return false;
  clearRoomEntitiesForSwitch();
  NETWORK.switchRoom('dungeon', {
    gateId:desc.gateId, seed:(desc.seed>>>0)||0, rank:desc.rank|0, kind:desc.kind||'public',
    gateX:desc.gateX, gateY:desc.gateY, gateZ:desc.gateZ,
    shardPlus:desc.shardPlus|0, shardName:desc.shardName||'', shardMods:desc.shardMods||'',
  });
  return true;
}
function enterDungeon(){
  if(NET.on){
    if(USE_DUNGEON_ROOM && gate && gate.id && NETWORK.switchRoom){
      enterDungeonRoomWith({
        gateId:gate.id, seed:gate.seed, rank:gate.rank, kind:gate.kind,
        gateX:gate.x, gateY:gate.y, gateZ:gate.z,
        shardPlus:(gate.shard&&gate.shard.plus)|0, shardName:(gate.shard&&gate.shard.name)||'',
        shardMods:(gate.shard&&gate.shard.mods&&gate.shard.mods.join(','))||'',
      });
      return;
    }
    NET.room.send('enterGate', { id: gate && gate.id || '' });
    return;
  }
  beginDungeon(gate.rank, (Math.random()*2147483647)|0, null,
    {back:{x:gate.x, y:gate.y, z:gate.z}, shard:gate.shard||null, localMobs:true, cleared:false});
}
function beginDungeon(ri, seed, editLog, opts){
  sleepEl.style.opacity=1;
  setTimeout(()=>{
    if(gate){ scene.remove(gate.grp); gate=null; }
    clearNetGates();
    dungeon=generateDungeon(ri, seed);
    dungeon.seed=seed>>>0;
    dungeon.back=opts.back;
    dungeon.shard=opts.shard||null;
    dungeon.cleared=!!opts.cleared;
    dungeon.kind=opts.kind||'public';
    dungeon.status=opts.status||null;
    if(NET.pendingDungeonStatus && (!NET.dgn || NET.pendingDungeonStatus.id===NET.dgn)){
      const pending=NET.pendingDungeonStatus; NET.pendingDungeonStatus=null;
      setTimeout(()=>applyDungeonStatus(pending),0);
    }
    if(dungeon.shard) sysMsg('<b>+'+dungeon.shard.plus+' '+dungeon.shard.name+'</b> shard active: '+dungeon.shard.mods.join(', '));
    for(let i=mobs.length-1;i>=0;i--) if(!mobs[i].net) removeMob(i);
    owWorld=world; world=dungeon.world; dim='dungeon';
    if(mounted){ mounted=false; mountKind=''; if(localMountObj) localMountObj.visible=false; }  // can't ride into a dungeon
    if(editLog) for(const e of editLog) setB(e.x,e.y,e.z,e.id);
    rebuildAllChunks(); refreshTorchMeshes(); applyDim();
    player.pos.set(dungeon.entrance.x+.5, 9.01, dungeon.entrance.z+.5);
    player.vel.set(0,0,0);
    exitPortal=makeGateMesh(0x6ee06a);
    exitPortal.position.set(dungeon.entrance.x+.5, 9, dungeon.entrance.z-dungeon.entrance.r+1.5);
    scene.add(exitPortal);
    const exitLbl=makeTextSprite('EXIT','#7effa0'); exitLbl.position.set(0,2.6,0); exitPortal.add(exitLbl);
    placeDungeonDecor(dungeon);
    if(opts.localMobs){
      for(const s of dungeon.spawns) spawnDungeonMob(s.x, s.z, false, ri);
      spawnDungeonMob(dungeon.bossRoom.x, dungeon.bossRoom.z, true, ri);
    }
    SFX.portal();
    sysMsg('You have entered the <b>'+RANKS[ri].n+'-Rank Gate</b>. Slay the boss');
    sleepEl.style.opacity=0;
  }, 700);
}
function exitDungeon(instant){
  const doSwap=()=>{
    if(!dungeon) return;
    SFX.portal();
    clearShardHazards();
    clearDungeonDecor();
    if(!dungeon.cleared) sysMsg('You <b>fled</b> the gate');
    for(let i=mobs.length-1;i>=0;i--) if(!mobs[i].net) removeMob(i);
    if(NET.on && NET.dgn){
      if(USE_DUNGEON_ROOM && NET.roomName==='dungeon' && NETWORK.returnToPrimary){
        clearRoomEntitiesForSwitch(); NETWORK.returnToPrimary(); NET.dgn='';
      } else { NET.room.send('exitGate'); NET.dgn=''; }
    }
    if(exitPortal){ scene.remove(exitPortal); exitPortal=null; }
    world=owWorld; dim='overworld';
    netFlushPending();
    rebuildAllChunks(); refreshTorchMeshes(); applyDim();
    player.pos.set(dungeon.back.x+1.5, dungeon.back.y+.5, dungeon.back.z);
    player.vel.set(0,0,0);
    dungeon=null;
    NET.pendingDungeonStatus=null;
    gateTimer=120;
    if(!instant) sleepEl.style.opacity=0;
  };
  if(instant) doSwap();
  else { sleepEl.style.opacity=1; setTimeout(doSwap, 700); }
}
function onBossKilled(){
  if(!dungeon||dungeon.cleared) return;
  dungeon.cleared=true;
  const ri=dungeon.rank;
  sysMsg('<b>Boss defeated!</b> The '+RANKS[ri].n+'-Rank Gate is cleared');
  questGate(ri);
  const shc=dungeon.shard;
  const plus=shc?shc.plus:0;
  gainXP(Math.round((50+ri*40)*(1+.4*plus)));
  addItem(I.COAL, 3+ri*2+plus);
  addItem(I.IRON_INGOT, 2+ri*2+plus);
  const dia=(ri>=2?ri-1:0)+Math.floor(plus/2);
  if(dia>0) addItem(I.DIAMOND, dia);
  if(shc){
    addGold(40+plus*25);
    addItem(I.LEGEND_TOKEN, 1);
    sysMsg('<b>+'+plus+' shard cleared!</b> Bonus loot, gold, and a <b>Legendary Weapon Token</b>');
  } else {
    const ti=Math.min(4, ri+(Math.random()<.25?1:0));
    addItem(SHARD_IDS[ti], 1);
    sysMsg('A <b>'+SHARD_TIERS[ti].name+' Dungeon Shard</b> falls from the boss — attune it at the plaza pedestal');
  }
  sysMsg('Loot acquired: ingots, coal'+(dia>0?', diamonds':'')+'. Mine the walls before you leave');
}
const COMPASS=['N','NE','E','SE','S','SW','W','NW'];
function gateCompass(){
  const dx=gate.x-player.pos.x, dz=gate.z-player.pos.z;
  const a=Math.atan2(dx,-dz);
  return Math.round(Math.hypot(dx,dz))+'m '+COMPASS[(Math.round(a/(Math.PI/4))+8)%8];
}
function tickGates(dt, now){
  if(NET.on) netMirrorGate();
  else if(dim==='overworld' && gateSystemUnlocked() && !gate && !dungeon){
    gateTimer-=dt;
    if(gateTimer<=0) spawnGate();
  }
  for(const [g,col] of [[gate&&gate.grp, gate&&gate.colArr], [exitPortal, [.43,.88,.42]]]){
    if(!g) continue;
    g.userData.disc.rotation.z+=dt*1.6;
    const pl=1+Math.sin(now/280)*.05;
    g.userData.ring.scale.set(pl,pl,1);
    if(Math.random()<dt*16){
      const p=g.position;
      spawnParticle({x:p.x+(Math.random()-.5)*2.4, y:p.y+.3+Math.random()*3.2, z:p.z+(Math.random()-.5)*.7,
        vx:(Math.random()-.5)*.3, vy:.5+Math.random()*.5, vz:(Math.random()-.5)*.3,
        life:.6, grav:0, r:col[0], g:col[1], b:col[2]});
    }
  }
}

gameContext.registerState('dimensions', Object.freeze({
  get kind(){ return dim; },
  get dungeon(){ return dungeon; },
  get gate(){ return gate; },
  get exitPortal(){ return exitPortal; },
  get overworldGrid(){ return owWorld; },
}));
gameContext.registerModule('dimensions', Object.freeze({
  enterDungeon,
  exitDungeon,
  rebuild:rebuildAllChunks,
  tickGates,
}));


const legacyDimensionsBindings={
  "AB_UNLOCK":{get:()=>AB_UNLOCK},
  "abCd":{get:()=>abCd},
  "abilityRoomReturn":{get:()=>abilityRoomReturn,set:value=>{abilityRoomReturn=value;}},
  "activeAbilityPath":{get:()=>activeAbilityPath},
  "applyDim":{get:()=>applyDim},
  "beams":{get:()=>beams},
  "beginDungeon":{get:()=>beginDungeon},
  "carveBox":{get:()=>carveBox},
  "cast":{get:()=>cast},
  "castArmorPower":{get:()=>castArmorPower},
  "castLegendaryWeapon":{get:()=>castLegendaryWeapon},
  "chronoSnapVfx":{get:()=>chronoSnapVfx},
  "clearNetGates":{get:()=>clearNetGates},
  "closeStat":{get:()=>closeStat},
  "cycleBetaAbilityPath":{get:()=>cycleBetaAbilityPath},
  "cycleBetaLegendaryWeapon":{get:()=>cycleBetaLegendaryWeapon},
  "dim":{get:()=>dim,set:value=>{dim=value;}},
  "displayHeldId":{get:()=>displayHeldId},
  "dungeon":{get:()=>dungeon,set:value=>{dungeon=value;}},
  "dungeonMoodColor":{get:()=>dungeonMoodColor},
  "eclipseDashVfx":{get:()=>eclipseDashVfx},
  "enterAbilityRoom":{get:()=>enterAbilityRoom},
  "USE_DUNGEON_ROOM":{get:()=>USE_DUNGEON_ROOM},
  "enterDungeon":{get:()=>enterDungeon},
  "enterDungeonRoomWith":{get:()=>enterDungeonRoomWith},
  "enterOnboardingRoom":{get:()=>enterOnboardingRoom},
  "equippedArmor":{get:()=>equippedArmor},
  "exitAbilityRoom":{get:()=>exitAbilityRoom},
  "exitDungeon":{get:()=>exitDungeon},
  "exitOnboardingRoom":{get:()=>exitOnboardingRoom},
  "exitPortal":{get:()=>exitPortal,set:value=>{exitPortal=value;}},
  "frostbiteChakramVfx":{get:()=>frostbiteChakramVfx},
  "gate":{get:()=>gate,set:value=>{gate=value;}},
  "gateCompass":{get:()=>gateCompass},
  "gateKindLabel":{get:()=>gateKindLabel},
  "gravityBowVfx":{get:()=>gravityBowVfx},
  "hex01":{get:()=>hex01},
  "legendaryWeaponCd":{get:()=>legendaryWeaponCd},
  "leviathanStormVfx":{get:()=>leviathanStormVfx},
  "makeBlackholeVisual":{get:()=>makeBlackholeVisual},
  "makeGateMesh":{get:()=>makeGateMesh},
  "makeShadow":{get:()=>makeShadow},
  "meteorImpactVfx":{get:()=>meteorImpactVfx},
  "meteorMarkVfx":{get:()=>meteorMarkVfx},
  "midasStrikeVfx":{get:()=>midasStrikeVfx},
  "netGates":{get:()=>netGates},
  "openStat":{get:()=>openStat},
  "owWorld":{get:()=>owWorld,set:value=>{owWorld=value;}},
  "PATHS":{get:()=>PATHS},
  "phoenixFlameVfx":{get:()=>phoenixFlameVfx},
  "projectiles":{get:()=>projectiles},
  "RANKS":{get:()=>RANKS},
  "rebuildAllChunks":{get:()=>rebuildAllChunks},
  "refreshTorchMeshes":{get:()=>refreshTorchMeshes},
  "removeEquippedArmorCopies":{get:()=>removeEquippedArmorCopies},
  "renderAbilities":{get:()=>renderAbilities},
  "renderStat":{get:()=>renderStat},
  "selectedLegendaryWeapon":{get:()=>selectedLegendaryWeapon},
  "sendPlayerMetaNow":{get:()=>sendPlayerMetaNow},
  "sendProfileSaveNow":{get:()=>sendProfileSaveNow},
  "setAbilityPath":{get:()=>setAbilityPath},
  "setGateLabel":{get:()=>setGateLabel},
  "soulReapVfx":{get:()=>soulReapVfx},
  "spawnDungeonMob":{get:()=>spawnDungeonMob},
  "startBlackholeMob":{get:()=>startBlackholeMob},
  "statEl":{get:()=>statEl},
  "statOpen":{get:()=>statOpen,set:value=>{statOpen=value;}},
  "tickAbilities":{get:()=>tickAbilities},
  "tickBlackholedMob":{get:()=>tickBlackholedMob},
  "tickBlackholes":{get:()=>tickBlackholes},
  "tickDungeonAmbient":{get:()=>tickDungeonAmbient},
  "tickGates":{get:()=>tickGates},
  "tickTorches":{get:()=>tickTorches},
  "titanHammerVfx":{get:()=>titanHammerVfx},
  "updateAbilityHUD":{get:()=>updateAbilityHUD},
  "updateBossUI":{get:()=>updateBossUI},
  "viewDir":{get:()=>viewDir},
  "voidAnchorVfx":{get:()=>voidAnchorVfx},
  "wardenSonicVfx":{get:()=>wardenSonicVfx},
};
for(const [bindingName,binding] of Object.entries(legacyDimensionsBindings)){
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,bindingName);
  if(!descriptor||descriptor.configurable)Object.defineProperty(globalThis,bindingName,{...binding,configurable:true});
}

export const state=gameContext.requireState('dimensions');
export const api=gameContext.requireModule('dimensions');
export {worldApi,worldState};
export default api;
