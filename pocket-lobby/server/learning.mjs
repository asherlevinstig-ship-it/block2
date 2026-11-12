import {availableActionPoints,MAX_ACTION_POINTS} from '../public/action-points.js';
const invalid=message=>Object.assign(new Error(message),{status:400});

// Starter maths questions live on the server. Only the public question is sent
// before submission; saved client state cannot replace an attempt or its reward.
export function publicLearning(learning){
 if(!learning)return undefined;
 const {attempt,...progress}=learning;
 return {...progress,...(attempt?{attempt:{id:attempt.id,prompt:attempt.prompt,choices:attempt.choices}}:{})};
}

export function learningAction(state,action,body={},now=Date.now(),random=Math.random){
 const learning=state.learning??={answered:0,correct:0};
 if(action==='next'){
  if(learning.attempt)return;
  if(availableActionPoints(state.actionPoints,now)>=MAX_ACTION_POINTS)throw invalid('Your Action Points are full. Use some in Auto Mode, then come back.');
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
 const correct=body.choice===attempt.answer,before=availableActionPoints(state.actionPoints,now),value=Math.min(MAX_ACTION_POINTS,before+1);
 state.actionPoints={...state.actionPoints,value,at:now};
 if(before===0&&state.hunting?.encounter)state.hunting.encounter.nextPlayerAt=Math.max(now,state.hunting.encounter.nextPlayerAt);
 learning.answered++;if(correct)learning.correct++;
 learning.last={id:attempt.id,correct,choice:body.choice,correctChoice:attempt.answer,prompt:attempt.prompt,choices:attempt.choices,awarded:value-before,balance:value};
 delete learning.attempt;
 // Earning points does not reconnect a depleted player or restart saved Auto.
}
