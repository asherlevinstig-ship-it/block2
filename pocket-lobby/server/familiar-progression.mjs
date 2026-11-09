import {BOND_RANKS,familiarBond,normalizeFamiliars} from '../public/familiars.js';
export function awardFamiliarBond(state,id,amount){
 if(state.familiars?.equipped!==id||!state.familiars.owned?.includes(id))return 0;
 const before=familiarBond(state.familiars,id).xp,xp=Math.min(BOND_RANKS.at(-1).xp,before+amount);
 if(xp===before)return 0;
 state.familiars={...state.familiars,bondXp:{...state.familiars.bondXp,[id]:xp}};
 return xp-before;
}
export function recordOwlScout(state,room){
 const familiar=normalizeFamiliars(state.familiars);
 if(familiar.scouted.includes(room))return;
 familiar.scouted.push(room);state.familiars=familiar;
 awardFamiliarBond(state,'owl',10);
}
