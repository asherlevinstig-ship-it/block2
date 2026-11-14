import {equipmentPerks} from './equipment-effects.js';
export {equipmentPerks} from './equipment-effects.js';
import {rareHunts,ownsRareItem} from './rare-loot.js';
import {mealRecipes} from './cooking.js';
import {fishProducts} from './fishing.js';
import {oreProducts,miningFinds} from './mining.js';
const plan=s=>s?.plan?.source==='rules'?s.plan:s?.report?.source==='rules'?s.report:null;
const sum=o=>Object.values(o??{}).reduce((a,b)=>a+b,0);
export function worldActivityEvents(before,after,now=Date.now()){
 if(!before||!after)return [];
 const events=[],room=after.location,p=plan(after),b=plan(before),same=p&&b&&(p.routineId??p.startedAt)===(b.routineId??b.startedAt);
 const add=(id,kind,label,amount=0,at=now,eventRoom=room)=>{if(now-at>=0&&now-at<5000)events.push({id,kind,label,amount,at,room:eventRoom});};
 const timberGold=same?(p.timberSales?.gold??0)-(b.timberSales?.gold??0):0;
 const mined=after.miningReceipt;
 if(mined?.id&&mined.id!==before.miningReceipt?.id){
  add('ore:'+mined.id,mined.bonus?'catch':'timber','+'+(mined.amount??1)+' '+oreProducts[mined.ore].name+(mined.runic?' · Runic surge':mined.bonus?' · Bonus ore':''),mined.amount??1,mined.at,mined.room??'quarry');
  if(events.at(-1)?.id==='ore:'+mined.id)events.at(-1).mining={node:mined.node,at:mined.at,broken:mined.broken===true,find:mined.find,bonus:mined.bonus??0};
  if(miningFinds[mined.find])add('find:'+mined.id,'catch','Discovered '+miningFinds[mined.find].name+'!',1,mined.at,mined.room??'quarry');
 }
 if(timberGold>0)add('timber-sale:'+p.startedAt+':'+p.timberSales.visits,'gold','+'+timberGold+' gold',timberGold,p.cursorAt,'market');
 const oreGold=same?sum(Object.values(p.oreSales??{}).map(sale=>sale.gold))-sum(Object.values(b.oreSales??{}).map(sale=>sale.gold)):0;
 if(oreGold>0)add('ore-sale:'+p.startedAt+':'+p.cursorAt,'gold','+'+oreGold+' gold',oreGold,p.cursorAt,'market');
 if(p?.kind==='gambling'){
  if(same&&(p.rounds??0)>(b.rounds??0))for(const r of p.recent??[])if(r.at>(b.recent?.at(-1)?.at??0))add('gamble:'+p.startedAt+':'+r.at,r.net<0?'loss':r.net>0?'gold':'push',(r.net<0?'−'+Math.abs(r.net):r.net>0?'+'+r.net:'±0')+' gold',r.net,r.at,'lounge');
 }else{
  const r=after.gambling?.round,old=before.gambling?.round;
  if(r?.status==='complete'&&(r.id!==old?.id||old?.status!=='complete')){const net=r.payout-r.bet;add('gamble:'+r.id,net<0?'loss':net>0?'gold':'push',(net<0?'−'+Math.abs(net):net>0?'+'+net:'±0')+' gold',net,now,'lounge');}
 }
 if(same&&(p.lastCookAt??0)>(b.lastCookAt??0)){const id=Object.keys(p.cookedMeals??{}).find(id=>(p.cookedMeals[id]??0)>(b.cookedMeals?.[id]??0));if(id)add('cook:'+p.startedAt+':'+p.lastCookAt,'catch','+1 '+mealRecipes[id].name,1,p.lastCookAt,'home');}
 for(const [id,item] of Object.entries(rareHunts))if(ownsRareItem(after,id)&&!ownsRareItem(before,id))add('rare:'+id,'catch',item.name+' found!',1);
 const receipt=after.fishingReceipt;
 const timber=after.timberReceipt;
 if(timber?.id&&timber.id!==before.timberReceipt?.id)add('timber:'+timber.id,'timber','+'+timber.amount+' timber',timber.amount,timber.at??now,timber.room??room);
 const empowered=after.plan?.fishingWork?.cast;
 if(empowered?.patientCast&&empowered.id!==before.plan?.fishingWork?.cast?.id)add('patient:'+empowered.id,'ability','Patient Cast',0,empowered.started,'pond');
 const landed=receipt?.castId&&receipt.castId!==before.fishingReceipt?.castId;
 if(landed&&!receipt.batched){
  add('catch:'+receipt.castId,'catch','+1 '+(fishProducts[receipt.fish]?.name??'fish'),1,receipt.at??now,receipt.room??after.location);
  if(receipt.cast&&events.at(-1)?.id==='catch:'+receipt.castId)events.at(-1).fishing={...receipt.cast,room:receipt.room,spot:receipt.spot,landAt:receipt.at,fishId:receipt.fish};
 }
 if(same&&!landed){const caught=sum(p.catches)-sum(b.catches);if(caught>0){const names=Object.keys(p.catches??{}).filter(id=>(p.catches[id]??0)>(b.catches?.[id]??0));add('catch:'+p.startedAt+':'+sum(p.catches),'catch','+'+caught+' '+(caught===1?fishProducts[names[0]]?.name??'fish':'fish'),caught,p.cursorAt??(Number.isFinite(p.nextCatchAt-p.interval)?p.nextCatchAt-p.interval:now),'pond');}}
 if(after.combatReceipt?.id!==before.combatReceipt?.id)for(const e of after.combatReceipt?.events??[]){
  const key='combat:'+after.combatId+':'+e.at+':'+e.action,eventRoom=before.hunting?.encounter?before.location:room;
  if(['Stoneguard','Ambush'].includes(e.power))add(key+':ability','ability',e.power+(e.damage?' · '+e.damage+' damage':''),e.damage??0,e.at,eventRoom);
  if(e.taken>0)add(key+':hurt','damage','−'+e.taken+' HP',e.taken,e.at,eventRoom);
  if(e.healed>0&&!e.lifeSteal)add(key+':heal','heal','+'+e.healed+' HP',e.healed,e.at,eventRoom);
  if(e.dodged)add(key+':dodge','dodge',e.perfectDodge?'Perfect dodge':'Dodge',0,e.at,eventRoom);
 }
 const seenPerks=new Set((before.equipmentEffects??[]).map(e=>e.id));
 for(const e of after.equipmentEffects??[]){if(seenPerks.has(e.id)||!equipmentPerks[e.perk])continue;const label=e.perk==='vampire'?'+'+e.amount+' HP · Vampiric Sword':e.perk==='angler'?'Better catch · Angler’s Cloak':e.perk==='prospector'?'+'+e.amount+' bonus ore · Prospector’s Gloves':'Lucky Boots · Rare drop!';add('perk:'+e.id,'perk',label,e.amount,e.at,e.room);if(events.at(-1)?.id==='perk:'+e.id)events.at(-1).perk=e.perk;}
 for(const [key,role] of [['lastAttempt','thief'],['lastReceived','victim']]){
  const r=after.robbery?.[key];if(r?.id&&r.id!==before.robbery?.[key]?.id)add('robbery:'+role+':'+r.id,r.gold?(role==='thief'?'gold':'loss'):'push',r.gold?(role==='thief'?'+'+r.gold+' stolen gold':'−'+r.gold+' gold · Pickpocketed'):(role==='thief'?'Spotted! Steal failed':'Caught a pickpocket'),r.gold,r.at,r.room);
 }
 return events.slice(-16);
}
export function createWorldActivityTracker(initial){let previous=initial?structuredClone(initial):null;return {update(state,now){const events=worldActivityEvents(previous,state,now);previous=structuredClone(state);return events;}};}
export function sharedActivity(state){return state.plan?.mealStockTrip?(state.plan.mealStockTrip.phase==='returning'?'walking':'cooking'):state.hunting?.encounter?'combat':state.miningCut?'mining':state.timberCut?'woodcutting':state.fishingCast?'fishing':state.gambling?.round?.status==='playing'?'gambling':state.plan?.kind==='gambling'?'gambling':state.plan?.treeWork?.phase==='waiting'?'regrowth':state.plan?.kind==='queue'?state.plan.queue?.steps?.[state.plan.stepIndex]?.type??'auto':state.plan?.kind??null;}
