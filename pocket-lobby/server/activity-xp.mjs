import {MAX_SKILL_XP} from '../public/skill-curve.js';

const huntingXpByEnemy=new Map([['boar',10],['beetle',15],['thornBoar',20],['moonbackStag',25]]);

function award(state,key,xp){
  if(!xp)return 0;
  const before=state.stats[key]??0;
  state.stats[key]=Math.min(MAX_SKILL_XP,before+xp);
  return state.stats[key]-before;
}

export const awardHuntingXp=(state,enemy)=>award(state,'huntingXp',huntingXpByEnemy.get(enemy)??0);
export const awardTradingXp=(state,quantity)=>award(state,'tradingXp',quantity*2);
