export const moonwellShard={id:'moonwellShard',name:'Moonwell Shard',price:100};

export const depthsStages=[
  {room:'depthsGate',name:'Flooded Gate',enemy:'depthsBoar',gold:12,loot:'boar'},
  {room:'depthsGallery',name:'Shell Gallery',enemy:'depthsBeetle',gold:24,loot:'stonebackShell'},
  {room:'depthsVault',name:'The Sunken Vault',enemy:'depthsGuardian',gold:45,loot:'stonebackShell',treasure:moonwellShard.id}
];

export const depthsStageIndex=room=>depthsStages.findIndex(stage=>stage.room===room);

export function canVisitDepthsStage(run,index){
  return !!run&&index>=0&&index<depthsStages.length&&(index===run.cleared||index===run.cleared-1);
}

export function normalizeDepthsRun(input,room,encounter){
  const index=depthsStageIndex(room);
  if(input==null&&index<0)return null;
  if(!Number.isInteger(input?.cleared)||!canVisitDepthsStage(input,index))throw new Error('Invalid Moonwell Depths progress.');
  if(encounter&&(index!==input.cleared||encounter.enemy!==depthsStages[index].enemy))throw new Error('Invalid Moonwell Depths encounter.');
  return {cleared:input.cleared,...(input.cleared===depthsStages.length&&input.shardEarned===true?{shardEarned:true}:{})};
}

export function clearDepthsStage(run,room,awardTreasure=true){
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
  let gold=0;
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
  if(!canVisitDepthsStage(depthsRun,index)||index>=depthsRun.cleared||health<=0||hunting?.encounter)throw new Error('Clear this chamber before banking its spoils.');
  const spoils=depthsSpoils(depthsRun);
  if(credits+spoils.gold>100000000||Object.entries(spoils.loot).some(([id,count])=>(huntingLoot[id]??0)+count>1000000))throw new Error('Make room before banking your spoils.');
  for(const [id,count] of Object.entries(spoils.loot))huntingLoot[id]=(huntingLoot[id]??0)+count;
  state.credits+=spoils.gold;
  state.depthsRun=null;
  state.location='ruins';
  state.position={x:5,y:7};
  return spoils;
}
