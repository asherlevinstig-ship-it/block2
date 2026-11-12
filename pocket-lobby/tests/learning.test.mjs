import test from 'node:test';
import assert from 'node:assert/strict';
import {learningAction,publicLearning} from '../server/learning.mjs';
import {normalizeState} from '../server/player-state.mjs';
import {protectFishingState} from '../server/gameplay.mjs';
import {stopForActionPoints} from '../server/action-points.mjs';
import {availableActionPoints} from '../public/action-points.js';
import {handlePlayerApi} from '../server/player-api.mjs';
import {testDatabase} from './db-helper.mjs';
import {boot} from './helpers/game-client.mjs';

const character=()=>normalizeState({actionPoints:{value:0,at:1000,active:false}});
test('correct and incorrect submitted answers each earn exactly one AP with useful feedback',()=>{
 for(const correct of [true,false]){
  const s=character();learningAction(s,'next',{},1000,()=>0);
  const attempt=structuredClone(s.learning.attempt),choice=correct?attempt.answer:(attempt.answer+1)%4;
  assert.equal(s.actionPoints.value,0,'opening a question pays nothing');
  assert.equal(publicLearning(s.learning).attempt.answer,undefined,'answer key is hidden');
  learningAction(s,'answer',{attemptId:attempt.id,choice},2000);
  assert.equal(s.actionPoints.value,1);assert.equal(s.learning.last.correct,correct);
  assert.equal(s.learning.last.choices[s.learning.last.correctChoice],attempt.choices[attempt.answer]);
  assert.equal(s.learning.answered,1);assert.equal(s.learning.correct,Number(correct));
  learningAction(s,'answer',{attemptId:attempt.id,choice},3000);
  assert.equal(s.actionPoints.value,1);assert.equal(s.learning.answered,1);
 }
});

test('invalid answers never pay, current attempts survive reopening, and old attempts cannot be reused',()=>{
 const s=character();learningAction(s,'next',{},1000,()=>0);
 const first=structuredClone(s.learning.attempt);learningAction(s,'next',{},1100,()=>.5);assert.deepEqual(s.learning.attempt,first);
 for(const body of [{attemptId:'made-up',choice:0},{attemptId:first.id,choice:-1},{attemptId:first.id,choice:4},{attemptId:first.id,choice:'0'},{attemptId:first.id}])assert.throws(()=>learningAction(s,'answer',body),/Choose|changed/);
 assert.equal(s.actionPoints.value,0);
 learningAction(s,'answer',{attemptId:first.id,choice:0},2000);learningAction(s,'next',{},2100,()=>.5);
 const second=s.learning.attempt;learningAction(s,'answer',{attemptId:first.id,choice:0},2200);
 assert.equal(s.learning.attempt.id,second.id);assert.equal(s.actionPoints.value,1);
 learningAction(s,'answer',{attemptId:second.id,choice:0},2300);
 assert.throws(()=>learningAction(s,'answer',{attemptId:first.id,choice:0}),/changed/);
 assert.equal(s.actionPoints.value,2);
});

test('AP rewards obey the cap, do not regenerate with time, and never reconnect or restart Auto',()=>{
 const s=character();stopForActionPoints(s,1000);learningAction(s,'next',{},1001,()=>0);
 learningAction(s,'answer',{attemptId:s.learning.attempt.id,choice:0},2000);
 assert.equal(availableActionPoints(s.actionPoints,200000000),1);assert(s.autoDisconnected);assert(!s.plan);assert.equal(s.controlMode,'play');
 s.actionPoints.value=99;learningAction(s,'next',{},2100,()=>0);learningAction(s,'answer',{attemptId:s.learning.attempt.id,choice:0},2200);
 assert.equal(s.actionPoints.value,100);assert.throws(()=>learningAction(s,'next'),/full/);
});

