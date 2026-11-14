import {showBreakInRoom} from './break-in-view.js';
import {theftPowers} from './theft-abilities.js';
import {styleAbilities} from './style-abilities.js';
import {pvpRooms,bountyGold} from './pvp.js';
import {foodItems} from './cooking.js';
import {fishProducts} from './fishing.js';
import {robberyRules,equipmentStats} from './robbery-rules.js';
export function initializeRobbery({doc=document,cloud,hooks}){
 const dialog=doc.createElement('dialog');dialog.id='robberyDialog';dialog.className='game-window robbery-window';dialog.setAttribute('aria-labelledby','robberyTitle');
 dialog.innerHTML=`<div class="modal-head"><span class="window-emblem" aria-hidden="true">✦</span><div><div class="eyebrow">NEARBY PLAYERS</div><h2 id="robberyTitle">Nearby players</h2></div><button class="close" type="button" aria-label="Close">×</button></div><p id="robberyPrompt">Choose a player within one tile.</p><p id="breakInNotice" hidden></p><div id="robberyPlayers" class="robbery-players"></div><section id="giftPanel" class="robbery-detail"><h3>Send a gift</h3>
 <label>Item <select id="giftItem"></select></label>
 <label>Quantity <input id="giftQuantity" type="number" min="1" max="10" value="1"></label>
 <button id="giftSend" class="primary" type="button" disabled>Send gift</button>
 <p id="giftStatus" role="status"></p></section><section id="pvpPanel" class="robbery-detail" hidden><h3>Outdoor PvP</h3><p id="pvpScore"></p><button id="pvpStrike" type="button" class="primary">Attack · 1 AP</button><div id="pvpPowers" class="offer-actions"></div><p id="pvpPowerInfo"></p><button id="pvpFollow" type="button" hidden>Follow the trail</button><p id="pvpStatus" role="status"></p></section><section id="wantedPanel" class="robbery-detail"><h3>Most Wanted</h3><p>Defeat a wanted player for a ${bountyGold} gold bounty. Bounty kills carry no Evil penalty.</p><div id="pvpWitnesses"></div><button id="pvpWanted" type="button">View bounties</button><ul id="pvpWantedList" aria-live="polite"></ul></section><details id="robberyDisclosure"><summary>Pickpocket</summary><section class="robbery-detail"><div class="eyebrow">PICKPOCKETING</div><h3 id="robberyTarget">Choose a player</h3><div class="robbery-metrics"><div><small>COST PER ATTEMPT</small><b id="robberyCost">10 AP</b></div><div><small>SUCCESS CHANCE</small><b id="robberyChance">—</b></div></div><p id="robberyEquipment"></p><label for="robberyTechnique">Technique</label><select id="robberyTechnique"></select><p id="robberyPowerInfo"></p><p id="robberyTerms">Your haul grows with Stealth, Luck and equipped bonuses, up to 25% of wallet gold. Banked gold and the first 50 wallet gold are safe. Success and failure both cost 10 AP. One attempt per minute; the target is protected for 10 minutes afterwards.</p><button id="robberySteal" type="button" class="primary" disabled>Attempt steal · 10 AP</button><p id="robberyResult" role="status" aria-live="polite"></p></section></details><button id="robberyRefresh" type="button">Refresh nearby players</button>`;
 doc.body.append(dialog);
 const $=id=>doc.getElementById(id);let selected=null,quote=null,busy=false,requestId=0,theftOnly=false,breakingIn=false;
 function renderTechniques(){
  const select=$('robberyTechnique'),old=select.value;select.replaceChildren();
  select.hidden=breakingIn;
  $('robberyCost').textContent='10 AP';
  $('robberyTerms').hidden=breakingIn;
  $('robberyEquipment').hidden=breakingIn;
  doc.querySelector('label[for="robberyTechnique"]').hidden=breakingIn;
  if(breakingIn){
   $('robberyPowerInfo').textContent='10 AP · 5-minute cooldown · The homeowner receives a notice.';
   $('robberySteal').textContent='Attempt break-in · 10 AP';return;
  }
  for(const power of ['',...(cloud.initial.styleAbilities?.learned??[]).filter(id=>theftPowers.includes(id))]){
   const option=doc.createElement('option');option.value=power;option.textContent=power?styleAbilities[power].name:'Standard pickpocket';select.append(option);
  }
  if([...select.options].some(option=>option.value===old))select.value=old;
  select.disabled=busy;
  const power=select.value;$('robberyPowerInfo').textContent=power?styleAbilities[power].description:'A regular steal attempt using your Stealth, Luck and equipped bonuses.';
  $('robberySteal').textContent='Attempt '+(power?styleAbilities[power].name:'steal')+' · 10 AP';
 }
 $('robberyTechnique').onchange=()=>{renderTechniques();quote=null;$('robberySteal').disabled=true;if(selected)inspect(selected);};
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
  renderTechniques();giftOptions();
  const peers=hooks.peers(),local=hooks.local();$('robberyPlayers').replaceChildren();
  if(!peers.length){const p=doc.createElement('p');p.textContent='No other players are visible here yet.';$('robberyPlayers').append(p);}
  for(const peer of peers){const button=doc.createElement('button'),distance=Math.abs(peer.x-local.x)+Math.abs(peer.y-local.y);button.type='button';button.textContent=(peer.wanted?'☠ ':'')+peer.name+' · '+(distance<=robberyRules.reach?'Nearby':'Move closer');button.setAttribute('aria-pressed',String(peer.id===selected));button.onclick=()=>inspect(peer.id);$('robberyPlayers').append(button);}
  const gear=equipmentStats(cloud.initial.wardrobe);$('robberyEquipment').textContent=gear.items.length?'Equipped pickpocket bonuses: '+gear.items.map(i=>i.name+' ('+i.bonus+')').join(' · '):'Stealth and Luck improve your odds and the amount you can steal. Equip rogue clothing for Stealth or merchant clothing for Luck.';
 }
 async function inspect(id){
  if(busy)return;selected=id;renderPvp();quote=null;$('giftStatus').textContent='';const current=++requestId;list();const peer=hooks.peers().find(p=>p.id===id);$('robberyTarget').textContent=peer?.name??'Player left';$('robberyChance').textContent='—';$('robberySteal').disabled=true;$('robberyResult').textContent='';
  if(!$('robberyDisclosure').open)return;
  $('robberyResult').textContent='Checking proximity…';
  try{hooks.pause();const result=await cloud.robbery(breakingIn?'breakInPreview':'preview',id,$('robberyTechnique').value||null);if(current!==requestId)return;quote=result.preview;$('robberyChance').textContent=quote.chance+'%';let reason='';
   if(quote.protectedUntil>Date.now())reason='This player is temporarily protected after a recent attempt.';
   else if(quote.cooldownUntil>Date.now())reason='Wait '+Math.ceil((quote.cooldownUntil-Date.now())/1000)+'s before your next attempt.';
   else if(quote.powerCooldownUntil>Date.now())reason='This technique recharges in '+Math.ceil((quote.powerCooldownUntil-Date.now())/1000)+'s. Choose Standard pickpocket or wait.';
   else if(!breakingIn&&!quote.gold)reason='This player has no unprotected wallet gold.';
   else if(!cloud.initial.actionPoints?.unlimited&&(cloud.initial.actionPoints?.value??0)<quote.ap)reason='You need '+quote.ap+' AP. Use Questions on the hotbar to earn more.';
   $('robberySteal').disabled=!!reason;$('robberyResult').textContent=reason||(breakingIn?'On success, enter this player’s room.':'On success: '+quote.gold+' gold'+(quote.power==='cutpurse'?' · '+(quote.gold-quote.baseGold)+' bonus gold included':quote.power==='lightFingers'?' · +'+(quote.chance-quote.baseChance)+' success percentage points':'')+'. The target can notice your attempt.');
  }catch(error){if(current===requestId)$('robberyResult').textContent=error.message;}
 }
 $('robberySteal').onclick=async()=>{
  if(busy||!quote)return;busy=true;renderTechniques();$('robberySteal').disabled=true;$('robberyResult').textContent='Reaching for a coin pouch…';
  try{const result=await cloud.robbery(breakingIn?'breakIn':'steal',selected,quote.power??null),r=result.receipt;quote=null;
   if(r.breakIn){
    hooks.result(result.state,r);
    $('robberyResult').textContent=r.success?'You got inside.':'The lock held. The homeowner was notified.';
    if(r.visit){dialog.close();showBreakInRoom(doc,r.visit);}
    return;
   }
   $('robberyResult').textContent=r.success?(r.power?styleAbilities[r.power].name+' · ':'')+'Success! +'+r.gold+' gold'+(r.bonusGold?' ('+r.bonusGold+' bonus included)':'')+' · +'+r.xp+' Stealth XP · −10 AP.':'Spotted! Nothing stolen · +'+r.xp+' Stealth XP · −10 AP.';hooks.result(result.state,r);}
  catch(error){$('robberyResult').textContent=error.message;}
  finally{busy=false;renderTechniques();giftOptions();}
 };
 $('robberyDisclosure').ontoggle=()=>{if($('robberyDisclosure').open&&selected)inspect(selected);};
 $('robberyRefresh').onclick=()=>{if(busy)return;list();renderPvp();if(selected)inspect(selected);};
 dialog.querySelector('.close').onclick=()=>{if(!busy)dialog.close();};dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 const witnessed=new Map();
 let pvpRefreshTimer=0;
 dialog.addEventListener('close',()=>clearTimeout(pvpRefreshTimer));
 function renderWitnesses(){
  $('pvpWitnesses').replaceChildren();
  for(const [id,incident] of witnessed){
   if(incident.until<=Date.now()){witnessed.delete(id);continue;}
   const button=doc.createElement('button');button.type='button';button.textContent='Report '+incident.name;
   button.onclick=async()=>{
    button.disabled=true;
    try{const result=await cloud.pvp({kind:'report',incident:id});witnessed.delete(id);renderWitnesses();await showWanted();$('pvpStatus').textContent='Reported '+result.reported+'.';}
    catch(error){button.disabled=false;button.textContent=error.message;}
   };
   $('pvpWitnesses').append(button);
  }
 }
 async function showWanted(){
  const list=$('pvpWantedList');list.replaceChildren();
  try{
   const {wanted}=await cloud.mostWanted();
   for(const name of wanted.length?wanted.map(entry=>'☠ '+entry.name+' · '+bountyGold+' gold'):['No active bounties.']){
    const entry=doc.createElement('li');entry.textContent=name;list.append(entry);
   }
  }catch(error){const entry=doc.createElement('li');entry.textContent=error.message;list.append(entry);}
 }
 $('pvpWanted').onclick=showWanted;
 function renderPvp(){
  clearTimeout(pvpRefreshTimer);
  const state=cloud.initial,mode=state.pvp,peer=hooks.peers().find(p=>p.id===selected),local=hooks.local();
  $('pvpPanel').hidden=theftOnly||!pvpRooms.has(state.location);
  $('pvpScore').textContent=(mode?.kills??0)+' kills · '+(mode?.deaths??0)+' defeats · Evil '+(state.stats.evil??0)+(mode?.wantedAt?' · ☠ Wanted':'')+' · '+(mode?.unprovokedKills??0)+' unprovoked · '+(mode?.defensiveKills??0)+' self-defence · '+(mode?.bountyKills??0)+' bounty kills. Only unprovoked kills add Evil.';
  const outOfReach=!peer||peer.auto||Math.abs(peer.x-local.x)+Math.abs(peer.y-local.y)>1;
  $('pvpStrike').disabled=busy||outOfReach;
  const timers=Object.values(state.styleAbilities?.readyAt??{}).filter(at=>at>Date.now());
  if(state.styleAbilities?.pursuit?.until>Date.now())timers.push(state.styleAbilities.pursuit.until);
  if(timers.length)pvpRefreshTimer=setTimeout(()=>{if(dialog.open&&!busy)renderPvp();},Math.min(...timers)-Date.now()+50);
  $('pvpPowers').replaceChildren();
  for(const power of (state.styleAbilities?.learned??[]).filter(id=>['deathmark','siphon','shadowPursuit'].includes(id))){
   const definition=styleAbilities[power],seconds=Math.max(0,Math.ceil(((state.styleAbilities.readyAt[power]??0)-Date.now())/1000));
   const button=doc.createElement('button');button.type='button';button.textContent=definition.name+' · '+(seconds?seconds+'s':'1 AP');button.title=definition.description;
   button.disabled=busy||seconds>0||(power==='shadowPursuit'?(mode?.lastOpponent?.until??0)<=Date.now():outOfReach);
   button.onclick=()=>changePvp({kind:'strike',power,target:selected});$('pvpPowers').append(button);
  }
  const trail=state.styleAbilities?.pursuit;
  $('pvpFollow').hidden=!(trail?.until>Date.now());
  $('pvpFollow').onclick=async()=>{
   if(busy)return;
   busy=true;
   try{
    const result=await cloud.pvp({kind:'strike',power:'shadowPursuit',refresh:true});
    const latest=result.receipt.trail;
    dialog.close();hooks.pursue?.(latest.room,latest.name);
   }catch(error){$('pvpStatus').textContent=error.message;}
   finally{busy=false;renderPvp();}
  };
 }
 async function changePvp(body){
  if(busy)return;
  busy=true;renderPvp();
  try{
   hooks.pause();
   const response=await cloud.pvp(body),receipt=response.receipt;
   if(!receipt)return;
   const reward=receipt.reward?.kind==='item'?receipt.reward.name:receipt.reward?.amount?'+'+receipt.reward.amount+' gold':'Wallet full';
   hooks.pvpState?.(response.state,receipt);
   $('pvpStatus').textContent=receipt.trail?'Trail found for '+receipt.name+' · Follow the marked route.':receipt.killed?'Defeated '+receipt.name+' · '+reward+(receipt.bounty?' · +'+(receipt.reward.bounty??0)+' bounty gold':receipt.classification==='self-defence'?' · Self-defence · No Evil':' · +1 Evil')+(receipt.stealth?' · +1 Stealth XP':''):'Hit '+receipt.name+' for '+receipt.damage+' HP.'+(receipt.healed?' Restored '+receipt.healed+' HP.':'');
   if(receipt.killed)hooks.pvpReward?.(response.state,receipt.reward);
  }catch(error){$('pvpStatus').textContent=error.message;}
  finally{busy=false;renderPvp();}
 }
 $('pvpStrike').onclick=()=>changePvp({kind:'strike',target:selected});
 function open(id,{theft=false,breakIn=false}={}){if(busy)return;theftOnly=theft;breakingIn=breakIn;
 const notice=cloud.initial.robbery?.lastBreakIn;
 $('breakInNotice').hidden=!notice?.breakIn;
 $('breakInNotice').textContent=notice?.breakIn?notice.name+(notice.success?' broke into your room.':' tried to break into your room.'):'';
 $('robberyPrompt').textContent=breakingIn?'Choose a nearby player in the Grand Lobby.':'Choose a player within one tile.';
$('giftPanel').hidden=theft;$('wantedPanel').hidden=theft;$('robberyTitle').textContent=breakingIn?'Lockbreaker':theft?'Pickpocket':'Nearby players';selected=id??null;requestId++;$('pvpPowerInfo').textContent='';renderWitnesses();$('pvpStatus').textContent='';renderPvp();quote=null;$('giftStatus').textContent='';list();$('robberyChance').textContent='—';$('robberyTarget').textContent='Choose a player';$('robberyResult').textContent='';$('robberySteal').disabled=true;if(!dialog.open){$('robberyDisclosure').open=theft;dialog.showModal();}if(id)inspect(id);}
 $('nearbyPlayers').onclick=()=>open();
 return {open,openPower(power){if(power==='lockbreaker'){open(null,{theft:true,breakIn:true});}else if(theftPowers.includes(power)){open(null,{theft:true});$('robberyTechnique').value=power;renderTechniques();}else{open();$('pvpPowerInfo').textContent=styleAbilities[power]?.description??'';}},witness(incident){if(incident?.id){witnessed.set(incident.id,incident);renderWitnesses();}}};
}
