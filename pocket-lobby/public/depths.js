import {normalizeMagic,awardAwakeningStone,stoneForms} from './essences.js';

export const essenceCacheGold=50;
export const depthsSafePassage={gold:10,healing:20};
export const depthsCacheRoom='depthsCache';
export const moonwellShard={id:'moonwellShard',name:'Moonwell Shard',price:100};

export const depthsStages=[
  {room:'depthsGate',name:'Flooded Gate',enemy:'depthsBoar',gold:12,loot:'boar'},
  {room:'depthsGallery',name:'Shell Gallery',enemy:'depthsBeetle',gold:24,loot:'stonebackShell'},
  {room:'depthsVault',name:'The Sunken Vault',enemy:'depthsGuardian',gold:45,loot:'stonebackShell',treasure:moonwellShard.id}
];

export const depthsFinds={
  essenceCache:{label:'Essence Cache',title:'An ancient Essence Cache',room:depthsCacheRoom,text:'The guardian’s seal has broken. Gold and an Awakening Stone wait inside.'},
  sluiceLever:{label:'Sluice lever',title:'The old sluice',room:'depthsGate',text:'The channel drops below an old stone crossing. A supply chest waits on the far bank.'},
  gateSupply:{label:'Supply chest',title:'A dry supply chest',room:'depthsGate',requires:'sluiceLever',healing:15,text:'A sealed flask of spring water survived the flood.'},
  shellChime:{label:'Shell chime',title:'A chime in the dark',room:'depthsGallery',text:'The hollow shell rings. Green light traces a hidden cache across the gallery.'},
  galleryCache:{label:'Hidden cache',title:'The gallery’s hidden cache',room:'depthsGallery',requires:'shellChime',gold:18,text:'You found 18 gold. It is held with your expedition spoils until you bank them.'},
  vaultRelief:{label:'Vault relief',title:'A warning carved in stone',room:'depthsVault',text:'When wounded, the Guardian can call a Vault Quake. Dodge as it lands, then watch for the Aftershock. Each hit has its own warning.'}
};

export function inspectDepthsFind(state,item){
  const {depthsRun,location,position}=state;
  const find=item&&Object.hasOwn(depthsFinds,item.type)?depthsFinds[item.type]:null;
  if(!depthsRun||!find||find.room!==location||!position||Math.abs(position.x-item.x)+Math.abs(position.y-item.y)!==1){
    throw new Error('Travel beside the discovery to examine it.');
  }
  const found=depthsRun.finds??[];
  if(find.requires&&!found.includes(find.requires))throw new Error('Choose a discovery you can reach.');
  if(found.includes(item.type))return;
  if(item.type==='essenceCache'){
    if(!depthsRun.cacheGuardDefeated)throw new Error('Defeat the Cache Guardian to break the seal.');
    if(state.credits+essenceCacheGold>100000000)throw new Error('Make room in your wallet before opening the cache.');
    const magic=normalizeMagic(state.magic);
    const stone=awardAwakeningStone(magic);
    if(!stone)throw new Error('Make room for an Awakening Stone before opening the cache.');
    state.magic=magic;
    state.credits+=essenceCacheGold;
    state.goldEarned=Math.min(Number.MAX_SAFE_INTEGER,(state.goldEarned??0)+essenceCacheGold);
    depthsRun.cacheStone=stone;
  }
  if(find.healing){
    if(state.health>=100)throw new Error('Your hearts are already full. The flask is here if you need it later.');
    state.health=Math.min(100,state.health+find.healing);
  }
  depthsRun.finds=[...found,item.type];
}

export function chooseDepthsPassage(state,choice){
  const run=state.depthsRun;
  if(state.location!=='depthsGate'||run?.cleared!==1||run.routeChoice!=='pending'||!['safe','dangerous'].includes(choice))throw new Error('Choose an available passage after clearing Flooded Gate.');
  if(choice==='safe'){
    if(state.credits+depthsSafePassage.gold>100000000)throw new Error('Make room in your wallet before taking the safe passage.');
    state.health=Math.min(100,state.health+depthsSafePassage.healing);
    state.credits+=depthsSafePassage.gold;
    state.goldEarned=Math.min(Number.MAX_SAFE_INTEGER,(state.goldEarned??0)+depthsSafePassage.gold);
  }
  run.routeChoice=choice;
  state.location=choice==='safe'?'depthsGallery':depthsCacheRoom;
  state.position=choice==='safe'?{x:4,y:5}:{x:3,y:5};
}
export function canEnterDepthsCache(run,room){
  if(!run||['pending','safe'].includes(run.routeChoice))return false;
  if(run.routeChoice==='dangerous'&&run.cleared===1)return room==='depthsGate'||room==='depthsGallery'&&run.cacheGuardDefeated===true;
  return room==='depthsGallery'&&run.cleared===2;
}
export function depthsCacheReturn(run){
  return run?.routeChoice==='dangerous'&&run.cleared===1&&!run.cacheGuardDefeated?'depthsGate':'depthsGallery';
}
// The cache chamber is an optional branch and never advances the main route.

