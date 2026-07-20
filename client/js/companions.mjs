import {disposeObjectTree} from './three-disposal.mjs';
const FAMILIAR_SYSTEM=globalThis.BlockcraftFamiliarSystem;

export function createCompanionSystem({
  NET,
  player,
  inv,
  gearSystem,
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
  teamCol,
  teamName,
}){
// ---------------- mounts ----------------
// Voxel mounts, built feet-at-y=0 with the saddle near the per-kind lift height and the
// head toward +z (matching the remote avatar's facing). The lift raises a seated rider's
// group so their feet rest on the saddle while the mount's feet reach the ground.
// Dragon species. Mount values are 'dragon:<id>'; each has its own egg, palette, and flight feel.
const DRAGON_TYPES_LIST=[
  {id:'ember',  name:'Ember Dragon',  egg:I.DRAGON_EGG, fly:13,  size:1.0,
   scale:['#7a1410','#a83020','#48080a','#320406'], belly:['#caa23e','#e8c46a','#8a6a1e','#5e4712'],
   dark:['#3a0608','#5a0e0a','#240306','#180204'], membrane:['#c8401a','#ff8a3a','#7a1608','#ff7a1a'],
   horn:['#e8d8b0','#fff4d8','#9a8a68','#6a5e44'], eggShell:'#b3372a', eggSpeck:'#ffcf6a'},
  {id:'verdant',name:'Verdant Dragon',egg:I.EGG_VERDANT,fly:12.5,size:1.0,
   scale:['#1f6a2e','#2f9a44','#0e3818','#08240f'], belly:['#cdd86a','#e8f0a0','#8a9a3e','#5e6a22'],
   dark:['#0c2e14','#16461f','#061f0c','#041407'], membrane:['#3fae3a','#8aff6a','#1a7a16','#7aff4a'],
   horn:['#e8e0b0','#fff8d8','#9a986a','#6a6444'], eggShell:'#2f9a44', eggSpeck:'#e8f0a0'},
  {id:'frost',  name:'Frost Dragon',  egg:I.EGG_FROST, fly:13.5,size:1.0,
   scale:['#1f5aa8','#3f8fd0','#103a6a','#0a2444'], belly:['#cfeaf6','#eafaff','#8ab6d0','#5e84a4'],
   dark:['#0c2238','#163a55','#06141e','#040d14'], membrane:['#5aa8e8','#bfeaff','#2a7ad0','#9bdcff'],
   horn:['#dff0ff','#ffffff','#9ab6c8','#6a8499'], eggShell:'#3f8fd0', eggSpeck:'#eafaff'},
  {id:'storm',  name:'Storm Dragon',  egg:I.EGG_STORM, fly:15,  size:1.0,
   scale:['#4a2a78','#6e46b0','#281544','#190d2b'], belly:['#c9b9f0','#e8ddff','#8a6ac0','#5e4790'],
   dark:['#1c1030','#2a1850','#0c0818','#06040f'], membrane:['#7a46e8','#c8a8ff','#4a2ac0','#b86cff'],
   horn:['#e0d8ff','#ffffff','#9a8ac8','#6a5e99'], eggShell:'#6e46b0', eggSpeck:'#e8ddff'},
  {id:'void',   name:'Void Dragon',   egg:I.EGG_VOID,  fly:14,  size:1.12,
   scale:['#15101f','#2a2040','#08060f','#050308'], belly:['#3a2a55','#5a4680','#241640','#160d2a'],
   dark:['#08060f','#160e22','#040308','#020104'], membrane:['#3a1060','#b86cff','#1a0830','#d8a8ff'],
   horn:['#7a6ac0','#c8a8ff','#4a3a90','#2a1e60'], eggShell:'#2a2040', eggSpeck:'#b86cff'},
];
const DRAGON_TYPES={}; for(const d of DRAGON_TYPES_LIST) DRAGON_TYPES[d.id]=d;
const DRAGON_EGG_TO_TYPE={}; for(const d of DRAGON_TYPES_LIST) DRAGON_EGG_TO_TYPE[d.egg]=d.id;
const DRAGON_EGG_PATTERN=[
"................","......eeee......",".....eEEEEe.....","....eEEsEEEe....",
"...eEEEEEsEEe...","...eEsEEEEEEe...","..eEEEEEsEEEEe..","..eEEsEEEEEEEe..",
"..eEEEEEEsEEEe..","..eEEsEEEEEEEe..","...eEEEEEsEEe...","...eEEEEEEEEe...",
"....eEEEEEEe....",".....eeeeee....."];
for(const d of DRAGON_TYPES_LIST){
  ITEMS[d.egg]={name:d.name+' Egg',stack:1,
    icon:iconCanvas(ctx=>drawPattern(ctx,DRAGON_EGG_PATTERN,{e:'#241016',E:d.eggShell,s:d.eggSpeck}))};
}
function dragonType(kind){ const i=kind.indexOf(':'); return i>=0?kind.slice(i+1):'ember'; }
function dragonTrailColor(type){
  const d=DRAGON_TYPES[type]||DRAGON_TYPES.ember;
  const n=parseInt(d.membrane[1].slice(1),16);
  return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255];
}
const DRAGON_SHAPES={
  ember:{body:[.94,.78,2.05], chest:[.72,.52,.42], neck:[.46,.58,.72], head:[.5,.46,.68], snout:[.38,.3,.38], wing:1.05, wingDrop:.18, tail:1.08, spine:1.25, horns:'ram', fin:'flame', aura:'ember'},
  verdant:{body:[.86,.7,1.9], chest:[.64,.46,.36], neck:[.42,.56,.7], head:[.46,.42,.62], snout:[.34,.26,.34], wing:.92, wingDrop:.3, tail:1.0, spine:.8, horns:'antler', fin:'leaf', aura:'leaf'},
  frost:{body:[.82,.68,1.86], chest:[.62,.44,.34], neck:[.4,.54,.7], head:[.46,.42,.62], snout:[.34,.26,.34], wing:.98, wingDrop:.34, tail:.96, spine:1.5, horns:'ice', fin:'crystal', aura:'snow'},
  storm:{body:[.82,.66,2.12], chest:[.6,.44,.34], neck:[.38,.56,.78], head:[.44,.42,.64], snout:[.32,.26,.34], wing:1.24, wingDrop:.12, tail:1.16, spine:1.05, horns:'fork', fin:'bolt', aura:'spark'},
  void:{body:[.76,.68,2.3], chest:[.56,.44,.34], neck:[.36,.7,.88], head:[.46,.44,.66], snout:[.32,.26,.36], wing:1.14, wingDrop:.2, tail:1.42, spine:1.2, horns:'void', fin:'void', aura:'void'},
};
// species-colored glow trailing from the wingtips and tail of a flying dragon
function emitDragonTrail(pos, yaw, type, dt, holder){
  holder._trailAcc=(holder._trailAcc||0)+dt;
  if(holder._trailAcc<0.045) return;            // throttle to ~22 puffs/s per emitter set
  holder._trailAcc=0;
  const col=dragonTrailColor(type), cos=Math.cos(yaw), sin=Math.sin(yaw);
  const emit=(lx,ly,lz)=>{
    const wx=pos.x+lx*cos+lz*sin, wz=pos.z-lx*sin+lz*cos, wy=pos.y+ly;
    spawnParticle({ x:wx+(Math.random()-.5)*.2, y:wy+(Math.random()-.5)*.2, z:wz+(Math.random()-.5)*.2,
      vx:(Math.random()-.5)*.5, vy:(Math.random()-.35)*.5, vz:(Math.random()-.5)*.5,
      life:.45+Math.random()*.45, grav:-0.3, r:col[0], g:col[1], b:col[2] });
  };
  emit(1.55,1.7,0); emit(-1.55,1.7,0); emit(0,1.0,-1.95);   // two wingtips + tail
}
function emitDragonAura(pos, type, dt, holder){
  holder._auraAcc=(holder._auraAcc||0)+dt;
  if(holder._auraAcc<0.22) return;
  holder._auraAcc=0;
  const shape=DRAGON_SHAPES[type]||DRAGON_SHAPES.ember;
  const col=dragonTrailColor(type);
  const a=Math.random()*Math.PI*2, r=.55+Math.random()*.9;
  const p={x:pos.x+Math.cos(a)*r,y:pos.y+.65+Math.random()*1.5,z:pos.z+Math.sin(a)*r,
    vx:(Math.random()-.5)*.18,vy:.15+Math.random()*.22,vz:(Math.random()-.5)*.18,
    life:.55+Math.random()*.45,grav:-.15,r:col[0],g:col[1],b:col[2]};
  if(shape.aura==='ember'){ p.vy=.25+Math.random()*.45; p.grav=.15; p.r=1; p.g=.38+Math.random()*.18; p.b=.08; }
  else if(shape.aura==='snow'){ p.vy=-.05; p.grav=.05; p.r=.82; p.g=.95; p.b=1; }
  else if(shape.aura==='leaf'){ p.vx+=Math.cos(a+1.6)*.25; p.vz+=Math.sin(a+1.6)*.25; p.r=.45; p.g=1; p.b=.28; }
  else if(shape.aura==='spark'){ p.life=.25; p.vy=.35; p.r=.75; p.g=.65; p.b=1; }
  else if(shape.aura==='void'){ p.grav=-.25; p.r=.75; p.g=.32; p.b=1; }
  spawnParticle(p);
}
function mountLift(kind){ return isDragon(kind)?1.6:1.0; }
function mountEye(kind){ return isDragon(kind)?1.55:0.95; }   // extra camera height for the local rider
function makeMount(kind, bondLevel=1, specialization=''){
  const type=isDragon(kind)?dragonType(kind):'';
  const g = type ? makeDragonMount(type, bondLevel, specialization) : makeHorseMount();
  g.userData.mountKind=kind;
  return g;
}
function makeHorseMount(){
  const grp=new THREE.Group();
  const coat=voxelMats('#7a5230','#9a7242','#4a3018','#3a2412');
  const legM=voxelMats('#4a3018','#5a3a20','#2a180c','#1e1208');
  const saddleM=voxelMats('#5a2a18','#7a4028','#321208','#26100a');
  const maneM=voxelMats('#2a1a0c','#3a2412','#180e06','#120a04');
  addBox(grp,[0.72,0.62,1.5],[0,0.98,0],coat);            // barrel
  addBox(grp,[0.6,0.5,0.32],[0,0.98,0.74],coat);          // chest
  addBox(grp,[0.6,0.5,0.32],[0,0.98,-0.74],coat);         // rump
  addBox(grp,[0.34,0.72,0.4],[0,1.44,0.82],coat,[-0.5,0,0]); // neck
  addBox(grp,[0.32,0.34,0.6],[0,1.78,1.2],coat);          // head
  addBox(grp,[0.26,0.26,0.22],[0,1.7,1.48],legM);         // muzzle
  addBox(grp,[0.09,0.17,0.09],[-0.1,1.99,1.06],coat);     // ears
  addBox(grp,[0.09,0.17,0.09],[0.1,1.99,1.06],coat);
  addBox(grp,[0.12,0.5,0.5],[0,1.62,0.66],maneM,[-0.5,0,0]); // mane
  const lx=0.26, lz=0.55, lh=0.95;
  for(const sx of [-1,1]) for(const sz of [-1,1]){
    addBox(grp,[0.18,lh,0.2],[sx*lx, lh/2, sz*lz], legM);   // legs
    addBox(grp,[0.2,0.13,0.22],[sx*lx,0.065,sz*lz], maneM); // hooves
  }
  addBox(grp,[0.12,0.62,0.14],[0,1.0,-0.86],maneM,[0.5,0,0]); // tail
  addBox(grp,[0.52,0.16,0.66],[0,1.32,-0.05],saddleM);    // saddle
  grp.userData.mountKind='horse';
  return grp;
}
function makeDragonMount(type, bondLevel=1, specialization=''){
  const d=DRAGON_TYPES[type]||DRAGON_TYPES.ember;
  const sh=DRAGON_SHAPES[type]||DRAGON_SHAPES.ember;
  const bond=Math.max(1,Math.min(6,bondLevel|0));
  const spec=DRAGON_SPECIALIZATION_DEFS_C[specialization]?specialization:'';
  const grp=new THREE.Group();
  const scale=voxelMats(...d.scale);
  const belly=voxelMats(...d.belly);
  const dark=voxelMats(...d.dark);
  const membrane=glowVoxelMats(d.membrane[0],d.membrane[1],d.membrane[2],d.membrane[3],.8);
  const horn=voxelMats(...d.horn);
  const eye=glowVoxelMats(d.membrane[1],d.membrane[1],d.membrane[0],d.membrane[3],1.25);
  const saddleM=voxelMats('#3a2412','#5a3a20','#1e1208','#160d06');
  const strapM=voxelMats('#17100a','#2a1a10','#090604','#050302');
  const toothM=voxelMats('#e8e0c8','#fff8e8','#9a9074','#5a523e');
  const accent=glowVoxelMats(d.membrane[0],d.membrane[1],d.membrane[2],d.membrane[3],1.05);
  addBox(grp,sh.body,[0,1.3,0],scale);                    // body
  addBox(grp,[sh.body[0]*.72,0.38,sh.body[2]*.86],[0,1.0,0],belly); // belly
  addBox(grp,sh.chest,[0,1.36,.88],scale,[-.18,0,0]);      // chest plate
  addBox(grp,[sh.body[0]*.9,.13,.18],[0,1.73,.42],dark,[.28,0,0]);
  addBox(grp,[sh.body[0]*.82,.12,.16],[0,1.72,-.22],dark,[.18,0,0]);
  for(let i=0;i<4;i++){
    addBox(grp,[sh.body[0]*.48,.055,.16],[0,.78,-.72+i*.43],belly,[.12,0,0]);
  }
  const lh=0.85;
  for(const sx of [-1,1]) for(const sz of [-1,1]){
    addBox(grp,[0.3,0.32,0.34],[sx*0.36,0.92,sz*0.52],scale,[sz*.12,0,sx*.04]); // shoulder/haunch
    addBox(grp,[0.22,lh,0.26],[sx*0.34, lh/2, sz*0.58], dark);     // legs
    addBox(grp,[0.18,0.26,0.22],[sx*0.34,0.38,sz*0.74],scale,[sz*.16,0,0]);      // ankle scale
    addBox(grp,[0.28,0.13,0.34],[sx*0.34,0.065,sz*0.66], dark);    // clawed feet
    addBox(grp,[0.08,0.06,0.16],[sx*0.34,0.15,sz*0.84],horn);      // toe claw
    addBox(grp,[0.06,0.05,0.12],[sx*0.22,0.14,sz*0.86],horn,[0,sx*.16,0]);
    addBox(grp,[0.06,0.05,0.12],[sx*0.46,0.14,sz*0.86],horn,[0,-sx*.16,0]);
  }
  addBox(grp,sh.neck,[0,1.76,1.0],scale,[-0.55,0,0]);      // neck
  addBox(grp,[sh.neck[0]*.82,.18,sh.neck[2]*.76],[0,1.63,1.05],belly,[-.55,0,0]);
  addBox(grp,sh.head,[0,2.13,1.5],scale);                  // head
  addBox(grp,[sh.head[0]*.96,.14,.42],[0,2.29,1.32],dark,[-.1,0,0]); // brow ridge
  addBox(grp,sh.snout,[0,2.06,1.88],dark);                 // snout
  addBox(grp,[sh.snout[0]*.72,.12,sh.snout[2]*.72],[0,1.91,1.84],belly,[.08,0,0]); // lower jaw
  addBox(grp,[.09,.08,.16],[-.28,2.11,1.66],scale,[0,0,-.18]);
  addBox(grp,[.09,.08,.16],[ .28,2.11,1.66],scale,[0,0,.18]);
  addBox(grp,[.07,.08,.06],[-.15,2.2,1.84],eye);
  addBox(grp,[.07,.08,.06],[ .15,2.2,1.84],eye);
  for(const sx of [-1,1]){
    addBox(grp,[.05,.09,.12],[sx*.12,1.96,2.08],toothM,[.18,0,0]);
    addBox(grp,[.05,.08,.1],[sx*.24,1.98,1.98],toothM,[.12,0,0]);
    addBox(grp,[.08,.34,.12],[sx*.31,2.2,1.35],membrane,[0,0,sx*.48]); // cheek fin
  }
  if(sh.horns==='antler'){
    for(const sx of [-1,1]){
      addBox(grp,[.08,.36,.08],[sx*.2,2.45,1.3],horn,[-.25,0,sx*.35]);
      addBox(grp,[.07,.22,.07],[sx*.34,2.58,1.28],horn,[-.55,0,sx*.75]);
      addBox(grp,[.06,.2,.06],[sx*.12,2.6,1.2],horn,[-.65,0,-sx*.4]);
    }
  } else if(sh.horns==='fork'){
    for(const sx of [-1,1]){
      addBox(grp,[.08,.38,.08],[sx*.2,2.46,1.3],horn,[-.55,0,sx*.28]);
      addBox(grp,[.06,.25,.06],[sx*.3,2.57,1.24],horn,[-.2,0,sx*.85]);
    }
  } else if(sh.horns==='ice'){
    for(const sx of [-1,1]){
      addBox(grp,[.12,.42,.12],[sx*.18,2.45,1.28],horn,[-.65,0,sx*.18]);
      addBox(grp,[.08,.28,.08],[sx*.34,2.28,1.5],horn,[-.15,0,sx*.5]);
    }
  } else if(sh.horns==='void'){
    addBox(grp,[.09,.5,.09],[-.2,2.48,1.25],horn,[-.8,0,-.45]);
    addBox(grp,[.12,.36,.12],[ .18,2.42,1.32],horn,[-.25,0,.25]);
  } else {
    addBox(grp,[0.13,0.36,0.13],[-0.2,2.45,1.3],horn,[-0.35,0,-0.42]);
    addBox(grp,[0.13,0.36,0.13],[0.2,2.45,1.3],horn,[-0.35,0,0.42]);
  }
  for(let i=0;i<3;i++){
    const z=.9+i*.22, y=1.82+i*.16;
    addBox(grp,[.09,.18,.1],[0,y,z],horn,[-.45,0,0]);
  }
  addBox(grp,[0.36,0.34,0.95*sh.tail],[0,1.22,-1.1],scale,[0.22,0,0]); // tail base
  addBox(grp,[0.22,0.22,0.85*sh.tail],[0,0.98,-1.78],scale,[0.4,0,0]); // tail mid
  addBox(grp,[0.14,0.14,0.46*sh.tail],[0,0.78,-2.32],dark,[0.56,0,0]); // tail whip
  if(sh.fin==='leaf'){
    addBox(grp,[0.58,0.08,0.34],[0,0.8,-2.25],membrane,[0,.35,0]);
    addBox(grp,[0.34,0.06,0.24],[-.22,0.92,-2.36],membrane,[0,.72,.25]);
    addBox(grp,[0.34,0.06,0.24],[ .22,0.7,-2.38],membrane,[0,-.72,-.25]);
  } else if(sh.fin==='crystal'){
    addBox(grp,[0.16,0.4,0.22],[0,0.82,-2.2],horn,[.65,0,0]);
    addBox(grp,[0.3,0.12,0.24],[0,0.72,-2.12],dark);
    addBox(grp,[0.12,0.28,0.18],[-.16,0.72,-2.46],horn,[.35,0,-.35]);
    addBox(grp,[0.12,0.28,0.18],[ .16,0.64,-2.45],horn,[.25,0,.35]);
  } else if(sh.fin==='bolt'){
    addBox(grp,[0.18,0.18,0.42],[-.08,0.82,-2.12],horn,[0,0,.55]);
    addBox(grp,[0.18,0.18,0.42],[ .1,0.7,-2.3],horn,[0,0,-.55]);
    addBox(grp,[0.08,0.08,0.42],[0,0.62,-2.55],accent,[0,0,.8]);
  } else if(sh.fin==='void'){
    addBox(grp,[0.42,0.06,0.3],[-.18,0.88,-2.22],membrane,[0,.5,.2]);
    addBox(grp,[0.36,0.06,0.26],[ .18,0.7,-2.1],membrane,[0,-.4,-.2]);
    addBox(grp,[0.18,0.18,0.18],[0,0.72,-2.48],accent,[.65,.35,.2]);
  } else {
    addBox(grp,[0.42,0.14,0.28],[0,0.8,-2.18],membrane);
    addBox(grp,[0.24,0.1,0.2],[0,0.7,-2.46],accent,[.25,0,0]);
  }
  // spinal ridge
  for(let i=0;i<5;i++){
    const h=.14+sh.spine*.06*(i%2?0.8:1.15);
    addBox(grp,[0.1,h,0.14],[0,1.68+h*.35,-0.78+i*0.4],i%2&&type==='frost'?horn:dark,[0.2,0,0]);
  }
  if(type==='ember'){
    addBox(grp,[.12,.12,.12],[-.34,1.64,.42],accent,[.4,0,0]);
    addBox(grp,[.12,.12,.12],[ .34,1.64,.42],accent,[.4,0,0]);
  } else if(type==='verdant'){
    for(const sx of [-1,1]) addBox(grp,[.22,.05,.18],[sx*.48,1.52,-.3],membrane,[.25,0,sx*.45]);
  } else if(type==='frost'){
    for(const sx of [-1,1]) addBox(grp,[.09,.28,.09],[sx*.22,1.9,-.3],horn,[.75,0,sx*.2]);
  } else if(type==='storm'){
    addBox(grp,[.08,.08,1.25],[0,1.78,-.18],accent,[0,0,.62]);
  } else if(type==='void'){
    addBox(grp,[.26,.16,.26],[0,1.54,-.64],accent,[.35,.4,.15]);
  }
  // wings on shoulder pivots so they can flap
  const wings=[];
  for(const side of [-1,1]){
    const piv=new THREE.Group();
    piv.position.set(side*0.36, 1.72, 0.1);
    addBox(piv,[0.18,0.5,0.18],[side*0.18,0.16,0],dark);            // shoulder spar
    addBox(piv,[1.55*sh.wing,0.14,0.18],[side*.86*sh.wing,0.07,-0.45],dark); // leading bone
    addBox(piv,[0.82*sh.wing,0.08,0.12],[side*.58*sh.wing,-.08,-.1],horn,[0,0,side*.18]);
    addBox(piv,[0.64*sh.wing,0.07,0.12],[side*.48*sh.wing,-.2,-.58],horn,[0,0,side*.26]);
    addBox(piv,[1.16*sh.wing,0.09,.48],[side*.74*sh.wing,-sh.wingDrop*.25,.04],membrane,[0,0,side*.04]);
    addBox(piv,[.92*sh.wing,0.08,.46],[side*.62*sh.wing,-.12-sh.wingDrop*.5,-.42],membrane,[0,0,side*.08]);
    addBox(piv,[.56*sh.wing,0.07,.34],[side*.42*sh.wing,-.22-sh.wingDrop*.75,-.84],membrane,[0,0,side*.12]);
    addBox(piv,[.18,.08,.18],[side*1.58*sh.wing,.04,-.52],horn,[0,0,side*.2]);
    addBox(piv,[.08,.08,.72],[side*.98*sh.wing,-.16,-.95],membrane,[0,0,side*.3]);
    if(type==='storm') addBox(piv,[.09,.09,1.05],[side*1.15*sh.wing,.0,-.52],horn,[0,side*.25,0]);
    if(type==='verdant') addBox(piv,[.34,.06,.28],[side*.98*sh.wing,-.3,-.9],membrane,[0,0,side*.55]);
    if(type==='frost') addBox(piv,[.08,.18,.38],[side*1.0*sh.wing,-.28,-.92],horn,[.45,0,side*.24]);
    if(type==='void') addBox(piv,[.12,.12,.32],[side*1.18*sh.wing,-.24,-.78],accent,[.25,0,side*.28]);
    grp.add(piv);
    wings.push(piv);
  }
  addBox(grp,[0.62,0.18,0.72],[0,1.72,-0.05],saddleM);             // saddle
  addBox(grp,[0.78,0.08,0.12],[0,1.62,.24],strapM);
  addBox(grp,[0.78,0.08,0.12],[0,1.61,-.34],strapM);
  addBox(grp,[0.08,0.36,0.08],[-.42,1.43,-.02],strapM);
  addBox(grp,[0.08,0.36,0.08],[ .42,1.43,-.02],strapM);
  addBox(grp,[0.22,0.05,0.16],[-.48,1.24,-.02],saddleM);
  addBox(grp,[0.22,0.05,0.16],[ .48,1.24,-.02],saddleM);
  if(bond>=2){
    const trim=glowVoxelMats(d.membrane[1],d.membrane[0],d.membrane[2],d.membrane[3],1.15);
    addBox(grp,[0.7,0.04,0.08],[0,1.84,.22],trim);
    addBox(grp,[0.7,0.04,0.08],[0,1.84,-.32],trim);
  }
  if(bond>=4){
    const glow=glowVoxelMats(d.membrane[0],d.membrane[1],d.membrane[2],d.membrane[3],1.35);
    for(const sx of [-1,1]){
      addBox(grp,[0.06,0.06,0.82],[sx*.62,1.55,-.06],glow,[0,0,sx*.08]);
      addBox(grp,[0.08,0.08,0.2],[sx*.46,2.22,1.74],glow,[0,0,sx*.18]);
    }
  }
  if(bond>=6){
    const gem=glowVoxelMats('#fff7b0',d.membrane[1],d.membrane[0],d.membrane[3],1.65);
    addBox(grp,[0.18,0.12,0.18],[0,2.36,1.54],gem,[.25,.45,0]);
    addBox(grp,[0.12,0.28,0.12],[0,2.58,1.28],gem,[-.7,0,0]);
  }
  if(spec){
    const specM=glowVoxelMats(dragonSpecializationColor(spec),dragonSpecializationColor(spec),'#ffffff','#140c1c',1.45);
    if(spec==='scout'){
      for(const sx of [-1,1]){
        addBox(grp,[0.09,0.09,0.92],[sx*1.72*sh.wing,1.74,-.62],specM,[0,0,sx*.34]);
        addBox(grp,[0.08,0.08,0.54],[sx*.44,2.08,1.78],specM,[.12,0,sx*.32]);
      }
      addBox(grp,[0.12,0.07,0.82],[0,1.86,.04],specM,[0,0,.2]);
    } else if(spec==='defender'){
      for(const sx of [-1,1]){
        addBox(grp,[0.22,0.22,0.28],[sx*.5,1.62,.64],specM,[.25,0,sx*.18]);
        addBox(grp,[0.16,0.16,0.26],[sx*.44,1.02,-.66],specM,[.1,0,sx*.16]);
      }
      addBox(grp,[0.76,0.08,0.16],[0,1.88,.42],specM,[.2,0,0]);
    } else if(spec==='sage'){
      addBox(grp,[0.18,0.3,0.18],[0,2.39,1.44],specM,[-.45,.35,0]);
      addBox(grp,[0.5,0.06,0.32],[-.26,1.72,-.46],specM,[.1,0,.35]);
      addBox(grp,[0.5,0.06,0.32],[ .26,1.72,-.46],specM,[.1,0,-.35]);
      addBox(grp,[0.24,0.08,0.32],[0,.92,-2.32],specM,[0,.25,0]);
    }
  }
  grp.scale.setScalar(d.size||1);
  grp.userData.wings=wings;
  grp.userData.dragonType=type;
  grp.userData.wingBeat=type==='storm'?6.3:type==='void'?3.5:type==='frost'?4.2:5;
  grp.userData.wingAmp=type==='storm'?.72:type==='verdant'?.42:type==='void'?.52:.58;
  return grp;
}
function animateMountWings(obj, now){
  const w=obj.userData.wings;
  if(!w) return;
  const beat=obj.userData.wingBeat||5, amp=obj.userData.wingAmp||.55;
  const flap=Math.sin(now/1000*beat)*amp;
  const tuck=obj.userData.dragonType==='verdant'?.08:obj.userData.dragonType==='void'?.02:.15;
  w[0].rotation.z=-tuck-flap;   // left wing
  w[1].rotation.z= tuck+flap;   // right wing
  w[0].rotation.x=Math.sin(now/1000*beat*.5)*.08;
  w[1].rotation.x=Math.sin(now/1000*beat*.5)*.08;
}
function ensureRemoteMount(r, kind){
  if(r.mountObj && r.mountKind!==kind){ r.grp.remove(r.mountObj); r.mountObj=null; r.mountKind=''; }
  if(kind && !r.mountObj){
    r.mountObj=makeMount(kind);
    r.mountObj.position.y=-mountLift(kind);   // feet reach the ground beneath the raised rider
    r.mountKind=kind;
    r.grp.add(r.mountObj);
  } else if(!kind && r.mountObj){
    r.grp.remove(r.mountObj);
    r.mountObj=null; r.mountKind='';
  }
}
let mounted=false, mountKind='', localMountObj=null;
let dragonUnlocks=[];            // hatched dragon type ids, in cycle order; persisted in the profile
let dragonCare={};               // type -> {happiness, fedAt}
let dragonBondXp={};             // type -> server-owned bond XP, raised by care/riding/combat
let dragonNames={};              // type -> custom name, shown on bond cards and roost nameplates
let dragonGenders={};            // type -> male/female, assigned when the egg hatches
let dragonPersonalities={};       // type -> personality trait assigned when the egg hatches
let dragonRoles={};               // type -> follow/stay/guard/rest command role
let dragonStaySpots={};           // type -> {x,y,z,yaw} saved when role is stay
let dragonHatchedAt={};           // type -> hatch timestamp; 0 means migrated adult
let dragonRoleMastery={};          // type -> role -> XP earned by using dragon roles
let dragonSpecializations={};      // type -> scout/defender/sage once chosen at high bond
let dragonTrainingState=null;       // active server-authoritative role drill progress
let dragonChallenges={};           // server-owned daily bond challenge state
let dragonRoleReadyAt={};         // type:role -> local HUD cooldown estimate after authoritative role events
let dragonRoleActivity={};        // type -> {role,text,until} short-lived live HUD activity label
let dragonMapFocus={type:'',until:0}; // short-lived map highlight requested from command UI
let dragonActivityLog=[];          // recent local-only dragon events for command/bond panels
const DRAGON_GROW_MS_C=2*60*1000;
const DRAGON_JUVENILE_MS_C=Math.floor(DRAGON_GROW_MS_C/2);
function dragonGender(type){ return dragonGenders[type]==='female'?'female':'male'; }
function dragonGenderLabel(type){ return dragonGender(type)==='female'?'Female':'Male'; }
const DRAGON_PERSONALITIES_C=['bold','gentle','proud','playful','skittish','hungry'];
function defaultDragonPersonality(type){ return ({ember:'bold',verdant:'gentle',frost:'skittish',storm:'playful',void:'proud'})[type]||'bold'; }
function randomDragonPersonality(){ return DRAGON_PERSONALITIES_C[(Math.random()*DRAGON_PERSONALITIES_C.length)|0]; }
function dragonPersonality(type){
  const p=dragonPersonalities[type];
  return DRAGON_PERSONALITIES_C.includes(p)?p:defaultDragonPersonality(type);
}
function dragonPersonalityTrait(typeOrTrait){
  return DRAGON_PERSONALITIES_C.includes(typeOrTrait)?typeOrTrait:dragonPersonality(typeOrTrait);
}
function dragonPersonalityLabel(type){
  const p=dragonPersonalityTrait(type);
  return p.charAt(0).toUpperCase()+p.slice(1);
}
function dragonPersonalityText(type){
  const p=dragonPersonalityTrait(type);
  return ({
    bold:'Leans in during guard work and earns extra bond from mounted abilities.',
    gentle:'Keeps calmer rest poses and happiness fades more slowly.',
    proud:'Carries a taller idle pose and gains stronger bond cooldown scaling.',
    playful:'Bounces more while following and earns extra bond from care.',
    skittish:'Keeps a wider orbit, reacts quickly, and bonds faster while young.',
    hungry:'Sniffs around for treats and gains more happiness from feeding.',
  })[p]||'A steady companion with balanced behavior.';
}
function dragonPersonalityColor(type){
  const p=dragonPersonalityTrait(type);
  return ({bold:'#ff8a5b',gentle:'#a7f3d0',proud:'#d8a8ff',playful:'#ffd166',skittish:'#93c5fd',hungry:'#fbbf24'})[p]||'#7dd3fc';
}
function dragonPersonalityMotion(type){
  const p=dragonPersonalityTrait(type);
  return ({
    bold:{back:.9,side:.92,move:1.14,wing:1.08,bob:1.05,guardSpark:1.35},
    gentle:{back:1.04,side:.95,move:.92,wing:.78,bob:.58,restSpark:1.2},
    proud:{back:1,side:1,move:1,wing:.94,bob:.82,tilt:.055},
    playful:{back:.92,side:1.08,move:1.12,wing:1.32,bob:1.55,happySpark:1.35},
    skittish:{back:1.22,side:1.28,move:1.28,wing:1.22,bob:1.12,jitter:.18},
    hungry:{back:.86,side:.88,move:1.04,wing:1,bob:1.08,sniff:1},
  })[p]||{back:1,side:1,move:1,wing:1,bob:1};
}
const DRAGON_ROLES_C=['follow','stay','guard','rest'];
function dragonRole(type){
  const r=dragonRoles[type];
  return DRAGON_ROLES_C.includes(r)?r:'follow';
}
function dragonRoleLabel(type){
  const r=dragonRole(type);
  return r.charAt(0).toUpperCase()+r.slice(1);
}
function dragonHatchTime(type){
  const at=Number(dragonHatchedAt&&dragonHatchedAt[type]||0);
  return Number.isFinite(at)&&at>0?at:0;
}
function dragonAgeMs(type){
  const at=dragonHatchTime(type);
  return at?Math.max(0,Date.now()-at):DRAGON_GROW_MS_C;
}
function dragonIsAdult(type){ return dragonAgeMs(type)>=DRAGON_GROW_MS_C; }
function dragonGrowthProgress(type){ return Math.max(0,Math.min(1,dragonAgeMs(type)/DRAGON_GROW_MS_C)); }
function dragonStage(type){
  const age=dragonAgeMs(type);
  return age>=DRAGON_GROW_MS_C?'adult':(age>=DRAGON_JUVENILE_MS_C?'juvenile':'baby');
}
function dragonStageLabel(type){
  const stage=dragonStage(type);
  return stage==='adult'?'Adult':(stage==='juvenile'?'Juvenile':'Baby');
}
function dragonGrowthLeftSeconds(type){ return Math.max(0,Math.ceil((DRAGON_GROW_MS_C-dragonAgeMs(type))/1000)); }
const DRAGON_BOND_THRESHOLDS_C=[0,40,120,260,480,800];
const DRAGON_BOND_MILESTONES_C=[
  {level:1, title:'Bonded', reward:'Basic care, names, roles, and roosting.'},
  {level:2, title:'Saddle Trust', reward:'Saddle trim appears on your mounted dragon.'},
  {level:3, title:'Command Focus', reward:'Role mastery improves guard and stay cooldowns.'},
  {level:4, title:'Luminous Wing', reward:'Wing and eye glow marks a proven companion.'},
  {level:5, title:'Battle Rhythm', reward:'Dragon guard damage and ability bond scaling improve.'},
  {level:6, title:'Loyal Legend', reward:'A crown gem marks a fully loyal dragon.'},
];
const DRAGON_DAILY_CHALLENGES_C=[
  {id:'care', title:'Treat Training', reason:'care', need:1, reward:24, desc:'Care for or feed any bonded dragon.'},
  {id:'follow', title:'Wing Road', reason:'follow', need:3, reward:28, desc:'Earn three travel bond ticks with a Follow dragon.'},
  {id:'guard', title:'Watchful Guard', reason:'guard', need:3, reward:32, desc:'Let a Guard dragon protect you three times.'},
  {id:'rest', title:'Quiet Roost', reason:'rest', need:3, reward:24, desc:'Recover happiness three times with a Rest dragon.'},
  {id:'stay', title:'Hold The Post', reason:'stay', need:1, reward:30, desc:'Let a Stay dragon defend its saved post once.'},
  {id:'ability', title:'Breath Practice', reason:'ability', need:2, reward:30, desc:'Use mounted dragon abilities twice.'},
];
function dragonChallengeDay(now=Date.now()){ return Math.floor(now/86400000); }
function dragonDailyChallenge(day=dragonChallengeDay()){
  return DRAGON_DAILY_CHALLENGES_C[Math.abs(day|0)%DRAGON_DAILY_CHALLENGES_C.length];
}
function dragonChallengeProgress(){
  const day=dragonChallengeDay(), def=dragonDailyChallenge(day), saved=dragonChallenges&&typeof dragonChallenges==='object'?dragonChallenges:{};
  const active=saved.day===day&&saved.id===def.id;
  const progress=active?Math.max(0,Math.min(def.need,saved.progress|0)):0;
  return {...def, day, progress, claimed:!!(active&&saved.claimed), type:active?(saved.type||''):''};
}
function dragonBondLevelFromXp(xp){
  xp=Math.max(0,xp|0);
  let level=1;
  for(let i=1;i<DRAGON_BOND_THRESHOLDS_C.length;i++) if(xp>=DRAGON_BOND_THRESHOLDS_C[i]) level=i+1;
  return level;
}
function dragonBondLevel(type){ return dragonBondLevelFromXp(dragonBondXp[type]||0); }
function dragonBondProgress(type){
  const xp=Math.max(0,dragonBondXp[type]||0), level=dragonBondLevelFromXp(xp);
  const cur=DRAGON_BOND_THRESHOLDS_C[level-1]||0, next=DRAGON_BOND_THRESHOLDS_C[level]||cur;
  return {xp, level, cur, next, pct:next>cur?Math.round((xp-cur)/(next-cur)*100):100};
}
function dragonBondMilestone(level){
  level=Math.max(1,Math.min(DRAGON_BOND_MILESTONES_C.length,level|0));
  return DRAGON_BOND_MILESTONES_C[level-1];
}
function dragonBondRewardText(type){
  const level=dragonBondLevel(type), current=dragonBondMilestone(level), next=dragonBondMilestone(level+1);
  return current.title+': '+current.reward+(next&&next.level>level?' Next: '+next.title+' at Lv '+next.level+'.':'');
}
const DRAGON_MASTERY_THRESHOLDS_C=[0,12,36,80,150];
const DRAGON_SPECIALIZATION_DEFS_C={
  scout:{name:'Scout',desc:'Follow travel bond and travel drills trigger about 10% sooner.'},
  defender:{name:'Defender',desc:'Guard and Stay gain +1 range, +1 damage, and 10% faster defense recovery.'},
  sage:{name:'Roost Sage',desc:'Care treats restore +4 happiness, Rest recovers 25% faster, and Rest can reach 90 happiness.'},
};
const DRAGON_SPECIALIZATION_COLORS_C={scout:'#5ee7ff',defender:'#ffd166',sage:'#8fffb0'};
const DRAGON_MASTERY_TITLES_C={
  follow:['Trail Rookie','Path Rider','Wing Guide','Sky Scout','Horizon Master'],
  guard:['Watch Rookie','Shield Claw','Aegis Wing','Bulwark Drake','Guardian Master'],
  stay:['Post Rookie','Sentinel','Ward Drake','Holdfast','Keep Warden'],
  rest:['Calm Rookie','Nest Tender','Soothing Wing','Tranquil Drake','Roost Sage'],
};
const DRAGON_MASTERY_REWARDS_C={
  follow:[
    'Travel drills active.',
    'Training trail flourish unlocked.',
    'Shorter travel drill pacing.',
    'Faster travel bond rhythm.',
    'Master trail title shown.',
  ],
  guard:[
    'Owner defense active.',
    'Training shield flourish unlocked.',
    'Wider guard intercept range.',
    'Quicker guard recovery.',
    'Stronger high-rank guard hits.',
  ],
  stay:[
    'Post defense active.',
    'Training post flourish unlocked.',
    'Wider stay watch range.',
    'Quicker post defense recovery.',
    'Stronger high-rank stay hits.',
  ],
  rest:[
    'Recovery training active.',
    'Training calm flourish unlocked.',
    'Faster happiness recovery.',
    'Stronger calm recovery rhythm.',
    'Master roost title shown.',
  ],
};
function dragonRoleMasteryXp(type, role){
  const row=dragonRoleMastery&&dragonRoleMastery[type];
  return row&&typeof row==='object'?Math.max(0,row[role]|0):0;
}
function dragonRoleMasteryLevel(type, role){
  const xp=dragonRoleMasteryXp(type, role);
  let level=1;
  for(let i=1;i<DRAGON_MASTERY_THRESHOLDS_C.length;i++) if(xp>=DRAGON_MASTERY_THRESHOLDS_C[i]) level=i+1;
  return level;
}
function dragonRoleMasteryProgress(type, role=dragonRole(type)){
  const xp=dragonRoleMasteryXp(type, role), level=dragonRoleMasteryLevel(type, role);
  const cur=DRAGON_MASTERY_THRESHOLDS_C[level-1]||0, next=DRAGON_MASTERY_THRESHOLDS_C[level]||cur;
  return {role,xp,level,cur,next,pct:next>cur?Math.round((xp-cur)/(next-cur)*100):100};
}
function dragonRoleMasteryTitle(type, role=dragonRole(type)){
  const level=dragonRoleMasteryLevel(type, role);
  const titles=DRAGON_MASTERY_TITLES_C[role]||DRAGON_MASTERY_TITLES_C.follow;
  return titles[Math.max(0,Math.min(titles.length-1,level-1))]||('Rank '+level);
}
function dragonRoleMasteryReward(type, role=dragonRole(type), level=dragonRoleMasteryLevel(type, role)){
  const rewards=DRAGON_MASTERY_REWARDS_C[role]||DRAGON_MASTERY_REWARDS_C.follow;
  return rewards[Math.max(0,Math.min(rewards.length-1,level-1))]||'Role mastery improved.';
}
function dragonRoleMasteryNextReward(type, role=dragonRole(type)){
  const level=dragonRoleMasteryLevel(type, role);
  if(level>=DRAGON_MASTERY_THRESHOLDS_C.length) return 'All role unlocks earned.';
  return dragonRoleMasteryReward(type, role, level+1);
}
function dragonSpecialization(type){
  const s=dragonSpecializations&&dragonSpecializations[type];
  return DRAGON_SPECIALIZATION_DEFS_C[s]?s:'';
}
function dragonSpecializationName(typeOrSpec){
  const spec=DRAGON_SPECIALIZATION_DEFS_C[typeOrSpec]?typeOrSpec:dragonSpecialization(typeOrSpec);
  return spec?(DRAGON_SPECIALIZATION_DEFS_C[spec].name||spec):'Unchosen';
}
function dragonSpecializationText(typeOrSpec){
  const spec=DRAGON_SPECIALIZATION_DEFS_C[typeOrSpec]?typeOrSpec:dragonSpecialization(typeOrSpec);
  return spec?(DRAGON_SPECIALIZATION_DEFS_C[spec].desc||'Specialized dragon bonus active.'):'Choose at Bond Lv 4.';
}
function dragonSpecializationChoices(){ return Object.keys(DRAGON_SPECIALIZATION_DEFS_C); }
function dragonSpecializationColor(typeOrSpec){
  const spec=DRAGON_SPECIALIZATION_DEFS_C[typeOrSpec]?typeOrSpec:dragonSpecialization(typeOrSpec);
  return spec?(DRAGON_SPECIALIZATION_COLORS_C[spec]||'#d8a8ff'):'#7dd3fc';
}
function dragonSpecializationHex(typeOrSpec){
  return parseInt(dragonSpecializationColor(typeOrSpec).slice(1),16)||0x7dd3fc;
}
function hexToRgb01(hex){
  hex=Math.max(0,Math.min(0xffffff,hex|0));
  return [((hex>>16)&255)/255,((hex>>8)&255)/255,(hex&255)/255];
}
function canChooseDragonSpecialization(type){
  return !!(DRAGON_TYPES[type]&&dragonUnlocks.includes(type)&&dragonIsAdult(type)&&dragonBondLevel(type)>=4&&!dragonSpecialization(type));
}
function chooseDragonSpecialization(type, specialization){
  if(!DRAGON_TYPES[type] || !dragonUnlocks.includes(type) || !DRAGON_SPECIALIZATION_DEFS_C[specialization]) return false;
  if(!canChooseDragonSpecialization(type)){ sysMsg('Dragon specializations unlock for adult dragons at <b>Bond Lv 4</b>.'); return false; }
  if(NET.on && NET.room){ NET.room.send('chooseDragonSpecialization',{type,specialization}); return true; }
  dragonSpecializations[type]=specialization;
  addDragonActivity(type,'Specialization chosen',dragonSpecializationName(specialization));
  sysMsg('<b>'+DRAGON_TYPES[type].name+'</b> specialized as <b>'+dragonSpecializationName(specialization)+'</b>.');
  if(mounted&&mountKind==='dragon:'+type) applyMount('dragon:'+type);
  return true;
}
function applyDragonRoleMasteryUpdate(m){
  if(!m||!DRAGON_TYPES[m.type]||!m.role) return false;
  if(!dragonRoleMastery[m.type]) dragonRoleMastery[m.type]={};
  const before=dragonRoleMasteryLevel(m.type,m.role);
  dragonRoleMastery[m.type][m.role]=Math.max(0,m.xp|0);
  const after=dragonRoleMasteryLevel(m.type,m.role);
  if(after>before) addDragonActivity(m.type,'Training rank unlocked',dragonRoleMasteryTitle(m.type,m.role)+' - '+dragonRoleMasteryReward(m.type,m.role,after));
  return true;
}
function startDragonTraining(type){
  const role=dragonRole(type);
  if(!DRAGON_TYPES[type] || !dragonUnlocks.includes(type)) return false;
  if(!dragonIsAdult(type)){ sysMsg('Young dragons need to grow before training.'); return false; }
  if(NET.on && NET.room){ NET.room.send('startDragonTraining',{type,role}); return true; }
  dragonTrainingState={type,role,title:role.charAt(0).toUpperCase()+role.slice(1)+' Drill',progress:0,need:1,unit:'task'};
  const mastery=applyDragonRoleMasteryUpdate({type,role,xp:dragonRoleMasteryXp(type,role)+3});
  addDragonActivity(type,'Training drill complete','Mastery +3');
  sysMsg('<b>'+dragonTrainingState.title+'</b> complete. Mastery improved.');
  dragonTrainingState=null;
  return mastery;
}
function applyDragonTrainingUpdate(m){
  if(!m||!DRAGON_TYPES[m.type]) return false;
  dragonTrainingState={type:m.type,role:m.role||dragonRole(m.type),title:m.title||'Dragon Drill',progress:Math.max(0,Number(m.progress)||0),need:Math.max(1,Number(m.need)||1),unit:m.unit||'',waiting:m.waiting||''};
  return true;
}
function applyDragonTrainingComplete(m){
  if(!m||!DRAGON_TYPES[m.type]) return false;
  if(m.roleMastery) applyDragonRoleMasteryUpdate({type:m.type,...m.roleMastery});
  addDragonActivity(m.type,'Training drill complete',(m.role||'role')+' mastery +'+((m.roleMastery&&m.roleMastery.gained)||0));
  dragonTrainingState=null;
  return true;
}
function clearDragonTraining(m={}){
  dragonTrainingState=null;
  return true;
}
function dragonTrainingProgress(type){
  return dragonTrainingState&&dragonTrainingState.type===type?dragonTrainingState:null;
}
function dragonTrainingLabel(t=dragonTrainingState){
  if(!t) return '';
  const need=Math.max(1,Number(t.need)||1), progress=Math.max(0,Math.min(need,Number(t.progress)||0));
  const pct=Math.round(progress/need*100);
  const unit=t.unit?(' '+t.unit):'';
  const waiting=t.waiting?(' - '+String(t.waiting).toUpperCase()):'';
  return (t.title||'Dragon Drill')+' '+pct+'% ('+Math.floor(progress)+'/'+Math.floor(need)+unit+')'+waiting;
}
function dragonTrainingFx(now, dt){
  const t=dragonTrainingState;
  if(!t||dim!=='overworld'||!DRAGON_TYPES[t.type]) return;
  const role=t.role||dragonRole(t.type), col=dragonTrailColor(t.type);
  const mastery=dragonRoleMasteryLevel(t.type, role);
  const boost=1+Math.max(0,mastery-1)*.08;
  const extra=mastery>=2?4:0;
  const hex=new THREE.Color(col[0],col[1],col[2]).getHex();
  const spec=dragonSpecialization(t.type), specHex=spec?dragonSpecializationHex(spec):hex;
  if(!t.fxNext||now>=t.fxNext){
    t.fxNext=now+(role==='follow'?520:role==='rest'?760:640);
    if(role==='stay'){
      const s=dragonStaySpots[t.type];
      const x=s&&Number.isFinite(+s.x)?+s.x:player.pos.x, y=s&&Number.isFinite(+s.y)?+s.y:player.pos.y, z=s&&Number.isFinite(+s.z)?+s.z:player.pos.z;
      if(typeof ringPulse==='function') ringPulse(x,y+.08,z,2.4*boost,hex,.55);
      if(spec && typeof ringPulse==='function') ringPulse(x,y+.12,z,1.7*boost,specHex,.28);
      if(mastery>=5 && typeof ringPulse==='function') ringPulse(x,y+.11,z,1.35*boost,0xffe78a,.32);
      for(let i=0;i<8+extra;i++){
        const a=Math.random()*6.283, r=1.2+Math.random()*2.3;
        spawnParticle({x:x+Math.cos(a)*r,y:y+.12,z:z+Math.sin(a)*r,vx:0,vy:.18+Math.random()*.25,vz:0,life:.55,grav:-.08,r:col[0],g:col[1],b:col[2]});
      }
    } else if(role==='guard'){
      if(typeof ringPulse==='function') ringPulse(player.pos.x,player.pos.y+.08,player.pos.z,1.55*boost,hex,.42);
      if(typeof ringPulse==='function') ringPulse(player.pos.x,player.pos.y+.1,player.pos.z,.85*boost,(spec?specHex:(mastery>=5?0xffe78a:0xffffff)),.24);
    } else if(role==='rest'){
      const pos=dragonReactionPosition(t.type);
      if(typeof ringPulse==='function') ringPulse(pos.x,pos.y+.08,pos.z,1.4*boost,0x70f06a,.45);
      if((spec||mastery>=5) && typeof ringPulse==='function') ringPulse(pos.x,pos.y+.13,pos.z,.72*boost,spec?specHex:0xffffff,.28);
      for(let i=0;i<7+extra;i++){
        const a=Math.random()*6.283, r=.35+Math.random()*1.2;
        spawnParticle({x:pos.x+Math.cos(a)*r,y:pos.y+.35+Math.random()*.85,z:pos.z+Math.sin(a)*r,vx:(Math.random()-.5)*.06,vy:.08+Math.random()*.16,vz:(Math.random()-.5)*.06,life:.75,grav:-.05,r:.45,g:1,b:.55});
      }
    } else {
      const yaw=player.yaw||0, x=player.pos.x+Math.sin(yaw)*2.1, y=player.pos.y, z=player.pos.z+Math.cos(yaw)*2.1;
      if(typeof ringPulse==='function') ringPulse(x,y+.08,z,.72*boost,hex,.42);
      if((spec||mastery>=5) && typeof ringPulse==='function') ringPulse(x,y+.11,z,.38*boost,spec?specHex:0xffe78a,.24);
      for(let i=0;i<(mastery>=2?2:1);i++) spawnParticle({x,y:y+.25,z,vx:(Math.random()-.5)*.08,vy:.28,vz:(Math.random()-.5)*.08,life:.55,grav:-.08,r:col[0],g:col[1],b:col[2]});
    }
  }
}
function dragonRoleCooldownMs(type, role){
  const level=dragonBondLevel(type), personality=dragonPersonality(type);
  const base=role==='stay'
    ? (personality==='bold'?8500:(personality==='gentle'?10500:9500))
    : (personality==='bold'?3800:(personality==='gentle'?5200:4600));
  const perLevel=personality==='proud'?.03:.025, cap=personality==='proud'?.15:.12;
  const mastery=dragonRoleMasteryLevel(type, role);
  return Math.round(base*(1-Math.min(cap,(level-1)*perLevel)-Math.min(.1,(mastery-1)*.025)));
}
function addDragonActivity(type, text, detail=''){
  if(!DRAGON_TYPES[type]) return;
  const entry={at:Date.now(),type,text:String(text||'').slice(0,80),detail:String(detail||'').slice(0,120)};
  dragonActivityLog=[entry,...dragonActivityLog.filter(e=>!(e.type===entry.type&&e.text===entry.text&&Date.now()-(e.at||0)<1200))].slice(0,14);
}
function dragonActivityEntries(limit=8){
  return dragonActivityLog.slice(0,Math.max(1,limit|0));
}
function noteDragonRoleEvent(m){
  if(!m) return;
  const type=m.kind||m.type;
  if(!DRAGON_TYPES[type]) return;
  const role=m.role||m.reason||'guard';
  const now=performance.now();
  if(role==='guard'||role==='stay') dragonRoleReadyAt[type+':'+role]=now+dragonRoleCooldownMs(type, role);
  const text=role==='recall'?'recalled':role==='follow'?'traveling':role==='rest'?'+happiness':role==='stay'?'protecting':'protecting';
  dragonRoleActivity[type]={role,text,until:now+(role==='follow'?2600:2200)};
  if(role==='stay') addDragonActivity(type,'Stay defended post',(m.damage?('Hit for '+(m.damage|0)):'Post protected'));
  else if(role==='guard') addDragonActivity(type,'Guard protected you',(m.damage?('Hit for '+(m.damage|0)):'Threat intercepted'));
  else if(role==='rest') addDragonActivity(type,'Rest recovered happiness',(m.gain?('+'+(m.gain|0)+' happiness'):'Recovering'));
  else if(role==='follow') addDragonActivity(type,'Follow travel bond','Overworld travel');
  else if(role==='recall') addDragonActivity(type,'Dragon recalled',m.clearedStaySpot?'Stay post cleared':'Whistled to your side');
}
function applyMount(kind){       // kind '' dismounts
  if(!kind){
    mountKind=''; mounted=false;
    if(NET.room) NET.room.send('dismount', {});
    showName('Dismounted');
    return;
  }
  if(dim!=='overworld'){ showName('You can only ride in the overworld'); return; }
  if(isDragon(kind) && !dragonIsAdult(dragonType(kind))){
    showName((DRAGON_TYPES[dragonType(kind)]||{}).name+' is still growing');
    sysMsg('Your '+dragonStageLabel(dragonType(kind)).toLowerCase()+' dragon will be rideable in <b>'+dragonGrowthLeftSeconds(dragonType(kind))+'s</b>');
    return;
  }
  mountKind=kind; mounted=true;
  if(NET.room) NET.room.send('mount', {kind});
  if(isDragon(kind)){
    const d=DRAGON_TYPES[dragonType(kind)];
    showName((d?d.name:'Dragon')+' — Shift climbs, release to glide down'+(dragonUnlocks.length>1?', X to cycle':', X to dismiss'));
  } else showName('Mounted up — press Z to dismount');
  questSystemCheck();
}
function toggleMount(){ applyMount(mountKind==='horse' ? '' : 'horse'); }     // Z
function cycleDragon(){                                                       // X: cycle owned dragons, then off
  if(!dragonUnlocks.length){ sysMsg('You need to hatch a <b>Dragon Egg</b> first'); return; }
  const rideable=dragonUnlocks.filter(dragonIsAdult);
  if(!rideable.length){ sysMsg('Your young dragon is still growing. Rideable in <b>'+Math.min(...dragonUnlocks.map(dragonGrowthLeftSeconds))+'s</b>.'); return; }
  if(isDragon(mountKind)){
    const next=rideable.indexOf(dragonType(mountKind))+1;
    applyMount(next>=rideable.length ? '' : 'dragon:'+rideable[next]);
  } else {
    applyMount('dragon:'+rideable[0]);
  }
}
const DRAGON_ABILITIES={
  ember:{name:'Fire Breath', cd:7},
  frost:{name:'Frost Cone', cd:9},
  storm:{name:'Lightning Dash', cd:6.5},
  verdant:{name:'Regen Aura', cd:12},
  void:{name:'Void Blink', cd:10},
};
let dragonAbilityReadyAt=0;
function dragonHappiness(type){
  const c=dragonCare[type]||{};
  const elapsed=c.fedAt ? (Date.now()-c.fedAt)/3600000 : 0;
  const decay=dragonPersonality(type)==='gentle'?1.2:2;
  return Math.max(0, Math.min(100, Math.round((c.happiness==null?50:c.happiness)-elapsed*decay)));
}
function setDragonCare(type, happiness, fedAt){
  if(!DRAGON_TYPES[type]) return;
  dragonCare[type]={happiness:Math.max(0,Math.min(100,happiness|0)), fedAt:fedAt||Date.now()};
  refreshHUD();
}
function castDragonAbility(){
  if(!mounted || !isDragon(mountKind)) return false;
  const type=dragonType(mountKind), def=DRAGON_ABILITIES[type]||DRAGON_ABILITIES.ember;
  const now=performance.now();
  if(now<dragonAbilityReadyAt){
    showName(def.name+' ready in '+Math.ceil((dragonAbilityReadyAt-now)/1000)+'s');
    return true;
  }
  dragonAbilityReadyAt=now+(def.cd||9)*1000;
  const d=viewDir();
  SFX.cast();
  if(NET.on && NET.room) NET.room.send('dragonAbility',{ dx:d.x, dy:d.y, dz:d.z });
  else netDragonAbilityFx({kind:type,x:player.pos.x,y:player.pos.y,z:player.pos.z,dx:d.x,dy:d.y,dz:d.z});
  showName((DRAGON_TYPES[type]||DRAGON_TYPES.ember).name+': '+def.name);
  return true;
}
function feedMountedDragon(slot=selected){
  if(!mounted || !isDragon(mountKind)) return false;
  const s=inv[slot];
  if(!s || s.id!==I.DRAGON_TREAT) return false;
  if(NET.on && NET.room){ NET.room.send('feedMountedDragon',{slot}); return true; }
  s.count--; if(s.count<=0) inv[slot]=null;
  const type=dragonType(mountKind);
  setDragonCare(type, dragonHappiness(type)+20+(dragonPersonality(type)==='hungry'?4:0), Date.now());
  refreshHUD(); if(uiOpen) renderUI();
  netDragonCareFx({kind:type,x:player.pos.x,y:player.pos.y,z:player.pos.z,happiness:dragonHappiness(type)});
  sysMsg('You feed your <b>'+(DRAGON_TYPES[type]||{}).name+'</b>. Happiness: <b>'+dragonHappiness(type)+'</b>');
  return true;
}
function careDragon(type, slot=selected){
  if(!DRAGON_TYPES[type] || !dragonUnlocks.includes(type)) return false;
  const s=inv[slot];
  if(!s || s.id!==I.DRAGON_TREAT) return false;
  if(NET.on && NET.room){ NET.room.send('careDragon',{type,slot}); return true; }
  s.count--; if(s.count<=0) inv[slot]=null;
  const personality=dragonPersonality(type);
  setDragonCare(type, dragonHappiness(type)+(dragonIsAdult(type)?12:18)+(personality==='hungry'?4:0), Date.now());
  let bondGain=dragonIsAdult(type)?10:16;
  if(personality==='playful') bondGain=Math.ceil(bondGain*1.2);
  if(!dragonIsAdult(type)&&personality==='skittish') bondGain=Math.ceil(bondGain*1.25);
  dragonBondXp[type]=Math.max(0,(dragonBondXp[type]||0)+bondGain);
  addDragonActivity(type,'Care treat used','Happiness '+dragonHappiness(type)+'/100');
  dragonReaction(type,'happy');
  refreshHUD(); if(uiOpen) renderUI();
  sysMsg('You care for your <b>'+(DRAGON_TYPES[type]||{}).name+'</b>. Bond Lv <b>'+dragonBondLevel(type)+'</b>');
  return true;
}
function setDragonRole(type, role){
  if(!DRAGON_TYPES[type] || !dragonUnlocks.includes(type)) return false;
  if(!DRAGON_ROLES_C.includes(role)) return false;
  if((role==='guard'||role==='stay') && !dragonIsAdult(type)){ sysMsg('Young dragons need to grow before that command.'); return false; }
  if(NET.on && NET.room){ NET.room.send('setDragonRole',{type,role}); return true; }
  dragonRoles[type]=role;
  if(role==='stay') dragonStaySpots[type]={x:player.pos.x,y:player.pos.y,z:player.pos.z,yaw:player.yaw||0};
  else if(dragonStaySpots[type]) delete dragonStaySpots[type];
  if(typeof globalThis.BlockcraftDragonCommandFx==='function') globalThis.BlockcraftDragonCommandFx({kind:type,role,x:player.pos.x,y:player.pos.y,z:player.pos.z});
  dragonReaction(type,role==='rest'?'rest':(role==='guard'?'guard':'happy'));
  addDragonActivity(type,'Role set to '+dragonRoleLabel(type),role==='stay'?'Post saved at '+Math.round(player.pos.x)+', '+Math.round(player.pos.z):'Command accepted');
  refreshHUD(); if(uiOpen) renderUI();
  if(typeof globalThis.updateLandMinimap==='function') globalThis.updateLandMinimap();
  sysMsg('<b>'+(DRAGON_TYPES[type]||{}).name+'</b> role set to <b>'+dragonRoleLabel(type)+'</b>.');
  return true;
}
function clearDragonStaySpot(type){
  if(!DRAGON_TYPES[type] || !dragonUnlocks.includes(type)) return false;
  if(!dragonIsAdult(type)){ sysMsg('Young dragons need to grow before that command.'); return false; }
  if(NET.on && NET.room){ NET.room.send('setDragonRole',{type,role:'stay',clearStaySpot:true}); return true; }
  dragonRoles[type]='stay';
  const oldSpot=dragonStaySpots[type]||null;
  if(dragonStaySpots[type]) delete dragonStaySpots[type];
  if(typeof globalThis.BlockcraftDragonCommandFx==='function') globalThis.BlockcraftDragonCommandFx({kind:type,role:'stay',clearStaySpot:true,x:oldSpot?oldSpot.x:player.pos.x,y:oldSpot?oldSpot.y:player.pos.y,z:oldSpot?oldSpot.z:player.pos.z});
  dragonReaction(type,'happy');
  addDragonActivity(type,'Stay post cleared','Awaiting a new post');
  refreshHUD(); if(uiOpen) renderUI();
  if(typeof globalThis.updateLandMinimap==='function') globalThis.updateLandMinimap();
  sysMsg('<b>'+(DRAGON_TYPES[type]||{}).name+'</b> stay post cleared.');
  return true;
}
function recallDragon(type, options={}){
  if(!DRAGON_TYPES[type] || !dragonUnlocks.includes(type)) return false;
  if(!dragonIsAdult(type)){ sysMsg('Young dragons need to grow before recall.'); return false; }
  const clearStaySpot=!!(options&&options.clearStaySpot);
  if(NET.on && NET.room){ NET.room.send('recallDragon',{type,clearStaySpot}); return true; }
  if(dragonRole(type)==='stay' && dragonStaySpots[type] && !clearStaySpot){
    sysMsg('Clear or move the stay post before recalling <b>'+(DRAGON_TYPES[type]||{}).name+'</b>.');
    return false;
  }
  const hadPost=!!dragonStaySpots[type];
  if(clearStaySpot && dragonStaySpots[type]) delete dragonStaySpots[type];
  if(dragonRole(type)==='stay') dragonRoles[type]='follow';
  if(typeof globalThis.BlockcraftDragonCommandFx==='function') globalThis.BlockcraftDragonCommandFx({kind:type,role:'recall',x:player.pos.x,y:player.pos.y,z:player.pos.z,clearStaySpot:hadPost&&clearStaySpot});
  dragonReaction(type,'happy');
  addDragonActivity(type,'Dragon recalled',hadPost&&clearStaySpot?'Stay post cleared':'Whistled to your side');
  refreshHUD(); if(uiOpen) renderUI();
  if(typeof globalThis.updateLandMinimap==='function') globalThis.updateLandMinimap();
  sysMsg('<b>'+(DRAGON_TYPES[type]||{}).name+'</b> recalled.');
  return true;
}
function focusDragonStayPost(type){
  if(!DRAGON_TYPES[type] || !dragonUnlocks.includes(type)) return false;
  const s=dragonStaySpots[type];
  if(!s) return false;
  dragonMapFocus={type,until:performance.now()+6000};
  if(typeof globalThis.BlockcraftDragonCommandFx==='function') globalThis.BlockcraftDragonCommandFx({kind:type,focus:true,x:s.x,y:s.y,z:s.z});
  if(typeof globalThis.updateLandMinimap==='function') globalThis.updateLandMinimap();
  return true;
}
function dragonHatchTarget(){
  const hit=raycast(6);
  return hit && hit.id===B.EGG_INSULATOR ? hit : null;
}
function firstDragonEggSlot(){
  for(let i=0;i<36;i++){
    const s=inv[i];
    if(s && DRAGON_EGG_TO_TYPE[s.id]) return i;
  }
  return -1;
}
function hatchDragonEgg(slot=selected, target=null){
  let egg=inv[slot];
  let type=egg && DRAGON_EGG_TO_TYPE[egg.id];
  if(!type){
    slot=firstDragonEggSlot();
    egg=slot>=0?inv[slot]:null;
    type=egg && DRAGON_EGG_TO_TYPE[egg.id];
  }
  if(!type) return false;
  const d=DRAGON_TYPES[type];
  if(dragonUnlocks.includes(type)){ sysMsg('You have already bonded with a <b>'+d.name+'</b>'); return true; }
  target=target||dragonHatchTarget();
  if(!target){ sysMsg('Place an <b>Egg Insulator</b>, then use the egg on top of it'); return true; }
  if(NET.on&&NET.room){
    NET.room.send('hatchDragonEgg', {slot, x:target.x, y:target.y, z:target.z});
    return true;
  }
  // solo: mirror the server — a timed incubation on the insulator (claim once the timer ends)
  return startLocalIncubation(slot, type, target);
}
function startLocalIncubation(slot, type, target){
  const k=incubationKey(target.x,target.y,target.z);
  if(dragonIncubationMeshes[k]) return claimLocalIncubation(target.x,target.y,target.z);  // occupied -> try to claim
  const egg=inv[slot];
  if(!egg) return true;
  egg.count--; if(egg.count<=0) inv[slot]=null;
  refreshHUD(); if(uiOpen) renderUI();
  const now=Date.now();
  syncDragonIncubationMesh({ x:target.x, y:target.y, z:target.z, type, eggId:DRAGON_TYPES[type].egg, startedAt:now, finishAt:now+dragonIncubationMs(type), incubationMs:dragonIncubationMs(type) });
  sysMsg('The <b>'+DRAGON_TYPES[type].name+' Egg</b> settles onto the insulator. Incubation started.');
  return true;
}
function claimLocalIncubation(x,y,z){
  const group=dragonIncubationMeshes[incubationKey(x,y,z)];
  if(!group) return false;
  const ud=group.userData||{};
  if(!(ud.ready || Date.now()>=(ud.finishAt||0))){
    sysMsg('The egg is still incubating — <b>'+Math.max(1,Math.ceil(((ud.finishAt||0)-Date.now())/1000))+'s</b> left');
    return true;
  }
  const type=ud.type, d=DRAGON_TYPES[type];
  removeDragonIncubationMesh(x,y,z);
  if(d && !dragonUnlocks.includes(type)){
    dragonUnlocks.push(type);
    dragonGenders[type]=ud.gender==='female'?'female':'male';
    dragonPersonalities[type]=DRAGON_PERSONALITIES_C.includes(ud.personality)?ud.personality:randomDragonPersonality();
    dragonHatchedAt[type]=Date.now();
    refreshHUD(); if(uiOpen) renderUI();
    if(typeof SFX!=='undefined' && SFX.boom) SFX.boom();
    const n=parseInt(d.membrane[1].slice(1),16);
    burst(x+.5, y+1.2, z+.5, [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255], 40, 3.2, 3.4, .8);
    sysMsg('The <b>'+d.name+' Egg</b> hatches as a baby and bonds to you. It will become rideable soon.');
  }
  questSystemCheck();
  return true;
}
function applyDragonIncubationStart(m){
  if(!m || !DRAGON_TYPES[m.type]) return;
  if(m.slot!=null){
    const i=m.slot|0, s=inv[i];
    if(s && s.id===(m.eggId|0)){ s.count--; if(s.count<=0) inv[i]=null; }
    refreshHUD(); if(uiOpen) renderUI();
  }
  syncDragonIncubationMesh(m);
  if(m.slot!=null){
    const d=DRAGON_TYPES[m.type];
    sysMsg('The <b>'+d.name+' Egg</b> settles onto the insulator. Incubation started.');
  }
}
function applyDragonIncubationReady(m){
  if(!m || !DRAGON_TYPES[m.type]) return;
  const k=incubationKey(m.x|0,m.y|0,m.z|0);
  const group=dragonIncubationMeshes[k];
  if(group){
    group.userData.ready=true;
    if(group.userData.timer) group.userData.timer.userData.last=-999;
  } else syncDragonIncubationMesh({...m, ready:true, startedAt:Date.now(), finishAt:Date.now()});
  const isOwner=!NET.on || !m.ownerSid || (NET.room && m.ownerSid===NET.room.sessionId);
  const d=DRAGON_TYPES[m.type];
  sysMsg(isOwner ? '<b>'+d.name+' Egg</b> is ready. Interact with the insulator to claim it.' : 'A <b>'+d.name+' Egg</b> is ready nearby.');
}
function applyDragonIncubationComplete(m){
  if(!m || !DRAGON_TYPES[m.type]) return;
  removeDragonIncubationMesh(m.x|0,m.y|0,m.z|0);
  const isOwner=!NET.on || !m.ownerSid || (NET.room && m.ownerSid===NET.room.sessionId);
  if(isOwner){
    if(!dragonUnlocks.includes(m.type)) dragonUnlocks.push(m.type);
    dragonGenders[m.type]=m.gender==='female'?'female':'male';
    dragonPersonalities[m.type]=DRAGON_PERSONALITIES_C.includes(m.personality)?m.personality:defaultDragonPersonality(m.type);
    dragonHatchedAt[m.type]=Number.isFinite(+m.hatchedAt)?+m.hatchedAt:Date.now();
  }
  if(isOwner){ refreshHUD(); if(uiOpen) renderUI(); }
  const d=DRAGON_TYPES[m.type];
  if(typeof SFX!=='undefined' && SFX.boom) SFX.boom();
  const n=parseInt(d.membrane[1].slice(1),16);
  const x=(m.x|0)+.5, y=(m.y|0)+1.2, z=(m.z|0)+.5;
  burst(x, y, z, [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255], 40, 3.2, 3.4, .8);
  sysMsg(isOwner
    ? 'The <b>'+d.name+' Egg</b> hatches as a baby and bonds to you. It will become rideable soon.'
    : 'A <b>'+d.name+' Egg</b> hatches nearby.');
  if(isOwner) questSystemCheck();
}
function dragonHatchRejected(m){
  const r=m&&m.reason;
  if(r==='insulator') sysMsg('Use the egg on an <b>Egg Insulator</b>');
  else if(r==='range') sysMsg('Stand closer to the <b>Egg Insulator</b>');
  else if(r==='owned') sysMsg('You have already bonded with that dragon species');
  else if(r==='busy') sysMsg('That <b>Egg Insulator</b> is already warming an egg');
  else if(r==='waiting') sysMsg('That egg is still incubating');
  else if(r==='egg') sysMsg('Hold a valid <b>Dragon Egg</b>');
  else sysMsg('The egg will not hatch here');
}
function applyDragonRenameResult(m){
  if(!m || !DRAGON_TYPES[m.type]) return;
  const name=cleanDragonDisplayName(m.name);
  if(name) dragonNames[m.type]=name;
  dragonRoostSig='';
  if(qOpen) openDragonBondUI();
  sysMsg('Your dragon is now named <b>'+escHTML(name||dragonDisplayName(m.type))+'</b>');
}
function dragonRenameRejected(m){
  const r=m&&m.reason;
  if(r==='unowned') sysMsg('You can only name a <b>bonded dragon</b>');
  else if(r==='name') sysMsg('Choose a shorter dragon name');
  else sysMsg('Could not name that dragon');
}
function perchRejected(m){
  const r=m&&m.reason;
  if(r==='full') sysMsg('This nest is full');
  else if(r==='range') sysMsg('Stand closer to the nest');
  else if(r==='treat') sysMsg('Select a <b>Dragon Treat</b> to feed this nest');
  else if(r==='already') sysMsg('That dragon is already smitten');
  else if(r==='tired') sysMsg('That dragon is resting after breeding');
  else if(r==='unowned') sysMsg('You can only perch a dragon you have bonded with');
  else if(r==='baby'||r==='young') sysMsg((m&&m.stage==='juvenile'?'Juvenile':'Baby')+' dragons need to grow before nesting');
  else if(r==='notyours') sysMsg('That dragon is not yours');
  else sysMsg('You cannot perch a dragon here');
}
function tickLocalMount(now, dt){
  if(mounted){
    const localBond=isDragon(mountKind)?dragonBondLevel(dragonType(mountKind)):1;
    if(!localMountObj || localMountObj.userData.mountKind!==mountKind || localMountObj.userData.bondLevel!==localBond){
      if(localMountObj) scene.remove(localMountObj);
      localMountObj=makeMount(mountKind, localBond, dragonSpecialization(dragonType(mountKind)));
      localMountObj.userData.bondLevel=localBond;
      scene.add(localMountObj);
    }
    localMountObj.visible=true;
    localMountObj.position.set(player.pos.x, player.pos.y, player.pos.z);
    localMountObj.rotation.y=player.yaw+Math.PI;
    if(isDragon(mountKind)){
      animateMountWings(localMountObj, now);
      localMountObj.position.y+=Math.sin(now/1000*2.2)*0.06;   // gentle hover bob
      emitDragonAura(player.pos, dragonType(mountKind), dt||0, localMountObj.userData);
      emitDragonTrail(player.pos, player.yaw+Math.PI, dragonType(mountKind), dt||0, localMountObj.userData);
    } else if(Math.hypot(player.vx||0,player.vz||0)>.15){
      localMountObj.position.y+=Math.abs(Math.sin(now/1000*10))*.05;
    }
  } else if(localMountObj){
    localMountObj.visible=false;
  }
}

