import {mobDistanceTierSq,consumeEntityStep} from './performance-budget.mjs';
import {disposeObjectTree} from './three-disposal.mjs';

export function createReplicationVisuals({NET,player,familiarReaction=()=>{},companions=()=>null}){
// ---- server mobs: kind-aware models, state-driven telegraph animation ----
const ANIMAL_BASE_KIND={prairie_hare:'rabbit',forest_stag:'deer',dune_hare:'rabbit',ridge_boar:'boar',frost_stag:'deer',mire_boar:'boar',pack_mule:'deer'};
function isAnimalKind(kind){ return kind==='deer'||kind==='boar'||kind==='rabbit'||!!ANIMAL_BASE_KIND[kind]; }
const RANGED_ENEMY_KINDS=new Set(['skeleton','bone_archer','ash_archer','void_archer','bandit_archer','wind_archer','briar_archer','sun_archer','amber_archer','ice_archer','bog_archer']);
const ENEMY_FAMILY_COLORS={
  husk:[.72,.48,.24],bone_archer:[.78,.67,.48],
  raider:[.64,.25,.18],ash_archer:[.58,.34,.3],
  dreadguard:[.3,.14,.42],void_archer:[.37,.2,.55],
  elite_husk:[1,.54,.18],elite_raider:[.95,.2,.12],elite_dreadguard:[.65,.16,.9],
  bandit:[.42,.29,.18],bandit_archer:[.31,.4,.22],bandit_captain:[.55,.16,.12],
  bandit_shield:[.22,.31,.42],bandit_scout:[.48,.39,.16],bandit_brute:[.5,.2,.16],
  caravan_guard:[.2,.38,.62],caravan_merchant:[.48,.27,.6],
  wounded_hunter:[.32,.46,.58],
  gale_stalker:[.48,.68,.38],wind_archer:[.7,.86,.54],rootbound:[.25,.43,.2],briar_archer:[.38,.55,.27],
  dune_husk:[.76,.58,.29],sun_archer:[.95,.72,.28],redclaw:[.62,.25,.16],amber_archer:[.82,.43,.18],
  frost_wight:[.52,.75,.82],ice_archer:[.7,.92,1],mirewalker:[.28,.39,.22],bog_archer:[.43,.56,.3],
};
const BIOME_HOSTILE_KIND={gale_stalker:'plains',wind_archer:'plains',rootbound:'forest',briar_archer:'forest',dune_husk:'desert',sun_archer:'desert',redclaw:'mesa',amber_archer:'mesa',frost_wight:'snowy',ice_archer:'snowy',mirewalker:'swamp',bog_archer:'swamp'};
const BIOME_VFX={plains:{hex:0xc9f56a,col:[.79,.96,.42]},forest:{hex:0x5ca63c,col:[.36,.65,.24]},desert:{hex:0xffc447,col:[1,.77,.28]},mesa:{hex:0xe0522d,col:[.88,.32,.18]},snowy:{hex:0x8eeaff,col:[.56,.92,1]},swamp:{hex:0x83a94b,col:[.51,.66,.29]}};
const BOSS_CONCEPT_STYLE={
  foreman:{accent:0xff9f2e,particle:'ember',rate:18,scale:1.08,float:0,weapon:'quarry drill'},
  regent:{accent:0x38bdf8,particle:'bubble',rate:18,scale:1.06,float:.04,weapon:'tidal crown'},
  rootkeeper:{accent:0x42d45b,particle:'leaf',rate:15,scale:1.14,float:0,weapon:'root antlers'},
  ossuary:{accent:0xd8d2bc,particle:'bone',rate:13,scale:1.08,float:0,weapon:'bone reliquary'},
  blight:{accent:0x9cff3a,particle:'spore',rate:22,scale:1.06,float:.02,weapon:'fungal crown'},
  watcher:{accent:0x9b7cff,particle:'rift',rate:18,scale:1.07,float:.035,weapon:'vault eye'},
  cinder_smith:{accent:0xff5a1e,particle:'ember',rate:22,scale:1.08,float:0,weapon:'molten hammer'},
  castellan:{accent:0xf4c95d,particle:'smoke',rate:12,scale:1.08,float:0,weapon:'key halberd'},
  choir:{accent:0xa5f3fc,particle:'shard',rate:18,scale:1.03,float:.035,orbit:true,weapon:'crystal staff'},
  void_prior:{accent:0x7c3aed,particle:'incense',rate:14,scale:1.06,float:.025,weapon:'censer'},
  rime_giant:{accent:0x8eeaff,particle:'frost',rate:18,scale:1.24,float:0,weapon:'ice axe'},
  thunder_warden:{accent:0x38bdf8,particle:'lightning',rate:16,scale:1.12,float:0,weapon:'storm spear'},
  buried_monarch:{accent:0xfacc15,particle:'sand',rate:18,scale:1.09,float:0,weapon:'golden khopesh'},
  abyssal_gatekeeper:{accent:0x22d3ee,particle:'bubble',rate:18,scale:1.1,float:.02,weapon:'anchor chain'},
  rift_monarch:{accent:0xf472b6,particle:'rift',rate:24,scale:1.1,float:.12,orbit:true,weapon:'rift scepter'},
};
const EFFECT_BIOME={flanker:'plains',sturdy:'forest',quickshot:'desert',brute:'mesa',frost:'snowy',venom:'swamp',root:'forest'};
function decorateBiomeHostile(m,kind){
  const biome=BIOME_HOSTILE_KIND[kind];if(!biome)return;
  const colors={plains:0xd8ef8a,forest:0x4d6e2e,desert:0xffcb55,mesa:0xb84a28,snowy:0xb9f2ff,swamp:0x71864b};
  const mat=new THREE.MeshLambertMaterial({color:colors[biome]}),dark=new THREE.MeshLambertMaterial({color:{plains:0x496b31,forest:0x2c351f,desert:0x765029,mesa:0x53251d,snowy:0x426879,swamp:0x33402a}[biome]});
  const proportions={gale_stalker:[.94,1.16,.9],wind_archer:[.82,1.14,.82],rootbound:[1.22,1.08,1.16],briar_archer:[.88,1.18,.86],dune_husk:[1.12,.92,1.08],sun_archer:[.84,1.12,.84],redclaw:[1.25,1.12,1.18],amber_archer:[.86,1.14,.84],frost_wight:[1.12,1.2,1.08],ice_archer:[.82,1.22,.82],mirewalker:[1.24,.88,1.18],bog_archer:[.9,1.12,.86]}[kind]||[1,1,1];
  m.grp.scale.set(proportions[0],proportions[1],proportions[2]);m.silhouetteScale={x:proportions[0],y:proportions[1],z:proportions[2]};
  if(biome==='forest'){
    for(const side of [-1,1]){const branch=new THREE.Mesh(new THREE.CylinderGeometry(.035,.055,.72,5),mat);branch.position.set(side*.2,1.95,0);branch.rotation.z=side*.45;m.grp.add(branch);}
  }else if(biome==='desert'){
    const veil=new THREE.Mesh(new THREE.BoxGeometry(.62,.16,.56),mat);veil.position.set(0,1.68,0);veil.rotation.y=.12;m.grp.add(veil);
  }else if(biome==='mesa'){
    for(const side of [-1,1]){const plate=new THREE.Mesh(new THREE.BoxGeometry(.28,.22,.42),mat);plate.position.set(side*.36,1.28,0);plate.rotation.z=side*.22;m.grp.add(plate);}
  }else if(biome==='snowy'){
    for(const side of [-1,0,1]){const spike=new THREE.Mesh(new THREE.ConeGeometry(.08,.5,5),mat);spike.position.set(side*.18,1.84,-.12);spike.rotation.x=-.25;m.grp.add(spike);}
  }else if(biome==='swamp'){
    for(const side of [-1,1]){const cap=new THREE.Mesh(new THREE.SphereGeometry(.16,6,4,0,Math.PI*2,0,Math.PI/2),mat);cap.position.set(side*.2,1.93,0);m.grp.add(cap);}
  }else{
    const crest=new THREE.Mesh(new THREE.ConeGeometry(.11,.5,5),mat);crest.position.set(0,1.98,0);crest.rotation.z=Math.PI;m.grp.add(crest);
  }
  const armItem=(arm,shape,material,pos=[0,-.05,.72],rot=[0,0,0])=>{if(!arm)return;const mesh=new THREE.Mesh(shape,material);mesh.position.set(...pos);mesh.rotation.set(...rot);arm.add(mesh);return mesh;};
  const backItem=(shape,material,pos,rot=[0,0,0])=>{const mesh=new THREE.Mesh(shape,material);mesh.position.set(...pos);mesh.rotation.set(...rot);m.grp.add(mesh);return mesh;};
  if(kind==='gale_stalker'){
    armItem(m.arms[0],new THREE.BoxGeometry(.11,.08,.72),mat,[0,-.04,.82],[0,.35,0]);armItem(m.arms[1],new THREE.BoxGeometry(.11,.08,.72),mat,[0,-.04,.82],[0,-.35,0]);
  }else if(kind==='wind_archer'){
    for(const side of [-1,1])backItem(new THREE.ConeGeometry(.09,.72,4),mat,[side*.22,1.25,-.22],[.35,0,side*.18]);
  }else if(kind==='rootbound'){
    armItem(m.arms[0],new THREE.BoxGeometry(.18,.18,.85),dark,[0,-.03,.82]);armItem(m.arms[1],new THREE.BoxGeometry(.58,.72,.12),mat,[0,0,.62],[0,0,.1]);
  }else if(kind==='briar_archer'){
    for(const side of [-1,0,1])backItem(new THREE.ConeGeometry(.055,.7,5),mat,[.18+side*.07,1.28,-.24],[-.28,0,side*.08]);
  }else if(kind==='dune_husk'){
    const blade=armItem(m.arms[0],new THREE.BoxGeometry(.13,.55,.12),mat,[0,-.2,.78],[.25,0,-.28]);if(blade)blade.geometry.translate(0,-.2,0);
  }else if(kind==='sun_archer'){
    const disk=backItem(new THREE.TorusGeometry(.3,.075,6,16),mat,[0,1.35,-.25],[Math.PI/2,0,0]);disk.rotation.z=.2;
  }else if(kind==='redclaw'){
    armItem(m.arms[0],new THREE.CylinderGeometry(.055,.07,.9,6),dark,[0,-.2,.78],[0,0,.25]);armItem(m.arms[0],new THREE.BoxGeometry(.56,.28,.3),mat,[0,-.58,.82],[0,0,.18]);
  }else if(kind==='amber_archer'){
    backItem(new THREE.BoxGeometry(.28,.72,.2),mat,[.18,1.2,-.25],[-.18,0,-.1]);
  }else if(kind==='frost_wight'){
    for(const arm of m.arms)for(const side of [-.05,.05])armItem(arm,new THREE.ConeGeometry(.035,.42,5),mat,[side,-.05,.85],[Math.PI/2,0,0]);
  }else if(kind==='ice_archer'){
    for(const side of [-1,0,1])backItem(new THREE.ConeGeometry(.065,.82,5),mat,[.17+side*.08,1.3,-.24],[-.22,0,side*.08]);
  }else if(kind==='mirewalker'){
    armItem(m.arms[1],new THREE.CylinderGeometry(.38,.42,.12,10),mat,[0,0,.66],[Math.PI/2,0,0]);armItem(m.arms[0],new THREE.BoxGeometry(.2,.2,.7),dark,[0,-.04,.78]);
  }else if(kind==='bog_archer'){
    for(const side of [-1,0,1])backItem(new THREE.CylinderGeometry(.025,.035,.68,5),side?dark:mat,[.17+side*.08,1.25,-.24],[-.2,0,side*.05]);
  }
  if(biome==='mesa'||biome==='plains'){
    const radius=biome==='mesa'?3.8:1.15,vfx=BIOME_VFX[biome];
    const tell=new THREE.Mesh(new THREE.RingGeometry(radius-.11,radius,48),new THREE.MeshBasicMaterial({color:vfx.hex,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,depthTest:false}));
    tell.rotation.x=-Math.PI/2;tell.position.y=.07;tell.visible=false;tell.userData.inverseScale={x:1/proportions[0],y:1/proportions[2],z:1/proportions[1]};tell.scale.set(tell.userData.inverseScale.x,tell.userData.inverseScale.y,tell.userData.inverseScale.z);m.grp.add(tell);m.biomeTell=tell;
  }
}
function tintModel(m,col){
  if(!m||!m.mats)return;
  m.baseCol=col;
  for(const mm of m.mats)if(mm&&mm.color)mm.color.setRGB(col[0],col[1],col[2]);
}
function brightenBossBody(m,hex){
  if(!m||!m.mats)return;
  const c=new THREE.Color(hex);
  for(const mm of m.mats){
    if(!mm||!mm.color)continue;
    mm.color.lerp(c,.38);
    if(mm.emissive){mm.emissive.copy(c);mm.emissiveIntensity=.26;}
  }
}
function material(hex,glow=false){ return glow?new THREE.MeshBasicMaterial({color:hex}):new THREE.MeshLambertMaterial({color:hex}); }
function additiveMat(hex,opacity=.75){return new THREE.MeshBasicMaterial({color:hex,transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false});}
function attachBox(parent,size,pos,hex,rot=[0,0,0],glow=false){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(size[0],size[1],size[2]),material(hex,glow));
  mesh.position.set(pos[0],pos[1],pos[2]);mesh.rotation.set(rot[0],rot[1],rot[2]);parent.add(mesh);return mesh;
}
function markBossGlow(mesh,pulse=1){if(mesh)mesh.userData.bossGlow=pulse;return mesh;}
function attachBlade(parent,hex,glowHex,pos=[0,-.04,.95],length=.9){
  if(!parent)return null;
  const blade=attachBox(parent,[.12,length,.12],pos,hex,[.52,0,.24],true);
  blade.geometry.translate(0,-length*.35,0);markBossGlow(blade,.9);
  const edge=attachBox(parent,[.04,length*.86,.2],[pos[0]+.05,pos[1]-.08,pos[2]+.04],glowHex,[.52,0,.24],true);
  markBossGlow(edge,1.2);return blade;
}
function attachHammer(parent,hex,glowHex){
  if(!parent)return null;
  const haft=attachBox(parent,[.09,.09,.9],[0,-.04,.9],0x3a2414,[0,0,.2]);
  const head=attachBox(parent,[.54,.32,.38],[0,-.27,1.18],hex,[0,0,.18]);
  const core=attachBox(parent,[.38,.18,.42],[0,-.27,1.2],glowHex,[0,0,.18],true);
  markBossGlow(core,1.35);return {haft,head,core};
}
function attachStaff(parent,hex,glowHex,top='orb'){
  if(!parent)return null;
  const staff=attachBox(parent,[.08,1.28,.08],[0,-.15,.88],hex,[.18,0,-.18]);
  const head=top==='cross'
    ? attachBox(parent,[.52,.08,.08],[0,-.82,1.02],glowHex,[.18,0,-.18],true)
    : new THREE.Mesh(top==='spear'?new THREE.ConeGeometry(.13,.48,5):new THREE.OctahedronGeometry(.18),material(glowHex,true));
  if(top!=='cross'){head.position.set(0,-.84,1.04);head.rotation.set(.18,0,-.18);parent.add(head);}
  markBossGlow(head,1.2);return {staff,head};
}
function attachChain(parent,x,z,hex=0x171717,count=5){
  for(let i=0;i<count;i++){
    const link=new THREE.Mesh(new THREE.TorusGeometry(.07,.018,5,10),material(hex));
    link.position.set(x,.95-i*.12,z);link.rotation.set(Math.PI/2,(i&1)?Math.PI/2:0,0);parent.add(link);
  }
}
function attachTatteredRobe(parent,hex,trimHex=0xc9a13b,width=.82,height=.95){
  const robe=attachBox(parent,[width,height,.11],[0,.68,-.24],hex,[-.05,0,0]);
  attachBox(parent,[width*.82,.06,.13],[0,1.08,-.25],trimHex);
  for(const sx of [-.28,0,.28])attachBox(parent,[.12,.34,.12],[sx,.18,-.25],hex,[sx*.25,0,0]);
  return robe;
}
function attachFloatingShards(parent,hex,count=6,radius=.86,y=.95){
  for(let i=0;i<count;i++){
    const shard=new THREE.Mesh(new THREE.OctahedronGeometry(.1+(i%2)*.035),material(hex,true));
    const a=i/count*Math.PI*2;shard.position.set(Math.cos(a)*radius,y+(i%3)*.24,Math.sin(a)*radius);
    shard.userData.bossOrbit={speed:.8+i*.08,radius,angle:a,y:shard.position.y};
    markBossGlow(shard,.75);parent.add(shard);
  }
}
function attachTentacles(parent,hex,count=6,radius=.56){
  for(let i=0;i<count;i++){
    const a=i/count*Math.PI*2,seg=new THREE.Group();
    for(let j=0;j<4;j++){
      const part=new THREE.Mesh(new THREE.CylinderGeometry(.045-.006*j,.065-.006*j,.34,6),material(hex));
      part.position.y=.95-j*.18;part.rotation.z=Math.sin(j*.7)*.18;seg.add(part);
    }
    seg.position.set(Math.cos(a)*radius,0,Math.sin(a)*radius);seg.rotation.z=.45;seg.rotation.y=-a;parent.add(seg);
  }
}
function attachCrown(parent,hex=0xc9a13b,gems=0x22d3ee){
  if(!parent)return;
  attachBox(parent,[.58,.09,.48],[0,.36,.02],hex);
  for(const sx of [-.24,-.08,.08,.24]){
    const spike=attachBox(parent,[.06,.3,.06],[sx,.52,.05],hex,[0,0,sx*.7]);
    const gem=attachBox(parent,[.06,.06,.07],[sx,.63,.09],gems,[0,0,0],true);markBossGlow(gem,.9);markBossGlow(spike,.35);
  }
}
function attachRiftFragments(parent,hex,count=9,radius=1.1){
  for(let i=0;i<count;i++){
    const frag=new THREE.Mesh(new THREE.BoxGeometry(.16,.32,.09),material(hex,true));
    const a=i/count*Math.PI*2;frag.position.set(Math.cos(a)*radius,.8+(i%4)*.32,Math.sin(a)*radius);
    frag.rotation.set(i*.7,a,i*.37);frag.userData.bossOrbit={speed:.55+i*.06,radius,angle:a,y:frag.position.y};
    markBossGlow(frag,1);parent.add(frag);
  }
}
function attachBossReadableSilhouette(m,style,hex){
  const g=m&&m.grp;if(!g)return;
  const glow=additiveMat(hex,.78),solid=material(hex,true);
  const box=(size,pos,rot=[0,0,0],mat=glow)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(size[0],size[1],size[2]),mat);mesh.position.set(pos[0],pos[1],pos[2]);mesh.rotation.set(rot[0],rot[1],rot[2]);mesh.userData.bossGlow=.7;g.add(mesh);return mesh;};
  if(style==='choir'){for(const sx of [-1,1])for(let i=0;i<5;i++)box([.08,.9,.08],[sx*(.58+i*.16),1.18+i*.1,-.42],[.25,0,sx*(.45+i*.13)]);}
  else if(style==='rift_monarch'){box([.18,2.2,.18],[0,1.1,-.46],[0,0,0]);attachRiftFragments(g,hex,14,1.55);}
  else if(style==='thunder_warden'){box([.12,2.3,.12],[.52,1.55,-.38],[.18,0,-.18]);box([.44,.1,.12],[.52,2.65,-.38],[0,0,-.18]);}
  else if(style==='rime_giant'){for(const sx of [-1,1])box([.14,.9,.14],[sx*.42,2.08,-.22],[0,0,sx*.7]);box([.7,.12,.16],[0,1.95,-.42],[0,0,0]);}
  else if(style==='cinder_smith'||style==='foreman'){box([.34,.34,.72],[.64,1.12,-.36],[.2,0,-.35]);box([.08,1.35,.08],[.46,1.25,-.3],[0,0,.22]);}
  else if(style==='castellan'){for(const sx of [-.62,0,.62]){box([.2,.9,.2],[sx,1.78,-.46]);box([.32,.12,.24],[sx,2.28,-.46]);}}
  else if(style==='buried_monarch'){for(const sx of [-.5,-.25,0,.25,.5])box([.08,.7,.08],[sx,2.02,-.34],[0,0,sx*.8]);}
  else if(style==='abyssal_gatekeeper'){for(const sx of [-.72,-.42,.42,.72])box([.1,1.1,.1],[sx,1.45,-.45],[.35,0,sx>0?-.7:.7]);}
  else if(style==='void_prior'){box([.85,1.28,.08],[0,1.1,-.48],[-.08,0,0],additiveMat(0x1b1038,.72));box([.48,.48,.1],[0,1.86,-.44],[0,0,0],solid);}
  else if(style==='rootkeeper'){for(const sx of [-.56,-.28,.28,.56])box([.08,.9,.08],[sx,1.98,-.34],[0,0,sx>0?-1:1]);}
  else if(style==='regent'){for(const sx of [-.44,0,.44])box([.08,.9,.08],[sx,1.92,-.34],[0,0,sx*.5]);}
  else if(style==='ossuary'){for(const sx of [-.45,-.18,.18,.45])box([.08,.8,.08],[sx,1.82,-.36],[0,0,sx*.65],additiveMat(0xf8fafc,.72));}
  else if(style==='watcher'){const ring=new THREE.Mesh(new THREE.TorusGeometry(.72,.055,8,32),glow);ring.position.set(0,1.58,-.46);ring.rotation.x=Math.PI/2;ring.userData.bossGlow=1.2;g.add(ring);}
}
function scalePart(part,scale,pos){
  if(!part)return;
  part.scale.set(scale[0],scale[1],scale[2]);
  if(pos)part.position.set(pos[0],pos[1],pos[2]);
}
function bossPlanBox(m,size,pos,hex,rot=[0,0,0],glow=false){
  const b=attachBox(m.grp,size,pos,hex,rot,glow);
  if(glow)markBossGlow(b,1);
  return b;
}
function applyBossBodyPlan(m,style,hex){
  if(!m||!m.grp||m.bossBodyPlan)return;m.bossBodyPlan=style;
  const arms=m.arms||[],legs=m.legs||[],head=m.head;
  if(style==='cinder_smith'){scalePart(head,[1.18,.86,1.12],[0,1.58,.04]);arms.forEach((a,i)=>scalePart(a,[i?1.75:1.05,1.2,1.55],[i? .46:-.42,1.23,.08]));legs.forEach((l,i)=>scalePart(l,[1.35,.78,1.25],[i?.23:-.23,.64,0]));bossPlanBox(m,[1.05,.36,.5],[0,1.05,.03],0x2a1410);m.grp.scale.set(1.18,.9,1.08);}
  else if(style==='castellan'){scalePart(head,[1.05,1.28,1.05],[0,1.86,.02]);arms.forEach((a,i)=>scalePart(a,[.92,1.55,.95],[i?.54:-.54,1.36,.06]));legs.forEach((l,i)=>scalePart(l,[.95,1.2,.9],[i?.2:-.2,.78,0]));for(const x of [-.38,0,.38])bossPlanBox(m,[.22,1.65,.24],[x,1.42,-.34],0x2d2d34);m.grp.scale.set(1.05,1.18,1.02);}
  else if(style==='choir'){scalePart(head,[.72,1.35,.72],[0,1.95,.05]);arms.forEach((a,i)=>scalePart(a,[.56,1.75,.56],[i?.42:-.42,1.38,.08]));legs.forEach((l,i)=>scalePart(l,[.48,1.35,.48],[i?.12:-.12,.72,0]));bossPlanBox(m,[.45,1.35,.28],[0,1.02,.02],0x4c1d95);m.grp.scale.set(.86,1.28,.86);}
  else if(style==='void_prior'){scalePart(head,[1.05,1.45,1.05],[0,1.9,.02]);arms.forEach((a,i)=>scalePart(a,[.62,1.95,.62],[i?.48:-.48,1.32,.05]));legs.forEach((l,i)=>scalePart(l,[.24,.28,.24],[i?.08:-.08,.32,0]));bossPlanBox(m,[.9,1.55,.34],[0,.88,.02],0x080712);m.grp.scale.set(.92,1.22,.92);}
  else if(style==='rime_giant'){scalePart(head,[1.35,1.12,1.25],[0,1.78,.03]);arms.forEach((a,i)=>scalePart(a,[1.85,1.55,1.75],[i?.62:-.62,1.18,.08]));legs.forEach((l,i)=>scalePart(l,[1.55,1.2,1.45],[i?.28:-.28,.7,0]));bossPlanBox(m,[1.15,.95,.55],[0,1.08,.02],0x334155);m.grp.scale.set(1.35,1.3,1.25);}
  else if(style==='thunder_warden'){scalePart(head,[1.15,1.25,1.1],[0,1.9,.02]);arms.forEach((a,i)=>scalePart(a,[1.28,1.85,1.2],[i?.56:-.56,1.32,.06]));legs.forEach((l,i)=>scalePart(l,[1.05,1.35,1.02],[i?.2:-.2,.72,0]));bossPlanBox(m,[.82,1.15,.42],[0,1.18,.03],0x1f2937);m.grp.scale.set(1.08,1.34,1.08);}
  else if(style==='buried_monarch'){scalePart(head,[.92,1.08,.86],[0,1.9,.03]);arms.forEach((a,i)=>scalePart(a,[.72,1.7,.72],[i?.48:-.48,1.28,.06]));legs.forEach((l,i)=>scalePart(l,[.65,1.45,.62],[i?.16:-.16,.72,0]));bossPlanBox(m,[.54,1.05,.28],[0,1.02,.02],0x8a5a18);m.grp.scale.set(.92,1.26,.9);}
  else if(style==='abyssal_gatekeeper'){scalePart(head,[1.42,1.05,1.28],[0,1.62,.03]);arms.forEach((a,i)=>scalePart(a,[1.75,1.28,1.6],[i?.64:-.64,1.18,.08]));legs.forEach((l,i)=>scalePart(l,[1.22,.75,1.18],[i?.24:-.24,.58,0]));bossPlanBox(m,[1.05,.9,.55],[0,.98,.03],0x083344);m.grp.scale.set(1.22,1.02,1.16);}
  else if(style==='rift_monarch'){scalePart(head,[1.05,1.2,1.05],[0,2.04,.03]);arms.forEach((a,i)=>scalePart(a,[.8,1.95,.8],[i?.54:-.54,1.42,.05]));legs.forEach((l,i)=>scalePart(l,[.12,.12,.12],[i?.04:-.04,.22,0]));bossPlanBox(m,[.76,1.15,.28],[0,1.16,.02],0x1e1b4b);m.grp.scale.set(.98,1.22,.98);}
  else if(style==='foreman'){scalePart(head,[1.08,.82,1.06],[0,1.54,.03]);arms.forEach((a,i)=>scalePart(a,[i?1.2:1.8,1.1,1.55],[i?.42:-.5,1.16,.08]));legs.forEach((l,i)=>scalePart(l,[1.22,.72,1.12],[i?.22:-.22,.58,0]));bossPlanBox(m,[.98,.48,.48],[0,1.0,.03],0x5b3b1e);m.grp.scale.set(1.16,.9,1.08);}
  else if(style==='regent'){scalePart(head,[.86,1.16,.86],[0,1.92,.03]);arms.forEach((a,i)=>scalePart(a,[.58,1.8,.58],[i?.46:-.46,1.34,.06]));legs.forEach((l,i)=>scalePart(l,[.32,.48,.32],[i?.1:-.1,.42,0]));bossPlanBox(m,[.62,1.1,.28],[0,1.02,.02],0x0f3d56,[0,0,0],true);m.grp.scale.set(.9,1.18,.9);}
  else if(style==='rootkeeper'){scalePart(head,[1.18,1.08,1.1],[0,1.72,.03]);arms.forEach((a,i)=>scalePart(a,[1.45,1.75,1.18],[i?.58:-.58,1.18,.06]));legs.forEach((l,i)=>scalePart(l,[.75,1.55,.75],[i?.22:-.22,.66,0]));bossPlanBox(m,[.78,1.15,.42],[0,.98,.02],0x254b24);m.grp.scale.set(1.08,1.2,1.05);}
  else if(style==='ossuary'){scalePart(head,[.95,.95,.86],[0,1.82,.03]);arms.forEach((a,i)=>scalePart(a,[.7,1.6,.65],[i?.44:-.44,1.22,.06]));legs.forEach((l,i)=>scalePart(l,[.58,1.45,.55],[i?.15:-.15,.66,0]));bossPlanBox(m,[.5,1.05,.24],[0,1.0,.03],0xd8d2bc,[0,0,0],true);m.grp.scale.set(.88,1.18,.86);}
  else if(style==='watcher'){scalePart(head,[1.45,1.1,1.35],[0,1.72,.03]);arms.forEach((a,i)=>scalePart(a,[.42,1.45,.42],[i?.58:-.58,1.2,.06]));legs.forEach((l,i)=>scalePart(l,[.22,.18,.22],[i?.06:-.06,.28,0]));bossPlanBox(m,[.7,.7,.22],[0,1.18,.06],0x312e81,[0,0,0],true);m.grp.scale.set(1.0,1.02,1);}
}
function decorateDungeonVariant(m,ref){
  const v=ref.variant||'';if(!v||!m||m.dungeonVariant)return;m.dungeonVariant=v;
  const bossy=v.includes('guard')||v==='graveguard';
  if(v==='miner'||v==='mine_guard'){
    tintModel(m,v==='mine_guard'?[.62,.52,.36]:[.55,.44,.28]);
    if(m.head){attachBox(m.head,[.42,.08,.34],[0,.31,.02],0x5b3b1e);attachBox(m.head,[.14,.08,.06],[0,.31,.27],0xffc85a,[0,0,0],true);}
    if(m.arms&&m.arms[0])attachBox(m.arms[0],[.08,.08,.62],[0,-.04,.86],0x6e4a26,[.2,0,.25]);
  }else if(v==='drowned'){
    tintModel(m,[.38,.68,.76]);
    if(m.head)attachBox(m.head,[.36,.07,.18],[0,.28,-.02],0x78d5e8);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.55,.025,8,28),new THREE.MeshBasicMaterial({color:0x38bdf8,transparent:true,opacity:.55,blending:THREE.AdditiveBlending,depthWrite:false}));
    ring.rotation.x=Math.PI/2;ring.position.y=.07;m.grp.add(ring);m.waterAura=ring;
  }else if(v==='mossbound'||v==='blighted'){
    tintModel(m,v==='blighted'?[.38,.76,.24]:[.32,.55,.24]);
    if(m.head){for(const sx of [-.16,.16]){const cap=new THREE.Mesh(new THREE.SphereGeometry(.13,6,4,0,Math.PI*2,0,Math.PI/2),material(v==='blighted'?0x9cff3a:0x5ca63c));cap.position.set(sx,.32,.03);m.head.add(cap);}}
    for(const sx of [-.18,.18])attachBox(m.grp,[.06,.46,.06],[sx,1.45,-.24],v==='blighted'?0x5cd85c:0x355f2b,[-.35,0,sx]);
  }else if(v==='ossuary'||v==='ossuary_guard'){
    tintModel(m,[.78,.7,.52]);
    if(m.head){for(const sx of [-.18,.18])attachBox(m.head,[.07,.34,.07],[sx,.42,.02],0xd8d2bc,[0,0,sx>0?-.55:.55]);}
    for(let i=0;i<3;i++)attachBox(m.grp,[.08,.28-i*.04,.08],[0,1.48-i*.22,-.24],0xd8d2bc,[.4,0,0]);
  }else if(v==='watcher'||v==='vault'||v==='vault_guard'){
    tintModel(m,[.58,.48,.78]);
    if(m.head)attachBox(m.head,[.42,.08,.08],[0,.05,.27],0x9b7cff,[0,0,0],true);
    for(const sx of [-.34,.34])attachBox(m.grp,[.24,.14,.32],[sx,1.4,.02],0x6b5a8d);
  }else if(v==='charger'){
    tintModel(m,[.68,.38,.25]);m.grp.scale.set(1.08,.95,1.12);
    if(m.arms)for(const arm of m.arms)attachBox(arm,[.04,.04,.18],[0,-.08,1.0],0xff5a1e,[0,0,0],true);
  }else if(v==='graveguard'){
    tintModel(m,[.48,.42,.52]);m.grp.scale.set(1.16,1.05,1.1);
    attachBox(m.grp,[.34,.18,.44],[-.38,1.34,.02],0x3d3748);
    if(m.arms&&m.arms[1])attachBox(m.arms[1],[.46,.62,.08],[0,.02,.6],0x43384f);
  }
  if(bossy&&!m.elite){const aura=new THREE.Mesh(new THREE.TorusGeometry(.68,.03,8,30),new THREE.MeshBasicMaterial({color:0x7c3aed,transparent:true,opacity:.48,blending:THREE.AdditiveBlending,depthWrite:false}));aura.rotation.x=Math.PI/2;aura.position.y=.06;m.grp.add(aura);m.variantAura=aura;}
}
function decorateBossStyle(m,ref){
  const s=ref.bossStyle||'';if(!m||!m.boss||!s||m.bossDecoratedStyle)return;m.bossDecoratedStyle=s;
  const styles={
    foreman:{col:[.82,.42,.18],hex:0xff8a2a,parts:()=>{if(m.head){attachBox(m.head,[.5,.12,.42],[0,.34,.02],0x6e4a26);markBossGlow(attachBox(m.head,[.2,.12,.07],[0,.34,.31],0xffc85a,[0,0,0],true),1.1);}for(const sx of [-.5,.5])attachBox(m.grp,[.28,.5,.32],[sx,1.36,.02],0x704321);if(m.arms&&m.arms[0]){const drill=new THREE.Mesh(new THREE.ConeGeometry(.22,.95,6),material(0xffc85a,true));drill.position.set(0,-.05,1.08);drill.rotation.x=Math.PI/2;m.arms[0].add(markBossGlow(drill,1.2));}for(const sx of [-.33,.33])attachBox(m.grp,[.12,.95,.12],[sx,1.18,-.32],0x5b3b1e,[-.18,0,sx]);}},
    regent:{col:[.22,.7,.95],hex:0x38bdf8,parts:()=>{if(m.head){attachCrown(m.head,0x0e7490,0x67e8f9);for(const sx of [-.22,0,.22])markBossGlow(attachBox(m.head,[.07,sx?.22:.34,.07],[sx,.49,.05],0x78d5e8,[0,0,sx>0?-.25:sx<0?.25:0],true),.8);}attachTatteredRobe(m.grp,0x0f3d56,0x38bdf8,.82,.9);attachFloatingShards(m.grp,0x38bdf8,7,1.08,.9);if(m.arms&&m.arms[1])attachStaff(m.arms[1],0x075985,0x67e8f9,'orb');}},
    rootkeeper:{col:[.28,.72,.28],hex:0x42d45b,parts:()=>{if(m.head){for(const sx of [-.25,.25])attachBox(m.head,[.1,.62,.1],[sx,.55,.02],0x355f2b,[0,0,sx>0?-.85:.85]);for(const sx of [-.42,.42])attachBox(m.head,[.08,.38,.08],[sx,.46,.02],0x42d45b,[0,0,sx>0?-1.2:1.2],true);}for(const sx of [-.38,0,.38])attachBox(m.grp,[.09,1.1,.09],[sx,1.18,-.36],0x355f2b,[-.28,0,sx]);attachTentacles(m.grp,0x254b24,5,.46);}},
    ossuary:{col:[.78,.68,.45],hex:0xd8d2bc,parts:()=>{if(m.head){attachBox(m.head,[.36,.32,.09],[0,.03,.31],0xd8d2bc);for(const sx of [-.28,-.12,.12,.28])attachBox(m.head,[.06,.38,.06],[sx,.48,.04],0xf4ecd2,[0,0,sx*.9],true);}for(let i=0;i<7;i++)attachBox(m.grp,[.09,.42-i*.035,.09],[0,1.72-i*.16,-.3],0xd8d2bc,[.35,0,0]);for(const sx of [-.48,.48])attachBox(m.grp,[.24,.62,.1],[sx,1.32,.24],0xf4ecd2,[0,0,sx*.35]);if(m.arms&&m.arms[1])attachStaff(m.arms[1],0xd8d2bc,0xf8fafc,'cross');}},
    blight:{col:[.42,.92,.22],hex:0x9cff3a,parts:()=>{if(m.head){for(const sx of [-.2,0,.2]){const cap=new THREE.Mesh(new THREE.SphereGeometry(.17+(sx?0:.05),8,5,0,Math.PI*2,0,Math.PI/2),material(0x9cff3a,true));cap.position.set(sx,.42,.04);markBossGlow(cap,1);m.head.add(cap);}}attachTentacles(m.grp,0x375f1d,8,.5);attachTatteredRobe(m.grp,0x1a2e05,0x9cff3a,.76,.78);}},
    watcher:{col:[.58,.42,.95],hex:0x9b7cff,parts:()=>{if(m.head){markBossGlow(attachBox(m.head,[.54,.2,.1],[0,.04,.31],0x9b7cff,[0,0,0],true),1.4);attachBox(m.head,[.18,.18,.12],[0,.04,.38],0xe9d5ff,[0,0,0],true);}for(const sx of [-.58,.58])attachBox(m.grp,[.3,.44,.26],[sx,1.5,.02],0x5b4b88);attachRiftFragments(m.grp,0x9b7cff,6,1.05);if(m.arms&&m.arms[0])attachStaff(m.arms[0],0x312e81,0xc084fc,'orb');}},
    cinder_smith:{col:[.95,.34,.12],hex:0xff5a1e,parts:()=>{if(m.head){attachBox(m.head,[.52,.18,.4],[0,.34,.02],0x24120d);markBossGlow(attachBox(m.head,[.28,.12,.08],[0,.06,.31],0xff5a1e,[0,0,0],true),1.25);attachBox(m.head,[.12,.18,.08],[-.18,.43,.02],0x525252);attachBox(m.head,[.12,.18,.08],[.18,.43,.02],0x525252);}attachBox(m.grp,[.42,.42,.14],[0,1.22,.32],0x2a1410);markBossGlow(attachBox(m.grp,[.26,.34,.16],[0,1.22,.39],0xff5a1e,[0,0,0],true),1.35);for(const sx of [-.52,.52])attachBox(m.grp,[.26,.5,.34],[sx,1.38,.02],0x3a2f2b);if(m.arms&&m.arms[1])attachHammer(m.arms[1],0x2f2420,0xff6a1c);attachTatteredRobe(m.grp,0x3b1611,0xff8a2a,.58,.72);}},
    castellan:{col:[.48,.48,.56],hex:0xf4c95d,parts:()=>{if(m.head){attachBox(m.head,[.56,.34,.48],[0,.18,.02],0x2d2d34);markBossGlow(attachBox(m.head,[.24,.18,.08],[0,.14,.3],0xff8a2a,[0,0,0],true),.9);for(const sx of [-.24,0,.24])attachBox(m.head,[.08,.28,.08],[sx,.48,.04],0xc9a13b,[0,0,sx*.8]);}for(const sx of [-.56,.56]){attachBox(m.grp,[.34,.34,.36],[sx,1.55,.02],0x35343d);attachBox(m.grp,[.18,.42,.16],[sx,1.82,.02],0xc9a13b);}attachTatteredRobe(m.grp,0x2b173c,0xc9a13b,.72,.86);if(m.arms&&m.arms[0])attachStaff(m.arms[0],0x3b3328,0xf4c95d,'spear');attachChain(m.grp,-.42,-.24,0x1b1714,6);attachChain(m.grp,.42,-.24,0x1b1714,6);}},
    choir:{col:[.72,.9,1],hex:0x9eeaff,parts:()=>{if(m.head){for(const sx of [-.18,0,.18])markBossGlow(attachBox(m.head,[.06,.34,.06],[sx,.44,.05],0xdff8ff,[0,0,sx*-1.1],true),1.1);attachBox(m.head,[.32,.38,.08],[0,.05,.32],0xf8fbff,[0,0,0],true);}attachTatteredRobe(m.grp,0x4c1d95,0xa5f3fc,.8,1);for(const sx of [-.48,-.26,.26,.48])markBossGlow(attachBox(m.grp,[.08,.9,.08],[sx,1.2,-.34],0xa5f3fc,[.45,0,sx],true),.8);attachFloatingShards(m.grp,0x9eeaff,8,1.05,1);if(m.arms&&m.arms[0])attachStaff(m.arms[0],0xdff8ff,0xc084fc,'orb');markCrystalHalo(m.grp,0x9eeaff,1.1);}},
    void_prior:{col:[.34,.24,.58],hex:0x7c3aed,parts:()=>{if(m.head){attachBox(m.head,[.52,.42,.45],[0,.08,.01],0x090716);attachBox(m.head,[.34,.22,.09],[0,.04,.31],0x05040a);markBossGlow(attachBox(m.head,[.08,.08,.1],[0,.04,.36],0x7c3aed,[0,0,0],true),1.2);}attachTatteredRobe(m.grp,0x0d0a1f,0x9b7cff,.82,1.15);for(const sx of [-.34,.34])attachBox(m.grp,[.08,.9,.08],[sx,1.48,-.26],0x170b2e,[.28,0,sx]);if(m.arms&&m.arms[1])attachStaff(m.arms[1],0x2f2446,0xb394ff,'cross');if(m.arms&&m.arms[0])attachChain(m.arms[0],0,.85,0x16121f,7);}},
    rime_giant:{col:[.55,.84,1],hex:0x8eeaff,parts:()=>{if(m.head){for(const sx of [-.28,.28])markBossGlow(attachBox(m.head,[.12,.54,.12],[sx,.48,.02],0xc9f6ff,[0,0,sx*.85],true),.8);markBossGlow(attachBox(m.head,[.26,.08,.08],[0,.06,.31],0x38bdf8,[0,0,0],true),1.2);}for(const sx of [-.55,.55])attachBox(m.grp,[.34,.58,.34],[sx,1.44,.02],0x476275);for(const sx of [-.28,0,.28])attachBox(m.grp,[.07,.42,.07],[sx,1.88,-.16],0xc9f6ff,[0,0,sx*.4],true);if(m.arms&&m.arms[1])attachBlade(m.arms[1],0x93c5fd,0xc9f6ff,[0,-.04,.98],1.15);m.grp.scale.multiplyScalar(1.12);}},
    thunder_warden:{col:[.42,.5,.9],hex:0x7dd3fc,parts:()=>{if(m.head){attachCrown(m.head,0x3f3f46,0x38bdf8);markBossGlow(attachBox(m.head,[.34,.12,.08],[0,.05,.31],0x38bdf8,[0,0,0],true),1.3);}for(const sx of [-.52,.52])attachBox(m.grp,[.3,.5,.36],[sx,1.42,.02],0x272d3c);for(const sx of [-.45,.45])markBossGlow(attachBox(m.grp,[.08,.9,.08],[sx,1.48,-.24],0x7dd3fc,[.45,0,sx*.5],true),1.1);if(m.arms&&m.arms[0])attachStaff(m.arms[0],0x334155,0x7dd3fc,'spear');attachFloatingShards(m.grp,0x38bdf8,5,1.05,1.15);}},
    buried_monarch:{col:[.72,.5,.28],hex:0xfacc15,parts:()=>{if(m.head){attachCrown(m.head,0xfacc15,0x22d3ee);attachBox(m.head,[.28,.3,.09],[0,.04,.31],0xead7a1);markBossGlow(attachBox(m.head,[.08,.08,.1],[-.08,.08,.36],0xfff1a8,[0,0,0],true),1);markBossGlow(attachBox(m.head,[.08,.08,.1],[.08,.08,.36],0xfff1a8,[0,0,0],true),1);}attachTatteredRobe(m.grp,0x312e81,0xfacc15,.76,.95);attachBox(m.grp,[.76,.12,.18],[0,1.58,-.18],0xc9a13b);for(const sx of [-.38,.38])attachBox(m.grp,[.14,.5,.12],[sx,1.18,.26],0xeab308);if(m.arms&&m.arms[0])attachBlade(m.arms[0],0xfacc15,0xfff1a8,[0,-.08,.92],.95);if(m.arms&&m.arms[1])attachStaff(m.arms[1],0x9a6b13,0x22d3ee,'orb');}},
    abyssal_gatekeeper:{col:[.12,.42,.55],hex:0x22d3ee,parts:()=>{if(m.head){attachCrown(m.head,0x164e63,0x67e8f9);markBossGlow(attachBox(m.head,[.44,.09,.09],[0,.04,.31],0x67e8f9,[0,0,0],true),1.2);}attachTentacles(m.grp,0x115e59,7,.58);attachTatteredRobe(m.grp,0x082f49,0x22d3ee,.78,.92);for(const sx of [-.4,.4])attachBox(m.grp,[.1,.75,.1],[sx,1.36,-.26],0x083344,[.4,0,sx*.5]);if(m.arms&&m.arms[0])attachChain(m.arms[0],0,.82,0x1f2937,8);markCrystalHalo(m.grp,0x22d3ee,.82);}},
    rift_monarch:{col:[.65,.22,.72],hex:0xf472b6,parts:()=>{if(m.head){attachCrown(m.head,0x2e1065,0xf472b6);markBossGlow(attachBox(m.head,[.38,.12,.08],[0,.06,.31],0xf472b6,[0,0,0],true),1.4);}attachTatteredRobe(m.grp,0x1e1b4b,0xf472b6,.86,1.08);for(const sx of [-.34,.34])attachBox(m.grp,[.09,.72,.09],[sx,1.5,-.22],0x3b0764,[.3,0,sx>0?-.8:.8]);markCrystalHalo(m.grp,0xf472b6,1.12);attachRiftFragments(m.grp,0xf472b6,10,1.25);if(m.arms&&m.arms[0])attachStaff(m.arms[0],0x312e81,0xf472b6,'orb');}},
    ancient_warden:{col:[.06,.22,.26],hex:0x35d0c8,parts:()=>{if(m.head){attachBox(m.head,[.56,.12,.1],[0,.06,.32],0x78fff2,[0,0,0],true);for(const sx of [-.24,.24])attachBox(m.head,[.08,.5,.08],[sx,.42,.02],0x0f2f35,[0,0,sx>0?-.28:.28]);}for(const sx of [-.52,.52])attachBox(m.grp,[.22,.72,.24],[sx,1.38,.02],0x12353a);attachBox(m.grp,[.7,.12,.16],[0,1.62,-.18],0x35d0c8,[0,0,0],true);}},
  };
  const spec=styles[s];if(!spec)return;tintModel(m,spec.col);applyBossBodyPlan(m,s,spec.hex);spec.parts();
  const concept=BOSS_CONCEPT_STYLE[s];
  if(concept){brightenBossBody(m,concept.accent);attachBossReadableSilhouette(m,s,concept.accent);m.grp.scale.multiplyScalar(concept.scale||1);m.conceptFx=concept;m.conceptFloatBase=NaN;m.conceptOrbit=m.grp.children.filter(ch=>ch&&ch.userData&&ch.userData.bossOrbit);}
  const aura=new THREE.Mesh(new THREE.TorusGeometry(1.22,.045,8,42),new THREE.MeshBasicMaterial({color:spec.hex,transparent:true,opacity:.55,blending:THREE.AdditiveBlending,depthWrite:false}));
  aura.rotation.x=Math.PI/2;aura.position.y=.09;m.grp.add(aura);m.styleAura=aura;
}
function markCrystalHalo(parent,hex,scale=1){
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.62*scale,.035,6,30),new THREE.MeshBasicMaterial({color:hex,transparent:true,opacity:.58,blending:THREE.AdditiveBlending,depthWrite:false}));
  ring.rotation.x=Math.PI/2;ring.position.y=1.78;ring.userData.bossOrbit={speed:.75,radius:0,angle:0,y:1.78};parent.add(ring);
  for(let i=0;i<4;i++){
    const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.09*scale),new THREE.MeshBasicMaterial({color:hex,transparent:true,opacity:.86,depthWrite:false}));
    const a=i/4*Math.PI*2;gem.position.set(Math.cos(a)*.62*scale,1.78,Math.sin(a)*.62*scale);gem.userData.bossOrbit={speed:1.05+i*.12,radius:.62*scale,angle:a,y:1.78};markBossGlow(gem,.75);parent.add(gem);
  }
}
function tickBossConceptFx(m,dt,t,tier=0){
  const fx=m&&m.conceptFx;if(!fx||!m.grp)return;
  if(Number(fx.float)){
    if(!Number.isFinite(m.conceptFloatBase))m.conceptFloatBase=m.grp.position.y;
    m.grp.position.y=m.conceptFloatBase+Math.sin(t*1.7+(m.phase||0))*fx.float;
  }
  if(m.conceptOrbit&&m.conceptOrbit.length){
    for(const ch of m.conceptOrbit){
      const o=ch.userData&&ch.userData.bossOrbit;if(!o)continue;
      if(o.radius){const a=(o.angle||0)+t*(o.speed||1);ch.position.x=Math.cos(a)*o.radius;ch.position.z=Math.sin(a)*o.radius;}
      ch.rotation.y+=dt*(o.speed||1.1);ch.position.y=(o.y||ch.position.y)+Math.sin(t*2+(o.angle||0))*.05;
    }
  }
  m.grp.traverse(ch=>{
    const p=ch.userData&&ch.userData.bossGlow;if(!p||!ch.material)return;
    const pulse=.65+Math.sin(t*(3.2+p)+(m.phase||0))* .22;
    ch.material.opacity=ch.material.transparent?Math.max(.35,Math.min(.98,pulse+p*.12)):ch.material.opacity;
    if(ch.scale)ch.scale.setScalar(1+pulse*.035*p);
  });
  if(tier>1&&Math.random()<.65)return;
  const p=m.grp.position,rate=Number(fx.rate)||10,kind=fx.particle;
  if(Math.random()>=dt*rate)return;
  const a=Math.random()*Math.PI*2,r=.35+Math.random()*1.05,x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r,y=p.y+.25+Math.random()*2.1;
  if(kind==='ember'||kind==='flame')spawnParticle({x,y,z,vx:(Math.random()-.5)*.15,vy:.55+Math.random()*.35,vz:(Math.random()-.5)*.15,life:.55,grav:-.05,r:1,g:.34,b:.08});
  else if(kind==='smoke')spawnParticle({x,y:y+.2,z,vx:(Math.random()-.5)*.1,vy:.32,vz:(Math.random()-.5)*.1,life:.9,grav:-.02,r:.32,g:.28,b:.24});
  else if(kind==='lightning'){spawnParticle({x,y,z,vx:0,vy:1.2,vz:0,life:.16,grav:0,r:.45,g:.85,b:1});if(Math.random()<.28)addLightningBeam(x,y,z,p.x,p.y+1.4,p.z,.55);}
  else if(kind==='shard')spawnParticle({x,y,z,vx:(Math.random()-.5)*.5,vy:.22,vz:(Math.random()-.5)*.5,life:.5,grav:0,r:.64,g:.94,b:1});
  else if(kind==='incense')spawnParticle({x,y:y-.15,z,vx:(Math.random()-.5)*.08,vy:.42,vz:(Math.random()-.5)*.08,life:.8,grav:-.03,r:.55,g:.47,b:.7});
  else if(kind==='frost')spawnParticle({x,y,z,vx:(Math.random()-.5)*.12,vy:.18,vz:(Math.random()-.5)*.12,life:.7,grav:0,r:.72,g:.94,b:1});
  else if(kind==='sand')spawnParticle({x:p.x+Math.cos(a)*(1+Math.random()),y:p.y+.12,z:p.z+Math.sin(a)*(1+Math.random()),vx:-Math.cos(a)*.45,vy:.16,vz:-Math.sin(a)*.45,life:.55,grav:.2,r:.94,g:.7,b:.22});
  else if(kind==='bubble')spawnParticle({x,y,z,vx:(Math.random()-.5)*.08,vy:.48,vz:(Math.random()-.5)*.08,life:.75,grav:-.04,r:.18,g:.85,b:.92});
  else if(kind==='rift')spawnParticle({x,y,z,vx:(Math.random()-.5)*.9,vy:.4,vz:(Math.random()-.5)*.9,life:.38,grav:0,r:.95,g:.25,b:.9});
  else if(kind==='leaf')spawnParticle({x,y,z,vx:(Math.random()-.5)*.35,vy:.28,vz:(Math.random()-.5)*.35,life:.65,grav:.05,r:.32,g:.9,b:.22});
  else if(kind==='bone')spawnParticle({x,y,z,vx:(Math.random()-.5)*.25,vy:.22,vz:(Math.random()-.5)*.25,life:.55,grav:.08,r:.86,g:.82,b:.68});
  else if(kind==='spore')spawnParticle({x,y,z,vx:(Math.random()-.5)*.18,vy:.42,vz:(Math.random()-.5)*.18,life:.7,grav:-.03,r:.62,g:1,b:.22});
}
const ENCOUNTER_NAMES={bandit:'Bandit',bandit_archer:'Bandit Archer',bandit_shield:'Shield Bandit',bandit_scout:'Bandit Scout',bandit_brute:'Bandit Brute',bandit_captain:'Bandit Captain',caravan_guard:'Caravan Guard',caravan_merchant:'Road Merchant',wounded_hunter:'Wounded Hunter',pack_mule:'Pack Mule',caravan_wagon:'Merchant Wagon',caravan_wreck:'Wrecked Wagon',gale_stalker:'Gale Stalker',wind_archer:'Wind Archer',rootbound:'Rootbound',briar_archer:'Briar Archer',dune_husk:'Dune Husk',sun_archer:'Sun Archer',redclaw:'Redclaw',amber_archer:'Amber Archer',frost_wight:'Frost Wight',ice_archer:'Ice Archer',mirewalker:'Mirewalker',bog_archer:'Bog Archer'};
const BIOME_NAME_COLOR={plains:'#d8f58c',forest:'#8fcf69',desert:'#ffd36a',mesa:'#ff8968',snowy:'#b9f4ff',swamp:'#a8ca72'};
const BOSS_GALLERY_RANK_LABELS=['E','D','C','B','A'];
let bossGallery=[];
let bossGalleryRAF=0,bossGalleryLast=0;
function textSprite(text,color='#ffffff',scale=1){
  const cv=document.createElement('canvas');cv.width=256;cv.height=64;const cx=cv.getContext('2d');cx.font='bold 26px sans-serif';cx.textAlign='center';cx.textBaseline='middle';cx.strokeStyle='rgba(0,0,0,.9)';cx.lineWidth=7;cx.strokeText(text,128,32);cx.fillStyle=color;cx.fillText(text,128,32);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),transparent:true,depthTest:false}));sp.scale.set(2.8*scale,.7*scale,1);return sp;
}
function decorateEncounter(m,ref){
  let name=ref.displayName||ENCOUNTER_NAMES[ref.kind];if(!name&&isAnimalKind(ref.kind))return;
  if(!name)name=ref.kind==='boss'?'Gate Monarch':String(ref.kind||'Enemy').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  const biome=BIOME_HOSTILE_KIND[ref.kind],biomeHostile=!!biome,banditHostile=ref.kind.indexOf('bandit')===0;
  const breached=/^Breached /.test(name);
  const friendly=ref.kind.indexOf('caravan_')===0||ref.kind==='pack_mule'||ref.kind==='wounded_hunter',hostile=!friendly;
  const bodyScale=m.silhouetteScale||{x:1,y:1,z:1},width=biomeHostile?.96:1.29,labelScale=biomeHostile?.78:1;
  const label=textSprite(name,breached?'#ff3b2f':biomeHostile?BIOME_NAME_COLOR[biome]:friendly?'#8edcff':hostile?'#ff9b82':'#fff',breached?1.16:labelScale);
  label.position.y=(m.wagon?2.35:biomeHostile?2.38:2.65)/bodyScale.y;
  if(biomeHostile)label.scale.set(label.scale.x/bodyScale.x,label.scale.y/bodyScale.y,1/bodyScale.z);
  label.renderOrder=22;m.grp.add(label);
  const bg=new THREE.Sprite(new THREE.SpriteMaterial({color:0x120f0e,transparent:true,opacity:.9,depthTest:false})),fill=new THREE.Sprite(new THREE.SpriteMaterial({color:friendly?0x55c9ff:0xf05242,depthTest:false}));
  const barH=biomeHostile?.055:.075,bgW=width+.06;
  bg.scale.set(bgW/bodyScale.x,(biomeHostile?.095:.13)/bodyScale.y,1/bodyScale.z);fill.scale.set(width/bodyScale.x,barH/bodyScale.y,1/bodyScale.z);bg.position.y=label.position.y-(biomeHostile?.3:.42)/bodyScale.y;fill.position.set(0,bg.position.y,.01);bg.renderOrder=21;fill.renderOrder=22;m.grp.add(bg,fill);m.encounterUi={label,bg,fill,friendly,hostile,width,bodyScale,breached};
  if(!biomeHostile){const ring=new THREE.Mesh(new THREE.TorusGeometry(breached?1.35:m.wagon?1.25:.58,.035,6,30),new THREE.MeshBasicMaterial({color:breached?0xff2f2f:friendly?0x5dd5ff:0xff5c46,transparent:true,opacity:breached?.92:.7,depthWrite:false}));ring.rotation.x=Math.PI/2;ring.position.y=.06;m.grp.add(ring);m.encounterUi.ring=ring;}
  if(banditHostile){const alert=textSprite('?', '#ffd45c',.55),engaged=textSprite('!', '#ff6048',.62);alert.position.y=engaged.position.y=label.position.y+.48;m.grp.add(alert,engaged);m.encounterUi.alert=alert;m.encounterUi.engaged=engaged;}
  if(hostile){const radius=breached?4.6:ref.kind==='bandit_captain'?4.05:ref.kind==='bandit_brute'?3.65:m.boss?3.2:1.35;const tell=new THREE.Mesh(new THREE.RingGeometry(radius-.1,radius,48),new THREE.MeshBasicMaterial({color:breached?0xff1515:ref.kind==='bandit_captain'||m.boss?0xff3429:0xff8a45,transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false,depthTest:false}));tell.rotation.x=-Math.PI/2;tell.position.y=.08;tell.visible=false;m.grp.add(tell);m.encounterUi.tell=tell;const attack=textSprite(breached?'BREACH':'ATTACK', breached?'#ffdf6b':'#ffd05b',breached?.56:.48),stunned=textSprite('STUNNED', '#ffd24a',.48),frozen=textSprite('FROZEN', '#8eeaff',.48);for(const status of [attack,stunned,frozen]){status.position.y=label.position.y+.46;status.visible=false;m.grp.add(status);}m.encounterUi.attackStatus=attack;m.encounterUi.stunStatus=stunned;m.encounterUi.frozenStatus=frozen;if(ref.kind==='bandit_captain'||breached)m.spawnT=2.2;}
}
function tickEncounterReadability(m,dt,t){
  const u=m.encounterUi;if(!u)return;const r=m.ref,pct=Math.max(0,Math.min(1,(r.hp||0)/(r.maxHp||1))),scaledWidth=u.width/(u.bodyScale&&u.bodyScale.x||1);u.fill.scale.x=scaledWidth*pct;u.fill.position.x=-(scaledWidth-u.fill.scale.x)/2;
  if(u.alert){const aware=['draw','windup','bruteWind','rally'].includes(r.state);u.alert.visible=!aware&&r.state!=='surrender'&&r.state!=='retreat';if(u.engaged)u.engaged.visible=aware;}
  if(r.state==='retreat'){u.label.material.color.set(0xffd26b);if(u.ring)u.ring.material.color.set(0xffc34d);}else if(u.ring)u.ring.material.color.set(u.friendly?0x5dd5ff:0xff5c46);
  if(m.spawnT>0){m.spawnT=Math.max(0,m.spawnT-dt);m.grp.scale.y=1+Math.sin((2.2-m.spawnT)*8)*.08;if(u.tell){u.tell.visible=true;u.tell.scale.setScalar(1+(2.2-m.spawnT)*.8);u.tell.material.opacity=m.spawnT/2.2;}}
  else if(u.tell){const warning=['draw','windup','bruteWind','captainCleave','graveWind','graveRingWind','slamWind','bossMeleeWind','chargeWind','volleyWind','spikeWind','packWind','foremanWind','regentWind','rootWind','controlWind','ossuaryWind','blightWind','watcherWind','cinderWind','castellanWind','choirWind','priorWind','rimeWind','thunderWind','buriedWind','abyssalWind','riftWind'].includes(r.state);u.tell.visible=warning;if(u.attackStatus)u.attackStatus.visible=warning;if(u.stunStatus)u.stunStatus.visible=r.state==='stun';if(u.frozenStatus)u.frozenStatus.visible=r.state==='frozen';if(warning){const charge=Math.min(1,(m.aT||0)/(r.state==='captainCleave'?.9:.7));u.tell.scale.setScalar(.72+charge*.28+Math.sin(t*18)*.025);u.tell.material.opacity=.42+charge*.5;}}
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
    const m={...makeCapturedShadow(ref),net:true,netId:id,ref,hp:ref.hp,kind:ref.kind,boss:!!ref.shadowBoss,
      kb:new THREE.Vector3(),phase:Math.random()*10,hitT:0,slowT:0,aT:0,lastState:'',baseCol:[.28,.12,.48],shadowAlly:true};
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
    const aura=new THREE.Mesh(new THREE.TorusGeometry(1.05,.055,8,36),new THREE.MeshBasicMaterial({color:0xff321f,transparent:true,opacity:.75,blending:THREE.AdditiveBlending,depthWrite:false}));
    aura.rotation.x=Math.PI/2;aura.position.y=.08;aura.visible=false;m.grp.add(aura);m.enrageAura=aura;
    decorateBossStyle(m,ref);
  } else if(ref.kind==='ghost'){
    m.grp.scale.setScalar(.8);
    m.baseCol=[.6,.95,1];
    m.mats.forEach(mm=>{ mm.transparent=true; mm.opacity=.5; mm.color.setRGB(.6,.95,1); });
  } else {
    tintMob(m);
    const col=ENEMY_FAMILY_COLORS[ref.kind];
    if(col){m.baseCol=col;m.mats.forEach(mm=>mm.color.setRGB(col[0],col[1],col[2]));}
    decorateBiomeHostile(m,ref.kind);
    if(ref.kind==='bandit_captain')m.grp.scale.setScalar(1.25);
    if(ref.kind==='bandit_brute')m.grp.scale.setScalar(1.18);
    if(ref.kind==='wounded_hunter')m.grp.scale.y=.65;
    if(ref.kind==='bandit_shield'){const shield=new THREE.Mesh(new THREE.BoxGeometry(.5,.72,.1),new THREE.MeshLambertMaterial({color:0x33485d}));shield.position.set(-.48,1.05,-.08);shield.rotation.y=.25;m.grp.add(shield);}
    decorateDungeonVariant(m,ref);
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
function makeCapturedShadow(ref){
  const original=ref.shadowKind||'zombie',boss=!!ref.shadowBoss,skel=RANGED_ENEMY_KINDS.has(original)||/skeleton|archer|shot|spitter|wraith|caller/.test(original);
  const model=boss?makeGateBoss():skel?makeSkeleton():makeZombie();
  model.kind=original;
  if(!boss){decorateBiomeHostile(model,original);if(/brute|golem|shield|captain/.test(original))model.grp.scale.setScalar(1.18);}
  else model.grp.scale.setScalar(1.62);
  const shadowColor=new THREE.Color(0x321052);
  for(const mat of model.mats){if(mat.color)mat.color.lerp(shadowColor,.72);mat.transparent=true;mat.opacity=.9;}
  const aura=new THREE.Mesh(new THREE.TorusGeometry(boss?1.15:.7,.035,8,36),new THREE.MeshBasicMaterial({color:0x8b5cf6,transparent:true,opacity:.7,blending:THREE.AdditiveBlending,depthWrite:false}));
  aura.rotation.x=Math.PI/2;aura.position.y=.08;model.grp.add(aura);model.shadowAura=aura;
  return model;
}
function netRemoveMob(id){
  const i=mobs.findIndex(m=>m.net && m.netId===id);
  if(i<0) return;
  const p=mobs[i].grp.position;
  const dead=mobs[i],color=dead.baseCol||[.34,.52,.28],major=!!(dead.boss||dead.elite||dead.kind==='bandit_captain');
  if(dead.shadowAlly){
    burst(p.x,p.y+1,p.z,[.28,.1,.55],dead.boss?38:20,dead.boss?4:2.5,2.4,.75);
    ringPulse(p.x,p.y+.08,p.z,dead.boss?2.5:1.1,0x8b5cf6,.45);
    disposeObjectTree(dead.grp);mobs.splice(i,1);return;
  }
  burst(p.x,p.y+1,p.z,color,major?34:18,major?4.2:2.6,major?3:2.2,major?.9:.7);
  if(major)ringPulse(p.x,p.y+.08,p.z,dead.boss?3.2:1.9,dead.boss?0xff4938:0xffa34f,.4);
  SFX.kill();
  mobs.splice(i,1);
  const corpse=dead.grp,start=performance.now(),duration=major?900:620,startY=corpse.position.y,startScale=corpse.scale.clone();
  const deathTick=setInterval(()=>{const u=Math.min(1,(performance.now()-start)/duration);corpse.rotation.z=(dead.hitLean||1)*(Math.PI*.46)*u;corpse.position.y=startY-Math.max(0,u-.55)*.65;corpse.scale.y=Math.max(.12,startScale.y*(1-u*.35));corpse.traverse(o=>{if(o.material&&'opacity'in o.material){o.material.transparent=true;o.material.opacity=Math.max(0,1-u*u);}});if(u>=1){clearInterval(deathTick);disposeObjectTree(corpse);}},16);
}
function mobForReaction(t, radius=1.9){
  const id=String(t&&t.id||'');
  if(id){const byId=mobs.find(o=>o.net&&o.netId===id);if(byId)return byId;}
  const tx=Number(t&&t.x),ty=Number(t&&t.y),tz=Number(t&&t.z);
  if(!Number.isFinite(tx)||!Number.isFinite(tz))return null;
  let best=null,bd=radius;
  for(const mob of mobs){
    if(!mob.net||!mob.grp||!mob.ref||(mob.ref.dgn||'')!==NET.dgn)continue;
    const p=mob.grp.position,d=Math.hypot(p.x-tx,p.z-tz)+Math.abs((Number.isFinite(ty)?ty:p.y)-p.y)*.35;
    if(d<bd){bd=d;best=mob;}
  }
  return best;
}
function markMobReaction(t, kind, opts={}){
  const mob=mobForReaction(t, opts.radius || (kind==='root'?2.6:kind==='frost'?2.2:1.9));
  if(!mob||mob.wagon||mob.orb)return;
  const dur=opts.duration || (kind==='root'?.9:kind==='frost'?1.1:kind==='stagger'?.8:kind==='panther'?.42:.52);
  mob.reactKind=kind;
  mob.reactT=dur;
  mob.reactDur=dur;
  mob.reactPower=opts.power || 1;
  mob.reactFromX=Number.isFinite(+opts.fromX)?+opts.fromX:null;
  mob.reactFromZ=Number.isFinite(+opts.fromZ)?+opts.fromZ:null;
  mob.hitT=Math.max(mob.hitT||0,Math.min(.24,dur*.36));
  if(kind==='crit'||kind==='execute'||kind==='panther')mob.hitLean=(Math.random()<.5?-1:1)*(kind==='execute'?.28:kind==='panther'?.22:.18);
}
function applyMobReactionPose(m,p,t,dt){
  if(!m.reactT)return false;
  m.reactT=Math.max(0,m.reactT-dt);
  const dur=Math.max(.001,m.reactDur||.5),u=1-m.reactT/dur,pow=m.reactPower||1,kind=m.reactKind||'hit';
  const ease=Math.sin(Math.min(1,u)*Math.PI), tremor=Math.sin(t*(kind==='frost'?18:kind==='root'?10:32)+m.phase);
  if(kind==='root'){
    m.grp.rotation.z=tremor*.018*ease;
    if(m.arms)for(const arm of m.arms)arm.rotation.x=.38+.18*Math.sin(t*9);
    if(m.legs){m.legs[0].rotation.x=.12;m.legs[1].rotation.x=-.12;}
    if(Math.random()<dt*16)spawnParticle({x:p.x+(Math.random()-.5)*.9,y:p.y+.12,z:p.z+(Math.random()-.5)*.9,vx:0,vy:.55,vz:0,life:.34,grav:0,r:.22,g:.78,b:.28});
  }else if(kind==='frost'){
    m.grp.rotation.z=tremor*.01*ease;
    if(m.arms)for(const arm of m.arms)arm.rotation.x*=.82;
    if(Math.random()<dt*22)spawnParticle({x:p.x+(Math.random()-.5)*.8,y:p.y+.35+Math.random()*1.35,z:p.z+(Math.random()-.5)*.8,vx:0,vy:.32,vz:0,life:.45,grav:0,r:.65,g:.92,b:1});
  }else if(kind==='stagger'){
    m.grp.rotation.z=(m.hitLean||.16)*Math.sin(u*Math.PI*3)*(1-u*.35)*pow;
    if(m.arms){m.arms[0].rotation.x=.95;m.arms[1].rotation.x=.65;}
    if(m.legs){m.legs[0].rotation.x=-.32;m.legs[1].rotation.x=.32;}
  }else if(kind==='panther'){
    const away=m.reactFromX!=null?Math.sign((p.x-m.reactFromX)*Math.cos(m.grp.rotation.y)+(p.z-m.reactFromZ)*Math.sin(m.grp.rotation.y)):m.hitLean||1;
    m.grp.rotation.z=away*.22*Math.sin(u*Math.PI)*(1-u*.25);
    if(m.arms){m.arms[0].rotation.x=-1.55;m.arms[1].rotation.x=.55;}
  }else if(kind==='execute'||kind==='crit'){
    const heavy=kind==='execute';
    m.grp.rotation.z=(m.hitLean||.18)*Math.sin(u*Math.PI)*(heavy?1.45:1);
    if(m.arms)for(const arm of m.arms)arm.rotation.x=heavy?1.1:.75;
    if(heavy&&m.legs){m.legs[0].rotation.x=.48;m.legs[1].rotation.x=-.48;}
  }
  if(m.reactT<=0)m.reactKind='';
  return true;
}
function netMobTick(m, dt, t){
  const r=m.ref, p=m.grp.position;
  if((r.hp||0)<(m.hp||0)){const lost=(m.hp||0)-(r.hp||0),ratio=lost/Math.max(1,r.maxHp||m.hp||1);m.hitT=.18+Math.min(.14,ratio*.5);m.hitLean=(Math.random()<.5?-1:1)*(.08+Math.min(.14,ratio));const flash=m.encounterUi&&m.encounterUi.hostile?[1,.25,.18]:[1,1,1];m.mats.forEach(mm=>mm.color.setRGB(flash[0],flash[1],flash[2]));if(m.grp.visible){burst(p.x,p.y+1,p.z,flash,ratio>.2?12:7,ratio>.2?2.2:1.5,1.6,.28);if(ratio>.2)ringPulse(p.x,p.y+.08,p.z,1.15,0xffffff,.18);}}m.hp=r.hp;
  const dx=p.x-player.pos.x,dz=p.z-player.pos.z,important=!!(m.boss||m.elite||m.kind==='bandit_captain');
  const tier=mobDistanceTierSq(dx*dx+dz*dz,important);
  m.grp.visible = (r.dgn||'')===NET.dgn&&tier<3;
  if(!m.grp.visible)return;
  const stepDt=consumeEntityStep(m,dt,tier);
  if(!stepDt)return;
  dt=stepDt;
  const visualKind=m.shadowAlly?(r.shadowKind||'zombie'):m.kind;
  if(m.shadowAlly){
    if(m.shadowAura)m.shadowAura.rotation.z+=dt*(m.boss?1.1:2.2);
    if(tier===0&&Math.random()<dt*(m.boss?10:4))spawnParticle({x:p.x+(Math.random()-.5)*(m.boss?1.5:.8),y:p.y+.15+Math.random()*(m.boss?2.5:1.7),z:p.z+(Math.random()-.5)*(m.boss?1.5:.8),vx:0,vy:.35,vz:0,life:.45,grav:0,r:.34,g:.12,b:.72});
  }
  if(m.boss&&m.enrageAura){
    m.enrageAura.visible=!!r.enraged;
    if(r.enraged){m.enrageAura.rotation.z+=dt*2.4;const pulse=1+Math.sin(t*8)*.08;m.enrageAura.scale.setScalar(pulse);if(tier===0&&Math.random()<dt*18)spawnParticle({x:p.x+(Math.random()-.5)*1.8,y:p.y+.2+Math.random()*2.3,z:p.z+(Math.random()-.5)*1.8,vx:0,vy:.65,vz:0,life:.4,grav:0,r:1,g:.12,b:.04});}
  }
  if(m.styleAura){m.styleAura.rotation.z+=dt*1.3;m.styleAura.scale.setScalar(1+Math.sin(t*3+m.phase)*.05);}
  if(m.variantAura){m.variantAura.rotation.z-=dt*1.8;}
  if(m.waterAura){m.waterAura.rotation.z+=dt*.9;m.waterAura.material.opacity=.4+Math.sin(t*4+m.phase)*.12;}
  if(m.conceptFx)tickBossConceptFx(m,dt,t,tier);
  const aura=BIOME_VFX[BIOME_HOSTILE_KIND[visualKind]];
  if(aura&&tier===0&&Math.random()<dt*4)spawnParticle({x:p.x+(Math.random()-.5)*.7,y:p.y+.15+Math.random()*1.55,z:p.z+(Math.random()-.5)*.7,vx:0,vy:.22+Math.random()*.28,vz:0,life:.45,grav:0,r:aura.col[0],g:aura.col[1],b:aura.col[2]});
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
    if(['bruteWind','packWind','graveWind','captainCleave','slamWind','bossMeleeWind','graveRingWind','chargeWind','volleyWind','spikeWind','foremanWind','regentWind','rootWind','controlWind','ossuaryWind','blightWind','watcherWind','cinderWind','castellanWind','choirWind','priorWind','rimeWind','thunderWind','buriedWind','abyssalWind','riftWind'].includes(st)&&
       m.grp.visible&&Math.hypot(p.x-player.pos.x,p.z-player.pos.z)<11&&
       (m.boss||m.elite||m.kind==='bandit_captain'||m.kind==='bandit_brute'||m.kind==='redclaw'||m.kind==='gale_stalker'))SFX.slamWarn();
    if(st==='draw'&&m.kind==='sun_archer'&&m.grp.visible&&Math.hypot(p.x-player.pos.x,p.z-player.pos.z)<14)ringPulse(p.x,p.y+.08,p.z,.72,0xffd34f,.22);
    if(st==='stun'){ m.mats.forEach(mm=>mm.color.setRGB(.55,.7,1)); }
    else if(st==='frozen'){ m.mats.forEach(mm=>mm.color.setRGB(.55,.78,1)); }
    else if(st==='blackhole'){ startBlackholeMob(m, true); }
    else if(m.hitT<=0){ const bc=m.baseCol||[1,1,1]; m.mats.forEach(mm=>mm.color.setRGB(bc[0],bc[1],bc[2])); }
  }
  m.aT+=dt;
  if(m.biomeTell){
    const mesa=st==='bruteWind'&&m.kind==='redclaw',pack=st==='packWind'&&m.kind==='gale_stalker',active=mesa||pack;
    m.biomeTell.visible=active;
    if(active){const duration=mesa?1.05:.52,charge=Math.min(1,m.aT/duration),pulse=.78+charge*.22,inv=m.biomeTell.userData.inverseScale||{x:1,y:1,z:1};m.biomeTell.material.opacity=.28+charge*.62;m.biomeTell.scale.set(inv.x*pulse,inv.y*pulse,inv.z);m.biomeTell.rotation.z+=dt*(mesa?1.2:3.4);}
  }
  if(st==='blackhole' && m.blackhole){ tickBlackholedMob(m, dt); return; }
  if(!m.grp.visible){ /* skip particle work offscreen-space */ }
  else if(st==='bruteWind'&&m.kind==='redclaw'){
    const charge=Math.min(1,m.aT/1.05);m.arms[0].rotation.x=m.arms[1].rotation.x=-.7-charge*1.5;m.legs[0].rotation.x=.2;m.legs[1].rotation.x=-.2;m.grp.rotation.z=Math.sin(t*22)*.018*charge;
    if(Math.random()<dt*38){const a2=Math.random()*Math.PI*2,r2=1+Math.random()*2.7;spawnParticle({x:p.x+Math.cos(a2)*r2,y:p.y+.1,z:p.z+Math.sin(a2)*r2,vx:-Math.cos(a2)*1.2,vy:.35,vz:-Math.sin(a2)*1.2,life:.35,grav:0,r:.88,g:.32,b:.18});}
  } else if(st==='packWind'&&m.kind==='gale_stalker'){
    const charge=Math.min(1,m.aT/.52);m.arms[0].rotation.x=m.arms[1].rotation.x=-1.35;m.legs[0].rotation.x=m.legs[1].rotation.x=.35;m.grp.rotation.z=Math.sin(t*25+m.phase)*.025;
    if(Math.random()<dt*28){const a2=Math.random()*Math.PI*2,r2=.8+Math.random()*.8;spawnParticle({x:p.x+Math.cos(a2)*r2,y:p.y+.25+Math.random()*.5,z:p.z+Math.sin(a2)*r2,vx:-Math.cos(a2)*1.8,vy:.1,vz:-Math.sin(a2)*1.8,life:.28,grav:0,r:.79,g:.96,b:.42});}
  } else if(st==='graveRingWind'){
    m.arms[0].rotation.x=m.arms[1].rotation.x=-Math.min(1,m.aT/1.2)*1.65;
    if(Math.random()<dt*46){
      const a2=Math.random()*6.283,r2=2.2+Math.random()*4;
      spawnParticle({x:p.x+Math.cos(a2)*r2,y:p.y+.12,z:p.z+Math.sin(a2)*r2,
        vx:0,vy:.45,vz:0,life:.38,grav:0,r:.5,g:.12,b:.65});
    }
  } else if(st==='slamWind'){
    m.arms[0].rotation.x=m.arms[1].rotation.x=-Math.min(1,m.aT/1.0)*1.4;
    if(Math.random()<dt*34){
      const a2=Math.random()*6.283;
      spawnParticle({x:p.x+Math.cos(a2)*4.3, y:p.y+.15, z:p.z+Math.sin(a2)*4.3,
        vx:0, vy:.5, vz:0, life:.3, grav:0, r:1, g:.55, b:.1});
    }
  } else if(st==='bossMeleeWind'){
    const charge=Math.min(1,m.aT/.42);m.arms[0].rotation.x=-.35-charge*1.35;m.arms[1].rotation.x=.15-charge*.75;m.grp.rotation.z=Math.sin(t*28)*.018*charge;
    if(Math.random()<dt*24)spawnParticle({x:p.x+(Math.random()-.5)*1.8,y:p.y+.35+Math.random()*1.3,z:p.z+(Math.random()-.5)*1.8,vx:0,vy:.45,vz:0,life:.25,grav:0,r:1,g:.32,b:.18});
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
  } else if(st==='foremanWind'||st==='regentWind'||st==='rootWind'||st==='controlWind'||st==='ossuaryWind'||st==='blightWind'||st==='watcherWind'||st==='cinderWind'||st==='castellanWind'||st==='choirWind'||st==='priorWind'||st==='rimeWind'||st==='thunderWind'||st==='buriedWind'||st==='abyssalWind'||st==='riftWind'){
    const col=st==='foremanWind'||st==='cinderWind'?[.9,.45,.16]:st==='regentWind'||st==='abyssalWind'?[.18,.7,1]:st==='thunderWind'?[.25,.82,1]:st==='rimeWind'||st==='choirWind'?[.64,.94,1]:(st==='rootWind'||st==='controlWind')?[.25,.85,.32]:st==='ossuaryWind'||st==='castellanWind'||st==='buriedWind'?[.78,.68,.45]:st==='blightWind'?[.45,.95,.2]:[.68,.45,1];
    m.arms[0].rotation.x=m.arms[1].rotation.x=-1.35;
    if(Math.random()<dt*38)spawnParticle({x:p.x+(Math.random()-.5)*2.4,y:p.y+.15+Math.random()*2,z:p.z+(Math.random()-.5)*2.4,vx:0,vy:.45,vz:0,life:.4,grav:0,r:col[0],g:col[1],b:col[2]});
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
  } else if(st==='graveWind'){
    m.arms[0].rotation.x=m.arms[1].rotation.x=-1.55;
    m.grp.rotation.z=Math.sin(t*18+m.phase)*.025;
    if(m.grp.visible&&Math.random()<dt*22)
      spawnParticle({x:p.x+(Math.random()-.5)*1.1,y:p.y+.15,z:p.z+(Math.random()-.5)*1.1,vx:0,vy:.3,vz:0,life:.3,grav:0,r:.38,g:.16,b:.55});
  } else if(st==='windup'){
    m.arms[0].rotation.x=m.arms[1].rotation.x=-1.25;
  } else {
    m.grp.rotation.z=0;
    if(!RANGED_ENEMY_KINDS.has(visualKind)&&!/skeleton|archer|shot|spitter|wraith|caller/.test(visualKind)&&moving){
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
    if(st!=='stun')m.grp.rotation.z=(m.hitLean||.1)*Math.sin(Math.max(0,m.hitT)*18);
    if(m.hitT<=0 && st!=='stun' && st!=='frozen'){m.grp.rotation.z=0;const bc=m.baseCol||[1,1,1];m.mats.forEach(mm=>mm.color.setRGB(bc[0],bc[1],bc[2]));}
  }
  applyMobReactionPose(m,p,t,dt);
}

// ---- server fx + projectiles (visual; damage is server-side) ----
function deityPowerFx(m){
  const x=Number.isFinite(+m.x)?+m.x:player.pos.x;
  const y=Number.isFinite(+m.y)?+m.y:player.pos.y;
  const z=Number.isFinite(+m.z)?+m.z:player.pos.z;
  const power=String(m.power||'');
  const active=m.active!==false;
  const isSelf=!!(NET.room&&m.sid===NET.room.sessionId);
  const castSound=()=>{ if(isSelf&&typeof SFX!=='undefined'&&SFX.cast)SFX.cast(); };
  if(power==='flight'){
    castSound();
    ringPulse(x,y+.08,z,active?2.25:1.35,active?0xffd166:0x8bd3ff,.55);
    glowFlash(x,y+1.05,z,active?0xffe9a8:0x8bd3ff,active?3.4:2.1,.38);
    burst(x,y+.75,z,active?[1,.78,.22]:[.55,.85,1],active?36:18,active?3.6:2.0,active?3.2:1.6,.72);
    for(let i=0;i<20;i++){
      const a=i/20*Math.PI*2,r=.45+Math.random()*.55;
      spawnParticle({x:x+Math.cos(a)*r,y:y+.25+Math.random()*1.4,z:z+Math.sin(a)*r,
        vx:Math.cos(a)*.45,vy:1.6+Math.random()*1.4,vz:Math.sin(a)*.45,life:.65,grav:.2,r:1,g:.82,b:.35});
    }
    showName(active?'DEITY FLIGHT':'FLIGHT RELEASED');
    return;
  }
  if(power==='invisibility'){
    castSound();
    ringPulse(x,y+.08,z,active?1.85:2.25,active?0xa78bfa:0xe0f2fe,.65);
    glowFlash(x,y+1,z,active?0x9f7aea:0xf8fafc,active?2.8:3.2,.45);
    burst(x,y+.85,z,active?[.62,.42,1]:[.92,.96,1],active?34:42,active?2.5:3.2,active?2.4:2.9,.78);
    if(!active)camShake=Math.max(camShake,.12);
    showName(active?'INVISIBLE':'REVEALED');
    return;
  }
  if(power==='day_night'){
    castSound();
    const night=String(m.target||'')==='night';
    ringPulse(x,y+.08,z,4.8,night?0x7c3aed:0xffd166,.95);
    ringPulse(x,y+.1,z,2.7,night?0x1e1b4b:0xfff1a8,.75);
    glowFlash(x,y+1.5,z,night?0x7c3aed:0xfff3b0,5.2,.7);
    burst(x,y+1.1,z,night?[.35,.18,.85]:[1,.82,.28],56,5.8,4.2,1.1);
    addLightningBeam(x,y+8,z,x,y+.25,z,night?.65:.45);
    camShake=Math.max(camShake,.2);
    showName(night?'NIGHT FALLS':'DAYBREAK');
    return;
  }
  if(power==='weather'){
    castSound();
    const weather=String(m.weather||'clear');
    const storm=weather==='storm',rain=weather==='rain';
    const hex=storm?0x8b5cf6:rain?0x38bdf8:0xffd166;
    const col=storm?[.55,.34,1]:rain?[.2,.74,1]:[1,.82,.28];
    ringPulse(x,y+.08,z,storm?4.4:3.4,hex,.85);
    glowFlash(x,y+1.35,z,hex,storm?4.8:3.5,.55);
    burst(x,y+1,z,col,storm?52:38,storm?5.0:3.7,storm?4.6:3.2,.95);
    if(storm){
      addLightningBeam(x+1.2,y+7,z-.8,x,y+.25,z,1.0);
      camShake=Math.max(camShake,.24);
    }
    showName(storm?'STORM CALLED':rain?'RAIN CALLED':'SKIES CLEARED');
    return;
  }
  if(m.action==='choose'){
    ringPulse(x,y+.08,z,2.6,0xffd166,.85);
    burst(x,y+1,z,[1,.86,.35],42,4.2,3.5,.95);
    glowFlash(x,y+1,z,0xffd166,4,.65);
    showName('DEITY POWER CHOSEN');
  }
}
function netFx(m){
  if((m.dgn||'')!==NET.dgn) return;
  if(m.t==='deityPower'){deityPowerFx(m);return;}
  if(m.t==='familiarSummon'||m.t==='familiarDismiss'){
    if(NET.room&&m.sid===NET.room.sessionId) return;
    const col=m.kind==='shade'?[.45,.2,.7]:m.kind==='fang'?[.55,.4,.3]:m.kind==='mote'?[.55,1,.38]:[1,.85,.3];
    burst(m.x,m.y+.8,m.z,col,m.t==='familiarSummon'?20:12,m.t==='familiarSummon'?2.3:1.5,2,.5); return;
  }
  if(m.t==='spriteBonus'){
    const count=Math.max(1,m.count|0); burst(m.x,m.y,m.z,[1,.9,.45],10+count*8,2.1+count*.35,1.8,.45);
    if(NET.room&&m.sid===NET.room.sessionId){ if(SFX.coin)SFX.coin(); familiarReaction('sprite',count); }
    return;
  }
  if(m.t==='fangBite'){ const strikes=Math.max(1,m.strikes|0); burst(m.x, m.y, m.z, [.7,.6,.5], 4+strikes*3, 1.6, 1.1, .25); fangSnap(m.x, m.z, strikes); return; }
  if(m.t==='shadeStep'){ shadowDashVfx({x:m.sx,y:m.sy,z:m.sz},{x:m.x,y:m.y,z:m.z}); return; }
  if(m.t==='biomeSlam'){burst(m.x,m.y+.15,m.z,BIOME_VFX.mesa.col,30,4.8,2.2,.55);ringPulse(m.x,m.y+.08,m.z,3.8,BIOME_VFX.mesa.hex,.34);SFX.boom();return;}
  if(m.t==='soldierStrike'){ shadowSoldierStrikeVfx(m.x, m.y, m.z, m.yaw||0); return; }
  if(m.t==='shadowHeavy'){shadowClawVfx(m.x,m.y,m.z,m.yaw||0,.7);ringPulse(m.x,m.y+.08,m.z,1.15,0x8b5cf6,.3);camShake=Math.max(camShake,.12);return;}
  if(m.t==='shadowVolley'){
    energyTrailVfx(m.fromX,m.fromY,m.fromZ,m.x,m.y+1,m.z,0x8b5cf6,.075,.38,.92);
    glowFlash(m.x,m.y+1,m.z,0xb794f6,1.8,.2);burst(m.x,m.y+1,m.z,[.45,.2,.85],12,2,1.6,.4);return;
  }
  if(m.t==='shadowBossSlam'){
    ringPulse(m.x,m.y+.08,m.z,2.7,0x8b5cf6,.5);ringPulse(m.x,m.y+.1,m.z,1.5,0x16051f,.65);
    burst(m.x,m.y+.4,m.z,[.38,.12,.72],34,4.5,2.8,.7);camShake=Math.max(camShake,.36);SFX.boom();return;
  }
  if(m.t==='secondWind'){ healingPlusVfx(m.x,m.y,m.z,1.05,1.15);animateRemoteGuardianCast({...m,kind:'secondwind'});return; }
  if(m.t==='moteBurst'){ burst(m.x, m.y, m.z, [.6,1,.5], 18, 2.2, 2.4, .55); return; }
  if(m.t==='banditCleave'){burst(m.x,m.y+.25,m.z,[1,.18,.08],34,5.2,2.2,.65);camShake=Math.max(camShake,.65);return;}
  if(m.t==='weaponStagger'){
    markMobReaction({x:m.x,y:m.y,z:m.z},'stagger',{duration:m.boss?1.0:.72,power:m.boss?1.35:1,radius:m.boss?3.3:2.0});
    const color=m.boss?[1,.55,.18]:[1,.85,.35];
    burst(m.x,m.y+.8,m.z,color,m.boss?28:18,m.boss?3.5:2.4,2.0,.48);
    ringPulse(m.x,m.y+.08,m.z,m.boss?2.8:1.7,m.boss?0xff7a24:0xffd75e,.38);
    glowFlash(m.x,m.y+1,m.z,m.boss?0xff7a24:0xffd75e,m.boss?2.8:2.0,.24);
    camShake=Math.max(camShake,m.boss?.22:.16);
    showName(m.boss?'BOSS STAGGERED':'STAGGER');
    return;
  }
  if(m.t==='dragonBreath'){
    const col=dragonTrailColor(m.element||'ember');
    burst(m.x, m.y, m.z, col, 22, 3.0, 2.2, .5);
    if(typeof SFX!=='undefined' && SFX.boom) SFX.boom();
    return;
  }
  if(m.t==='dragonGuard'){
    netDragonGuardFx(m);
    return;
  }
  if(m.t==='blacksmith'){
    blacksmithRitualVfx(m.action||'upgrade',m.id||I.IRON_SWORD,m.plus||0,m.name||'Tobin');
    return;
  }
  if(m.t==='wardenAlarm'||m.t==='wardenAwake'){
    const level=Math.max(1,Math.min(3,m.level|0||3)),radius=level===1?3.4:level===2?5.2:7.2;
    ringPulse(m.x,m.y+.08,m.z,radius,0x35d0c8,1.15);
    burst(m.x,m.y+.35,m.z,[.12,.85,.8],12+level*10,2.2+level,2.4,.55);
    if(SFX.wardenAlarm)SFX.wardenAlarm(level);else SFX.slamWarn();
    camShake=Math.max(camShake,level*.18);
    showName(m.t==='wardenAwake'?'THE WARDEN WAKES':'WARDEN ALARM '+level+'/3');
    return;
  }
  if(m.t==='wardenDefeated'){
    ringPulse(m.x,m.y+.08,m.z,5.2,0x78fff2,.7);
    burst(m.x,m.y+1,m.z,[.35,1,.95],46,5.6,4.4,.9);
    SFX.level();SFX.treasure();camShake=Math.max(camShake,.55);
    showName('WARDEN DEFEATED');
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
  } else if(m.t==='slamWarn'){
    SFX.slamWarn();
    ringPulse(m.x,m.y+.08,m.z,m.radius||4.6,0xffb238,1.05);
    showName('Boss Slam - leave the circle!');
  } else if(m.t==='meleeWarn'){
    SFX.slamWarn();
    ringPulse(m.x,m.y+.08,m.z,m.radius||1.6,0xff5a35,.72);
    if(m.label)showName(String(m.label)+' - dodge out!');
  } else if(m.t==='rangedWarn'){
    SFX.growl();
    const tx=Number.isFinite(m.tx)?m.tx:m.x,tz=Number.isFinite(m.tz)?m.tz:m.z,ty=Number.isFinite(m.ty)?m.ty:m.y+1;
    energyTrailVfx(m.x,m.y+1.3,m.z,tx,ty,tz,0xffd34f,.035,m.quick?.28:.42,.65);
    ringPulse(m.x,m.y+.08,m.z,.8,0xffd34f,.35);
    showName(m.quick?'Quick Shot - break line!':'Arrow Draw - sidestep!');
  } else if(m.t==='volleyWarn'){
    SFX.slamWarn();
    const mob=mobs.find(o=>o.net && o.netId===m.id),p=mob&&mob.grp&&mob.grp.position;
    if(p){
      const dx=m.dx||0,dz=m.dz||1,spread=m.wide?.95:.55;
      for(const off of [-spread,0,spread]){
        const ca=Math.cos(off),sa=Math.sin(off),vx=dx*ca-dz*sa,vz=dx*sa+dz*ca;
        energyTrailVfx(p.x,p.y+1.25,p.z,p.x+vx*10,p.y+1.25,p.z+vz*10,0xff7040,.04,.55,.58);
      }
    }
    showName(m.wide?'Watcher Volley - leave the lanes!':'Volley - leave the lanes!');
  } else if(m.t==='graveRingWarn'){
    SFX.slamWarn(); ringPulse(m.x,m.y+.08,m.z,6.2,0x7c3aed,1.25);
    ringPulse(m.x,m.y+.09,m.z,2.2,0x25103f,1.25);
    showName('Grave Ring — get close or move beyond the outer ring!');
  } else if(m.t==='rockWarn'||m.t==='rootWarn'){
    const root=m.t==='rootWarn',col=root?0x42d45b:0xff8a2a;
    for(const q of m.targets||[])ringPulse(q.x,9.08,q.z,1.65,col,1.05);
    showName(root?'Roots rising - move!':'Falling rock - move!');
  } else if(m.t==='rockFall'||m.t==='rootBurst'){
    const root=m.t==='rootBurst',color=root?[.2,.78,.28]:[.72,.42,.2];
    for(const q of m.targets||[]){burst(q.x,9.25,q.z,color,18,2.2,2.3,.5);ringPulse(q.x,9.08,q.z,1.65,root?0x42d45b:0xff8a2a,.25);}
    camShake=Math.max(camShake,.35);
  } else if(m.t==='tideWarn'){
    ringPulse(m.x,m.y+.08,m.z,7,0x38bdf8,1.25);ringPulse(m.x,m.y+.09,m.z,3,0x164e63,1.25);
    showName('Drowned Tide - leave the outer ring!');
  } else if(m.t==='tideBurst'){
    ringPulse(m.x,m.y+.08,m.z,7,0x38bdf8,.4);burst(m.x,m.y+.2,m.z,[.15,.65,1],34,6,1.5,.55);camShake=Math.max(camShake,.3);
  } else if(m.t==='bossStyleWarn'){
    SFX.slamWarn();
    const colors={cinder_smith:0xff5a1e,castellan:0xf4c95d,choir:0xa5f3fc,void_prior:0x7c3aed,rime_giant:0x8eeaff,thunder_warden:0x38bdf8,buried_monarch:0xfacc15,abyssal_gatekeeper:0x22d3ee,rift_monarch:0xf472b6};
    const labels={cinder_smith:'Molten Forge - leave the fire!',castellan:'Rune of the Keep - avoid the walls!',choir:'Shard Barrage - leave the lanes!',void_prior:'Sacred Silence - move!',rime_giant:'Icebreaker - get out of the cone!',thunder_warden:'Lightning Spear - sidestep!',buried_monarch:'Sandstorm Walls - find the pocket!',abyssal_gatekeeper:'Tentacle Drag - move!',rift_monarch:'Reality Tear - scatter!'};
    const col=colors[m.style]||0xffd45c,pat=m.pat||'';
    if(pat==='choir'||pat==='thunder'||pat==='rime'){
      const dx=m.dx||0,dz=m.dz||1,w=pat==='choir'?1.05:pat==='rime'?1.2:.36;
      for(const off of pat==='choir'?[-.72,-.36,0,.36,.72]:[-w,0,w]){
        const ca=Math.cos(off),sa=Math.sin(off),vx=dx*ca-dz*sa,vz=dx*sa+dz*ca;
        energyTrailVfx(m.x,m.y+1.25,m.z,m.x+vx*(pat==='thunder'?12:9),m.y+1.25,m.z+vz*(pat==='thunder'?12:9),col,.045,.75,.72);
      }
    }else if(pat==='buried'||pat==='castellan'){
      ringPulse(m.x,m.y+.08,m.z,pat==='buried'?8.4:6.8,col,1.25);ringPulse(m.x,m.y+.09,m.z,pat==='buried'?2.8:2.5,0x1b1208,1.25);
    }else if(pat==='rift'){
      ringPulse(m.x,m.y+.08,m.z,3.4,col,1.05);
      for(let i=0;i<12;i++){const a=i/12*6.283,r=1.2+(i%3)*.55;spawnParticle({x:m.x+Math.cos(a)*r,y:m.y+.45+(i%4)*.3,z:m.z+Math.sin(a)*r,vx:0,vy:.18,vz:0,life:.75,grav:0,r:.95,g:.25,b:.9});}
    }else{
      for(const q of m.targets||[])ringPulse(q.x,9.08,q.z,pat==='prior'||pat==='abyssal'?2.4:2.15,col,1.05);
    }
    showName(labels[m.style]||'Boss signature - move!');
  } else if(m.t==='bossStyleBurst'){
    const c={cinder_smith:[1,.34,.08],castellan:[.95,.75,.36],choir:[.64,.94,1],void_prior:[.48,.25,.92],rime_giant:[.72,.94,1],thunder_warden:[.32,.82,1],buried_monarch:[.95,.7,.22],abyssal_gatekeeper:[.18,.85,.92],rift_monarch:[.95,.25,.9]}[m.style]||[1,.85,.35];
    const hex=new THREE.Color(c[0],c[1],c[2]).getHex();
    if(m.targets&&m.targets.length)for(const q of m.targets){burst(q.x,9.35,q.z,c,20,2.6,2.5,.55);ringPulse(q.x,9.08,q.z,2.2,hex,.32);}
    burst(m.x,m.y+1,m.z,c,34,5.6,3.2,.72);ringPulse(m.x,m.y+.08,m.z,m.style==='buried_monarch'?8:m.style==='castellan'?6.8:3.4,hex,.38);
    if(m.style==='thunder_warden')addLightningBeam(m.x,m.y+2,m.z,m.x+(m.dx||0)*10,m.y+1.2,m.z+(m.dz||1)*10,.9);
    camShake=Math.max(camShake,.42);
  } else if(m.t==='graveRing'){
    SFX.boom(); camShake=Math.max(camShake,.42);
    ringPulse(m.x,m.y+.08,m.z,6.2,0x7c3aed,.42);
    burst(m.x,m.y+.25,m.z,[.38,.12,.72],32,5.5,2,.55);
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
  } else if(m.t==='combatReact'){
    const targets=Array.isArray(m.targets)?m.targets.slice(0,10):[{x:m.x,y:m.y,z:m.z}];
    const kind=String(m.kind||'');
    for(const t of targets){
      const tx=Number(t.x),ty=Number(t.y),tz=Number(t.z);
      if(!Number.isFinite(tx)||!Number.isFinite(ty)||!Number.isFinite(tz))continue;
      if(kind==='crit'||kind==='execute'){
        markMobReaction(t,kind,{duration:kind==='execute'?.72:.46,power:kind==='execute'?1.35:1});
        ringPulse(tx,ty+.08,tz,kind==='execute'?1.45:1.08,kind==='execute'?0x8b5cf6:0xffd24a,.4);
        glowFlash(tx,ty+1,tz,kind==='execute'?0xa855f7:0xffd24a,kind==='execute'?2.8:2.2,.3);
        burst(tx,ty+1,tz,kind==='execute'?[.55,.18,1]:[1,.78,.18],kind==='execute'?30:18,kind==='execute'?3.4:2.4,2.1,.55);
        camShake=Math.max(camShake,kind==='execute'?.3:.2);
        showName(kind==='execute'?'SHADOW EXECUTE':'CRITICAL');
      }else if(kind==='frost'){
        markMobReaction(t,'frost',{duration:1.05});
        ringPulse(tx,ty+.08,tz,1.2,0x8eeaff,.35);
        glowFlash(tx,ty+.9,tz,0x8eeaff,2.1,.25);
        burst(tx,ty+.75,tz,[.55,.9,1],16,2.0,1.7,.45);
        showName('FROST LOCK');
      }else if(kind==='root'){
        markMobReaction(t,'root',{duration:1.15,radius:2.8});
        ringPulse(tx,ty+.08,tz,1.12,0x42d45b,.38);
        rootClutchVfx(tx,ty,tz,1.8);
        showName('ROOTED');
      }else if(kind==='guardBlock'||kind==='guardCounter'){
        const counter=kind==='guardCounter';
        ringPulse(tx,ty+.08,tz,counter?1.72:1.45,counter?0x60a5fa:0xfbbf24,.45);
        glowFlash(tx,ty+1,tz,counter?0x93c5fd:0xfbbf24,counter?2.6:2.2,.28);
        burst(tx,ty+.9,tz,counter?[.38,.65,1]:[1,.72,.16],counter?24:18,counter?2.9:2.2,1.8,.42);
        camShake=Math.max(camShake,counter?.24:.16);
        showName(counter?'GUARDIAN COUNTER':'GUARDIAN BLOCK');
      }
    }
  } else if(m.t==='pantherClaw'){
    const targets=Array.isArray(m.targets)?m.targets.slice(0,8):[{x:m.x,y:m.y,z:m.z}];
    for(const t of targets){
      const tx=Number(t.x),ty=Number(t.y),tz=Number(t.z);
      if(!Number.isFinite(tx)||!Number.isFinite(ty)||!Number.isFinite(tz))continue;
      markMobReaction(t,'panther',{fromX:m.fromX,fromZ:m.fromZ,duration:.48});
      ringPulse(tx,ty+.08,tz,.82,0x22c55e,.28);
      glowFlash(tx,ty+.8,tz,0x86efac,1.8,.2);
      burst(tx,ty+.85,tz,[.1,1,.35],10,1.1,1.0,.34);
      for(let i=0;i<3;i++){
        const side=(i-1)*.18, yaw=Number(m.yaw)||0;
        const sx=tx+Math.cos(yaw)*side, sz=tz-Math.sin(yaw)*side;
        spawnParticle({x:sx,y:ty+.55+i*.18,z:sz,vx:-Math.sin(yaw)*.9,vy:.1,vz:-Math.cos(yaw)*.9,life:.22,grav:0,r:.68,g:1,b:.46});
      }
    }
    showName('Panther Claw');
  } else if(m.t==='legendary'){
    netLegendaryFx(m);
  } else if(m.t==='ability'){
    netAbilityFx(m);
  } else if(m.t==='dragonAbility'){
    netDragonAbilityFx(m);
  } else if(m.t==='dragonCare'){
    netDragonCareFx(m);
  } else if(m.t==='dragonRest'){
    netDragonRestFx(m);
  } else if(m.t==='dragonRecall'){
    dragonCommandFx({kind:m.kind,role:'recall',x:m.x,y:m.y,z:m.z,clearStaySpot:m.clearedStaySpot});
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
function addTempRootMesh(mesh,life=1.15){
  scene.add(mesh);
  beams.push({mesh,life,dispose:true});
  return mesh;
}
function rootTendrilMesh(x,y,z,len,yaw,thick,color,life){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(thick,thick*.72,len),new THREE.MeshLambertMaterial({color,transparent:true,opacity:.95}));
  mesh.position.set(x,y,z);
  mesh.rotation.set((Math.random()-.5)*.12,yaw,(Math.random()-.5)*.08);
  mesh.scale.y=.65+Math.random()*.55;
  return addTempRootMesh(mesh,life);
}
function rootClutchVfx(x,y,z,radius=5.8){
  const rootColors=[0x2f4f24,0x3f6a2b,0x5b7f32,0x16351d];
  for(let i=0;i<26;i++){
    const a=i/26*Math.PI*2+(Math.random()-.5)*.22;
    const dist=.7+Math.random()*radius*.94;
    const len=.7+Math.random()*1.25;
    const mid=dist-len*.45;
    rootTendrilMesh(x+Math.cos(a)*mid,y+.08,z+Math.sin(a)*mid,len,a+Math.PI/2,.07+Math.random()*.08,rootColors[i%rootColors.length],1.0+Math.random()*.38);
  }
  for(let i=0;i<17;i++){
    const a=i/17*Math.PI*2+Math.random()*.3, dist=.8+Math.random()*radius*.82;
    const bx=x+Math.cos(a)*dist,bz=z+Math.sin(a)*dist;
    for(let h=0;h<3;h++){
      const height=.65+h*.18+Math.random()*.38;
      const root=new THREE.Mesh(new THREE.CylinderGeometry(.035+h*.006,.095+h*.015,height,6),new THREE.MeshLambertMaterial({color:rootColors[(i+h)%rootColors.length],transparent:true,opacity:.96}));
      root.position.set(bx+Math.sin(a+h)*.13,y+height*.48,bz+Math.cos(a-h)*.13);
      root.rotation.z=Math.cos(a+h)*.42;
      root.rotation.x=Math.sin(a-h)*.42;
      addTempRootMesh(root,1.2+Math.random()*.42);
    }
    if(i%2===0)ringPulse(bx,y+.1,bz,.38+Math.random()*.3,0x14532d,.58);
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
    if(!(m.sid&&NET.room&&m.sid===NET.room.sessionId))animateRemoteGuardianCast(m);
    shockwaveEarthVfx(x,y,z,true);
    showName('Shockwave');
  } else if(m.kind==='mend'){
    healingPlusVfx(x,y+.05,z,.8,.8);
    ringPulse(x,y+.08,z,1.6,0x22c55e,.45);
    glowFlash(x,y+1,z,0x86efac,3.2,.34);
    burst(x,y+1,z,[.25,1,.42],22,2.4,2.4,.62);
    showName('Verdant Mend');
  } else if(m.kind==='roots'){
    const radius=Math.max(2,Number(m.radius)||5.8);
    ringPulse(x,y+.08,z,radius,0x22c55e,.55);
    ringPulse(x,y+.09,z,radius*.72,0x86efac,.5);
    ringPulse(x,y+.1,z,2.6,0x14532d,.6);
    glowFlash(x,y+.85,z,0x22c55e,4.8,.28);
    burst(x,y+.5,z,[.18,.8,.28],70,radius,2.2,.78);
    rootClutchVfx(x,y,z,radius);
    for(const t of Array.isArray(m.targets)?m.targets.slice(0,18):[]){
      const tx=Number(t.x),ty=Number(t.y),tz=Number(t.z);
      if(!Number.isFinite(tx)||!Number.isFinite(ty)||!Number.isFinite(tz))continue;
      rootClutchVfx(tx,ty,tz,1.15);
      glowFlash(tx,ty+.8,tz,0x86efac,2.2,.24);
      for(let h=0;h<8;h++){
        const a=h*.78+Math.random()*.25;
        spawnParticle({x:tx+Math.sin(a)*.28,y:ty+.08+h*.16,z:tz+Math.cos(a)*.28,
          vx:Math.sin(a)*.08,vy:.38+Math.random()*.18,vz:Math.cos(a)*.08,
          life:.82+Math.random()*.35,grav:.35,r:.2,g:.62,b:.18});
      }
    }
    for(let i=0;i<13;i++){
      const a=i/13*Math.PI*2+Math.random()*.2, r=1.0+Math.random()*4.6;
      const bx=x+Math.cos(a)*r, bz=z+Math.sin(a)*r;
      ringPulse(bx,y+.1,bz,.35+Math.random()*.22,0x14532d,.5);
      for(let h=0;h<6;h++){
        spawnParticle({x:bx+Math.sin(h*.95+a)*.12,y:y+.08+h*.18,z:bz+Math.cos(h*.95+a)*.12,
          vx:Math.sin(a+h)*.08,vy:.42+Math.random()*.18,vz:Math.cos(a+h)*.08,
          life:.75+Math.random()*.35,grav:.45,r:.18,g:.55,b:.16});
      }
    }
    for(let k=0;k<28;k++){
      const a=Math.random()*Math.PI*2, r=5.8*(.25+Math.random()*.75);
      spawnParticle({x:x+Math.cos(a)*r,y:y+.22,z:z+Math.sin(a)*r,
        vx:(Math.random()-.5)*.22,vy:.22+Math.random()*.5,vz:(Math.random()-.5)*.22,
        life:.9+Math.random()*.55,grav:-.15,r:.52,g:1,b:.44});
    }
    showName('Rootsnare');
  } else if(m.kind==='panther'){
    if(m.sid&&NET.room&&m.sid===NET.room.sessionId){
      if(globalThis.BlockcraftPantherFormFx)globalThis.BlockcraftPantherFormFx(m.durationMs||14000);
    } else {
      const r=m.sid&&NET.remotes&&NET.remotes[m.sid], api=companions&&companions();
      if(r&&api&&api.applyPantherFormVisual)api.applyPantherFormVisual(r,m.durationMs||14000);
      ringPulse(x,y+.08,z,1.4,0x22c55e,.45);
      ringPulse(x,y+.1,z,2.2,0x052e16,.6);
      glowFlash(x,y+1,z,0x22c55e,4.0,.3);
      burst(x,y+1,z,[.05,.9,.35],34,3,2.2,.62);
    }
    showName('Panther Form');
  } else if(m.kind==='buff'||m.kind==='armor'||m.kind==='dash'||m.kind==='summon'){
    // the caster already played these locally as prediction — this echo is for spectators
    if(m.sid&&NET.room&&m.sid===NET.room.sessionId)return;
    if(m.kind==='dash'||m.kind==='buff')animateRemoteShadowCast(m);
    if(m.kind==='armor')animateRemoteGuardianCast(m);
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
function animateRemoteShadowCast(m){
  const remote=m.sid&&NET.remotes&&NET.remotes[m.sid];if(!remote||!remote.grp)return;
  const arms=remote.arms||[],start=remote.grp.position.clone();
  if(m.kind==='dash'){
    if(arms[0])arms[0].rotation.x=.9;if(arms[1])arms[1].rotation.x=1.05;
    remote.grp.scale.set(1.08,.84,1.08);
    const dx=-Math.sin(m.yaw||0),dz=-Math.cos(m.yaw||0);
    for(let k=0;k<5;k++)setTimeout(()=>shadowDashAfterimage(start.x+dx*k*.8,start.y,start.z+dz*k*.8,k/5),k*25);
    setTimeout(()=>{if(!remote.grp)return;remote.grp.scale.set(1,1,1);for(const arm of arms)arm.rotation.x=0;},300);
    return;
  }
  if(arms[0])arms[0].rotation.x=-1.22;if(arms[1])arms[1].rotation.x=-.82;
  remote.grp.scale.setScalar(1.04);
  const aura=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas),color:0x8b5cf6,transparent:true,opacity:.38,depthWrite:false,blending:THREE.AdditiveBlending}));
  aura.position.set(0,1.05,-.18);aura.scale.set(1.35,2.25,1);remote.grp.add(aura);
  setTimeout(()=>{if(remote.grp){remote.grp.scale.set(1,1,1);for(const arm of arms)arm.rotation.x=0;}},620);
  setTimeout(()=>{if(aura.parent)aura.parent.remove(aura);aura.material.map.dispose();aura.material.dispose();},10000);
}
function animateRemoteGuardianCast(m){
  const remote=m.sid&&NET.remotes&&NET.remotes[m.sid];if(!remote||!remote.grp)return;
  const arms=remote.arms||[];
  if(m.kind==='shockwave'){
    if(arms[0])arms[0].rotation.x=-1.45;if(arms[1])arms[1].rotation.x=-1.3;
    remote.grp.scale.set(1.08,.88,1.08);
    setTimeout(()=>{if(!remote.grp)return;if(arms[0])arms[0].rotation.x=.42;if(arms[1])arms[1].rotation.x=.35;remote.grp.scale.set(1.12,.8,1.12);},180);
    setTimeout(()=>{if(remote.grp){remote.grp.scale.set(1,1,1);for(const arm of arms)arm.rotation.x=0;}},620);
    return;
  }
  if(m.kind==='secondwind'){
    if(arms[0])arms[0].rotation.x=.8;if(arms[1])arms[1].rotation.x=.7;remote.grp.scale.set(1,.82,1);
    setTimeout(()=>{if(!remote.grp)return;if(arms[0])arms[0].rotation.x=-.65;if(arms[1])arms[1].rotation.x=-.65;remote.grp.scale.setScalar(1.08);burst(remote.grp.position.x,remote.grp.position.y+1,remote.grp.position.z,[1,.82,.3],30,3,2.4,.7);},320);
    setTimeout(()=>{if(remote.grp){remote.grp.scale.set(1,1,1);for(const arm of arms)arm.rotation.x=0;}},900);
    return;
  }
  if(arms[0])arms[0].rotation.x=-.95;if(arms[1])arms[1].rotation.x=-.95;remote.grp.scale.setScalar(1.06);
  const shell=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowTexCanvas),color:0xf59e0b,transparent:true,opacity:.28,depthWrite:false,blending:THREE.AdditiveBlending}));
  shell.position.set(0,1.05,-.16);shell.scale.set(1.5,2.35,1);remote.grp.add(shell);
  setTimeout(()=>{if(remote.grp){remote.grp.scale.set(1,1,1);for(const arm of arms)arm.rotation.x=0;}},540);
  setTimeout(()=>{if(shell.parent)shell.parent.remove(shell);shell.material.map.dispose();shell.material.dispose();},15000);
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
function dragonCommandFx(m={}){
  const kind=m.kind||m.type||'ember';
  const role=m.role||'follow';
  const clear=!!m.clearStaySpot;
  const focus=!!m.focus;
  const x=Number.isFinite(+m.x)?+m.x:player.pos.x;
  const y=Number.isFinite(+m.y)?+m.y:player.pos.y;
  const z=Number.isFinite(+m.z)?+m.z:player.pos.z;
  const col=dragonTrailColor(kind), hex=new THREE.Color(col[0],col[1],col[2]).getHex();
  if(focus){
    const px=player.pos.x, py=player.pos.y, pz=player.pos.z;
    addLightningBeam(px,py+1.25,pz,x,y+1.1,z,.65);
    ringPulse(x,y+.08,z,2.8,0xfff2a8,.75);
    glowFlash(x,y+1,z,0xfff2a8,2.7,.34);
    burst(x,y+1,z,[1,.92,.48],18,2.4,2.0,.46);
    showName('Stay post marked');
    return;
  }
  if(clear){
    ringPulse(x,y+.08,z,2.35,0x8ea0aa,.55);
    for(let i=0;i<22;i++){
      const a=Math.random()*6.283, r=.35+Math.random()*2.0;
      spawnParticle({x:x+Math.cos(a)*r,y:y+.25+Math.random()*.8,z:z+Math.sin(a)*r,
        vx:Math.cos(a)*.18,vy:.22+Math.random()*.3,vz:Math.sin(a)*.18,life:.5+Math.random()*.32,grav:.2,r:.55,g:.62,b:.68});
    }
    showName('Stay post cleared');
    return;
  }
  if(role==='recall'){
    const px=player.pos.x, py=player.pos.y, pz=player.pos.z;
    const dx=x-px, dz=z-pz, d=Math.hypot(dx,dz)||1;
    const ex=px+dx/d*Math.min(3.4,d), ez=pz+dz/d*Math.min(3.4,d);
    addLightningBeam(px,py+1.35,pz,ex,py+1.45,ez,.78);
    ringPulse(px,py+.1,pz,1.35,0xfff2a8,.55);
    ringPulse(x,y+.08,z,2.05,hex,.58);
    for(let i=0;i<30;i++){
      const t=i/29, wig=Math.sin(t*18)*.28, sx=px+(x-px)*t+Math.cos(t*6.283)*wig, sz=pz+(z-pz)*t+Math.sin(t*6.283)*wig;
      spawnParticle({x:sx,y:py+.65+Math.sin(t*Math.PI)*.8,z:sz,vx:(Math.random()-.5)*.08,vy:.08+Math.random()*.16,vz:(Math.random()-.5)*.08,life:.45+Math.random()*.28,grav:-.04,r:i%3?col[0]:1,g:i%3?col[1]:.92,b:i%3?col[2]:.5});
    }
    glowFlash(x,y+1,z,hex,2.4,.3);
    showName(clear?'Dragon recalled - post cleared':'Dragon recalled');
    return;
  }
  if(role==='stay'){
    ringPulse(x,y+.08,z,2.2,hex,.75);
    ringPulse(x,y+.1,z,.92,0xfff2a8,.45);
    for(let i=0;i<28;i++){
      const a=i/28*6.283, r=1.4+Math.random()*.55;
      spawnParticle({x:x+Math.cos(a)*r,y:y+.08,z:z+Math.sin(a)*r,vx:0,vy:.55+Math.random()*.35,vz:0,
        life:.65+Math.random()*.28,grav:-.18,r:col[0],g:col[1],b:col[2]});
    }
    glowFlash(x,y+1,z,hex,2.1,.26);
    showName('Stay post set');
  } else if(role==='guard'){
    ringPulse(player.pos.x,player.pos.y+.12,player.pos.z,1.9,hex,.52);
    ringPulse(player.pos.x,player.pos.y+.18,player.pos.z,1.05,0xffffff,.26);
    burst(player.pos.x,player.pos.y+1.05,player.pos.z,col,18,2.2,1.8,.42);
    showName('Dragon Guard');
  } else if(role==='rest'){
    ringPulse(x,y+.08,z,1.75,0x70f06a,.65);
    for(let i=0;i<20;i++){
      const a=Math.random()*6.283, r=.35+Math.random()*1.5;
      spawnParticle({x:x+Math.cos(a)*r,y:y+.35+Math.random()*1.1,z:z+Math.sin(a)*r,
        vx:(Math.random()-.5)*.12,vy:.16+Math.random()*.28,vz:(Math.random()-.5)*.12,
        life:.85+Math.random()*.45,grav:-.08,r:.45,g:1,b:.5});
    }
    showName('Dragon Rest');
  } else {
    const dx=x-player.pos.x, dz=z-player.pos.z, d=Math.hypot(dx,dz)||1;
    addLightningBeam(player.pos.x,player.pos.y+1.05,player.pos.z,player.pos.x+dx/d*2.2,player.pos.y+1.25,player.pos.z+dz/d*2.2,.45);
    burst(player.pos.x,player.pos.y+1,player.pos.z,col,16,2.0,1.5,.36);
    showName('Dragon Follow');
  }
}
function netDragonRestFx(m){
  const kind=m.kind||'ember';
  const x=Number.isFinite(+m.x)?+m.x:player.pos.x, y=Number.isFinite(+m.y)?+m.y:player.pos.y, z=Number.isFinite(+m.z)?+m.z:player.pos.z;
  const col=dragonTrailColor(kind);
  const hex=new THREE.Color(col[0],col[1],col[2]).getHex();
  ringPulse(x,y+.08,z,2.15,0x70f06a,.7);
  ringPulse(x,y+.1,z,1.05,hex,.55);
  healingPlusVfx(x,y+.05,z,.68,.62);
  for(let i=0;i<18;i++){
    const a=Math.random()*6.283, r=.35+Math.random()*1.7;
    spawnParticle({x:x+Math.cos(a)*r,y:y+.35+Math.random()*1.25,z:z+Math.sin(a)*r,
      vx:(Math.random()-.5)*.18,vy:.18+Math.random()*.34,vz:(Math.random()-.5)*.18,
      life:.8+Math.random()*.45,grav:-.12,r:i%3?col[0]:.45,g:i%3?col[1]:1,b:i%3?col[2]:.42});
  }
  if(NET.room&&m.owner===NET.room.sessionId){
    const gain=Math.max(0,m.gain|0), suffix=gain?(' +'+gain+' happiness'):'';
    showName('Dragon Rest'+suffix);
  }
}
function netDragonGuardFx(m){
  const kind=m.kind||'ember';
  const x=Number.isFinite(+m.x)?+m.x:player.pos.x, y=Number.isFinite(+m.y)?+m.y:player.pos.y+1, z=Number.isFinite(+m.z)?+m.z:player.pos.z;
  const col=dragonTrailColor(kind);
  const hex=new THREE.Color(col[0],col[1],col[2]).getHex();
  burst(x,y,z,col,20,2.4,1.8,.44);
  ringPulse(x,y-.7,z,1.35,hex,.28);
  glowFlash(x,y,z,hex,2.3,.22);
  const side=(Math.random()<.5?-1:1), sx=x+side*.9, sz=z-.55, ex=x-side*.72, ez=z+.48;
  energyTrailVfx(sx,y+.45,sz,ex,y+.08,ez,hex,.05,.24,.88);
  energyTrailVfx(x-side*.42,y+.62,z-.28,x+side*.5,y+.18,z+.36,hex,.025,.2,.72);
  if(typeof spawnDamageNumber==='function' && m.damage) spawnDamageNumber({x,y:y-.7,z,n:m.damage|0,crit:false});
  if(NET.room&&m.owner===NET.room.sessionId){
    camShake=Math.max(camShake,.08);
    if(typeof SFX!=='undefined' && SFX.hit) SFX.hit();
    const gained=m.bondGained?(' +'+(m.bondGained|0)+' bond'):'';
    showName((m.role==='stay'?'Dragon Stay':'Dragon Guard')+gained);
  }
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
  const projectileThreat=Math.max(1,Number(m.threat)||1),projectileRing=Math.max(0,Number(m.ring)||0);
  const projectileScale=Math.min(2.25,1.15+projectileRing*.18+projectileThreat*.035);
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
    grp.add(new THREE.Mesh(new THREE.BoxGeometry(.34,.34,.34), new THREE.MeshBasicMaterial({color:0xc681ff})));
    grp.add(new THREE.Mesh(new THREE.BoxGeometry(.58,.58,.58), new THREE.MeshBasicMaterial({color:0x9a4fe0,transparent:true,opacity:.34,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending})));
    grp.scale.setScalar(projectileScale);
    grp.position.set(m.x,m.y,m.z);
    scene.add(grp);
    arrows.push({grp, vel:new THREE.Vector3(m.vx,m.vy,m.vz), life:2.4, stuck:false, dmg:0, bolt:true, visual:true});
    SFX.cast();
  } else {
    spawnArrow(m.x,m.y,m.z,0, m.x+m.vx, m.y+m.vy, m.z+m.vz);
    const a=arrows[arrows.length-1];
    a.vel.set(m.vx,m.vy,m.vz);
    a.visual=true;
    a.grp.scale.setScalar(projectileScale);
    const warn=[0xfff2a8,0xffc857,0xff7a38,0xff4fd8][Math.max(0,Math.min(3,projectileRing))]||0xfff2a8;
    const glow=new THREE.Mesh(new THREE.BoxGeometry(.18,.18,.92),new THREE.MeshBasicMaterial({color:warn,transparent:true,opacity:.42,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending}));
    glow.renderOrder=18;a.grp.add(glow);
    a.trailCol=[((warn>>16)&255)/255,((warn>>8)&255)/255,(warn&255)/255];
    const vfx=BIOME_VFX[EFFECT_BIOME[m.effect]];
    if(vfx){a.trailCol=vfx.col;for(const child of a.grp.children)if(child.material){child.material=child.material.clone();child.material.color.setHex(vfx.hex);}}
    SFX.bow();
  }
}
function netBiomeStatusFx(m){
  const vfx=BIOME_VFX[EFFECT_BIOME[m&&m.kind]];if(!vfx)return;
  const x=player.pos.x,y=player.pos.y,z=player.pos.z;
  burst(x,y+1,z,vfx.col,m.kind==='venom'?22:16,m.kind==='root'?1.2:2.2,m.kind==='root'?.8:2,.55);
  ringPulse(x,y+.08,z,m.kind==='root'?1.15:1.8,vfx.hex,.42);
  if(m.kind==='root'){
    for(let i=0;i<9;i++){const a=i/9*Math.PI*2,h=.65+(i%3)*.16;const rootMesh=new THREE.Mesh(new THREE.CylinderGeometry(.035,.09,h,5),new THREE.MeshLambertMaterial({color:i%2?0x4f6b31:0x6f843e,transparent:true}));rootMesh.position.set(x+Math.cos(a)*(.48+(i%2)*.18),y+h*.45,z+Math.sin(a)*(.48+(i%2)*.18));rootMesh.rotation.z=Math.cos(a)*.32;rootMesh.rotation.x=Math.sin(a)*.32;scene.add(rootMesh);beams.push({mesh:rootMesh,life:1.08,dispose:true});}
    setTimeout(()=>burst(player.pos.x,player.pos.y+.18,player.pos.z,[.42,.55,.24],18,2.1,1.2,.38),850);
  }
}
function netBiomeHitFx(reason){
  const effect=String(reason||'').replace(/_arrow$/,'');
  const vfx=BIOME_VFX[EFFECT_BIOME[effect]];if(!vfx)return;
  burst(player.pos.x,player.pos.y+1,player.pos.z,vfx.col,12,2,1.7,.38);
  ringPulse(player.pos.x,player.pos.y+.08,player.pos.z,1.35,vfx.hex,.28);
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
function decorateFirstPublicGate(local){
  if(!local||!local.grp||local.firstGateDecor||(local.rank|0)!==0||(local.kind||'public')!=='public')return;
  local.firstGateDecor=true;
  const group=new THREE.Group();
  const mat=new THREE.MeshBasicMaterial({color:0x8cff9a,transparent:true,opacity:.34,blending:THREE.AdditiveBlending,depthWrite:false});
  const gold=new THREE.MeshBasicMaterial({color:0xffd24a,transparent:true,opacity:.82,blending:THREE.AdditiveBlending,depthWrite:false});
  const base=new THREE.Mesh(new THREE.RingGeometry(1.9,2.35,44),mat);
  base.rotation.x=-Math.PI/2;base.position.y=.08;group.add(base);
  for(const x of [-2.05,2.05]){
    const pylon=new THREE.Mesh(new THREE.CylinderGeometry(.08,.14,2.8,6),gold);
    pylon.position.set(x,1.42,0);group.add(pylon);
    const flame=new THREE.Mesh(new THREE.SphereGeometry(.22,8,6),mat);
    flame.position.set(x,2.98,0);group.add(flame);
  }
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=72;
  const cx=canvas.getContext('2d');
  cx.fillStyle='rgba(5,14,20,.8)';cx.fillRect(8,10,240,52);
  cx.strokeStyle='#8cff9a';cx.lineWidth=4;cx.strokeRect(8,10,240,52);
  cx.font='bold 24px Courier New';cx.textAlign='center';cx.fillStyle='#eaffc8';cx.fillText('FIRST GATE',128,42);
  const tex=new THREE.CanvasTexture(canvas);tex.magFilter=THREE.NearestFilter;tex.minFilter=THREE.NearestFilter;
  const banner=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));
  banner.position.y=5.05;banner.scale.set(4.1,1.15,1);group.add(banner);
  local.grp.add(group);
  local.firstGateAura=group;
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
        local={id:g.id, dungeonId:g.dungeonId||'', x:g.x, y:g.y, z:g.z, rank:g.rank, kind:g.kind||'public', shard, expiresAt:g.expiresAt||0, colArr:tier?tier.c3.slice():hex01(RANKS[g.rank].col), grp:makeGateMesh(gateCol)};
        netGates[g.id]=local;
        setGateLabel(local);
        scene.add(local.grp);
        burst(g.x, g.y+1.5, g.z, local.colArr, 30, 3, 3, .9);
      }
      local.x=g.x; local.y=g.y; local.z=g.z; local.dungeonId=g.dungeonId||''; local.rank=g.rank; local.kind=g.kind||'public'; local.shard=shard; local.expiresAt=g.expiresAt||0;
      decorateFirstPublicGate(local);
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

