import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeState} from '../server/player-state.mjs';
import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';
import {autoBankGold} from '../server/banking.mjs';
import {besideHomeSafe,HOME_SAFE_PRICE} from '../public/home-safe.js';
import {handlePlayerApi} from '../server/player-api.mjs';
import {testDatabase} from './db-helper.mjs';
import {boot} from './helpers/game-client.mjs';
const placed={id:1,type:'safe',x:2,y:2,rot:0};
test('buying a safe costs wallet gold once and requires a free character at home',()=>{
 const s=normalizeState({credits:200,location:'home'});
 const busy=normalizeState({credits:200,location:'home'});busy.plan={source:'rules'};assert.throws(()=>applyGameplayAction(busy,'buySafe',{},1000),/activity/);
 assert.equal(s.ownedFurniture.safe,undefined);
 applyGameplayAction(s,'buySafe',{},1000);assert.equal(s.credits,200-HOME_SAFE_PRICE);assert.equal(s.ownedFurniture.safe,1);assert.equal(s.goldEarned,0);
 assert.throws(()=>applyGameplayAction(s,'buySafe',{},1000),/already/);assert.equal(s.credits,50);
 for(const input of [{credits:149,location:'home'},{credits:200,location:'hub'}])assert.throws(()=>applyGameplayAction(normalizeState(input),'buySafe',{},1000),/balance|Travel|activity/);
});
test('storage transfers and policy changes require the owned placed safe and an adjacent tile',()=>{
 const s=normalizeState({credits:200,location:'home',position:{x:2,y:3},woodcutting:{timber:10}});
 const actions=[['goldBankTransfer',{kind:'deposit',amount:10}],['vaultTransfer',{kind:'deposit',item:'timber',amount:2}],['goldBankPolicy',{autoDeposit:true,keepWallet:10}],['vaultPolicy',{rules:{timber:2}}]];
 for(const [action,body] of actions)assert.throws(()=>applyGameplayAction(s,action,body,1000),/Travel/);
 applyGameplayAction(s,'buySafe',{},1000);s.homeFurniture=[placed];assert(besideHomeSafe(s));
 for(const [action,body] of actions)applyGameplayAction(s,action,body,1000);
 assert.equal(s.bank.gold,10);assert.equal(s.bank.vault.items.timber,2);
 for(const [location,position] of [['hub',{x:2,y:3}],['home',{x:3,y:3}],['home',{x:2,y:2}]]){s.location=location;s.position=position;assert.throws(()=>applyGameplayAction(s,'vaultTransfer',{kind:'withdraw',item:'timber',amount:1},1000),/Travel/);}
 s.location='home';s.position={x:2,y:3};s.homeFurniture=[];assert.throws(()=>applyGameplayAction(s,'goldBankTransfer',{kind:'withdraw',amount:1},1000),/Travel/);
});
test('existing savings migrate to one unplaced safe while new characters must buy it',()=>{
 for(const bank of [{gold:25},{vault:{items:{timber:3}}},{autoDeposit:true},{vault:{rules:{timber:10}}}]){
  const s=normalizeState({bank});assert.equal(s.ownedFurniture.safe,1);assert.deepEqual(s.homeFurniture,[]);assert.deepEqual(normalizeState(s),s);
 }
 assert.equal(normalizeState({}).ownedFurniture.safe,undefined);
 const s=normalizeState({safeVersion:1,bank:{gold:25}});assert.equal(s.ownedFurniture.safe,undefined);
 const forged=protectFishingState(s,{...s,safeVersion:0,ownedFurniture:{safe:1},homeFurniture:[placed]});assert.equal(forged.ownedFurniture.safe,undefined);assert.deepEqual(normalizeState(forged).homeFurniture,[]);
 assert.throws(()=>normalizeState({safeVersion:1,homeFurniture:[placed]}),/Invalid home safe/);
 assert.throws(()=>normalizeState({ownedFurniture:{safe:1},homeFurniture:[placed,{...placed,id:2}]}),/Invalid home safe/);
});
test('owned safe works for away storage even when picked up, and keeps contents through placement changes',()=>{
 const s=normalizeState({safeVersion:1,ownedFurniture:{safe:1},location:'pond',credits:200,woodcutting:{timber:10},bank:{autoDeposit:true,keepWallet:100,vault:{rules:{timber:2}}}}),plan={source:'rules'};
 autoBankGold(s,plan,1000);assert.equal(s.bank.gold,100);assert.equal(s.bank.vault.items.timber,8);assert.equal(s.woodcutting.timber,2);
 const picked=normalizeState({...s,homeFurniture:[]});assert.deepEqual(picked.bank,s.bank);
 const noSafe=normalizeState({...s,safeVersion:1,ownedFurniture:{}});noSafe.credits=200;noSafe.woodcutting.timber=10;autoBankGold(noSafe,{source:'rules'},2000);assert.equal(noSafe.credits,200);assert.equal(noSafe.woodcutting.timber,10);
 const g=boot({...picked,location:'home',homeFurniture:[placed]});g.run('object('+JSON.stringify(placed)+')');assert.deepEqual(g.errors,[]);
});
test('API protects purchased ownership, retries purchase once and migrates existing saved items',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());let packet,cookie='';const base='https://tower.test';
 async function call(path,body){const response=await handlePlayerApi(new Request(base+'/api/player/'+path,{method:body?'POST':'GET',headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify({...body,characterKey:packet?.characterKey}):undefined}),{TOWER_DB:db});cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;const data=await response.json();if(response.ok)packet=data;return {status:response.status,...data};}
 await call('session',{legacy:{credits:200,location:'home',ownedFurniture:{bed:1,safe:1},homeFurniture:[placed]}});assert.equal(packet.state.ownedFurniture.safe,0);assert.equal(packet.state.ownedFurniture.bed,1);assert.deepEqual(packet.state.homeFurniture,[]);
 const body={revision:packet.revision,operation:crypto.randomUUID()};assert.equal((await call('gameplay/buySafe',body)).status,200);assert.equal((await call('gameplay/buySafe',body)).status,200);assert.equal(packet.state.credits,50);assert.equal(packet.state.ownedFurniture.safe,1);
 assert.equal((await call('gameplay/buySafe',{revision:packet.revision,operation:crypto.randomUUID()})).status,400);
 const legacy={...packet.state,bank:{gold:20,vault:{items:{timber:3}}},ownedFurniture:{bed:1}};delete legacy.safeVersion;sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(legacy),packet.characterKey);
 await call('state');assert.equal(packet.state.safeVersion,1);assert.equal(packet.state.ownedFurniture.safe,1);assert.equal(packet.state.bank.gold,20);assert.equal(packet.state.bank.vault.items.timber,3);
});
