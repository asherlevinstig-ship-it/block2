import {normalizeMagic} from '../../public/essences.js';
import {huntEnemies} from '../../public/hunting.js';
export function prepareDungeonBuild(state){
 state.magic=normalizeMagic({...state.magic,picks:['fire','ice','shadow'],unlocked:[...new Set([...(state.magic?.unlocked??[]),'fire:sword','ice:shield'])],slots:{q:'fire:sword',e:'ice:shield'}});
 state.characterRules.combat={enabled:true,dodge:true,q:true,e:true,fleeBelow:0,style:'balanced'};return state;
}
// Saved v1 encounters must retain their historical attack clocks after the update.
export function legacyDungeonEncounter(state){
 const e=state.hunting.encounter;for(const key of Object.keys(e))if(key.startsWith('brain')||['addsVersion','adds','addWaves','addWaveAt','addKills','manualTarget','combatTarget'].includes(key))delete e[key];
 e.health=Math.min(e.health,huntEnemies[e.enemy].health);e.nextBoarAt=(e.summary?.startedAt??1000)+huntEnemies[e.enemy].firstAttack;return state;
}
