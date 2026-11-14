import {hallProjects} from '../public/faction-hall.js';
import {mealRecipes,silverfinSupper} from '../public/cooking.js';

const kitchenMeals={...mealRecipes,[silverfinSupper.id]:silverfinSupper};
const invalid=message=>Object.assign(new Error(message),{status:400});
const totalsSql="COALESCE(SUM(CASE WHEN d.resource='gold' THEN d.quantity END),0) AS gold,COALESCE(SUM(CASE WHEN d.resource='timber' THEN d.quantity END),0) AS timber,COALESCE(SUM(CASE WHEN d.resource='meal' THEN d.quantity END),0) AS meal";
const meets=(totals,project)=>Object.entries(project.targets).every(([resource,target])=>totals[resource]>=target);

export async function factionHallAccess(db,playerId){
  const row=await db.prepare(
    'SELECT m.faction_id AS id,'+totalsSql+' FROM tower_faction_members m LEFT JOIN tower_faction_donations d ON d.faction_id=m.faction_id WHERE m.player_id=? GROUP BY m.faction_id'
  ).bind(playerId).first();
  return row&&meets(row,hallProjects[0])?{id:row.id,kitchen:meets(row,hallProjects[1])}:null;
}

export async function readFactionProject(db,playerId,factionId){
  const {results}=await db.prepare(
    "SELECT COALESCE(json_extract(p.state_json,'$.avatar.name'),'Guest') AS name,d.player_id=? AS self,"+totalsSql+" FROM tower_faction_donations d JOIN tower_players p USING(player_id) WHERE d.faction_id=? GROUP BY d.player_id ORDER BY MIN(d.donated_at),d.player_id"
  ).bind(playerId,factionId).all();
  const totals={gold:0,timber:0,meal:0};
  for(const row of results)for(const resource of Object.keys(totals))totals[resource]+=row[resource];
  const stage=hallProjects.findIndex(project=>!meets(totals,project));
  const previous=stage>0?hallProjects[stage-1].targets:{gold:0,timber:0,meal:0};
  const current=hallProjects[stage];
  const progress=current?Object.fromEntries(Object.entries(current.targets).map(([id,target])=>[id,{value:totals[id]-previous[id],target:target-previous[id]}])):null;
  const {state_json}=await db.prepare('SELECT state_json FROM tower_players WHERE player_id=?').bind(playerId).first();
  const state=JSON.parse(state_json);
  return {open:stage!==0,kitchen:stage===-1,project:current?{name:current.name,reward:current.reward,progress}:null,
    contributors:results,stock:{gold:state.credits??0,timber:state.woodcutting?.timber??0},
    meals:Object.entries(kitchenMeals).map(([id,item])=>({id,name:item.name,stock:state.meals?.[id]??0}))};
}

export async function donateFactionProject(db,playerId,body,now){
  const {resource,meal,quantity,operation,id}=body;
  const path=resource==='gold'?'$.credits':resource==='timber'?'$.woodcutting.timber':resource==='meal'&&Object.hasOwn(kitchenMeals,meal)?'$.meals.'+meal:null;
  if(!path||!Number.isSafeInteger(quantity)||quantity<1||quantity>800||typeof operation!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(operation)||typeof id!=='string')throw invalid('Choose a valid faction donation.');
  const first=hallProjects[0].targets,second=hallProjects[1].targets;
  const result=await db.prepare(
    'INSERT INTO tower_faction_donations (faction_id,player_id,operation,resource,inventory_path,quantity,donated_at) '+
    'SELECT m.faction_id,p.player_id,?,?,?,?,? FROM tower_faction_members m JOIN tower_players p USING(player_id) '+
    'CROSS JOIN (SELECT '+totalsSql+' FROM tower_faction_donations d WHERE d.faction_id=?) t '+
    "WHERE p.player_id=? AND m.faction_id=? AND COALESCE(json_extract(p.state_json,?),0)>=? AND json_extract(p.state_json,'$.plan') IS NULL AND json_extract(p.state_json,'$.report') IS NULL "+
    "AND (CASE WHEN t.gold>=? AND t.timber>=? AND t.meal>=? THEN ? ELSE ? END) - (CASE ? WHEN 'gold' THEN t.gold WHEN 'timber' THEN t.timber ELSE t.meal END) >= ? "+
    'ON CONFLICT(player_id,operation) DO NOTHING'
  ).bind(operation,resource,path,quantity,now,id,playerId,id,path,quantity,first.gold,first.timber,first.meal,second[resource],first[resource],resource,quantity).run();
  if(!result.meta.changes){
    const retry=await db.prepare('SELECT 1 AS ok FROM tower_faction_donations WHERE player_id=? AND operation=? AND faction_id=? AND resource=? AND inventory_path=? AND quantity=?').bind(playerId,operation,id,resource,path,quantity).first();
    if(!retry)throw invalid('Donation could not be made. Check the project’s remaining needs and your bag, then refresh.');
  }
}
