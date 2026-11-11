import {skillLevel,MAX_SKILL_XP} from './skill-curve.js';
export const quarryRoom='quarry';
export const quarryMiner={x:3,y:3};
export const miningRules={duration:4500,hits:3,respawnMs:45000};
export const oreProducts={
 copperOre:{name:'Copper Ore',price:6,level:1,xp:10,color:'#e5a16d',icon:'◆',group:'materials'},
 ironOre:{name:'Iron Ore',price:10,level:3,xp:14,color:'#a2c9df',icon:'◆',group:'materials'}
};
export const oreDeposits=[
 {id:'copper-west',x:2,y:6,ore:'copperOre'},
 {id:'copper-north',x:6,y:2,ore:'copperOre'},
 {id:'copper-east',x:8,y:5,ore:'copperOre'},
 {id:'iron-north',x:9,y:2,ore:'ironOre'},
 {id:'iron-south',x:6,y:7,ore:'ironOre'}
];
export function normalizeMining(input={}){
 const {pickOwned=false,equipped=false,xp=0}=input;
 if(typeof pickOwned!=='boolean'||typeof equipped!=='boolean'||equipped&&!pickOwned||!Number.isSafeInteger(xp)||xp<0||xp>MAX_SKILL_XP)throw new Error('Invalid mining progress.');
 return {pickOwned,equipped,xp};
}
export const miningLevel=mining=>skillLevel(mining?.xp??0);
export function miningPose(state){
 const cut=state.miningCut,node=oreDeposits.find(node=>node.id===cut?.node);
 return cut&&node?{...cut,x:node.x,y:node.y,room:quarryRoom}:null;
}
export const besideDeposit=(position,node)=>!!position&&Math.abs(position.x-node.x)+Math.abs(position.y-node.y)===1;
export function drawOreDeposit(item,time,{point,polygon,ctx,reduced},state={}){
 const depleted=state.readyAt>Date.now(),[x,y]=point(item.x+.5,item.y+.5),ore=oreProducts[item.ore];
 const h=depleted?5:20;
 polygon([[x-16,y],[x-14,y-h],[x-2,y-h-8],[x+12,y-h+1],[x+16,y],[x+3,y+7]],'#455666','#20333f');
 polygon([[x-14,y-h],[x-2,y-h-8],[x+12,y-h+1],[x-1,y-4]],'#73858c');
 if(!depleted){
  ctx.fillStyle=ore.color;
  for(const [dx,dy] of [[-8,-13],[2,-18],[7,-8],[-2,-7]])ctx.fillRect(Math.round(x+dx),Math.round(y+dy),4,3);
  if(state.hits){ctx.strokeStyle='#26323e';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-2,y-23);ctx.lineTo(x+1,y-12);ctx.lineTo(x-5,y-6);if(state.hits>1){ctx.moveTo(x+1,y-12);ctx.lineTo(x+9,y-16);}ctx.stroke();}
 }
 if(!reduced&&state.hitAge>=0&&state.hitAge<650){
  const t=state.hitAge/650;ctx.save();ctx.globalAlpha=1-t;
  for(let i=0;i<6;i++){ctx.fillStyle=i%2?ore.color:'#acb7bd';ctx.fillRect(Math.round(x+(i-2.5)*t*8),Math.round(y-9-Math.sin(t*Math.PI)*12+(i%2)*4),2,2);}
  ctx.restore();
 }
}
export function pickaxeArt(){
 return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="m17 53 26-38 5 3-26 38z" fill="#b48c62" stroke="#513f3c" stroke-width="2"/><path d="M16 13q23-12 40 14l-11-7-9-2-10 3-12 8z" fill="#b8ced8" stroke="#405869" stroke-width="2"/><path d="m19 13 12-2 14 6" fill="none" stroke="#eff0d5" stroke-width="2"/></svg>';
}
export function drawQuarryCliffs({block,surface}){
 const stone=['#8b9190','#394952','#647078'];
 for(const [x,y,w,d,h] of [[1,-.4,3,.4,20],[6,-.45,4.7,.45,30],[12,1,.6,2.5,24],[12,6,.6,2.7,17]]){
  block(x,y,w,d,0,h,stone);
  surface(x+.06,y+.04,w-.12,d-.08,h+.1,'#a5a395');
 }
}
