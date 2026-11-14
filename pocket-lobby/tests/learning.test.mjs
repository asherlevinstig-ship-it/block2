import test from 'node:test';
import assert from 'node:assert/strict';
import {learningAction,publicLearning} from '../server/learning.mjs';
import {normalizeState} from '../server/player-state.mjs';
import {protectFishingState} from '../server/gameplay.mjs';
import {stopForActionPoints} from '../server/action-points.mjs';
import {availableActionPoints} from '../public/action-points.js';
import {handleAccountApi} from '../server/accounts.mjs';
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
 assert.equal(s.actionPoints.value,100);learningAction(s,'next',{},2300,()=>0);learningAction(s,'answer',{attemptId:s.learning.attempt.id,choice:0},2400);
 assert.equal(s.actionPoints.value,100);assert.equal(s.learning.last.awarded,0);assert.equal(s.learning.session.answered,3,'homework remains available at the AP cap');
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

test('the world character meditates while the question screen is open and stands when it closes',()=>{
 const g=boot(character()),draw=g.context.towerCharacterArt.draw,poses=[];
 g.context.towerCharacterArt.draw=(ctx,x,y,appearance,options)=>{if(appearance.name==='Guest')poses.push(options);return draw(ctx,x,y,appearance,options);};
 g.context.towerLearning={active:true};g.run('draw(2000)');assert(poses.at(-1).meditating);
 g.context.towerLearning.active=false;g.run('draw(2100)');assert(!poses.at(-1).meditating);
});

test('linked students receive eligible Nights questions and Tower awards AP once',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());
 let packet,cookie='',eligible=true,available=true;
 const requests=[];
 const env={TOWER_DB:db,SERVER_CHARACTER_STARTS:true,LIVEWEAVE_AUTH_URL:'https://liveweave.test/tower-auth.php',
  LIVEWEAVE_AUTH_SECRET:'a'.repeat(64),LIVEWEAVE_FETCH:async(url,init)=>{
   assert.equal(url.pathname,'/tower-questions.php');
   assert.equal(init.headers.Authorization,'Bearer '+'a'.repeat(64));
   const request=JSON.parse(init.body);requests.push(request);
   assert.equal(request.studentId,21);assert.equal(request.schoolId,7);
   if(request.questionId)return Response.json({eligible:request.questionId===71?eligible:true});
   const id=request.seen.includes(71)?72:71;
   const subjects=[{code:'0478',name:'Computer Science'},{code:'0417',name:'ICT'}];
   const track=request.track??'0478';
   return Response.json({subjects,track,question:available&&subjects.some(subject=>subject.code===track)?{id,prompt:'What does this loop output?',source:'FOR i ← 1 TO 3',choices:['0','1','2','3'],answer:3,explanation:'It runs three times.',course:'Computer Science',topic:'Programming'}:null});
  }};
 async function call(path,body){
  const account=path.startsWith('account/');
  const response=await (account?handleAccountApi:handlePlayerApi)(new Request('https://tower.test/api/'+path,{
   method:body?'POST':'GET',headers:{Origin:'https://tower.test','Content-Type':'application/json',Cookie:cookie},
   body:body?JSON.stringify({...body,characterKey:packet?.characterKey}):undefined
  }),env);
  for(const header of response.headers.getSetCookie()){
   const pair=header.split(';')[0];
   if(!pair.endsWith('='))cookie=pair;
  }
  const data=await response.json();
  if(response.ok&&data.characterKey)packet=data;
  return {status:response.status,data};
 }
 const act=(path,body={})=>call('player/learning/'+path,{revision:packet.revision,operation:crypto.randomUUID(),...body});
 await call('player/session',{});
 await act('next');
 const maths=packet.state.learning.attempt;
 assert.equal((await call('account/register',{username:'LinkedLearner',password:'a sufficiently long passphrase'})).status,200);
 const account=sql.prepare('SELECT account_id FROM tower_accounts').get();
 sql.prepare('INSERT INTO tower_external_accounts VALUES (?,?,?,?,?)').run('liveweave','student:21',7,account.account_id,1);
 await call('player/state');
 assert.equal((await act('answer',{attemptId:maths.id,choice:0})).status,422);
 assert.equal((await act('next',{studentId:999,schoolId:999})).status,200);
 const first=packet.state.learning.attempt;
 assert.equal(first.topic,'Programming');
 assert.equal(first.source,'FOR i ← 1 TO 3');
 assert(!('answer' in first));assert(!('explanation' in first));
 eligible=false;
 assert.equal((await act('answer',{attemptId:first.id,choice:0})).data.code,'curriculum-changed');
 assert.equal((await act('next')).status,200);
 assert.deepEqual(requests.at(-1).seen,[71]);
 const second=packet.state.learning.attempt;
 assert.notEqual(second.id,first.id);
 const answer={attemptId:second.id,choice:0};
 assert.equal((await act('answer',answer)).status,200);
 assert.equal(packet.state.learning.last.correct,false);
 assert.equal(packet.state.learning.last.explanation,'It runs three times.');
 assert.equal(packet.state.actionPoints.value,1);
 assert.equal((await act('answer',answer)).status,200);
 assert.equal(packet.state.actionPoints.value,1);
 assert.equal(packet.state.learning.track,'0478');
 assert.equal(packet.state.learning.subjects.length,2);
 assert.equal((await act('next',{track:'0417'})).status,200);
 const switched=packet.state.learning.attempt;
 assert.equal(packet.state.learning.track,'0417');
 assert.equal(packet.state.learning.session.answered,1);
 assert.equal(packet.state.actionPoints.value,1);
 assert.equal((await act('next',{track:'9999'})).status,422);
 assert.equal(packet.state.learning.attempt.id,switched.id);
 assert.equal((await act('answer',{attemptId:switched.id,choice:3})).status,200);
 assert.equal((await act('next')).status,200);
 assert.equal(requests.at(-1).track,'0417');
 assert.equal(packet.state.actionPoints.value,2);
 eligible=false;
 available=false;
 assert.equal((await act('next',{track:'0478'})).status,422);
 assert.equal(packet.state.actionPoints.value,2);
});