test('saved snapshots cannot forge points, attempts or progress and normalization preserves trusted learning',()=>{
 const s=character();learningAction(s,'next',{},1000,()=>0);
 const forged={...structuredClone(s),actionPoints:{value:100},learning:{answered:999,attempt:{id:'forged',answer:0}}};
 const protectedState=protectFishingState(s,forged);assert.deepEqual(protectedState.learning,s.learning);assert.deepEqual(protectedState.actionPoints,s.actionPoints);
 assert.deepEqual(normalizeState(protectedState).learning,s.learning);
});

test('server generated maths questions have four distinct choices and the correct answer',()=>{
 let seed=831;const random=()=>((seed=(seed*16807)%2147483647)/2147483647);
 const s=character();
 for(let i=0;i<100;i++){
  s.actionPoints.value=0;learningAction(s,'next',{},1000,random);const q=s.learning.attempt;
  assert.equal(new Set(q.choices).size,4);const [a,op,b]=q.prompt.split(' '),x=Number(a),y=Number(b);
  const expected=op==='+'?x+y:op==='−'?x-y:op==='×'?x*y:x/y;
  assert.equal(Number(q.choices[q.answer]),expected);learningAction(s,'answer',{attemptId:q.id,choice:0},1001);
 }
});

test('API starts real characters at zero, rewards once under retries and preserves attempts across saves',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());let packet,cookie='';
 const env={TOWER_DB:db,SERVER_CHARACTER_STARTS:true};
 async function call(path,body,update=true){
  const response=await handlePlayerApi(new Request('https://tower.test/api/player/'+path,{method:body?'POST':'GET',headers:{Origin:'https://tower.test','Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify({...body,characterKey:packet?.characterKey}):undefined}),env);
  cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;const data=await response.json();if(response.ok&&update)packet=data;return {status:response.status,...data};
 }
 const act=(path,body={})=>call(path,{revision:packet.revision,operation:crypto.randomUUID(),...body});
 await call('session',{legacy:{actionPoints:{value:100},learning:{answered:100}}});
 assert.equal(packet.state.actionPoints.value,0);assert(!packet.state.learning);
 await act('create',{avatar:{name:'Learner',outfit:0,hair:0}});
 await act('learning/next');const attempt=packet.state.learning.attempt;assert(!('answer' in attempt));
 await act('save',{state:{...packet.state,learning:{answered:999},actionPoints:{value:100}}});
 assert.equal(packet.state.learning.attempt.id,attempt.id);assert.equal(packet.state.actionPoints.value,0);
 const body={revision:packet.revision,operation:crypto.randomUUID(),attemptId:attempt.id,choice:0};
 const results=await Promise.all([call('learning/answer',body,false),call('learning/answer',body,false)]);
 assert(results.some(r=>r.status===200));await call('state');assert.equal(packet.state.actionPoints.value,1);assert.equal(packet.state.learning.answered,1);
 await act('learning/answer',{attemptId:attempt.id,choice:0});assert.equal(packet.state.actionPoints.value,1);
 assert.equal((await act('learning/answer',{attemptId:'wrong',choice:0})).status,400);
 const row=sql.prepare('SELECT * FROM tower_players').get(),state=JSON.parse(row.state_json);stopForActionPoints(state,1000);
 sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(state),row.player_id);
 await call('state');await act('learning/next');await act('learning/answer',{attemptId:packet.state.learning.attempt.id,choice:0});
 assert.equal(packet.state.actionPoints.value,1);assert(packet.state.autoDisconnected);
 await act('reconnect');assert.equal(packet.state.actionPoints.value,1);assert(!packet.state.autoDisconnected);assert(!packet.state.plan);
});

test('first Auto lesson routes zero-point players to questions before starting their exploration job',()=>{
 const s=character();s.autoLesson='required';s.quest.accepted=true;const g=boot(s);let opens=0;
 g.context.towerLearning={open(){opens++;}};g.run('openAutoLesson()');
 assert.match(g.nodes.get('autoLessonStart').textContent,/Earn my first/);
 g.nodes.get('autoLessonStart').onclick();assert.equal(opens,1);assert(!g.nodes.get('autoLessonDialog').open);
});
