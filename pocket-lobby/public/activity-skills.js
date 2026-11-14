import {skillProgress} from './skill-curve.js';

export const activitySkills={
  fishing:{name:'Fishing', icon:'≈', training:'Catch fish to train Patience.', affinity:'Focus and control', xp:state=>state.stats?.patienceXp},
  hunting:{name:'Hunting', icon:'➶', training:'Defeat wild beasts.', affinity:'Tracking and precision', xp:state=>state.stats?.huntingXp},
  trading:{name:'Trading', icon:'◈', training:'Earn 2 XP per item sold to merchants or through timber orders.', affinity:'Appraisal and bargaining', xp:state=>state.stats?.tradingXp},
  woodcutting:{name:'Woodcutting', icon:'⚒', training:'Chop trees.', affinity:'Heavy strikes and stagger', xp:state=>state.woodcutting?.xp},
  mining:{name:'Mining', icon:'◆', training:'Mine deposits.', affinity:'Wards and resilience', xp:state=>state.mining?.xp},
  cooking:{name:'Cooking', icon:'♨', training:'Cook meals.', affinity:'Recovery and support', xp:state=>state.stats?.cookingXp}
};

export function activitySkillProgress(state,id){
  return Object.hasOwn(activitySkills,id)?skillProgress(activitySkills[id].xp(state)):null;
}
