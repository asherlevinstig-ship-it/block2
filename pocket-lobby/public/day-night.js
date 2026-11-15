import {environmentForRoom} from './world-environment-catalog.js';

// One game day lasts 20 minutes on the shared server clock, the same day the outdoor weather uses:
// dawn opens the day, the afternoon ends in a golden dusk, and night fills the last third.
export const DAY_MS=1200000;
const smooth=x=>{const v=Math.max(0,Math.min(1,x));return v*v*(3-2*v);};

// t: position in the day (0-1). light: 0 at night, 1 at midday. warm: 1 at the peak of dawn and dusk.
export function dayPhase(now){
 const t=((now%DAY_MS)+DAY_MS)%DAY_MS/DAY_MS;
 const light=t<.08?.55+.45*smooth(t/.08):t<.5?1:t<.58?1-.45*smooth((t-.5)/.08):t<.66?.55*(1-smooth((t-.58)/.08)):t<.94?0:.55*smooth((t-.94)/.06);
 const near=centre=>{const gap=Math.abs(t-centre);return 1-smooth(Math.min(gap,1-gap)/.09);};
 const warm=Math.max(near(0),near(.58));
 const name=warm>.45?(t>.3&&t<.8?'Dusk':'Dawn'):light>.5?'Day':'Night';
 return {t,light,warm,name};
}

let offset=0;
// The game passes its server-synchronised clock so every player sees the same sky.
export function syncDayClock(now){if(Number.isFinite(now))offset=now-Date.now();}
// Only open-air maps follow the cycle; interiors, caves, the dungeon and the Ashen March keep their own light.
export function dayNightFor(room,now=Date.now()+offset){
 return environmentForRoom(room)?.dayNight?dayPhase(now):null;
}
if(typeof window!=='undefined')window.towerDayNight={for:dayNightFor,sync:syncDayClock,phase:dayPhase};
