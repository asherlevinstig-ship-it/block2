import {autoStatus} from './auto-mode.js';
import {pinnedGoalSummary,upgradeGoalProgress} from './upgrade-goals.js';
import {timberSalesText} from './simple-auto.js';
import {oreProducts,miningFinds} from './mining.js';

const routine=state=>state?.plan?.source==='rules'?state.plan:state?.report?.source==='rules'?state.report:null;
const sum=values=>Object.values(values??{}).reduce((total,value)=>total+value,0);
const format=new Intl.NumberFormat();
const foodJobs=['fishing','woodcutting','mining','battle','hunting','random'];
const foodStops=['out-of-food','food-budget','food-funds','food-reserve'];
export const autoRecapAwayMs=60000;

export function autoRecapSnapshot(state){
 const plan=routine(state);
 if(!plan)return null;
 const sales=Object.values(plan.oreSales??{});
 const goal=upgradeGoalProgress(state);
 return {...Object.fromEntries(Object.keys(miningFinds).map(id=>['find_'+id,plan.miningFinds?.[id]??0])),id:String(plan.routineId??plan.startedAt),fish:sum(plan.catches),timber:plan.timber??0,ore:sum(plan.ores),miningXp:plan.miningXp??0,oreSold:sales.reduce((total,sale)=>total+sale.quantity,0),oreGold:sales.reduce((total,sale)=>total+sale.gold,0),wins:plan.hunts?.wins??0,
  places:plan.explored??plan.visited?.length??0,rounds:plan.rounds??0,meals:sum(plan.cookedMeals),
  earned:plan.goldEarned??0,spent:plan.goldSpent??0,bread:plan.rationGoldSpent??0,banked:plan.bankedGold??0,
  goalTarget:goal?.target??null,goalRemaining:goal?Math.max(0,goal.item.price-goal.gold):null,
  marketQuantity:plan.timberSales?.quantity??0,marketGold:plan.timberSales?.gold??0,marketSales:plan.timberSales?.sales??0,marketVisits:plan.timberSales?.visits??0,
 };
}

export function autoRecapView(state,baseline,roomName){
 const plan=routine(state),totals=autoRecapSnapshot(state);
 if(!plan)return null;
 const same=baseline?.id===totals.id;
 const gained=key=>Math.max(0,totals[key]-(same?baseline[key]??0:0));
 const running=plan===state.plan,info=autoStatus(state);
 const room=state.autoPresence?.room??state.location;
 const location=roomName(room)??info.location??'The Tower';
 const activity=state.autoPresence?.blocked?'Waiting for a clear path':state.autoPresence?.moving?'Walking to '+(roomName(state.location)??info.location):info.current;
 const rewards=[['fish','Fish caught'],['timber','Timber gathered'],['ore','Ore mined'],['miningXp','Mining XP'],['wins','Fights won'],['places','Places visited'],['rounds','Table rounds'],['meals','Meals cooked']]
  .map(([key,label])=>({label,value:gained(key)})).filter(item=>item.value>0);
 for(const [id,item] of Object.entries(miningFinds)){const value=gained('find_'+id);if(value)rewards.push({label:item.name,value});}
 const earned=gained('earned'),spent=gained('spent'),bread=gained('bread'),banked=gained('banked');
 const closer=same&&baseline.goalTarget===totals.goalTarget&&Number.isFinite(baseline.goalRemaining)&&Number.isFinite(totals.goalRemaining)
  ?baseline.goalRemaining-totals.goalRemaining:0;
 const goal=pinnedGoalSummary(state)+(closer>0?' · Gold gap narrowed by '+closer:'');
 const wallet=[earned&&'+'+format.format(earned)+' gold earned',spent&&'−'+format.format(spent)+' gold spent'+(bread?' · '+format.format(bread)+' on bread':''),banked&&format.format(banked)+' gold banked'].filter(Boolean);
 const mined=plan.mining&&oreProducts[plan.mining.ore],sold=gained('oreSold');
 const market=mined?'Sold '+sold+' '+mined.name+' for '+gained('oreGold')+' gold. '+(state.huntingLoot?.[plan.mining.ore]??0)+' in your bag.'
   :timberSalesText({quantity:gained('marketQuantity'),gold:gained('marketGold'),sales:gained('marketSales'),visits:gained('marketVisits')},state.woodcutting?.timber??0);
 return {rewards,wallet,location,running,returning:info.returning===true,summary:same?'Since you stepped away':'This Auto session',
  status:running?activity:info.reason,completion:running?null:totals.id+':'+plan.endedAt,market,goal,
  startedAt:plan.startedAt,food:!!plan.foodTrip||foodStops.includes(plan.reason)||(plan.simpleMode?foodJobs.includes(plan.simpleMode):[undefined,'fishing','woodcutting','queue'].includes(plan.kind)),
 };
}

