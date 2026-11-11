import {pickaxes,pickaxeArt,miningLevel,equippedPickaxe} from './mining.js';
import {barProducts,forgeCraftReason,barArt} from './forge.js';

export function initializeQuarryForge(api,doc=document){
 const css=doc.createElement('link');css.rel='stylesheet';css.href='forge.css';doc.head.append(css);
 const dialog=doc.createElement('dialog');dialog.className='game-window quarry-forge-window';dialog.setAttribute('aria-labelledby','quarryForgeTitle');
 dialog.innerHTML=`
  <div class="modal-head"><span class="window-emblem" aria-hidden="true">♨</span><div><div class="eyebrow">COPPERVEIN QUARRY</div><h2 id="quarryForgeTitle">The quarry forge</h2></div><button type="button" class="close" aria-label="Close forge">×</button></div>
  <p class="forge-stock" data-forge="stock"></p>
  <p class="forge-status" data-forge="status" role="status"></p>
  <div class="forge-columns"><section aria-label="Smelt bars"><h3>Smelt bars</h3><p>Three ore makes one bar.</p><div data-forge="bars"></div></section>
  <section aria-label="Craft pickaxes"><h3>Craft pickaxes</h3><p>Craft an upgrade and equip it immediately.</p><div data-forge="picks"></div></section></div>`;
 doc.body.append(dialog);
 const by=name=>dialog.querySelector('[data-forge="'+name+'"]');
 const node=(tag,text,className='')=>{const element=doc.createElement(tag);element.textContent=text;if(className)element.className=className;return element;};
 let busy=false;
 dialog.querySelector('.close').onclick=()=>dialog.close();
 function render(){
  const state=api.state(),level=miningLevel(state.mining),stock=state.huntingLoot;
  by('stock').textContent='Mining '+level+' · '+state.woodcutting.timber+' timber · Equipped '+equippedPickaxe(state.mining).name;
  by('bars').replaceChildren();by('picks').replaceChildren();
  for(const [id,bar] of Object.entries(barProducts)){
   const card=doc.createElement('article');card.className='forge-recipe';
   const art=doc.createElement('div');art.className='forge-art';art.innerHTML=barArt(id);card.append(art);
   const owned=stock[id]??0,ore=stock[bar.ore]??0,maximum=Math.min(Math.floor(ore/bar.amount),1000000-owned);
   card.append(node('h4',bar.name),node('p',ore+' '+bar.oreName+' · '+owned+' bars in bag'));
   const form=doc.createElement('form');form.className='forge-smelt';
   const label=node('label','Bars to smelt'),input=doc.createElement('input');
   input.type='number';input.min='1';input.max=String(Math.max(1,maximum));input.value='1';input.required=true;input.disabled=busy;
   label.append(input);
   const button=node('button','Smelt');button.type='submit';
   const hint=node('small','');
   const quote=()=>{
    const valid=input.validity.valid,quantity=input.valueAsNumber;
    button.textContent=valid?'Smelt '+quantity+' '+(quantity===1?'bar':'bars'):'Smelt bars';
    hint.textContent=level<bar.level?'Needs Mining '+bar.level:maximum<1?'Bring '+bar.amount+' '+bar.oreName+' and space for a bar.':valid?'Uses '+quantity*bar.amount+' '+bar.oreName:'Choose a quantity within your ore supply.';
    button.disabled=busy||level<bar.level||maximum<1||!valid||!api.ready();
   };
   input.oninput=quote;quote();
   form.append(label,button);
   form.onsubmit=event=>{event.preventDefault();if(!button.disabled)change('mineSmelt',{id,quantity:input.valueAsNumber},bar.name);};
   card.append(form,hint);by('bars').append(card);
  }
  for(const id of ['copper','iron']){
   const pick=pickaxes[id],card=doc.createElement('article');card.className='forge-recipe forge-pick';
   const art=doc.createElement('div');art.className='forge-art';art.innerHTML=pickaxeArt(id);
   const reason=forgeCraftReason(state,id);
   card.append(art,node('h4',pick.name),node('p',pick.bars+' '+barProducts[pick.bar].name+' + '+pick.timber+' timber'),
    node('b',pick.duration/1000+'s per swing · Mining '+pick.level),node('small',reason||'Ready to craft'));
   const button=node('button',state.mining.upgrades.includes(id)?'Already crafted':'Craft & equip');button.type='button';
   button.disabled=busy||!!reason||!api.ready();button.onclick=()=>change('mineCraft',{id},pick.name);
   card.append(button);by('picks').append(card);
  }
 }
 async function change(action,body,name){
  if(busy||!api.ready())return;
  busy=true;by('status').textContent='Working at the forge…';render();
  try{
   await api.change(action,body);
   const message=action==='mineSmelt'?'Smelted '+body.quantity+' '+name+'.':name+' crafted and equipped.';
   by('status').textContent=message;api.feedback(message);
  }catch(error){by('status').textContent=error.message;}
  finally{busy=false;render();}
 }
 return {open(){
  if(!api.ready())return;
  by('status').textContent='';render();
  if(!dialog.open)dialog.showModal();
 },close:()=>dialog.close()};
}
