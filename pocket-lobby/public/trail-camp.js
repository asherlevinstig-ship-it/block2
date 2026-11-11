export const trailCamp={room:'ruins',x:3,y:7,fuelCost:2,burnMs:180000,maxMs:540000,emberMs:45000,restMs:12000};
export const besideTrailCamp=position=>!!position&&Math.abs(position.x-trailCamp.x)+Math.abs(position.y-trailCamp.y)===1;
export function trailCampPhase(litUntil,now){
  const remaining=litUntil-now;
  return remaining<=0?'cold':remaining<=trailCamp.emberMs?'embers':'burning';
}
