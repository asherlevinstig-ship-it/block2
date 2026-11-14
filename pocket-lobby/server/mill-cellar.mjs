import {cellarEntrance,cellarChest,cellarReward} from '../public/mill-cellar.js';
import {normalizeMagic} from '../public/essences.js';
const distance=(p,t)=>p?Math.abs(p.x-t.x)+Math.abs(p.y-t.y):Infinity;
export function cellarAction(state,action){
 if(!['millCellarEnter','millCellarLeave','millCellarChest'].includes(action))return false;
 if(state.plan||state.report||state.hunting?.encounter||state.hunting?.recoveryUntil||state.health<=0||state.fishingCast||state.timberCut||state.bedRest||state.gambling?.round?.status==='playing')throw new Error('Choose the cellar after finishing your current activity.');
 if(action==='millCellarEnter'){
  if(state.location!=='millbrook'||distance(state.position,cellarEntrance)!==1)throw new Error('Travel beside the loose bricks at the watermill first.');
  state.adventure.millCellarFound=true;
  if(!state.adventure.discovered.includes('millCellar'))state.adventure.discovered.push('millCellar');
  state.location='millCellar';state.position={x:2,y:6};return true;
 }
 if(state.location!=='millCellar'||!state.adventure.millCellarFound)throw new Error('Travel into the mill cellar first.');
 if(action==='millCellarLeave'){
  if(distance(state.position,{x:0,y:6})>1&&distance(state.position,{x:1,y:7})>1)throw new Error('Travel beside the cellar stairs first.');
  state.location='millbrook';state.position={x:6,y:2};return true;
 }
 if(distance(state.position,cellarChest)!==1)throw new Error('Travel beside the millkeeper’s chest first.');
 if(!state.adventure.millCellarCleared)throw new Error('Defeat the Clockwork Custodian to release the chest’s seal.');
 if(state.adventure.millCellarClaimed)return true;
 if(state.credits+cellarReward.gold>100000000)throw new Error('Make room in your wallet before opening the chest.');
 const magic=normalizeMagic(state.magic);
 if(!state.essencesPaused&&magic.stones.shield>=9999)throw new Error('Make room for a Shield Awakening Stone first.');
 state.credits+=cellarReward.gold;state.goldEarned=Math.min(Number.MAX_SAFE_INTEGER,(state.goldEarned??0)+cellarReward.gold);
 if(!state.essencesPaused){magic.stones.shield++;state.magic=magic;}
 state.adventure.millCellarClaimed=true;
 return true;
}
