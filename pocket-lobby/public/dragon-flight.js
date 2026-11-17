export const dragonFlightRules={room:'willowbank',range:9,height:82,canopy:57};
const bankTile=tile=>Number.isInteger(tile?.x)&&Number.isInteger(tile?.y)&&tile.x>=0&&tile.x<14&&tile.y>=2&&tile.y<=13;

export function crossesWillowbankChannel(from,to){
 if(!bankTile(from)||!bankTile(to)||(from.y-5)*(to.y-5)>=0)return false;
 const across=from.x+(to.x-from.x)*(5-from.y)/(to.y-from.y);
 return across>=8.65&&across<=13.35&&Math.hypot(to.x-from.x,to.y-from.y)<=dragonFlightRules.range;
}
export const dragonFlightDuration=(from,to)=>3000+Math.round(Math.hypot(to.x-from.x,to.y-from.y)*150);

export function normalizeDragonFlight(flight){
 if(flight?.room!==dragonFlightRules.room||!crossesWillowbankChannel(flight.from,flight.to)||
   !Number.isSafeInteger(flight.startedAt)||flight.startedAt<0||
   flight.landAt!==flight.startedAt+dragonFlightDuration(flight.from,flight.to))return null;
 return {room:flight.room,from:{x:flight.from.x,y:flight.from.y},to:{x:flight.to.x,y:flight.to.y},startedAt:flight.startedAt,landAt:flight.landAt};
}

const clamp=value=>Math.max(0,Math.min(1,value));
const ease=value=>value*value*(3-2*value);
export function dragonFlightPose(flight,now){
 if(!flight)return null;
 const progress=clamp((now-flight.startedAt)/(flight.landAt-flight.startedAt));
 const travel=ease(clamp((progress-.08)/.86));
 const climb=ease(clamp((progress-.07)/.25));
 const descent=ease(clamp((1-progress)/.32));
 const dx=flight.to.x-flight.from.x,dy=flight.to.y-flight.from.y;
 const height=dragonFlightRules.height*climb*descent;
 return {x:flight.from.x+dx*travel,y:flight.from.y+dy*travel,height,progress,
   overCanopy:height>=dragonFlightRules.canopy,direction:dx-dy>=0?'right':'left',back:dx+dy<0,
   phase:progress<.32?'takeoff':progress<.68?'glide':progress<1?'landing':'landed'};
}