export const depthsStageIndex=room=>room===depthsCacheRoom?1:depthsStages.findIndex(stage=>stage.room===room);
export function depthsEnemyAvailable(run,room){
  return room===depthsCacheRoom?canVisitDepthsRoom(run,room)&&!run.cacheGuardDefeated:!!run&&depthsStageIndex(room)===run.cleared;
}
export function canVisitDepthsRoom(run,room){
  if(room===depthsCacheRoom)return !!run&&(run.cleared===2||run.cleared===1&&run.routeChoice==='dangerous')&&!['safe','pending'].includes(run.routeChoice);
  return canVisitDepthsStage(run,depthsStageIndex(room));
}

export function canVisitDepthsStage(run,index){
  return !!run&&index>=0&&index<depthsStages.length&&(index===run.cleared||index===run.cleared-1);
}

export function normalizeDepthsRun(input,room,encounter){
  const index=depthsStageIndex(room);
  if(input==null&&index<0)return null;
  if(input?.routeChoice!==undefined&&!['pending','safe','dangerous'].includes(input.routeChoice))throw new Error('Invalid dungeon passage.');
  if(input?.routeChoice==='pending'&&(input.cleared>1||room!=='depthsGate'))throw new Error('Invalid unchosen dungeon passage.');
  if(!Number.isInteger(input?.cleared)||!canVisitDepthsRoom(input,room))throw new Error('Invalid Moonwell Depths progress.');
  if(encounter&&(!depthsEnemyAvailable(input,room)||encounter.enemy!==(room===depthsCacheRoom?'cacheGuardian':depthsStages[index].enemy)))throw new Error('Invalid Moonwell Depths encounter.');
  const finds=[...new Set(Array.isArray(input.finds)?input.finds.filter(id=>Object.hasOwn(depthsFinds,id)):[])];
  return {cleared:input.cleared,...(input.routeChoice!==undefined?{routeChoice:input.routeChoice}:{}),...(input.cleared===depthsStages.length&&input.shardEarned===true?{shardEarned:true}:{}),...(finds.length?{finds}:{}),
    ...(input.cacheGuardDefeated===true?{cacheGuardDefeated:true}:{}),
    ...(finds.includes('essenceCache')&&Object.hasOwn(stoneForms,input.cacheStone)?{cacheStone:input.cacheStone}:{})};
}

export function clearDepthsStage(run,room,awardTreasure=true){
  if(room===depthsCacheRoom){
    if(!depthsEnemyAvailable(run,room))return false;
    run.cacheGuardDefeated=true;return true;
  }
  const index=depthsStageIndex(room);
  if(!run||index<0||index!==run.cleared)return false;
  run.cleared++;
  if(awardTreasure&&depthsStages[index].treasure)run.shardEarned=true;
  return true;
}

export function depthsStageSpoils(stage,includeTreasure=true){
  const loot={[stage.loot]:1};
  if(stage.treasure&&includeTreasure)loot[stage.treasure]=1;
  return {gold:stage.gold,loot};
}

export function depthsSpoils(run){
  const loot={};
  let gold=run?.finds?.includes('galleryCache')?depthsFinds.galleryCache.gold:0;
  for(const stage of depthsStages.slice(0,run?.cleared??0)){
    const reward=depthsStageSpoils(stage,run.shardEarned===true);
    gold+=reward.gold;
    for(const [id,count] of Object.entries(reward.loot))loot[id]=(loot[id]??0)+count;
  }
  return {gold,loot};
}

export function bankDepthsSpoils(state){
  const {depthsRun,location,health,hunting,credits,huntingLoot}=state;
  const index=depthsStageIndex(location);
  if(!canVisitDepthsRoom(depthsRun,location)||(location!==depthsCacheRoom&&index>=depthsRun.cleared)||health<=0||hunting?.encounter)throw new Error('Clear this chamber before banking its spoils.');
  const spoils=depthsSpoils(depthsRun);
  if(credits+spoils.gold>100000000||Object.entries(spoils.loot).some(([id,count])=>(huntingLoot[id]??0)+count>1000000))throw new Error('Make room before banking your spoils.');
  for(const [id,count] of Object.entries(spoils.loot))huntingLoot[id]=(huntingLoot[id]??0)+count;
  state.credits+=spoils.gold;
  state.depthsRun=null;
  state.location='ruins';
  state.position={x:5,y:7};
  return spoils;
}