// ---------------- town dragon roost: public perches for bonded dragons ----------------
const dragonRoostGroup=new THREE.Group();
scene.add(dragonRoostGroup);
let dragonRoostSig='', dragonRoostNextRefresh=0;
const companionDragons={};
let companionDragonSig='', companionDragonNextRefresh=0;
const petTamerTutorialDragons=[];
let petTamerTutorialGroundDragon=null;
const PET_TAMER_TUTORIAL_TYPES=['ember','verdant','frost','storm','void','verdant','ember','frost','storm','void','ember','verdant'];
const DRAGON_ROOST_SLOTS=(()=>{
  const slots=[];
  // bonded dragons just stand on the ground in an open grid inside the pen
  const cols=[90.5, 94.5, 98.5, 102.5];
  for(let z=50; z<=80; z+=3){
    for(let ci=0; ci<cols.length; ci++)
      slots.push({x:tp(cols[ci]), y:TOWN.G+1.0, z:tp(z), yaw:(ci%2?-1:1)*Math.PI*.5});
  }
  return slots;
})();
function clearPetTamerTutorialDragons(){
  while(petTamerTutorialDragons.length){
    const rec=petTamerTutorialDragons.pop();
    if(rec&&rec.group){ scene.remove(rec.group); disposeObjectTree(rec.group); }
  }
}
function petTamerPracticeDragonSpot(room){
  if(!room)return null;
  return {x:(room.x||0)+8.5,y:(room.G||room.g||18)+1.03,z:(room.z||0)+8.5,yaw:-Math.PI*.62,type:'verdant'};
}
function clearPetTamerTutorialGroundDragon(){
  if(!petTamerTutorialGroundDragon)return;
  scene.remove(petTamerTutorialGroundDragon.group);
  disposeObjectTree(petTamerTutorialGroundDragon.group);
  petTamerTutorialGroundDragon=null;
  if(globalThis.__petTamerPracticeDragon)globalThis.__petTamerPracticeDragon=null;
}
function tickPetTamerTutorialGroundDragon(active, room, now, dt=0.016){
  if(!active||!room||dim!=='job'){ clearPetTamerTutorialGroundDragon(); return; }
  const practice=globalThis.BlockcraftPetTamerPractice;
  if(practice&&typeof practice.hatched==='function'&&!practice.hatched()){
    clearPetTamerTutorialGroundDragon();
    return;
  }
  const spot=petTamerPracticeDragonSpot(room);
  if(!spot)return;
  if(!petTamerTutorialGroundDragon){
    const group=new THREE.Group();
    group.name='petTamerHatchedDragon';
    group.userData.kind='petTamerHatchedDragon';
    group.userData.blockcraftKind='hatchedTutorialDragon';
    const dragon=makeMount('dragon:'+spot.type, 3, dragonSpecialization(spot.type));
    dragon.scale.setScalar(.7);
    dragon.userData.baseCompanionScale=.7;
    dragon.userData.kind='petTamerHatchedDragonBody';
    dragon.userData.blockcraftKind='hatchedTutorialDragonBody';
    dragon.rotation.y=Math.PI;
    group.add(dragon);
    const tag=makeDragonNameplate('Your Hatched Dragon', 'Fresh Tutorial Bond', '#9ad26b');
    tag.position.set(0,1.75,0);
    tag.scale.set(1.65,.72,1);
    group.add(tag);
    group.position.set(spot.x,spot.y,spot.z);
    scene.add(group);
    petTamerTutorialGroundDragon={group,dragon,tag,type:spot.type,phase:Math.random()*8,aura:0};
    globalThis.__petTamerPracticeDragon=group;
  }
  const rec=petTamerTutorialGroundDragon;
  const status=practice&&typeof practice.status==='function'?practice.status():{};
  if(Number(status.step)===3&&rec.group.userData.tutorialRole!=='stay')rec.group.userData.tutorialRole='follow';
  rec.group.visible=true;
  let tx=spot.x, ty=spot.y, tz=spot.z, yaw=spot.yaw, following=false;
  if(rec.group.userData.tutorialRole==='stay'&&rec.group.userData.tutorialStaySpot){
    const s=rec.group.userData.tutorialStaySpot;
    tx=s.x; ty=s.y; tz=s.z; yaw=s.yaw||yaw;
  }else if(rec.group.userData.tutorialRole==='follow'&&player&&player.pos){
    const pyaw=player.yaw||0;
    tx=player.pos.x-Math.sin(pyaw)*3.2+Math.cos(pyaw)*1.35;
    ty=player.pos.y;
    tz=player.pos.z-Math.cos(pyaw)*3.2-Math.sin(pyaw)*1.35;
    following=true;
  }
  const lerp=Math.min(1,(dt||0.016)*(following?4.8:7.5));
  rec.group.position.x+=(tx-rec.group.position.x)*lerp;
  rec.group.position.y+=(ty+.035*Math.sin(now*.002+rec.phase)-rec.group.position.y)*Math.min(1,(dt||0.016)*7);
  rec.group.position.z+=(tz-rec.group.position.z)*lerp;
  if(following){
    const dx=(player.pos.x||0)-rec.group.position.x, dz=(player.pos.z||0)-rec.group.position.z;
    yaw=Math.atan2(dx,dz);
  }
  rec.group.rotation.y=yaw+.06*Math.sin(now*.0017+rec.phase);
  rec.group.rotation.z=.018*Math.sin(now*.0021+rec.phase);
  animateMountWings(rec.group, now*(following?.46:.18)+rec.phase*1000);
  rec.aura+=(dt||0.016);
  if(rec.aura>.09){
    rec.aura=0;
    emitDragonAura(rec.group.position, rec.type, .035, rec);
    if(following)emitDragonTrail(rec.group.position, rec.group.rotation.y+Math.PI, rec.type, dt||0.016, rec);
  }
}
function tickPetTamerTutorialDragons(active, room, now, dt=0.016){
  if(!active||!room||dim!=='job'){ clearPetTamerTutorialDragons(); return; }
  const count=PET_TAMER_TUTORIAL_TYPES.length;
  while(petTamerTutorialDragons.length<count){
    const i=petTamerTutorialDragons.length, type=PET_TAMER_TUTORIAL_TYPES[i%PET_TAMER_TUTORIAL_TYPES.length];
    const group=makeMount('dragon:'+type, 2+(i%3), dragonSpecialization(type));
    const size=.42+(i%4)*.06;
    group.scale.setScalar(size);
    group.userData.baseCompanionScale=size;
    scene.add(group);
    petTamerTutorialDragons.push({
      group,
      type,
      phase:i*.78,
      radius:18+(i%5)*5,
      height:11+(i%4)*2.2,
      speed:.72+(i%6)*.09,
      bob:.8+(i%3)*.25,
    });
  }
  const cx=room.x||0, cz=room.z||0, gy=room.G||room.g||18;
  for(let i=0;i<petTamerTutorialDragons.length;i++){
    const rec=petTamerTutorialDragons[i];
    const t=now*.00034*rec.speed+rec.phase;
    const weave=Math.sin(t*2.1+rec.phase)*4.5;
    const x=cx+Math.cos(t)*rec.radius+Math.cos(t*.55+rec.phase)*weave;
    const z=cz+Math.sin(t)*rec.radius+Math.sin(t*.55+rec.phase)*weave;
    const y=gy+rec.height+Math.sin(now*.0012+rec.phase)*rec.bob;
    const nx=cx+Math.cos(t+.04)*rec.radius+Math.cos((t+.04)*.55+rec.phase)*weave;
    const nz=cz+Math.sin(t+.04)*rec.radius+Math.sin((t+.04)*.55+rec.phase)*weave;
    rec.group.visible=true;
    rec.group.position.set(x,y,z);
    rec.group.rotation.y=Math.atan2(nx-x,nz-z);
    rec.group.rotation.z=Math.sin(t*1.7)*.12;
    animateMountWings(rec.group, now*(.86+rec.speed*.22)+rec.phase*1000);
    emitDragonTrail(rec.group.position, rec.group.rotation.y+Math.PI, rec.type, dt, rec);
    if(i%3===0) emitDragonAura(rec.group.position, rec.type, dt, rec);
  }
}
function roostNameForPlayer(p, fallback){
  return ((p&&p.name)||fallback||'Hunter').slice(0,14);
}
function roostOwnedDragonTypes(p){
  return String(p&&p.dragons||'').split(',').map(s=>s.trim()).filter(t=>DRAGON_TYPES[t]);
}
function roostDragonNames(p){
  try{
    const raw=JSON.parse(String(p&&p.dragonNames||'{}'));
    const out={};
    if(raw&&typeof raw==='object') for(const t in raw) if(DRAGON_TYPES[t]){
      const n=cleanDragonDisplayName(raw[t]);
      if(n) out[t]=n;
    }
    return out;
  }catch(e){ return {}; }
}
function roostDragonGenders(p){
  try{
    const raw=JSON.parse(String(p&&p.dragonGenders||'{}'));
    const out={};
    if(raw&&typeof raw==='object') for(const t in raw) if(DRAGON_TYPES[t]&&(raw[t]==='male'||raw[t]==='female')) out[t]=raw[t];
    return out;
  }catch(e){ return {}; }
}
function roostDragonPersonalities(p){
  try{
    const raw=JSON.parse(String(p&&p.dragonPersonalities||'{}'));
    const out={};
    if(raw&&typeof raw==='object') for(const t in raw) if(DRAGON_TYPES[t]&&DRAGON_PERSONALITIES_C.includes(raw[t])) out[t]=raw[t];
    return out;
  }catch(e){ return {}; }
}
function roostDragonRoles(p){
  try{
    const raw=JSON.parse(String(p&&p.dragonRoles||'{}'));
    const out={};
    if(raw&&typeof raw==='object') for(const t in raw) if(DRAGON_TYPES[t]&&DRAGON_ROLES_C.includes(raw[t])) out[t]=raw[t];
    return out;
  }catch(e){ return {}; }
}
function cleanDragonStaySpot(s){
  if(!s||typeof s!=='object') return null;
  const x=Number(s.x), y=Number(s.y), z=Number(s.z), yaw=Number(s.yaw||0);
  if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z)) return null;
  return {x,y,z,yaw:Number.isFinite(yaw)?yaw:0};
}
function roostDragonStaySpots(p){
  try{
    const raw=JSON.parse(String(p&&p.dragonStaySpots||'{}'));
    const out={};
    if(raw&&typeof raw==='object') for(const t in raw) if(DRAGON_TYPES[t]){
      const spot=cleanDragonStaySpot(raw[t]);
      if(spot) out[t]=spot;
    }
    return out;
  }catch(e){ return {}; }
}
function roostDragonHatchedAt(p){
  try{
    const raw=JSON.parse(String(p&&p.dragonHatchedAt||'{}'));
    const out={};
    if(raw&&typeof raw==='object') for(const t in raw) if(DRAGON_TYPES[t]){
      const at=Number(raw[t]||0);
      out[t]=Number.isFinite(at)&&at>0?at:0;
    }
    return out;
  }catch(e){ return {}; }
}
function roostDragonStage(type, hatchedAt){
  const at=Number(hatchedAt||0);
  if(!(Number.isFinite(at)&&at>0)) return 'adult';
  const age=Math.max(0,Date.now()-at);
  return age>=DRAGON_GROW_MS_C?'adult':(age>=DRAGON_JUVENILE_MS_C?'juvenile':'baby');
}
function roostDragonIsAdult(type, hatchedAt){ return roostDragonStage(type,hatchedAt)==='adult'; }
function roostDragonStageLabel(stage){ return stage==='adult'?'Adult':(stage==='juvenile'?'Juvenile':'Baby'); }
function makeDragonNameplate(name, owner, color){
  const c=document.createElement('canvas'); c.width=256; c.height=112; const g=c.getContext('2d');
  g.fillStyle='rgba(6,10,18,.78)';
  roundedRect(g,18,18,220,72,6); g.fill();
  g.strokeStyle=color||'#66f0ff'; g.lineWidth=2; roundedRect(g,18,18,220,72,6); g.stroke();
  fitCanvasText(g,name,188,20,'bold'); g.textAlign='center'; g.fillStyle=color||'#66f0ff'; g.fillText(name,128,48);
  fitCanvasText(g,'Owner: '+owner,176,12,'bold'); g.fillStyle='#d8e4f2'; g.fillText('Owner: '+owner,128,70);
  const tex=new THREE.CanvasTexture(c); tex.magFilter=THREE.NearestFilter; tex.minFilter=THREE.NearestFilter;
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex, transparent:true, depthWrite:false, depthTest:false}));
  sp.scale.set(2.25,.98,1);
  return sp;
}
function collectRoostDragons(){
  const rows=[];
  const add=(sid,p,owner,types,mount,names={},genders={},personalities={},roles={},staySpots={},hatched={},specializations={})=>{
    const mountedType=isDragon(mount)?dragonType(mount):'';
    for(const type of types){
      if(type===mountedType) continue;
      const at=Number(hatched[type]||0);
      const stage=roostDragonStage(type,at);
      const role=DRAGON_ROLES_C.includes(roles[type])?roles[type]:'follow';
      if(stage==='adult'&&(role==='follow'||role==='guard'||(role==='stay'&&cleanDragonStaySpot(staySpots[type])))) continue;
      const spec=DRAGON_SPECIALIZATION_DEFS_C[specializations[type]]?specializations[type]:'';
      rows.push({sid, owner, type, spec, gender:genders[type]==='female'?'female':'male', personality:DRAGON_PERSONALITIES_C.includes(personalities[type])?personalities[type]:defaultDragonPersonality(type), role, hatchedAt:Number.isFinite(at)&&at>0?at:0, name:cleanDragonDisplayName(names[type])||dragonDisplayName(type)});
    }
  };
  if(NET.on&&NET.room&&NET.room.state&&NET.room.state.players){
    NET.room.state.players.forEach((p,sid)=>{
      const types=roostOwnedDragonTypes(p);
      if(types.length) add(sid,p,roostNameForPlayer(p,sid),types,p.mount||'',roostDragonNames(p),roostDragonGenders(p),roostDragonPersonalities(p),roostDragonRoles(p),roostDragonStaySpots(p),roostDragonHatchedAt(p),sid===NET.room.sessionId?dragonSpecializations:{});
    });
    const me=NET.room.state.players.get(NET.room.sessionId);
    if(!me || !roostOwnedDragonTypes(me).length)
      add('local',null,roostNameForPlayer(null,localDisplayName()),dragonUnlocks,mountKind,dragonNames,dragonGenders,dragonPersonalities,dragonRoles,dragonStaySpots,dragonHatchedAt,dragonSpecializations);
  } else {
    add('local',null,roostNameForPlayer(null,localDisplayName()),dragonUnlocks,mountKind,dragonNames,dragonGenders,dragonPersonalities,dragonRoles,dragonStaySpots,dragonHatchedAt,dragonSpecializations);
  }
  return rows.slice(0,DRAGON_ROOST_SLOTS.length);
}
function collectCompanionDragons(){
  const rows=[];
  const add=(sid,p,owner,types,mount,names={},genders={},personalities={},roles={},staySpots={},hatched={},specializations={})=>{
    const mountedType=isDragon(mount)?dragonType(mount):'';
    for(const type of types){
      if(type===mountedType) continue;
      const role=DRAGON_ROLES_C.includes(roles[type])?roles[type]:'follow';
      if(role!=='follow'&&role!=='guard'&&role!=='stay'&&role!=='rest') continue;
      const at=Number(hatched[type]||0);
      const stage=roostDragonStage(type,at);
      const staySpot=role==='stay'?cleanDragonStaySpot(staySpots[type]):null;
      if(role==='stay'&&!staySpot) continue;
      const spec=DRAGON_SPECIALIZATION_DEFS_C[specializations[type]]?specializations[type]:'';
      rows.push({sid, owner, type, spec, role, stage, staySpot, gender:genders[type]==='female'?'female':'male', personality:DRAGON_PERSONALITIES_C.includes(personalities[type])?personalities[type]:defaultDragonPersonality(type), hatchedAt:Number.isFinite(at)&&at>0?at:0, name:cleanDragonDisplayName(names[type])||dragonDisplayName(type)});
    }
  };
  if(NET.on&&NET.room&&NET.room.state&&NET.room.state.players){
    NET.room.state.players.forEach((p,sid)=>{
      const types=roostOwnedDragonTypes(p);
      if(types.length) add(sid,p,roostNameForPlayer(p,sid),types,p.mount||'',roostDragonNames(p),roostDragonGenders(p),roostDragonPersonalities(p),roostDragonRoles(p),roostDragonStaySpots(p),roostDragonHatchedAt(p),sid===NET.room.sessionId?dragonSpecializations:{});
    });
    const me=NET.room.state.players.get(NET.room.sessionId);
    if(!me || !roostOwnedDragonTypes(me).length)
      add('local',null,roostNameForPlayer(null,localDisplayName()),dragonUnlocks,mountKind,dragonNames,dragonGenders,dragonPersonalities,dragonRoles,dragonStaySpots,dragonHatchedAt,dragonSpecializations);
  } else {
    add('local',null,roostNameForPlayer(null,localDisplayName()),dragonUnlocks,mountKind,dragonNames,dragonGenders,dragonPersonalities,dragonRoles,dragonStaySpots,dragonHatchedAt,dragonSpecializations);
  }
  return rows.slice(0,12);
}
function companionOwnerPose(row){
  if(row&&row.role==='stay'&&row.staySpot) return row.staySpot;
  if(row.sid==='local' || (NET.room&&row.sid===NET.room.sessionId)) return {x:player.pos.x,y:player.pos.y,z:player.pos.z,yaw:player.yaw||0};
  const remote=NET.remotes&&NET.remotes[row.sid], ref=remote&&remote.ref;
  if(ref) return {x:ref.x,y:ref.y,z:ref.z,yaw:ref.yaw||0};
  return null;
}
function companionDragonKey(row){ return row.sid+':'+row.type; }
function companionDragonScale(stage, role){
  const base=stage==='baby'?.24:(stage==='juvenile'?.34:.46);
  return role==='rest'?base*.94:base;
}
function companionDragonTagY(stage){
  return stage==='baby'?1.02:(stage==='juvenile'?1.28:1.58);
}
function companionDragonTagScale(stage){
  return stage==='baby'?[1.05,.46,1]:(stage==='juvenile'?[1.18,.52,1]:[1.32,.58,1]);
}
function dragonReactionPosition(type){
  const ownSid=NET.room&&NET.room.sessionId;
  for(const key of Object.keys(companionDragons)){
    const rec=companionDragons[key], row=rec&&rec.row;
    if(!rec||!row||row.type!==type) continue;
    if(row.sid!=='local' && (!ownSid||row.sid!==ownSid)) continue;
    return {rec,x:rec.group.position.x,y:rec.group.position.y,z:rec.group.position.z};
  }
  return {rec:null,x:player.pos.x,y:player.pos.y,z:player.pos.z};
}
function dragonReaction(type, mood='happy'){
  const kind=dragonType(type);
  if(!DRAGON_TYPES[kind]) return false;
  const pos=dragonReactionPosition(kind), now=performance.now();
  if(pos.rec) pos.rec.reaction={mood,start:now,until:now+1200};
  const spec=dragonSpecialization(kind);
  const specCol=spec?hexToRgb01(dragonSpecializationHex(spec)):null;
  const col=specCol||(mood==='rest'?[.45,1,.52]:(mood==='guard'?[.85,.95,1]:dragonTrailColor(kind)));
  const count=mood==='happy'?18:12;
  for(let i=0;i<count;i++){
    const a=Math.random()*6.283, r=.25+Math.random()*.85;
    spawnParticle({x:pos.x+Math.cos(a)*r,y:pos.y+.65+Math.random()*.95,z:pos.z+Math.sin(a)*r,
      vx:Math.cos(a)*.08+(Math.random()-.5)*.1,vy:.25+Math.random()*.42,vz:Math.sin(a)*.08+(Math.random()-.5)*.1,
      life:.55+Math.random()*.4,grav:-.12,r:i%4?col[0]:1,g:i%4?col[1]:.58,b:i%4?col[2]:.72});
  }
  return true;
}
function ensureCompanionDragon(row){
  const key=companionDragonKey(row);
  let rec=companionDragons[key];
  const sig=row.type+':'+row.role+':'+row.name+':'+row.owner+':'+(row.stage||'adult')+':'+(row.spec||'')+':'+(row.personality||'');
  if(rec&&(rec.type!==row.type||rec.sig!==sig)){ disposeObjectTree(rec.group); delete companionDragons[key]; rec=null; }
  if(!rec){
    const group=new THREE.Group();
    const dragon=makeMount('dragon:'+row.type,1,row.spec||'');
    const baseCompanionScale=companionDragonScale(row.stage,row.role);
    dragon.scale.multiplyScalar(baseCompanionScale);
    dragon.userData.baseCompanionScale=baseCompanionScale;
    dragon.rotation.y=Math.PI;
    group.add(dragon);
    const def=DRAGON_TYPES[row.type]||DRAGON_TYPES.ember;
    const roleText=row.role==='guard'?'Guard':(row.role==='stay'?'Stay':(row.role==='rest'?'Rest':'Follow'));
    const tagText=row.name+' · '+roleText+' · '+dragonPersonalityLabel(row.personality||row.type)+(row.spec?' · '+dragonSpecializationName(row.spec):'');
    const tag=makeDragonNameplate(tagText, row.owner, row.spec?dragonSpecializationColor(row.spec):(row.personality?dragonPersonalityColor(row.personality):def.membrane[1]));
    tag.position.set(0,companionDragonTagY(row.stage),0);
    tag.scale.set(...companionDragonTagScale(row.stage));
    group.add(tag);
    scene.add(group);
    rec={group,dragon,tag,type:row.type,role:row.role,stage:row.stage||'adult',sig,phase:Math.random()*8,row,reaction:null};
    companionDragons[key]=rec;
  }
  rec.row=row;
  rec.role=row.role;
  rec.stage=row.stage||'adult';
  return rec;
}
function clearMissingCompanionDragons(keys){
  for(const key of Object.keys(companionDragons)){
    if(!keys.has(key)){ disposeObjectTree(companionDragons[key].group); delete companionDragons[key]; }
  }
}
function nearestOwnedDragon(range=3.2){
  let best=null, bestD=range;
  const ownSid=NET.room&&NET.room.sessionId;
  for(const key of Object.keys(companionDragons)){
    const rec=companionDragons[key], row=rec&&rec.row;
    if(!rec||!rec.group||!rec.group.visible||!row) continue;
    const mine=row.sid==='local'||(ownSid&&row.sid===ownSid);
    if(!mine) continue;
    const d=Math.hypot(rec.group.position.x-player.pos.x,rec.group.position.z-player.pos.z);
    if(d<bestD){
      bestD=d;
      best={type:row.type,name:row.name,role:row.role,stage:row.stage||'adult',distance:d,x:rec.group.position.x,y:rec.group.position.y,z:rec.group.position.z};
    }
  }
  return best;
}
let dragonHudSig='', dragonHudNextRefresh=0;
let dragonHudMoveSample={x:0,z:0,t:0,moving:false};
function dragonHudEscape(v){
  return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function dragonHudName(type){
  const cleaner=typeof cleanDragonDisplayName==='function'?cleanDragonDisplayName:null;
  const custom=cleaner?cleaner(dragonNames[type]):'';
  if(custom) return custom;
  const def=DRAGON_TYPES[type];
  return def?def.name.replace(' Dragon',''):type;
}
function dragonHudStayDistance(type){
  const s=dragonStaySpots[type];
  if(!s) return '';
  const dx=(Number(player.pos.x)||0)-(Number(s.x)||0), dz=(Number(player.pos.z)||0)-(Number(s.z)||0);
  const dist=Math.hypot(dx,dz);
  return Number.isFinite(dist)?Math.round(dist)+'m':'';
}
function dragonStayMapMarkers(now=performance.now()){
  const rows=[];
  for(const type of dragonUnlocks){
    const s=dragonStaySpots[type];
    if(!s || dragonRole(type)!=='stay' || !dragonIsAdult(type)) continue;
    const x=Number(s.x), z=Number(s.z);
    if(!Number.isFinite(x)||!Number.isFinite(z)) continue;
    const dx=(Number(player.pos.x)||0)-x, dz=(Number(player.pos.z)||0)-z;
    const dist=Math.hypot(dx,dz);
    const activity=dragonRoleActivity[type];
    const focus=dragonMapFocus.type===type&&now<dragonMapFocus.until;
    const training=dragonTrainingState&&dragonTrainingState.type===type&&dragonTrainingState.role==='stay';
    rows.push({
      type,
      name:dragonHudName(type),
      x,
      z,
      distance:Number.isFinite(dist)?dist:0,
      active:Number.isFinite(dist)&&dist<=80,
      pulse:training||focus||!!(activity&&activity.role==='stay'&&now<activity.until),
      focus,
    });
  }
  return rows;
}
function dragonHudMoving(now){
  const x=Number(player.pos.x)||0, z=Number(player.pos.z)||0;
  if(!dragonHudMoveSample.t){ dragonHudMoveSample={x,z,t:now,moving:false}; return false; }
  const dt=Math.max(.001,(now-dragonHudMoveSample.t)/1000), dist=Math.hypot(x-dragonHudMoveSample.x,z-dragonHudMoveSample.z);
  const moving=dist/dt>.8;
  dragonHudMoveSample={x,z,t:now,moving};
  return moving;
}
function dragonHudRoleState(type, mountedHere, moving){
  if(mountedHere) return 'Mounted';
  if(!dragonIsAdult(type)) return dragonStageLabel(type)+' - grows '+dragonGrowthLeftSeconds(type)+'s';
  const role=dragonRole(type), now=performance.now(), activity=dragonRoleActivity[type];
  if(activity && activity.role===role && now<activity.until) return dragonRoleLabel(type)+' - '+activity.text;
  if(role==='follow') return 'Follow - '+(moving?'traveling':'ready');
  if(role==='rest') return dragonHappiness(type)>=75?'Rest - capped':'Rest - recovering';
  if(role==='guard' && mounted && isDragon(mountKind)) return 'Guard - inactive';
  if(role==='stay' && !dragonStaySpots[type]) return 'Stay - no post';
  if(role==='guard'||role==='stay'){
    const left=Math.max(0,(dragonRoleReadyAt[type+':'+role]||0)-now);
    return dragonRoleLabel(type)+' - '+(left>0?Math.ceil(left/1000)+'s':'ready');
  }
  return dragonRoleLabel(type);
}
function updateDragonRoleHUD(now){
  const el=document.getElementById('dragonhud');
  if(!el) return;
  if(dim!=='overworld' || !dragonUnlocks.length){
    if(!el.classList.contains('hidden')) el.classList.add('hidden');
    dragonHudSig='';
    return;
  }
  if(now<dragonHudNextRefresh) return;
  dragonHudNextRefresh=now+500;
  const active=isDragon(mountKind)?dragonType(mountKind):'';
  const moving=dragonHudMoving(now);
  const rows=[];
  for(const type of dragonUnlocks){
    if(!DRAGON_TYPES[type]) continue;
    const mountedHere=active===type;
    const adult=dragonIsAdult(type);
    const parts=[dragonHudRoleState(type,mountedHere,moving)];
    if(adult && dragonRole(type)==='stay'){
      const dist=dragonHudStayDistance(type);
      if(dist) parts.push(dist);
    }
    parts.push('Lv '+dragonBondLevel(type));
    parts.push(dragonPersonalityLabel(type));
    const spec=dragonSpecialization(type);
    if(spec) parts.push(dragonSpecializationName(spec));
    parts.push(dragonHappiness(type)+'%');
    rows.push({type,name:dragonHudName(type),meta:parts.join(' - '),active:mountedHere,spec});
  }
  if(!rows.length){
    if(!el.classList.contains('hidden')) el.classList.add('hidden');
    dragonHudSig='';
    return;
  }
  rows.sort((a,b)=>(b.active?1:0)-(a.active?1:0));
  const headline=active?dragonHudName(active):rows[0].meta.split(' - ')[0];
  const trainingText=dragonTrainingLabel();
  const sig=rows.map(r=>r.type+':'+r.name+':'+r.meta+':'+(r.active?1:0)+':'+(r.spec||'')).join('|')+'|'+headline+'|'+trainingText;
  el.classList.remove('hidden');
  if(sig===dragonHudSig) return;
  dragonHudSig=sig;
  const color=(DRAGON_TYPES[(dragonTrainingState&&dragonTrainingState.type)||active]||DRAGON_TYPES[rows[0].type]||DRAGON_TYPES.ember).membrane[1];
  el.style.borderColor=color+'88';
  el.innerHTML='<div class="dhead"><span class="ddot" style="background:'+color+';color:'+color+'"></span>DRAGONS<span class="drole">'+dragonHudEscape(headline)+'</span></div>'+
    (trainingText?'<div class="dtraining"><b>TRAINING</b><span>'+dragonHudEscape(trainingText)+'</span><i style="width:'+Math.max(0,Math.min(100,Math.round((dragonTrainingState.progress||0)/Math.max(1,dragonTrainingState.need||1)*100)))+'%"></i></div>':'')+
    '<div class="dlist">'+rows.map(r=>'<div class="drow'+(r.spec?' specialized':'')+'"><span class="dname">'+dragonHudEscape(r.name)+(r.spec?' <b class="dspec" style="color:'+dragonSpecializationColor(r.spec)+'">'+dragonHudEscape(dragonSpecializationName(r.spec))+'</b>':'')+'</span><span class="dmeta">'+dragonHudEscape(r.meta)+'</span></div>').join('')+'</div>';
}
function tickCompanionDragons(now, dt){
  if(dim!=='overworld'){
    clearMissingCompanionDragons(new Set());
    companionDragonSig='';
    updateDragonRoleHUD(now);
    return;
  }
  updateDragonRoleHUD(now);
  dragonTrainingFx(now, dt);
  if(now>=companionDragonNextRefresh){
    companionDragonNextRefresh=now+700;
    const rows=collectCompanionDragons();
    const sig=rows.map(r=>companionDragonKey(r)+':'+r.role+':'+r.name+':'+r.owner+':'+(r.stage||'adult')+':'+(r.personality||'')+':'+(r.spec||'')+':' +(r.staySpot?Math.round(r.staySpot.x*10)+','+Math.round(r.staySpot.y*10)+','+Math.round(r.staySpot.z*10):'')).join('|')+'|'+mountKind;
    if(sig!==companionDragonSig){
      companionDragonSig=sig;
      const live=new Set();
      for(const row of rows){ live.add(companionDragonKey(row)); ensureCompanionDragon(row); }
      clearMissingCompanionDragons(live);
    } else {
      for(const row of rows) ensureCompanionDragon(row);
    }
  }
  let i=0;
  for(const key of Object.keys(companionDragons)){
    const rec=companionDragons[key], row=rec.row, owner=row&&companionOwnerPose(row);
    if(!owner){ rec.group.visible=false; continue; }
    rec.group.visible=true;
    const young=rec.stage==='baby'||rec.stage==='juvenile';
    const personality=dragonPersonalityTrait(row.personality||rec.type), motion=dragonPersonalityMotion(personality);
    const side=i%2===0?-1:1, back=(rec.stage==='baby'?1.15:(rec.stage==='juvenile'?1.55:1.95))+Math.floor(i/2)*(young ? .46 : .75);
    const yaw=owner.yaw||0, resting=rec.role==='rest';
    const guardClose=rec.role==='guard'&&personality==='bold'?.72:1;
    const sideReach=(resting ? .58 : (young ? .72 : .95))*motion.side*guardClose;
    const restBack=(resting?(rec.stage==='baby'?1.35:1.65):back)*motion.back*guardClose;
    const sx=rec.role==='stay'?0:Math.cos(yaw)*side*sideReach, sz=rec.role==='stay'?0:-Math.sin(yaw)*side*sideReach;
    const bx=rec.role==='stay'?0:Math.sin(yaw)*restBack, bz=rec.role==='stay'?0:Math.cos(yaw)*restBack;
    const jitter=motion.jitter?Math.sin(now/260+rec.phase)*motion.jitter:0;
    const tx=owner.x+sx+bx+Math.cos(yaw)*jitter, ty=owner.y, tz=owner.z+sz+bz-Math.sin(yaw)*jitter;
    const moveRate=(resting?3.2:(young?6.5:5.5))*motion.move;
    rec.group.position.x+=(tx-rec.group.position.x)*Math.min(1,dt*moveRate);
    rec.group.position.y+=(ty-rec.group.position.y)*Math.min(1,dt*7);
    rec.group.position.z+=(tz-rec.group.position.z)*Math.min(1,dt*moveRate);
    const dx=owner.x-rec.group.position.x, dz=owner.z-rec.group.position.z;
    rec.group.rotation.y=rec.role==='stay'?yaw:Math.atan2(dx,dz);
    animateMountWings(rec.dragon, now*(rec.role==='guard' ? .72 : (rec.role==='rest' ? .22 : (young ? .86 : .48)))*motion.wing+rec.phase*1000);
    const bob=(rec.stage==='baby' ? .115 : (rec.stage==='juvenile' ? .07 : (resting ? .018 : .045)))*motion.bob;
    rec.dragon.position.y=Math.max(resting?-.035:0,Math.sin(now/1000*(rec.stage==='baby'?2.7:1.6)+rec.phase)*bob);
    rec.dragon.rotation.z=(rec.stage==='baby'?Math.sin(now/1000*3.1+rec.phase)*.035:(resting?Math.sin(now/1000*.9+rec.phase)*.012:0))+(motion.tilt||0);
    if(rec.reaction&&now<rec.reaction.until){
      const age=Math.max(0,(now-rec.reaction.start)/1000), left=Math.max(0,(rec.reaction.until-now)/1200);
      const kick=Math.sin(age*13)*left, mood=rec.reaction.mood;
      rec.dragon.position.y+=Math.abs(kick)*(mood==='rest'?.025:.16);
      rec.dragon.rotation.x=(mood==='guard'?-.16:(mood==='rest'?.08:.11))*left+Math.sin(age*9+rec.phase)*.03*left;
      rec.dragon.rotation.z+=(mood==='happy'?Math.sin(age*18)*.1:0)*left;
      const base=rec.dragon.userData.baseCompanionScale||1;
      const happyMul=motion.happySpark||1, guardMul=motion.guardSpark||1;
      const s=base*(1+(mood==='happy'?Math.abs(kick)*.04*happyMul:(mood==='guard'?left*.025*guardMul:0)));
      rec.dragon.scale.setScalar(s);
      if(Math.random()<dt*(mood==='happy'?6*(motion.happySpark||1):2.5)){
        const pcol=hexToRgb01(parseInt(dragonPersonalityColor(personality).slice(1),16));
        const col=mood==='rest'?(personality==='gentle'?pcol:[.45,1,.52]):(mood==='guard'?(personality==='bold'?pcol:[.85,.95,1]):dragonTrailColor(rec.type));
        spawnParticle({x:rec.group.position.x+(Math.random()-.5)*.55,y:rec.group.position.y+.9+Math.random()*.55,z:rec.group.position.z+(Math.random()-.5)*.55,
          vx:(Math.random()-.5)*.08,vy:.1+Math.random()*.2,vz:(Math.random()-.5)*.08,life:.45+Math.random()*.25,grav:-.08,r:col[0],g:col[1],b:col[2]});
      }
    } else {
      rec.reaction=null;
      rec.dragon.rotation.x=0;
      rec.dragon.scale.setScalar(rec.dragon.userData.baseCompanionScale||1);
    }
    if(rec.role==='guard' && Math.random()<dt*.85*(motion.guardSpark||1)){
      const col=personality==='bold'?hexToRgb01(parseInt(dragonPersonalityColor(personality).slice(1),16)):dragonTrailColor(rec.type);
      spawnParticle({x:rec.group.position.x+(Math.random()-.5)*.55,y:rec.group.position.y+1.18+Math.random()*.35,z:rec.group.position.z+(Math.random()-.5)*.55,
        vx:(Math.random()-.5)*.08,vy:.06+Math.random()*.11,vz:(Math.random()-.5)*.08,life:.45+Math.random()*.3,grav:-.08,r:col[0],g:col[1],b:col[2]});
    } else if(rec.role==='rest' && Math.random()<dt*.45*(motion.restSpark||1)){
      const col=personality==='gentle'?hexToRgb01(parseInt(dragonPersonalityColor(personality).slice(1),16)):dragonTrailColor(rec.type);
      spawnParticle({x:rec.group.position.x+(Math.random()-.5)*.38,y:rec.group.position.y+.55+Math.random()*.32,z:rec.group.position.z+(Math.random()-.5)*.38,
        vx:(Math.random()-.5)*.04,vy:.05+Math.random()*.09,vz:(Math.random()-.5)*.04,life:.7+Math.random()*.35,grav:-.05,r:col[0]*.75+.2,g:Math.min(1,col[1]*.75+.25),b:col[2]*.75+.2});
    } else if(personality==='hungry' && rec.role!=='rest' && Math.random()<dt*.22){
      const col=hexToRgb01(parseInt(dragonPersonalityColor(personality).slice(1),16));
      spawnParticle({x:rec.group.position.x+(Math.random()-.5)*.32,y:rec.group.position.y+.42+Math.random()*.18,z:rec.group.position.z+(Math.random()-.5)*.32,
        vx:(Math.random()-.5)*.035,vy:.035+Math.random()*.045,vz:(Math.random()-.5)*.035,life:.38+Math.random()*.18,grav:-.04,r:col[0],g:col[1],b:col[2]});
    }
    i++;
  }
}
function rebuildDragonRoost(rows){
  while(dragonRoostGroup.children.length) dragonRoostGroup.remove(dragonRoostGroup.children[0]);
  for(let i=0;i<rows.length;i++){
    const r=rows[i], slot=DRAGON_ROOST_SLOTS[i], def=DRAGON_TYPES[r.type]||DRAGON_TYPES.ember;
    const perch=new THREE.Group();
    const dragon=makeMount('dragon:'+r.type,1,r.spec||'');
    const stage=roostDragonStage(r.type,r.hatchedAt), adult=stage==='adult', juvenile=stage==='juvenile';
    dragon.scale.multiplyScalar(adult?.68:(juvenile?.52:.34));
    dragon.position.set(0,0,0);
    dragon.rotation.y=slot.yaw;
    perch.add(dragon);
    const specText=r.spec?' · '+dragonSpecializationName(r.spec):'';
    const tag=makeDragonNameplate(r.name+' · '+(r.gender==='female'?'F':'M')+' · '+roostDragonStageLabel(stage)+' · '+(r.role||'follow')+specText, r.owner, r.spec?dragonSpecializationColor(r.spec):def.membrane[1]);
    tag.position.set(0,adult?2.35:(juvenile?1.85:1.32),0);
    tag.scale.set(adult?1.75:(juvenile?1.58:1.36),adult?.78:(juvenile?.7:.6),1);
    perch.add(tag);
    perch.position.set(slot.x,slot.y,slot.z);
    perch.userData.dragon=dragon;
    perch.userData.type=r.type;
    perch.userData.stage=stage;
    perch.userData.baby=stage==='baby';
    perch.userData.phase=i*.7;
    dragonRoostGroup.add(perch);
  }
}
function tickDragonRoost(now, dt){
  dragonRoostGroup.visible=dim==='overworld';
  if(!dragonRoostGroup.visible) return;
  if(now>=dragonRoostNextRefresh){
    dragonRoostNextRefresh=now+1200;
    const rows=collectRoostDragons();
    const sig=rows.map(r=>r.sid+':'+r.owner+':'+r.type+':'+r.gender+':'+r.personality+':'+r.role+':'+roostDragonStage(r.type,r.hatchedAt)+':'+r.name+':'+(r.spec||'')).join('|')+'|'+mountKind;
    if(sig!==dragonRoostSig){ dragonRoostSig=sig; rebuildDragonRoost(rows); }
  }
  for(const perch of dragonRoostGroup.children){
    const d=perch.userData.dragon;
    if(!d) continue;
    const stage=perch.userData.stage||'adult';
    const baby=stage==='baby', juvenile=stage==='juvenile';
    animateMountWings(d, now*(baby?1.05:(juvenile?.72:.45))+perch.userData.phase*1000);
    const t=now/1000+perch.userData.phase;
    d.position.y=baby?Math.max(0,Math.sin(t*2.8))*.13:(juvenile?Math.sin(t*1.8)*.065:Math.sin(t*1.1)*.035);
    d.rotation.z=baby?Math.sin(t*3.4)*.035:(juvenile?Math.sin(t*1.7)*.018:0);
    if(Math.random()<dt*(baby?.28:(juvenile?.55:.8))){
      const type=perch.userData.type||'ember', col=dragonTrailColor(type);
      spawnParticle({x:perch.position.x+(Math.random()-.5)*(baby?.28:.6),y:perch.position.y+(baby?.82:(juvenile?1.12:1.4)),z:perch.position.z+(Math.random()-.5)*(baby?.28:.6),
        vx:(Math.random()-.5)*.08,vy:.08+Math.random()*.12,vz:(Math.random()-.5)*.08,
        life:.5+Math.random()*.4,grav:-.12,r:col[0],g:col[1],b:col[2]});
    }
  }
}

// ---------------- dragon breeding: dragons perched at a nest (Egg Insulator) ----------------
const DRAGON_PERCH_SLOTS_C=2, DRAGON_LOVE_MS_C=20000, DRAGON_BREED_MS_C=6000, DRAGON_BREED_CD_MS_C=45000;
const DRAGON_BREED_C={};   // symmetric parentA|parentB -> offspring (mirrors server DRAGON_BREEDING)
for(const [a,b,o] of [['ember','ember','verdant'],['verdant','verdant','ember'],['ember','verdant','frost'],
  ['ember','frost','storm'],['verdant','frost','storm'],['frost','frost','storm'],
  ['ember','storm','void'],['verdant','storm','void'],['frost','storm','void'],['storm','storm','void']]){
  DRAGON_BREED_C[a+'|'+b]=o; DRAGON_BREED_C[b+'|'+a]=o;
}
const perchedDragons={};   // "x,y,z#slot" -> { group, type, gender, x,y,z,slot, loveUntil, breedCdUntil, breedStart, heartAcc }
function nestSlotPos(x,y,z,slot){ return { x:x+0.5+(slot?0.95:-0.95), y, z:z+0.5 }; }
function nestCoordKey(x,y,z){ return x+','+y+','+z; }
function perchKeysAt(x,y,z){ const out=[]; for(let s=0;s<DRAGON_PERCH_SLOTS_C;s++){ const k=nestCoordKey(x,y,z)+'#'+s; if(perchedDragons[k]) out.push(k); } return out; }
function freePerchSlotAt(x,y,z){ for(let s=0;s<DRAGON_PERCH_SLOTS_C;s++) if(!perchedDragons[nestCoordKey(x,y,z)+'#'+s]) return s; return -1; }
function addPerchedDragon(key,x,y,z,slot,type,gender,loveUntil){
  removePerchedDragon(key);
  const grp=makeMount('dragon:'+type,1,dragonSpecialization(type));
  const p=nestSlotPos(x,y,z,slot);
  grp.position.set(p.x,p.y,p.z);
  grp.rotation.y = slot ? -Math.PI*0.6 : Math.PI*0.6;   // face inward toward the nest
  scene.add(grp);
  perchedDragons[key]={ group:grp, type, gender:gender==='female'?'female':'male', x,y,z,slot, loveUntil:loveUntil||0, breedCdUntil:0, breedStart:0, heartAcc:0 };
}
function removePerchedDragon(key){
  const e=perchedDragons[key];
  if(e){ scene.remove(e.group); delete perchedDragons[key]; }
}
function tickPerchedDragons(now, dt){
  for(const k in perchedDragons){
    const e=perchedDragons[k];
    animateMountWings(e.group, now*0.6);                 // slow idle wing flutter
    e.group.position.y = e.y + Math.sin(now/1000*1.6 + e.slot)*0.04;
    if(e.loveUntil>now){                                 // hearts while smitten
      e.heartAcc=(e.heartAcc||0)+dt;
      if(e.heartAcc>0.18){ e.heartAcc=0;
        spawnParticle({ x:e.group.position.x+(Math.random()-.5)*.5, y:e.y+2.2+Math.random()*.4, z:e.group.position.z+(Math.random()-.5)*.5,
          vx:(Math.random()-.5)*.2, vy:.5+Math.random()*.3, vz:(Math.random()-.5)*.2, life:.9, grav:-0.4, r:1, g:.32, b:.5 });
      }
    }
  }
  if(!NET.on) tickSoloBreeding(now);                     // solo runs the breeding timer client-side
}
function tickSoloBreeding(now){
  const nests={};
  for(const k in perchedDragons){ const c=k.split('#')[0]; (nests[c]=nests[c]||[]).push(perchedDragons[k]); }
  for(const c in nests){
    const list=nests[c];
    if(list.length<DRAGON_PERCH_SLOTS_C){ for(const e of list) e.breedStart=0; continue; }
    const [a,b]=list, offspring=DRAGON_BREED_C[a.type+'|'+b.type];
    const compatibleGender = a.type===b.type || a.gender!==b.gender;
    const fertile = offspring && compatibleGender && a.loveUntil>now && b.loveUntil>now && now>=a.breedCdUntil && now>=b.breedCdUntil;
    if(!fertile){ a.breedStart=0; b.breedStart=0; continue; }
    if(!a.breedStart){ a.breedStart=b.breedStart=now; }
    if(now-a.breedStart<DRAGON_BREED_MS_C) continue;
    addItem(DRAGON_TYPES[offspring].egg, 1);
    a.loveUntil=0; b.loveUntil=0; a.breedStart=0; b.breedStart=0;
    a.breedCdUntil=now+DRAGON_BREED_CD_MS_C; b.breedCdUntil=now+DRAGON_BREED_CD_MS_C;
    const [x,y,z]=c.split(',').map(Number);
    dragonBreedFx(x,y,z,offspring);
    sysMsg('The dragons nuzzle — a <b>'+DRAGON_TYPES[offspring].name+' Egg</b> is laid!');
  }
}
function dragonBreedFx(x,y,z,offspring){
  const d=DRAGON_TYPES[offspring]; if(!d) return;
  const n=parseInt(d.membrane[1].slice(1),16);
  burst(x+.5, y+1.0, z+.5, [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255], 30, 2.6, 3.0, .8);
  if(typeof SFX!=='undefined' && SFX.boom) SFX.boom();
}
// --- player actions at a nest ---
function perchMyDragon(hit){
  const kind=mountKind;
  if(!isDragon(kind)){ sysMsg('Ride a dragon here to perch it'); return; }
  if(!dragonIsAdult(dragonType(kind))){ sysMsg(dragonStageLabel(dragonType(kind))+' dragons need to grow before nesting'); return; }
  if(NET.on&&NET.room){ NET.room.send('perchDragon', {x:hit.x, y:hit.y, z:hit.z, kind}); }
  else {
    const slot=freePerchSlotAt(hit.x,hit.y,hit.z);
    if(slot<0){ sysMsg('This nest is full'); return; }
    const type=dragonType(kind);
    addPerchedDragon(nestCoordKey(hit.x,hit.y,hit.z)+'#'+slot, hit.x,hit.y,hit.z, slot, type, dragonGender(type), 0);
  }
  mounted=false; mountKind=''; if(localMountObj) localMountObj.visible=false;
  sysMsg('Your <b>'+(DRAGON_TYPES[dragonType(kind)]||{}).name+'</b> settles onto the nest. Feed it a <b>Dragon Treat</b> to breed.');
}
function feedNestDragon(key, slot=selected){
  if(NET.on&&NET.room){ NET.room.send('feedDragon', {key, slot}); return; }
  const e=perchedDragons[key]; if(!e) return;
  let useSlot=Math.max(0,Math.min(35,slot|0));
  if(!inv[useSlot] || inv[useSlot].id!==I.DRAGON_TREAT) useSlot=inv.findIndex(s=>s&&s.id===I.DRAGON_TREAT);
  if(useSlot<0){ sysMsg('You need a <b>Dragon Treat</b>'); return; }
  const s=inv[useSlot]; s.count--; if(s.count<=0) inv[useSlot]=null; refreshHUD(); if(uiOpen) renderUI();
  e.loveUntil=Date.now()+DRAGON_LOVE_MS_C;
  sysMsg('The <b>'+(DRAGON_TYPES[e.type]||{}).name+'</b> is smitten ❤');
}
function recallNestDragon(key){
  if(NET.on&&NET.room){ NET.room.send('recallDragon', {key}); return; }
  removePerchedDragon(key);
  sysMsg('Dragon recalled');
}

// --- mounted dragon breath weapon (primary action while flying) ---
const DRAGON_BREATH_DMG={ember:9, verdant:8, frost:7, storm:13, void:11};
let dragonBreathCdLocal=0;
function dragonBreathe(){
  if(!isDragon(mountKind)) return false;
  const now=performance.now();
  if(now<dragonBreathCdLocal) return true;
  dragonBreathCdLocal=now+1100;
  const type=dragonType(mountKind), col=dragonTrailColor(type);
  const dir=new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(player.pitch, player.yaw, 0, 'YXZ'));
  const ox=player.pos.x+dir.x*1.2, oy=player.pos.y+1.5+dir.y*.5, oz=player.pos.z+dir.z*1.2;
  if(NET.on&&NET.room){
    NET.room.send('dragonBreath', {dx:dir.x, dy:dir.y, dz:dir.z});
  } else {
    netSpawnProjectile({breath:true, element:type, x:ox, y:oy, z:oz, vx:dir.x*22, vy:dir.y*22, vz:dir.z*22, dgn:NET.dgn||''});
    soloBreathDamage(ox,oy,oz,dir,type);                       // solo: client owns the damage
  }
  burst(ox,oy,oz,col,8,2.2,1.4,.3);                            // muzzle flash
  if(typeof SFX!=='undefined' && SFX.cast) SFX.cast();
  return true;
}
function soloBreathDamage(ox,oy,oz,dir,type){
  const dmg=DRAGON_BREATH_DMG[type]||9, range=26, rad=3.3;
  for(let i=mobs.length-1;i>=0;i--){
    const mob=mobs[i]; if(mob.net) continue;
    const mp=mob.grp.position, t=(mp.x-ox)*dir.x+((mp.y+1)-oy)*dir.y+(mp.z-oz)*dir.z;
    if(t<0||t>range) continue;
    if(Math.hypot(mp.x-(ox+dir.x*t),(mp.y+1)-(oy+dir.y*t),mp.z-(oz+dir.z*t))<=rad) damageMob(mob, dmg);
  }
}

