import {normalizeStyleAbilities} from '../public/style-abilities.js';

export function awardAbilityUse(state,id,key=null){
 const abilities=normalizeStyleAbilities(state.styleAbilities);
 if(!abilities.learned.includes(id))return false;
 const progress=abilities.mastery?.[id]??{uses:0,seen:[]};
 if(key&&progress.seen.includes(key))return false;
 abilities.mastery={...abilities.mastery,[id]:{uses:Math.min(1000000,progress.uses+1),seen:key?[...progress.seen,key].slice(-60):progress.seen}};
 state.styleAbilities=abilities;
 return true;
}
