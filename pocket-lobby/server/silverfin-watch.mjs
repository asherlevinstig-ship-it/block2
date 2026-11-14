const dayAt = now => Math.floor(now / 86400000);
export const silverfinTarget = 2;

export async function readSilverfinWatch(db,id,now=Date.now()){
  const day=dayAt(now);
  const {results}=await db.prepare(
    'SELECT w.name,w.player_id=? AS self,f.name AS faction FROM tower_silverfin_watch w LEFT JOIN tower_factions f USING(faction_id) WHERE day=? ORDER BY w.player_id LIMIT 2'
  ).bind(id,day).all();
  return {day,target:silverfinTarget,contributors:results,complete:results.length===silverfinTarget};
}

export function silverfinContribution(db,id,state,now){
  return db.prepare(
    'INSERT INTO tower_silverfin_watch(day,player_id,faction_id,name) '+
    'SELECT ?,?,(SELECT faction_id FROM tower_faction_members WHERE player_id=?),? '+
    'WHERE changes()=1 AND (SELECT COUNT(*) FROM tower_silverfin_watch WHERE day=?)<? '+
    'ON CONFLICT(day,player_id) DO NOTHING RETURNING day'
  ).bind(dayAt(now),id,id,state.avatar.name,dayAt(now),silverfinTarget);
}

export async function readFactionSilverfin(db,factionId,now=Date.now()){
  const row=await db.prepare(
    'SELECT COUNT(*) AS total, SUM(CASE WHEN day=? THEN 1 ELSE 0 END) AS today FROM tower_silverfin_watch WHERE faction_id=?'
  ).bind(dayAt(now),factionId).first();
  return {total:row.total,today:row.today??0};
}
