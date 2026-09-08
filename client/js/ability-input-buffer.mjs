export const ABILITY_BUFFER_MS=120;

// One deliberate press; newest wins. Never carry intent across UI or room changes.
export function createAbilityInputBuffer({now=()=>performance.now(),windowMs=ABILITY_BUFFER_MS}={}){
  let pending=null;
  return {
    clear(){pending=null;},
    queue(slot,remainingMs,context){
      pending=null;
      if(remainingMs<=0||remainingMs>windowMs)return false;
      pending={slot,context,expires:now()+windowMs};return true;
    },
    take(context,ready,allowed=true){
      if(!pending)return null;
      if(!allowed||pending.context!==context||now()>pending.expires){pending=null;return null;}
      if(!ready(pending.slot))return null;
      const slot=pending.slot;pending=null;return slot;
    },
  };
}