// ---------------- familiar: Shade (utility + defense shadow companion) ----------------
const FAMILIAR_IDS=['shade','fang','mote','sprite','cat','dog','wolf'];
const DEFAULT_FAMILIAR_XP=Object.freeze({shade:0,fang:0,mote:0,sprite:0,cat:0,dog:0,wolf:0});
let familiarUnlocks=[];          // bound familiar kinds (persisted in the profile)
let familiarXp={...DEFAULT_FAMILIAR_XP};
let familiarChallenges={};
let activeFamiliar='';           // currently summoned familiar kind ('' = none)
function familiarPowerLevel(kind){return FAMILIAR_SYSTEM.bondLevel(familiarXp[kind]||0);}
function applyFamiliarBond(m){if(!m||!FAMILIARS[m.kind])return;familiarXp[m.kind]=Math.max(0,m.xp|0);if(m.challenge)familiarChallenges[m.kind]=m.challenge;famHudSig='';if(m.challenge&&m.challenge.justCompleted)sysMsg('<b>Bond Challenge complete:</b> '+m.challenge.title+' · +'+FAMILIAR_SYSTEM.DAILY_CHALLENGE_REWARD+' Bond XP');}
const famTier=FAMILIAR_SYSTEM.tier;
// Shade's rank follows the lore tiers (Iron..Gold); visible bodies are capped for the engine.
const SHADE_RANK_N=[1,3,7,31,211], SHADE_VISIBLE_CAP=7;
function shadeTier(lvl){ return famTier(lvl); }
function shadeRankCount(lvl){ return SHADE_RANK_N[shadeTier(lvl)]; }
function shadeBodyCount(lvl){ return Math.min(SHADE_VISIBLE_CAP, shadeRankCount(lvl)); }
function fangBodyCount(lvl){ return Math.min(3, 1+Math.floor(famTier(lvl)/2)); }   // 1..3 hounds
function petBodyCount(){ return 1; }
const fangDamage=FAMILIAR_SYSTEM.fangDamage;
function spriteBodyCount(lvl){ return Math.min(3, 1+Math.floor(famTier(lvl)/2)); }   // 1..3 sprites
const spriteForageChance=FAMILIAR_SYSTEM.spriteForageChance;
function makeSpriteBody(){
  const grp=new THREE.Group();
  const core=new THREE.MeshBasicMaterial({color:0xfff6c8, transparent:true, opacity:.95, depthWrite:false});
  const glow=new THREE.MeshBasicMaterial({color:0xffe27a, transparent:true, opacity:.4, depthWrite:false});
  const wing=new THREE.MeshBasicMaterial({color:0xbfeede, transparent:true, opacity:.5, depthWrite:false});
  const box=(sx,sy,sz,px,py,pz,m,parent)=>{ const me=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),m); me.position.set(px,py,pz); (parent||grp).add(me); return me; };
  const orb=new THREE.Group(); grp.add(orb); orb.position.y=0.1;
  box(.16,.18,.16, 0,0,0, core, orb);              // glowing body
  box(.26,.28,.22, 0,0,0, glow, orb);              // halo
  const wings=[];                                  // little flutter wings
  wings.push(box(.04,.22,.16, -.16,.02,0, wing, orb));
  wings.push(box(.04,.22,.16,  .16,.02,0, wing, orb));
  grp.userData={ orb, wings };
  return grp;
}
function moteBodyCount(lvl){ return Math.min(3, 1+Math.floor(famTier(lvl)/2)); }   // 1..3 wisps
function makeMoteBody(){
  const grp=new THREE.Group();
  const core=new THREE.MeshBasicMaterial({color:0xd8ffa0, transparent:true, opacity:.95, depthWrite:false});
  const glow=new THREE.MeshBasicMaterial({color:0x8fe06a, transparent:true, opacity:.4, depthWrite:false});
  const petal=new THREE.MeshBasicMaterial({color:0x3ea64a, transparent:true, opacity:.7, depthWrite:false});
  const box=(sx,sy,sz,px,py,pz,m,parent)=>{ const me=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),m); me.position.set(px,py,pz); (parent||grp).add(me); return me; };
  const orb=new THREE.Group(); grp.add(orb); orb.position.y=0.1;
  box(.2,.2,.2, 0,0,0, core, orb);                 // glowing core
  box(.32,.32,.32, 0,0,0, glow, orb);              // soft halo
  const petals=[];                                 // little leaf petals that flutter
  for(const [px,pz] of [[.22,0],[-.22,0],[0,.22],[0,-.22]]){ const w=box(.12,.04,.18, px,0,pz, petal, orb); petals.push(w); }
  grp.userData={ orb, petals };
  return grp;
}
function makeFangBody(){
  const grp=new THREE.Group();
  const fur=new THREE.MeshLambertMaterial({color:0x3b2f3a});       // dark coat
  const furL=new THREE.MeshLambertMaterial({color:0x564658});      // lighter chest/snout
  const furD=new THREE.MeshLambertMaterial({color:0x1d1622});      // muzzle/legs/tail tip
  const eye=new THREE.MeshBasicMaterial({color:0xffcf4a});         // amber glow eyes
  const box=(sx,sy,sz,px,py,pz,m,parent)=>{ const me=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),m); me.position.set(px,py,pz); (parent||grp).add(me); return me; };
  const hip=0.46;
  const body=box(.4,.36,.82, 0,hip,0, fur); body.userData.base=hip;
  box(.36,.32,.3, 0,hip+.02,.3, furL);                              // chest
  // neck + head (faces +z)
  const head=new THREE.Group(); head.position.set(0,hip+.1,.42); grp.add(head);
  box(.32,.3,.32, 0,0,.16, fur, head);                              // skull
  box(.2,.18,.22, 0,-.04,.36, furL, head);                          // snout
  box(.18,.06,.1, 0,-.12,.46, furD, head);                          // jaw/nose
  box(.08,.16,.05, -.1,.2,.08, fur, head); box(.08,.16,.05, .1,.2,.08, fur, head);   // perked ears
  box(.06,.06,.03, -.09,.04,.3, eye, head); box(.06,.06,.03, .09,.04,.3, eye, head); // eyes
  // legs as hip pivots so rotation.x swings the whole leg
  const legs=[];
  for(const [lx,lz] of [[-.13,.28],[.13,.28],[-.13,-.28],[.13,-.28]]){
    const piv=new THREE.Group(); piv.position.set(lx,hip-.04,lz); grp.add(piv);
    box(.12,.4,.13, 0,-.2,0, furD, piv);
    legs.push(piv);
  }
  // tail on a base pivot so it wags from the rump
  const tail=new THREE.Group(); tail.position.set(0,hip+.12,-.4); grp.add(tail);
  box(.12,.12,.34, 0,.04,-.16, fur, tail);
  box(.1,.1,.16, 0,.12,-.32, furD, tail);
  grp.userData={ body, head, legs, tail };
  return grp;
}
function makePetBody(kind){
  const style=kind==='cat'
    ? {fur:0x6c6b66,furL:0xd7c7a7,furD:0x343436,eye:0x9ad26b,scale:[.72,.72,.72],tail:.44,ears:.18}
    : kind==='wolf'
      ? {fur:0x59636f,furL:0x9aa6b2,furD:0x26303a,eye:0x8bd7ff,scale:[.92,.9,.96],tail:.42,ears:.2}
      : {fur:0x7a4a25,furL:0xd0a066,furD:0x3a2412,eye:0xffd24a,scale:[.86,.82,.88],tail:.5,ears:.14};
  const grp=new THREE.Group();
  const fur=new THREE.MeshLambertMaterial({color:style.fur});
  const furL=new THREE.MeshLambertMaterial({color:style.furL});
  const furD=new THREE.MeshLambertMaterial({color:style.furD});
  const eye=new THREE.MeshBasicMaterial({color:style.eye});
  const box=(sx,sy,sz,px,py,pz,m,parent)=>{ const me=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),m); me.position.set(px,py,pz); (parent||grp).add(me); return me; };
  const hip=0.38;
  const body=box(.34,.28,.62,0,hip,0,fur); body.userData.base=hip;
  const head=new THREE.Group(); head.position.set(0,hip+.08,.36); grp.add(head);
  box(.3,.26,.28,0,0,.12,fur,head);
  box(.16,.12,.2,0,-.04,.32,furL,head);
  box(.11,.05,.07,0,-.1,.42,furD,head);
  box(.05,.05,.03,-.08,.03,.25,eye,head); box(.05,.05,.03,.08,.03,.25,eye,head);
  box(.07,style.ears,.05,-.1,.18,.04,fur,head); box(.07,style.ears,.05,.1,.18,.04,fur,head);
  const legs=[];
  for(const [lx,lz] of [[-.1,.2],[.1,.2],[-.1,-.22],[.1,-.22]]){
    const piv=new THREE.Group(); piv.position.set(lx,hip-.03,lz); grp.add(piv);
    box(.1,.32,.1,0,-.16,0,furD,piv);
    legs.push(piv);
  }
  const tail=new THREE.Group(); tail.position.set(0,hip+.08,-.32); grp.add(tail);
  box(.09,.09,style.tail,0,.05,-style.tail*.5,fur,tail);
  grp.scale.set(style.scale[0],style.scale[1],style.scale[2]);
  grp.userData={body,head,legs,tail,petKind:kind};
  return grp;
}
const makeCatBody=()=>makePetBody('cat');
const makeDogBody=()=>makePetBody('dog');
const makeWolfBody=()=>makePetBody('wolf');
function makeShadeBody(){
  const grp=new THREE.Group();
  const dark=new THREE.MeshBasicMaterial({color:0x0a0712, transparent:true, opacity:.58, depthWrite:false});
  const dark2=new THREE.MeshBasicMaterial({color:0x18102a, transparent:true, opacity:.72, depthWrite:false});
  const eyeMat=new THREE.MeshBasicMaterial({color:0xb86cff, transparent:true, opacity:1, depthWrite:false});
  const box=(sx,sy,sz,px,py,pz,m,parent)=>{ const me=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),m); me.position.set(px,py,pz); (parent||grp).add(me); return me; };
  // tapered shroud: narrow hood at top widening to a frayed hem
  box(.34,.32,.32, 0,1.62,0, dark2);                 // hood
  box(.42,.42,.36, 0,1.26,0, dark);                  // shoulders
  box(.5,.4,.42, 0,.86,0, dark);                     // body
  box(.07,.09,.04, -.08,1.62,.16, eyeMat); box(.07,.09,.04, .08,1.62,.16, eyeMat); // eyes
  box(.16,.34,.12, -.26,1.12,0, dark); box(.16,.34,.12, .26,1.12,0, dark);          // draping sleeves
  // frayed hem tatters that sway
  const wisps=[];
  for(const wx of [-.22,-.075,.075,.22]){ const w=new THREE.Group(); w.position.set(wx,.66,0); grp.add(w);
    box(.1,.5,.1, 0,-.25,0, dark, w); wisps.push(w); }
  grp.userData={ eyes:eyeMat, wisps };
  return grp;
}
const FAMILIARS={
  shade:{ name:'Shade', sigil:I.SHADOW_SIGIL, make:makeShadeBody, count:shadeBodyCount, combat:false },
  fang: { name:'Fang',  sigil:I.FANG_TOTEM,   make:makeFangBody,  count:fangBodyCount,  combat:true },
  mote: { name:'Mote',  sigil:I.MOTE_CHARM,   make:makeMoteBody,  count:moteBodyCount,  combat:false },
  sprite:{ name:'Sprite', sigil:I.FORAGE_CHARM, make:makeSpriteBody, count:spriteBodyCount, combat:false },
  cat:{ name:'Cat', sigil:I.CAT_COLLAR, make:makeCatBody, count:petBodyCount, combat:false },
  dog:{ name:'Dog', sigil:I.DOG_COLLAR, make:makeDogBody, count:petBodyCount, combat:false },
  wolf:{ name:'Wolf', sigil:I.WOLF_COLLAR, make:makeWolfBody, count:petBodyCount, combat:false },
};
const FAMILIAR_BY_SIGIL={ [I.SHADOW_SIGIL]:'shade', [I.FANG_TOTEM]:'fang', [I.MOTE_CHARM]:'mote', [I.FORAGE_CHARM]:'sprite', [I.CAT_COLLAR]:'cat', [I.DOG_COLLAR]:'dog', [I.WOLF_COLLAR]:'wolf' };
const familiarRender={};          // ownerKey -> { kind, grp, bodies:[{mesh,phase}] }
function clearFamiliarRender(key){ const s=familiarRender[key]; if(s){ scene.remove(s.grp); delete familiarRender[key]; } }
function ensureFamiliarRender(key, kind, count){
  let s=familiarRender[key];
  if(s && s.kind!==kind){ scene.remove(s.grp); delete familiarRender[key]; s=null; }
  if(!s){ s={kind, grp:new THREE.Group(), bodies:[]}; scene.add(s.grp); familiarRender[key]=s; }
  const make=FAMILIARS[kind].make;
  while(s.bodies.length<count){ const mesh=make(); s.grp.add(mesh); s.bodies.push({mesh, phase:Math.random()*Math.PI*2}); }
  while(s.bodies.length>count){ const b=s.bodies.pop(); s.grp.remove(b.mesh); }
  return s;
}
function nearestHostile(x,z,range){
  let best=null,bd=range;
  for(const m of mobs){ if(isAnimalKind(m.kind)) continue;
    const d=Math.hypot(m.grp.position.x-x, m.grp.position.z-z); if(d<bd){ bd=d; best=m; } }
  return best;
}
function tickFamiliars(now, dt){
  const want={};
  if(activeFamiliar) want.local={kind:activeFamiliar, x:player.pos.x, y:player.pos.y, z:player.pos.z, yaw:player.yaw, lvl:familiarPowerLevel(activeFamiliar)};
  for(const sid in NET.remotes){
    const r=NET.remotes[sid], ref=r.ref;
    if(ref && FAMILIARS[ref.familiar] && (ref.dgn||'')===NET.dgn) want[sid]={kind:ref.familiar, x:r.grp.position.x, y:r.grp.position.y, z:r.grp.position.z, yaw:ref.yaw||0, lvl:FAMILIAR_SYSTEM.TIER_LEVELS[Math.max(0,Math.min(4,ref.familiarTier|0))]};
  }
  for(const k in familiarRender) if(!want[k]) clearFamiliarRender(k);
  const t=now/1000, sdt=Math.min(0.05, dt||0.016);
  for(const k in want){
    const o=want[k], def=FAMILIARS[o.kind], n=def.count(o.lvl), s=ensureFamiliarRender(k,o.kind,n);
    if(o.kind==='fang') tickFangPack(s,o,n,sdt,t,k==='local');
    else if(o.kind==='mote') tickMoteSwarm(s,o,n,sdt,t);
    else if(o.kind==='sprite') tickSpriteSwarm(s,o,n,sdt,t);
    else if(o.kind==='cat'||o.kind==='dog'||o.kind==='wolf') tickPetFollow(s,o,n,sdt,t,k==='local');
    else tickShadeSwarm(s,o,n,sdt,t,k==='local');
  }
  if(!NET.on && activeFamiliar==='fang') tickSoloFang(now);
  if(!NET.on && activeFamiliar==='mote') tickSoloMote(now);
  tickFamiliarTierEvolution();
  tickFamiliarPersonality(now);
}
let familiarTierSeen=-1;
function tickFamiliarTierEvolution(){
  const tier=activeFamiliar?famTier(familiarPowerLevel(activeFamiliar)):0;
  if(familiarTierSeen<0){familiarTierSeen=tier;return;}
  if(tier<=familiarTierSeen){familiarTierSeen=tier;return;}
  familiarTierSeen=tier;
  if(!activeFamiliar)return;
  const ability=FAMILIAR_SYSTEM.TIER_ABILITIES[activeFamiliar][tier];
  const col=activeFamiliar==='shade'?[.55,.25,.9]:activeFamiliar==='fang'?[1,.75,.25]:activeFamiliar==='mote'?[.55,1,.35]:activeFamiliar==='cat'?[.62,.84,.45]:activeFamiliar==='dog'?[1,.64,.28]:activeFamiliar==='wolf'?[.55,.82,1]:[1,.9,.35];
  burst(player.pos.x,player.pos.y+1,player.pos.z,col,36,3.5,3,.8);
  if(typeof SFX!=='undefined'&&SFX.boom)SFX.boom();
  sysMsg('<b>'+FAMILIARS[activeFamiliar].name+' evolved — Tier '+(tier+1)+':</b> '+ability);
}
let familiarIdleAt=0, familiarReactionAt=0;
const FAMILIAR_IDLE_LINES={
  mote:['Mote hums softly, warming the air around you.','Mote circles once, checking old wounds that are no longer there.'],
  sprite:['Sprite counts your supplies. Twice.','Sprite flits toward the road, then remembers it is supposed to wait for you.'],
  cat:['Cat pads silently beside you.','Cat studies the nearest ledge with complete confidence.'],
  dog:['Dog sniffs the trail and looks back at you.','Dog waits at your heel, ready for the next hunt.'],
  wolf:['Wolf watches the treeline without blinking.','Wolf gives a quiet hunting huff.'],
};
function tickFamiliarPersonality(now){
  const lines=FAMILIAR_IDLE_LINES[activeFamiliar];
  if(!lines){ familiarIdleAt=0; return; }
  if(!familiarIdleAt){ familiarIdleAt=now+90000+Math.random()*45000; return; }
  if(now>=familiarIdleAt){ familiarIdleAt=now+110000+Math.random()*50000; sysMsg(lines[(Math.random()*lines.length)|0]); }
}
let moteBloomReadyAt=0;
function familiarReaction(kind,count=1){
  const now=performance.now(); if(now<familiarReactionAt) return;
  familiarReactionAt=now+12000;
  if(kind==='mote'){ moteBloomReadyAt=now+FAMILIAR_SYSTEM.moteBurstCooldown(familiarPowerLevel('mote')); sysMsg('Mote brightens as your strength returns.'); }
  else if(kind==='sprite') sysMsg(count>1?'Sprite trills: <i>"A whole hidden cache!"</i>':'Sprite chirps: <i>"Found one more!"</i>');
  else if(kind==='cat') sysMsg('Cat lands softly and looks pleased with itself.');
  else if(kind==='dog') sysMsg('Dog noses out extra meat from the hunt.');
  else if(kind==='wolf') sysMsg('Wolf howls as the hostile falls.');
}
// Mote: gentle restoration wisps that hover and bob close around the owner (not a swarm, not a pet).
function tickMoteSwarm(s,o,n,dt,t){
  const bloomReady=t*1000>=moteBloomReadyAt;
  for(let i=0;i<s.bodies.length;i++){
    const b=s.bodies[i], a=t*(bloomReady?.8:.45)+b.phase+i*(Math.PI*2/Math.max(1,n)), rad=(bloomReady?.9:.55)+0.12*Math.sin(t*1.1+b.phase);
    const tx=o.x+Math.cos(a)*rad, tz=o.z+Math.sin(a)*rad, ty=o.y+1.1+Math.sin(t*1.6+b.phase)*0.22, p=b.mesh.position;
    if(Math.hypot(tx-p.x,tz-p.z)>14){ p.set(tx,ty,tz); }
    p.x+=(tx-p.x)*Math.min(1,dt*5); p.y+=(ty-p.y)*Math.min(1,dt*5); p.z+=(tz-p.z)*Math.min(1,dt*5);
    const u=b.mesh.userData;
    if(u.orb){ const pul=1+(bloomReady?.22:.08)*Math.sin(t*(bloomReady?4:2)+b.phase); u.orb.scale.set(pul,pul,pul); u.orb.rotation.y=t*(bloomReady?.8:.35)+b.phase; }
    if(u.petals) for(let w=0;w<u.petals.length;w++) u.petals[w].rotation.x=Math.sin(t*4+w+b.phase)*0.5;
  }
}
// Sprite: flits quickly near the owner and darts to a freshly-mined block to "gather" from it.
function tickSpriteSwarm(s,o,n,dt,t){
  for(let i=0;i<s.bodies.length;i++){
    const b=s.bodies[i], p=b.mesh.position, u=b.mesh.userData;
    let tx,tz,ty;
    if(b.forage && t<b.forage.until){ tx=b.forage.x; ty=b.forage.y; tz=b.forage.z;   // dart to the mined block
      if(Math.random()<0.5) spawnParticle({x:p.x,y:p.y,z:p.z,vx:(Math.random()-.5)*.4,vy:.4+Math.random()*.3,vz:(Math.random()-.5)*.4,life:.5,grav:-.4,r:1,g:.9,b:.45}); }
    else { b.forage=null; const a=t*0.9+b.phase+i*(Math.PI*2/Math.max(1,n)), rad=0.85+0.18*Math.sin(t*1.4+b.phase);
      tx=o.x+Math.cos(a)*rad; tz=o.z+Math.sin(a)*rad; ty=o.y+1.25+Math.sin(t*2.2+b.phase)*0.22; }
    if(Math.hypot(tx-p.x,tz-p.z)>14){ p.set(tx,ty,tz); }
    const lerp=Math.min(1,dt*(b.forage?9:6));
    p.x+=(tx-p.x)*lerp; p.y+=(ty-p.y)*lerp; p.z+=(tz-p.z)*lerp;
    if(u.orb){ const pul=1+0.2*Math.sin(t*5+b.phase); u.orb.scale.set(pul,pul,pul); }
    if(u.wings){ const f=Math.sin(t*22+b.phase)*0.6; u.wings[0].rotation.z=-0.3-f; u.wings[1].rotation.z=0.3+f; }
  }
}
// send the nearest local Sprite to gather from a mined block + sparkle
function spriteForage(x,y,z){
  const s=familiarRender.local; if(!s||s.kind!=='sprite') return;
  let best=null,bd=1e9; for(const b of s.bodies){ const d=Math.hypot(b.mesh.position.x-(x+.5),b.mesh.position.z-(z+.5)); if(d<bd){bd=d;best=b;} }
  if(best){ best.forage={x:x+.5,y:y+.6,z:z+.5,until:(performance.now()/1000)+0.5}; }
  burst(x+.5,y+.6,z+.5,[1,.9,.45],8,2.0,1.6,.4);
  if(typeof SFX!=='undefined'&&SFX.coin) SFX.coin();
}
let moteAccLocal=0, moteBurstCdLocal=0;
function tickSoloMote(now){
  if(typeof hp==='undefined') return;
  const mx=maxHp(), dtS=Math.min(0.1,(now-(tickSoloMote._last||now))/1000); tickSoloMote._last=now;
  const lvl=familiarPowerLevel('mote');
  if(hp<mx){ moteAccLocal+=dtS*FAMILIAR_SYSTEM.moteRegen(lvl); const whole=Math.floor(moteAccLocal);
    if(whole>0){ moteAccLocal-=whole; hp=Math.min(mx,hp+whole); refreshHUD&&refreshHUD(); } }
  if(famTier(lvl)>=FAMILIAR_SYSTEM.MOTE_BURST_MIN_TIER && hp<mx && now>=moteBurstCdLocal && nearestHostile(player.pos.x,player.pos.z,FAMILIAR_SYSTEM.MOTE_BURST_RANGE)){
    moteBurstCdLocal=now+FAMILIAR_SYSTEM.moteBurstCooldown(lvl); moteBloomReadyAt=moteBurstCdLocal; hp=Math.min(mx, hp+FAMILIAR_SYSTEM.moteBurst(lvl)); refreshHUD&&refreshHUD();
    burst(player.pos.x,player.pos.y+1,player.pos.z,[.6,1,.5],18,2.2,2.4,.55);
  }
}
// Fang behaves like a dog: heels behind its owner, trots to keep up, sprints to attack, settles when idle.
let fangWhineCd=0;
function tickFangPack(s,o,n,dt,t,local){
  const fwx=-Math.sin(o.yaw), fwz=-Math.cos(o.yaw), rgx=Math.cos(o.yaw), rgz=-Math.sin(o.yaw);
  const tgt=nearestHostile(o.x,o.z,12), mp=tgt&&tgt.grp.position;
  for(let i=0;i<s.bodies.length;i++){
    const b=s.bodies[i], p=b.mesh.position;
    let dx,dz, chase=!!mp;
    if(mp){ const ang=t*2+i*2.4; dx=mp.x+Math.cos(ang)*0.95; dz=mp.z+Math.sin(ang)*0.95; }   // circle/harry the target
    else { const side=(i-(n-1)/2)*0.85; dx=o.x - fwx*1.5 + rgx*side; dz=o.z - fwz*1.5 + rgz*side; }  // heel behind owner
    if(Math.hypot(dx-p.x,dz-p.z)>14){ p.set(dx,o.y,dz); b.gy=o.y; }   // warp in on spawn / owner teleport
    const ddx=dx-p.x, ddz=dz-p.z, dist=Math.hypot(ddx,ddz);
    const maxSpd = chase?9.5 : dist>2.4?7.5 : dist>0.7?3.4 : 0;       // sprint / trot / amble / stand
    let moved=0;
    if(maxSpd>0 && dist>1e-3){ const step=Math.min(dist, maxSpd*dt); p.x+=ddx/dist*step; p.z+=ddz/dist*step; moved=step; }
    b.gy = (b.gy==null?o.y:b.gy) + (o.y-(b.gy==null?o.y:b.gy))*Math.min(1,dt*8);   // ground follow, kept apart from rest pose
    const spd=moved/Math.max(dt,1e-3);
    if(chase || spd>0.35) b.idle=0; else b.idle=(b.idle||0)+dt;      // settled-at-heel time
    // face movement, target, or owner's heading (when sitting, look the owner's way)
    const fcx = moved>1e-3? ddx : (chase? mp.x-p.x : -fwx), fcz = moved>1e-3? ddz : (chase? mp.z-p.z : -fwz);
    if(Math.abs(fcx)+Math.abs(fcz)>1e-3){ const want=Math.atan2(fcx,fcz); b.mesh.rotation.y += angDiff(want,b.mesh.rotation.y)*Math.min(1,dt*12); }
    b.gait=(b.gait||0)+spd*dt*3.4;
    const wasSit=(b.sit||0)>0.5;
    animateFang(b, Math.min(1,spd/6), t, chase, dt);
    if(local && !wasSit && (b.sit||0)>0.5 && t*1000>fangWhineCd){ fangWhineCd=t*1000+9000; if(typeof SFX!=='undefined'&&SFX.whine) SFX.whine(); }
  }
}
function tickPetFollow(s,o,n,dt,t,local){
  const fwx=-Math.sin(o.yaw), fwz=-Math.cos(o.yaw), rgx=Math.cos(o.yaw), rgz=-Math.sin(o.yaw);
  for(let i=0;i<s.bodies.length;i++){
    const b=s.bodies[i], p=b.mesh.position, petKind=b.mesh.userData&&b.mesh.userData.petKind||s.kind;
    const side=petKind==='cat'?.75:petKind==='wolf'?-1.0:-.75;
    const back=petKind==='cat'?1.0:petKind==='wolf'?1.75:1.35;
    const tx=o.x - fwx*back + rgx*side, tz=o.z - fwz*back + rgz*side, ty=o.y;
    if(Math.hypot(tx-p.x,tz-p.z)>14){ p.set(tx,ty,tz); b.gy=ty; }
    const dx=tx-p.x,dz=tz-p.z,dist=Math.hypot(dx,dz),speed=dist>2.4?7.2:dist>0.6?3.0:0;
    let moved=0;
    if(speed>0 && dist>1e-3){ const step=Math.min(dist,speed*dt); p.x+=dx/dist*step; p.z+=dz/dist*step; moved=step; }
    b.gy=(b.gy==null?ty:b.gy)+(ty-(b.gy==null?ty:b.gy))*Math.min(1,dt*8);
    b.mesh.position.y=b.gy;
    const spd=moved/Math.max(dt,1e-3);
    b.idle=spd>0.3?0:(b.idle||0)+dt;
    const fcx=moved>1e-3?dx:-fwx, fcz=moved>1e-3?dz:-fwz;
    if(Math.abs(fcx)+Math.abs(fcz)>1e-3){ const want=Math.atan2(fcx,fcz); b.mesh.rotation.y += angDiff(want,b.mesh.rotation.y)*Math.min(1,dt*10); }
    b.gait=(b.gait||0)+spd*dt*3.5;
    animateFang(b,Math.min(1,spd/5.5),t,false,dt);
    if(local && petKind==='cat' && Math.random()<dt*.08) spawnParticle({x:p.x,y:p.y+.55,z:p.z,vx:(Math.random()-.5)*.08,vy:.18,vz:(Math.random()-.5)*.08,life:.55,grav:-.2,r:.6,g:.85,b:.42});
  }
}
function animateFang(b, run, t, chase, dt){
  const u=b.mesh.userData, d=Math.min(0.05,dt||0.016);
  // settle: sit after a couple idle seconds, lie down after a long rest
  const wantSit = (!chase && (b.idle||0)>2.5) ? 1 : 0;
  b.sit = (b.sit||0) + (wantSit-(b.sit||0))*Math.min(1,d*6);
  const wantLie = (!chase && (b.idle||0)>8) ? 1 : 0;
  b.lie = (b.lie||0) + (wantLie-(b.lie||0))*Math.min(1,d*3);
  if(b.snap>0) b.snap=Math.max(0,b.snap-d);
  const snap = b.snap>0 ? Math.sin((1-b.snap/0.28)*Math.PI) : 0;   // 0 -> 1 -> 0 over the bite
  // posture: rump-down sit tilt, easing flatter when lying; lunge dips forward on a bite
  b.mesh.rotation.x = b.sit*0.5*(1-b.lie) - b.lie*0.06 - snap*0.32;
  b.mesh.position.y = (b.gy!=null?b.gy:0) - b.lie*0.16;
  if(u.legs){
    const sw=Math.sin(b.gait)*0.7*Math.max(.04,run)*(1-b.sit);
    u.legs[0].rotation.x= sw + b.sit*0.18 + snap*0.45; u.legs[1].rotation.x= sw + b.sit*0.18 + snap*0.45;  // front
    u.legs[2].rotation.x=-sw - b.sit*0.55;             u.legs[3].rotation.x=-sw - b.sit*0.55;              // rear tucked
  }
  if(u.tail) u.tail.rotation.y=Math.sin(t*(run>0.15?12:(b.sit>0.5?6:5))+b.phase)*0.55;
  if(u.body) u.body.position.y=u.body.userData.base + Math.abs(Math.sin(b.gait))*0.05*run;
  if(u.head) u.head.rotation.x = -0.04 + Math.sin(b.gait*0.5)*0.05*run - snap*0.5 + b.sit*0.12 - b.lie*0.22;
}
// snap the nearest Fang body forward and bark when it bites
function fangSnap(x,z,count=1){
  const nearby=[];
  for(const k in familiarRender){ const r=familiarRender[k]; if(r.kind!=='fang') continue;
    for(const b of r.bodies)nearby.push({b,d:Math.hypot(b.mesh.position.x-x,b.mesh.position.z-z)}); }
  nearby.sort((a,b)=>a.d-b.d);
  let snapped=0; for(const entry of nearby){if(entry.d>=6||snapped>=count)break;entry.b.snap=.28+snapped*.05;entry.b.idle=0;snapped++;}
  if(snapped&&typeof SFX!=='undefined'&&SFX.bark)SFX.bark();
}
// Shade swarms in a loose, weaving orbit of wraiths with pulsing eyes and swaying tatters.
function tickShadeSwarm(s,o,n,dt,t,local){
  for(let i=0;i<s.bodies.length;i++){
    const b=s.bodies[i], a=t*0.45+b.phase+i*(Math.PI*2/Math.max(1,n));
    const rad=1.45+0.35*Math.sin(t*0.7+b.phase*1.3);
    const tx=o.x+Math.cos(a)*rad, tz=o.z+Math.sin(a)*rad, ty=o.y+0.15+Math.sin(t*1.5+b.phase)*0.18, p=b.mesh.position;
    if(Math.hypot(tx-p.x,tz-p.z)>14){ p.set(tx,ty,tz); }   // warp in on spawn / owner teleport
    p.x+=(tx-p.x)*Math.min(1,dt*4); p.y+=(ty-p.y)*Math.min(1,dt*4); p.z+=(tz-p.z)*Math.min(1,dt*4);
    b.mesh.rotation.y=forwardFacingYaw(-Math.sin(a), -Math.cos(a))+Math.sin(t*0.9+b.phase)*0.25;
    const u=b.mesh.userData;
    if(u.eyes) u.eyes.opacity=0.55+0.45*Math.abs(Math.sin(t*2.2+b.phase));
    if(u.wisps) for(let w=0;w<u.wisps.length;w++) u.wisps[w].rotation.z=Math.sin(t*3+w*1.3+b.phase)*0.28;
    const br=1+0.04*Math.sin(t*1.7+b.phase); b.mesh.scale.set(br,br,br);
  }
  if(local)tickShadeChargeMarkers(s,o,t);
}
function tickShadeChargeMarkers(s,o,t){
  const max=FAMILIAR_SYSTEM.shadeStepCharges(o.lvl); if(!s.chargeMarkers)s.chargeMarkers=[];
  while(s.chargeMarkers.length<max){
    const marker=new THREE.Mesh(new THREE.TorusGeometry(.22,.035,6,18),new THREE.MeshBasicMaterial({color:0xb86cff,transparent:true,opacity:.8,depthWrite:false}));
    marker.rotation.x=Math.PI/2;s.grp.add(marker);s.chargeMarkers.push(marker);
  }
  while(s.chargeMarkers.length>max){const marker=s.chargeMarkers.pop();s.grp.remove(marker);}
  const available=shadeAvailableCharges();
  for(let i=0;i<s.chargeMarkers.length;i++){
    const marker=s.chargeMarkers[i],a=t*.7+i*Math.PI*2/Math.max(1,max);
    marker.position.set(o.x+Math.cos(a)*.72,o.y+.08,o.z+Math.sin(a)*.72);
    marker.material.opacity=i<available?.85:.12; marker.scale.setScalar(1+.12*Math.sin(t*3+i));
  }
}
let fangCdLocal=0;
function tickSoloFang(now){
  if(now<fangCdLocal) return;
  const tgt=nearestHostile(player.pos.x,player.pos.z,FAMILIAR_SYSTEM.FANG_RANGE);
  if(!tgt) return;
  const lvl=familiarPowerLevel('fang'), strikes=FAMILIAR_SYSTEM.fangStrikes(lvl);
  fangCdLocal=now+FAMILIAR_SYSTEM.fangCooldown(lvl);
  damageMob(tgt, fangDamage(lvl)*strikes);
  burst(tgt.grp.position.x, tgt.grp.position.y+0.8, tgt.grp.position.z, [.7,.6,.5], 5, 1.6, 1.1, .25);
  fangSnap(tgt.grp.position.x, tgt.grp.position.z,strikes);
}
const SHADE_THREAT_LINES=[
  'Shade murmurs: something hunts nearby.',
  'Shade murmurs: eyes in the dark — be ready.',
  'Shade murmurs: company approaches, and not the polite sort.',
  'Shade murmurs: I count more shadows than there should be.',
];
const SHADE_IDLE_LINES=[
  'Shade murmurs: the dark is patient. So am I.',
  'Shade murmurs: I am watching the things that watch you.',
  'Shade murmurs: rest if you must. I do not.',
];
const SHADE_RANK_LINES={
  3:  'Shade murmurs: "I am three, now. Less will slip past us."',
  7:  'Shade murmurs: "I am seven, now — the road between shadows is open to you." <i>(shadow-step: N)</i>',
  31: 'Shade murmurs: "Thirty-one. The dark grows crowded, in your favor."',
  211:'Shade murmurs: "Two hundred and eleven. I am... abundant."',
};
let shadeAnnouncedRank=0;
function shadeAnnounceRank(){
  const r=shadeRankCount((S&&S.lvl)||1);
  if(r>shadeAnnouncedRank){
    if(shadeAnnouncedRank>0 && SHADE_RANK_LINES[r]) sysMsg(SHADE_RANK_LINES[r]);   // grew during play
    shadeAnnouncedRank=r;
  }
}
let shadeWarnCd=0, shadeIdleAt=0, shadeThreatSeen=false;
function tickWatchfulShade(now){
  if(activeFamiliar!=='shade'){ shadeThreatSeen=false; return; }
  shadeAnnounceRank();
  let threat=false;
  for(const m of mobs){ if(isAnimalKind(m.kind)) continue;
    if(Math.hypot(m.grp.position.x-player.pos.x, m.grp.position.z-player.pos.z)<16){ threat=true; break; } }
  if(threat && !shadeThreatSeen && now>shadeWarnCd){
    shadeWarnCd=now+12000; shadeIdleAt=now+45000;
    sysMsg(SHADE_THREAT_LINES[(Math.random()*SHADE_THREAT_LINES.length)|0]);
    if(typeof SFX!=='undefined'&&SFX.whisper) SFX.whisper();
  }
  shadeThreatSeen=threat;
  if(!threat && now>shadeIdleAt){ shadeIdleAt=now+90000+Math.random()*60000; sysMsg(SHADE_IDLE_LINES[(Math.random()*SHADE_IDLE_LINES.length)|0]); if(typeof SFX!=='undefined'&&SFX.whisper) SFX.whisper(); }
}
function familiarSummonFx(kind){
  if(kind==='shade'){
    burst(player.pos.x, player.pos.y+1, player.pos.z, [.45,.2,.7], 18, 2.2, 2.4, .55);
    shadeAnnouncedRank=shadeRankCount((S&&S.lvl)||1);   // baseline so only later growth speaks up
    const greet=shadeAnnouncedRank>1 ? ' We are '+shadeAnnouncedRank+'.' : '';
    sysMsg('Shade unfurls from your shadow. <i>"At your service.'+greet+'"</i>');
    shadeIdleAt=performance.now()+45000;
  } else if(kind==='fang'){
    burst(player.pos.x, player.pos.y+0.6, player.pos.z, [.55,.4,.3], 14, 2.0, 1.6, .45);
    sysMsg('<b>Fang</b> pads to your side, hackles raised.');
  } else if(kind==='mote'){
    burst(player.pos.x, player.pos.y+1, player.pos.z, [.55,1,.38], 22, 2.2, 2.1, .65);
    healingPlusVfx(player.pos.x,player.pos.y+.1,player.pos.z,.75,.75);
    if(typeof SFX!=='undefined'&&SFX.cast) SFX.cast();
    sysMsg('<b>Mote</b> blooms into a warm orbit around you.');
  } else if(kind==='sprite'){
    burst(player.pos.x, player.pos.y+1, player.pos.z, [1,.85,.3], 24, 2.8, 2.5, .55);
    if(typeof SFX!=='undefined'&&SFX.coin) SFX.coin();
    sysMsg('<b>Sprite</b> darts from the charm, already searching for overlooked treasure.');
  } else if(kind==='cat'){
    burst(player.pos.x, player.pos.y+.55, player.pos.z, [.62,.84,.45], 14, 1.6, 1.2, .35);
    sysMsg('<b>Cat</b> slips to your side. Soft Paws reduces fall damage.');
  } else if(kind==='dog'){
    burst(player.pos.x, player.pos.y+.55, player.pos.z, [1,.64,.28], 14, 1.6, 1.2, .35);
    if(typeof SFX!=='undefined'&&SFX.bark) SFX.bark();
    sysMsg('<b>Dog</b> trots beside you. Trail Nose can find extra meat from animals.');
  } else if(kind==='wolf'){
    burst(player.pos.x, player.pos.y+.65, player.pos.z, [.55,.82,1], 16, 1.8, 1.3, .4);
    sysMsg('<b>Wolf</b> joins the hunt. Hunter Howl grants bonus XP from hostile kills.');
  }
  familiarIdleAt=performance.now()+90000+Math.random()*45000;
}
function familiarDismissFx(kind){
  const col=kind==='shade'?[.45,.2,.7]:kind==='fang'?[.55,.4,.3]:kind==='mote'?[.55,1,.38]:kind==='cat'?[.62,.84,.45]:kind==='dog'?[1,.64,.28]:kind==='wolf'?[.55,.82,1]:[1,.85,.3];
  burst(player.pos.x,player.pos.y+.8,player.pos.z,col,12,1.5,1.4,.35);
}
let familiarTutorialKind='';
function familiarTutorialDone(){
  try{return localStorage.getItem('bc_familiar_tutorial_v1')==='1';}catch(e){return false;}
}
function showFamiliarTutorial(kind){
  if(familiarTutorialDone()||typeof onboardingActive!=='undefined'&&onboardingActive)return;
  familiarTutorialKind=kind;
  const el=document.getElementById('tutorialhud'); if(!el)return;
  const role=kind==='shade'?'guard you':kind==='fang'?'hunt beside you':kind==='mote'?'restore your health':kind==='sprite'?'find bonus drops':kind==='cat'?'soften rough landings':kind==='dog'?'help animal hunts':'strengthen hostile hunts';
  el.innerHTML='<div class="tutpill">Familiar bond</div><div class="tutkey">K</div><div class="tuttext">Call '+FAMILIARS[kind].name+' to '+role+'</div><div class="tutsub">Open Dragon Bonds with B to see Bond XP, daily challenge, and upgrades.</div>';
  el.classList.remove('hidden');
}
function finishFamiliarTutorial(kind){
  if(!familiarTutorialKind||kind!==familiarTutorialKind)return;
  familiarTutorialKind='';
  const el=document.getElementById('tutorialhud'); if(el)el.classList.add('hidden');
  try{localStorage.setItem('bc_familiar_tutorial_v1','1');}catch(e){}
  if(NET.on&&NET.room)NET.room.send('tutorialComplete',{tutorial:'familiar',version:1});
  const extra=kind==='shade'?' At Bond Tier 3, press <b>N</b> for Dark Passage.':'';
  sysMsg('<b>Familiar ready.</b> Its live effect appears in the lower-right bond panel.'+extra);
}
function setFamiliar(kind){
  if(kind===activeFamiliar) return;
  if(kind && !familiarUnlocks.includes(kind)){ sysMsg('You have not bound that familiar'); return; }
  const previous=activeFamiliar;
  activeFamiliar=kind||'';
  if(NET.on&&NET.room) NET.room.send(kind?'summonFamiliar':'dismissFamiliar', kind?{kind}:{});
  if(kind) familiarSummonFx(kind);
  else { familiarDismissFx(previous); sysMsg('Your familiar fades away.'); }
  if(kind)finishFamiliarTutorial(kind);
}
function cycleFamiliar(target){                  // K cycles; menus may request one bound familiar directly
  if(typeof target==='string') return setFamiliar(target);
  const order=familiarUnlocks.filter(k=>FAMILIARS[k]);
  if(!order.length){ sysMsg('Bind a familiar first — e.g. a <b>Shadow Sigil</b> or <b>Fang Totem</b>'); return; }
  if(!activeFamiliar) return setFamiliar(order[0]);
  const next=order.indexOf(activeFamiliar)+1;
  setFamiliar(next>=order.length ? '' : order[next]);
}
const FAMILIAR_HUD={ shade:{color:'#b86cff',role:'Guardian'}, fang:{color:'#ffcf4a',role:'Hound'}, mote:{color:'#8fe06a',role:'Healer'}, sprite:{color:'#ffe27a',role:'Forager'}, cat:{color:'#9ad26b',role:'Soft Paws'}, dog:{color:'#ff9a42',role:'Trail Nose'}, wolf:{color:'#8bd7ff',role:'Hunter Howl'} };
let famHudSig='', shadeStepPendingUntil=0, shadeStepCharges=0, shadeStepMaxCharges=0, shadeStepChargeUpdatedAt=0;
function shadeAvailableCharges(){
  const max=shadeStepMaxCharges||FAMILIAR_SYSTEM.shadeStepCharges((S&&S.lvl)||1);
  if(!shadeStepChargeUpdatedAt)return max;
  return Math.min(max,shadeStepCharges+Math.floor((performance.now()-shadeStepChargeUpdatedAt)/FAMILIAR_SYSTEM.SHADE_STEP_CD_MS));
}
function updateFamiliarHUD(){
  const el=document.getElementById('familiarhud'); if(!el) return;
  const def=FAMILIAR_HUD[activeFamiliar];
  if(!def){ if(!el.classList.contains('hidden')){ el.classList.add('hidden'); famHudSig=''; } return; }
  const k=activeFamiliar, lvl=familiarPowerLevel(k), tier=famTier(lvl), xp=familiarXp[k]||0;
  let rank, stat;
  if(k==='shade'){ const rc=shadeRankCount(lvl); rank='×'+rc; stat='Guarding −'+Math.round(FAMILIAR_SYSTEM.shadeMitigation(lvl)*100)+'% dmg'; }
  else if(k==='fang'){ const c=fangBodyCount(lvl); rank=c+(c>1?' hounds':' hound'); stat=FAMILIAR_SYSTEM.fangStrikes(lvl)+'× bite '+fangDamage(lvl); }
  else if(k==='mote'){ rank='×'+moteBodyCount(lvl); stat='Regen +'+FAMILIAR_SYSTEM.moteRegen(lvl).toFixed(1)+'/s'+(tier>=FAMILIAR_SYSTEM.MOTE_BURST_MIN_TIER?' · burst':''); }
  else { rank='×'+spriteBodyCount(lvl); stat='Forage '+Math.round(spriteForageChance(lvl)*100)+'% · +'+FAMILIAR_SYSTEM.spriteBonusDrops(lvl); }
  if(k==='cat'){ rank='pet'; stat='Fall damage -'+Math.round(FAMILIAR_SYSTEM.catFallMitigation(lvl)*100)+'%'; }
  else if(k==='dog'){ rank='pet'; stat='Extra meat '+Math.round(FAMILIAR_SYSTEM.dogExtraMeatChance(lvl)*100)+'%'; }
  else if(k==='wolf'){ rank='pet'; stat='Hostile XP +'+Math.round(FAMILIAR_SYSTEM.wolfHostileXpBonus(lvl)*100)+'%'; }
  const multi=familiarUnlocks.filter(x=>FAMILIARS[x]).length>1;
  const sig=k+'|'+rank+'|'+stat+'|'+multi+'|'+xp;
  el.classList.remove('hidden');
  if(sig===famHudSig){ updateShadeStepHud(el); return; }
  famHudSig=sig;
  el.style.borderColor=def.color+'88';
  const shadeCanStep=k==='shade'&&famTier(lvl)>=FAMILIAR_SYSTEM.SHADE_STEP_MIN_TIER;
  el.innerHTML='<div class="fhead"><span class="fdot" style="background:'+def.color+';color:'+def.color+'"></span>'+FAMILIARS[k].name+
    '<span class="frole">'+def.role+'</span></div><div class="fstat">'+stat+' · '+rank+'</div>'+
    '<div class="fstat">Bond XP '+xp+(tier<4?' / '+FAMILIAR_SYSTEM.BOND_XP_THRESHOLDS[tier+1]:' · MAX TIER')+'</div>'+(
    shadeCanStep?'<div class="fcd"><i></i></div><div class="fcdlabel"></div>':'')+(multi?'<div class="fhint">K — cycle</div>':'');
  updateShadeStepHud(el);
}
let shadeStepCd=0;
function updateShadeStepHud(el){
  const fill=el&&el.querySelector('.fcd i'), label=el&&el.querySelector('.fcdlabel');
  if(!fill||!label) return;
  const now=performance.now(), pending=now<shadeStepPendingUntil, remain=Math.max(0,shadeStepCd-now);
  fill.style.width=(pending?100:Math.min(100,remain/FAMILIAR_SYSTEM.SHADE_STEP_CD_MS*100))+'%';
  const max=shadeStepMaxCharges||FAMILIAR_SYSTEM.shadeStepCharges(familiarPowerLevel('shade'));
  const charges=shadeAvailableCharges();
  label.textContent=pending?'N · CONTACTING SHADE':remain>0?'N · '+charges+'/'+max+' · '+(remain/1000).toFixed(1)+'s':'N · '+charges+'/'+max+' SHADOW JUMPS';
}
function applyShadeStepResult(m){
  if(!m) return;
  player.pos.x=Number(m.x)||0; player.pos.y=Number(m.y)||0; player.pos.z=Number(m.z)||0;
  shadeStepPendingUntil=0;
  shadeStepCharges=Math.max(0,Number(m.charges)||0); shadeStepMaxCharges=Math.max(0,Number(m.maxCharges)||0); shadeStepChargeUpdatedAt=performance.now()-Math.max(0,FAMILIAR_SYSTEM.SHADE_STEP_CD_MS-(Number(m.rechargeCd)||FAMILIAR_SYSTEM.SHADE_STEP_CD_MS));
  shadeStepCd=performance.now()+Math.max(0,Number(m.cd)||0);
}
function applyShadeStepReject(m){
  shadeStepPendingUntil=0;
  if(m&&m.reason==='cooldown'){ shadeStepCharges=Math.max(0,Number(m.charges)||0); shadeStepMaxCharges=Math.max(0,Number(m.maxCharges)||shadeStepMaxCharges); shadeStepChargeUpdatedAt=performance.now(); shadeStepCd=performance.now()+Math.max(0,Number(m.cd)||0); }
}
function shadowStep(){                          // Dark Passage: blink through shadow in your facing direction
  if(activeFamiliar!=='shade'){ sysMsg('Call <b>Shade</b> first (K)'); return; }
  if(famTier(familiarPowerLevel('shade')) < FAMILIAR_SYSTEM.SHADE_STEP_MIN_TIER){ sysMsg('Shade murmurs: "Our bond is not yet deep enough to carry you."'); return; }
  const now=performance.now();
  if(now<shadeStepCd){ return; }
  const d=viewDir(false);
  if(NET.on&&NET.room){ shadeStepPendingUntil=now+1200; NET.room.send('shadeStep',{x:d.x,z:d.z}); return; }
  shadeStepCd=now+FAMILIAR_SYSTEM.SHADE_STEP_CD_MS;
  const start={x:player.pos.x,y:player.pos.y,z:player.pos.z};
  const steps=Math.ceil(FAMILIAR_SYSTEM.shadeStepDistance(familiarPowerLevel('shade'))/.24);
  for(let st=0;st<steps;st++){ moveAxis('x', d.x*.24); moveAxis('z', d.z*.24); }
  shadowDashVfx(start,{x:player.pos.x,y:player.pos.y,z:player.pos.z});
  camShake=Math.max(camShake,.16);
  if(typeof SFX!=='undefined' && SFX.cast) SFX.cast();
}
function bindFamiliarItem(slot=selected){
  const s=inv[slot], kind=s&&FAMILIAR_BY_SIGIL[s.id];
  if(!kind) return false;
  if(familiarUnlocks.includes(kind)){ sysMsg('<b>'+FAMILIARS[kind].name+'</b> is already bound to you'); return true; }
  if(NET.on&&NET.room){ NET.room.send('bindFamiliar',{kind,slot}); return true; }   // server consumes + replies
  s.count--; if(s.count<=0) inv[slot]=null; refreshHUD(); if(uiOpen) renderUI();
  familiarBoundLocal(kind);
  return true;
}
function familiarBoundLocal(kind){
  if(!FAMILIARS[kind]) return;
  if(!familiarUnlocks.includes(kind)) familiarUnlocks.push(kind);
  burst(player.pos.x, player.pos.y+1, player.pos.z, [.55,.25,.85], 28, 2.8, 3.0, .7);
  if(typeof SFX!=='undefined' && SFX.boom) SFX.boom();
  sysMsg('<b>'+FAMILIARS[kind].name+'</b> is bound to you. Press <b>K</b> to call'+(familiarUnlocks.length>1?' / cycle familiars':'')+'.');
  showFamiliarTutorial(kind);
  questSystemCheck();
}

