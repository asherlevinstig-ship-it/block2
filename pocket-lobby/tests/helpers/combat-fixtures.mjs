import {normalizeMagic} from '../../public/essences.js';
import {huntEnemies} from '../../public/hunting.js';
export function prepareDungeonBuild(state){
 state.magic=normalizeMagic({...state.magic,picks:['fire','ice','shadow'],unlocked:[...new Set([...(state.magic?.unlocked??[]),'fire:sword','ice:shield'])],slots:{q:'fire:sword',e:'ice:shield'}});
 state.characterRules.combat={enabled:true,dodge:true,q:true,e:true,fleeBelow:0,style:'balanced'};return state;
}
export function prepareBeetleHunter(state){
 state.location='ruins';state.history.beetleDefeated=true;state.depthsDiscovered=true;
 state.characterRules.queue.steps=[{type:'huntBeetles',amount:1}];
 Object.assign(state.stats,{strengthXp:1000,agilityXp:1000,vitalityXp:1000});
 if(!state.combatGear.ownedWeapons.includes('ironSword'))state.combatGear.ownedWeapons.push('ironSword');
 state.combatGear.equippedWeapon='ironSword';return state;
}
// Saved v1 encounters must retain their historical attack clocks after the update.
export function legacyDungeonEncounter(state){
 const e=state.hunting.encounter;for(const key of Object.keys(e))if(key.startsWith('brain')||['addsVersion','adds','addWaves','addWaveAt','addKills','manualTarget','combatTarget'].includes(key))delete e[key];
 e.health=Math.min(e.health,huntEnemies[e.enemy].health);e.nextBoarAt=(e.summary?.startedAt??1000)+huntEnemies[e.enemy].firstAttack;return state;
}
