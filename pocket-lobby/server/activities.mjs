import {moonwood} from '../public/moonwood.js';
import {isTimberTree,timberTreeState,cutTimberTree,choppingDuration,grantBasicAxe} from '../public/woodcutting.js';
import {huntEnemyForRoom,huntEnemy,huntRespawnAt,canUseWeapon,createHunt,advanceHunt,huntingTurn,boarRules} from '../public/hunting.js';
import {depthsStages,depthsStageIndex,clearDepthsStage} from '../public/depths.js';
import {castRootbind,normalizeRootstone,canAwakenRootstone,rootstonePowers} from '../public/rootstone.js';
import {recordQuest} from '../public/quests.js';

const adjacent=(state,item)=>state.position&&Math.abs(state.position.x-item.x)+Math.abs(state.position.y-item.y)===1;
function idle(state){
  if(state.plan||state.report||state.fishingCast||state.hunting.encounter||state.hunting.recoveryUntil||state.health<=0)throw new Error('Invalid activity while working, fishing, fighting or recovering.');
}
function move(state,room,position={x:5,y:7}){state.location=room;state.position=position;}
function result(state,event,now){
  const enemy=huntEnemy(state.hunting.encounter);
  state.hunting.encounter=event.encounter;state.health=event.health;
  if(event.outcome==='victory'){
    for(const [i,key] of ['strengthXp','agilityXp','vitalityXp'].entries())state.stats[key]=Math.min(100000000,state.stats[key]+enemy.xp[i]);
    if(state.depthsRun)clearDepthsStage(state.depthsRun,state.location);
    else{
      state.hunting[enemy.id==='beetle'?'beetleRespawnAt':'respawnAt']=now+enemy.respawn;
      state.huntingLoot[enemy.loot]=Math.min(1000000,(state.huntingLoot[enemy.loot]??0)+1);
      if(enemy.id==='beetle')state.depthsDiscovered=true;
      if(enemy.id==='boar'){recordQuest(state.quest,'boar');state.history.boarDefeated=true;}
    }
  }else if(event.outcome==='defeat'){
    state.depthsRun=null;state.hunting.recoveryUntil=now+boarRules.recovery;move(state,'hub',{x:8,y:12});
  }else if(event.outcome==='escaped'){
    if(state.depthsRun){
      const previous=depthsStages[state.depthsRun.cleared-1];
      if(previous)move(state,previous.room,{x:4,y:5});
      else{state.depthsRun=null;move(state,'ruins');}
    }else if(enemy.id==='beetle')move(state,'creek',{x:10,y:4});
    else move(state,'trail',{x:7,y:1});
  }
  return {...event,enemyId:enemy.id};
}

// Replay each due strike at its scheduled time. Closing or slowing the client
// cannot postpone enemy attacks or manufacture additional player strikes.
export function advanceServerCombat(state,now,random=Math.random){
  const events=[];
  for(let i=0;state.hunting.encounter&&i<2048;i++){
    const encounter=state.hunting.encounter;
    const due=Math.min(encounter.nextPlayerAt,encounter.nextBoarAt);
    if(due>now)break;
    const event=advanceHunt(encounter,state.health,state.stats,due,random,state.combatGear.equippedWeapon,state.combatGear.activeSwordUpgrade,state.combatGear.stonebackVestEquipped);
    if(!event)break;
    events.push(result(state,event,due));
  }
  if(events.length)state.combatReceipt={id:crypto.randomUUID(),events};
  return events;
}
export function settleActivities(state,now,random=Math.random){
  let changed=false;
  if(state.hunting?.encounter)changed=advanceServerCombat(state,now,random).length>0;
  if(state.hunting?.recoveryUntil&&now>=state.hunting.recoveryUntil){state.hunting.recoveryUntil=0;state.health=100;changed=true;}
  return changed;
}

