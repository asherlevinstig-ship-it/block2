import {shopLicences,shopLicenceDays,shopCommissionPercent} from '../public/shop-licences.js';
import {skillLevel} from '../public/skill-curve.js';
import {GOLD_CAP} from '../public/bank.js';

const dayMs=86400000;
const purchases=new WeakMap();
const reject=(message,status=400)=>Object.assign(new Error(message),{status});
const committed='changes()>0 AND EXISTS (SELECT 1 FROM tower_players WHERE player_id=? AND revision=? AND last_request=?)';

// Keep pending sales outside player snapshots. They only settle with the matching player revision.
export function recordShopPurchase(state,shop,gold,at){
  if(!gold)return;
  const sales=purchases.get(state)??[];
  sales.push({shop,gold,at});
  purchases.set(state,sales);
}

export function shopSaleStatements(db,state,id,revision,operation){
  const sales=purchases.get(state);
  if(!sales?.length)return [];
  const payload=JSON.stringify(sales);
  const salesQuery=`SELECT json_extract(value,'$.shop') AS shop, json_extract(value,'$.gold') AS gold,
    json_extract(value,'$.at') AS at FROM json_each(?)`;
  return [
    db.prepare(`WITH sales AS (${salesQuery})
      INSERT INTO tower_shop_sales (shop,day,gold)
      SELECT shop,at/?,SUM(gold) FROM sales WHERE ${committed} GROUP BY shop,at/?
      ON CONFLICT(shop,day) DO UPDATE SET gold=gold+excluded.gold RETURNING shop`)
      .bind(payload,dayMs,id,revision,operation,dayMs),
    db.prepare(`WITH sales AS (${salesQuery})
      INSERT INTO tower_shop_earnings (owner_id,tenths)
      SELECT owner_id,SUM(gold)*?/10 FROM sales
      JOIN tower_shop_licences AS licences ON sales.shop=licences.shop AND at>=starts_at AND at<ends_at
      WHERE owner_id<>? AND ${committed} GROUP BY owner_id
      ON CONFLICT(owner_id) DO UPDATE SET tenths=tenths+excluded.tenths RETURNING owner_id`)
      .bind(payload,shopCommissionPercent,id,id,revision,operation)
  ];
}

export async function shopLicenceBoard(db,id,now=Date.now()){
  const [active,sales,earnings]=await db.batch([
    db.prepare(`SELECT shop,owner_id,COALESCE(json_extract(state_json,'$.avatar.name'), owner_name) AS owner_name,ends_at
      FROM tower_shop_licences LEFT JOIN tower_players ON player_id=owner_id WHERE ends_at>?`).bind(now),
    db.prepare('SELECT shop,SUM(gold) AS gold FROM tower_shop_sales WHERE day>=? AND day<=? GROUP BY shop').bind(Math.floor(now/dayMs)-6,Math.floor(now/dayMs)),
    db.prepare('SELECT tenths FROM tower_shop_earnings WHERE owner_id=?').bind(id)
  ]);
  const owned=active.results.find(row=>row.owner_id===id)?.shop??null;
  return {owned,claimable:Math.floor((earnings.results[0]?.tenths??0)/10),shops:Object.fromEntries(
    Object.entries(shopLicences).map(([shop,offer])=>{
      const lease=active.results.find(row=>row.shop===shop);
      return [shop,{...offer,owner:lease?.owner_name??null,endsAt:lease?.ends_at??null,recentSales:sales.results.find(row=>row.shop===shop)?.gold??0}];
    })
  )};
}

export async function changeShopLicence(db,row,state,{kind,operation},now=Date.now()){
  const id=row.player_id,shop=state.location,offer=Object.hasOwn(shopLicences,shop)?shopLicences[shop]:null;
  if(!offer||state.characterCreated===false||state.controlMode==='auto'||state.plan||state.report||state.hunting?.encounter||state.hunting?.recoveryUntil||state.health<=0){
    throw reject('Visit the bakery or fishing shop in Play mode to manage licences.');
  }
  const revisionGuard='EXISTS (SELECT 1 FROM tower_players WHERE player_id=? AND revision=?)';
  let change;
  if(kind==='buy'){
    if(skillLevel(state.stats?.tradingXp)<offer.trading)throw reject('Reach Trading level '+offer.trading+' to license this shop.');
    if(state.credits<offer.price)throw reject('Bring '+offer.price+' gold to license this shop.');
    const ends=now+shopLicenceDays*dayMs;
    change=db.prepare(`INSERT INTO tower_shop_licences (shop,owner_id,owner_name,starts_at,ends_at)
      SELECT ?,?,?,?,? WHERE ${revisionGuard}
      AND NOT EXISTS (SELECT 1 FROM tower_shop_licences WHERE (owner_id=? OR shop=?) AND ends_at>?)
      RETURNING shop`)
      .bind(shop,id,state.avatar.name,now,ends,id,row.revision,id,shop,now);
    state.credits-=offer.price;
  }else if(kind==='claim'){
    const balance=await db.prepare('SELECT tenths FROM tower_shop_earnings WHERE owner_id=?').bind(id).first();
    const amount=Math.min(GOLD_CAP-state.credits,Math.floor((balance?.tenths??0)/10));
    if(!amount)throw reject(balance?.tenths>=10?'Make room in your wallet to collect shop income.':'No shop income is ready to collect.');
    state.credits+=amount;
    state.goldEarned=Math.min(Number.MAX_SAFE_INTEGER,(state.goldEarned??0)+amount);
    change=db.prepare(`UPDATE tower_shop_earnings SET tenths=tenths-? WHERE owner_id=? AND tenths>=? AND ${revisionGuard} RETURNING owner_id`)
      .bind(amount*10,id,amount*10,id,row.revision);
  }else throw reject('Choose to buy a licence or collect shop income.');
  const [changed,saved]=await db.batch([
    change,
    db.prepare(`UPDATE tower_players SET state_json=?,revision=revision+1,last_request=?,updated_at=?
      WHERE player_id=? AND revision=? AND changes()=1 RETURNING *`)
      .bind(JSON.stringify(state),operation,now,id,row.revision)
  ]);
  if(!saved.results.length){
    if(changed.results.length)throw new Error('Shop licence updated without a player save.');
    throw reject(kind==='buy'?'That shop already has an owner, you already hold a licence, or your character changed.':'Your income or character changed. Try again.');
  }
  return saved.results[0];
}

