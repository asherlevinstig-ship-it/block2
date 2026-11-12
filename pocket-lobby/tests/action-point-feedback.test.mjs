import test from 'node:test';import assert from 'node:assert/strict';
import {createAPSpendTracker,initializeActionPointFeedback} from '../public/action-point-feedback.js';
import {normalizeState} from '../server/player-state.mjs';
import {spendActionPoint,beginAutoPoints,releaseAutoPoints} from '../server/action-points.mjs';
import {normalizeMagic} from '../public/essences.js';
import {startCombatEncounter} from '../server/activities.mjs';import {huntEnemies} from '../public/hunting.js';
import {boot} from './helpers/game-client.mjs';
const packet=(revision,value,spent=0,key='learner')=>({revision,characterKey:key,state:{actionPoints:{value,spent}}});

test('spend effects use confirmed cumulative costs, not balance differences, and ignore replayed packets',()=>{
 const tracker=createAPSpendTracker(packet(10,5,100));
 assert.equal(tracker.update(packet(10,5,100)),null,'bootstrap and duplicate replies do not replay costs');
 assert.deepEqual(tracker.update(packet(11,5,101)),{balance:5,spent:1},'one earned and one spent point still shows the cost');
 assert.equal(tracker.update(packet(9,0,999)),null,'late replies cannot invent an effect');
 assert.deepEqual(tracker.update(packet(12,2,104)),{balance:2,spent:3},'quiet Auto batches produce one truthful total');
 assert.deepEqual(tracker.update(packet(13,3,104)),{balance:3,spent:0},'MCQ rewards have no spending effect');
 assert.deepEqual(tracker.update(packet(14,0,0)),{balance:0,spent:0},'testing resets rebase the counter');
 assert.deepEqual(tracker.update(packet(15,0,1)),{balance:0,spent:1});
 assert.deepEqual(tracker.update(packet(1,0,50,'other')),{balance:0,spent:0},'switching characters does not replay offline costs');
});

test('spend totals survive normalization, Auto start, release and exhaustion',()=>{
 const s=normalizeState({actionPoints:{value:3,at:1000}});spendActionPoint(s,1100);assert.equal(s.actionPoints.spent,1);
 beginAutoPoints(s,1200);assert.equal(s.actionPoints.spent,1);releaseAutoPoints(s,1300);assert.equal(normalizeState(s).actionPoints.spent,1);
 s.controlMode='auto';spendActionPoint(s,1400);spendActionPoint(s,1500);
 assert.equal(s.actionPoints.value,0);assert.equal(s.actionPoints.spent,3);assert(s.autoDisconnected);
});

test('zero-point guidance opens learning and confirmed effects clean up without polling',()=>{
 class Node{constructor(){this.children=[];this.dataset={};this.style={};}append(node){node.parent=this;this.children.push(node);}remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}setAttribute(){}getBoundingClientRect(){return {right:180,top:150};}}
 const row=new Node(),meter=new Node(),body=new Node(),doc={body,createElement:()=>new Node(),getElementById:id=>id==='vitalactionPointsRow'?row:meter},timers=[];let opened=0;
 const ui=initializeActionPointFeedback({doc,initial:packet(1,0),onEarn:()=>opened++,setTimeoutImpl:fn=>timers.push(fn)});
 const earn=row.children[0];assert(!earn.hidden);earn.onclick();assert.equal(opened,1);
 ui.update(packet(2,1));assert(earn.hidden);assert.equal(timers.length,0);
 ui.update(packet(3,0,1));const floats=body.children[0];assert.equal(floats.children[0].textContent,'−1 AP');assert(!earn.hidden);
 assert.match(body.children[1].textContent,/1 Action Point.*0 remaining/);
 ui.update(packet(3,0,1));assert.equal(floats.children.length,1);timers[0]();assert.equal(floats.children.length,0);
});

test('travel, combat, gathering and powers show their cost before use',()=>{
 const home=boot(normalizeState({location:'home'}));home.run('updateWorldLabels()');assert(home.nodes.get('worldLabels').children.some(n=>n.dataset.apCost==='1'));
 const fighter=normalizeState({location:'clearing',actionPoints:{value:0,at:1000}});fighter.magic=normalizeMagic({picks:['fire','ice','shadow'],unlocked:['fire:sword'],slots:{q:'fire:sword'}});startCombatEncounter(fighter,huntEnemies.boar,1000);
 const g=boot(fighter);g.context.playerCloud.initial=fighter;g.run('updateCombatPanel();updateEssenceHotbar(1000)');
 assert.match(g.nodes.get('combatAttack').textContent,/1 AP/);assert.match(g.nodes.get('essenceHotbarStatus').textContent,/1 AP.*10 MP/);assert.match(g.nodes.get('essenceHotbarStatus').textContent,/Answer questions/);assert.equal(g.read("equippedEssenceStatus(1000,'q').canCast"),false);
 const wood=boot(normalizeState({location:'logging',woodcutting:{axeOwned:true,equipped:true}}));wood.run('updateWoodPanel()');assert.match(wood.nodes.get('woodAction').textContent,/1 AP \/ cut/);
 const fishing=boot(normalizeState({location:'pond'}));assert.match(fishing.read('currentActivityPrompt().text'),/1 AP/);
});
