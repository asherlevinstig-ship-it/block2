import {waystationSites} from './waystation.js';
const entrance=[0,6];
const fork=[4,6];
const counter=[7,4];
const bench=[6,7];
const shelter=[8,7];
const toCounter=[entrance,fork,[7,6],counter];
const toBench=[counter,[7,6],[6,6],bench];
const period=60000;

function walk(path,age,duration,reduced){
 const progress=Math.min(1,Math.max(0,age/duration))*(path.length-1);
 const index=Math.min(path.length-2,Math.floor(progress));
 const [x,y]=path[index], [tx,ty]=path[index+1];
 const part=reduced&&age<duration?0:progress-index;
 return {x:x+(tx-x)*part,y:y+(ty-y)*part,direction:tx-x>=ty-y?'right':'left',
  back:tx+ty<x+y,moving:!reduced&&age<duration};
}
const stand=([x,y])=>({x,y,direction:'right',moving:false});

export function waystationRoutines(now,weather,board,reduced=false){
 const age=((now%period)+period)%period;
 const fireReady=board?.fire>=waystationSites.fire.target;
 const counterReady=board?.supplies>=waystationSites.supplies.target;
 const porter={type:'waystationVisitor',id:'porter',name:'Supply porter',outfit:4};
 if(age<9000){
  Object.assign(porter,walk(toCounter,age,9000,reduced),{crate:true,activity:'Carrying supplies'});
 }else if(age<12000){
  Object.assign(porter,stand(counter),{activity:counterReady?'Unloading at the counter':'Leaving supplies for the builders'});
 }else if(age<18000){
  const path=weather.rain?[counter,[7,6],[8,6],shelter]:toBench;
  Object.assign(porter,walk(path,age-12000,6000,reduced),{activity:weather.rain?'Heading for shelter':'Heading to the fire'});
 }else if(age<41000){
  Object.assign(porter,stand(weather.rain?shelter:bench),{seated:!weather.rain&&fireReady,
   activity:weather.rain?'Sheltering':fireReady?'Resting by the fire':'Waiting for the hearth'});
 }else if(age<50000){
  const path=weather.rain?[shelter,[8,6],fork,entrance]:[bench,[6,6],fork,entrance];
  Object.assign(porter,walk(path,age-41000,9000,reduced),{activity:'Returning to Beaconwatch'});
 }
 const scout={type:'waystationVisitor',id:'scout',name:'Trail scout',outfit:3};
 if(weather.rain){
  Object.assign(scout,stand([7.75,6.85]),{activity:'Waiting out the rain'});
 }else if(age<6500){
  Object.assign(scout,walk([entrance,fork],age,6500,reduced),{activity:'Back from the trail'});
 }else if(age<28500){
  Object.assign(scout,stand(fork),{activity:'Ask about the trail'});
 }else if(age<35000){
  Object.assign(scout,walk([fork,entrance],age-28500,6500,reduced),{activity:'Heading to Beaconwatch'});
 }
 return {visitors:[porter,scout].filter(p=>p.activity),delivery:age>=9000,
  report:weather.rain?'Rain is sweeping the ridge. The marked road back to Beaconwatch is still open.'
   :fireReady?'I saw deer tracks on Willowbank’s inland trail. If you spot fresh prints, wait a moment and watch the trees.'
   :'I followed the marked road from Beaconwatch. Bring timber if you want a warm hearth on the way back.'};
}
