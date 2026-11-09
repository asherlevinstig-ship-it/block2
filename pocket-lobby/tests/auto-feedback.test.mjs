import test from 'node:test';import assert from 'node:assert/strict';
import {createAutoFeedbackTracker,autoTableView,autoFishingProgress} from '../public/auto-feedback.js';import {normalizeState,settlePlan} from '../server/player-state.mjs';import {touchPresence} from '../server/routines.mjs';import {simpleAutoRules} from '../public/simple-auto.js';import {boot} from './helpers/game-client.mjs';
function gambling(game='roulette'){const s=normalizeState({credits:200,avatar:{name:'Guest',outfit:6,hair:0},characterRules:simpleAutoRules('gambling',{risk:'safe',game})});s.controlMode='auto';touchPresence(s,1000,{active:false,forceStart:true});return s;}
test('confirmed Auto wins and losses emit once with correct net gold and wallet changes',()=>{
 const s=gambling(),tracker=createAutoFeedbackTracker(s);tracker.update(s,{now:29000});settlePlan(s,31000,{random:()=>.03});const original=structuredClone(s),[win]=tracker.update(s,{now:31000});assert.match(win.title,/won/);assert.equal(win.gold,5);assert.equal(win.walletDelta,5);assert.match(win.detail,/Bet 5 gold/);assert.deepEqual(s,original);assert.deepEqual(tracker.update(s,{now:32000}),[]);
 tracker.update(s,{now:60000});settlePlan(s,61000,{random:()=>0});const [loss]=tracker.update(s,{now:61000});assert.equal(loss.outcome,'lose');assert.equal(loss.gold,-5);assert.equal(loss.walletDelta,-5);assert.deepEqual(tracker.update(s,{now:62000}),[]);
});
test('joining an existing session never replays old wins; hidden updates do not trigger rewards',()=>{
 const s=gambling();settlePlan(s,61000,{random:()=>.03});const tracker=createAutoFeedbackTracker(s);assert.deepEqual(tracker.update(s,{now:62000}),[]);settlePlan(s,91000,{random:()=>.03});assert.deepEqual(tracker.update(s,{now:91000,visible:false}),[]);assert.deepEqual(tracker.update(s,{now:92000}),[]);
});
test('offline catch-up is one accurate summary instead of a queue of old celebrations',()=>{
 const s=gambling(),tracker=createAutoFeedbackTracker(s);tracker.update(s,{now:2000});settlePlan(s,151000,{random:()=>.03});const events=tracker.update(s,{now:151000});assert.equal(events.length,1);assert.match(events[0].title,/away/);assert.match(events[0].detail,/5 rounds/);assert.equal(events[0].gold,25);
});
test('table shows countdown, playing and server-confirmed outcome, including completed reports',()=>{
 const s=gambling();assert.equal(autoTableView(s,10000).phase,'waiting');assert.equal(autoTableView(s,29000).phase,'playing');assert.equal(autoTableView(s,33000).outcome,'waiting');assert.equal(autoTableView(s,33000).amount,'Bet 5 gold');settlePlan(s,31000,{random:()=>.03});assert.equal(autoTableView(s,32000).title,'You won!');assert.equal(autoTableView(s,32000).amount,'+5 gold');assert.equal(autoTableView(s,40000).phase,'waiting');settlePlan(s,41000,{stop:true});assert.equal(autoTableView(s,42000).phase,'result');assert.equal(autoTableView({plan:{kind:'rest',source:'rules'}},1),null);
});
test('blackjack shows actual settled cards and pushes return the stake without a gold gain',()=>{
 const s=gambling('blackjack'),tracker=createAutoFeedbackTracker(s);tracker.update(s,{now:29000});settlePlan(s,31000,{random:()=>.18});const view=autoTableView(s,32000);assert.deepEqual(view.cards,s.gambling.round);const [push]=tracker.update(s,{now:31000});assert.equal(push.gold,0);assert.match(push.title,/Stake returned/);assert.match(push.detail,/No gold lost/);
});
test('fishing, sales, bait and recovery use authoritative cumulative changes',()=>{
 const s=normalizeState({credits:100,adventure:{discovered:['pond']},characterRules:simpleAutoRules('fishing',{risk:'safe'}),fishingGear:{ownedRods:['reed'],equippedRod:'reed',bait:0}});s.controlMode='auto';touchPresence(s,1000,{active:false,forceStart:true});const tracker=createAutoFeedbackTracker(s);tracker.update(s,{now:15000});settlePlan(s,16000);const [bait]=tracker.update(s,{now:16000});assert.match(bait.title,/Bait/);assert.equal(bait.gold,-10);tracker.update(s,{now:75000});settlePlan(s,76000,{random:()=>.5});assert.match(tracker.update(s,{now:76000})[0].title,/Fish/);assert.deepEqual(tracker.update(s,{now:77000}),[]);
 const rest={credits:90,health:50,plan:{source:'rules',kind:'queue',routineId:'rest-1',catches:{},goldEarned:0,goldSpent:0}};const heal=createAutoFeedbackTracker(rest);rest.health=100;assert.match(heal.update(rest,{now:1000})[0].detail,/50 HP/);
});
test('bank deposits are distinguished from earnings in Auto feedback',()=>{
 const s=gambling(),tracker=createAutoFeedbackTracker(s);tracker.update(s,{now:29000});settlePlan(s,31000,{random:()=>.03});s.plan.bankedGold=5;s.credits-=5;const event=tracker.update(s,{now:31000})[0];assert.equal(event.gold,5);assert.equal(event.walletDelta,0);assert.equal(event.banked,5);
});
test('game applies Auto feedback without repeated transaction cards or changes to the character',()=>{
 const s=gambling(),g=boot(s);g.context.updateState=structuredClone(s);g.run('towerApplyRoutineState(updateState)');assert.equal(g.nodes.get('autoTable').hidden,false);settlePlan(s,31000,{random:()=>.03});g.context.updateState=structuredClone(s);g.run('towerApplyRoutineState(updateState)');assert.equal(g.nodes.get('transactions').children.length,1);g.run('towerApplyRoutineState(updateState)');assert.equal(g.nodes.get('transactions').children.length,1);assert.equal(g.read('credits'),205);assert.deepEqual(g.errors,[]);
});

test('Auto fishing shows real countdown, batch progress and a clear overdue update state',()=>{
 const state={plan:{source:'rules',kind:'queue',queue:{steps:[{type:'fishing',amount:5}]},stepIndex:0,stepCount:2,catches:{silverfin:2},cursorAt:1000,nextAt:61000}};
 let view=autoFishingProgress(state,31000);assert.equal(view.seconds,30);assert.equal(view.progress,50);assert.match(view.detail,/2 \/ 5/);assert.equal(view.intervalSeconds,60);
 assert.equal(autoFishingProgress(state,62000).label,'Landing catch…');assert.equal(autoFishingProgress(state,78000).waiting,true);assert.match(autoFishingProgress(state,78000).label,/server update/);
 state.plan.stepCount=3;state.plan.catches.silverfin=3;state.plan.cursorAt=61000;state.plan.nextAt=121000;view=autoFishingProgress(state,62000);assert.equal(view.seconds,59);assert.match(view.detail,/3 \/ 5/);
 state.plan.queue.steps[0].type='sellFish';assert.equal(autoFishingProgress(state,62000),null);assert.equal(autoFishingProgress({report:state.plan},62000),null);
});
