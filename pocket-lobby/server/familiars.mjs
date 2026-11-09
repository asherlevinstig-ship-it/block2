import {wildlifeRoom,wildAnimal,nearWildAnimal,wildlifeHabitats,bondStep,bondOdds,FORAGE_COOLDOWN_MS,FORAGE_CAP} from '../public/wildlife.js';
import {roomBoxes,validRoomTile} from '../public/shared-world.js';
import {familiars,normalizeFamiliars,normalizeFamiliarName,FAMILIAR_NAME_MAX,MOON_SIGHT_MS,secondChanceBlock} from '../public/familiars.js';
import {activeAdd,addKinds} from '../public/dungeon-adds.js';
import {isFishingRoom} from '../public/region-catalog.js';
import {moonwood} from '../public/moonwood.js';
import {dungeonRooms} from '../public/dungeon-arena.js';

const invalidUse=message=>Object.assign(new Error(message),{status:400});

export function familiarAction(state,action,body,now,random=Math.random){
 if(!['familiarRecruit','familiarTame','familiarForage','familiarRename','familiarEquip','familiarUse'].includes(action))return false;
 const current=normalizeFamiliars(state.familiars),id=body.id;
 if(action==='familiarUse'){
  if(current.equipped==='fox')throw new Error('Select an add during combat to use Cinder Pounce.');
  if(!current.equipped||state.plan||state.report||state.health<=0||state.hunting?.recoveryUntil)throw invalidUse('Your familiar is unavailable right now.');
  if(now<(current.readyAt[current.equipped]??0))throw invalidUse('Your familiar is still recovering.');
  if(current.equipped==='otter'){
   const cast=state.fishingCast;
   if(cast&&cast.id!==body.castId)throw invalidUse('That cast has changed. Wait for your next bite.');
   // Allow a click sent during landing to arrive after the client animation ends.
   const blocked=secondChanceBlock(isFishingRoom(state.location)?cast:null,now,600);
   if(blocked)throw invalidUse(blocked);
   cast.bonus=5;
  }else{
   if(!moonwood.has(state.location)||dungeonRooms.includes(state.location)||state.hunting?.encounter)throw new Error('Use Moon Sight while exploring outdoors.');
   current.sight={room:state.location,until:now+MOON_SIGHT_MS};
  }
  current.readyAt[current.equipped]=now+familiars[current.equipped].cooldown;
 }else{
  if(state.plan||state.report||state.fishingCast||state.timberCut||state.hunting?.encounter||state.hunting?.recoveryUntil||state.health<=0||state.gambling?.round?.status==='playing')throw new Error('Finish your current activity before changing familiars.');
  if(action==='familiarRecruit')throw new Error('Visit the Moonwood Wildlife Reserve to tame a familiar.');
  if(action==='familiarTame'||action==='familiarForage'){
   const position=state.position;
   if(state.location!==wildlifeRoom||!validRoomTile(wildlifeRoom,position?.x,position?.y,roomBoxes(wildlifeRoom)))throw new Error('Visit the reserve first.');
  }
  if(action==='familiarForage'){
   const habitat=Object.hasOwn(wildlifeHabitats,id)?wildlifeHabitats[id]:null;
   if(!habitat||!nearWildAnimal(state.position,habitat.forage))throw new Error('Walk beside the foraging spot first.');
   const supply=current.forage[id]??{count:0,readyAt:0};
   if(supply.count>=FORAGE_CAP)throw new Error('Your treat pouch is full for this habitat.');
   if(now<supply.readyAt)throw new Error('Give this foraging spot time to replenish.');
   current.forage[id]={count:supply.count+1,readyAt:now+FORAGE_COOLDOWN_MS};
  }else if(action==='familiarTame'){
   const animal=typeof id==='string'?wildAnimal(id,now):null;
   if(!animal)throw new Error('Choose a wild animal in the reserve.');
   if(current.owned.includes(animal.kind))return true;
   if(!animal.resting||!nearWildAnimal(state.position,animal))throw new Error('Walk beside the animal while it is resting.');
   const {trust,stage,waiting,food,habitat}=bondStep(current,animal);
   if(body.step!==trust.step)throw new Error('The animal’s trust has changed. Try the next step.');
   if(waiting)throw new Error('Let this animal move on, then meet it at its next rest.');
   if(stage==='feed'&&!food)throw new Error('Gather a '+habitat.food+' at the foraging spot first.');
   const misses=trust.misses??0;
   const {percent}=bondOdds(state.stats,animal.kind,stage,misses);
   if(random()*100>=percent){
    current.trust[id]={step:trust.step,lastRest:animal.rest,misses:Math.min(3,misses+1)};
    state.familiars=current;
    return true;
   }
   if(stage==='feed')current.forage[animal.kind].count--;
   if(stage==='bond'){
    current.owned.push(animal.kind);
    if(!current.equipped)current.equipped=animal.kind;
    for(const other of Object.keys(current.trust))if(wildAnimal(other,now)?.kind===animal.kind)delete current.trust[other];
   }else current.trust[id]={step:trust.step+1,lastRest:animal.rest};
  }else if(action==='familiarRename'){
   if(!current.owned.includes(id))throw new Error('Befriend this familiar before naming it.');
   const name=normalizeFamiliarName(body.name);
   if(name===null)throw new Error('Choose a name with up to '+FAMILIAR_NAME_MAX+' characters.');
   if(name)current.names[id]=name;else delete current.names[id];
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