function clearDungeonBossGallery(){
  if(bossGalleryRAF){cancelAnimationFrame(bossGalleryRAF);bossGalleryRAF=0;bossGalleryLast=0;}
  if(!bossGallery.length)return false;
  for(const entry of bossGallery){
    if(entry&&entry.grp)scene.remove(entry.grp);
    if(entry&&entry.grp)disposeObjectTree(entry.grp);
  }
  bossGallery=[];
  return true;
}
function tickDungeonBossGalleryFrame(now){
  if(!bossGallery.length){bossGalleryRAF=0;bossGalleryLast=0;return;}
  const dt=Math.min(.05,(now-(bossGalleryLast||now))/1000);bossGalleryLast=now;
  const t=now/1000;
  for(let i=0;i<bossGallery.length;i++){
    const model=bossGallery[i];if(!model||!model.grp)continue;
    model.grp.rotation.y+=Math.sin(t*.7+i)*.0025+.002;
    if(model.styleAura){model.styleAura.rotation.z+=dt*1.25;model.styleAura.scale.setScalar(1+Math.sin(t*3+(model.phase||0))*.05);}
    if(model.conceptFx)tickBossConceptFx(model,dt,t,0);
  }
  bossGalleryRAF=requestAnimationFrame(tickDungeonBossGalleryFrame);
}
function showDungeonBossGallery(){
  const pools=globalThis.BlockcraftDungeonPools;
  if(!pools||!Array.isArray(pools.DUNGEON_POOLS))return false;
  clearDungeonBossGallery();
  const defs=[];
  pools.DUNGEON_POOLS.forEach((ids,rank)=>ids.forEach((id,slot)=>{
    const def=pools.dungeonDefinition?pools.dungeonDefinition(rank,slot,id):(pools.DUNGEON_DEFINITIONS&&pools.DUNGEON_DEFINITIONS[id])||{};
    defs.push({rank,id,def});
  }));
  if(!defs.length)return false;
  const yaw=Number(player&&player.yaw)||0,px=Number(player&&player.pos&&player.pos.x)||0,py=Number(player&&player.pos&&player.pos.y)||9,pz=Number(player&&player.pos&&player.pos.z)||0;
  const fx=-Math.sin(yaw),fz=-Math.cos(yaw),rx=Math.cos(yaw),rz=-Math.sin(yaw);
  const cols=4,gapX=5.2,gapZ=5.4,start=(cols-1)*-.5,baseDist=10.5;
  defs.forEach((entry,i)=>{
    const col=i%cols,row=Math.floor(i/cols),x=px+fx*(baseDist+row*gapZ)+rx*((start+col)*gapX),z=pz+fz*(baseDist+row*gapZ)+rz*((start+col)*gapX);
    const ref={kind:'boss',bossStyle:entry.def&&entry.def.combat&&entry.def.combat.bossStyle||'',displayName:entry.def&&entry.def.boss||'Gate Monarch',hp:100,maxHp:100,state:''};
    const model=makeGateBoss();model.boss=true;model.ref=ref;model.hp=100;model.kind='boss';model.phase=i*.41;
    model.galleryPreview=true;
    model.grp.scale.setScalar(1.15+(entry.rank*.035));
    decorateBossStyle(model,ref);
    model.grp.position.set(x,py,z);
    model.grp.rotation.y=Math.atan2(px-x,pz-z);
    const label=textSprite((BOSS_GALLERY_RANK_LABELS[entry.rank]||'?')+' · '+(entry.def&&entry.def.boss||entry.id), '#ffe58a', .72);
    label.position.y=3.25;model.grp.add(label);
    const sub=textSprite(entry.def&&entry.def.name||entry.id, '#9eeaff', .52);
    sub.position.y=2.82;model.grp.add(sub);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(1.18,.035,8,36),new THREE.MeshBasicMaterial({color:0xffd45c,transparent:true,opacity:.42,depthWrite:false}));
    ring.rotation.x=Math.PI/2;ring.position.y=.06;model.grp.add(ring);
    scene.add(model.grp);
    bossGallery.push(model);
  });
  if(bossGallery.length&&!bossGalleryRAF)bossGalleryRAF=requestAnimationFrame(tickDungeonBossGalleryFrame);
  return bossGallery.length;
}


  return Object.freeze({
    isAnimalKind,
    netAddMob,
    netRemoveMob,
    netMobTick,
    netFx,
    netDragonAbilityFx,
    netDragonCareFx,
    dragonCommandFx,
    addLightningBeam,
    netSpawnProjectile,
    netBiomeStatusFx,
    netBiomeHitFx,
    netMirrorGate,
    showDungeonBossGallery,
    clearDungeonBossGallery,
  });
}
