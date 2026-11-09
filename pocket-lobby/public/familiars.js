import {normalizeTrust,normalizeForage} from './wildlife.js';
export const familiars={
 otter:{name:'Reed Otter',color:'#89dacb',unlock:'Tame at the Reed Pools',passive:'Quick Waters',perk:'Fish bite 15% sooner, including during Auto fishing.',ability:'Second Chance',detail:'Secure the +5 Patience XP timing bonus during a bite, or recover it just after missing one.',cooldown:45000},
 fox:{name:'Ember Fox',color:'#f5ab78',unlock:'Tame in Amber Meadow',passive:'Ember Claws',perk:'Weapon hits against dungeon adds build 8 extra stagger.',ability:'Cinder Pounce',detail:'Select an add during its attack warning to interrupt it.',cooldown:24000},
 owl:{name:'Moon Owl',color:'#bfc8ff',unlock:'Tame on Moonpine Ridge',passive:'Trail Scout',perk:'See one trail junction farther through the map fog from where you stand.',ability:'Moon Sight',detail:'Highlight nearby exits and interactable exploration clues for 15 seconds.',cooldown:35000}
};
export const OTTER_WAIT=.85, FOX_STAGGER=8, MOON_SIGHT_MS=15000;
export const isFamiliar=id=>typeof id==='string'&&Object.hasOwn(familiars,id);
const clock=value=>Number.isSafeInteger(value)&&value>=0?value:0;
export function normalizeFamiliars(input){
 const owned=[...new Set((Array.isArray(input?.owned)?input.owned:[]).filter(isFamiliar))];
 const equipped=owned.includes(input?.equipped)?input.equipped:null;
 const readyAt=Object.fromEntries(owned.filter(id=>clock(input?.readyAt?.[id])).map(id=>[id,clock(input.readyAt[id])]));
 const sight=input?.sight?.room&&owned.includes('owl')&&clock(input.sight.until)?{room:input.sight.room,until:input.sight.until}:null;
 return {owned,equipped,readyAt,sight,trust:normalizeTrust(input?.trust),forage:normalizeForage(input?.forage)};
}
export const familiarFishingTime=(state,duration)=>Math.round(duration*(state.familiars?.equipped==='otter'?OTTER_WAIT:1));
export const moonSightActive=(state,room,now)=>state.equipped==='owl'&&state.sight?.room===room&&state.sight.until>now;

export {drawFamiliar} from './familiar-art.js';
