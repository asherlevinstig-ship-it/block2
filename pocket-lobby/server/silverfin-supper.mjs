import {foodStall,silverfinSupper} from '../public/cooking.js';
import {fishProducts} from '../public/fishing.js';

const invalid=message=>Object.assign(new Error(message),{status:400});
const eligible=`json_extract(p.state_json,'$.location')='bakery'
  AND abs(json_extract(p.state_json,'$.position.x')-${foodStall.x})+abs(json_extract(p.state_json,'$.position.y')-${foodStall.y})=1
  AND json_extract(p.state_json,'$.plan') IS NULL AND json_extract(p.state_json,'$.report') IS NULL
  AND json_extract(p.state_json,'$.hunting.encounter') IS NULL
  AND COALESCE(json_extract(p.state_json,'$.controlMode'),'play')='play'
  AND json_extract(p.state_json,'$.health')>0`;
const countPath='$.meals.'+silverfinSupper.id;
const mealRoom=`COALESCE(json_extract(p.state_json,'${countPath}'),0)<1000000`;

export function saveSilverfinSupper(db,id,first,second,now){
  return db.prepare('INSERT INTO tower_silverfin_suppers VALUES (?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,first,second,now);
}

export async function readSilverfinSupper(db,id,now){
  const row=await db.prepare(`SELECT s.id,s.created_at,
    CASE WHEN s.first_id=? THEN second_id ELSE first_id END AS partner_id,
    EXISTS(SELECT 1 FROM tower_supper_fish c WHERE c.supper_id=s.id AND c.player_id=?) AS contributed,
    EXISTS(SELECT 1 FROM tower_supper_gifts g WHERE g.supper_id=s.id AND g.sender_id=?) AS gifted,
    (SELECT COUNT(*) FROM tower_supper_fish c WHERE c.supper_id=s.id) AS count
    FROM tower_silverfin_suppers s WHERE (first_id=? OR second_id=?)
    AND (created_at>? OR (SELECT COUNT(*) FROM tower_supper_fish c WHERE c.supper_id=s.id)=1)
    ORDER BY (SELECT COUNT(*) FROM tower_supper_fish c WHERE c.supper_id=s.id)=1 DESC, created_at DESC LIMIT 1`)
    .bind(id,id,id,id,id,now-86400000).first();
  if(!row)return null;
  const partner=await db.prepare(`SELECT json_extract(p.state_json,'$.avatar.name') AS name,(${eligible}) AS ready
    FROM tower_players p WHERE p.player_id=?`).bind(row.partner_id).first();
  return {id:row.id,partner:partner?.name??'Your partner',partnerReady:!!partner?.ready,contributed:!!row.contributed,count:row.count,gifted:!!row.gifted};
}

export async function contributeSilverfinSupper(db,row,id,fish,now){
  if(!Object.hasOwn(fishProducts,fish)||!fish.startsWith('silverfin')||typeof id!=='string')throw invalid('Choose a Silverfin from your bag.');
  const path='$.fishStock.'+fish;
  const saved=await db.prepare(`INSERT INTO tower_supper_fish(supper_id,player_id,fish_path,at)
    SELECT s.id,p.player_id,?,? FROM tower_silverfin_suppers s JOIN tower_players p ON p.player_id=?
    WHERE s.id=? AND p.revision=? AND p.player_id IN (s.first_id,s.second_id)
      AND COALESCE(json_extract(p.state_json,?),0)>0 AND ${eligible} AND ${mealRoom}
      AND (s.created_at>? OR EXISTS(SELECT 1 FROM tower_supper_fish c WHERE c.supper_id=s.id))
      AND EXISTS(SELECT 1 FROM tower_players p WHERE p.player_id=CASE WHEN s.first_id=? THEN s.second_id ELSE s.first_id END AND ${eligible} AND ${mealRoom})
    ON CONFLICT(supper_id,player_id) DO NOTHING RETURNING supper_id`)
    .bind(path,now,row.player_id,id,row.revision,path,now-86400000,row.player_id).first();
  if(saved)return;
  const retry=await db.prepare('SELECT 1 AS ok FROM tower_supper_fish WHERE supper_id=? AND player_id=?').bind(id,row.player_id).first();
  if(!retry)throw invalid('Both anglers must stand beside the baker in Play mode with room for a meal. Bring a Silverfin to contribute.');
}

export async function giftSilverfinSupper(db,row,id,now){
  if(typeof id!=='string')throw invalid('Choose a completed supper.');
  const result=await db.prepare(`INSERT INTO tower_supper_gifts(supper_id,sender_id,recipient_id,at)
    SELECT s.id,p.player_id,q.player_id,?
    FROM tower_silverfin_suppers s JOIN tower_players p ON p.player_id=?
    JOIN tower_players q ON q.player_id=CASE WHEN s.first_id=p.player_id THEN s.second_id ELSE s.first_id END
    WHERE s.id=? AND p.revision=? AND p.player_id IN (s.first_id,s.second_id)
      AND s.created_at>?
      AND (SELECT COUNT(*) FROM tower_supper_fish c WHERE c.supper_id=s.id)=2
      AND ${eligible} AND ${eligible.replaceAll('p.state_json','q.state_json')}
      AND COALESCE(json_extract(p.state_json,'${countPath}'),0)>0
      AND ${mealRoom.replaceAll('p.state_json','q.state_json')}
    ON CONFLICT(supper_id,sender_id) DO NOTHING RETURNING supper_id`)
    .bind(now,row.player_id,id,row.revision,now-86400000).first();
  if(result)return;
  const retry=await db.prepare('SELECT 1 AS ok FROM tower_supper_gifts WHERE supper_id=? AND sender_id=?').bind(id,row.player_id).first();
  if(!retry)throw invalid('Bring a supper and meet your partner beside the baker to share it.');
}
