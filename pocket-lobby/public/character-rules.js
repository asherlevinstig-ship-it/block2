export const AWAY_GRACE_MS=60000,AWAY_CAP_MS=8*3600000;
export function normalizeCharacterRules(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid character rules.');
  const {enabled=false,activity='rest',keepBait=5,timberTarget=100}=input;
  if(typeof enabled!=='boolean'||!['rest','fishing','woodcutting'].includes(activity)||!Number.isInteger(keepBait)||keepBait<0||keepBait>1000||!Number.isInteger(timberTarget)||timberTarget<1||timberTarget>1000000)throw new Error('Invalid character rules. Choose 0–1,000 bait to keep and a timber target from 1 to 1,000,000.');
  return {enabled,activity,keepBait,timberTarget};
}
export function describeCharacterRules(input){
  const r=normalizeCharacterRules(input);
  if(!r.enabled)return 'Automatic away actions are off. Your character stays where you leave them.';
  if(r.activity==='rest')return 'While I’m away, return home and rest.';
  return r.activity==='fishing'?'While I’m away, fish until I have '+r.keepBait+' bait left, then return home and rest.':'While I’m away, chop wood until my inventory holds '+r.timberTarget.toLocaleString()+' timber, then return home and rest.';
}
