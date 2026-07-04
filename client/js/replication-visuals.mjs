export function createReplicationVisuals({NET,player}){
// ---- server mobs: kind-aware models, state-driven telegraph animation ----
const ANIMAL_BASE_KIND={prairie_hare:'rabbit',forest_stag:'deer',dune_hare:'rabbit',ridge_boar:'boar',frost_stag:'deer',mire_boar:'boar',pack_mule:'deer'};
function isAnimalKind(kind){ return kind==='deer'||kind==='boar'||kind==='rabbit'||!!ANIMAL_BASE_KIND[kind]; }
const RANGED_ENEMY_KINDS=new Set(['skeleton','bone_archer','ash_archer','void_archer','bandit_archer']);
const ENEMY_FAMILY_COLORS={
  husk:[.72,.48,.24],bone_archer:[.78,.67,.48],
  raider:[.64,.25,.18],ash_archer:[.58,.34,.3],
  dreadguard:[.3,.14,.42],void_archer:[.37,.2,.55],
  elite_husk:[1,.54,.18],elite_raider:[.95,.2,.12],elite_dreadguard:[.65,.16,.9],
  bandit:[.42,.29,.18],bandit_archer:[.31,.4,.22],bandit_captain:[.55,.16,.12],
  bandit_shield:[.22,.31,.42],bandit_scout:[.48,.39,.16],bandit_brute:[.5,.2,.16],
  caravan_guard:[.2,.38,.62],caravan_merchant:[.48,.27,.6],
  wounded_hunter:[.32,.46,.58],
};
const ENCOUNTER_NAMES={bandit:'Bandit',bandit_archer:'Bandit Archer',bandit_shield:'Shield Bandit',bandit_scout:'Bandit Scout',bandit_brute:'Bandit Brute',bandit_captain:'Bandit Captain',caravan_guard:'Caravan Guard',caravan_merchant:'Road Merchant',wounded_hunter:'Wounded Hunter',pack_mule:'Pack Mule',caravan_wagon:'Merchant Wagon',caravan_wreck:'Wrecked Wagon'};
function textSprite(text,color='#ffffff',scale=1){
  const cv=document.createElement('canvas');cv.width=256;cv.height=64;const cx=cv.getContext('2d');cx.font='bold 26px sans-serif';cx.textAlign='center';cx.textBaseline='middle';cx.strokeStyle='rgba(0,0,0,.9)';cx.lineWidth=7;cx.strokeText(text,128,32);cx.fillStyle=color;cx.fillText(text,128,32);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),transparent:true,depthTest:false}));sp.scale.set(2.8*scale,.7*scale,1);return sp;
}
function decorateEncounter(m,ref){
  const name=ENCOUNTER_NAMES[ref.kind];if(!name)return;
  const friendly=ref.kind.indexOf('caravan_')===0||ref.kind==='pack_mule'||ref.kind==='wounded_hunter',hostile=ref.kind.indexOf('bandit')===0;
  const label=textSprite(name,friendly?'#8edcff':hostile?'#ff9b82':'#fff');label.position.y=m.wagon?2.35:2.65;m.grp.add(label);
  const bg=new THREE.Sprite(new THREE.SpriteMaterial({color:0x120f0e,transparent:true,opacity:.9,depthTest:false})),fill=new THREE.Sprite(new THREE.SpriteMaterial({color:friendly?0x55c9ff:0xf05242,depthTest:false}));
  bg.scale.set(1.35,.13,1);fill.scale.set(1.29,.075,1);bg.position.y=label.position.y-.42;fill.position.set(0,bg.position.y,.01);m.grp.add(bg,fill);m.encounterUi={label,bg,fill,friendly,hostile};
  const ring=new THREE.Mesh(new THREE.TorusGeometry(m.wagon?1.25:.58,.035,6,30),new THREE.MeshBasicMaterial({color:friendly?0x5dd5ff:0xff5c46,transparent:true,opacity:.7,depthWrite:false}));ring.rotation.x=Math.PI/2;ring.position.y=.06;m.grp.add(ring);m.encounterUi.ring=ring;
  if(hostile){const alert=textSprite('?', '#ffd45c',.55),engaged=textSprite('!', '#ff6048',.62);alert.position.y=engaged.position.y=label.position.y+.48;m.grp.add(alert,engaged);m.encounterUi.alert=alert;m.encounterUi.engaged=engaged;}
  if(hostile){const radius=ref.kind==='bandit_captain'?4.05:ref.kind==='bandit_brute'?3.65:1.35;const tell=new THREE.Mesh(new THREE.RingGeometry(radius-.1,radius,48),new THREE.MeshBasicMaterial({color:ref.kind==='bandit_captain'?0xff3429:0xff8a45,transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false,depthTest:false}));tell.rotation.x=-Math.PI/2;tell.position.y=.08;tell.visible=false;m.grp.add(tell);m.encounterUi.tell=tell;if(ref.kind==='bandit_captain')m.spawnT=2.2;}
}
function tickEncounterReadability(m,dt,t){
  const u=m.encounterUi;if(!u)return;const r=m.ref,pct=Math.max(0,Math.min(1,(r.hp||0)/(r.maxHp||1)));u.fill.scale.x=1.29*pct;u.fill.position.x=-(1.29-u.fill.scale.x)/2;
  if(u.alert){const aware=['draw','windup','bruteWind','rally'].includes(r.state);u.alert.visible=!aware&&r.state!=='surrender'&&r.state!=='retreat';if(u.engaged)u.engaged.visible=aware;}
  if(r.state==='retreat'){u.label.material.color.set(0xffd26b);u.ring.material.color.set(0xffc34d);}else u.ring.material.color.set(u.friendly?0x5dd5ff:0xff5c46);
  if(m.spawnT>0){m.spawnT=Math.max(0,m.spawnT-dt);m.grp.scale.y=1+Math.sin((2.2-m.spawnT)*8)*.08;if(u.tell){u.tell.visible=true;u.tell.scale.setScalar(1+(2.2-m.spawnT)*.8);u.tell.material.opacity=m.spawnT/2.2;}}
  else if(u.tell){u.tell.visible=['windup','bruteWind','captainCleave'].includes(r.state);if(u.tell.visible){const charge=r.state==='captainCleave'?Math.min(1,(m.aT||0)/.9):Math.min(1,(m.aT||0)/.7);u.tell.scale.setScalar(.72+charge*.28);u.tell.material.opacity=.45+charge*.45;}}
  if(m.wagon){const wreck=r.kind==='caravan_wreck',damaged=pct<.65,critical=pct<.3;m.grp.rotation.z=wreck?.22:0;if(m.mats[0])m.mats[0].color.set(wreck?0x34271f:critical?0x49301f:damaged?0x5b3822:0x704321);if((damaged||wreck)&&m.grp.visible&&Math.random()<dt*(wreck?18:critical?14:6))spawnParticle({x:m.grp.position.x+(Math.random()-.5),y:m.grp.position.y+1.2,z:m.grp.position.z+(Math.random()-.5),vx:(Math.random()-.5)*.25,vy:.8,vz:(Math.random()-.5)*.25,life:1,grav:-.1,r:.28,g:.28,b:.28});}
}
function makeCaravanWagon(wrecked){
  const grp=new THREE.Group(),wood=new THREE.MeshLambertMaterial({color:0x704321}),cloth=new THREE.MeshLambertMaterial({color:0xd7c49a}),dark=new THREE.MeshLambertMaterial({color:0x29231e}),mats=[wood,cloth,dark];
  addBox(grp,[1.55,.42,2.15],[0,.72,0],wood);addBox(grp,[1.45,.85,.12],[0,1.35,-.92],cloth);addBox(grp,[1.45,.85,.12],[0,1.35,.92],cloth);
  for(const x of [-.76,.76])for(const z of [-.65,.65]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.38,.38,.14,10),dark);wheel.rotation.z=Math.PI/2;wheel.position.set(x,.45,z);grp.add(wheel);}
  if(wrecked)grp.rotation.z=.22;
  grp.add(blobShadow(1.5));return {grp,mats,legs:[],arms:[],head:null,baseCol:[.44,.26,.13],wagon:true};
}
function makeAnimal(kind){
  const grp=new THREE.Group(), mats=[], legs=[];
  const reg=m=>{mats.push(m);return m;};
  const base=ANIMAL_BASE_KIND[kind]||kind;
  const nativePal={
    prairie_hare:{body:'#b79c62',dark:'#725d32',light:'#e7d28f',nose:'#3c2b1b'},
    forest_stag:{body:'#6f5a31',dark:'#343b20',light:'#b39a57',nose:'#211a11'},
    dune_hare:{body:'#d7a94d',dark:'#8c6129',light:'#ffe29a',nose:'#57331d'},
    ridge_boar:{body:'#8b3e2c',dark:'#47241e',light:'#d0764d',nose:'#301814'},
    frost_stag:{body:'#b8d1d8',dark:'#537681',light:'#efffff',nose:'#253f4b'},
    mire_boar:{body:'#4d6338',dark:'#283522',light:'#83955a',nose:'#20251a'},
  };
  const pal = nativePal[kind] || (base==='deer'
    ? {body:'#9a6b3a', dark:'#6f4726', light:'#d2a064', nose:'#2b1a12'}
    : base==='boar'
      ? {body:'#5d4034', dark:'#35251f', light:'#8b6656', nose:'#2a1714'}
      : {body:'#c9b79a', dark:'#8d7a62', light:'#f0e4cc', nose:'#4a3028'});
  const bodyM=reg(lam(solidTex(pal.body,pal.dark)));
  const darkM=reg(lam(solidTex(pal.dark)));
  const lightM=reg(lam(solidTex(pal.light)));
  const noseM=reg(lam(solidTex(pal.nose)));
  const s=base==='rabbit'?.72:base==='boar'?1.05:1.12;
  addBox(grp,[.9*s,.46*s,.42*s],[0,.62*s,0],bodyM);
  addBox(grp,[.38*s,.36*s,.36*s],[0,.72*s,.42*s],base==='rabbit'?lightM:bodyM);
  addBox(grp,[.18*s,.1*s,.12*s],[0,.68*s,.64*s],noseM);
  for(const ex of [-.1,.1]) addBox(grp,[.045*s,.045*s,.025*s],[ex*s,.78*s,.61*s],new THREE.MeshBasicMaterial({color:0x101010}));
  if(base==='deer'){
    for(const sx of [-.12,.12]){
      addBox(grp,[.045*s,.38*s,.045*s],[sx*s,1.03*s,.42*s],darkM,[0,0,sx>0?-.28:.28]);
      addBox(grp,[.04*s,.16*s,.04*s],[(sx+(sx>0?.07:-.07))*s,1.16*s,.42*s],darkM,[0,0,sx>0?.5:-.5]);
    }
    addBox(grp,[.18*s,.12*s,.08*s],[0,.7*s,-.33*s],lightM);
  } else if(base==='rabbit'){
    for(const sx of [-.09,.09]) addBox(grp,[.08*s,.42*s,.08*s],[sx*s,1.02*s,.38*s],bodyM,[sx>0?.18:-.18,0,0]);
    addBox(grp,[.2*s,.16*s,.08*s],[0,.6*s,-.34*s],lightM);
  } else {
    for(const sx of [-.11,.11]) addBox(grp,[.06*s,.13*s,.04*s],[sx*s,.66*s,.7*s],lightM,[.2,0,sx>0?.25:-.25]);
    addBox(grp,[.14*s,.16*s,.1*s],[0,.78*s,-.35*s],darkM);
  }
  for(const sx of [-.28,.28]) for(const z of [-.16,.22]){
    const leg=new THREE.Group();
    leg.position.set(sx*s,.42*s,z*s);
    addBox(leg,[.11*s,.42*s,.11*s],[0,-.18*s,0],darkM);
    grp.add(leg); legs.push(leg);
  }
  grp.add(blobShadow(base==='rabbit'?.7:1));
  const c=new THREE.Color(pal.body), baseCol=[c.r,c.g,c.b];
  return {grp,mats,legs,arms:[],head:null,animal:true,baseCol};
}
function netAddMob(id, ref){
  if(ref.kind==='caravan_wagon'||ref.kind==='caravan_wreck'){
    const m={...makeCaravanWagon(ref.kind==='caravan_wreck'),net:true,netId:id,ref,hp:ref.hp,kind:ref.kind,kb:new THREE.Vector3(),phase:0,hitT:0,slowT:0,aT:0,lastState:''};
    decorateEncounter(m,ref);m.grp.position.set(ref.x,ref.y,ref.z);scene.add(m.grp);mobs.push(m);return;
  }
  if(ref.kind==='shadow_soldier'){
    const m={...makeShadow(), net:true, netId:id, ref, hp:ref.hp, kind:ref.kind,
      kb:new THREE.Vector3(), phase:Math.random()*10, hitT:0, slowT:0, aT:0, lastState:'', baseCol:[1,1,1]};
    m.grp.position.set(ref.x,ref.y,ref.z);
    scene.add(m.grp); mobs.push(m);
    burst(ref.x,ref.y+1,ref.z,[.45,.3,.9],20,2.2,2.2,.6);
    return;
  }
  if(ref.kind==='orb'){
    const grp=new THREE.Group();
    const mat=new THREE.MeshBasicMaterial({color:0xffaa33});
    const s=new THREE.Mesh(new THREE.SphereGeometry(.35,10,8), mat);
    s.position.y=1.0; grp.add(s);
    grp.position.set(ref.x, ref.y, ref.z);
    scene.add(grp);
    mobs.push({grp, mats:[mat], net:true, netId:id, ref, kind:'orb', orb:true,
      baseCol:[1,.66,.2], phase:Math.random()*10, hitT:0, slowT:0, kb:new THREE.Vector3()});
    return;
  }
  if(isAnimalKind(ref.kind)){
    const m={...makeAnimal(ref.kind), net:true, netId:id, ref, hp:ref.hp,
      kind:ref.kind, kb:new THREE.Vector3(), phase:Math.random()*10, hitT:0, slowT:0,
      aT:0, lastState:''};
    decorateEncounter(m,ref);m.grp.position.set(ref.x, ref.y, ref.z);
    scene.add(m.grp);
    mobs.push(m);
    return;
  }
  const skel=RANGED_ENEMY_KINDS.has(ref.kind);
  const boss=ref.kind==='boss';
  const m={...(boss?makeGateBoss():skel?makeSkeleton():makeZombie()), net:true, netId:id, ref, hp:ref.hp,
    kind:ref.kind, kb:new THREE.Vector3(), phase:Math.random()*10, hitT:0, slowT:0,
    aT:0, lastState:'', cdx:0, cdz:0,
    boss};
  if(m.boss){
    m.grp.scale.setScalar(1.6);
    m.baseCol=[1,1,1];                          // the Gate Monarch model carries its own palette
  } else if(ref.kind==='ghost'){
    m.grp.scale.setScalar(.8);
    m.baseCol=[.6,.95,1];
    m.mats.forEach(mm=>{ mm.transparent=true; mm.opacity=.5; mm.color.setRGB(.6,.95,1); });
  } else {
    tintMob(m);
    const col=ENEMY_FAMILY_COLORS[ref.kind];
    if(col){m.baseCol=col;m.mats.forEach(mm=>mm.color.setRGB(col[0],col[1],col[2]));}
    if(ref.kind==='bandit_captain')m.grp.scale.setScalar(1.25);
    if(ref.kind==='bandit_brute')m.grp.scale.setScalar(1.18);
    if(ref.kind==='wounded_hunter')m.grp.scale.y=.65;
    if(ref.kind==='bandit_shield'){const shield=new THREE.Mesh(new THREE.BoxGeometry(.5,.72,.1),new THREE.MeshLambertMaterial({color:0x33485d}));shield.position.set(-.48,1.05,-.08);shield.rotation.y=.25;m.grp.add(shield);}
    if(ref.kind.indexOf('elite_')===0){m.grp.scale.setScalar(1.28);decorateBoss(m);}
    if(ref.elite){                                          // synced dungeon elite: larger, horned, violet-tinted
      m.grp.scale.setScalar(1.32);
      m.baseCol=[.78,.45,1];
      m.mats.forEach(mm=>mm.color.setRGB(.78,.45,1));
      decorateBoss(m);
      m.elite=true;
    }
  }
  m.grp.position.set(ref.x, ref.y, ref.z);
  decorateEncounter(m,ref);
  scene.add(m.grp);
  mobs.push(m);
}
function netRemoveMob(id){
  const i=mobs.findIndex(m=>m.net && m.netId===id);
  if(i<0) return;
  const p=mobs[i].grp.position;
  burst(p.x, p.y+1, p.z, [.34,.52,.28], 18, 2.6, 2.2, .7);
  SFX.kill();
  scene.remove(mobs[i].grp);
  mobs.splice(i,1);
}
function netMobTick(m, dt, t){
  const r=m.ref, p=m.grp.position;
  if((r.hp||0)<(m.hp||0)){m.hitT=.16;const flash=m.encounterUi&&m.encounterUi.hostile?[1,.25,.18]:[1,1,1];m.mats.forEach(mm=>mm.color.setRGB(flash[0],flash[1],flash[2]));if(m.grp.visible)burst(p.x,p.y+1,p.z,flash,6,1.5,1.4,.25);}m.hp=r.hp;
  m.grp.visible = (r.dgn||'')===NET.dgn;
  if(m.orb){
    p.x+=(r.x-p.x)*Math.min(1,dt*10); p.y+=(r.y-p.y)*Math.min(1,dt*10); p.z+=(r.z-p.z)*Math.min(1,dt*10);
    const k=1+Math.sin(t*10+m.phase)*.16;
    if(m.grp.children[0]) m.grp.children[0].scale.setScalar(k);
    if(m.grp.visible && Math.random()<dt*16)
      spawnParticle({x:p.x, y:p.y+1.4, z:p.z, vx:0, vy:1.2, vz:0, life:.25, grav:0, r:1, g:.4, b:.12});
    return;
  }
  const mvx=r.x-p.x, mvz=r.z-p.z;
  p.x+=mvx*Math.min(1,dt*10);
  p.z+=mvz*Math.min(1,dt*10);
  p.y+=(r.y-p.y)*Math.min(1,dt*10);
  m.grp.rotation.y += angDiff(r.yaw, m.grp.rotation.y)*Math.min(1,dt*8);
  tickEncounterReadability(m,dt,t);
  if(m.wagon)return;
  const moving=Math.hypot(mvx,mvz)>.08;
  if(m.animal){
    const sw=moving?Math.sin(t*((ANIMAL_BASE_KIND[r.kind]||r.kind)==='rabbit'?12:8)+m.phase)*.55:0;
    for(let i=0;i<m.legs.length;i++) m.legs[i].rotation.x=sw*(i%2? -1:1);
    if((r.state||'')!==m.lastState){
      m.lastState=r.state||'';
      if(m.hitT<=0){ const bc=m.baseCol||[1,1,1]; m.mats.forEach(mm=>mm.color.setRGB(bc[0],bc[1],bc[2])); }
    }
    if(r.state==='flee' && m.grp.visible && Math.random()<dt*10)
      spawnParticle({x:p.x, y:p.y+.12, z:p.z, vx:(Math.random()-.5)*.4, vy:.5, vz:(Math.random()-.5)*.4, life:.25, grav:1.5, r:.55, g:.45, b:.32});
    return;
  }
  const sw=moving?Math.sin(t*7.5+m.phase)*.55:m.legs[0].rotation.x*.9;
  m.legs[0].rotation.x=sw; m.legs[1].rotation.x=-sw;
  // state-driven telegraphs
  const st=r.state||'';
  if(st!==m.lastState){
    m.lastState=st; m.aT=0;
    if(st==='stun'){ m.mats.forEach(mm=>mm.color.setRGB(.55,.7,1)); }
    else if(st==='frozen'){ m.mats.forEach(mm=>mm.color.setRGB(.55,.78,1)); }
    else if(st==='blackhole'){ startBlackholeMob(m, true); }
    else if(m.hitT<=0){ const bc=m.baseCol||[1,1,1]; m.mats.forEach(mm=>mm.color.setRGB(bc[0],bc[1],bc[2])); }
  }
  m.aT+=dt;
  if(st==='blackhole' && m.blackhole){ tickBlackholedMob(m, dt); return; }
  if(!m.grp.visible){ /* skip particle work offscreen-space */ }
  else if(st==='slamWind'){
    m.arms[0].rotation.x=m.arms[1].rotation.x=-Math.min(1,m.aT/1.0)*1.4;
    if(Math.random()<dt*34){
      const a2=Math.random()*6.283;
      spawnParticle({x:p.x+Math.cos(a2)*4.3, y:p.y+.15, z:p.z+Math.sin(a2)*4.3,
        vx:0, vy:.5, vz:0, life:.3, grav:0, r:1, g:.55, b:.1});
    }
  } else if(st==='chargeWind'){
    m.arms[0].rotation.x=m.arms[1].rotation.x=.6;
    for(let k2=1;k2<=8;k2++)
      if(Math.random()<dt*8)
        spawnParticle({x:p.x+m.cdx*k2*1.2, y:p.y+.2, z:p.z+m.cdz*k2*1.2,
          vx:0, vy:.6, vz:0, life:.25, grav:0, r:.95, g:.2, b:.15});
  } else if(st==='charge'){
    if(Math.random()<dt*30)
      spawnParticle({x:p.x, y:p.y+.2, z:p.z, vx:0, vy:1.2, vz:0, life:.3, grav:0, r:.5, g:.4, b:.35});
  } else if(st==='volleyWind'){
    m.arms[0].rotation.x=-1.4;
    if(Math.random()<dt*30)
      spawnParticle({x:p.x, y:p.y+1.8, z:p.z, vx:(Math.random()-.5)*1.5, vy:.8, vz:(Math.random()-.5)*1.5,
        life:.3, grav:0, r:.6, g:.3, b:.9});
  } else if(st==='spikeWind'){
    for(let k2=1;k2<=7;k2++)
      if(Math.random()<dt*10)
        spawnParticle({x:p.x+m.cdx*k2*1.35, y:p.y+.15, z:p.z+m.cdz*k2*1.35,
          vx:0, vy:.5, vz:0, life:.3, grav:0, r:.85, g:.55, b:.15});
  } else if(st==='stun'){
    m.arms[0].rotation.x=m.arms[1].rotation.x=.9;
    m.grp.rotation.z=Math.sin(t*6)*.06;
  } else if(st==='frozen'){
    m.arms[0].rotation.x*=.92; m.arms[1].rotation.x*=.92;
    if(m.grp.visible && Math.random()<dt*26)
      spawnParticle({x:p.x+(Math.random()-.5)*.8, y:p.y+.4+Math.random()*1.3, z:p.z+(Math.random()-.5)*.8,
        vx:(Math.random()-.5)*.4, vy:.4+Math.random()*.4, vz:(Math.random()-.5)*.4,
        life:.45, grav:0, r:.6, g:.9, b:1});
  } else if(st==='draw'){
    m.arms[1].rotation.x=-.55;
  } else if(st==='rally'){
    m.arms[0].rotation.x=m.arms[1].rotation.x=-1.7;m.grp.rotation.z=Math.sin(t*14)*.025;
  } else if(st==='captainCleave'){
    const wind=Math.min(1,m.aT/.9);m.arms[0].rotation.x=-.4-wind*1.6;m.arms[1].rotation.x=-1.1-wind*.5;m.grp.rotation.y+=dt*1.8;
  } else if(st==='windup'){
    m.arms[0].rotation.x=m.arms[1].rotation.x=-1.25;
  } else {
    m.grp.rotation.z=0;
    if(!RANGED_ENEMY_KINDS.has(m.kind) && moving){
      m.arms[0].rotation.x=-1.05+Math.sin(t*5+m.phase)*.1;
      m.arms[1].rotation.x=-1.05+Math.cos(t*5+m.phase)*.1;
    } else if(m.arms){
      m.arms[0].rotation.x*= .9; m.arms[1].rotation.x*=.9;
    }
  }
  if(m.boss){
    if(m.cape) m.cape.rotation.x=.16+Math.sin(t*1.6+m.phase)*.05+(moving?.22:0);
    if(m.coreMat){ const k=.8+Math.sin(t*3.2+m.phase)*.2; m.coreMat.color.setRGB(1,.63*k,.24*k); }
    if(m.grp.visible && Math.random()<dt*6)
      spawnParticle({x:p.x+(Math.random()-.5)*1.6, y:p.y+.3+Math.random()*2, z:p.z+(Math.random()-.5)*1.6,
        vx:0, vy:.8, vz:0, life:.5, grav:0, r:.6, g:.12, b:.12});
  }
  if(m.hitT>0){
    m.hitT-=dt;
    if(m.hitT<=0 && st!=='stun' && st!=='frozen'){ const bc=m.baseCol||[1,1,1]; m.mats.forEach(mm=>mm.color.setRGB(bc[0],bc[1],bc[2])); }
  }
}

