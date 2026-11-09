import {normalizeTrust,normalizeForage} from './wildlife.js';
export const familiars={
 otter:{name:'Reed Otter',color:'#89dacb',unlock:'Tame at the Reed Pools',passive:'Quick Waters',perk:'Fish bite 15% sooner, including during Auto fishing.',ability:'Second Chance',detail:'Secure the +5 Patience XP timing bonus during a bite, or recover it just after missing one.',cooldown:45000},
 fox:{name:'Ember Fox',color:'#f5ab78',unlock:'Tame in Amber Meadow',passive:'Ember Claws',perk:'Weapon hits against dungeon adds build 8 extra stagger.',ability:'Cinder Pounce',detail:'Select an add during its attack warning to interrupt it.',cooldown:24000},
 owl:{name:'Moon Owl',color:'#bfc8ff',unlock:'Tame on Moonpine Ridge',passive:'Trail Scout',perk:'See one trail junction farther through the map fog from where you stand.',ability:'Moon Sight',detail:'Highlight nearby exits and interactable exploration clues for 15 seconds.',cooldown:35000}
};
export const BOND_RANKS=[{name:'Companion',xp:0},{name:'Trusted',xp:30},{name:'Kindred',xp:90}];
export const familiarTraining={
 otter:{practice:'Earn 2 Bond XP per catch, 4 extra for a Second Chance catch, and 1 per Auto catch.',tricks:['Quick Waters II · Fish bite 20% sooner.','Bait Saver · A Second Chance catch saves your bait.']},
 fox:{practice:'Earn 5 Bond XP per add defeated and 6 for the first Cinder Pounce on each add.',tricks:['Quick Pounce · Cinder Pounce recharges in 20 seconds.','Opening Strike · Cinder Pounce exposes the add to 25% more weapon damage for 3 seconds.']},
 owl:{practice:'Earn 10 Bond XP the first time you use Moon Sight in each outdoor area.',tricks:['Lingering Sight · Moon Sight lasts 22 seconds.','Trail Memory · During Moon Sight, see and track named routes up to three junctions away.']}
};
const BOND_CAP=BOND_RANKS.at(-1).xp;
export function familiarBond(state,id){
 const xp=Math.max(0,Math.min(BOND_CAP,state?.bondXp?.[id]??0));
 const index=xp>=BOND_CAP?2:xp>=BOND_RANKS[1].xp?1:0;
 return {xp,rank:index+1,name:BOND_RANKS[index].name,next:BOND_RANKS[index+1]??null};
}
export const familiarCooldown=(state,id)=>id==='fox'&&familiarBond(state,id).rank>=2?20000:familiars[id].cooldown;
export const OTTER_WAIT=.85, FOX_STAGGER=8, MOON_SIGHT_MS=15000;
export const isFamiliar=id=>typeof id==='string'&&Object.hasOwn(familiars,id);
export const FAMILIAR_NAME_MAX=20;
export function normalizeFamiliarName(value){
 if(typeof value!=='string'||/[\p{Cc}\u202a-\u202e\u2066-\u2069]/u.test(value))return null;
 const name=value.trim().replace(/\s+/gu,' ');
 return name.length<=FAMILIAR_NAME_MAX?name:null;
}
const clock=value=>Number.isSafeInteger(value)&&value>=0?value:0;
export function normalizeFamiliars(input){
 const owned=[...new Set((Array.isArray(input?.owned)?input.owned:[]).filter(isFamiliar))];
 const equipped=owned.includes(input?.equipped)?input.equipped:null;
 const readyAt=Object.fromEntries(owned.filter(id=>clock(input?.readyAt?.[id])).map(id=>[id,clock(input.readyAt[id])]));
 const sight=input?.sight?.room&&owned.includes('owl')&&clock(input.sight.until)?{room:input.sight.room,until:input.sight.until}:null;
 const names={},bondXp={};
 for(const id of owned){
  const name=normalizeFamiliarName(input?.names?.[id]);if(name)names[id]=name;
  const xp=Math.min(BOND_CAP,clock(input?.bondXp?.[id]));if(xp)bondXp[id]=xp;
 }
 const scouted=owned.includes('owl')?[...new Set((Array.isArray(input?.scouted)?input.scouted:[]).filter(room=>typeof room==='string'&&/^[a-zA-Z]{1,32}$/.test(room)))].slice(0,32):[];
 return {owned,equipped,readyAt,sight,names,bondXp,scouted,trust:normalizeTrust(input?.trust),forage:normalizeForage(input?.forage)};
}
export function familiarFishingTime(state,duration){
 const familiar=state.familiars;
 const multiplier=familiar?.equipped!=='otter'?1:familiarBond(familiar,'otter').rank>=2?.80:OTTER_WAIT;
 return Math.round(duration*multiplier);
}
export const moonSightActive=(state,room,now)=>state.equipped==='owl'&&state.sight?.room===room&&state.sight.until>now;

export function secondChanceBlock(cast,now,graceMs=0){
 if(!cast)return 'Cast a line first. Second Chance becomes available when a fish bites.';
 if(cast.bonus)return 'You already earned the timing bonus on this cast.';
 if(now<cast.biteAt)return 'Wait for a bite to use Second Chance.';
 if(now>=cast.landAt+900+graceMs)return 'That fish has landed. Use Second Chance on your next bite.';
 return '';
}

export {drawFamiliar} from './familiar-art.js';
