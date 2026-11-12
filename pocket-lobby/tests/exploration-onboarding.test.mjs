import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeState,settlePlan} from '../server/player-state.mjs';
import {configureExplorerLesson,EXPLORE_STOP_MS as S,explorationStops} from '../server/exploration-plan.mjs';
import {touchPresence} from '../server/routines.mjs';
import {protectFishingState,applyGameplayAction} from '../server/gameplay.mjs';
import {AWAY_GRACE_MS as G} from '../public/character-rules.js';
import {autoStatus} from '../public/auto-mode.js';
import {boot} from './helpers/game-client.mjs';
import {handlePlayerApi} from '../server/player-api.mjs';
import {testDatabase} from './db-helper.mjs';
const fresh=()=>normalizeState({autoLesson:'required',quest:{accepted:true},location:'hub',position:{x:10,y:4},bedLessonComplete:true});
const begin=(s,now=1000)=>{configureExplorerLesson(s,now);s.controlMode='auto';touchPresence(s,now,{forceStart:true,active:false});};
test('required starter quest saves a peaceful job with idle start and no tools or gold requirement',()=>{
 const s=fresh();s.credits=0;s.fishingGear.equippedRod=null;s.combatGear.equippedWeapon=null;begin(s);
 assert.equal(s.autoLesson,'complete');assert.equal(s.autoConfigured,true);assert.equal(s.characterRules.activity,'exploring');assert.equal(s.characterRules.enabled,true);assert.equal(s.plan.kind,'exploring');assert.equal(s.location,'outside');
 assert.match(autoStatus(s).current,/Exploring/);assert.equal(autoStatus(s).progress,0);
 assert.throws(()=>configureExplorerLesson(s,2000),/already set/);
 assert.equal(normalizeState(s).autoLesson,'complete');
});
test('live and offline exploration record identical peaceful discoveries with no fabricated rewards',()=>{
 const live=fresh(),offline=fresh();begin(live);begin(offline);const before=JSON.stringify({credits:live.credits,stats:live.stats,fish:live.fishStock,bait:live.fishingGear.bait,wood:live.woodcutting.timber,quest:live.quest});
 for(let i=1;i<=explorationStops.length;i++)settlePlan(live,1000+i*S);
 settlePlan(offline,1000+8*3600000);
 assert.deepEqual(live.adventure,offline.adventure);assert.deepEqual(live.adventure.discovered,['trail','creek','pond','logging']);
 assert.equal(JSON.stringify({credits:live.credits,stats:live.stats,fish:live.fishStock,bait:live.fishingGear.bait,wood:live.woodcutting.timber,quest:live.quest}),before);
 assert.equal(live.location,'home');assert.equal(live.report.reason,'exploration-complete');assert.equal(live.activityLog[0].count,5);assert.equal(offline.activityLog[0].count,5);
 assert.equal(settlePlan(offline,1000+9*3600000),false);assert.equal(offline.activityLog.length,1);
});
test('saved exploration starts after the idle deadline, stops on control and never visits danger or gated routes',()=>{
 const s=fresh();configureExplorerLesson(s,1000);touchPresence(s,1000+G-1,{active:false});assert.equal(s.plan,undefined);
 touchPresence(s,1000+G,{active:false});assert.equal(s.plan.kind,'exploring');
 settlePlan(s,1000+G+S);assert.equal(s.location,'trail');settlePlan(s,1000+G+S+1,{stop:true});
 assert.equal(s.location,'home');assert.equal(s.report.reason,'returned');assert.deepEqual(s.adventure.discovered,[]);
 assert(explorationStops.every(stop=>!['ruins','clearing','shrine','roots','depthsGate'].includes(stop.room)));
});
test('lesson progress cannot be skipped or regressed by client snapshots and Warden reward waits for setup',()=>{
 const s=fresh(),forged=normalizeState({...s,autoLesson:'complete'});
 assert.equal(protectFishingState(s,forged).autoLesson,'required');
 s.quest={accepted:true,fish:3,boars:1,sold:true,claimed:false};assert.throws(()=>applyGameplayAction(s,'quest',{},1000),/First Auto Job/);
 s.autoLesson='complete';assert.equal(protectFishingState(s,normalizeState({...s,autoLesson:'required'})).autoLesson,'complete');
 const noWarden=normalizeState({autoLesson:'required'});assert.throws(()=>configureExplorerLesson(noWarden,1000),/Warden/);
 const busy=fresh();busy.hunting.recoveryUntil=2000;assert.throws(()=>configureExplorerLesson(busy,1000),/finishing/);
});
test('on-screen quest appears after Warden acceptance and yields to the bed tutorial and active Auto',()=>{
 const s=fresh(),g=boot(s);g.context.playerCloud.initial=s;g.run('updateBedGuide();updateAutoLessonGuide()');assert.equal(g.nodes.get('autoLessonGuide').hidden,false);
 g.run('updateActivityPrompt()');assert.equal(g.nodes.get('contextGuide').hidden,true);
 s.autoLesson='complete';g.run('updateAutoLessonGuide()');assert.equal(g.nodes.get('autoLessonGuide').hidden,true);
 s.autoLesson='required';g.run('quest.accepted=false;updateBedGuide();updateAutoLessonGuide()');assert.equal(g.nodes.get('autoLessonGuide').hidden,true);
});
test('new-character API requires setup, saves and starts atomically, and duplicate requests do not restart it',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());let packet,cookie='';const origin='https://tower.test';
 async function call(path,body){const response=await handlePlayerApi(new Request(origin+'/api/player/'+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify({...body,characterKey:packet?.characterKey}):undefined}),{TOWER_DB:db});cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;const data=await response.json();if(response.ok)packet=data;return {status:response.status,...data};}
 const act=(path,body={})=>call(path,{revision:packet.revision,operation:crypto.randomUUID(),...body});
 await call('session',{newCharacter:true,legacy:{quest:{accepted:true},bedLessonComplete:true,location:'hub',position:{x:10,y:4}}});assert.equal(packet.state.autoLesson,'required');
 await act('create',{avatar:{name:'Explorer',outfit:0,hair:0}});
 assert.equal((await act('rules/save',{rules:{enabled:true,activity:'rest'}})).status,400);
 assert.equal(packet.state.actionPoints.value,0);
 await act('learning/next');await act('learning/answer',{attemptId:packet.state.learning.attempt.id,choice:0});
 const body={revision:packet.revision,operation:crypto.randomUUID()};const started=await call('auto/explore/setup',body);assert.equal(started.status,200,JSON.stringify(started));assert.equal(started.state.autoLesson,'complete');assert.equal(started.state.plan.kind,'exploring');
 const repeat=await call('auto/explore/setup',body);assert.equal(repeat.status,200);assert.equal(repeat.state.plan.startedAt,started.state.plan.startedAt);
 await act('control',{mode:'play'});await act('report/ack',{startedAt:packet.state.report.startedAt});
 await act('save',{state:{...packet.state,autoLesson:'required'}});assert.equal(packet.state.autoLesson,'complete');
 assert.equal((await act('rules/save',{rules:{enabled:false,activity:'rest'}})).status,200);
});
