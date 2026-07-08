const test=require('node:test');
const assert=require('node:assert/strict');
const RECALL=require('../../shared/recall-system');

test('recall question shuffles answers without losing the correct answer',()=>{
  const original=RECALL.QUESTIONS[0];
  const q=RECALL.shuffledQuestion(0,()=>0);
  assert.equal(q.answers[q.correct],original.answers[original.correct]);
  assert.equal(new Set(q.answers).size,original.answers.length);
  assert.equal(q.prompt,original.prompt);
});

test('recall tuning keeps answers available until the student chooses',()=>{
  assert.equal(RECALL.COOLDOWN_MS,0);
  assert.ok(RECALL.QUESTION_MS>=10*60*1000);
  assert.ok(RECALL.FREEZE_MS>=3000&&RECALL.FREEZE_MS<=5000);
  assert.ok(RECALL.RESTORE_FRACTION>0&&RECALL.RESTORE_FRACTION<=.25);
});

test('subject focus restricts Recall questions to the selected curriculum',()=>{
  for(const subject of RECALL.SUBJECTS){
    for(let i=0;i<8;i++)assert.equal(RECALL.shuffledQuestion(i,()=>.5,subject).subject,subject);
  }
});

test('spaced retrieval expands after success and returns mistakes soon',()=>{
  const q=RECALL.QUESTIONS.find(item=>item.subject==='English'),now=1_000_000;
  const wrong=RECALL.reviewQuestion({},q,false,now);
  assert.equal(wrong.record.nextDue-now,RECALL.RETRY_INTERVAL_MS);
  assert.equal(wrong.record.stage,0);
  const first=RECALL.reviewQuestion(wrong.history,q,true,now+RECALL.RETRY_INTERVAL_MS);
  assert.equal(first.record.nextDue-(now+RECALL.RETRY_INTERVAL_MS),RECALL.REVIEW_INTERVALS_MS[0]);
  const second=RECALL.reviewQuestion(first.history,q,true,first.record.nextDue);
  assert.equal(second.record.nextDue-first.record.nextDue,RECALL.REVIEW_INTERVALS_MS[1]);
  assert.equal(second.record.stage,2);
});

test('adaptive selection prioritises due work and interleaves topics',()=>{
  const pool=RECALL.QUESTIONS.filter(q=>q.subject==='English'),now=2_000_000;
  const history={items:{},lastQuestionId:pool[0].id,lastTopic:pool[0].topic,totalAttempts:5,totalCorrect:5};
  history.items[pool[0].id]={attempts:2,correct:1,stage:0,nextDue:now-1};
  history.items[pool[1].id]={attempts:3,correct:3,stage:2,nextDue:now-1};
  const selected=RECALL.selectQuestion('English',history,now,()=>0);
  assert.equal(selected.id,pool[1].id,'an alternate due topic is chosen instead of immediate repetition');
  assert.equal(selected.difficulty,2,'high recent success selects GCSE difficulty when available');
});

test('mastery summary reports accuracy, due work, and durable successes',()=>{
  const q=RECALL.QUESTIONS.find(item=>item.subject==='Computer Science');
  const history={items:{[q.id]:{attempts:5,correct:4,stage:4,nextDue:0}},totalAttempts:5,totalCorrect:4};
  const summary=RECALL.masterySummary(history,'Computer Science');
  assert.equal(summary.seen,1);assert.equal(summary.mastered,1);assert.equal(summary.due,1);assert.equal(summary.accuracy,.8);
});

test('Computer Science bank covers the current curriculum with stable validated items',()=>{
  const questions=RECALL.QUESTIONS.filter(q=>q.subject==='Computer Science');
  assert.ok(questions.length>=30,'the adaptive scheduler needs enough variation to space and interleave practice');
  assert.deepEqual(RECALL.validateQuestionBank(RECALL.QUESTIONS),[]);
  const topics=new Set(questions.map(q=>q.topic));
  for(const topic of ['Algorithms','Programming','Data representation','Computer systems','Networks','Cyber security','Databases','Impacts of technology'])assert.ok(topics.has(topic),topic);
  assert.ok(questions.every(q=>q.spec&&q.explanation.length>=20));
});

test('question validation rejects duplicate prompts and weak distractor sets',()=>{
  const base={id:'test_item_001',subject:'Computer Science',stage:'KS3',topic:'Algorithms',difficulty:1,spec:'DfE-KS3',prompt:'Which statement describes an algorithm?',answers:['A sequence of steps','A password','A password','A monitor'],correct:0,explanation:'An algorithm is a precise sequence of steps used to solve a problem.'};
  const errors=RECALL.validateQuestionBank([base,{...base,id:'test_item_002',answers:['A sequence of steps','A variable','A monitor','A router']}]);
  assert.ok(errors.some(error=>error.includes('four unique answers')));
  assert.ok(errors.some(error=>error.includes('duplicates a prompt')));
});