// ---- server fx + projectiles (visual; damage is server-side) ----
function netFx(m){
  if((m.dgn||'')!==NET.dgn) return;
  if(m.t==='fangBite'){ burst(m.x, m.y, m.z, [.7,.6,.5], 5, 1.6, 1.1, .25); fangSnap(m.x, m.z); return; }
  if(m.t==='soldierStrike'){ shadowSoldierStrikeVfx(m.x, m.y, m.z, m.yaw||0); return; }
  if(m.t==='secondWind'){ healingPlusVfx(m.x, m.y, m.z, 1.05, 1.15); return; }
  if(m.t==='moteBurst'){ burst(m.x, m.y, m.z, [.6,1,.5], 18, 2.2, 2.4, .55); return; }
  if(m.t==='banditCleave'){burst(m.x,m.y+.25,m.z,[1,.18,.08],34,5.2,2.2,.65);camShake=Math.max(camShake,.65);return;}
  if(m.t==='weaponStagger'){
    const color=m.boss?[1,.55,.18]:[1,.85,.35];
    burst(m.x,m.y+.8,m.z,color,m.boss?18:11,m.boss?2.8:2.0,1.8,.35);
    ringPulse(m.x,m.y+.08,m.z,m.boss?2.2:1.35,m.boss?0xff7a24:0xffd75e,.28);
    return;
  }
  if(m.t==='dragonBreath'){
    const col=dragonTrailColor(m.element||'ember');
    burst(m.x, m.y, m.z, col, 22, 3.0, 2.2, .5);
    if(typeof SFX!=='undefined' && SFX.boom) SFX.boom();
    return;
  }
  if(m.t==='blacksmith'){
    blacksmithRitualVfx(m.action||'upgrade',m.id||I.IRON_SWORD,m.plus||0,m.name||'Tobin');
    return;
  }
  if(m.t==='slam'){
    SFX.boom(); camShake=Math.max(camShake,.6);
    burst(m.x, m.y+.3, m.z, [.7,.5,.3], 26, 4.5, 2.5, .6);
    for(let k2=0;k2<36;k2++){
      const a3=k2/36*6.283;
      spawnParticle({x:m.x, y:m.y+.2, z:m.z, vx:Math.cos(a3)*6, vy:.5, vz:Math.sin(a3)*6,
        life:.45, grav:3, r:.75, g:.6, b:.4});
    }
  } else if(m.t==='crash'){
    SFX.boom(); camShake=Math.max(camShake,.55);
    burst(m.x, m.y+1.4, m.z, [.7,.7,.8], 24, 3.5, 2.6, .6);
    sysMsg('The boss crashes into the wall \u2014 <b>stunned!</b>');
  } else if(m.t==='spikes'){
    netSpikes(m);
  } else if(m.t==='warn'){
    SFX.slamWarn();
  } else if(m.t==='roar'){
    SFX.roar();
  } else if(m.t==='growl'){
    SFX.growl();
  } else if(m.t==='cwind'||m.t==='swind'){
    const mob=mobs.find(o=>o.net && o.netId===m.id);
    if(mob){ mob.cdx=m.dx; mob.cdz=m.dz; }
  } else if(m.t==='shardboom'){            // Volatile corpse / Explosive orb detonation
    SFX.boom(); camShake=Math.max(camShake,.4);
    burst(m.x, (m.y||player.pos.y)+.5, m.z, [1,.32,.15], 24, 3.8, 2.5, .55);
    ringPulse(m.x,(m.y||player.pos.y)+.08,m.z,2.2,0xff5a1f,.35);
  } else if(m.t==='quakewarn'){            // Quaking telegraph ring under a hunter
    SFX.slamWarn();
    ringPulse(m.x,player.pos.y+.08,m.z,2.5,0xf59e0b,.95);
    for(let k2=0;k2<5;k2++){
      const a3=Math.random()*6.283;
      spawnParticle({x:m.x+Math.cos(a3)*2.3, y:player.pos.y+.1, z:m.z+Math.sin(a3)*2.3,
        vx:0, vy:.5, vz:0, life:.4, grav:0, r:.85, g:.6, b:.25});
    }
  } else if(m.t==='quake'){                // Quaking shockwave erupts
    SFX.boom(); camShake=Math.max(camShake,.45);
    burst(m.x, player.pos.y+.2, m.z, [.85,.6,.25], 20, 3, 2.2, .5);
    ringPulse(m.x,player.pos.y+.08,m.z,3.1,0xf59e0b,.32);
  } else if(m.t==='ghost'){                // Spiteful vengeful ghost rises
    glowFlash(m.x,player.pos.y+1.1,m.z,0x7dd3fc,2.4,.32);
    burst(m.x, player.pos.y+1, m.z, [.6,.95,1], 12, 2, 2, .5);
    showName('A vengeful ghost rises!');
  } else if(m.t==='blackhole'){
    const mob=mobs.find(o=>o.net && o.netId===m.id);
    if(mob) startBlackholeMob(mob, true);
    else makeBlackholeVisual(m.x, (m.y||player.pos.y)+4.8, m.z);
    showName('Blackhole Staff');
  } else if(m.t==='blackholePop'){
    SFX.boom(); camShake=Math.max(camShake,.42);
    burst(m.x, m.y, m.z, [.55,.18,1], 44, 5.2, 1.2, .75);
  } else if(m.t==='legendary'){
    netLegendaryFx(m);
  } else if(m.t==='ability'){
    netAbilityFx(m);
  } else if(m.t==='dragonAbility'){
    netDragonAbilityFx(m);
  } else if(m.t==='dragonCare'){
    netDragonCareFx(m);
  } else if(m.t==='orb'){                  // Explosive unstable orb spawns
    SFX.cast(); glowFlash(m.x||player.pos.x,(m.y||player.pos.y)+1,m.z||player.pos.z,0xffaa33,2.6,.35); showName('Unstable orb!');
  } else if(m.t==='bleed'){                // Bursting trash death inflicts bleed
    glowFlash(player.pos.x,player.pos.y+1,player.pos.z,0xdc2626,2.4,.28);
    showName('Bursting wound!');
  } else if(m.t==='bolster'){              // Bolstering: a kill emboldens nearby survivors
    glowFlash(m.x,(m.y||player.pos.y)+1,m.z,0xf97316,2.8,.3);
    ringPulse(m.x,(m.y||player.pos.y)+.08,m.z,2.8,0xf97316,.4);
    burst(m.x,(m.y||player.pos.y)+1,m.z,[1,.6,.2],14,2.4,2.2,.5);
    showName('Survivors bolstered!');
  }
}
function netLegendaryFx(m){
  const x=m.x||player.pos.x, y=m.y||player.pos.y, z=m.z||player.pos.z;
  if(m.kind==='chronoMark'){
    chronoSnapVfx(x,y,z);
    showName('Chrono Mark');
  } else if(m.kind==='chronoSnap'){
    chronoSnapVfx(x,y,z);
    showName('Chrono Rewind');
  } else if(m.kind==='titan'){
    titanHammerVfx(x,y,z);
    showName('Titan Hammer');
  } else if(m.kind==='meteorMark'){
    meteorMarkVfx(x,y,z);
    showName('Meteor Incoming');
  } else if(m.kind==='meteorImpact'){
    meteorImpactVfx(x,y,z);
    showName('Meteor Impact');
  } else if(m.kind==='soul'){
    soulReapVfx(x,y,z);
    showName('Soul Reap');
  } else if(m.kind==='gravity'){
    gravityBowVfx(x,y,z);
    showName('Gravity Shot');
  } else if(m.kind==='warden'){
    wardenSonicVfx(x,y,z,m.dx||1,m.dz||0);
    showName('Sonic Boom');
  } else if(m.kind==='eclipse'){
    eclipseDashVfx(m.fromX||x,m.fromY||y,m.fromZ||z,x,y,z);
    showName('Eclipse Dash');
  } else if(m.kind==='phoenix'){
    phoenixFlameVfx(x,y,z,!!m.rebirth);
    showName(m.rebirth?'Phoenix Rebirth':'Phoenix Flame');
  } else if(m.kind==='frostbite'){
    frostbiteChakramVfx(m.points||[{x,y,z}]);
    showName('Frostbite Chakram');
  } else if(m.kind==='midas'){
    midasStrikeVfx(x,y,z,m.bonus||0);
    showName('Midas Strike');
  } else if(m.kind==='leviathan'){
    leviathanStormVfx(m.points||[{x,y,z}]);
    showName('Leviathan Storm');
  } else if(m.kind==='anchor'){
    voidAnchorVfx(x,y,z);
    showName('Void Anchor');
  }
}
function netAbilityFx(m){
  const x=m.x||player.pos.x, y=m.y||player.pos.y, z=m.z||player.pos.z;
  SFX.cast();
  if(m.kind==='fireball'){
    fireballExplodeVfx(x,y,z);
    showName('Fireball');
  } else if(m.kind==='frost'){
    frostNovaVfx(x,y,z,true);
    showName('Frost Nova');
  } else if(m.kind==='lightning'){
    lightningStrikeVfx(x,y,z,m.jumps);
    showName('Lightning');
  } else if(m.kind==='shockwave'){
    shockwaveEarthVfx(x,y,z,true);
    showName('Shockwave');
  } else if(m.kind==='buff'||m.kind==='armor'||m.kind==='dash'||m.kind==='summon'){
    // the caster already played these locally as prediction — this echo is for spectators
    if(m.sid&&NET.room&&m.sid===NET.room.sessionId)return;
    if(m.kind==='buff'){
      ringPulse(x,y+.1,z,1.5,0x8b5cf6,.5);
      burst(x,y+1,z,[.55,.35,1],26,2.8,2.4,.65);
    } else if(m.kind==='armor'){
      ringPulse(x,y+.1,z,1.5,0xf59e0b,.5);
      burst(x,y+1,z,[.95,.78,.3],26,2.6,2.2,.65);
    } else if(m.kind==='dash'){
      const ddx=-Math.sin(m.yaw||0), ddz=-Math.cos(m.yaw||0);
      shadowDashVfx({x,y,z},{x:x+ddx*5.5,y,z:z+ddz*5.5});
      burst(x,y+.7,z,[.45,.24,.9],18,2.2,2.2,.55);
    } else {
      burst(x,y+1,z,[.45,.3,.9],24,2.5,2.4,.6);
    }
  }
}
function netDragonAbilityFx(m){
  const kind=m.kind||'ember';
  const x=m.x||player.pos.x, y=m.y||player.pos.y, z=m.z||player.pos.z;
  const dx=Number.isFinite(+m.dx)?+m.dx:0, dz=Number.isFinite(+m.dz)?+m.dz:-1;
  const len=Math.hypot(dx,dz)||1, ux=dx/len, uz=dz/len;
  const name=(DRAGON_ABILITIES[kind]||DRAGON_ABILITIES.ember).name;
  SFX.cast();
  if(kind==='ember'){
    for(let i=1;i<=9;i++){
      const spread=.25+i*.08;
      burst(x+ux*i*.75+(Math.random()-.5)*spread, y+1+Math.random()*.8, z+uz*i*.75+(Math.random()-.5)*spread,
        [1,.32,.08], 6, 1.7+i*.08, 1.1, .45);
    }
    ringPulse(x+ux*4.4,y+.08,z+uz*4.4,2.2,0xff6a1a,.32);
    showName('Fire Breath');
  } else if(kind==='frost'){
    for(let i=1;i<=8;i++){
      const side=(Math.random()-.5)*(1+i*.32);
      burst(x+ux*i*.65+uz*side, y+.9+Math.random()*.7, z+uz*i*.65-ux*side,
        [.65,.9,1], 5, 1.25, .9, .6);
    }
    ringPulse(x+ux*3.8,y+.08,z+uz*3.8,3.0,0x9bdcff,.45);
    showName('Frost Cone');
  } else if(kind==='storm'){
    const sx=m.fromX||player.pos.x, sy=m.fromY||player.pos.y, sz=m.fromZ||player.pos.z;
    addLightningBeam(sx,sy+1.2,sz,x,y+1.2,z,1.55);
    burst(x,y+1,z,[.72,.55,1],24,2.7,2.2,.45);
    camShake=Math.max(camShake,.18);
    showName('Lightning Dash');
  } else if(kind==='verdant'){
    ringPulse(x,y+.08,z,7.5,0x70f06a,.75);
    for(let i=0;i<34;i++){
      const a=Math.random()*6.283, r=Math.random()*7.2;
      spawnParticle({x:x+Math.cos(a)*r,y:y+.25+Math.random()*1.8,z:z+Math.sin(a)*r,
        vx:(Math.random()-.5)*.35,vy:.45+Math.random()*.7,vz:(Math.random()-.5)*.35,
        life:.7+Math.random()*.5,grav:-.25,r:.45,g:1,b:.42});
    }
    showName('Regen Aura');
  } else if(kind==='void'){
    const sx=m.fromX||player.pos.x, sy=m.fromY||player.pos.y, sz=m.fromZ||player.pos.z;
    burst(sx,sy+1,sz,[.55,.18,1],22,2.4,2.1,.45);
    addLightningBeam(sx,sy+1,sz,x,y+1,z,.8);
    glowFlash(x,y+1,z,0xb86cff,3.4,.38);
    burst(x,y+1,z,[.75,.35,1],28,2.9,2.2,.5);
    showName('Void Blink');
  } else showName(name);
}
function netDragonCareFx(m){
  const kind=m.kind||'ember';
  const x=m.x||player.pos.x, y=m.y||player.pos.y, z=m.z||player.pos.z;
  const col=dragonTrailColor(kind);
  ringPulse(x,y+.08,z,2.6,0xff7aa8,.55);
  for(let i=0;i<24;i++){
    const a=Math.random()*6.283, r=.5+Math.random()*2.4;
    spawnParticle({x:x+Math.cos(a)*r,y:y+.8+Math.random()*1.4,z:z+Math.sin(a)*r,
      vx:(Math.random()-.5)*.45,vy:.55+Math.random()*.65,vz:(Math.random()-.5)*.45,
      life:.65+Math.random()*.45,grav:-.15,r:i%3?col[0]:1,g:i%3?col[1]:.45,b:i%3?col[2]:.7});
  }
  showName('Dragon happiness '+((m.happiness||0)|0));
}
function addLightningBeam(x1,y1,z1,x2,y2,z2,intensity){
  intensity=intensity||1;
  const a=new THREE.Vector3(x1,y1,z1), b=new THREE.Vector3(x2,y2,z2);
  const mid=a.clone().add(b).multiplyScalar(.5);
  const dir=b.clone().sub(a);
  const len=Math.max(.1,dir.length());
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.045*intensity,.09*intensity,len,6),
    new THREE.MeshBasicMaterial({color:0xbfe8ff, transparent:true, opacity:Math.min(.95,.72*intensity), blending:THREE.AdditiveBlending, depthWrite:false}));
  mesh.position.copy(mid);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.normalize());
  scene.add(mesh); beams.push({mesh, life:.2+.06*intensity});
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas), color:0x8fdcff, transparent:true,
    opacity:.3*intensity, depthWrite:false, depthTest:false, blending:THREE.AdditiveBlending}));
  glow.position.copy(mid); glow.scale.set(len*.28,.55*intensity,1);
  scene.add(glow); beams.push({mesh:glow, life:.18+.05*intensity});
}
function netSpikes(m){
  let k=0;
  const iv=setInterval(()=>{
    k++;
    const sx=m.x+m.dx*k*1.35, sz=m.z+m.dz*k*1.35;
    const sy=standHeight(sx,sz,m.y+2);
    burst(sx, (sy>0?sy:m.y)+.3, sz, [.8,.45,.2], 10, 2.4, 3.2, .4);
    SFX.chip('pick');
    if(k>=7) clearInterval(iv);
  }, 110);
}
function netSpawnProjectile(m){
  if((m.dgn||'')!==NET.dgn) return;
  if(m.breath){
    const col=dragonTrailColor(m.element||'ember');
    const grp=new THREE.Group();
    grp.add(new THREE.Mesh(new THREE.BoxGeometry(.34,.34,.34),
      new THREE.MeshBasicMaterial({color:new THREE.Color(col[0],col[1],col[2]), transparent:true, opacity:.9})));
    grp.position.set(m.x,m.y,m.z);
    scene.add(grp);
    arrows.push({grp, vel:new THREE.Vector3(m.vx,m.vy,m.vz), life:1.6, stuck:false, dmg:0, bolt:true, visual:true, breathCol:col});
    if(typeof SFX!=='undefined' && SFX.cast) SFX.cast();
    return;
  }
  if(m.fireball){
    const grp=fireballMesh();
    grp.position.set(m.x,m.y,m.z);
    scene.add(grp);
    arrows.push({grp, vel:new THREE.Vector3(m.vx,m.vy,m.vz), life:2.2, stuck:false, dmg:0, bolt:true, fireball:true, visual:true});
    SFX.cast();
  } else if(m.bolt){
    const grp=new THREE.Group();
    grp.add(new THREE.Mesh(new THREE.BoxGeometry(.2,.2,.2), new THREE.MeshBasicMaterial({color:0x9a4fe0})));
    grp.position.set(m.x,m.y,m.z);
    scene.add(grp);
    arrows.push({grp, vel:new THREE.Vector3(m.vx,m.vy,m.vz), life:2.4, stuck:false, dmg:0, bolt:true, visual:true});
    SFX.cast();
  } else {
    spawnArrow(m.x,m.y,m.z,0, m.x+m.vx, m.y+m.vy, m.z+m.vz);
    const a=arrows[arrows.length-1];
    a.vel.set(m.vx,m.vy,m.vz);
    a.visual=true;
    SFX.bow();
  }
}

