export function craftFailureText(m={}){
  const reasons={rate:'Too many crafting requests. Wait a moment and try again.',busy:'Another craft is still being processed.',recipe:'That arrangement does not match a recipe.',payload:'The crafting grid could not be read. Clear it and choose a recipe again.',ingredients:'You no longer have enough ingredients. Check your inventory.',full:'Your bag cannot hold the crafted items. Free some space first.',profile:'Your inventory is not ready. Wait for the connection to finish.',server:'Crafting could not be confirmed. Reconnect to refresh your inventory.'};
  return m.reason==='hunter_level'?'Reach Hunter Level '+Math.max(1,m.level|0)+' for that recipe.':reasons[m.reason]||'Crafting could not be completed. Check your connection and inventory.';
}

export function createCraftRequests({room,notify,setTimer=setTimeout,clearTimer=clearTimeout,newId=()=>crypto.randomUUID()}){
  let pending=null,timer=0;
  const clear=()=>{if(timer)clearTimer(timer);timer=0;const old=pending;pending=null;return old;};
  function current(){if(pending&&pending.room!==room())clear();return pending;}
  function transmit(){
    if(!current())return;
    try{pending.room.send('craft',pending.payload);}catch(_){notify('Craft connection interrupted. Waiting to confirm the result.');}
    timer=setTimer(()=>{timer=0;if(!current())return;notify('Craft confirmation delayed. Retrying the same request safely…');transmit();},8000);
  }
  return {
    start(payload,grid){
      if(current()){notify('Crafting is still in progress.');return false;}
      const connection=room();if(!connection){notify('Crafting requires a server connection.');return false;}
      pending={room:connection,payload:{...payload,requestId:newId()},grid};
      notify('CRAFTING…');transmit();return true;
    },
    settle(message){const p=current();if(!p||message?.requestId!==p.payload.requestId)return null;return clear();},
    get pending(){return !!current();},
  };
}
