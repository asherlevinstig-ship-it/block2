export const depthsStages=[
  {room:'depthsGate',name:'Flooded Gate',enemy:'depthsBoar',gold:12,loot:'boar',lootName:'Boar Meat'},
  {room:'depthsGallery',name:'Shell Gallery',enemy:'depthsBeetle',gold:24,loot:'stonebackShell',lootName:'Shell Fragment'},
  {room:'depthsVault',name:'The Sunken Vault',enemy:'depthsGuardian',gold:45,loot:'stonebackShell',lootName:'Shell Fragment'}
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
  return {cleared:input.cleared};
}

export function clearDepthsStage(run,room){
  const index=depthsStageIndex(room);
  if(!run||index<0||index!==run.cleared)return false;
  run.cleared++;
  return true;
}

export function depthsSpoils(run){
  const loot={};
  let gold=0;
  for(const stage of depthsStages.slice(0,run?.cleared??0)){
    gold+=stage.gold;
    loot[stage.loot]=(loot[stage.loot]??0)+1;
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
