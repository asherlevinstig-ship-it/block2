export const firstQuestReward={gold:75,weapon:'wardenSword'};
export function normalizeQuest(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid quest.');
  const {accepted=false,fish=0,boars=0,sold=false,claimed=false}=input;
  if(typeof accepted!=='boolean'||typeof sold!=='boolean'||typeof claimed!=='boolean'||!Number.isInteger(fish)||fish<0||fish>3||!Number.isInteger(boars)||boars<0||boars>1)throw new Error('Invalid quest progress.');
  if(!accepted&&(fish||boars||sold||claimed)||fish<3&&(boars||sold||claimed)||!boars&&(sold||claimed)||claimed&&!sold)throw new Error('Invalid quest order.');
  return {accepted,fish,boars,sold,claimed};
}
export function questStage(quest){return !quest.accepted?0:quest.fish<3?1:!quest.boars?2:!quest.sold?3:!quest.claimed?4:5;}
export function recordQuest(quest,event,count=1){
  const stage=questStage(quest);
  if(!Number.isInteger(count)||count<1)return false;
  if(stage===1&&event==='fish'){quest.fish=Math.min(3,quest.fish+count);return true;}
  if(stage===2&&event==='boar'){quest.boars=1;return true;}
  if(stage===3&&event==='marketSale'){quest.sold=true;return true;}
  return false;
}
export function claimFirstQuest(quest){
  if(questStage(quest)!==4)return null;
  quest.claimed=true;
  return {...firstQuestReward};
}
