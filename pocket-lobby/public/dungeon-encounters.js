import {manaAvailable,normalizeVitals,spendMana} from './player-vitals.js';
export const dungeonEncounterSite={x:8,y:7};
export const dungeonEncounters=Object.freeze({
 explorer:{name:'The trapped explorer',tag:'A VOICE BEHIND THE ROOTS',color:'#d9bd83',text:'A fallen beam blocks an explorer’s way out. Their satchel lies deeper in an unstable passage. Which way will you lead them?',choices:{
  rescue:{name:'Clear a safe exit',detail:'Spend 20 mana · Receive 25 unbanked gold.',mana:20,gold:25,result:'You lift the beam with magic. The explorer thanks you and leaves 25 gold for your expedition.'},
  passage:{name:'Brave the collapsing passage',detail:'Lose 15 HP · 50% chance of 60 gold; otherwise 10 gold. All gold is unbanked.',health:15,roll:[60,10],result:'You escort the explorer through falling stone. Their recovered satchel holds GOLD gold for your expedition.'}
 }},
 merchant:{name:'The lantern merchant',tag:'A LIGHT ON THE ROAD',color:'#9dcbba',text:'A travelling merchant has stopped in the gallery. Buy reliable supplies, or take a chance on a sealed parcel. One deal this expedition.',choices:{
  rations:{name:'Buy two Tower Bread',detail:'Pay 6 wallet gold · Receive 2 Tower Bread in Inventory.',wallet:6,bread:2,result:'Two fresh Tower Bread are added to Inventory. Eat them to restore hunger.'},
  parcel:{name:'Buy the mystery parcel',detail:'Pay 12 wallet gold · 50% chance of 40 gold; otherwise 4 gold. Parcel gold is unbanked.',wallet:12,roll:[40,4],result:'Inside the parcel you find GOLD gold. Extract safely to keep it.'}
 }},
 shrine:{name:'The whispering shrine',tag:'A BARGAIN IN THE DARK',color:'#c0abe9',text:'Pale runes offer a quiet blessing. A second voice promises treasure in return for some of your vitality.',choices:{
  blessing:{name:'Accept the gentle blessing',detail:'Recover up to 15 HP and 20 mana. No gold cost.',heal:15,restoreMana:20,result:'The quiet light restores your strength. The shrine falls silent until your next expedition.'},
  bargain:{name:'Offer some vitality',detail:'Lose 20 HP · Receive 50 unbanked gold. This cannot kill you.',health:20,gold:50,result:'The runes take 20 HP and release 50 gold into your expedition haul. It remains at risk until you extract.'}
 }}
});
export function createDungeonEncounter(random=Math.random){const kinds=Object.keys(dungeonEncounters);return {kind:kinds[Math.min(kinds.length-1,Math.max(0,Math.floor(random()*kinds.length)))]};}
export function normalizeDungeonEncounter(input,cleared){
 if(input===undefined)return undefined;
 const event=dungeonEncounters[input?.kind];if(!event)throw new Error('Invalid dungeon encounter.');
 if(input.choice===undefined)return {kind:input.kind};
 const choice=event.choices[input.choice];if(!choice||cleared<2||!Number.isInteger(input.gold)||!(choice.roll??[choice.gold??0]).includes(input.gold))throw new Error('Invalid dungeon encounter choice.');
 return {kind:input.kind,choice:input.choice,gold:input.gold};
}
export function dungeonEncounterResult(event){const choice=dungeonEncounters[event?.kind]?.choices[event?.choice];return choice?choice.result.replace('GOLD',String(event.gold)):'';}
export function resolveDungeonEncounter(state,id,now=Date.now(),random=Math.random){
 const run=state.depthsRun,event=run?.encounter,choice=dungeonEncounters[event?.kind]?.choices[id],p=state.position;
 if(state.location!=='depthsGallery'||run?.cleared!==2||!choice||!p||Math.abs(p.x-dungeonEncounterSite.x)+Math.abs(p.y-dungeonEncounterSite.y)!==1)throw new Error('Travel beside the gallery encounter after defeating the Shell Warden.');
 if(event.choice)throw new Error('This encounter is already completed for this expedition.');
 if(choice.health&&state.health<=choice.health)throw new Error('Choose the safer option. You need more than '+choice.health+' HP for this risk.');
 if(choice.wallet&&state.credits<choice.wallet)throw new Error('Choose this deal with '+choice.wallet+' wallet gold.');
 if(choice.bread&&(state.meals?.towerBread??0)+choice.bread>1000000)throw new Error('Make room for the bread before trading.');
 if(choice.mana&&manaAvailable(state.vitals,now)<choice.mana)throw new Error('Choose this rescue with at least '+choice.mana+' mana.');
 if(choice.heal&&state.health===100&&manaAvailable(state.vitals,now)===100)throw new Error('Your hearts are already full, and your mana is full. Return to the shrine if you need its blessing later.');
 if(choice.mana)spendMana(state,now,choice.mana);
 if(choice.wallet)state.credits-=choice.wallet;
 if(choice.bread)state.meals.towerBread=(state.meals.towerBread??0)+choice.bread;
 if(choice.health)state.health-=choice.health;
 if(choice.heal)state.health=Math.min(100,state.health+choice.heal);
 if(choice.restoreMana)state.vitals={...normalizeVitals(state.vitals),mana:Math.min(100,manaAvailable(state.vitals,now)+choice.restoreMana),manaAt:now};
 const gold=choice.roll?choice.roll[random()<.5?0:1]:choice.gold??0;
 Object.assign(event,{choice:id,gold});return event;
}
