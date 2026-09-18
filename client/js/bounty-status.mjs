export function renderBountyStatus(element,bounty){
  if(!element)return;
  const wanted=!!(bounty&&bounty.karma<0);
  element.classList.toggle('hidden',!wanted);
  if(!wanted){element.textContent='';return;}
  const value=Math.max(1,bounty.value|0||Math.abs(bounty.karma|0));
  element.textContent='WANTED · '+value+' gold — Hunters can track you on the map';
}
