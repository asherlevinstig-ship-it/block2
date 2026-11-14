import {fishProducts} from '../public/fishing.js';
import {foodItems} from '../public/cooking.js';
import {publicRoomNamespace} from './shared-trees.mjs';
import {socialRooms} from '../public/shared-world.js';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const catalog={fish:fishProducts,meal:foodItems};
const bags={fish:'fishStock',meal:'meals'};
export async function readGift(db,id,operation){
  const row=await db.prepare('SELECT receipt FROM tower_gifts WHERE sender_id=? AND operation=?').bind(id,operation).first();
  return row?JSON.parse(row.receipt):null;
}

export async function sendGift(env,row,body,now=Date.now()){
  const {kind,item,quantity,target,operation}=body;
  if(!Object.hasOwn(catalog,kind)||!Object.hasOwn(catalog[kind],item)||!Number.isInteger(quantity)||quantity<1||quantity>10||typeof target!=='string'||!/^[a-f0-9]{24}$/.test(target)||!operation)throw fail('Choose up to 10 of a fish or meal and a nearby player.');
  const db=env.TOWER_DB;
  const prior=await readGift(db,row.player_id,operation);
  if(prior)return {updated:row,receipt:prior};
  const sender=JSON.parse(row.state_json),room=sender.location,bag=bags[kind];
  const ready=s=>s.characterCreated!==false&&!s.autoDisconnected&&s.controlMode!=='auto'&&!s.plan&&!s.report&&s.health>0&&!s.hunting?.encounter&&!s.hunting?.recoveryUntil&&!s.fishingCast&&!s.timberCut&&!s.miningCut&&s.gambling?.round?.status!=='playing';
  if(!ready(sender)||!env.SHARED_ROOMS||!Object.hasOwn(socialRooms,room)||['home','factionHall'].includes(room))throw fail('Finish your activity and choose a nearby player in a public room.');
  if((sender[bag]?.[item]??0)<quantity)throw fail('You do not have that many in your bag.');
  const stub=env.SHARED_ROOMS.get(env.SHARED_ROOMS.idFromName(publicRoomNamespace(room)));
  const response=await stub.fetch(new Request('https://room.internal/gift-target',{method:'POST',body:JSON.stringify({playerId:row.player_id,target,room})}));
  if(!response.ok)throw fail('Stand within one tile of a visible player in Play mode.');
  const {playerId}=await response.json();
  if(typeof playerId!=='string'||playerId===row.player_id)throw fail('Choose another player.');
  const recipientRow=await db.prepare('SELECT * FROM tower_players WHERE player_id=?').bind(playerId).first();
  if(!recipientRow)throw fail('This player has left.');
  const recipient=JSON.parse(recipientRow.state_json);
  if(recipient.location!==room||!ready(recipient))throw fail('This player is busy or has moved. Try again when they are nearby.');
  recipient[bag]??={};
  const held=recipient[bag][item]??0;
  if(held+quantity>1000000)throw fail('This player has no room for that gift.');
  sender[bag][item]-=quantity;
  recipient[bag][item]=held+quantity;
  const receipt={id:operation,item,kind,quantity,label:catalog[kind][item].name,from:sender.avatar.name,to:recipient.avatar.name};
  const transfer=db.prepare(`WITH eligible AS MATERIALIZED (
    SELECT COUNT(*) AS n FROM tower_players WHERE (player_id=? AND revision=?) OR (player_id=? AND revision=?)
  ) UPDATE tower_players SET state_json=CASE WHEN player_id=? THEN ? ELSE ? END,
  revision=revision+1,last_request=CASE WHEN player_id=? THEN ? ELSE ? END,updated_at=?
  WHERE player_id IN (?,?) AND (SELECT n FROM eligible)=2
  AND NOT EXISTS(SELECT 1 FROM tower_gifts WHERE sender_id=? AND operation=?) RETURNING *`)
    .bind(row.player_id,row.revision,playerId,recipientRow.revision,row.player_id,JSON.stringify(sender),JSON.stringify(recipient),row.player_id,operation,'gifted:'+operation,now,row.player_id,playerId,row.player_id,operation);
  const record=db.prepare('INSERT INTO tower_gifts SELECT ?,?,? WHERE changes()=2 RETURNING operation').bind(row.player_id,operation,JSON.stringify(receipt));
  const [saved]=await db.batch([transfer,record]);
  if(!saved.results.length){
    const retry=await readGift(db,row.player_id,operation);
    if(retry){const updated=await db.prepare('SELECT * FROM tower_players WHERE player_id=?').bind(row.player_id).first();return {updated,receipt:retry};}
    throw fail('A player changed or moved. Check your bag and try again.',409);
  }
  return {updated:saved.results.find(p=>p.player_id===row.player_id),receipt,recipient:playerId,stub};
}
