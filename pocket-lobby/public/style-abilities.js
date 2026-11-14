import {skillLevel} from './skill-curve.js';

export const abilitySlots=3;
export const preyTrail={room:'clearing',tracks:[{x:3,y:5},{x:5,y:7},{x:8,y:6}],site:{x:9,y:5},duration:180000};
export function activePreyTrail(state,now){
 const trail=state.styleAbilities?.preyTrail;
 return state.location===preyTrail.room&&trail?.until>now&&!trail.cleared?trail:null;
}
export const styleAbilities={
 waypoint:{name:'Waypoint',icon:'◇',cooldown:180000,description:'Travel to a discovered landmark from safety.',requirements:{exploration:3}},
 shadowstep:{name:'Shadowstep',icon:'◈',cooldown:45000,description:'Blink up to four reachable tiles. In arena combat, briefly delay the creature’s pursuit.',requirements:{exploration:3,stealth:3}},
 trackPrey:{name:'Track Prey',icon:'⁙',cooldown:180000,cost:0,description:'Reveal a trail in Bramble Clearing that leads to a Dusktusk Boar.',requirements:{hunting:2,exploration:2},discovery:'Earned through successful wild hunts and new discoveries.'}
};
export const waypoints={
 outside:{name:'Tower Courtyard',x:2,y:5},
 trail:{name:'Lantern Trail',x:1,y:5},
 pond:{name:'Silverfin Pond',x:4,y:5},
 logging:{name:'Timber Hollow',x:5,y:5},
 millbrook:{name:'Millbrook',x:2,y:6}
};
export function normalizeStyleAbilities(input){
 const list=key=>[...new Set((Array.isArray(input?.[key])?input[key]:[]).filter(id=>Object.hasOwn(styleAbilities,id)))];
 const learned=list('learned').slice(0,abilitySlots),declined=list('declined').filter(id=>!learned.includes(id));
 const readyAt=Object.fromEntries(learned.filter(id=>Number.isSafeInteger(input?.readyAt?.[id])&&input.readyAt[id]>0).map(id=>[id,input.readyAt[id]]));
 const quietUntil=Number.isSafeInteger(input?.quietUntil)&&input.quietUntil>0&&learned.includes('shadowstep')?input.quietUntil:0;
 const lastBlinkAt=learned.includes('shadowstep')&&Number.isSafeInteger(input?.lastBlinkAt)?Math.max(0,input.lastBlinkAt):0;
 const trail=input?.preyTrail;
 const tracked=learned.includes('trackPrey')&&Number.isSafeInteger(trail?.until)&&trail.until>0&&Number.isInteger(trail.step)&&trail.step>=0&&trail.step<=preyTrail.tracks.length;
 return {learned,declined,readyAt,quietUntil,lastBlinkAt,...(tracked?{preyTrail:{until:trail.until,step:trail.step,cleared:trail.cleared===true}}:{})};
}
export function styleAbilityOffers(state){
 const {learned,declined}=normalizeStyleAbilities(state.styleAbilities);
 if(learned.length>=abilitySlots||state.characterCreated===false)return [];
 return Object.entries(styleAbilities).filter(([id,ability])=>!learned.includes(id)&&!declined.includes(id)&&
   (state.adventure?.discovered?.length??0)>0&&Object.entries(ability.requirements).every(([stat,level])=>skillLevel(state.stats?.[stat+'Xp'])>=level)).map(([id])=>id);
}
