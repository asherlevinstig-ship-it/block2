import {shopItemArt} from './shop-ui.js';
import {chestEquipmentComparison} from './dungeon-chests.js';
import {huntEnemies} from './hunting.js';
import {stoneForms} from './essences.js';
const materialNames={boar:'Boar Meat',stonebackShell:'Shell Fragment',moonwellShard:'Moonwell Shard'};
let active=null;
export function openDungeonChest({receipt,getState,change,onClose=()=>{},reopen=false}){
 if(active?.open){active.focus();return;}
 const doc=document,dialog=doc.createElement('dialog');active=dialog;
 dialog.className='reward-chest-window';dialog.setAttribute('aria-labelledby','rewardChestTitle');
 const make=(tag,cls,text)=>{const el=doc.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
 let busy=false,selected=receipt.items[0]??null;
 const header=make('header','reward-chest-header'),titles=make('div');
 titles.append(make('p','reward-eyebrow',reopen?'EXPEDITION REWARDS':'VICTORY · TREASURE DISCOVERED'),make('h2','',reopen?'Your victory spoils':'The seal is broken'));titles.lastChild.id='rewardChestTitle';
 titles.append(make('p','reward-subtitle',(huntEnemies[receipt.enemy]?.name??'Guardian')+' defeated'));
 const close=make('button','reward-close','×');close.type='button';close.setAttribute('aria-label','Close rewards');header.append(titles,close);dialog.append(header);
 const body=make('div','reward-chest-body'),spot=make('section','reward-spotlight'),haul=make('section','reward-haul');body.append(spot,haul);dialog.append(body);
 haul.append(make('h3','','Your haul'));
 const loot=make('ul','reward-loot-list');haul.append(loot);
 const row=(icon,title,detail)=>{const li=make('li'),symbol=make('span','reward-loot-symbol',icon),text=make('div');text.append(make('strong','',title),make('small','',detail));li.append(symbol,text);loot.append(li);};
 if(receipt.gold)row('◉','+'+receipt.gold+' gold','In your expedition haul');
 for(const [id,n] of Object.entries(receipt.loot))if(n)row('◈',n+' × '+(materialNames[id]??id),'In your expedition haul');
 for(const [id,n] of Object.entries(receipt.stones))if(n)row('◆',n+' × '+stoneForms[id].name+' Awakening Stone','Saved in your inventory');
 const itemButtons=make('div','reward-item-choices');haul.append(itemButtons);
 for(const id of receipt.items){const p=chestEquipmentComparison(getState(),id),b=make('button','reward-item-choice');b.type='button';const icon=make('span','reward-item-icon');icon.innerHTML=shopItemArt(id);b.append(icon,make('span','',p.name));b.onclick=()=>{selected=id;render();};b.dataset.item=id;itemButtons.append(b);}
 if(!receipt.gold&&!Object.values(receipt.loot).some(Boolean)&&!Object.values(receipt.stones).some(Boolean)&&!receipt.items.length)row('✦','Combat experience earned','Your skills and mastery have grown.');
 const warning=make('p','reward-bank-warning','Gold and materials are unbanked. Leave the dungeon safely to keep them. Equipment and stones are already saved.');haul.append(warning);
 const error=make('p','reward-error');error.setAttribute('role','status');dialog.append(error);
 const footer=make('footer','reward-chest-footer'),keep=make('button','reward-continue','Keep exploring');keep.type='button';footer.append(make('span','reward-saved','✓ Rewards saved'),keep);dialog.append(footer);
 function finish(){dialog.close();dialog.remove();if(active===dialog)active=null;onClose();}
 close.onclick=finish;keep.onclick=finish;dialog.addEventListener('cancel',e=>{e.preventDefault();finish();});
 function render(){
  spot.replaceChildren();dialog.dataset.rare=String(!!selected);
  for(const b of itemButtons.children){b.setAttribute('aria-pressed',String(b.dataset.item===selected));}
  const p=selected?chestEquipmentComparison(getState(),selected):null;
  const art=make('div','reward-hero-art');art.setAttribute('aria-hidden','true');
  if(p)art.innerHTML=shopItemArt(selected);else art.innerHTML='<svg viewBox="0 0 120 100"><path d="M18 45 60 25 102 45 60 66Z" fill="#e9c57c"/><path d="M18 45v30l42 21V66Z" fill="#835b3c"/><path d="M60 66v30l42-21V45Z" fill="#ad7c49"/><path d="m18 45 4-24L60 4l38 17 4 24-42-20Z" fill="#b68750" stroke="#f5d695" stroke-width="3"/><path d="m51 62 9 4 9-4v14l-9 5-9-5Z" fill="#ffe2a3"/></svg>';
  spot.append(make('span','reward-rarity',p?'RARE EQUIPMENT':'EXPEDITION SPOILS'),art,make('h3','',p?.name??'A hard-earned victory'));
  if(!p){spot.append(make('p','reward-description','Your treasure is ready for the journey home. Keep exploring for more, or leave safely to bank your haul.'));return;}
  spot.append(make('p','reward-description',p.description),make('p','reward-tradeoff',p.tradeoff),make('p','reward-current','Currently equipped: '+p.current));
  if(p.metrics.length){
   const table=make('table','reward-comparison'),caption=make('caption','','Compared with your current weapon');table.append(caption);const tr=make('tr');for(const value of ['','Current','Found'])tr.append(make('th','',value));table.append(tr);
   for(const [label,old,n,lower,suffix=''] of p.metrics){const tr=make('tr'),value=make('td','',n+' '+suffix);value.dataset.change=n===old?'same':(lower?n<old:n>old)?'better':'worse';tr.append(make('th','',label),make('td','',old+' '+suffix),value);table.append(tr);}spot.append(table);
  }else spot.append(make('p','reward-role-note','A different build option. Compare its perk and trade-off before replacing your current clothing.'));
  spot.append(make('p','reward-requirements',p.requirements));
  const equip=make('button','reward-equip',p.equipped?'✓ Equipped':!p.canEquip?'Requirements not met':'Equip '+p.name);equip.type='button';equip.disabled=busy||p.equipped||!p.canEquip;
  equip.onclick=async()=>{if(busy)return;busy=true;error.textContent='';render();try{await change('dungeonChestEquip',{chest:receipt.id,id:selected});}catch(e){error.textContent=e.message;}finally{busy=false;if(dialog.open)render();}};spot.append(equip);
 }
 render();doc.body.append(dialog);dialog.showModal();dialog.scrollTop=0;
 if(!reopen)dialog.classList.add('is-revealing');
 return dialog;
}
