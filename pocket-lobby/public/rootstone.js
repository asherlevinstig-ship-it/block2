export const rootstoneRunes=['moth','wave','root'];
export const rootstonePowers={
  rootbind:{name:'Rootbind'},
  deepRoots:{name:'Deep Roots'}
};
export const rootbindRules={window:600,duration:2000,cooldown:12000};
export const deepRootsInterval=45000;

export function normalizeRootstone(input){
  const awakened=input?.awakened===true;
  const power=awakened&&typeof input.power==='string'&&Object.hasOwn(rootstonePowers,input.power)?input.power:null;
  const nextCastAt=awakened&&Number.isSafeInteger(input?.nextCastAt)&&input.nextCastAt>0?input.nextCastAt:0;
  return {awakened,power,nextCastAt};
}

export function canAwakenRootstone(adventure,room,runes){
  return room==='ruins'&&adventure.shrine===true&&adventure.bridge===true&&
    runes.length===rootstoneRunes.length&&rootstoneRunes.every((rune,index)=>rune===runes[index]);
}

export function rootbindStatus(stone,encounter,now){
  if(stone.power!=='rootbind'||!encounter)return 'unavailable';
  if(now<stone.nextCastAt)return 'recovering';
  const untilCharge=encounter.nextBoarAt-now;
  return untilCharge>0&&untilCharge<=rootbindRules.window?'ready':'waiting';
}

export function castRootbind(stone,encounter,now){
  if(rootbindStatus(stone,encounter,now)!=='ready')return false;
  stone.nextCastAt=now+rootbindRules.cooldown;
  encounter.rootboundUntil=now+rootbindRules.duration;
  encounter.nextBoarAt=encounter.rootboundUntil+rootbindRules.window;
  return true;
}
