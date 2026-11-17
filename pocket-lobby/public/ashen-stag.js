export const ashstepCloakId='ashstepCloak';
export const ashenStagRules={stopMs:240000,health:200,crashMs:3200,exposedBonus:.25,ashstepMs:2500,stepScale:.7,gold:45};
const sites=[
 {room:'brokenRoad',x:5,y:4,props:[[3,3],[9,3],[3,6],[8,7],[8,4,true],[10,4,true],[1,1],[10,8],[1,6],[6,5]]},
 {room:'emberwood',x:5,y:7,props:[[1,1],[3,2],[8,2],[10,1],[8,5],[4,6],[8,8],[3,7],[8,7,true],[10,6],[6,5]]}
];
export const ashenStagObstacles=room=>sites.find(site=>site.room===room)?.props??[];
export const ashenStagRoom=room=>sites.some(site=>site.room===room);
export function ashenStagSighting(now){
 const stop=Math.floor(now/ashenStagRules.stopMs),site=sites[stop%sites.length];
 return {...site,id:Math.floor(stop/sites.length),until:(stop+1)*ashenStagRules.stopMs};
}
export const ashenStagMoves={
 ashCharge:{id:'ashCharge',name:'Cinder Charge',shape:'lane',tell:1500,recovery:750,reach:7,width:.58,damage:4},
 ashSweep:{id:'ashSweep',name:'Antler Sweep',shape:'arc',tell:1050,recovery:650,reach:2.4,angle:1.12,damage:-1}
};
export function ashenChargePath(room,from,target){
 const props=sites.find(site=>site.room===room)?.props??[];
 const angle=Math.atan2(target.y-from.y,target.x-from.x);
 const dx=Math.cos(angle),dy=Math.sin(angle);
 let end={...from},reach=0;
 for(let step=1;step<=ashenStagMoves.ashCharge.reach*5;step++){
  const distance=step/5,x=Math.round(from.x+dx*distance),y=Math.round(from.y+dy*distance);
  if(x<1||x>10||y<1||y>8)break;
  const obstacle=props.find(([px,py])=>px===x&&py===y);
  if(obstacle)return {end,reach,crash:obstacle[2]?{x,y}:null};
  end={x,y};reach=distance;
 }
 return {end,reach,crash:null};
}
