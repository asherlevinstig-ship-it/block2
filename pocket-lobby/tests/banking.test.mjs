import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeBank,ownedGold,GOLD_CAP} from '../public/bank.js';import {normalizeState,settlePlan} from '../server/player-state.mjs';import {bankTransfer,autoBankGold} from '../server/banking.mjs';import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';import {touchPresence} from '../server/routines.mjs';import {readRankings} from '../server/rankings.mjs';import {handlePlayerApi} from '../server/player-api.mjs';import {testDatabase} from './db-helper.mjs';
test('bank defaults and strict balances reject malformed or unbounded account data',()=>{
 assert.deepEqual(normalizeBank(),{gold:0,autoDeposit:false,keepWallet:100,transactions:[]});assert.equal(normalizeState({}).bank.gold,0);
 for(const bank of [null,[],{gold:-1},{gold:1.5},{gold:GOLD_CAP+1},{autoDeposit:1},{keepWallet:-1},{transactions:[{kind:'mint',amount:1,at:1}]}])assert.throws(()=>normalizeBank(bank),/Invalid bank/);
});
test('deposits and withdrawals preserve owned wealth and lifetime earnings; boundaries cannot mint gold',()=>{
 const s=normalizeState({credits:200,goldEarned:80,ownedFurniture:{safe:1},homeFurniture:[{id:1,type:'safe',x:1,y:1,rot:0}],location:'home',position:{x:1,y:2}});applyGameplayAction(s,'goldBankTransfer',{kind:'deposit',amount:125},1000);assert.equal(s.credits,75);assert.equal(s.bank.gold,125);assert.equal(ownedGold(s),200);assert.equal(s.goldEarned,80);
 applyGameplayAction(s,'goldBankTransfer',{kind:'withdraw',amount:25},2000);assert.equal(s.credits,100);assert.equal(s.bank.gold,100);assert.equal(ownedGold(s),200);assert.equal(s.goldEarned,80);
 for(const amount of [0,-1,1.5,NaN,101])assert.throws(()=>bankTransfer(s,'deposit',amount,3000),/Choose/);assert.throws(()=>bankTransfer(s,'withdraw',101,3000),/Choose/);assert.equal(ownedGold(s),200);
 const full=normalizeState({credits:GOLD_CAP,bank:{gold:GOLD_CAP}});assert.throws(()=>bankTransfer(full,'deposit',1,0),/fits/);assert.throws(()=>bankTransfer(full,'withdraw',1,0),/fits/);
 for(let i=0;i<30;i++)bankTransfer(s,i%2?'withdraw':'deposit',1,4000+i);assert.equal(s.bank.transactions.length,20);
});
test('saved snapshots cannot forge the bank or its Auto deposit policy',()=>{
 const s=normalizeState({bank:{gold:50,autoDeposit:true,keepWallet:20},homeFurniture:[{id:1,type:'safe',x:1,y:1,rot:0}],location:'home',position:{x:1,y:2}}),forged=protectFishingState(s,{...s,bank:{gold:999,autoDeposit:false,keepWallet:0}});assert.deepEqual(forged.bank,s.bank);
 applyGameplayAction(s,'goldBankPolicy',{autoDeposit:false,keepWallet:100},1000);assert.equal(s.bank.gold,50);assert.equal(s.bank.autoDeposit,false);assert.equal(s.bank.keepWallet,100);
 s.plan={source:'rules'};assert.throws(()=>applyGameplayAction(s,'goldBankTransfer',{kind:'deposit',amount:10},1001),/Invalid activity/);
});
test('Auto banks initial excess and sale proceeds with identical online/offline totals',()=>{
 const setup=()=>{const s=normalizeState({credits:200,bank:{autoDeposit:true,keepWallet:100},woodcutting:{axeOwned:true,equipped:true,timber:20,xp:0},characterRules:{strategy:'earnGold'}});s.controlMode='auto';s.routineLastSeen=1000;touchPresence(s,1000,{forceStart:true,active:false,random:()=>.5});return s;};
 const online=setup(),offline=setup();assert.equal(online.credits,100);assert.equal(online.bank.gold,100);assert.equal(online.plan.bankedGold,100);
 for(let at=2000;at<=361000;at+=1000)settlePlan(online,at,{random:()=>.5});settlePlan(offline,361000,{random:()=>.5});for(const key of ['credits','bank','woodcutting','goldEarned'])assert.deepEqual(online[key],offline[key]);assert(online.bank.gold>100);assert.equal(online.credits,100);assert.equal(ownedGold(online),200+online.plan.goldEarned);
 settlePlan(online,362000,{stop:true});assert.equal(online.report.bankedGold,online.bank.gold);const before=online.bank.gold;settlePlan(online,999999);assert.equal(online.bank.gold,before);
});
test('Auto deposits never withdraw savings to fund bets or bait and respect bank capacity',()=>{
 const s=normalizeState({credits:100,avatar:{name:'Guest',outfit:6,hair:0},bank:{gold:500,autoDeposit:true,keepWallet:100},characterRules:{strategy:'gambling',gambling:{reserveGold:100}}});s.controlMode='auto';s.routineLastSeen=1000;touchPresence(s,1000,{forceStart:true,active:false});assert.equal(s.report.reason,'gold-reserve');assert.equal(s.bank.gold,500);assert.equal(s.credits,100);
 const full=normalizeState({credits:120,bank:{gold:GOLD_CAP-5,autoDeposit:true,keepWallet:100}}),plan={source:'rules'};assert.equal(autoBankGold(full,plan,1000),5);assert.equal(full.credits,115);assert.equal(full.bank.gold,GOLD_CAP);assert.equal(autoBankGold(full,plan,2000),0);
 const manual=normalizeState({credits:120,bank:{autoDeposit:true,keepWallet:100}});assert.equal(autoBankGold(manual,{source:'board'},0),0);assert.equal(manual.credits,120);
});
test('Auto table winnings can be banked while subsequent losses remain wallet-only',()=>{
 const s=normalizeState({credits:100,avatar:{name:'Guest',outfit:6,hair:0},bank:{gold:200,autoDeposit:true,keepWallet:100},characterRules:{strategy:'gambling',gambling:{reserveGold:50,lossLimit:5,profitTarget:100,maxRounds:10}}});s.controlMode='auto';s.routineLastSeen=1000;touchPresence(s,1000,{forceStart:true,active:false});
 settlePlan(s,31000,{random:()=>.03});assert.equal(s.credits,100);assert.equal(s.bank.gold,205);assert.equal(s.plan.bankedGold,5);assert.equal(s.plan.goldEarned-s.plan.goldSpent,5);
 settlePlan(s,61000,{random:()=>0});assert.equal(s.report.reason,'gamble-loss-limit');assert.equal(s.credits,95);assert.equal(s.bank.gold,205);assert.equal(s.report.bankedGold,5);assert.equal(ownedGold(s),300);
});
test('wealth rankings include bank savings without changing lifetime earnings',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());
 for(const [id,credits,gold] of [['saved',10,500],['wallet',200,0]]){
  const s={...normalizeState({credits,bank:{gold}}),rankingJoined:true};sql.prepare('INSERT INTO tower_players (player_id,state_json,revision,last_request,updated_at) VALUES (?,?,1,?,?)').run(id,JSON.stringify(s),'create',1000);sql.prepare('INSERT INTO tower_accounts (account_id,username_key,username,player_id,password_hash,recovery_hash,created_at) VALUES (?,?,?,?,?,?,?)').run(id,id,id,id,'hash','recovery',1000);
 }
 const result=await readRankings(db,'saved',{});assert.equal(result.wealth.you.rank,1);assert.equal(result.wealth.you.gold,510);assert.equal(result.wealth.you.earned,0);
});
test('API retries and concurrent transfers cannot duplicate gold; session import cannot mint bank funds',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());const origin='https://tower.test';let packet,cookie='';
 async function call(path,body){const response=await handlePlayerApi(new Request(origin+'/api/player/'+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify({...body,characterKey:packet?.characterKey}):undefined}),{TOWER_DB:db});cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;const data=await response.json();if(response.ok)packet=data;return {status:response.status,...data};}
 await call('session',{legacy:{credits:200,bank:{gold:999999}}});assert.equal(packet.state.bank.gold,0);
 packet.state.ownedFurniture.safe=1;packet.state.homeFurniture=[{id:1,type:'safe',x:1,y:1,rot:0}];packet.state.location='home';packet.state.position={x:1,y:2};sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(packet.state),packet.characterKey);
 const body={revision:packet.revision,operation:crypto.randomUUID(),kind:'deposit',amount:100};await call('gameplay/goldBankTransfer',body);await call('gameplay/goldBankTransfer',body);assert.equal(packet.state.credits,100);assert.equal(packet.state.bank.gold,100);
 const revision=packet.revision;const results=await Promise.all([1,2].map(()=>call('gameplay/goldBankTransfer',{revision,operation:crypto.randomUUID(),kind:'withdraw',amount:100})));assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 await call('state');assert.equal(packet.state.credits,200);assert.equal(packet.state.bank.gold,0);assert.equal(ownedGold(packet.state),200);
 const save=await call('save',{revision:packet.revision,operation:crypto.randomUUID(),state:{...packet.state,bank:{gold:999,autoDeposit:true,keepWallet:0}}});assert.equal(save.status,200);assert.equal(packet.state.bank.gold,0);assert.equal(packet.state.bank.autoDeposit,false);
});
