export const millRaidRules={cycle:20*60000,warning:90000,duration:8*60000,reward:75};
export const bridgeBarricade={x:9,y:6,max:72,repair:30,hit:24,firstHit:6000,interval:8000,tell:2500,flanker:'bridge-flanker'};
export function millRaidClock(now){
 const id=Math.floor(now/millRaidRules.cycle),start=id*millRaidRules.cycle,opens=start+millRaidRules.warning,ends=opens+millRaidRules.duration;
 return {id,start,opens,ends,next:start+millRaidRules.cycle,phase:now<opens?'warning':now<ends?'battle':'quiet'};
}
export const millRaidWaves=[
 [{kind:'skitter',name:'Reed Skitter',x:5,y:3,hp:42},{kind:'skitter',name:'Reed Skitter',x:6,y:5,hp:42}],
 [{kind:'warden',name:'Millbreaker',x:5,y:3,hp:72},{kind:'skitter',name:'Reed Skitter',x:6,y:5,hp:48}],
 [{kind:'chief',name:'The Reed Tyrant',x:6,y:3,hp:160},{kind:'skitter',name:'Reed Skitter',x:5,y:5,hp:48}]
];
export function raidWave(index,count,at){
 const scale=1+Math.min(7,Math.max(0,count-1))*.45;
 return millRaidWaves[index].map((mob,i)=>({...mob,id:index+'-'+i,max:Math.ceil(mob.hp*scale),hp:Math.ceil(mob.hp*scale),hitAt:0,at}));
}
export function raidThreat(opens,now,wave=0){
 const beat=Math.max(0,Math.floor((now-opens)/4000)),lands=opens+(beat+1)*4000;
 return {beat,lands,warning:now>=lands-1600,x:4+beat%4,y:wave===2?3+beat%3:null,damage:wave===2?18:wave===1?14:10};
}
export const raidDanger=(position,threat)=>
 (position.x===threat.x&&position.y>=2&&position.y<=6)||
 (position.y===threat.y&&position.x>=3&&position.x<=7);
export const bridgeDanger=position=>position.y===bridgeBarricade.y&&position.x>=8&&position.x<=11;
export const besideBarricade=position=>!!position&&Math.abs(position.x-bridgeBarricade.x)+Math.abs(position.y-bridgeBarricade.y)===1;