function makeRemoteAvatar(look){
  look=look||playerAppearance();
  const grp=new THREE.Group(), legs=[], arms=[], hair=[], blink=[], idle=[], aegisGlow=[];
  const armorId=look.armorId|0;
  const armorType=gearSystem.ARMOR_ARCHETYPES[look.armorType]
    ?look.armorType:(armorId===137?'aegis':armorId===184?'bulwark':armorId?'vanguard':'');
  const hasArmor=armorId>0;
  const isScout=hasArmor&&armorType==='scout';
  const isVanguard=hasArmor&&armorType==='vanguard';
  const isBulwark=hasArmor&&armorType==='bulwark';
  const hasAegis=hasArmor&&armorType==='aegis';
  const hasDiaArmor=(look.armorId|0)===184;
  const heldKind=equipmentKind(look.heldId);
  const hasCartographerMantle=Array.isArray(look.cosmetics)&&look.cosmetics.includes('cartographers_mantle');
  const skinM=voxelMats(look.skin, shadeHex(look.skin,18), look.skinDark, look.skinShadow);
  const faceM=lam(faceTexture(look));
  const hairM=voxelMats(look.hair, look.hairLight, look.hairDark, look.hairDark);
  const shirtM=voxelMats(look.shirt, look.shirtLight, look.shirtDark, look.shirtShadow);
  const shirtDarkM=voxelMats(look.shirtDark, look.shirt, look.shirtShadow, look.shirtShadow);
  const trimM=voxelMats(look.trim, shadeHex(look.trim,28), shadeHex(look.trim,-38), shadeHex(look.trim,-52));
  const pantsM=voxelMats(look.pants, shadeHex(look.pants,20), look.pantsDark, look.pantsDark);
  const bootM=voxelMats(look.boot, look.bootLight, '#141010', '#0c0909');
  const soleM=voxelMats('#f0e4d4','#ffffff','#7a6a62','#4c4040');
  const beltM=voxelMats(look.belt, '#8a5a2c', '#3a2412', '#2a180c');
  const scarfM=voxelMats(look.scarf, shadeHex(look.scarf,24), shadeHex(look.scarf,-38), shadeHex(look.scarf,-52));
  const packM=voxelMats('#5a3a20','#7a5230','#302010','#25170c');
  const packDarkM=voxelMats('#3a2412','#5a3a20','#1e1208','#160d06');
  const bladeM=voxelMats('#c8c8d8','#eeeeff','#74788c','#5c6074');
  const pickM=voxelMats('#8d96a6','#dce3f0','#4d5564','#343a46');
  const guardM=voxelMats('#b8862d','#f0c96a','#6e4a14','#4c320c');
  const metalM=voxelMats(look.beltBuckle,'#f0c96a','#8a6424','#6e4a14');
  const ironArmorM=voxelMats('#8b95a5','#e5e7eb','#586170','#38404c');
  const diaArmorM=voxelMats('#0e7490','#67e8f9','#155e75','#083344');
  const scoutArmorM=voxelMats('#3b805d','#91e0ae','#24513b','#173528');
  const bulwarkArmorM=hasDiaArmor?diaArmorM:voxelMats('#536176','#aebdd0','#303948','#202733');
  const aegisM=voxelMats('#d0a348','#fff099','#8a6424','#5a3c12');
  const aegisTrimM=voxelMats('#9b6be8','#c8a8ff','#5b3a90','#342050');
  const aegisGlowM=glowVoxelMats('#ffd24a','#fff4a8','#b8862d','#ffd24a',.85);
  const aegisRuneM=glowVoxelMats('#9b6be8','#dbc4ff','#5b3a90','#b86cff',1.15);
  const voidM=glowVoxelMats('#171020','#372050','#050308','#8b5cff',.7);
  const voidCoreM=glowVoxelMats('#08040f','#180820','#000000','#b86cff',1.25);
  const chronoM=glowVoxelMats('#36d6d0','#b8fff9','#12706c','#53fff6',1.1);
  const meteorM=glowVoxelMats('#ff5a16','#ffd24a','#7a1608','#ff7a1a',1.15);
  const titanM=voxelMats('#8d8172','#c9b9a2','#4a3b2c','#30251c');
  const soulM=glowVoxelMats('#5b1f78','#c084fc','#251032','#c084fc',1.05);
  const gravityM=glowVoxelMats('#284160','#7dd3fc','#132234','#d8b4fe',1.0);
  const wardenM=glowVoxelMats('#0f2f35','#35d0c8','#061a1e','#78fff2',1.05);
  const eclipseM=glowVoxelMats('#1c1028','#9b5cff','#07030c','#b86cff',1.1);
  const phoenixM=glowVoxelMats('#ff5a16','#ffd24a','#8b1a10','#ff7a1a',1.15);
  const frostM=glowVoxelMats('#79d7ff','#e8fbff','#3b82f6','#9bdcff',1.05);
  const midasM=glowVoxelMats('#b8860b','#ffd24a','#7c5b12','#fff0a8',1.05);
  const leviathanM=glowVoxelMats('#145ea8','#7dd3fc','#0f2e55','#dbeafe',1.1);
  const eyeM=voxelMats('#083b42','#1b7d86','#031d22','#021418');
  const browM=voxelMats(look.hairDark,look.hair,look.hairDark,look.hairDark);
  const mouthM=voxelMats('#6a352d','#8a4a3e','#3a1a16','#2a100e');
  const cheekM=voxelMats('#d99568','#e8aa7d','#9f6546','#865139');
  const gloveM=voxelMats('#3a2a1e','#523a28','#241710','#180e08');
  const tabardM=voxelMats(look.scarf, shadeHex(look.scarf,22), shadeHex(look.scarf,-42), shadeHex(look.scarf,-56));
  const capeM=hasAegis?voxelMats('#46286f','#6e46b0','#281544','#190d2b')
                      :voxelMats(look.scarf, shadeHex(look.scarf,16), shadeHex(look.scarf,-44), shadeHex(look.scarf,-58));
  const capeTrimM=voxelMats('#caa23e','#f4d27a','#8a6a1e','#5e4712');
  const gemM=glowVoxelMats('#33dcff','#c4f6ff','#1888ad','#33dcff',1.2);
  const cartoClothM=voxelMats('#1f5f78','#55c7d8','#123949','#0b2530');
  const cartoLightM=voxelMats('#72d7c7','#d8fff4','#2a8b84','#14545a');
  const cartoGoldM=glowVoxelMats('#d6a642','#fff0a8','#8a6424','#ffd24a',.65);
  const cartoInkM=voxelMats('#173044','#2f5f7a','#071722','#050d14');

  const head=new THREE.Mesh(new THREE.BoxGeometry(.5,.5,.5),[skinM[0],skinM[1],skinM[2],skinM[3],faceM,skinM[5]]);
  head.position.y=1.72; grp.add(head);
  hair.push(addBox(head,[.54,.09,.54],[0,.3,0],hairM));       // blond top hair cap
  hair.push(addBox(head,[.16,.08,.1],[-.22,.2,-.25],hairM));  // separated fringe chunks
  hair.push(addBox(head,[.11,.105,.1],[-.04,.18,-.255],hairM));
  hair.push(addBox(head,[.09,.065,.08],[.13,.22,-.25],hairM));
  hair.push(addBox(head,[.08,.05,.08],[.25,.18,-.25],hairM));
  addBox(head,[.08,.035,.08],[-.22,.255,-.27],voxelMats(look.hairLight,'#fff7b8',look.hair,look.hairDark)); // top highlights
  addBox(head,[.09,.03,.08],[.06,.255,-.27],voxelMats(look.hairLight,'#fff7b8',look.hair,look.hairDark));
  addBox(head,[.36,.035,.09],[0,.135,-.265],browM);           // hair shadow under fringe
  hair.push(addBox(head,[.085,.3,.17],[-.29,-.02,.02],hairM)); // side hair depth
  hair.push(addBox(head,[.085,.28,.17],[.29,-.01,.02],hairM));
  hair.push(addBox(head,[.42,.16,.1],[0,.08,.31],hairM));     // layered back hair, not one slab
  hair.push(addBox(head,[.34,.14,.11],[0,-.08,.32],hairM));
  hair.push(addBox(head,[.13,.11,.12],[-.13,-.19,.33],hairM));
  hair.push(addBox(head,[.13,.1,.12],[.13,-.19,.33],hairM));
  addBox(head,[.14,.06,.08],[0,-.03,.38],trimM);              // small rear ribbon/accent
  if(hasAegis){
    const aura=new THREE.Sprite(new THREE.SpriteMaterial({
      map:new THREE.CanvasTexture(glowTexCanvas), color:0xffd24a, transparent:true,
      opacity:.18, depthWrite:false, depthTest:false, blending:THREE.AdditiveBlending
    }));
    aura.position.y=1.12; aura.scale.set(1.35,2.05,1);
    grp.add(aura); aegisGlow.push(aura);
    const coreAura=new THREE.Sprite(new THREE.SpriteMaterial({
      map:new THREE.CanvasTexture(glowTexCanvas), color:0xb86cff, transparent:true,
      opacity:.12, depthWrite:false, depthTest:false, blending:THREE.AdditiveBlending
    }));
    coreAura.position.y=1.08; coreAura.scale.set(.78,1.35,1);
    grp.add(coreAura); aegisGlow.push(coreAura);

    addBox(head,[.62,.07,.08],[0,.135,-.31],aegisM);           // legendary circlet across the brow
    addBox(head,[.11,.16,.08],[-.3,.035,-.275],aegisM);        // side cheek guards
    addBox(head,[.11,.16,.08],[.3,.035,-.275],aegisM);
    addBox(head,[.1,.09,.09],[0,.22,-.33],aegisRuneM);         // glowing center gem
    addBox(head,[.42,.08,.09],[0,.16,.39],aegisM);             // rear helmet band
  }
  addBox(head,[.1,.045,.032],[-.12,.08,-.274],browM,[0,0,-.08]); // confident eyebrows
  addBox(head,[.1,.045,.032],[.12,.08,-.274],browM,[0,0,.08]);
  blink.push(addBox(head,[.085,.09,.034],[-.11,.002,-.276],eyeM));
  blink.push(addBox(head,[.085,.09,.034],[.11,.002,-.276],eyeM));
  addBox(head,[.05,.065,.03],[0,-.062,-.276],cheekM);         // tiny nose volume
  addBox(head,[.045,.03,.028],[-.18,-.075,-.276],cheekM);     // cheek/shadow pixels
  addBox(head,[.045,.03,.028],[.18,-.075,-.276],cheekM);
  addBox(head,[.13,.045,.032],[0,-.135,-.276],mouthM);

  const torso=new THREE.Group(); torso.position.y=1.08; grp.add(torso);
  idle.push(torso);
  addBox(torso,[.56,.7,.28],[0,0,0],shirtM);
  addBox(torso,[.7,.16,.32],[0,.28,0],shirtDarkM);            // shoulders
  addBox(torso,[.22,.08,.31],[0,.39,-.03],trimM);             // collar trim
  addBox(torso,[.09,.14,.38],[-.28,.36,.04],packDarkM,[.18,0,0]); // strap connector over shoulder
  addBox(torso,[.09,.14,.38],[.28,.36,.04],packDarkM,[.18,0,0]);
  addBox(torso,[.12,.08,.35],[-.37,.3,0],guardM);             // tiny shoulder clip
  addBox(torso,[.12,.08,.35],[.37,.3,0],guardM);
  if(isScout){
    addBox(torso,[.36,.35,.045],[0,.07,-.2],scoutArmorM);
    addBox(torso,[.54,.07,.3],[0,.34,0],scoutArmorM);
    addBox(torso,[.09,.065,.29],[-.34,.35,0],scoutArmorM);
    addBox(torso,[.09,.065,.29],[.34,.35,0],scoutArmorM);
    addBox(torso,[.05,.29,.065],[-.15,.06,-.23],trimM,[0,0,-.18]);
    addBox(torso,[.05,.29,.065],[.15,.06,-.23],trimM,[0,0,.18]);
  } else if(isVanguard){
    const armorM=hasDiaArmor?diaArmorM:ironArmorM;
    addBox(torso,[.44,.48,.065],[0,.03,-.205],armorM);
    addBox(torso,[.7,.13,.34],[0,.34,0],armorM);
    addBox(torso,[.14,.1,.36],[-.42,.35,0],armorM);
    addBox(torso,[.14,.1,.36],[.42,.35,0],armorM);
    addBox(torso,[.18,.09,.075],[0,.09,-.25],metalM,[0,0,.785]);
  } else if(isBulwark){
    addBox(torso,[.58,.61,.1],[0,.01,-.22],bulwarkArmorM);
    addBox(torso,[.9,.2,.43],[0,.39,0],bulwarkArmorM);
    addBox(torso,[.24,.18,.45],[-.5,.4,0],bulwarkArmorM);
    addBox(torso,[.24,.18,.45],[.5,.4,0],bulwarkArmorM);
    addBox(torso,[.38,.12,.35],[0,.42,-.01],ironArmorM);
    addBox(torso,[.48,.08,.08],[0,-.25,-.29],ironArmorM);
    addBox(torso,[.2,.18,.1],[-.19,-.4,-.18],bulwarkArmorM);
    addBox(torso,[.2,.18,.1],[.19,-.4,-.18],bulwarkArmorM);
  }
  if(hasAegis){
    addBox(torso,[.34,.44,.055],[0,.04,-.19],aegisM);          // visible front breastplate
    addBox(torso,[.14,.32,.065],[0,-.02,-.225],aegisTrimM);
    addBox(torso,[.78,.14,.36],[0,.34,0],aegisM);              // golden pauldrons
    addBox(torso,[.16,.1,.38],[-.43,.35,0],aegisTrimM);
    addBox(torso,[.16,.1,.38],[.43,.35,0],aegisTrimM);
  }
  addBox(torso,[.08,.64,.04],[-.12,.0,-.18],trimM);           // front coat trim
  addBox(torso,[.08,.64,.04],[.12,.0,-.18],trimM);
  addBox(torso,[.34,.12,.04],[0,-.36,-.18],trimM);            // tunic split hem
  // layered tabard down the front (richer clothing; sits under the breastplate when armored)
  addBox(torso,[.26,.66,.05],[0,-.02,-.165],tabardM);         // tabard panel
  addBox(torso,[.05,.66,.06],[-.12,-.02,-.17],trimM);         // tabard edge braid
  addBox(torso,[.05,.66,.06],[.12,-.02,-.17],trimM);
  addBox(torso,[.22,.06,.06],[0,.28,-.17],trimM);             // tabard top hem
  addBox(torso,[.26,.12,.05],[0,-.36,-.175],tabardM,[.16,0,0]); // flared tabard skirt
  addBox(torso,[.09,.09,.07],[0,-.04,-.182],metalM);          // chest brooch
  addBox(torso,[.62,.1,.32],[0,-.08,-.01],beltM);             // belt
  addBox(torso,[.12,.12,.34],[0,-.08,-.19],metalM);           // buckle
  addBox(torso,[.5,.1,.3],[0,-.38,0],shirtDarkM);             // tunic hem
  addBox(torso,[.065,.62,.055],[-.23,.04,-.18],packDarkM);    // front shoulder straps
  addBox(torso,[.065,.62,.055],[.23,.04,-.18],packDarkM);
  addBox(torso,[.07,.34,.08],[-.31,.09,.07],packDarkM,[0,0,.16]); // over-shoulder strap turn
  addBox(torso,[.07,.34,.08],[.31,.09,.07],packDarkM,[0,0,-.16]);
  if(hasAegis){
    addBox(torso,[.5,.58,.075],[0,.02,-.245],aegisM);          // bold front chestplate
    addBox(torso,[.34,.2,.06],[0,.21,-.285],aegisM,[-.18,0,0]); // sculpted upper bevel
    addBox(torso,[.24,.34,.085],[0,-.02,-.295],aegisRuneM);    // engraved shield inset
    addBox(torso,[.14,.14,.1],[0,.04,-.355],gemM,[0,0,.785]);  // elegant diamond gem
    addBox(torso,[.05,.5,.095],[-.2,.0,-.335],aegisGlowM);     // slim gold rune rails
    addBox(torso,[.05,.5,.095],[.2,.0,-.335],aegisGlowM);
    addBox(torso,[.46,.06,.085],[0,-.26,-.3],capeTrimM);       // gilded lower band
    addBox(torso,[.18,.12,.085],[-.23,.28,-.285],aegisM);      // upper plate corners
    addBox(torso,[.18,.12,.085],[.23,.28,-.285],aegisM);
    addBox(torso,[.24,.1,.08],[-.18,-.31,-.275],aegisM);       // lower faulds
    addBox(torso,[.24,.1,.08],[.18,-.31,-.275],aegisM);
    addBox(torso,[.86,.18,.42],[0,.42,0],aegisM);              // stronger shoulder silhouette
    addBox(torso,[.22,.13,.44],[-.49,.42,0],aegisRuneM);
    addBox(torso,[.22,.13,.44],[.49,.42,0],aegisRuneM);
    addBox(torso,[.16,.1,.45],[-.49,.52,0],capeTrimM);         // gilded pauldron crest
    addBox(torso,[.16,.1,.45],[.49,.52,0],capeTrimM);
    addBox(torso,[.34,.1,.3],[0,.39,-.02],aegisM);             // gorget (neck plate)
    addBox(torso,[.16,.05,.31],[0,.42,-.06],gemM);             // gorget gem strip
    addBox(torso,[.18,.22,.1],[-.16,-.42,-.16],aegisM);        // hip tassets
    addBox(torso,[.18,.22,.1],[.16,-.42,-.16],aegisM);
    addBox(torso,[.22,.18,.1],[0,-.45,-.17],aegisRuneM);       // central faulds plate
    addBox(torso,[.22,.05,.1],[0,-.36,-.175],capeTrimM);       // faulds gilt edge
  }
  // flowing cape/cloak — cloth for hunters, a gilded royal mantle with legendary armor
  const cape=new THREE.Group(); cape.position.set(0,.22,.15); torso.add(cape); idle.push(cape);
  addBox(cape,[isBulwark?.78:.62,isBulwark?.22:.17,isBulwark?.13:.1],[0,.1,.0],hasAegis?capeTrimM:(isBulwark?bulwarkArmorM:capeM)); // shoulder mantle
  addBox(cape,[.5,.42,.05],[0,-.2,.04],capeM,[.07,0,0]);            // upper drape
  if(!isScout){
    addBox(cape,[.54,.42,.05],[0,-.6,.1],capeM,[.13,0,0]);         // mid drape
    addBox(cape,[.58,.42,.05],[0,-1.0,.18],capeM,[.19,0,0]);       // lower drape
    addBox(cape,[.52,.2,.05],[0,-1.26,.26],capeM,[.24,0,0]);       // flared hem
  } else {
    addBox(cape,[.46,.22,.045],[0,-.48,.09],capeM,[.12,0,0]);     // short mobile cloak
  }
  if(hasAegis){
    addBox(cape,[.05,1.9,.06],[-.27,-.5,.13],capeTrimM,[.13,0,0]); // gold trim rails
    addBox(cape,[.05,1.9,.06],[.27,-.5,.13],capeTrimM,[.13,0,0]);
    addBox(cape,[.5,.06,.06],[0,-1.32,.27],capeTrimM,[.24,0,0]);   // gold hem band
    addBox(cape,[.22,.22,.05],[0,-.08,.03],gemM);                  // Aegis sigil clasp
    addBox(cape,[.15,.06,.08],[0,.15,-.02],gemM);                  // collar gem
  } else if(isScout) {
    addBox(cape,[.04,.72,.05],[-.23,-.17,.07],scoutArmorM,[.1,0,0]);
    addBox(cape,[.04,.72,.05],[.23,-.17,.07],scoutArmorM,[.1,0,0]);
    addBox(cape,[.16,.08,.07],[0,.12,-.01],metalM);
  } else {
    addBox(cape,[.05,1.7,.06],[-.25,-.42,.1],scarfM,[.13,0,0]);    // cloth edge stitching
    addBox(cape,[.05,1.7,.06],[.25,-.42,.1],scarfM,[.13,0,0]);
    addBox(cape,[.16,.1,.07],[0,.12,-.01],metalM);                 // cloak clasp
  }
  if(hasCartographerMantle){
    addBox(cape,[.9,.18,.13],[0,.2,-.02],cartoGoldM);              // royal cartographer shoulder yoke
    addBox(cape,[.58,.08,.08],[0,.3,-.08],cartoLightM);            // sky-blue collar inlay
    addBox(cape,[.72,.5,.055],[0,-.2,.02],cartoClothM,[.06,0,0]);
    addBox(cape,[.82,.62,.055],[0,-.7,.1],cartoClothM,[.13,0,0]);
    addBox(cape,[.76,.34,.055],[0,-1.18,.22],cartoClothM,[.2,0,0]);
    addBox(cape,[.06,1.55,.065],[-.38,-.48,.12],cartoGoldM,[.12,0,0]);
    addBox(cape,[.06,1.55,.065],[.38,-.48,.12],cartoGoldM,[.12,0,0]);
    addBox(cape,[.66,.06,.065],[0,-1.38,.3],cartoGoldM,[.22,0,0]);
    addBox(cape,[.28,.2,.07],[0,-.52,.165],cartoLightM,[.13,0,0]); // map patch
    addBox(cape,[.2,.04,.08],[0,-.52,.205],cartoInkM,[.13,0,.15]);
    addBox(cape,[.04,.16,.08],[-.06,-.52,.21],cartoInkM,[.13,0,0]);
    addBox(cape,[.16,.16,.08],[0,-.86,.23],cartoGoldM,[.18,0,.785]); // compass diamond
    addBox(cape,[.04,.26,.085],[0,-.86,.26],cartoLightM,[.18,0,0]);
    addBox(cape,[.26,.04,.085],[0,-.86,.26],cartoLightM,[.18,0,0]);
    addBox(cape,[.16,.12,.08],[-.23,.18,-.04],cartoGoldM);        // shoulder clasps
    addBox(cape,[.16,.12,.08],[.23,.18,-.04],cartoGoldM);
    addBox(cape,[.08,.08,.09],[0,.23,-.1],cartoLightM,[0,0,.785]);
  }

  for(const sx of [-.13,.13]){
    const leg=new THREE.Group(); leg.position.set(sx,.72,0);
    addBox(leg,[.2,.62,.2],[0,.1,0],pantsM);
    addBox(leg,[.2,.07,.21],[0,-.22,-.01],trimM);             // knee/hem wrap
    if(hasAegis) addBox(leg,[.22,.11,.23],[0,-.12,-.01],aegisTrimM);
    if(isBulwark) addBox(leg,[.23,.26,.12],[0,-.15,-.12],bulwarkArmorM);
    if(isScout) addBox(leg,[.21,.07,.22],[0,-.12,-.02],scoutArmorM);
    addBox(leg,[.22,.085,.22],[0,-.405,0],bootM);             // shorter ankle boot
    if(hasAegis) addBox(leg,[.24,.06,.24],[0,-.35,-.02],aegisM);
    addBox(leg,[.25,.07,.32],[0,-.49,-.08],bootM);            // foot block
    addBox(leg,[.26,.04,.34],[0,-.54,-.08],soleM);            // pale shoe trim
    addBox(leg,[.27,.03,.35],[0,-.58,-.08],packDarkM);        // dark sole
    addBox(leg,[.23,.1,.23],[0,-.33,-.005],bootM);            // boot cuff fold
    addBox(leg,[.05,.18,.22],[0,-.42,-.09],trimM);            // boot lace strip
    if(hasAegis){
      addBox(leg,[.23,.32,.12],[0,-.16,-.12],aegisM);         // shin greave
      addBox(leg,[.17,.12,.12],[0,.06,-.13],aegisRuneM);      // knee cop
      addBox(leg,[.25,.08,.28],[0,-.5,-.1],aegisM);           // sabaton toe cap
    }
    grp.add(leg); legs.push(leg);
  }
  for(const sx of [-.34,.34]){
    const arm=new THREE.Group(); arm.position.set(sx,1.12,sx<0?-.03:.03);
    arm.rotation.z=sx<0?.08:-.08;
    addBox(arm,[.17,.44,.17],[0,.06,0],shirtM);
    addBox(arm,[.18,.12,.18],[0,-.2,0],trimM);                // purple cuff band
    if(hasAegis){
      addBox(arm,[.22,.24,.22],[0,-.15,0],aegisM);             // chunky armor bracer
      addBox(arm,[.16,.11,.24],[0,-.17,-.03],aegisRuneM);
    } else if(isBulwark){
      addBox(arm,[.23,.3,.24],[0,-.12,0],bulwarkArmorM);
      addBox(arm,[.18,.08,.25],[0,-.2,-.04],ironArmorM);
    } else if(isVanguard){
      addBox(arm,[.19,.18,.2],[0,-.15,0],hasDiaArmor?diaArmorM:ironArmorM);
    } else if(isScout){
      addBox(arm,[.18,.08,.19],[0,-.2,0],scoutArmorM);
    }
    addBox(arm,[.18,.16,.18],[0,-.34,0],skinM);               // hand
    addBox(arm,[.06,.08,.08],[sx<0?.1:-.1,-.34,-.02],skinM);  // thumb
    addBox(arm,[.2,.13,.2],[0,-.28,0],gloveM);                // leather glove cuff
    if(hasAegis){
      addBox(arm,[.22,.1,.22],[0,-.33,0],aegisM);             // gauntlet plate
      addBox(arm,[.16,.05,.19],[0,-.33,-.06],gemM);           // knuckle gem
    }
    grp.add(arm); arms.push(arm);
  }
  let sword=null;
  if(heldKind){
    sword=new THREE.Group(); grp.add(sword); idle.push(sword);
    const x=.55, y=1.12, z=.44, rot=[.82,0,.2];
    if(heldKind==='sword'){
      addBox(sword,[.055,.42,.055],[x,y,z],beltM,rot);
      addBox(sword,[.36,.055,.07],[x+.09,y+.2,z+.14],guardM,rot);
      addBox(sword,[.04,.62,.036],[x+.25,y+.49,z+.25],(look.heldId|0)===136?aegisGlowM:bladeM,rot);
      addBox(sword,[.016,.56,.016],[x+.29,y+.5,z+.275],metalM,rot);
    } else if(heldKind==='dagger'){
      addBox(sword,[.05,.28,.05],[x+.03,y+.04,z+.04],beltM,rot);
      addBox(sword,[.22,.045,.06],[x+.08,y+.2,z+.12],guardM,rot);
      addBox(sword,[.035,.42,.032],[x+.2,y+.38,z+.2],chronoM,rot);
      addBox(sword,[.012,.34,.012],[x+.23,y+.4,z+.225],aegisGlowM,rot);
    } else if(heldKind==='hammer'){
      addBox(sword,[.075,.78,.075],[x+.02,y+.18,z+.07],beltM,rot);
      addBox(sword,[.54,.18,.18],[x+.22,y+.68,z+.25],titanM,rot);
      addBox(sword,[.26,.21,.2],[x+.22,y+.68,z+.25],guardM,rot);
      addBox(sword,[.12,.08,.08],[x+.48,y+.68,z+.25],aegisM,rot);
    } else if(heldKind==='scythe'){
      addBox(sword,[.055,.9,.055],[x+.02,y+.28,z+.08],voidM,rot);
      addBox(sword,[.52,.055,.06],[x+.25,y+.78,z+.25],soulM,rot);
      addBox(sword,[.24,.055,.06],[x+.43,y+.66,z+.31],soulM,rot);
      addBox(sword,[.1,.1,.08],[x+.08,y+.66,z+.18],aegisRuneM,rot);
    } else if(heldKind==='bow'){
      addBox(sword,[.045,.68,.045],[x+.05,y+.3,z+.08],gravityM,rot);
      addBox(sword,[.05,.22,.05],[x+.18,y+.62,z+.2],gravityM,rot);
      addBox(sword,[.05,.22,.05],[x-.04,y+.08,z-.02],gravityM,rot);
      addBox(sword,[.012,.7,.012],[x+.09,y+.34,z+.1],aegisGlowM,rot);
      addBox(sword,[.12,.12,.12],[x+.1,y+.35,z+.12],aegisRuneM,rot);
    } else if(heldKind==='cleaver'){
      addBox(sword,[.07,.44,.07],[x+.02,y+.08,z+.06],beltM,rot);
      addBox(sword,[.22,.52,.08],[x+.17,y+.47,z+.2],wardenM,rot);
      addBox(sword,[.08,.18,.09],[x+.32,y+.62,z+.26],aegisGlowM,rot);
      addBox(sword,[.28,.035,.035],[x+.2,y+.72,z+.3],wardenM,rot);
    } else if(heldKind==='katana'){
      addBox(sword,[.045,.36,.045],[x+.03,y+.08,z+.05],beltM,rot);
      addBox(sword,[.28,.04,.06],[x+.08,y+.22,z+.12],eclipseM,rot);
      addBox(sword,[.032,.74,.028],[x+.24,y+.56,z+.25],eclipseM,rot);
      addBox(sword,[.012,.66,.012],[x+.28,y+.58,z+.28],aegisGlowM,rot);
    } else if(heldKind==='phoenix'){
      addBox(sword,[.055,.42,.055],[x,y,z],beltM,rot);
      addBox(sword,[.34,.055,.07],[x+.09,y+.2,z+.14],guardM,rot);
      addBox(sword,[.048,.66,.04],[x+.25,y+.5,z+.25],phoenixM,rot);
      addBox(sword,[.18,.12,.06],[x+.27,y+.72,z+.28],phoenixM,rot);
    } else if(heldKind==='chakram'){
      addBox(sword,[.42,.045,.045],[x+.17,y+.46,z+.2],frostM,rot);
      addBox(sword,[.045,.42,.045],[x+.17,y+.46,z+.2],frostM,rot);
      addBox(sword,[.26,.035,.035],[x+.17,y+.46,z+.2],aegisGlowM,[rot[0],rot[1],rot[2]+Math.PI/4]);
      addBox(sword,[.06,.06,.06],[x+.17,y+.46,z+.2],frostM,rot);
    } else if(heldKind==='midas'){
      addBox(sword,[.055,.42,.055],[x,y,z],beltM,rot);
      addBox(sword,[.34,.055,.07],[x+.09,y+.2,z+.14],midasM,rot);
      addBox(sword,[.046,.66,.038],[x+.25,y+.5,z+.25],midasM,rot);
      addBox(sword,[.14,.14,.06],[x+.27,y+.72,z+.28],guardM,rot);
    } else if(heldKind==='trident'){
      addBox(sword,[.055,.84,.055],[x+.04,y+.25,z+.08],leviathanM,rot);
      addBox(sword,[.42,.06,.07],[x+.18,y+.77,z+.25],leviathanM,rot);
      addBox(sword,[.06,.24,.06],[x+.02,y+.83,z+.29],aegisGlowM,rot);
      addBox(sword,[.06,.24,.06],[x+.34,y+.83,z+.29],aegisGlowM,rot);
    } else if(heldKind==='anchor'){
      addBox(sword,[.08,.56,.08],[x+.04,y+.2,z+.08],voidM,rot);
      addBox(sword,[.32,.24,.18],[x+.15,y+.55,z+.22],voidCoreM,rot);
      addBox(sword,[.42,.055,.055],[x+.15,y+.55,z+.22],aegisRuneM,rot);
    } else if(heldKind==='pick'){
      addBox(sword,[.055,.7,.055],[x+.08,y+.22,z+.08],beltM,rot);
      addBox(sword,[.46,.06,.07],[x+.22,y+.58,z+.23],pickM,rot);
      addBox(sword,[.12,.06,.07],[x-.03,y+.56,z+.2],pickM,rot);
    } else if(heldKind==='axe'){
      addBox(sword,[.055,.64,.055],[x+.06,y+.18,z+.07],beltM,rot);
      addBox(sword,[.26,.2,.07],[x+.24,y+.54,z+.22],pickM,rot);
      addBox(sword,[.1,.1,.08],[x+.1,y+.47,z+.18],guardM,rot);
    } else if(heldKind==='shovel'){
      addBox(sword,[.05,.68,.05],[x+.07,y+.18,z+.07],beltM,rot);
      addBox(sword,[.2,.18,.06],[x+.22,y+.56,z+.23],pickM,rot);
      addBox(sword,[.12,.08,.06],[x+.18,y+.45,z+.19],pickM,rot);
    } else if(heldKind==='staff'){
      const isMeteor=(look.heldId|0)===162;
      addBox(sword,[.06,.82,.06],[x+.04,y+.25,z+.08],isMeteor?beltM:voidM,rot);
      addBox(sword,[.2,.12,.08],[x+.13,y+.64,z+.24],isMeteor?guardM:aegisRuneM,rot);
      addBox(sword,[.16,.16,.16],[x+.2,y+.76,z+.3],isMeteor?meteorM:voidCoreM,rot);
      addBox(sword,[.28,.045,.045],[x+.2,y+.76,z+.3],isMeteor?meteorM:aegisGlowM,rot);
      addBox(sword,[.045,.28,.045],[x+.2,y+.76,z+.3],isMeteor?meteorM:aegisGlowM,rot);
    }
  }
  grp.add(blobShadow(1));
  return {grp, legs, arms, head, look, hair, blink, idle, sword, aegisGlow};
}
function equipmentSignatureFrom(ref){
  return [(ref&&ref.path)||'', ref?(ref.armorId|0):0, (ref&&ref.armorType)||'', ref?(ref.heldId|0):0, (ref&&ref.job)||'', ref?(ref.jobLvl|0):0, (ref&&ref.cosmetics)||''].join('|');
}
function makeSpiritDiscTexture(){
  const c=document.createElement('canvas');c.width=c.height=96;
  const g=c.getContext('2d'),r=c.width/2;
  const grad=g.createRadialGradient(r,r,2,r,r,r);
  grad.addColorStop(0,'rgba(210,245,255,.95)');
  grad.addColorStop(.28,'rgba(125,211,252,.55)');
  grad.addColorStop(.72,'rgba(80,160,255,.16)');
  grad.addColorStop(1,'rgba(80,160,255,0)');
  g.fillStyle=grad;g.fillRect(0,0,c.width,c.height);
  return new THREE.CanvasTexture(c);
}
let spiritDiscTexture=null;
function spiritTexture(){
  if(!spiritDiscTexture)spiritDiscTexture=makeSpiritDiscTexture();
  return spiritDiscTexture;
}
function addSpiritVisual(r){
  if(!r||!r.grp||r.spiritVisual)return;
  const tinted=[];
  r.grp.traverse(o=>{
    if(!o.isMesh||o.userData&&o.userData.spiritVisual)return;
    const original=o.material,src=Array.isArray(original)?original:[original];
    const next=src.map(m=>{
      const clone=m.clone();
      if(clone.color)clone.color.lerp(new THREE.Color(0x8bdcff),.62);
      clone.transparent=true;
      clone.opacity=Math.min(.46,Number.isFinite(clone.opacity)?clone.opacity*.52:.46);
      clone.depthWrite=false;
      if(clone.emissive)clone.emissive.setHex(0x1c86d1);
      if(clone.emissiveIntensity!=null)clone.emissiveIntensity=Math.max(clone.emissiveIntensity||0,.28);
      return clone;
    });
    o.material=Array.isArray(original)?next:next[0];
    tinted.push({mesh:o,original,clones:next});
  });
  const root=new THREE.Group();
  root.userData.spiritVisual=true;
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.74,.035,8,48),new THREE.MeshBasicMaterial({color:0x82d8ff,transparent:true,opacity:.72,depthWrite:false,side:THREE.DoubleSide}));
  ring.rotation.x=Math.PI/2;ring.position.y=.08;ring.userData.spiritVisual=true;root.add(ring);
  const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:spiritTexture(),color:0x9bdcff,transparent:true,opacity:.42,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending}));
  halo.position.y=1.18;halo.scale.set(1.55,2.6,1);halo.userData.spiritVisual=true;root.add(halo);
  const flame=new THREE.Sprite(new THREE.SpriteMaterial({map:spiritTexture(),color:0xe4f8ff,transparent:true,opacity:.78,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending}));
  flame.position.y=2.25;flame.scale.set(.58,.9,1);flame.userData.spiritVisual=true;root.add(flame);
  r.grp.add(root);
  r.spiritVisual={root,ring,halo,flame,tinted,phase:Math.random()*Math.PI*2};
}
function removeSpiritVisual(r){
  const sv=r&&r.spiritVisual;if(!sv)return;
  for(const entry of sv.tinted||[]){
    if(entry.mesh)entry.mesh.material=entry.original;
    for(const mat of entry.clones||[])if(mat&&mat.dispose)mat.dispose();
  }
  if(sv.root)disposeObjectTree(sv.root);
  r.spiritVisual=null;
}
function addInvisibilityVisual(r){
  if(!r||!r.grp||r.invisibilityVisual)return;
  const tinted=[];
  const root=new THREE.Group();
  root.userData.spiritVisual=true;
  const veil=new THREE.Sprite(new THREE.SpriteMaterial({map:spiritTexture(),color:0xb794f6,transparent:true,opacity:.32,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending}));
  veil.position.y=1.12;veil.scale.set(1.25,2.15,1);veil.userData.spiritVisual=true;root.add(veil);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.62,.025,8,40),new THREE.MeshBasicMaterial({color:0xdbeafe,transparent:true,opacity:.42,depthWrite:false,side:THREE.DoubleSide}));
  ring.rotation.x=Math.PI/2;ring.position.y=.08;ring.userData.spiritVisual=true;root.add(ring);
  r.grp.add(root);
  r.invisibilityVisual={root,veil,ring,tinted,phase:Math.random()*Math.PI*2};
}
function removeInvisibilityVisual(r){
  const iv=r&&r.invisibilityVisual;if(!iv)return;
  for(const entry of iv.tinted||[]){
    if(entry.mesh)entry.mesh.material=entry.original;
    for(const mat of entry.clones||[])if(mat&&mat.dispose)mat.dispose();
  }
  if(iv.root)disposeObjectTree(iv.root);
  r.invisibilityVisual=null;
}
function tickInvisibilityVisual(r,now){
  if(!r||!r.grp)return;
  const want=!!(r.ref&&r.ref.invisible);
  if(want)addInvisibilityVisual(r);else removeInvisibilityVisual(r);
  const iv=r.invisibilityVisual;if(!iv)return;
  const t=now/1000+(iv.phase||0),pulse=.5+.5*Math.sin(t*3.1);
  iv.root.position.y=Math.sin(t*1.8)*.025;
  iv.veil.material.opacity=.16+pulse*.18;
  iv.veil.scale.set(1.1+pulse*.24,2.05+pulse*.24,1);
  iv.ring.rotation.z=-t*.9;
  iv.ring.material.opacity=.24+pulse*.2;
  iv.ring.scale.setScalar(.9+pulse*.12);
}
function tickSpiritVisual(r,now){
  if(!r||!r.grp)return;
  tickInvisibilityVisual(r,now);
  const want=!!(r.ref&&r.ref.spirit);
  if(want)addSpiritVisual(r);else removeSpiritVisual(r);
  const sv=r.spiritVisual;if(!sv)return;
  const t=now/1000+(sv.phase||0),pulse=.5+.5*Math.sin(t*2.4);
  sv.root.position.y=Math.sin(t*1.35)*.035;
  sv.ring.rotation.z=t*.55;
  sv.ring.material.opacity=.46+pulse*.22;
  sv.ring.scale.setScalar(1+pulse*.08);
  sv.halo.material.opacity=.22+pulse*.14;
  sv.halo.scale.set(1.45+pulse*.25,2.35+pulse*.32,1);
  sv.flame.position.y=2.18+Math.sin(t*2.1)*.09;
  sv.flame.material.opacity=.62+pulse*.24;
}
function netAddRemote(sid, ref){
  const r={...makeRemoteAvatar(remoteAppearance(ref)), ref, phase:Math.random()*10, tagText:'', equipSig:equipmentSignatureFrom(ref)};
  r.grp.position.set(ref.x, ref.y, ref.z);
  scene.add(r.grp);
  NET.remotes[sid]=r;
  netUpdateTag(r);
}
function netRefreshRemoteAvatar(sid, r){
  const sig=equipmentSignatureFrom(r.ref);
  if(sig===r.equipSig) return;
  const pos=r.grp.position.clone(), rot=r.grp.rotation.y, tag=r.tag;
  scene.remove(r.grp);
  const fresh=makeRemoteAvatar(remoteAppearance(r.ref));
  Object.assign(r, fresh);
  r.grp.position.copy(pos);
  r.grp.rotation.y=rot;
  r.equipSig=sig;
  r.mountObj=null;                  // rebuilt fresh by ensureRemoteMount next frame
  r.invisibilityVisual=null;
  r.spiritVisual=null;
  r.tag=null; r.tagText='';
  scene.add(r.grp);
  netUpdateTag(r);
}
function netUpdateTag(r){
  const pathCol=r.ref.path && PATHS[r.ref.path] ? PATHS[r.ref.path].col : '#ffffff';
  const spirit=!!r.ref.spirit;
  const team=spirit?'SPIRIT':teamName(r.ref.team||'');
  const rank=playerRankName(r.ref.lvl);
  const job=JOBS[r.ref.job] ? JOBS[r.ref.job].name : '';
  const jobLvl=r.ref.jobLvl|0;
  const jobTitle=JOBS[r.ref.job] ? jobTitleFor(r.ref.job, jobLvl||1) : 'Adventurer';
  const text=r.ref.name+'|'+r.ref.lvl+'|'+rank+'|'+team+'|'+job+'|'+jobLvl+'|'+jobTitle+'|'+(spirit?1:0);
  if(text===r.tagText) return;
  r.tagText=text;
  if(r.tag) disposeObjectTree(r.tag);
  r.tag=makeNameTag(r.ref.name, spirit?'#9bdcff':pathCol, team, spirit?'#7dd3fc':teamCol(r.ref.team||''), { lvl:r.ref.lvl, rank:spirit?'Spirit':rank, job, jobLvl, jobTitle });
  r.grp.add(r.tag);
}
function pulseAegisGlow(model, now){
  if(!model || !model.aegisGlow || !model.aegisGlow.length) return;
  const t=now/1000+(model.phase||0);
  const p=.5+.5*Math.sin(t*2.2);
  for(let i=0;i<model.aegisGlow.length;i++){
    const sp=model.aegisGlow[i];
    if(sp.material) sp.material.opacity=(i?0.11:0.16)+p*(i?0.08:0.13);
    const base=i?.78:1.35, tall=i?1.35:2.05;
    const s=1+p*(i?.06:.09);
    sp.scale.set(base*s, tall*s, 1);
  }
}
function netRemoveRemote(sid){
  const r=NET.remotes[sid];
  if(r){ disposeObjectTree(r.grp); delete NET.remotes[sid]; }
}


  return Object.freeze({
    DRAGON_TYPES_LIST,
    DRAGON_TYPES,
    DRAGON_EGG_TO_TYPE,
    dragonType,
    dragonTrailColor,
    emitDragonTrail,
    emitDragonAura,
    mountLift,
    mountEye,
    animateMountWings,
    ensureRemoteMount,
    applyMount,
    toggleMount,
    cycleDragon,
    DRAGON_ABILITIES,
    dragonGender,
    dragonGenderLabel,
    dragonPersonality,
    dragonPersonalityLabel,
    dragonPersonalityText,
    dragonPersonalityColor,
    dragonRole,
    dragonRoleLabel,
    dragonStage,
    dragonIsAdult,
    dragonStageLabel,
    dragonGrowthProgress,
    dragonGrowthLeftSeconds,
    dragonBondLevel,
    dragonBondProgress,
    dragonBondMilestone,
    dragonBondRewardText,
    dragonRoleMasteryProgress,
    dragonRoleMasteryLevel,
    dragonRoleMasteryTitle,
    dragonRoleMasteryReward,
    dragonRoleMasteryNextReward,
    dragonSpecialization,
    dragonSpecializationName,
    dragonSpecializationText,
    dragonSpecializationChoices,
    dragonSpecializationColor,
    canChooseDragonSpecialization,
    chooseDragonSpecialization,
    applyDragonRoleMasteryUpdate,
    dragonDailyChallenge,
    dragonChallengeProgress,
    dragonStayMapMarkers,
    nearestOwnedDragon,
    dragonReaction,
    addDragonActivity,
    dragonActivityEntries,
    noteDragonRoleEvent,
    dragonHappiness,
    setDragonCare,
    castDragonAbility,
    feedMountedDragon,
    careDragon,
    startDragonTraining,
    applyDragonTrainingUpdate,
    applyDragonTrainingComplete,
    clearDragonTraining,
    dragonTrainingProgress,
    setDragonRole,
    clearDragonStaySpot,
    recallDragon,
    focusDragonStayPost,
    firstDragonEggSlot,
    hatchDragonEgg,
    claimLocalIncubation,
    applyDragonIncubationStart,
    applyDragonIncubationReady,
    applyDragonIncubationComplete,
    dragonHatchRejected,
    applyDragonRenameResult,
    dragonRenameRejected,
    perchRejected,
    tickLocalMount,
    tickDragonRoost,
    tickCompanionDragons,
    tickPetTamerTutorialDragons,
    tickPetTamerTutorialGroundDragon,
    DRAGON_PERCH_SLOTS_C,
    perchedDragons,
    perchKeysAt,
    addPerchedDragon,
    removePerchedDragon,
    tickPerchedDragons,
    dragonBreedFx,
    perchMyDragon,
    feedNestDragon,
    recallNestDragon,
    dragonBreathe,
    spriteForageChance,
    FAMILIARS,
    FAMILIAR_BY_SIGIL,
    tickFamiliars,
    spriteForage,
    fangSnap,
    tickWatchfulShade,
    setFamiliar,
    cycleFamiliar,
    updateFamiliarHUD,
    shadowStep,
    applyShadeStepResult,
    applyShadeStepReject,
    familiarReaction,
    applyFamiliarBond,
    bindFamiliarItem,
    familiarBoundLocal,
    makeRemoteAvatar,
    netAddRemote,
    netRefreshRemoteAvatar,
    netUpdateTag,
    tickSpiritVisual,
    pulseAegisGlow,
    netRemoveRemote,
    get mounted(){ return mounted; },
    set mounted(value){ mounted=value; },
    get mountKind(){ return mountKind; },
    set mountKind(value){ mountKind=value; },
    get localMountObj(){ return localMountObj; },
    set localMountObj(value){ localMountObj=value; },
    get dragonUnlocks(){ return dragonUnlocks; },
    set dragonUnlocks(value){ dragonUnlocks=value; },
    get familiarXp(){ return familiarXp; },
    set familiarXp(value){
      const next={...DEFAULT_FAMILIAR_XP};
      if(value&&typeof value==='object')for(const kind of FAMILIAR_IDS)next[kind]=Math.max(0,value[kind]|0);
      familiarXp=next;
    },
    get familiarChallenges(){ return familiarChallenges; },
    set familiarChallenges(value){ familiarChallenges=value&&typeof value==='object'?value:{}; },
    get dragonCare(){ return dragonCare; },
    set dragonCare(value){ dragonCare=value; },
    get dragonBondXp(){ return dragonBondXp; },
    set dragonBondXp(value){ dragonBondXp=value&&typeof value==='object'?value:{}; },
    get dragonRoleMastery(){ return dragonRoleMastery; },
    set dragonRoleMastery(value){ dragonRoleMastery=value&&typeof value==='object'?value:{}; },
    get dragonSpecializations(){ return dragonSpecializations; },
    set dragonSpecializations(value){ dragonSpecializations=value&&typeof value==='object'?value:{}; },
    get dragonChallenges(){ return dragonChallenges; },
    set dragonChallenges(value){ dragonChallenges=value&&typeof value==='object'?value:{}; },
    get dragonNames(){ return dragonNames; },
    set dragonNames(value){ dragonNames=value; },
    get dragonGenders(){ return dragonGenders; },
    set dragonGenders(value){ dragonGenders=value&&typeof value==='object'?value:{}; },
    get dragonPersonalities(){ return dragonPersonalities; },
    set dragonPersonalities(value){ dragonPersonalities=value&&typeof value==='object'?value:{}; },
    get dragonRoles(){ return dragonRoles; },
    set dragonRoles(value){ dragonRoles=value&&typeof value==='object'?value:{}; },
    get dragonStaySpots(){ return dragonStaySpots; },
    set dragonStaySpots(value){ dragonStaySpots=value&&typeof value==='object'?value:{}; },
    get dragonHatchedAt(){ return dragonHatchedAt; },
    set dragonHatchedAt(value){ dragonHatchedAt=value&&typeof value==='object'?value:{}; },
    get dragonAbilityReadyAt(){ return dragonAbilityReadyAt; },
    set dragonAbilityReadyAt(value){ dragonAbilityReadyAt=value; },
    get dragonRoostSig(){ return dragonRoostSig; },
    set dragonRoostSig(value){ dragonRoostSig=value; },
    get familiarUnlocks(){ return familiarUnlocks; },
    set familiarUnlocks(value){ familiarUnlocks=value; },
    get activeFamiliar(){ return activeFamiliar; },
    set activeFamiliar(value){ activeFamiliar=value; },
  });
}
