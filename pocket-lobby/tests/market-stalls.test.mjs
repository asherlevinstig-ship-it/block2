import test from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './db-helper.mjs';
import {normalizeState} from '../server/player-state.mjs';
import {changeMarketStall,readMarketStalls} from '../server/market-stalls.mjs';
import {stallLimits} from '../public/market-stall-catalog.js';

function fixture(t){
 const {db,sql}=testDatabase();t.after(()=>sql.close());
 const now=Date.now();
 function player(id,credits,ore){
  const state=normalizeState({credits,location:'market',position:{x:5,y:5},huntingLoot:{copperOre:ore}});
  const row={player_id:id,revision:1};
  sql.prepare('INSERT INTO tower_players VALUES (?,?,1,?,?)').run(id,JSON.stringify(state),'create',now);
  return {row,state};
 }
 async function act(player,body,at=now){
  const result=await changeMarketStall(db,player.row,structuredClone(player.state),{...body,operation:crypto.randomUUID()},at);
  player.row=result.updated;player.state=JSON.parse(result.updated.state_json);
  return result.receipt;
 }
 const board=(player,item,at=now)=>readMarketStalls(db,player.row.player_id,item,at);
 return {player,act,board,now};
}
const list={kind:'list',item:'ore:copperOre',price:7,quantity:5};

test('an offline seller escrows ore, sells partially, and collects gold and Trading XP once',async t=>{
 const {player,act,board}=fixture(t);
 const seller=player('seller',10,8),buyer=player('buyer',100,0);
 await act(seller,list);
 assert.equal(seller.state.huntingLoot.copperOre,3);
 assert.equal((await board(buyer,'timber')).offers.length,0);
 const [offer]=(await board(buyer,list.item)).offers;
 await assert.rejects(act(seller,{kind:'buy',id:offer.id,quantity:1,price:7}),/unavailable/);
 await assert.rejects(act(buyer,{kind:'buy',id:offer.id,quantity:1,price:1}),/latest price/);
 await act(buyer,{kind:'buy',id:offer.id,quantity:2,price:7});
 assert.equal(buyer.state.credits,86);
 assert.equal(buyer.state.huntingLoot.copperOre,2);
 assert.equal((await board(seller)).claimable,14);
 assert.equal((await board(seller)).own[0].quantity,3);
 await act(seller,{kind:'claim'});
 assert.equal(seller.state.credits,24);
 assert.equal(seller.state.stats.tradingXp,4);
 await assert.rejects(act(seller,{kind:'claim'}),/No stall proceeds/);
 await act(seller,{kind:'reclaim',id:offer.id});
 assert.equal(seller.state.huntingLoot.copperOre,6);
 assert.equal((await board(buyer)).offers.length,0);
});

test('three listings cap the stall, expired stock is reclaimable, and concurrent buyers cannot oversell',async t=>{
 const {player,act,board,now}=fixture(t);
 const seller=player('seller',0,30),buyer=player('buyer',100,0),other=player('other',100,0);
 for(let i=0;i<3;i++)await act(seller,list);
 await assert.rejects(act(seller,list),/slots are full/);
 const [offer]=(await board(buyer)).offers;
 const buy={kind:'buy',id:offer.id,quantity:5,price:7};
 const results=await Promise.allSettled([act(buyer,buy),act(other,buy)]);
 assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
 assert.equal((await board(seller)).claimable,35);
 const end=now+stallLimits.hours*3600000;
 assert.equal((await board(buyer,'',end)).offers.length,0);
 const [expired]=(await board(seller,'',end)).own;
 await assert.rejects(act(buyer,{...buy,id:expired.id},end),/unavailable/);
 await act(seller,{kind:'reclaim',id:expired.id},end);
 assert.equal(seller.state.huntingLoot.copperOre,20);
});
