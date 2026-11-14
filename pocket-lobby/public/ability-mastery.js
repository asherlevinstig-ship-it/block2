import {skillLevel} from './skill-curve.js';
import {styleAbilities} from './style-abilities.js';

export const masteryBenefits={
 stoneguard:['30% damage reduction','40% damage reduction','50% damage reduction'],
 waypoint:['3-minute cooldown','150-second cooldown','2-minute cooldown'],
 shadowstep:['45-second cooldown','38-second cooldown','30-second cooldown'],
 trackPrey:['3-minute trail','4-minute trail','5-minute trail'],
 scoutAhead:['45-second clue signal','75-second clue signal','2-minute clue signal'],
 shareHearth:['20 HP shared recovery','30 HP shared recovery','40 HP shared recovery'],
 ambush:['50% opening damage bonus','65% opening damage bonus','80% opening damage bonus'],
 appraise:['60-second cooldown','45-second cooldown','30-second cooldown']
};
export const masteryPractice={
 stoneguard:'Absorb creature damage while Stoneguard is active. One successful use per cast.',
 waypoint:'Travel successfully to a discovered waypoint.',
 shadowstep:'Reposition successfully during arena combat.',
 trackPrey:'Finish the tracking trail and defeat its Dusktusk Boar.',
 scoutAhead:'Read a new clue highlighted by your familiar.',
 shareHearth:'Share a meal that helps an injured player.',
 ambush:'Land an opening Ambush strike.',
 appraise:'Appraise a new listing with enough completed sales.'
};
export function abilityMastery(state,id){
 const definition=styleAbilities[id];
 if(!definition)return null;
 const uses=Math.max(0,state.styleAbilities?.mastery?.[id]?.uses??0);
 const thresholds=id==='scoutAhead'?[1,2]:[5,20];
 const qualifies=offset=>Object.entries(definition.requirements).every(([stat,rank])=>
  skillLevel(stat==='mining'?state.mining?.xp:state.stats?.[stat+'Xp'])>=rank+offset);
 const stage=uses>=thresholds[1]&&qualifies(3)?3:uses>=thresholds[0]&&qualifies(1)?2:1;
 const next=stage===3?null:{uses:thresholds[stage-1],requirements:Object.fromEntries(Object.entries(definition.requirements).map(([stat,rank])=>[stat,rank+(stage===1?1:3)]))};
 const cooldown={waypoint:[180000,150000,120000],shadowstep:[45000,38000,30000],appraise:[60000,45000,30000]}[id]?.[stage-1]??definition.cooldown;
 return {stage,uses,next,cooldown,benefit:masteryBenefits[id][stage-1],nextBenefit:masteryBenefits[id][stage]??null};
}
