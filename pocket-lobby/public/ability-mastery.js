import {styleAbilities,abilityStatLevel} from './style-abilities.js';

export const masteryBenefits={
 faultbreaker:['3 empowered party hits','4 empowered party hits','5 empowered party hits'],
 bloodPrice:['30 damage shield','35 damage shield','40 damage shield'],
 bindBeast:['Base ally strength and duration','+1 strike damage · +5 seconds','+2 strike damage · +10 seconds'],
 sanctuary:['Absorbs up to 30 shared damage','Absorbs up to 40 shared damage','Absorbs up to 50 shared damage'],
 packTactics:['+1.5 seconds to counter','+2 seconds to counter','+2.5 seconds to counter'],
 lockbreaker:['30 seconds inside','40 seconds inside','50 seconds inside'],
 lightFingers:['+10 success percentage points · 85% cap','+12 success percentage points · 85% cap','+15 success percentage points · 85% cap'],
 cutpurse:['20% larger haul · 25% wallet cap','30% larger haul · 25% wallet cap','40% larger haul · 25% wallet cap'],
 raiseFallen:['Base undead strength and lifetime','+1 strike damage · +5s lifetime, up to 60s','+2 strike damage · +10s lifetime, up to 60s'],
 deathmark:['25% marked strike bonus','35% marked strike bonus','45% marked strike bonus'],
 bloodlust:['10% weapon damage bonus','15% weapon damage bonus','20% weapon damage bonus'],
 shadowPursuit:['2-minute trail','150-second trail','3-minute trail'],
 siphon:['Heal 25% of damage dealt','Heal 35% of damage dealt','Heal 45% of damage dealt'],
 patientCast:['50% wider reel window','75% wider reel window','100% wider reel window'],
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
 faultbreaker:'Crack an armoured creature’s plating.',
 bloodPrice:'Let a creature break the shield.',
 bindBeast:'Have a bound beast land a strike in another fight.',
 sanctuary:'Cast Sanctuary in creature combat.',
 packTactics:'Trigger Pack Tactics with a perfect dodge and an equipped familiar.',
 lockbreaker:'Successfully enter another player’s room.',
 lightFingers:'Complete a successful Light Fingers steal. One use per attempt.',
 cutpurse:'Successfully steal additional gold with Cutpurse. One use per attempt.',
 raiseFallen:'Have your undead ally land a creature strike. One successful use per summon.',
 deathmark:'Land a Deathmark strike.',
 bloodlust:'Land a weapon strike while Bloodlust is active. One use per activation.',
 shadowPursuit:'Follow a trail to an opponent in a different area. One use per pursuit.',
 siphon:'Restore missing health with an empowered strike.',
 patientCast:'Land a catch after manually reeling during an empowered bite. One use per catch.',
 stoneguard:'Absorb creature damage while Stoneguard is active. One successful use per cast.',
 waypoint:'Travel successfully to a discovered waypoint.',
 shadowstep:'Reposition successfully during arena combat.',
 trackPrey:'Finish the tracking trail and defeat its Dusktusk Boar.',
 scoutAhead:'Read a new clue highlighted by your familiar.',
 shareHearth:'Share a meal that helps an injured player.',
 ambush:'Land an opening Ambush strike.',
 appraise:'Appraise a new listing with comparable sales or other offers.'
};
export function abilityMastery(state,id){
 const definition=styleAbilities[id];
 if(!definition)return null;
 const uses=Math.max(0,state.styleAbilities?.mastery?.[id]?.uses??0);
 const thresholds=id==='scoutAhead'?[1,2]:[5,20];
 const qualifies=offset=>Object.entries(definition.requirements).every(([stat,rank])=>
  abilityStatLevel(state,stat)>=rank+offset);
 const stage=uses>=thresholds[1]&&qualifies(3)?3:uses>=thresholds[0]&&qualifies(1)?2:1;
 const next=stage===3?null:{uses:thresholds[stage-1],requirements:Object.fromEntries(Object.entries(definition.requirements).map(([stat,rank])=>[stat,rank+(stage===1?1:3)]))};
 const cooldown={waypoint:[180000,150000,120000],shadowstep:[45000,38000,30000],appraise:[60000,45000,30000]}[id]?.[stage-1]??definition.cooldown;
 return {stage,uses,next,cooldown,benefit:masteryBenefits[id][stage-1],nextBenefit:masteryBenefits[id][stage]??null};
}
