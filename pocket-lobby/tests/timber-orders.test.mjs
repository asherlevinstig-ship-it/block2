import test from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './db-helper.mjs';
import {handlePlayerApi} from '../server/player-api.mjs';
import {normalizeState} from '../server/player-state.mjs';
import {readRankings} from '../server/rankings.mjs';

const origin='https://tower.test';
function client(db,vars={}){
  let cookie='',packet=null;
  async function request(path,body){
    const response=await handlePlayerApi(new Request(origin+'/api/player/'+path,{
      method:body?'POST':'GET',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},
      body:body?JSON.stringify(body):undefined
    }),{TOWER_DB:db,...vars});
    cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;
    const data=await response.json();
    if(response.ok&&data.state)packet=data;
    return {status:response.status,...data};
  }
  return {request,get packet(){return packet;},trade:(body,operation=crypto.randomUUID())=>request('timber-orders',{...body,operation,revision:packet.revision,characterKey:packet.characterKey})};
}
async function marketPlayer(db,sql,name,credits,timber){
  const actor=client(db);
  const avatar={name,outfit:0,hair:0};
  const session=await actor.request('session',{legacy:{avatar}});
  assert.equal(session.status,200,session.error);
  const state=normalizeState({avatar,credits,location:'market',position:{x:4,y:3},woodcutting:{timber}});
  sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(state),session.characterKey);
  await actor.request('state');
  return actor;
}
test('a funded timber order fills while the buyer is offline, then supports pickup and refund',async t=>{
  const {db,sql}=testDatabase();t.after(()=>sql.close());
  const buyer=await marketPlayer(db,sql,'Buyer',160,2),seller=await marketPlayer(db,sql,'Seller',20,15);
  const posted=await buyer.trade({kind:'post',quantity:20,price:6});
  const [order]=posted.board.own;
  assert.equal(posted.state.credits,40);
  assert.equal(posted.board.heldGold,120);
  assert.equal(posted.state.goldEarned,0);
  assert.deepEqual((await seller.request('timber-orders')).orders,[{id:order.id,buyer:'Buyer',price:6,remaining:20}]);
  assert.deepEqual((await buyer.request('timber-orders')).orders,[]);
  assert.equal((await buyer.trade({kind:'fill',id:order.id,quantity:1})).status,400);
  assert.equal((await seller.trade({kind:'cancel',id:order.id})).status,400);
  const sale={kind:'fill',id:order.id,quantity:8};
  const filled=await seller.trade(sale,'sale-1');
  assert.equal(filled.state.credits,68);
  assert.equal(filled.state.goldEarned,48);
  assert.equal(filled.state.woodcutting.timber,7);
  const replay=await seller.request('timber-orders',{...sale,operation:'sale-1',revision:filled.revision-1});
  assert.equal(replay.state.credits,68);
  assert.equal(replay.board.orders[0].remaining,12);
  assert.equal(sql.prepare('SELECT revision FROM tower_players WHERE player_id=?').get(buyer.packet.characterKey).revision,posted.revision);
  const waiting=await buyer.request('timber-orders');
  assert.equal(waiting.own[0].ready,8);
  assert.equal(waiting.heldGold,72);
  const cancelled=await buyer.trade({kind:'cancel',id:order.id});
  assert.equal(cancelled.state.credits,112);
  assert.equal(cancelled.board.heldGold,0);
  assert.equal(cancelled.board.own[0].ready,8);
  const collected=await buyer.trade({kind:'collect',id:order.id});
  assert.equal(collected.state.woodcutting.timber,10);
  assert.equal(collected.state.goldEarned,0);
  assert.deepEqual(collected.board.own,[]);
});
test('competing sellers cannot sell the same last timber or receive unearned gold',async t=>{
  const {db,sql}=testDatabase();t.after(()=>sql.close());
  const buyer=await marketPlayer(db,sql,'Buyer',100,0);
  const a=await marketPlayer(db,sql,'First',100,4),b=await marketPlayer(db,sql,'Second',100,4);
  const posted=await buyer.trade({kind:'post',quantity:4,price:5});
  const fill={kind:'fill',id:posted.board.own[0].id,quantity:4};
  const results=await Promise.all([a.trade(fill,'same-operation'),b.trade(fill,'same-operation')]);
  assert.deepEqual(results.map(result=>result.status).sort(),[200,400]);
  assert.deepEqual([a,b].map(actor=>actor.packet.state.credits).sort(),[100,120]);
  assert.deepEqual([a,b].map(actor=>actor.packet.state.woodcutting.timber).sort(),[0,4]);
  const board=await buyer.request('timber-orders');
  assert.equal(board.own[0].ready,4);
  assert.equal(board.heldGold,0);
});
test('the live character start rejects browser-supplied wealth, location and goods',async t=>{
  const {db,sql}=testDatabase();t.after(()=>sql.close());
  const actor=client(db,{SERVER_CHARACTER_STARTS:true});
  const session=await actor.request('session',{legacy:{credits:99999,location:'market',woodcutting:{timber:200},fishStock:{silverfin:1000}}});
  assert.equal(session.state.characterCreated,false);
  assert.equal(session.state.location,'home');
  assert.equal(session.state.credits,100);
  assert.equal(session.state.woodcutting.timber,0);
  assert.deepEqual(session.state.fishStock,{});
  assert.equal((await actor.request('timber-orders')).status,400);
  assert.equal((await actor.trade({kind:'post',quantity:1,price:6})).status,400);
});
test('refundable escrow counts toward wealth and character reset clears outstanding orders',async t=>{
  const {db,sql}=testDatabase();t.after(()=>sql.close());
  const buyer=await marketPlayer(db,sql,'Buyer',200,0),seller=await marketPlayer(db,sql,'Seller',50,2);
  const {characterKey}=buyer.packet;
  sql.prepare("UPDATE tower_players SET state_json=json_set(state_json,'$.rankingJoined',json('true')) WHERE player_id=?").run(characterKey);
  const posted=await buyer.trade({kind:'post',quantity:10,price:10});
  assert.equal(posted.status,200,posted.error);
  sql.prepare('INSERT INTO tower_accounts VALUES(?,?,?,?,?,?,?)').run('buyer-account','buyer','Buyer',characterKey,'hash','recovery',0);
  assert.equal((await readRankings(db,characterKey,true)).wealth.you.gold,200);
  const filled=await seller.trade({kind:'fill',id:posted.board.own[0].id,quantity:2});
  assert.equal(filled.state.credits,70);
  assert.equal((await readRankings(db,characterKey,true)).wealth.you.gold,180);
  sql.prepare('DELETE FROM tower_accounts WHERE player_id=?').run(characterKey);
  const reset=await buyer.request('testing/reset',{operation:'reset',revision:posted.revision,testing:true,confirm:'RESET'});
  assert.equal(reset.status,200);
  assert.equal(reset.state.characterCreated,false);
  assert.equal(sql.prepare('SELECT COUNT(*) AS count FROM tower_timber_orders').get().count,0);
  assert.equal((await seller.request('state')).state.credits,70);
});
