// Revision and cumulative spend distinguish real costs from gains, stale replies
// and opening the game after offline play. There is no polling or reward logic.
export function createAPSpendTracker(initial){
 let key=initial?.characterKey,revision=initial?.revision??-1,spent=initial?.state?.actionPoints?.spent??0;
 return {update(packet){
  if(!packet?.state?.actionPoints||!Number.isInteger(packet.revision))return null;
  const next=packet.state.actionPoints.spent??0;
  if(packet.characterKey!==key){key=packet.characterKey;revision=packet.revision;spent=next;return {balance:packet.state.actionPoints.value,spent:0};}
  if(packet.revision<=revision)return null;
  const delta=Math.max(0,next-spent);
  revision=packet.revision;spent=next;
  return {balance:packet.state.actionPoints.value,spent:delta};
 }};
}
export function initializeActionPointFeedback({doc=document,initial,onEarn,setTimeoutImpl=setTimeout}){
 const tracker=createAPSpendTracker(initial),row=doc.getElementById('vitalactionPointsRow');
 const earn=doc.createElement('button');earn.id='earnActionPoints';earn.type='button';earn.className='ap-earn';earn.textContent='Answer questions · Earn AP';earn.onclick=onEarn;row.append(earn);
 const floats=doc.createElement('div');floats.className='ap-spend-floats';floats.setAttribute('aria-hidden','true');floats.setAttribute('popover','manual');doc.body.append(floats);
 const announcement=doc.createElement('span');announcement.className='ap-announcement';announcement.setAttribute('role','status');doc.body.append(announcement);
 const balance=value=>{
  earn.hidden=value>0;row.dataset.empty=String(value===0);row.dataset.low=String(value<=20);
  const meter=doc.getElementById('vitalactionPoints'),number=doc.getElementById('vitalactionPointsValue');
  meter.value=value;meter.setAttribute('aria-label','Action Points '+value+' of 100');number.textContent=value+' / 100';
 };balance(initial.state.actionPoints.value);
 const card=row.closest?.('.hud-character'),rail=card?.parentElement;
 if(card&&rail){
  const measure=()=>{const space=Math.ceil(card.getBoundingClientRect().height+12)+'px';rail.style.setProperty('padding-top',space);doc.documentElement?.style.setProperty('--ap-profile-clearance',space);};
  measure();if(globalThis.ResizeObserver)new ResizeObserver(measure).observe(card);
 }
 return {update(packet){
  const result=tracker.update(packet);if(!result)return;balance(result.balance);if(!result.spent)return;
  const anchor=doc.getElementById('vitalactionPoints').getBoundingClientRect(),node=doc.createElement('span');node.className='ap-spend-float';node.textContent='−'+result.spent+' AP';
  const width=globalThis.innerWidth??1280,left=width<=520?(anchor.left??anchor.right-120)-75:anchor.right+8;
  node.style.left=Math.max(8,Math.min(width-90,left))+'px';node.style.top=Math.max(8,anchor.top-8)+'px';
  floats.append(node);while(floats.children.length>4)floats.children[0].remove();
  floats.showPopover?.();
  announcement.textContent='Spent '+result.spent+' Action Point'+(result.spent===1?'':'s')+'. '+result.balance+' remaining.';
  setTimeoutImpl(()=>{node.remove();if(!floats.children.length)floats.hidePopover?.();},1500);
 }};
}
