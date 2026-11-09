import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeCharacterRules} from '../public/character-rules.js';import {normalizeState,settlePlan} from '../server/player-state.mjs';import {touchPresence} from '../server/routines.mjs';import {autoStatus} from '../public/auto-mode.js';import {boot} from './helpers/game-client.mjs';import {gamblingAction} from '../server/gambling.mjs';import {handlePlayerApi} from '../server/player-api.mjs';import {testDatabase} from './db-helper.mjs';
function start(policy={},extra={}){const s=normalizeState({credits:200,avatar:{name:'Guest',outfit:6,hair:0},location:'home',bedLessonComplete:true,characterRules:{strategy:'gambling',gambling:{reserveGold:100,...policy}},...extra});s.controlMode='auto';s.routineLastSeen=1000;touchPresence(s,1000,{forceStart:true,active:false,random:()=>0});return s;}
const sequence=values=>{let i=0;return ()=>values[i++%values.length];};
test('automatic gambling is explicitly selected and every stake/limit is validated',()=>{
 assert.equal(normalizeCharacterRules().strategy,'routine');
 for(const gambling of [{bet:50},{lossLimit:4},{reserveGold:-1},{profitTarget:0},{maxRounds:1001},{game:'dice'},{color:'green'}])assert.throws(()=>normalizeCharacterRules({strategy:'gambling',gambling}),/Choose/);
 const gold=normalizeState({characterRules:{strategy:'earnGold'}});gold.controlMode='auto';gold.routineLastSeen=1000;touchPresence(gold,1000,{forceStart:true,active:false});assert.notEqual(gold.plan?.kind,'gambling');assert.equal(gold.gambling,undefined);
});
test('fixed roulette bets stop at total losses; a win never restores the loss allowance',()=>{
 const s=start({lossLimit:10,profitTarget:100});settlePlan(s,100000,{random:sequence([0,.03,0])});
 assert.equal(s.report.rounds,3);assert.equal(s.report.losses,2);assert.equal(s.report.wins,1);assert.equal(s.report.totalLost,10);assert.equal(s.report.goldSpent,15);assert.equal(s.report.goldEarned,10);assert.equal(s.credits,195);assert.equal(s.report.reason,'gamble-loss-limit');assert.equal(s.stats.luckXp,6);assert(s.report.recent.every(r=>r.bet===5));
 settlePlan(s,200000,{random:()=>.03});assert.equal(s.credits,195);assert.equal(s.controlMode,'play');assert.match(autoStatus(s).reason,/loss/);
});
test('profit, reserve and round limits stop before another wager; insufficient allowance cannot overshoot',()=>{
 const won=start({profitTarget:5});settlePlan(won,100000,{random:()=>.03});assert.equal(won.report.rounds,1);assert.equal(won.credits,205);assert.equal(won.report.reason,'gamble-profit-target');assert.equal(autoStatus(won).outcome,'win');assert.match(autoStatus(won).gambleResult,/Won.*\+5 gold/);
 const reserve=start({reserveGold:198});assert.equal(reserve.report.rounds,0);assert.equal(reserve.credits,200);assert.equal(reserve.report.reason,'gold-reserve');
 const fractional=start({lossLimit:7,profitTarget:100});settlePlan(fractional,100000,{random:()=>0});assert.equal(fractional.report.rounds,1);assert.equal(fractional.report.totalLost,5);assert.equal(fractional.credits,195);
 const rounds=start({maxRounds:2,profitTarget:100});settlePlan(rounds,100000,{random:()=>.03});assert.equal(rounds.report.rounds,2);assert.equal(rounds.report.reason,'gamble-round-limit');
});
test('automatic blackjack uses the real dealer and fixed hit-below-17 policy',()=>{
 const s=start({game:'blackjack',maxRounds:1});settlePlan(s,31000,{random:sequence([.08,.1,.18,.12,.18])});
 assert.equal(s.gambling.round.player.length,3);assert.equal(s.report.recent[0].player,21);assert.equal(s.report.recent[0].dealer,17);assert.equal(s.report.recent[0].outcome,'win');assert.equal(s.credits,205);assert.equal(s.gambling.round.status,'complete');
 const push=start({game:'blackjack',maxRounds:1});settlePlan(push,31000,{random:()=>.18});assert.equal(push.report.pushes,1);assert.equal(push.credits,200);assert.equal(push.report.totalLost,0);
});
test('online and offline settlement share timing, payouts, Luck throttling and bounded recent results',()=>{
 const policy={lossLimit:100000,profitTarget:100000,maxRounds:1000},online=start(policy),offline=start(policy);
 for(let at=1000;at<=601000;at+=1000)settlePlan(online,at,{random:()=>.03});settlePlan(offline,601000,{random:()=>.03});
 for(const key of ['credits','stats'])assert.deepEqual(online[key],offline[key]);assert.equal(offline.plan.rounds,20);assert.equal(offline.plan.recent.length,8);assert.equal(online.plan.goldEarned,offline.plan.goldEarned);
 settlePlan(offline,24*3600000,{random:()=>.03});assert.equal(offline.report.reason,'away-cap');assert.equal(offline.report.rounds,960);assert.equal(offline.credits,5000);assert.equal(offline.stats.luckXp,1920);
});
test('Take control before a round stakes nothing and manual table actions cannot bypass a plan',()=>{
 const s=start();assert.equal(s.location,'lounge');assert.equal(s.plan.rounds,0);assert.throws(()=>gamblingAction(s,'gamble',{game:'roulette',bet:5,color:'red'},2000,()=>0),/Invalid table activity/);
 settlePlan(s,16000,{stop:true,random:()=>0});assert.equal(s.report.reason,'returned');assert.equal(s.report.rounds,0);assert.equal(s.credits,200);assert.equal(s.location,'home');
});
test('Auto and Rules show table choices, outcomes and loss totals without a blocking report',()=>{
 const s=start({lossLimit:10,profitTarget:100});settlePlan(s,31000,{random:()=>0});const info=autoStatus(s);assert.match(info.current,/Roulette/);assert.match(info.gambleResult,/Lost/);assert.equal(info.outcome,'lose');assert.match(info.decision,/5 \/ 10/);
 const g=boot(normalizeState({characterRules:{strategy:'gambling',gambling:{game:'blackjack',bet:10,lossLimit:20}}}));g.run('openAdvancedCharacterRules()');assert.equal(g.nodes.get('rulesGamblingPolicy').hidden,false);assert.equal(g.nodes.get('gambleAutoBet').value,10);assert.equal(g.nodes.get('gambleAutoColorField').hidden,true);assert.deepEqual(g.errors,[]);
});
test('concurrent API catch-up and retried stop requests settle one table round only',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());const clock=Date.now;let now=1000;Date.now=()=>now;t.after(()=>Date.now=clock);const origin='https://tower.test';let packet,cookie='';
 async function call(path,body){const response=await handlePlayerApi(new Request(origin+'/api/player/'+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify({...body,characterKey:packet?.characterKey}):undefined}),{TOWER_DB:db});cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;const data=await response.json();if(response.ok)packet=data;return {status:response.status,...data};}
 const act=(path,body)=>call(path,{revision:packet.revision,operation:crypto.randomUUID(),...body});
 await call('session',{legacy:{credits:200,avatar:{name:'Guest',outfit:6,hair:0},characterRules:{strategy:'gambling',gambling:{maxRounds:1,reserveGold:100}}}});assert.equal((await act('control',{mode:'auto'})).status,200);
 now=31000;const results=await Promise.all([call('state'),call('state')]);for(const r of results){assert.equal(r.status,200);assert.equal(r.state.report.rounds,1);assert.equal(r.state.gambling.round.status,'complete');assert.equal(r.state.stats.luckXp,2);}assert.equal(results[0].state.credits,results[1].state.credits);
 const credits=packet.state.credits,stop={mode:'play',revision:packet.revision,operation:crypto.randomUUID()};await call('control',stop);await call('control',stop);assert.equal(packet.state.credits,credits);assert.equal(packet.state.report.rounds,1);assert.equal(packet.state.characterRules.gambling.bet,5);
});
test('three-minute idle activation uses the selected table policy and never becomes a gold-earning goal',()=>{
 const s=normalizeState({credits:200,avatar:{name:'Guest',outfit:6,hair:0},characterRules:{enabled:true,strategy:'gambling',gambling:{reserveGold:100,maxRounds:1}}});s.routineLastSeen=1000;
 touchPresence(s,180999,{active:false,random:()=>0});assert.equal(s.plan,undefined);touchPresence(s,181000,{active:false,random:()=>0});assert.equal(s.plan.kind,'gambling');assert.equal(s.plan.rounds,0);
 touchPresence(s,211000,{active:false,random:()=>0});assert.equal(s.plan,undefined);assert.equal(s.report.rounds,1);assert.equal(s.report.reason,'gamble-round-limit');assert.equal(s.credits,195);
});