export function activityAction(state,action,body,now,random){
  if(action==='axe'){
    idle(state);
    const npc=moonwood.layouts.logging.scenery.find(item=>item.type==='woodcutter');
    if(state.location!=='logging'||!adjacent(state,npc))throw new Error('Travel to the woodcutter for your free axe.');
    grantBasicAxe(state.woodcutting);return true;
  }
  if(action==='chop'||action==='cut'){
    idle(state);
    const tree=moonwood.layouts[state.location]?.scenery.find(item=>isTimberTree(item)&&item.x===body.x&&item.y===body.y);
    if(!tree||!adjacent(state,tree))throw new Error('Travel beside a tree before chopping.');
    const wood=state.woodcutting,key=state.location+':'+tree.x+','+tree.y;
    if(!wood.axeOwned||!wood.equipped)throw new Error('Choose your basic axe before chopping.');
    if(wood.timber>=1000000||timberTreeState(wood,now,key).regrowsAt)throw new Error('Invalid tree. Wait for regrowth or sell some timber.');
    if(action==='cut'){
      const cut=state.timberCut;
      if(!cut||cut.id!==body.cutId||cut.key!==key||now<cut.endsAt)throw new Error('Invalid cut timing. Finish chopping this tree first.');
      const amount=cutTimberTree(wood,now,key);
      state.timberReceipt={id:cut.id,key,amount};delete state.timberCut;
      if(timberTreeState(wood,now,key).regrowsAt)return true;
    }
    if(state.timberCut?.key!==key)state.timberCut={id:crypto.randomUUID(),key,started:now,endsAt:now+choppingDuration(wood)};
    return true;
  }
  if(action==='fight'){
    idle(state);
    const enemy=huntEnemyForRoom(state.location),index=depthsStageIndex(state.location);
    if(!enemy||!adjacent(state,{x:6,y:5}))throw new Error('Travel beside the creature before fighting.');
    if(!state.combatGear.equippedWeapon||!canUseWeapon(state.stats,state.combatGear.equippedWeapon))throw new Error('Choose a weapon you can use before fighting.');
    if(index>=0?state.depthsRun?.cleared!==index:now<huntRespawnAt(state.hunting,enemy))throw new Error('Invalid encounter. Wait for the creature to return.');
    delete state.timberCut;
    state.combatId=crypto.randomUUID();state.combatReceipt={id:crypto.randomUUID(),events:[]};
    state.hunting.encounter=createHunt(now,enemy.health,enemy.id);return true;
  }
  if(action==='combat'){
    if(body.combatId!==state.combatId)throw new Error('Invalid encounter. Reload your character.');
    const events=advanceServerCombat(state,now,random);
    if(state.hunting.encounter&&['dodge','flee','rootbind'].includes(body.input)){
      if(body.input==='rootbind'){
        state.adventure.rootstone??=normalizeRootstone();
        if(castRootbind(state.adventure.rootstone,state.hunting.encounter,now))events.push({action:'rootbind',outcome:'fighting',encounter:structuredClone(state.hunting.encounter),health:state.health,enemyId:huntEnemy(state.hunting.encounter).id});
      }else{
        const event=huntingTurn(state.hunting.encounter,state.health,state.stats,body.input,now,random,state.combatGear.equippedWeapon,state.combatGear.activeSwordUpgrade,state.combatGear.stonebackVestEquipped);
        if(event)events.push(result(state,event,now));
      }
    }
    state.combatReceipt={id:crypto.randomUUID(),events};return true;
  }
  if(action==='rest'||action==='recover'){
    if(action==='rest'){
      idle(state);
      if(!['home','hub'].includes(state.location))throw new Error('Travel to the Tower to rest.');
      if(state.health<100)state.hunting.recoveryUntil=now+boarRules.recovery;
    }else settleActivities(state,now,random);
    return true;
  }
  if(action==='depthsEnter'||action==='depthsNext'||action==='depthsLeave'){
    idle(state);delete state.timberCut;
    if(action==='depthsEnter'){
      if(state.location!=='ruins'||!state.depthsDiscovered||state.depthsRun||!state.combatGear.equippedWeapon)throw new Error('Invalid expedition entrance. Defeat the Stoneback Beetle first.');
      state.depthsRun={cleared:0};move(state,depthsStages[0].room,{x:4,y:5});
    }else if(action==='depthsNext'){
      const index=depthsStageIndex(state.location),next=depthsStages[index+1];
      if(index<0||!next||state.depthsRun?.cleared!==index+1)throw new Error('Invalid expedition. Clear this chamber first.');
      move(state,next.room,{x:4,y:5});
    }else{
      if(depthsStageIndex(state.location)<0||state.depthsRun?.cleared!==0)throw new Error('Choose bank spoils to leave this expedition.');
      state.depthsRun=null;move(state,'ruins');
    }
    return true;
  }
  if(action==='awaken'||action==='attune'){
    idle(state);
    state.adventure.rootstone??=normalizeRootstone();
    const stone=state.adventure.rootstone;
    if(action==='awaken'){
      if(stone.awakened||!Array.isArray(body.runes)||!canAwakenRootstone(state.adventure,state.location,body.runes))throw new Error('Invalid Rootstone awakening.');
      stone.awakened=true;
    }else{
      if(!stone.awakened||!Object.hasOwn(rootstonePowers,body.power)||!(state.location==='shrine'||state.location==='ruins'&&!stone.power))throw new Error('Travel to the shrine to attune your Rootstone.');
      stone.power=body.power;
    }
    return true;
  }
  return false;
}
