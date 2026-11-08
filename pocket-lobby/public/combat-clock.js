// Keep combat presentation on the server clock even when the device clock is skewed.
export function createCombatClock({wallNow=()=>Date.now(),monotonicNow=()=>performance.now()}={}){
 let anchor=null;
 return {
  sample(serverTime,sentAt){
   if(!Number.isFinite(serverTime)||serverTime<0)return;
   const received=monotonicNow(),roundTrip=Math.max(0,received-sentAt);
   anchor={server:serverTime+Math.min(150,roundTrip/2),local:received};
  },
  now(){return anchor?anchor.server+Math.max(0,monotonicNow()-anchor.local):wallNow();}
 };
}
