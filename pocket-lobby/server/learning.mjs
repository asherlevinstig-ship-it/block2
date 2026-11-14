import {normalizeActionPoints,MAX_ACTION_POINTS} from '../public/action-points.js';
const invalid=message=>Object.assign(new Error(message),{status:400});
export const HOMEWORK_QUESTIONS=10;
function ensureSession(learning,now,{next=false}={}){
 if(!learning.session||next&&Number.isFinite(learning.session.completedAt)){
  if(learning.session)learning.recentSessions=[...(learning.recentSessions??[]),learning.session].slice(-5);
  learning.session={id:crypto.randomUUID(),target:HOMEWORK_QUESTIONS,answered:0,correct:0,earned:0,startedAt:now};
 }
 return learning.session;
}
function explainMaths(prompt,answer){
 const [left,op,right]=prompt.split(' '),a=Number(left),b=Number(right);
 if(!Number.isFinite(a)||!Number.isFinite(b))return 'The correct answer is '+answer+'.';
 if(op==='−')return `${a} − ${b} = ${answer}. Check by adding back: ${answer} + ${b} = ${a}.`;
 if(op==='÷')return `${a} ÷ ${b} = ${answer}, because ${b} × ${answer} = ${a}.`;
 if(op==='×'&&b>=10){const tens=Math.floor(b/10)*10,ones=b-tens;return `${a} × ${tens} = ${a*tens} and ${a} × ${ones} = ${a*ones}. Add them: ${a*tens} + ${a*ones} = ${answer}.`;}
 if(op==='×')return `${a} × ${b} means ${a} groups of ${b}. Together they make ${answer}.`;
 return `${a} + ${b} = ${answer}. Start at ${a} and count ${b} more.`;
}

// Starter maths questions live on the server. Only the public question is sent
// before submission; saved client state cannot replace an attempt or its reward.
export function publicLearning(learning){
 if(!learning)return undefined;
 const {attempt,...progress}=learning;
 return {...progress,...(attempt?{attempt:{id:attempt.id,prompt:attempt.prompt,choices:attempt.choices,source:attempt.source,topic:attempt.topic,course:attempt.course}}:{})};
}

export function learningAction(state,action,body={},now=Date.now(),random=Math.random,curriculum=null){
 const learning=state.learning??={answered:0,correct:0};
 if(action==='next'){
  ensureSession(learning,now,{next:!learning.attempt});
  if(learning.attempt)return;
  if(curriculum){
   const {id:questionId,...question}=curriculum;
   learning.attempt={...question,id:crypto.randomUUID(),questionId};
   const seen=learning.session.questionIds??=[];
   if(!seen.includes(questionId))learning.session.questionIds=[...seen,questionId].slice(-HOMEWORK_QUESTIONS);
   return;
  }
  const n=max=>Math.floor(random()*max),a=2+n(19),b=2+n(11),kind=n(4);
  const [prompt,answer]=kind===0?[`${a} + ${b} = ?`,a+b]:kind===1?[`${a+b} − ${b} = ?`,a]:kind===2?[`${a} × ${b} = ?`,a*b]:[`${a*b} ÷ ${b} = ?`,a];
  const choices=[answer,answer+1,answer+3,Math.max(0,answer-2)];
  for(let i=choices.length-1;i>0;i--){const j=n(i+1);[choices[i],choices[j]]=[choices[j],choices[i]];}
  learning.attempt={id:crypto.randomUUID(),prompt,choices:choices.map(String),answer:choices.indexOf(answer)};
  return;
 }
 if(action!=='answer')throw invalid('Choose a learning action.');
 if(!Number.isInteger(body.choice)||body.choice<0||body.choice>3)throw invalid('Choose one answer before submitting.');
 // Replaying an answer, even with a different HTTP operation, never pays twice.
 if(body.attemptId===learning.last?.id)return;
 const attempt=learning.attempt;
 if(!attempt||body.attemptId!==attempt.id)throw invalid('This question has changed. Open the current question and try again.');
 const correct=body.choice===attempt.answer,before=normalizeActionPoints(state.actionPoints).value,value=Math.min(MAX_ACTION_POINTS,before+1);
 const session=ensureSession(learning,now);session.answered++;if(correct)session.correct++;session.earned+=value-before;
 if(session.answered===session.target)session.completedAt=now;
 state.actionPoints={...state.actionPoints,value,at:now};
 if(before===0&&state.hunting?.encounter)state.hunting.encounter.nextPlayerAt=Math.max(now,state.hunting.encounter.nextPlayerAt);
 learning.answered++;if(correct)learning.correct++;
 learning.last={id:attempt.id,correct,choice:body.choice,correctChoice:attempt.answer,prompt:attempt.prompt,choices:attempt.choices,explanation:attempt.questionId?(attempt.explanation||'The correct answer is '+attempt.choices[attempt.answer]+'.'):explainMaths(attempt.prompt,attempt.choices[attempt.answer]),awarded:value-before,balance:value};
 delete learning.attempt;
 // Earning points does not reconnect a depleted player or restart saved Auto.
}
