import {environmentForRoom} from './world-environment-catalog.js';
import {worldNow} from './day-night.js';

// One wind for the whole world, read from the shared clock. It follows the weather's 20-minute day
// (dawn, clear, wind, rain, clear), so trees, reeds, flags, smoke and leaves lean and settle together.
const PHASE_MS=240000,levels=[.14,.14,1,.58,.14];
const smooth=x=>{const v=Math.max(0,Math.min(1,x));return v*v*(3-2*v);};

// strength: 0-1 for the current weather. gust: 0-1, slow swells that always blow the same way.
// lean: strength x gust, the amount anything should bend right now.
export function windPhase(now){
 const slot=Math.floor(now/PHASE_MS),index=((slot%levels.length)+levels.length)%levels.length,age=now-slot*PHASE_MS;
 const from=levels[(index+levels.length-1)%levels.length],strength=from+(levels[index]-from)*smooth(age/20000);
 const gust=.5+.32*Math.sin(now/2100)+.18*Math.sin(now/830+1.7);
 return {strength,gust,lean:strength*gust};
}
// Wind only reaches open-air maps; interiors, caves and the dungeon are still.
export function windFor(room,now=worldNow()){
 const environment=environmentForRoom(room);
 return environment&&(environment.dayNight||environment.theme==='ashen')?windPhase(now):null;
}
if(typeof window!=='undefined')window.towerWind={for:windFor,phase:windPhase};
