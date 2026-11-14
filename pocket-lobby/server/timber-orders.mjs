import {awardTradingXp} from './activity-xp.mjs';
import {GOLD_CAP} from '../public/bank.js';

const invalid=message=>Object.assign(new Error(message),{status:400});
const between=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const orderLimit=5;
const summary=order=>({id:order.order_id,buyer:order.buyer_name,price:order.price,quantity:order.quantity,remaining:order.remaining,ready:order.ready});

export async function readTimberOrders(db,playerId){
  const publicOrders=db.prepare('SELECT order_id,buyer_name,price,remaining FROM tower_timber_orders WHERE remaining>0 AND buyer_id<>? ORDER BY price DESC,created_at,order_id LIMIT 30').bind(playerId);
  const ownOrders=db.prepare('SELECT * FROM tower_timber_orders WHERE buyer_id=? ORDER BY created_at DESC,order_id').bind(playerId);
  const [listed,mine]=await db.batch([publicOrders,ownOrders]);
  return {
    orders:listed.results.map(order=>({id:order.order_id,buyer:order.buyer_name,price:order.price,remaining:order.remaining})),
    own:mine.results.map(summary),
    heldGold:mine.results.reduce((sum,order)=>sum+order.remaining*order.price,0),
    limit:orderLimit
  };
}

export function atTradingPost(state){
  return state.location==='market'&&state.characterCreated!==false;
}

export async function matchAutoTimberOrders(db,sellerId,minimumPrice,surplus,wallet){
  if(!surplus||wallet<minimumPrice)return [];
  const {results}=await db.prepare(`SELECT order_id,price,remaining,mutation FROM tower_timber_orders
    WHERE remaining>0 AND buyer_id<>? AND price>=? ORDER BY price DESC,created_at,order_id LIMIT 5`).bind(sellerId,minimumPrice).all();
  const matches=[];
  for(const order of results){
    const quantity=Math.min(surplus,order.remaining,Math.floor(wallet/order.price));
    if(!quantity)continue;
    matches.push({id:order.order_id,mutation:order.mutation,price:order.price,quantity});
    surplus-=quantity;wallet-=quantity*order.price;
    if(!surplus)break;
  }
  return matches;
}

export async function writeAutoTimberSale(db,row,state,operation,now,matches){
  const payload=JSON.stringify(matches);
  // A changed order or seller revision aborts the whole sale before any order is filled.
  const [saved]=await db.batch([
    db.prepare(`UPDATE tower_players SET state_json=?,revision=revision+1,last_request=?,updated_at=?
      WHERE player_id=? AND revision=? AND NOT EXISTS (
        SELECT 1 FROM json_each(?) AS m LEFT JOIN tower_timber_orders AS o ON o.order_id=json_extract(m.value,'$.id')
        WHERE o.order_id IS NULL OR o.mutation<>json_extract(m.value,'$.mutation') OR o.remaining<json_extract(m.value,'$.quantity')
      ) RETURNING *`).bind(JSON.stringify(state),operation,now,row.player_id,row.revision,payload),
    db.prepare(`WITH matches AS (
        SELECT json_extract(value,'$.id') AS id,json_extract(value,'$.quantity') AS quantity FROM json_each(?)
      )
      UPDATE tower_timber_orders SET remaining=remaining-matches.quantity,ready=ready+matches.quantity,mutation=?
      FROM matches WHERE order_id=matches.id AND EXISTS (SELECT 1 FROM tower_players WHERE player_id=? AND revision=? AND last_request=?)
      RETURNING order_id`).bind(payload,operation,row.player_id,row.revision+1,operation)
  ]);
  return saved.results[0]??null;
}

