import {moonwood} from '../public/moonwood.js';
import {normalizeMagic} from '../public/essences.js';
export function watchAction(state,action,body){
 if(action!=='watchFind')return false;
 if(state.plan||state.report||state.hunting?.encounter||state.hunting?.recoveryUntil||state.health<=0||state.fishingCast||state.timberCut||state.gambling?.round?.status==='playing')throw new Error('Choose the landmark after finishing your activity.');
 const type=body.id,room=state.location;
 if(!['watchBeacon','watchCache'].includes(type))throw new Error('Choose a watchtower landmark.');
 const prop=moonwood.layouts[room]?.scenery.find(p=>p.type===type),p=state.position;
 if(!prop||!p||Math.abs(p.x-prop.x)+Math.abs(p.y-prop.y)!==1)throw new Error('Travel beside the landmark first.');
 const flag=type==='watchBeacon'?'watchBeacon':room==='starfall'?'grottoCache':'meadowCache';
 if(state.adventure[flag])return true;
 if(room==='starfall'&&!state.adventure.watchBoar)throw new Error('Defeat the Thorn Boar to break this cache seal.');
 const gold=type==='watchCache'?(room==='starfall'?35:15):0;
 if(state.credits+gold>100000000)throw new Error('Make room in your wallet before opening the cache.');
 if(room==='starfall'&&!state.essencesPaused){
  const magic=normalizeMagic(state.magic);
  if(magic.stones.sword>=9999)throw new Error('Make room for a Sword Awakening Stone first.');
  magic.stones.sword++;state.magic=magic;
 }
 state.credits+=gold;state.goldEarned=Math.min(Number.MAX_SAFE_INTEGER,(state.goldEarned??0)+gold);state.adventure[flag]=true;
 return true;
}
