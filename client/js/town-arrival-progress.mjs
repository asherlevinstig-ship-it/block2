const KEY_PREFIX='bc_town_arrival_v2:';
const STAGES=new Set(['fountain','portal','done']);

export function createTownArrivalProgress({accountId,level,storage}){
  let loadedKey=null;
  let savedStage='';

  function currentKey(){
    const id=String(accountId()||'').trim();
    return id?KEY_PREFIX+encodeURIComponent(id):'';
  }

  function stage(){
    const key=currentKey();
    if(key!==loadedKey){
      loadedKey=key;
      savedStage='';
      if(key){
        try{savedStage=String(storage().getItem(key)||'');}catch(e){}
      }
      if(savedStage==='tamsin')savedStage='portal';
    }
    return STAGES.has(savedStage)?savedStage:Number(level())>1?'done':'fountain';
  }

  function set(nextStage){
    if(!STAGES.has(nextStage))return stage();
    const key=currentKey();
    loadedKey=key;
    savedStage=nextStage;
    if(key){try{storage().setItem(key,nextStage);}catch(e){}}
    return nextStage;
  }

  return Object.freeze({stage,set});
}
