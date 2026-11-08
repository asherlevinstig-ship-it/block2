import test from 'node:test';import assert from 'node:assert/strict';import {createCombatClock} from '../public/combat-clock.js';
test('combat clock corrects device skew and advances with elapsed time despite wall-clock changes',()=>{
 let wall=1000,mono=10;const clock=createCombatClock({wallNow:()=>wall,monotonicNow:()=>mono});assert.equal(clock.now(),1000);
 mono=110;clock.sample(1700,10);assert.equal(clock.now(),1750);mono=260;assert.equal(clock.now(),1900);wall=-100000;assert.equal(clock.now(),1900);
 clock.sample(undefined,0);assert.equal(clock.now(),1900);
});
test('latency compensation is bounded and a new server sample refreshes the estimate',()=>{
 let mono=2000;const clock=createCombatClock({monotonicNow:()=>mono});clock.sample(5000,0);assert.equal(clock.now(),5150);
 mono=2100;clock.sample(5250,2080);assert.equal(clock.now(),5260);mono=2150;assert.equal(clock.now(),5310);
});
