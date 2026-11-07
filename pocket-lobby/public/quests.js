export const firstQuestReward={gold:75,weapon:'wardenSword'};
export function normalizeQuest(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid quest.');
  const {accepted=false,fish=0,boars=0,sold=false,claimed=false}=input;
  if(typeof accepted!=='boolean'||typeof sold!=='boolean'||typeof claimed!=='boolean'||!Number.isInteger(fish)||fish<0||fish>3||!Number.isInteger(boars)||boars<0||boars>1)throw new Error('Invalid quest progress.');
  if(!accepted&&(fish||boars||sold||claimed)||claimed&&(fish<3||!boars||!sold))throw new Error('Invalid quest progress.');
  return {accepted,fish,boars,sold,claimed};
}
export function questStage(quest){return !quest.accepted?0:quest.fish<3?1:!quest.boars?2:!quest.sold?3:!quest.claimed?4:5;}
export function recordQuest(quest,event,count=1){
  if(!quest.accepted||quest.claimed||!Number.isInteger(count)||count<1)return false;
  if(event==='fish'&&quest.fish<3){quest.fish=Math.min(3,quest.fish+count);return true;}
  if(event==='boar'&&!quest.boars){quest.boars=1;return true;}
  if(event==='marketSale'&&!quest.sold){quest.sold=true;return true;}
  return false;
}
export function claimFirstQuest(quest){
  if(questStage(quest)!==4)return null;
  quest.claimed=true;
  return {...firstQuestReward};
}
