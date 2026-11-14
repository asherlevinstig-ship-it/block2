import {waystationRoom,waystationSites} from '../public/waystation.js';
import {playerMaxHealth} from '../public/food-buffs.js';
import {manaAvailable,normalizeVitals} from '../public/player-vitals.js';
import {towerBread} from '../public/cooking.js';

const invalid=message=>Object.assign(new Error(message),{status:400});
export async function readWaystation(db){
 const row=await db.prepare(`SELECT
   COUNT(CASE WHEN site='fire' THEN 1 END) AS fire,
   COUNT(CASE WHEN site='supplies' THEN 1 END) AS supplies,
   (SELECT json_object('site',site,'name',name) FROM tower_waystation_donations ORDER BY rowid DESC LIMIT 1) AS last
   FROM tower_waystation_donations`).first();
 return {fire:row.fire,supplies:row.supplies,last:row.last?JSON.parse(row.last):null,revision:row.fire+row.supplies};
}
export async function useWaystation(db,row,state,body,now){
 const {site,kind,operation}=body;
 if(!Object.hasOwn(waystationSites,site))throw invalid('Choose a Waystation project.');
 const project=waystationSites[site],p=state.position;
 if(state.location!==waystationRoom||!p||Math.abs(p.x-project.x)+Math.abs(p.y-project.y)!==1)throw invalid('Walk beside the project first.');
 if(state.characterCreated===false||state.plan||state.report||state.controlMode==='auto'||state.autoDisconnected||state.health<=0
    ||state.fishingCast||state.timberCut||state.miningCut||state.gambling?.round?.status==='playing'
    ||state.hunting?.encounter||state.hunting?.recoveryUntil)throw invalid('Finish your current activity before using the Waystation.');
 if(kind==='donate'){
  const result=await db.prepare(`INSERT INTO tower_waystation_donations(player_id,operation,site,name,at)
   SELECT player_id,?,?,json_extract(state_json,'$.avatar.name'),? FROM tower_players
   WHERE player_id=? AND revision=? AND COALESCE(json_extract(state_json,'$.woodcutting.timber'),0)>0
   AND (SELECT COUNT(*) FROM tower_waystation_donations WHERE site=?)<?
   ON CONFLICT(player_id,operation) DO NOTHING RETURNING operation`)
   .bind(operation,site,now,row.player_id,row.revision,site,project.target).first();
  if(!result)throw invalid('Bring timber in your bag and choose a project that still needs it.');
  return db.prepare('SELECT * FROM tower_players WHERE player_id=?').bind(row.player_id).first();
 }
 if(kind!==(site==='fire'?'rest':'buy'))throw invalid('Choose a Waystation action.');
 const board=await readWaystation(db);
 if(board[site]<project.target)throw invalid('Finish rebuilding this project first.');
 if(kind==='rest'){
  const max=playerMaxHealth(state,now);
  if(state.health>=max&&manaAvailable(state.vitals,now)>=100)throw invalid('Your health and mana are already full.');
  state.health=max;
  state.vitals={...normalizeVitals(state.vitals),mana:100,manaAt:now};
 }else{
  const count=state.meals[towerBread.id]??0;
  if(state.credits<towerBread.price||count>=1000000)throw invalid('Bring '+towerBread.price+' gold and make room for bread.');
  state.credits-=towerBread.price;
  state.meals[towerBread.id]=count+1;
 }
 return db.prepare('UPDATE tower_players SET state_json=?,revision=revision+1,last_request=?,updated_at=? WHERE player_id=? AND revision=? RETURNING *')
  .bind(JSON.stringify(state),operation,now,row.player_id,row.revision).first();
}
