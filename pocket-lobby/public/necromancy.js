import {skillLevel} from './skill-curve.js';
import {pvpRooms} from './pvp.js';
export const raisableBeasts={boar:'boar',thornBoar:'boar',dusktusk:'boar',beetle:'beetle',moonbackStag:'stag',depthsBoar:'boar',depthsBeetle:'beetle'};
export const undeadNames={boar:'Undead Boar',beetle:'Undead Beetle',stag:'Undead Stag'};
export const raisedRoom=room=>typeof room==='string'&&(pvpRooms.has(room)||room.startsWith('depths')||room==='millCellar'||room==='crystaldeep');
const time=n=>Number.isSafeInteger(n)&&n>0;
export function normalizeNecromancy(input,learned=[]){
 if(!learned.includes('raiseFallen'))return {};
 const f=input?.fallen,a=input?.raised,id=value=>typeof value==='string'&&value.length>0&&value.length<=100;
 const fallen=id(f?.id)&&Object.hasOwn(raisableBeasts,f?.enemy)&&raisedRoom(f.room)&&time(f.until)&&Number.isInteger(f.x)&&f.x>=0&&f.x<30&&Number.isInteger(f.y)&&f.y>=0&&f.y<30?{id:f.id,enemy:f.enemy,room:f.room,until:f.until,x:f.x,y:f.y}:null;
 const raised=id(a?.id)&&Object.hasOwn(raisableBeasts,a?.enemy)&&time(a.summonedAt)&&time(a.until)&&a.until>a.summonedAt&&a.until<=a.summonedAt+60000&&time(a.nextAt)&&Number.isInteger(a.damage)&&a.damage>=1&&a.damage<=16?{id:a.id,enemy:a.enemy,summonedAt:a.summonedAt,until:a.until,nextAt:a.nextAt,damage:a.damage,...(time(a.lastStrikeAt)?{lastStrikeAt:a.lastStrikeAt}:{})}:null;
 return {...(fallen?{fallen}:{}),...(raised?{raised}:{})};
}
export function raisedProfile(stats,stage=1){
 const extra=Math.max(0,skillLevel(stats?.magicKnowledgeXp)-5);
 return {damage:Math.min(16,6+extra+stage-1),duration:Math.min(60000,30000+extra*2500+(stage-1)*5000)};
}
export function activeRaised(state,now=Date.now()){
 const a=state.styleAbilities?.raised;
 return state.styleAbilities?.learned?.includes('raiseFallen')&&state.health>0&&!state.vaultCoop&&!state.hunting?.recoveryUntil&&raisedRoom(state.location)&&a?.summonedAt<=now&&a.until>now?a:null;
}
export function drawUndeadAlly(ctx,x,y,ally,time,reduced=false,{attackAge=Infinity,flipped=false}={}){
 if(!ally)return;
 const kind=raisableBeasts[ally.enemy],phase=reduced?0:time/190,bob=reduced?0:Math.sin(phase)*.5;
 const lunge=!reduced&&attackAge>=0?Math.max(0,1-attackAge/400)*5:0;
 ctx.save();ctx.translate(Math.round(x+(flipped?-lunge:lunge)),Math.round(y+bob));if(flipped)ctx.scale(-1,1);ctx.imageSmoothingEnabled=false;
 const p=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
 ctx.strokeStyle='#84e4b4';ctx.globalAlpha=.35;ctx.beginPath();ctx.ellipse(0,0,15,5,0,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
 const feet=reduced?0:Math.round(Math.sin(phase));
 if(kind==='beetle'){
  for(const side of [-1,1])for(let i=0;i<3;i++){p(side<0?-14:8,-10+i*3,6,1,'#e3d9ad');p(side<0?-15:13,-9+i*3,2,3,'#8dafa4');}
  p(-9,-16,18,13,'#294d4b');p(-7,-15,14,10,'#a7c6ad');p(-1,-15,2,11,'#3c6863');for(let i=0;i<3;i++)p(-6,-13+i*3,12,1,'#e2dfb9');p(-4,-20,8,6,'#cdd9b8');p(-3,-18,2,2,'#7dffb3');p(1,-18,2,2,'#7dffb3');
 }else{
  p(-10,-14,20,9,'#294d4b');p(-8,-13,16,7,'#c4d0ac');for(let i=0;i<4;i++)p(-6+i*4,-12,1,7,'#497769');p(-8,-15,15,2,'#efe2b6');
  for(const [dx,offset] of [[-8,feet],[-3,-feet],[5,-feet],[8,feet]]){p(dx,-5,2,5+offset,'#b5c5a4');p(dx-1,offset,3,1,'#e4ddbc');}
  p(7,-18,8,8,'#d4d8b6');p(10,-15,7,4,'#eae1b8');p(10,-17,2,2,'#62ffb0');p(7,-20,3,3,'#94bba1');p(-13,-13,4,1,'#bcccb0');
  if(kind==='stag'){p(8,-26,1,8,'#d8d9b4');p(6,-25,2,1,'#d8d9b4');p(11,-27,1,9,'#d8d9b4');p(12,-25,3,1,'#d8d9b4');p(14,-27,1,3,'#d8d9b4');}
  else{p(14,-12,3,1,'#fff2c9');p(16,-14,1,3,'#fff2c9');}
 }
 if(!reduced)for(let i=0;i<4;i++){const q=(time/120+i*5)%22;p(-12+i*8+Math.sin(phase+i)*2,-q-4,1,2,i%2?'#bbf5c9':'#66cda9');}
 ctx.restore();
}
