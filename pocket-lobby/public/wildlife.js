export const wildlifeRoom='wildlifeReserve';
export const wildlifeView={width:864,height:520,cols:24,rows:20,originX:396,originY:68};
export const wildlifeHabitats={
 otter:{name:'Reed Pools',anchor:{x:6,y:10},forage:{x:4,y:8},food:'River Snack',steps:['observe','feed','feed','bond']},
 fox:{name:'Amber Meadow',anchor:{x:17,y:17},forage:{x:13,y:16},food:'Amber Berry',steps:['observe','feed','observe','feed','bond']},
 owl:{name:'Moonpine Ridge',anchor:{x:16,y:2},forage:{x:16,y:2},food:'Moonpine Seed',steps:['observe','feed','feed','perch','feed','bond']}
};
export function reserveWater(x,y){return x>=2&&x<=7&&y>=11&&y<=16&&(x>=3||y>=12&&y<=15)&&(x<=6||y>=12&&y<=15);}
export const wildlifeArea={
 number:'23',name:'Moonwood Wildlife Reserve',description:'Quiet trails lead to reed pools, amber grass and moonlit pines. Watch the wild animals and approach one when it stops.',
 badge:'WILDLIFE RESERVE',floor:'Three habitats',center:[10,9],palette:['#52664f','#6c8054','#b4a37a'],
 authored:[['wildtree',1,2],['wildtree',3,1],['wildtree',6,2],['wildtree',9,2],['wildtree',0,5],['wildtree',1,7],['wildtree',5,4],['wildtree',7,5],['wildtree',10,5],['wildtree',11,1],['wildtree',14,1],['wildtree',17,0],['wildtree',20,1],['wildtree',23,1],['wildtree',23,5],['wildtree',21,2],['wildtree',21,6],['wildtree',19,8],['wildtree',23,10],['wildtree',22,16],['wildtree',23,18],['wildtree',20,19],['wildtree',15,19],['wildtree',10,18],['wildtree',8,19],['wildtree',1,18],['wildtree',0,16],['wildtree',1,11],['wildrock',13,3],['wildrock',19,4],['wildrock',20,7],['wildrock',3,17],['wildrock',5,18],['wildrock',10,13],['wildrock',12,16],['wildrock',19,16],['wildrock',21,12],['wildbloom',4,7],['wildbloom',7,8],['wildbloom',10,16],['wildbloom',13,10],['wildbloom',15,11],['wildbloom',18,18],['wildbloom',21,14],['moonbloom',16,3],['moonbloom',19,2],['moonbloom',16,8]]
};
const routes={
 'reed-otter':{kind:'otter',offset:0,stops:[[4,10],[8,10],[8,15],[8,10]]},
 'bank-otter':{kind:'otter',offset:5300,stops:[[6,17],[9,17],[9,13],[9,17]]},
 'meadow-fox':{kind:'fox',offset:2400,stops:[[14,13],[18,13],[18,17],[14,17]]},
 'brush-fox':{kind:'fox',offset:7900,stops:[[16,12],[20,12],[20,15],[16,15]]},
 'ridge-owl':{kind:'owl',offset:3800,stops:[[14,4],[17,4],[17,7],[14,7]]},
 'pine-owl':{kind:'owl',offset:9600,stops:[[18,3],[20,3],[20,6],[18,6]]}
};
const REST_MS=10000, STEP_MS=570;
export const FORAGE_COOLDOWN_MS=12000, FORAGE_CAP=3;
export function wildAnimal(id,now){
 if(!Object.hasOwn(routes,id))return null;
 const {kind,offset,stops}=routes[id];
 const legs=stops.map(([x,y],i)=>{
  const [nx,ny]=stops[(i+1)%stops.length],duration=(Math.abs(nx-x)+Math.abs(ny-y))*STEP_MS;
  return {x,y,nx,ny,duration};
 });
 const total=legs.reduce((n,leg)=>n+REST_MS+leg.duration,0);
 const cycle=Math.floor((now+offset)/total);
 let elapsed=(now+offset)%total;
 for(const [index,{x,y,nx,ny,duration}] of legs.entries()){
  if(elapsed<REST_MS)return {id,kind,x,y,resting:true,rest:cycle*legs.length+index,flipped:(nx-x)-(ny-y)<0};
  elapsed-=REST_MS;
  if(elapsed<duration){const t=elapsed/duration;return {id,kind,x:x+(nx-x)*t,y:y+(ny-y)*t,resting:false,flipped:(nx-x)-(ny-y)<0};}
  elapsed-=duration;
 }
 return null;
}
export const wildlifeAnimals=now=>Object.keys(routes).map(id=>wildAnimal(id,now));
export const nearWildAnimal=(position,animal)=>!!position&&!!animal&&Math.hypot(position.x-animal.x,position.y-animal.y)<=1.45;
export function normalizeTrust(input){
 const result={};
 for(const id of Object.keys(routes)){
  const entry=input?.[id];
  if(Number.isInteger(entry?.step)&&entry.step>0&&entry.step<wildlifeHabitats[routes[id].kind].steps.length){
   const lastRest=Number.isSafeInteger(entry.lastRest)&&entry.lastRest>=0?entry.lastRest:null;
   result[id]={step:entry.step,lastRest};
  }
 }
 return result;
}

export function normalizeForage(input){
 const result={};
 for(const kind of Object.keys(wildlifeHabitats)){
  const entry=input?.[kind];
  if(!entry)continue;
  const count=Number.isInteger(entry.count)?Math.max(0,Math.min(FORAGE_CAP,entry.count)):0;
  const readyAt=Number.isSafeInteger(entry.readyAt)&&entry.readyAt>=0?entry.readyAt:0;
  if(count||readyAt)result[kind]={count,readyAt};
 }
 return result;
}
export function bondStep(state,animal){
 const habitat=wildlifeHabitats[animal.kind];
 const trust=state.trust[animal.id]??{step:0,lastRest:null};
 return {habitat,trust,stage:habitat.steps[trust.step],waiting:trust.lastRest!==null&&!(animal.rest>trust.lastRest),food:state.forage[animal.kind]?.count??0};
}