export async function changeTimberOrder(db,row,state,body,now){
  if(!atTradingPost(state)||state.controlMode==='auto'||state.plan||state.report||state.hunting?.encounter||state.hunting?.recoveryUntil||state.health<=0){
    throw invalid('Visit the Trading Post in Play mode to trade.');
  }
  const playerId=row.player_id,mutation=crypto.randomUUID();
  const guard='EXISTS (SELECT 1 FROM tower_players WHERE player_id=? AND revision=?)';
  let orderId=body.id,change,receipt;
  if(body.kind==='post'){
    const {quantity,price}=body;
    if(!between(quantity,1,200)||!between(price,1,1000))throw invalid('Choose 1–200 timber and 1–1,000 gold per timber.');
    const gold=quantity*price;
    if(gold>state.credits)throw invalid('Bring '+gold+' gold in your wallet to post this order.');
    orderId=crypto.randomUUID();
    change=db.prepare(`INSERT INTO tower_timber_orders (order_id,buyer_id,buyer_name,price,quantity,remaining,ready,created_at,mutation)
      SELECT ?,?,?,?,?,?,0,?,? WHERE ${guard} AND (SELECT COUNT(*) FROM tower_timber_orders WHERE buyer_id=?)<? RETURNING order_id`)
      .bind(orderId,playerId,state.avatar.name,price,quantity,quantity,now,mutation,playerId,row.revision,playerId,orderLimit);
    state.credits-=gold;
    receipt={kind:'post',quantity,gold:-gold};
  }else{
    if(!['fill','cancel','collect'].includes(body.kind)||typeof orderId!=='string'||orderId.length!==36)throw invalid('Choose a timber order.');
    const order=await db.prepare('SELECT * FROM tower_timber_orders WHERE order_id=?').bind(orderId).first();
    if(!order)throw invalid('This order has closed. Refresh the board.');
    const selling=body.kind==='fill';
    if(selling?order.buyer_id===playerId:order.buyer_id!==playerId)throw invalid(selling?'You cannot fill your own order.':'This order belongs to another player.');
    let remaining=order.remaining,ready=order.ready;
    if(selling){
      const {quantity}=body;
      if(!between(quantity,1,remaining))throw invalid('Choose a quantity still wanted on this order.');
      if(quantity>state.woodcutting.timber)throw invalid('Bring enough timber in your bag to fill this order.');
      const gold=quantity*order.price;
      if(state.credits+gold>GOLD_CAP)throw invalid('Make room in your wallet for the sale.');
      remaining-=quantity;ready+=quantity;
      state.woodcutting.timber-=quantity;state.credits+=gold;
      state.goldEarned=Math.min(Number.MAX_SAFE_INTEGER,(state.goldEarned??0)+gold);
      awardTradingXp(state,quantity);
      receipt={kind:'fill',quantity,gold};
    }else if(body.kind==='cancel'){
      if(!remaining)throw invalid('This order has no unfilled timber to cancel.');
      const gold=remaining*order.price;
      if(state.credits+gold>GOLD_CAP)throw invalid('Make room in your wallet for the refund.');
      remaining=0;state.credits+=gold;
      receipt={kind:'cancel',quantity:0,gold};
    }else{
      if(!ready)throw invalid('No timber is ready for pickup.');
      const quantity=Math.min(ready,1000000-state.woodcutting.timber);
      if(!quantity)throw invalid('Make room in your bag before collecting timber.');
      ready-=quantity;state.woodcutting.timber+=quantity;
      receipt={kind:'collect',quantity,gold:0};
    }
    change=db.prepare(`UPDATE tower_timber_orders SET remaining=?,ready=?,mutation=? WHERE order_id=? AND mutation=? AND ${guard} RETURNING order_id`)
      .bind(remaining,ready,mutation,orderId,order.mutation,playerId,row.revision);
  }
  const result=await db.batch([
    change,
    db.prepare(`UPDATE tower_players SET state_json=?,revision=revision+1,last_request=?,updated_at=? WHERE player_id=? AND revision=?
      AND EXISTS (SELECT 1 FROM tower_timber_orders WHERE order_id=? AND mutation=?) RETURNING *`)
      .bind(JSON.stringify(state),body.operation,now,playerId,row.revision,orderId,mutation),
    db.prepare('DELETE FROM tower_timber_orders WHERE order_id=? AND mutation=? AND remaining=0 AND ready=0 RETURNING order_id').bind(orderId,mutation)
  ]);
  if(result[1].results[0])return {updated:result[1].results[0],receipt};
  const current=await db.prepare('SELECT revision FROM tower_players WHERE player_id=?').bind(playerId).first();
  if(current?.revision!==row.revision)return null;
  throw invalid(body.kind==='post'?'You have five orders open or waiting for pickup. Collect or cancel one to post again.':'That order just changed. Check the latest quantity and try again.');
}
