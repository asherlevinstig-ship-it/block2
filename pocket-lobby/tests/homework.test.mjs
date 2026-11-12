import test from 'node:test';import assert from 'node:assert/strict';
import {learningAction,publicLearning} from '../server/learning.mjs';
import {normalizeState} from '../server/player-state.mjs';
const student=(value=0)=>normalizeState({actionPoints:{value,at:1000,active:false}});
function answer(state,now,correct=true){learningAction(state,'next',{},now,()=>0);const q=state.learning.attempt;learningAction(state,'answer',{attemptId:q.id,choice:correct?q.answer:(q.answer+1)%4},now+1);return q.id;}

test('ten submitted questions complete one homework session and earn exactly ten points without a completion bonus',()=>{
 const s=student();for(let i=0;i<10;i++)answer(s,1000+i*100,i%2===0);
 assert.deepEqual({...s.learning.session,id:undefined},{id:undefined,target:10,answered:10,correct:5,earned:10,startedAt:1000,completedAt:1901});
 assert.equal(s.actionPoints.value,10);assert.equal(s.learning.answered,10);assert(!s.plan);assert.equal(s.controlMode,'play');
 const id=s.learning.last.id;learningAction(s,'answer',{attemptId:id,choice:0},3000);assert.equal(s.learning.session.answered,10);assert.equal(s.actionPoints.value,10);
 const saved=normalizeState(s);assert.deepEqual(saved.learning.session,s.learning.session);assert.deepEqual(publicLearning(saved.learning).session,s.learning.session);
});

test('unfinished homework resumes the same question and completed sessions roll over only on a new question request',()=>{
 const s=student();for(let i=0;i<4;i++)answer(s,1000+i*100);
 learningAction(s,'next',{},1500,()=>0);const id=s.learning.attempt.id,session=s.learning.session.id;
 const restored=normalizeState(s);learningAction(restored,'next',{},1600,()=>.5);
 assert.equal(restored.learning.attempt.id,id);assert.equal(restored.learning.session.id,session);assert.equal(restored.learning.session.answered,4);
 learningAction(restored,'answer',{attemptId:id,choice:0},1700);
 for(let i=0;i<5;i++)answer(restored,1800+i*100);
 assert.equal(restored.learning.session.answered,10);assert.equal(restored.learning.recentSessions,undefined);
 learningAction(restored,'next',{},3000,()=>0);assert.notEqual(restored.learning.session.id,session);assert.equal(restored.learning.session.answered,0);assert.equal(restored.learning.recentSessions.length,1);assert.equal(restored.actionPoints.value,10);
});

test('homework can finish with full AP and records the actual points awarded',()=>{
 const s=student(97);for(let i=0;i<10;i++)answer(s,1000+i*100,false);
 assert.equal(s.learning.session.answered,10);assert.equal(s.learning.session.correct,0);assert.equal(s.learning.session.earned,3);assert.equal(s.actionPoints.value,100);
 assert.equal(s.learning.last.awarded,0);assert(s.learning.last.explanation);
});

test('homework history is bounded and completion at timestamp zero still starts a fresh session',()=>{
 const s=student();for(let i=0;i<80;i++){s.actionPoints.value=0;answer(s,1000+i*100);}
 assert.equal(s.learning.recentSessions.length,5);assert(s.learning.recentSessions.every(session=>session.answered===10));
 s.learning.session.completedAt=0;const id=s.learning.session.id;learningAction(s,'next',{},10000,()=>0);assert.notEqual(s.learning.session.id,id);
});

test('worked explanations cover all four operations without disclosing the current answer key',()=>{
 for(const kind of [0,1,2,3]){
  const s=student();let call=0;const random=()=>++call===3?(kind+.1)/4:0;
  learningAction(s,'next',{},1000,random);const question=s.learning.attempt;
  assert(!('explanation' in publicLearning(s.learning).attempt));assert(!('answer' in publicLearning(s.learning).attempt));
  learningAction(s,'answer',{attemptId:question.id,choice:question.answer},1001);
  assert.match(s.learning.last.explanation,kind===0?/count/:kind===1?/adding back/:kind===2?/groups/:/because/);
 }
});
