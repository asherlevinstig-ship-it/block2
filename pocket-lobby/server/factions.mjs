const CAPACITY=20;
const invalid=message=>Object.assign(new Error(message),{status:400});
const clean=(value,max)=>typeof value==='string'&&value.length<=max&&!/[\p{Cc}\u202a-\u202e\u2066-\u2069]/u.test(value)?value.trim().replace(/ +/g,' '):null;

export async function readFactions(db,playerId,search=''){
  const query=typeof search==='string'?search.trim().toLowerCase().slice(0,32):'';
  const membership=await db.prepare(
    'SELECT f.faction_id AS id, f.name, f.description, f.leader_id = ? AS leader FROM tower_faction_members m JOIN tower_factions f USING (faction_id) WHERE m.player_id = ?'
  ).bind(playerId,playerId).first();
  const roster=membership?await db.prepare(
    "SELECT m.member_id AS id, COALESCE(json_extract(p.state_json, '$.avatar.name'),'Guest') AS name, m.player_id = f.leader_id AS leader, m.player_id = ? AS self FROM tower_faction_members m JOIN tower_players p USING (player_id) JOIN tower_factions f USING (faction_id) WHERE m.faction_id = ? ORDER BY leader DESC, m.joined_at, m.member_id"
  ).bind(playerId,membership.id).all():null;
  const directory=await db.prepare(
    'SELECT f.faction_id AS id, f.name, f.description, COUNT(m.player_id) AS size FROM tower_factions f JOIN tower_faction_members m USING (faction_id) WHERE instr(f.name_key, ?) > 0 GROUP BY f.faction_id ORDER BY f.name_key LIMIT 50'
  ).bind(query).all();
  return {capacity:CAPACITY,factions:directory.results,membership:membership?{...membership,roster:roster.results}:null};
}

export async function changeFaction(db,playerId,body,now=Date.now()){
  const character=await db.prepare("SELECT json_extract(state_json, '$.characterCreated') AS created FROM tower_players WHERE player_id = ?").bind(playerId).first();
  if(!character||character.created===0)throw invalid('Finish creating your character first.');
  let result;
  if(body.action==='create'){
    const name=clean(body.name,32),description=clean(body.description??'',160);
    if(!name||name.length<3||!/[\p{L}\p{N}]/u.test(name)||description===null)throw invalid('Choose a faction name of 3–32 characters and a description of up to 160.');
    result=await db.prepare(
      'INSERT INTO tower_factions (faction_id,name,name_key,description,leader_id,created_at) SELECT ?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM tower_faction_members WHERE player_id=?) ON CONFLICT(name_key) DO NOTHING'
    ).bind(crypto.randomUUID(),name,name.normalize('NFKC').toLowerCase(),description,playerId,now,playerId).run();
    if(!result.meta.changes)throw invalid('That name is taken or you already belong to a faction.');
  }else if(body.action==='join'){
    const factionId=clean(body.id,36);
    if(!factionId)throw invalid('Choose a faction to join.');
    result=await db.prepare(
      'INSERT INTO tower_faction_members (player_id,member_id,faction_id,joined_at) SELECT ?,?,faction_id,? FROM tower_factions f WHERE faction_id=? AND (SELECT COUNT(*) FROM tower_faction_members m WHERE m.faction_id=f.faction_id) < ? ON CONFLICT(player_id) DO NOTHING'
    ).bind(playerId,crypto.randomUUID(),now,factionId,CAPACITY).run();
    if(!result.meta.changes)throw invalid('That faction is full, no longer exists, or you already belong to one.');
  }else if(body.action==='leave'){
    result=await db.prepare('DELETE FROM tower_faction_members WHERE player_id=? AND faction_id IN (SELECT faction_id FROM tower_factions WHERE leader_id<>?)').bind(playerId,playerId).run();
    if(!result.meta.changes)throw invalid('Transfer leadership before leaving, or disband if you are the only member.');
  }else if(body.action==='transfer'){
    const memberId=clean(body.id,36);
    if(!memberId)throw invalid('Choose a member to lead.');
    result=await db.prepare(
      'UPDATE tower_factions AS f SET leader_id=(SELECT m.player_id FROM tower_faction_members m WHERE m.member_id=? AND m.faction_id=f.faction_id) WHERE leader_id=? AND EXISTS (SELECT 1 FROM tower_faction_members m WHERE m.member_id=? AND m.faction_id=f.faction_id AND m.player_id<>?)'
    ).bind(memberId,playerId,memberId,playerId).run();
    if(!result.meta.changes)throw invalid('Only the leader can transfer leadership to another member.');
  }else if(body.action==='disband'){
    result=await db.prepare(
      'DELETE FROM tower_factions AS f WHERE leader_id=? AND (SELECT COUNT(*) FROM tower_faction_members m WHERE m.faction_id=f.faction_id)=1'
    ).bind(playerId).run();
    if(!result.meta.changes)throw invalid('Only a leader who is the last member can disband a faction.');
  }else throw invalid('Choose a faction action.');
  return readFactions(db,playerId);
}
