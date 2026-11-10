import {guildFeast} from '../public/faction-hall.js';
import {fishProducts} from '../public/fishing.js';
import {factionHallAccess} from './faction-projects.mjs';
const dayAt=now=>Math.floor(now/86400000);
const invalid=message=>Object.assign(new Error(message),{status:400});
export async function readGuildFeast(db,playerId,id,now=Date.now()){
 const day=dayAt(now);
 const {results}=await db.prepare("SELECT COALESCE(json_extract(p.state_json,'$.avatar.name'),'Guest') AS name,d.player_id=? AS self,d.resource,SUM(d.quantity) AS quantity FROM tower_feast_supplies d JOIN tower_players p USING(player_id) WHERE d.faction_id=? AND d.day=? GROUP BY d.player_id,d.resource ORDER BY name,d.resource").bind(playerId,id,day).all();
 const totals={gold:0,timber:0,fish:0};for(const row of results)totals[row.resource]+=row.quantity;
 const claimed=!!await db.prepare('SELECT 1 FROM tower_feast_claims WHERE player_id=? AND day=?').bind(playerId,day).first();
 const {state_json}=await db.prepare('SELECT state_json FROM tower_players WHERE player_id=?').bind(playerId).first();const state=JSON.parse(state_json);
 return {day,until:(day+1)*86400000,targets:guildFeast.targets,totals,ready:Object.entries(guildFeast.targets).every(([key,n])=>totals[key]>=n),claimed,contributors:results,
 stock:{gold:state.credits??0,timber:state.woodcutting?.timber??0},fish:Object.entries(fishProducts).filter(([id])=>(state.fishStock?.[id]??0)>0).map(([id,item])=>({id,name:item.name,stock:state.fishStock[id]})),inHall:state.location==='factionHall',hunger:state.vitals?.hunger??100};
}
export async function changeGuildFeast(db,playerId,body,now){
 const {id,operation,resource,fish,quantity}=body;
 if(typeof id!=='string'||typeof operation!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(operation))throw invalid('Refresh the feast board and try again.');
 const access=await factionHallAccess(db,playerId);if(access?.id!==id)throw invalid('Build and join this faction hall first.');
 const day=dayAt(now);
 const eligible="p.player_id=? AND m.faction_id=? AND json_extract(p.state_json,'$.location')='factionHall' AND json_extract(p.state_json,'$.plan') IS NULL AND json_extract(p.state_json,'$.report') IS NULL";
 if(body.action==='feastDonate'){
  const path=resource==='gold'?'$.credits':resource==='timber'?'$.woodcutting.timber':resource==='fish'&&Object.hasOwn(fishProducts,fish)?'$.fishStock.'+fish:null;
  if(!path||!Number.isSafeInteger(quantity)||quantity<1||quantity>100)throw invalid('Choose supplies from your bag.');
  const result=await db.prepare('INSERT INTO tower_feast_supplies(faction_id,day,player_id,operation,resource,inventory_path,quantity,donated_at) SELECT ?,?,p.player_id,?,?,?,?,? FROM tower_players p JOIN tower_faction_members m USING(player_id) WHERE '+eligible+' AND COALESCE(json_extract(p.state_json,?),0)>=? AND ?-(SELECT COALESCE(SUM(quantity),0) FROM tower_feast_supplies WHERE faction_id=? AND day=? AND resource=?)>=? ON CONFLICT(player_id,operation) DO NOTHING').bind(id,day,operation,resource,path,quantity,now,playerId,id,path,quantity,guildFeast.targets[resource],id,day,resource,quantity).run();
  if(!result.meta.changes){const retry=await db.prepare('SELECT 1 FROM tower_feast_supplies WHERE player_id=? AND operation=? AND faction_id=? AND day=? AND resource=? AND inventory_path=? AND quantity=?').bind(playerId,operation,id,day,resource,path,quantity).first();if(!retry)throw invalid('Visit the hall and check your supplies and the remaining target.');}
 }else{
  const result=await db.prepare("INSERT INTO tower_feast_claims(player_id,day,faction_id,operation,claimed_at) SELECT p.player_id,?,?,?,? FROM tower_players p JOIN tower_faction_members m USING(player_id) WHERE "+eligible+" AND COALESCE(json_extract(p.state_json,'$.vitals.hunger'),100)<100 AND (SELECT COALESCE(SUM(quantity),0) FROM tower_feast_supplies WHERE faction_id=? AND day=? AND resource='gold')>=100 AND (SELECT COALESCE(SUM(quantity),0) FROM tower_feast_supplies WHERE faction_id=? AND day=? AND resource='timber')>=20 AND (SELECT COALESCE(SUM(quantity),0) FROM tower_feast_supplies WHERE faction_id=? AND day=? AND resource='fish')>=10 ON CONFLICT(player_id,day) DO NOTHING").bind(day,id,operation,now,playerId,id,id,day,id,day,id,day).run();
  if(!result.meta.changes){const retry=await db.prepare('SELECT 1 FROM tower_feast_claims WHERE player_id=? AND day=? AND faction_id=? AND operation=?').bind(playerId,day,id,operation).first();if(!retry)throw invalid('The feast needs all supplies. Visit the hall when hungry; one meal per day.');}
 }
}
