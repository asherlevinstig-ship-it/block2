import {playerMaxHealth} from '../public/food-buffs.js';
import {besideTrailCamp,trailCamp} from '../public/trail-camp.js';
import {normalizeVitals} from '../public/player-vitals.js';

const invalid=message=>Object.assign(new Error(message),{status:400});

export async function readTrailCamp(db){
  const row=await db.prepare('SELECT lit_until,revision FROM tower_trail_camp WHERE id=1').first();
  return {litUntil:row.lit_until,revision:row.revision};
}

export function requireTrailCamp(state){
  if(state.location!==trailCamp.room||!besideTrailCamp(state.position))throw invalid('Walk beside the Moonwell trail camp first.');
  if(state.characterCreated===false||state.plan||state.report||state.controlMode==='auto'||state.fishingCast||state.timberCut||state.hunting?.encounter||state.hunting?.recoveryUntil||state.health<=0||state.depthsRun||state.gambling?.round?.status==='playing'){
    throw invalid('Finish your current activity before using the camp.');
  }
}

export async function refuelTrailCamp(db,row,state,operation,now){
  requireTrailCamp(state);
  if(state.woodcutting.timber<trailCamp.fuelCost)throw invalid('Bring 2 timber in your bag to fuel the fire.');
  state.woodcutting.timber-=trailCamp.fuelCost;
  const mutation=crypto.randomUUID();
  for(let attempt=0;attempt<5;attempt++){
    const camp=await readTrailCamp(db);
    const until=Math.max(now,camp.litUntil)+trailCamp.burnMs;
    if(until>now+trailCamp.maxMs)throw invalid('The fire has plenty of fuel. Wait until it has 6 minutes or less left.');
    const [,saved]=await db.batch([
      db.prepare('UPDATE tower_trail_camp SET lit_until=?,revision=revision+1,mutation=? WHERE id=1 AND revision=? AND EXISTS (SELECT 1 FROM tower_players WHERE player_id=? AND revision=?) RETURNING id')
        .bind(until,mutation,camp.revision,row.player_id,row.revision),
      db.prepare('UPDATE tower_players SET state_json=?,revision=revision+1,last_request=?,updated_at=? WHERE player_id=? AND revision=? AND EXISTS (SELECT 1 FROM tower_trail_camp WHERE id=1 AND mutation=?) RETURNING *')
        .bind(JSON.stringify(state),operation,now,row.player_id,row.revision,mutation)
    ]);
    if(saved.results[0])return {updated:saved.results[0],camp:{litUntil:until,revision:camp.revision+1}};
    const current=await db.prepare('SELECT revision FROM tower_players WHERE player_id=?').bind(row.player_id).first();
    if(current?.revision!==row.revision)return null;
  }
  throw invalid('The fire just changed. Try adding timber again.');
}

export function startTrailCampRest(state,camp,now){
  requireTrailCamp(state);
  if(!(camp?.litUntil>=now+trailCamp.restMs))throw invalid('Add timber before resting. The fire needs to last another 12 seconds.');
  const endsAt=now+trailCamp.restMs;
  state.campRest={endsAt};
  state.hunting.recoveryUntil=endsAt;
}

export function settleTrailCampRest(state,now){
  if(!state.campRest||now<state.campRest.endsAt)return false;
  state.health=playerMaxHealth(state,now);state.vitals={...normalizeVitals(state.vitals),mana:100,manaAt:now};
  stopTrailCampRest(state);
  return true;
}

export function stopTrailCampRest(state){
  if(!state.campRest)return;
  delete state.campRest;
  state.hunting.recoveryUntil=0;
}
