import {stallCatalog,stallLimits} from '../public/market-stall-catalog.js';
import {normalizeStyleAbilities,styleAbilities} from '../public/style-abilities.js';
import {GOLD_CAP} from '../public/bank.js';
import {VAULT_CAP,vaultBagCount} from '../public/vault.js';
import {transferStorageItem} from './vault.mjs';
import {atTradingPost} from './timber-orders.mjs';
import {awardTradingXp} from './activity-xp.mjs';
import {recordShopPurchase,shopSaleStatements} from './shop-licences.mjs';

const invalid=message=>Object.assign(new Error(message),{status:400});
const between=(value,max)=>Number.isSafeInteger(value)&&value>=1&&value<=max;
const playerGuard='EXISTS (SELECT 1 FROM tower_players WHERE player_id=? AND revision=?)';
const listingView=row=>({id:row.listing_id,item:row.item,seller:row.seller_name,quantity:row.quantity,price:row.price,expiresAt:row.expires_at});

export async function readMarketStalls(db,id,item,now=Date.now()){
  const filter=Object.hasOwn(stallCatalog,item)?item:null;
  const [offers,own,proceeds]=await db.batch([
    db.prepare(`SELECT * FROM tower_market_stalls WHERE seller_id<>? AND expires_at>?
      AND (? IS NULL OR item=?) ORDER BY price,expires_at,listing_id LIMIT 60`).bind(id,now,filter,filter),
    db.prepare('SELECT * FROM tower_market_stalls WHERE seller_id=? ORDER BY expires_at,listing_id').bind(id),
    db.prepare('SELECT gold,quantity FROM tower_market_proceeds WHERE seller_id=?').bind(id)
  ]);
  return {offers:offers.results.map(listingView),own:own.results.map(listingView),claimable:proceeds.results[0]?.gold??0,now};
}