// ---- gate mirroring ----
function netFirstGate(){
  if(!NET.room) return null;
  const gates=NET.room.state.gates;
  if(gates && gates.forEach){
    let first=null, best=1e9;
    gates.forEach(g=>{
      if(!g.active) return;
      const d=Math.hypot(g.x-player.pos.x, g.z-player.pos.z);
      if(d<best){ best=d; first=g; }
    });
    if(first) return first;
  }
  return NET.room.state.gate || null;
}
function netMirrorGate(){
  if(dim!=='overworld') return;
  if(!gateSystemUnlocked()){
    clearNetGates();
    gate=null;
    return;
  }
  const seen={};
  const gates=NET.room && NET.room.state.gates;
  if(gates && gates.forEach){
    gates.forEach(g=>{
      if(!g.active) return;
      seen[g.id]=true;
      const shard=(g.shardPlus>0)?{plus:g.shardPlus, name:g.shardName||'', mods:(g.shardMods||'').split(',').filter(Boolean)}:null;
      const tier=shard?(SHARD_TIERS[shard.plus-1]||SHARD_TIERS[0]):null;
      const gateCol=tier?parseInt(tier.col.slice(1),16):RANKS[g.rank].col;
      let local=netGates[g.id];
      if(!local){
        local={id:g.id, x:g.x, y:g.y, z:g.z, rank:g.rank, kind:g.kind||'public', shard, colArr:tier?tier.c3.slice():hex01(RANKS[g.rank].col), grp:makeGateMesh(gateCol)};
        netGates[g.id]=local;
        setGateLabel(local);
        scene.add(local.grp);
        burst(g.x, g.y+1.5, g.z, local.colArr, 30, 3, 3, .9);
      }
      local.x=g.x; local.y=g.y; local.z=g.z; local.rank=g.rank; local.kind=g.kind||'public'; local.shard=shard;
      setGateLabel(local);
      local.grp.position.set(g.x,g.y,g.z);
    });
  } else {
    const g=NET.room ? NET.room.state.gate : null;
    if(g && g.active) seen[g.id||'legacy']=true;
  }
  for(const id in netGates){
    if(seen[id]) continue;
    scene.remove(netGates[id].grp);
    delete netGates[id];
  }
  let closest=null, best=1e9;
  const trackedRank=progressionFocus==='first_d_gate'?1:-1;
  for(const id in netGates){
    const g=netGates[id];
    if(trackedRank>=0&&g.rank!==trackedRank)continue;
    const d=Math.hypot(g.x-player.pos.x, g.z-player.pos.z);
    if(d<best){ best=d; closest=g; }
  }
  if(!closest&&trackedRank>=0)for(const id in netGates){
    const g=netGates[id],d=Math.hypot(g.x-player.pos.x,g.z-player.pos.z);
    if(d<best){best=d;closest=g;}
  }
  gate=closest;
}


  return Object.freeze({
    isAnimalKind,
    netAddMob,
    netRemoveMob,
    netMobTick,
    netFx,
    netDragonAbilityFx,
    netDragonCareFx,
    addLightningBeam,
    netSpawnProjectile,
    netMirrorGate,
  });
}
