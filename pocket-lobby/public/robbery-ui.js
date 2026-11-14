import {pvpRooms} from './pvp.js';
import {foodItems} from './cooking.js';
import {fishProducts} from './fishing.js';
import {robberyRules,equipmentStats} from './robbery-rules.js';
export function initializeRobbery({doc=document,cloud,hooks}){
 const dialog=doc.createElement('dialog');dialog.id='robberyDialog';dialog.className='game-window robbery-window';dialog.setAttribute('aria-labelledby','robberyTitle');
 dialog.innerHTML=`<div class="modal-head"><span class="window-emblem" aria-hidden="true">✦</span><div><div class="eyebrow">NEARBY PLAYERS</div><h2 id="robberyTitle">Nearby players</h2></div><button class="close" type="button" aria-label="Close">×</button></div><p>Choose a player within one tile.</p><div id="robberyPlayers" class="robbery-players"></div><section class="robbery-detail"><h3>Send a gift</h3>
 <label>Item <select id="giftItem"></select></label>
 <label>Quantity <input id="giftQuantity" type="number" min="1" max="10" value="1"></label>
 <button id="giftSend" class="primary" type="button" disabled>Send gift</button>
 <p id="giftStatus" role="status"></p></section><section id="pvpPanel" class="robbery-detail" hidden><h3>Outdoor PvP</h3><p id="pvpScore"></p><button id="pvpToggle" type="button"></button> <button id="pvpStrike" type="button" class="primary">Attack · 1 AP</button><p id="pvpStatus" role="status"></p></section><details id="robberyDisclosure"><summary>Pickpocket</summary><section class="robbery-detail"><div class="eyebrow">PICKPOCKETING</div><h3 id="robberyTarget">Choose a player</h3><div class="robbery-metrics"><div><small>COST PER ATTEMPT</small><b>10 AP</b></div><div><small>SUCCESS CHANCE</small><b id="robberyChance">—</b></div></div><p id="robberyEquipment"></p><p id="robberyTerms">Your haul grows with Stealth, Luck and equipped bonuses, up to 25% of wallet gold. Banked gold and the first 50 wallet gold are safe. Success and failure both cost 10 AP. One attempt per minute; the target is protected for 10 minutes afterwards.</p><button id="robberySteal" type="button" class="primary" disabled>Attempt steal · 10 AP</button><p id="robberyResult" role="status" aria-live="polite"></p></section></details><button id="robberyRefresh" type="button">Refresh nearby players</button>`;
 doc.body.append(dialog);
 const $=id=>doc.getElementById(id);let selected=null,quote=null,busy=false,requestId=0;
 function giftOptions(){
  const peer=hooks.peers().find(p=>p.id===selected);
  const local=hooks.local(),close=peer&&!peer.auto&&Math.abs(peer.x-local.x)+Math.abs(peer.y-local.y)<=1;
  const select=$('giftItem'),old=select.value;
  select.replaceChildren();
  for(const [kind,items,stock] of [['fish',fishProducts,cloud.initial.fishStock],['meal',foodItems,cloud.initial.meals]]){
   for(const [id,item] of Object.entries(items)){
    const count=stock?.[id]??0;if(!count)continue;
    const option=doc.createElement('option');option.value=kind+':'+id;option.textContent=item.name+' × '+count;option.dataset.count=count;select.append(option);
   }
  }
  if([...select.options].some(o=>o.value===old))select.value=old;
  $('giftSend').textContent=peer?'Send gift to '+peer.name:'Send gift';
  $('giftSend').disabled=busy||!close||!select.value||!cloud.gift;
  $('giftQuantity').max=Math.min(10,Number(select.selectedOptions[0]?.dataset.count??1));
 }
 $('giftItem').onchange=()=>{$('giftQuantity').value='1';giftOptions();};
 $('giftSend').onclick=async()=>{
  if(busy||!selected||!$('giftQuantity').reportValidity())return;
  const [kind,item]=$('giftItem').value.split(':'),quantity=Number($('giftQuantity').value);
  busy=true;giftOptions();$('robberySteal').disabled=true;
  try{
   hooks.pause();
   const result=await cloud.gift({kind,item,quantity,target:selected});
   hooks.gift?.(result.state);
   const gift=result.gift;
   $('giftStatus').textContent='Sent '+gift.quantity+' × '+gift.label+' to '+gift.to+'.';
  }catch(error){$('giftStatus').textContent=error.message;}
  finally{busy=false;giftOptions();}
 };
 function list(){
  giftOptions();
  const peers=hooks.peers(),local=hooks.local();$('robberyPlayers').replaceChildren();
  if(!peers.length){const p=doc.createElement('p');p.textContent='No other players are visible here yet.';$('robberyPlayers').append(p);}
  for(const peer of peers){const button=doc.createElement('button'),distance=Math.abs(peer.x-local.x)+Math.abs(peer.y-local.y);button.type='button';button.textContent=peer.name+' · '+(distance<=robberyRules.reach?'Nearby':'Move closer');button.setAttribute('aria-pressed',String(peer.id===selected));button.onclick=()=>inspect(peer.id);$('robberyPlayers').append(button);}
  const gear=equipmentStats(cloud.initial.wardrobe);$('robberyEquipment').textContent=gear.items.length?'Equipped pickpocket bonuses: '+gear.items.map(i=>i.name+' ('+i.bonus+')').join(' · '):'Stealth and Luck improve your odds and the amount you can steal. Equip rogue clothing for Stealth or merchant clothing for Luck.';
 }
 async function inspect(id){
  if(busy)return;selected=id;renderPvp();quote=null;$('giftStatus').textContent='';const current=++requestId;list();const peer=hooks.peers().find(p=>p.id===id);$('robberyTarget').textContent=peer?.name??'Player left';$('robberyChance').textContent='—';$('robberySteal').disabled=true;$('robberyResult').textContent='';
  if(!$('robberyDisclosure').open)return;
  $('robberyResult').textContent='Checking proximity…';
  try{hooks.pause();const result=await cloud.robbery('preview',id);if(current!==requestId)return;quote=result.preview;$('robberyChance').textContent=quote.chance+'%';let reason='';
   if(quote.protectedUntil>Date.now())reason='This player is temporarily protected after a recent attempt.';
   else if(quote.cooldownUntil>Date.now())reason='Wait '+Math.ceil((quote.cooldownUntil-Date.now())/1000)+'s before your next attempt.';
   else if(!quote.gold)reason='This player has no unprotected wallet gold.';
   else if(!cloud.initial.actionPoints?.unlimited&&(cloud.initial.actionPoints?.value??0)<robberyRules.ap)reason='You need 10 AP. Use Questions on the hotbar to earn more.';
   $('robberySteal').disabled=!!reason;$('robberyResult').textContent=reason||'Success may take up to '+quote.gold+' gold. The target can notice your attempt.';
  }catch(error){if(current===requestId)$('robberyResult').textContent=error.message;}
 }
 $('robberySteal').onclick=async()=>{
  if(busy||!quote)return;busy=true;$('robberySteal').disabled=true;$('robberyResult').textContent='Reaching for a coin pouch…';
  try{const result=await cloud.robbery('steal',selected),r=result.receipt;quote=null;$('robberyResult').textContent=r.success?'Success! +'+r.gold+' gold · +'+r.xp+' Stealth XP · −10 AP.':'Spotted! Nothing stolen · +'+r.xp+' Stealth XP · −10 AP.';hooks.result(result.state,r);}
  catch(error){$('robberyResult').textContent=error.message;}
  finally{busy=false;giftOptions();}
 };
 $('robberyDisclosure').ontoggle=()=>{if($('robberyDisclosure').open&&selected)inspect(selected);};
 $('robberyRefresh').onclick=()=>{if(busy)return;list();if(selected)inspect(selected);};
 dialog.querySelector('.close').onclick=()=>{if(!busy)dialog.close();};dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 function renderPvp(){
  const state=cloud.initial,mode=state.pvp,peer=hooks.peers().find(p=>p.id===selected),local=hooks.local();
  $('pvpPanel').hidden=!pvpRooms.has(state.location);
  $('pvpScore').textContent=(mode?.kills??0)+' kills · '+(mode?.deaths??0)+' defeats · Both players must enable PvP.';
  $('pvpToggle').textContent=mode?.enabled?'Disable PvP':'Enable PvP';
  $('pvpToggle').disabled=busy;
  $('pvpStrike').disabled=busy||!mode?.enabled||!peer||Math.abs(peer.x-local.x)+Math.abs(peer.y-local.y)>1;
 }
 async function changePvp(body){
  if(busy)return;
  busy=true;renderPvp();
  try{
   hooks.pause();
   const response=await cloud.pvp(body),receipt=response.receipt;
   $('pvpStatus').textContent=receipt?(receipt.killed?'Defeated '+receipt.name:'Hit '+receipt.name+' for '+receipt.damage+' HP.'):response.state.pvp.enabled?'PvP enabled. Nearby players who have enabled it can attack you.':'PvP disabled.';
  }catch(error){$('pvpStatus').textContent=error.message;}
  finally{busy=false;renderPvp();}
 }
 $('pvpToggle').onclick=()=>changePvp({kind:'toggle',enabled:!cloud.initial.pvp?.enabled});
 $('pvpStrike').onclick=()=>changePvp({kind:'strike',target:selected});
 function open(id){if(busy)return;selected=id??null;$('pvpStatus').textContent='';renderPvp();quote=null;$('giftStatus').textContent='';list();$('robberyChance').textContent='—';$('robberyTarget').textContent='Choose a player';$('robberyResult').textContent='';$('robberySteal').disabled=true;if(!dialog.open){$('robberyDisclosure').open=false;dialog.showModal();}if(id)inspect(id);}
 $('nearbyPlayers').onclick=()=>open();
 return {open};
}