export function initializeAutoRecap({doc,getPacket,roomName,takeControl,openFood,openDetails,storage}){
 const byId=id=>doc.getElementById(id),dialog=byId('autoRecap'),primary=byId('autoRecapPlay'),error=byId('autoRecapError');
 const key='pocket-lobby:auto-recap:'+getPacket().characterKey;
 let saved={};
 try{saved=JSON.parse(storage.getItem(key))??{};}catch{}
 let departure=saved.departure??null,seen=saved.seen??null,deferred=false,busy=false;
 const persist=()=>{try{storage.setItem(key,JSON.stringify({departure,seen}));}catch{}};

 function updateStatus(view){
  byId('autoRecapState').textContent=view.running?'Auto still running':'Auto stopped';
  dialog.dataset.running=String(view.running);
  byId('autoRecapLocation').textContent=view.location;
  byId('autoRecapStatus').textContent=view.status??'Your routine has finished.';
  const goal=byId('autoRecapGoal');
  if(goal){goal.textContent=view.goal;goal.hidden=!view.goal;}
  byId('autoRecapFood').hidden=!view.food;
  primary.disabled=view.returning;
  primary.textContent=view.returning?'Finishing current fight…':view.running?'Take control':'Return to play';
 }
 function open(view){
  byId('autoRecapPeriod').textContent=view.summary;
  updateStatus(view);
  const rewards=byId('autoRecapRewards');rewards.replaceChildren();
  for(const {label,value} of view.rewards){
   const item=doc.createElement('div'),title=doc.createElement('dt'),number=doc.createElement('dd');
   title.textContent=label;number.textContent=format.format(value);item.append(title,number);rewards.append(item);
  }
  rewards.hidden=!view.rewards.length;
  byId('autoRecapWallet').textContent=view.wallet.join('  •  ');
  byId('autoRecapWallet').hidden=!view.wallet.length;
  byId('autoRecapMarket').textContent=view.market;
  byId('autoRecapMarket').hidden=!view.market;
  error.textContent='';
  if(!dialog.open)dialog.showModal();
 }
 function resume({initial=false,manual=false}={}){
  if(doc.hidden||busy)return false;
  if(!initial&&!manual&&!departure&&!deferred){
   if(dialog.open){
    const current=autoRecapView(getPacket().state,null,roomName);
    if(current){updateStatus(current);if(current.completion&&current.completion!==seen){seen=current.completion;persist();}}
   }
   return false;
  }
  const {state,serverTime}=getPacket(),view=autoRecapView(state,manual?null:departure?.baseline,roomName);
  const elapsed=departure?Date.now()-departure.at:(serverTime??Date.now())-(view?.startedAt??Infinity);
  if(!view||!manual&&(view.completion?view.completion===seen:elapsed<autoRecapAwayMs)){
   if(!manual){departure=null;deferred=false;persist();}
   return false;
  }
  if(!manual&&doc.querySelector('dialog[open]:not(#autoRecap)')){deferred=true;return false;}
  open(view);
  if(view.completion)seen=view.completion;
  departure=null;deferred=false;persist();
  return true;
 }
 const close=()=>{if(!busy)dialog.close();};
 byId('autoRecapClose').onclick=close;
 byId('autoRecapFood').onclick=()=>{if(!busy){dialog.close();openFood();}};
 byId('autoRecapDetails').onclick=()=>{if(!busy){dialog.close();openDetails();}};
 primary.onclick=async()=>{
  if(busy)return;
  busy=true;primary.disabled=true;error.textContent='';
  try{if(await takeControl(error))dialog.close();}
  finally{busy=false;if(dialog.open)primary.disabled=false;}
 };
 dialog.oncancel=event=>{if(busy)event.preventDefault();};
 doc.addEventListener('close',()=>{if(deferred)queueMicrotask(()=>resume());},true);
 return {resume,leave(){
  const {state}=getPacket();
  if(departure||!routine(state)&&!state.characterRules?.enabled&&state.controlMode!=='auto')return;
  departure={at:Date.now(),baseline:autoRecapSnapshot(state)};persist();
 }};
}
