import {familiars,isFamiliar,normalizeFamiliars,familiarUnlocked,MOON_SIGHT_MS} from '../public/familiars.js';
import {activeAdd,addKinds} from '../public/dungeon-adds.js';
import {isFishingRoom} from '../public/region-catalog.js';
import {moonwood} from '../public/moonwood.js';
import {dungeonRooms} from '../public/dungeon-arena.js';

export function familiarAction(state,action,body,now){
 if(!['familiarRecruit','familiarEquip','familiarUse'].includes(action))return false;
 const current=normalizeFamiliars(state.familiars),id=body.id;
 if(action==='familiarUse'){
  if(current.equipped==='fox')throw new Error('Select an add during combat to use Cinder Pounce.');
  if(!current.equipped||state.plan||state.report||state.health<=0||state.hunting?.recoveryUntil)throw new Error('Your familiar is unavailable right now.');
  if(now<(current.readyAt[current.equipped]??0))throw new Error('Your familiar is still recovering.');
  if(current.equipped==='otter'){
   const cast=state.fishingCast;
   if(!isFishingRoom(state.location)||!cast||cast.id!==body.castId||cast.bonus||now<cast.biteAt||now>=cast.landAt+900)throw new Error('Use Second Chance during the bite or just as the fish lands.');
   cast.bonus=5;
  }else{
   if(!moonwood.has(state.location)||dungeonRooms.includes(state.location)||state.hunting?.encounter)throw new Error('Use Moon Sight while exploring outdoors.');
   current.sight={room:state.location,until:now+MOON_SIGHT_MS};
  }
  current.readyAt[current.equipped]=now+familiars[current.equipped].cooldown;
 }else{
  if(state.plan||state.report||state.fishingCast||state.timberCut||state.hunting?.encounter||state.hunting?.recoveryUntil||state.health<=0||state.gambling?.round?.status==='playing')throw new Error('Finish your current activity before changing familiars.');
  if(action==='familiarRecruit'){
   if(!isFamiliar(id)||!familiarUnlocked(state,id))throw new Error('Complete this familiar’s unlock first.');
   if(!current.owned.includes(id))current.owned.push(id);
  }else{
   if(id!==null&&!current.owned.includes(id))throw new Error('Befriend this familiar before equipping it.');
   current.equipped=id;
   if(id!=='owl')current.sight=null;
  }
 }
 state.familiars=current;
 return true;
}

export function cinderPounce(state,now){
 const familiar=normalizeFamiliars(state.familiars),e=state.hunting?.encounter,add=activeAdd(e);
 if(familiar.equipped!=='fox')throw new Error('Equip the Ember Fox to use Cinder Pounce.');
 if(now<(familiar.readyAt.fox??0))throw new Error('Cinder Pounce is still recovering.');
 if(!add||add.spawnAt>now||add.attackAt<=now||add.lockedFor!==add.attackAt)throw new Error('Select an add that is winding up an attack.');
 const {name,move}=addKinds[add.kind],attackAt=now+move.tell+1650;
 const actor={...add,attackAt,thinkAt:now+950,lockedFor:0,staggerUntil:now+950,castHits:0};
 delete actor.target;delete actor.origin;
 familiar.readyAt.fox=now+familiars.fox.cooldown;state.familiars=familiar;
 return {action:'familiar',power:'Cinder Pounce',powerForm:'familiar',powerColor:familiars.fox.color,interrupted:true,effect:'interrupted '+name,encounter:{...e,adds:e.adds.map(other=>other.id===add.id?actor:other)},health:state.health,damage:0,taken:0,outcome:'fighting',targetId:add.id,enemyId:addKinds[add.kind].id,enemyTile:{x:add.x,y:add.y}};
}
