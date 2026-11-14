import test from 'node:test';
import assert from 'node:assert/strict';
import {handlePlayerApi} from '../server/player-api.mjs';
import {testDatabase} from './db-helper.mjs';
import {changeShopLicence,recordShopPurchase,shopLicenceBoard,shopSaleStatements} from '../server/shop-licences.mjs';
import {applyGameplayAction} from '../server/gameplay.mjs';
import {normalizeState} from '../server/player-state.mjs';

const start=Date.UTC(2026,10,14),week=7*86400000;
function setup(){
 const {db,sql}=testDatabase();
 const player=(id,name,location='bakery',tradingXp=50)=>{
  const state=normalizeState({credits:500,avatar:{...normalizeState({}).avatar,name},location,stats:{tradingXp}});
  const row={player_id:id,revision:1};
  sql.prepare('INSERT INTO tower_players VALUES (?,?,1,?,?)').run(id,JSON.stringify(state),'create',start);
  return {row,state};
 };
 const change=(p,kind,at=start)=>changeShopLicence(db,p.row,structuredClone(p.state),{kind,operation:kind+':'+at},at);
 const sale=async (p,at,operation,revision=p.row.revision)=>{
  const update=db.prepare('UPDATE tower_players SET state_json=?,revision=revision+1,last_request=? WHERE player_id=? AND revision=? RETURNING *')
    .bind(JSON.stringify(p.state),operation,p.row.player_id,revision);
  const [saved]=await db.batch([update,...shopSaleStatements(db,p.state,p.row.player_id,revision+1,operation)]);
  return saved.results[0];
 };
 return {db,player,change,sale};
}

test('one seven-day licence per shop and per player, with public owner names',async()=>{
 const {db,player,change}=setup();
 const baker=player('one','Aster'),competitor=player('two','Birch');
 const owned=await change(baker,'buy');
 assert.equal(JSON.parse(owned.state_json).credits,400);
 const board=await shopLicenceBoard(db,'two',start);
 assert.equal(board.shops.bakery.owner,'Aster');
 assert.equal(board.shops.bakery.endsAt,start+week);
 await assert.rejects(change(competitor,'buy'),/already/);
 await assert.rejects(change({row:owned,state:{...JSON.parse(owned.state_json),location:'store'}},'buy'),/already/);
 const novice=player('three','Cedar','store',0);
 await assert.rejects(change(novice,'buy'),/Trading level 2/);
 assert.equal((await shopLicenceBoard(db,'two',start+week)).shops.bakery.owner,null);
 await change(competitor,'buy',start+week);
 assert.equal((await shopLicenceBoard(db,'one',start+week)).shops.bakery.owner,'Birch');
});

test('purchases settle once, exclude the owner, and credit the licence active at the sale time',async()=>{
 const {db,player,change,sale}=setup();
 const fisher=player('one','Aster','store'),buyer=player('two','Birch','store');
 const row=await change(fisher,'buy');
 const owner={row,state:JSON.parse(row.state_json)};
 applyGameplayAction(owner.state,'bait',{},start+1);
 owner.row=await sale(owner,start+1,'self');
 applyGameplayAction(buyer.state,'bait',{},start+2);
 await sale(buyer,start+2,'bait');
 await sale(buyer,start+2,'bait');
 const next=player('next','Cedar','store');
 await change(next,'buy',start+week);
 const late=player('late','Dahlia','store');
 recordShopPurchase(late.state,'store',9,start+week-1);
 recordShopPurchase(late.state,'store',10,start+week);
 await sale(late,start+week,'offline');
 const board=await shopLicenceBoard(db,'one',start+week);
 assert.equal(board.claimable,1);
 assert.equal((await shopLicenceBoard(db,'next',start+week)).claimable,1);
 const claimed=await change(owner,'claim',start+week);
 assert.equal(JSON.parse(claimed.state_json).credits,291);
 assert.equal((await shopLicenceBoard(db,'one',start+week)).claimable,0);
 await assert.rejects(change({row:claimed,state:JSON.parse(claimed.state_json)},'claim',start+week+1),/No shop income/);
});


test('two bakery customers see the same owner and a retried bread purchase only pays once',async t=>{
 const {db,sql}=testDatabase();
 t.after(()=>sql.close());
 const origin='https://tower.test';
 async function customer(name){
  let cookie='',packet;
  async function request(path,body){
   const response=await handlePlayerApi(new Request(origin+'/api/player/'+path,{
    method:body?'POST':'GET',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},
    body:body?JSON.stringify(body):undefined
   }),{TOWER_DB:db});
   cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;
   const data=await response.json();
   assert.equal(response.status,200,data.error);
   if(data.state)packet=data;
   return data;
  }
  const avatar={...normalizeState({}).avatar,name};
  await request('session',{legacy:{avatar}});
  const state=normalizeState({avatar,credits:500,location:'bakery',position:{x:5,y:4}});
  sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(state),packet.characterKey);
  return {request,action:(name,body,operation)=>request('gameplay/'+name,{...body,operation,revision:packet.revision,characterKey:packet.characterKey})};
 }
 const owner=await customer('Aster'),shopper=await customer('Birch');
 const licence=await owner.action('shopLicence',{kind:'buy'},'lease');
 assert.equal(licence.shopBoard.owned,'bakery');
 assert.equal((await shopper.request('shop-licences')).shops.bakery.owner,'Aster');
 const purchase=await shopper.action('buyBread',{quantity:10},'bread');
 const replay=await shopper.action('buyBread',{quantity:10},'bread');
 assert.equal(purchase.state.credits,470);
 assert.equal(replay.state.credits,470);
 assert.equal((await owner.request('shop-licences')).claimable,3);
 assert.equal((await owner.action('shopLicence',{kind:'claim'},'collect')).state.credits,403);
});
