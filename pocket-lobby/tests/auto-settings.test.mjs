import test from 'node:test';import assert from 'node:assert/strict';
import {saveAutoSettings} from '../server/auto-settings.mjs';import {normalizeState,settlePlan} from '../server/player-state.mjs';import {touchPresence} from '../server/routines.mjs';import {normalizeCharacterRules} from '../public/character-rules.js';import {protectFishingState} from '../server/gameplay.mjs';import {boot} from './helpers/game-client.mjs';import {createHunt} from '../public/hunting.js';
const base=()=>normalizeState({quest:{accepted:true},bedLessonComplete:true,location:'home',adventure:{discovered:['pond']},history:{fishCaught:true},characterRules:{enabled:true,activity:'fishing',keepBait:0},fishingGear:{ownedRods:['reed'],equippedRod:'reed',bait:10}});
const combatPlan=()=>({enabled:true,activity:'rest',queue:{enabled:true,steps:[{type:'huntBoars',amount:3}],repeats:1,budget:0,reserveGold:100,minHealth:60},combat:{enabled:true,dodge:true,fleeBelow:20,style:'cautious'}});
test('saving a combat plan during Auto stages changes without mutating its current queue or tactics',()=>{
 const s=base();s.controlMode='auto';s.routineLastSeen=1000;touchPresence(s,1000,{forceStart:true,active:false});const plan=structuredClone(s.plan),old=structuredClone(s.characterRules);
 saveAutoSettings(s,combatPlan(),2000);assert.deepEqual(s.plan,plan);assert.deepEqual(s.characterRules,old);assert.equal(s.pendingCharacterRules.queue.steps[0].type,'huntBoars');assert.equal(s.pendingCharacterRules.combat.style,'cautious');
 assert.deepEqual(normalizeState(s).pendingCharacterRules,s.pendingCharacterRules);
 settlePlan(s,3000,{stop:true});assert.equal(s.pendingCharacterRules,undefined);assert.equal(s.characterRules.combat.style,'cautious');assert.equal(s.characterRules.queue.steps[0].type,'huntBoars');assert.equal(s.report.reason,'returned');
});
test('offline completion applies queued rules exactly once and last saved edit wins',()=>{
 const s=base();s.controlMode='auto';s.routineLastSeen=1000;touchPresence(s,1000,{forceStart:true,active:false});saveAutoSettings(s,combatPlan(),2000);saveAutoSettings(s,{...combatPlan(),combat:{enabled:true,style:'aggressive'}},3000);
 settlePlan(s,8*3600000+1000);assert.equal(s.pendingCharacterRules,undefined);assert.equal(s.characterRules.combat.style,'aggressive');const before=structuredClone(s.characterRules);settlePlan(s,9*3600000);assert.deepEqual(s.characterRules,before);
});
test('active Auto combat can stage settings, but manual fights and job-board shifts remain protected',()=>{
 const s=base();s.location='clearing';s.hunting.encounter=createHunt(1000);s.plan={source:'rules',kind:'queue',activeHunt:true};saveAutoSettings(s,combatPlan(),1500);assert.equal(s.pendingCharacterRules.combat.enabled,true);assert.equal(s.hunting.encounter.nextBoarAt,2300);
 delete s.plan;assert.throws(()=>saveAutoSettings(s,combatPlan(),1600),/manual fight/);s.hunting.encounter=null;s.plan={source:'board'};assert.throws(()=>saveAutoSettings(s,combatPlan(),1700),/job-board/);
});
test('disabled hunting queues do not invalidate unrelated combat retreat choices; enabled queues still validate',()=>{
 assert.doesNotThrow(()=>normalizeCharacterRules({combat:{enabled:true,fleeBelow:70},queue:{enabled:false,minHealth:60,steps:[{type:'huntBoars',amount:1}]}}));
 assert.throws(()=>normalizeCharacterRules({combat:{enabled:true,fleeBelow:70},queue:{enabled:true,minHealth:60,steps:[{type:'huntBoars',amount:1}]}}),/start-health/);
});
test('Auto Mode keeps Save available during sessions and shows validation errors at the footer',()=>{
 const s=base(),g=boot(s);s.plan={source:'rules',kind:'fishing'};g.context.playerCloud.initial=s;g.run('openAdvancedCharacterRules()');assert.equal(g.nodes.get('rulesSave').disabled,false);assert.equal(g.nodes.get('rulesSave').textContent,'Save for next session');
 g.run("$('rulesCombatEnabled').checked=true;$('rulesCombatFlee').value=70;$('rulesUseQueue').checked=false;ruleQueueDraft=[{type:'huntBoars',amount:1}];updateCharacterRulesPreview()");assert.equal(g.nodes.get('rulesSave').disabled,false);
 g.run("$('rulesUseQueue').checked=true;updateCharacterRulesPreview()");assert.equal(g.nodes.get('rulesSave').disabled,true);assert.match(g.nodes.get('rulesStatus').textContent,/start-health/);
 g.run("$('rulesCombatFlee').value=20;updateCharacterRulesPreview()");assert.equal(g.nodes.get('rulesSave').disabled,false);assert.equal(g.nodes.get('rulesStatus').textContent,'');
 s.pendingCharacterRules=normalizeCharacterRules(combatPlan());g.run('openAdvancedCharacterRules()');assert.equal(g.nodes.get('rulesCombatEnabled').checked,true);assert.equal(g.nodes.get('rulesCombatStyle').value,'cautious');
});
test('snapshot saves cannot forge or erase staged Auto settings',()=>{
 const s=base(),fake=structuredClone(s);fake.pendingCharacterRules=normalizeCharacterRules(combatPlan());assert.equal(protectFishingState(s,fake).pendingCharacterRules,undefined);
 s.pendingCharacterRules=normalizeCharacterRules(combatPlan());const next=structuredClone(s);delete next.pendingCharacterRules;assert.deepEqual(protectFishingState(s,next).pendingCharacterRules,s.pendingCharacterRules);
});
