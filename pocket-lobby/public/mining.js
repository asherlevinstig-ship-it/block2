import {skillLevel,MAX_SKILL_XP} from './skill-curve.js';
export const quarryRoom='quarry';
export const deepMiningRoom='crystaldeep';
export const miningRooms=[quarryRoom,deepMiningRoom];
export const depositRoom=node=>node.room??quarryRoom;
export const miningDestination=policy=>policy?.area===deepMiningRoom?deepMiningRoom:quarryRoom;
export const deepMiningRequirement=state=>miningLevel(state.mining)<3?'Reach Mining 3 before mining Crystaldeep veins.':!['copper','iron','runic'].includes(state.mining?.pick)?'Equip a Copper Pickaxe or better for Crystaldeep veins.':'';
export const miningGuardAwake=(state,now)=>now>=(state.hunting?.crystalRespawnAt??0);
export const quarryMiner={x:3,y:3};
export const miningRules={duration:4500,hits:3,respawnMs:45000};
export const miningFinds={
 uncutQuartz:{name:'Uncut Quartz',price:50,color:'#bce9ff',chance:.04,icon:'◇',group:'materials'},
 ancientFossil:{name:'Ancient Fossil',price:35,color:'#efcea0',chance:.03,icon:'◎',group:'materials'},
 runicFragment:{name:'Runic Fragment',price:20,color:'#c2afff',chance:.05,icon:'✦',group:'materials'}
};
// A server-created swing ID keeps the reward stable across transaction retries.
export function miningFind(id,luckXp=0){
 let hash=2166136261;for(const c of id)hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
 const roll=hash/4294967296,bonus=Math.min(4,Math.max(0,skillLevel(luckXp)-1))*.01;
 let threshold=0;
 for(const [key,item] of Object.entries(miningFinds)){threshold+=item.chance+bonus/3;if(roll<threshold)return key;}
 return null;
}
export function miningFindArt(id){
 const item=miningFinds[id];
 const shape=id==='uncutQuartz'?'<path d="m32 7 17 16-7 29-21 3-9-29z"/><path d="m32 7 3 24 14-8M35 31l7 21M12 26l23 5-14 24" fill="none" stroke="#f3fbff"/>':id==='ancientFossil'?'<path d="M10 17 43 9l13 32-15 14-29-6z"/><path d="M42 37c-17 19-29-6-14-13 14-6 20 13 7 15-8 1-9-9-2-9" fill="none" stroke="#7d654d" stroke-width="4"/>':'<path d="m23 8 25 7 6 23-23 17-19-19z"/><path d="m27 18 11 3-10 9 12 2-9 13M19 27l4 12" fill="none" stroke="#eee0ff" stroke-width="3"/>';
 return '<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="'+item.color+'" stroke="#44536b" stroke-width="2">'+shape+'</g></svg>';
}
export const pickaxes={
 basic:{name:'Basic Pickaxe',duration:4500,level:1,color:'#b8ced8'},
 copper:{name:'Copper Pickaxe',duration:3600,level:2,color:'#e9ac76',bars:3,timber:2,bar:'copperBar'},
 iron:{name:'Iron Pickaxe',duration:2800,level:3,color:'#e0edf2',bars:5,timber:4,bar:'ironBar'},
 runic:{name:'Runic Pickaxe',duration:2400,level:5,color:'#b7a2f4',bars:8,timber:6,bar:'ironBar',requires:'iron',materials:{runicFragment:5,uncutQuartz:2},bonusChance:.1}
};
export function miningBonusOre(mining,id){
 const chance=pickaxes[mining?.pick??'basic'].bonusChance??0;
 if(!mining?.equipped||!chance)return 0;
 let hash=2166136261;for(const c of 'bonus:'+id)hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
 return hash/4294967296<chance?1:0;
}
export const oreProducts={
 copperOre:{name:'Copper Ore',price:6,level:1,xp:10,color:'#e5a16d',icon:'◆',group:'materials'},
 ironOre:{name:'Iron Ore',price:10,level:3,xp:14,color:'#a2c9df',icon:'◆',group:'materials'}
};
export const oreDeposits=[
 {id:'copper-west',x:2,y:6,ore:'copperOre'},
 {id:'copper-north',x:6,y:2,ore:'copperOre'},
 {id:'copper-east',x:8,y:5,ore:'copperOre'},
 {id:'iron-north',x:9,y:2,ore:'ironOre'},
 {id:'iron-south',x:6,y:7,ore:'ironOre'},
 {id:'deep-copper',room:deepMiningRoom,x:3,y:2,ore:'copperOre',yield:2},
 {id:'deep-iron-east',room:deepMiningRoom,x:8,y:5,ore:'ironOre',yield:2,guarded:true},
 {id:'deep-iron-south',room:deepMiningRoom,x:7,y:7,ore:'ironOre',yield:2,guarded:true}
];
export function normalizeMining(input={}){
 const {pickOwned=false,equipped=false,xp=0}=input;
 if(typeof pickOwned!=='boolean'||typeof equipped!=='boolean'||equipped&&!pickOwned||!Number.isSafeInteger(xp)||xp<0||xp>MAX_SKILL_XP)throw new Error('Invalid mining progress.');
 const upgrades=input.upgrades??[],pick=input.pick??'basic';
 if(!Array.isArray(upgrades)||upgrades.some(id=>!['copper','iron','runic'].includes(id))||!Object.hasOwn(pickaxes,pick)||pick!=='basic'&&!upgrades.includes(pick)||upgrades.length&&!pickOwned)throw new Error('Invalid pickaxe ownership.');
 return {pickOwned,equipped,xp,upgrades:[...new Set(upgrades)],pick};
}
export const miningLevel=mining=>skillLevel(mining?.xp??0);
export const equippedPickaxe=mining=>pickaxes[mining?.pick??'basic'];
export const miningDuration=mining=>equippedPickaxe(mining).duration;
export function normalizeAutoMining(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Choose valid Auto Mining settings.');
 const {ore='copperOre',keep=0,area=quarryRoom}=input;
 if(!miningRooms.includes(area))throw new Error('Choose the safe quarry or dangerous Crystaldeep Tunnels.');
 if(!Object.hasOwn(oreProducts,ore)||!Number.isSafeInteger(keep)||keep<0||keep>1000000)throw new Error('Choose copper or iron and 0–1,000,000 ore to keep.');
 return {ore,keep,...(area===deepMiningRoom?{area}:{})};
}
export function miningReportText(plan,state){
 const id=plan.mining?.ore;if(!id)return '';
 const count=plan.ores?.[id]??0,sale=plan.oreSales?.[id]??{quantity:0,gold:0};
 const finds=Object.entries(plan.miningFinds??{}).filter(([key])=>miningFinds[key]).map(([key,n])=>n+' '+miningFinds[key].name);
 return 'Mined '+count+' '+oreProducts[id].name+' · +'+(plan.miningXp??0)+' Mining XP · Sold '+sale.quantity+' for '+sale.gold+' gold · '+(state.huntingLoot?.[id]??0)+' in your bag.'+(finds.length?' Discoveries kept: '+finds.join(', ')+'.':'');
}
export function miningPose(state){
 const cut=state.plan?.miningWork?.cut??state.miningCut,node=oreDeposits.find(node=>node.id===cut?.node);
 return cut&&node?{...cut,pick:state.mining?.pick??'basic',x:node.x,y:node.y,room:depositRoom(node)}:null;
}
export const besideDeposit=(position,node)=>!!position&&Math.abs(position.x-node.x)+Math.abs(position.y-node.y)===1;
export function drawOreDeposit(item,time,{point,polygon,ctx,reduced},state={}){
 const depleted=state.readyAt>Date.now()||state.broken&&state.hitAge<1200,[x,y]=point(item.x+.5,item.y+.5),ore=oreProducts[item.ore];
 const h=depleted?5:20;
 polygon([[x-16,y],[x-14,y-h],[x-2,y-h-8],[x+12,y-h+1],[x+16,y],[x+3,y+7]],'#455666','#20333f');
 polygon([[x-14,y-h],[x-2,y-h-8],[x+12,y-h+1],[x-1,y-4]],'#73858c');
 if(!depleted){
  ctx.fillStyle=ore.color;
  for(const [dx,dy] of [[-8,-13],[2,-18],[7,-8],[-2,-7]])ctx.fillRect(Math.round(x+dx),Math.round(y+dy),4,3);
  if(state.hits){ctx.strokeStyle='#26323e';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-2,y-23);ctx.lineTo(x+1,y-12);ctx.lineTo(x-5,y-6);if(state.hits>1){ctx.moveTo(x+1,y-12);ctx.lineTo(x+9,y-16);}ctx.stroke();}
 }
 if((state.broken||state.bonus)&&state.hitAge>=0&&state.hitAge<1100){
  const t=state.hitAge/1100;ctx.save();ctx.globalAlpha=(1-t)*.65;
  ctx.strokeStyle=state.find?miningFinds[state.find].color:state.bonus?'#c2afff':ore.color;ctx.lineWidth=2;
  ctx.beginPath();ctx.ellipse(x,y+2,18+(reduced?0:t*24),7+(reduced?0:t*9),0,0,Math.PI*2);ctx.stroke();
  if(!reduced)for(let i=0;i<14;i++){
   const angle=i*2.399,spread=t*(15+i%4*6),px=x+Math.cos(angle)*spread,py=y+Math.sin(angle)*spread*.42-Math.sin(t*Math.PI)*(12+i%3*7);
   ctx.fillStyle=i%3?ore.color:'#9eaeb5';ctx.fillRect(Math.round(px),Math.round(py),i%3+2,i%3+2);
  }
  ctx.restore();
 }
 if(!reduced&&state.hitAge>=0&&state.hitAge<650){
  const t=state.hitAge/650;ctx.save();ctx.globalAlpha=1-t;
  for(let i=0;i<6;i++){ctx.fillStyle=i%2?ore.color:'#acb7bd';ctx.fillRect(Math.round(x+(i-2.5)*t*8),Math.round(y-9-Math.sin(t*Math.PI)*12+(i%2)*4),2,2);}
  ctx.restore();
 }
}
export function pickaxeArt(tier='basic'){
 const runes=tier==='runic'?'<path d="m17 28 26-12 12 11" fill="none" stroke="#a59cfc" stroke-width="7" opacity=".22"/><path d="m28 16 3 4 3-5m3 3 3 5 3-3M32 32l4 3m-9 4 4 3" fill="none" stroke="#e1ffff" stroke-width="2"/><path d="m44 10 4 4-4 4-4-4z" fill="#b1f2ef"/>':'';
 return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="m17 53 26-38 5 3-26 38z" fill="'+(tier==='runic'?'#655587':'#b48c62')+'" stroke="#513f3c" stroke-width="2"/><path d="M16 13q23-12 40 14l-11-7-9-2-10 3-12 8z" fill="'+pickaxes[tier].color+'" stroke="#405869" stroke-width="2"/><path d="m19 13 12-2 14 6" fill="none" stroke="#eff0d5" stroke-width="2"/>'+runes+'</svg>';
}
export function drawQuarryCliffs({block,surface}){
 const stone=['#8b9190','#394952','#647078'];
 for(const [x,y,w,d,h] of [[1,-.4,3,.4,20],[6,-.45,4.7,.45,30],[12,1,.6,2.5,24],[12,6,.6,2.7,17]]){
  block(x,y,w,d,0,h,stone);
  surface(x+.06,y+.04,w-.12,d-.08,h+.1,'#a5a395');
 }
}
