import test from 'node:test';
import assert from 'node:assert/strict';
import {loungeHandValue,loungeRoundFeedback} from '../public/lounge-ui.js';
const cards=(...ranks)=>ranks.map(rank=>({rank,suit:0}));
const round={game:'blackjack',status:'complete',bet:5,player:cards(10,9),dealer:cards(10,8),luckXp:2};
test('visible totals handle soft aces and never reveal a hidden dealer total',()=>{
 assert.equal(loungeHandValue(cards(1,1,9)),21);assert.equal(loungeHandValue(cards(1,13,8)),19);
 assert.equal(loungeHandValue([{rank:10,suit:0},null]),null);
 assert.equal(loungeHandValue(cards(10,10,5)),25);
});
test('win feedback separates net profit from the payout and handles rounded natural blackjack',()=>{
 const win=loungeRoundFeedback({...round,outcome:'win',payout:10});assert.equal(win.net,5);assert.equal(win.payout,10);assert.equal(win.amount,'+5 gold');
 const natural=loungeRoundFeedback({...round,player:cards(1,13),outcome:'win',payout:12});assert.equal(natural.title,'Blackjack!');assert.equal(natural.net,7);assert.equal(natural.luckXp,2);
});
test('loss and draw feedback give accurate wallet changes without encouraging larger stakes',()=>{
 const lost=loungeRoundFeedback({...round,outcome:'lose',payout:0,player:cards(10,9,5)});assert.equal(lost.title,'You went over 21');assert.equal(lost.net,-5);assert.equal(lost.payout,0);
 const push=loungeRoundFeedback({...round,outcome:'push',payout:5,dealer:cards(10,9)});assert.equal(push.title,'Stake returned');assert.equal(push.net,0);assert.equal(push.amount,'0 gold lost');
});
test('roulette explains the actual result, including green zero losing both colors',()=>{
 for(const color of ['red','black']){const zero=loungeRoundFeedback({game:'roulette',status:'complete',outcome:'lose',bet:25,payout:0,number:0,resultColor:'green',color});assert.equal(zero.net,-25);assert.match(zero.detail,/0 green/);assert.match(zero.detail,new RegExp(color));}
 assert.equal(loungeRoundFeedback({game:'roulette',status:'complete',outcome:'win',bet:10,payout:20,number:7,resultColor:'red',color:'red'}).net,10);
});
test('unfinished rounds never manufacture an outcome or reward announcement',()=>{
 assert.equal(loungeRoundFeedback(null),null);assert.equal(loungeRoundFeedback({...round,status:'playing'}),null);
});