export async function changeMarketStall(db,row,state,body,now=Date.now()){
  if(!atTradingPost(state)||state.controlMode==='auto'||state.plan||state.report||state.hunting?.encounter||
    state.hunting?.recoveryUntil||state.fishingCast||state.timberCut||state.miningCut||state.health<=0){
    throw invalid('Visit the Trading Post in Play mode to use market stalls.');
  }
  const id=row.player_id,token=crypto.randomUUID(),{kind,item,quantity,price,operation}=body;
  let change,after=[],receipt;
  if(kind==='list'){
    if(!Object.hasOwn(stallCatalog,item)||!between(quantity,stallLimits.quantity)||!between(price,stallLimits.price)){
      throw invalid('Choose a market item, 1–200 units and a price of 1–1,000 gold each.');
    }
    if(vaultBagCount(state,item,stallCatalog)<quantity)throw invalid('Bring enough of this item in your bag.');
    transferStorageItem(state,{},stallCatalog,'deposit',item,quantity);
    change=db.prepare(`INSERT INTO tower_market_stalls
      SELECT ?,?,?,?,?,?,?,? WHERE ${playerGuard}
      AND (SELECT COUNT(*) FROM tower_market_stalls WHERE seller_id=?)<?
      RETURNING listing_id`).bind(token,id,state.avatar.name,item,quantity,price,now+stallLimits.hours*3600000,token,id,row.revision,id,stallLimits.listings);
    receipt={kind,item,quantity};
  }else if(kind==='appraise'){
    const abilities=normalizeStyleAbilities(state.styleAbilities);
    if(!abilities.learned.includes('appraise'))throw invalid('Accept Appraise before inspecting market prices.');
    if((abilities.readyAt.appraise??0)>now)throw invalid('Appraise is still recharging.');
    const listing=await db.prepare('SELECT * FROM tower_market_stalls WHERE listing_id=? AND expires_at>?').bind(body.id,now).first();
    if(!listing||!listing.item.startsWith('ore:'))throw invalid('Choose an available ore listing.');
    const stats=await db.prepare(`SELECT COUNT(*) trades,COALESCE(SUM(quantity),0) volume,
      SUM(quantity*price)*1.0/SUM(quantity) average,MIN(price) low,MAX(price) high
      FROM tower_market_sales WHERE item=? AND sold_at>=? AND sold_at<=?`).bind(listing.item,now-7*86400000,now).first();
    abilities.readyAt.appraise=now+styleAbilities.appraise.cooldown;
    state.styleAbilities=abilities;
    const receipt={kind,item:listing.item,price:listing.price,trades:stats.trades,volume:stats.volume,
      ...(stats.trades>=3?{average:stats.average,low:stats.low,high:stats.high}:{})};
    const [saved]=await db.batch([
      db.prepare(`UPDATE tower_players SET state_json=?,revision=revision+1,last_request=?,updated_at=?
        WHERE player_id=? AND revision=? RETURNING *`).bind(JSON.stringify(state),operation,now,id,row.revision),
      db.prepare(`INSERT INTO tower_market_appraisals SELECT ?,?,? WHERE changes()=1
        ON CONFLICT(player_id) DO UPDATE SET operation=excluded.operation,receipt=excluded.receipt RETURNING player_id`)
        .bind(id,operation,JSON.stringify(receipt))
    ]);
    if(!saved.results.length)throw invalid('Your character changed. Try again.');
    return {updated:saved.results[0],receipt};
  }else if(kind==='claim'){
    const balance=await db.prepare('SELECT gold,quantity FROM tower_market_proceeds WHERE seller_id=?').bind(id).first();
    const gold=Math.min(balance?.gold??0,GOLD_CAP-state.credits);
    if(!gold)throw invalid(balance?.gold?'Make room in your wallet to collect gold.':'No stall proceeds to collect.');
    state.credits+=gold;
    state.goldEarned=Math.min(Number.MAX_SAFE_INTEGER,(state.goldEarned??0)+gold);
    awardTradingXp(state,balance.quantity);
    change=db.prepare(`UPDATE tower_market_proceeds SET gold=gold-?,quantity=quantity-?
      WHERE seller_id=? AND gold>=? AND quantity>=? AND ${playerGuard} RETURNING seller_id`)
      .bind(gold,balance.quantity,id,gold,balance.quantity,id,row.revision);
    receipt={kind,gold};
  }else if(kind==='buy'||kind==='reclaim'){
    if(typeof body.id!=='string'||body.id.length!==36)throw invalid('Choose a listing.');
    const listing=await db.prepare('SELECT * FROM tower_market_stalls WHERE listing_id=?').bind(body.id).first();
    if(!listing)throw invalid('This listing has closed. Refresh the market.');
    const buying=kind==='buy',key=listing.item;
    if(buying?listing.seller_id===id||listing.expires_at<=now:listing.seller_id!==id)throw invalid('This listing is unavailable.');
    const count=buying?quantity:listing.quantity,gold=buying?count*listing.price:0;
    if(!between(count,listing.quantity)||buying&&body.price!==listing.price)throw invalid('Check the latest price and quantity before buying.');
    if(state.credits<gold)throw invalid('Bring enough gold in your wallet.');
    if(vaultBagCount(state,key,stallCatalog)+count>VAULT_CAP)throw invalid('Make room in your bag first.');
    transferStorageItem(state,{[key]:count},stallCatalog,'withdraw',key,count);
    state.credits-=gold;
    change=db.prepare(`UPDATE tower_market_stalls SET quantity=quantity-?,mutation=?
      WHERE listing_id=? AND mutation=? AND ${playerGuard} RETURNING listing_id`)
      .bind(count,token,listing.listing_id,listing.mutation,id,row.revision);
    if(buying){
      recordShopPurchase(state,'market',gold,now,listing.seller_id);
      after=[
        db.prepare(`INSERT INTO tower_market_sales SELECT ?,?,?,?,? WHERE EXISTS
          (SELECT 1 FROM tower_market_stalls WHERE listing_id=? AND mutation=?)
          AND EXISTS (SELECT 1 FROM tower_players WHERE player_id=? AND revision=? AND last_request=?)
          RETURNING operation`).bind(operation,key,count,listing.price,now,listing.listing_id,token,id,row.revision+1,operation),
        ...shopSaleStatements(db,state,id,row.revision+1,operation),
        db.prepare(`INSERT INTO tower_market_proceeds SELECT ?,?,? WHERE EXISTS
          (SELECT 1 FROM tower_market_stalls WHERE listing_id=? AND mutation=?)
          ON CONFLICT(seller_id) DO UPDATE SET gold=gold+excluded.gold,quantity=quantity+excluded.quantity
          RETURNING seller_id`).bind(listing.seller_id,gold,count,listing.listing_id,token)
      ];
    }
    after.push(db.prepare('DELETE FROM tower_market_stalls WHERE listing_id=? AND mutation=? AND quantity=0 RETURNING listing_id').bind(listing.listing_id,token));
    receipt={kind,item:key,quantity:count,gold};
  }else throw invalid('Choose a market stall action.');
  const [,saved]=await db.batch([
    change,
    db.prepare(`UPDATE tower_players SET state_json=?, revision=revision+1,last_request=?,updated_at=?
      WHERE player_id=? AND revision=? AND changes()=1 RETURNING *`).bind(JSON.stringify(state),operation,now,id,row.revision),
    ...after
  ]);
  if(!saved.results.length)throw invalid('The market changed or your three stall slots are full. Refresh and try again.');
  return {updated:saved.results[0],receipt};
}
