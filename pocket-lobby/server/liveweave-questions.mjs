const availabilityError=()=>Object.assign(new Error('LiveWeave questions are temporarily unavailable. Try again shortly.'),{status:503});
const positive=value=>Number.isSafeInteger(value)&&value>0;

export async function liveWeaveStudent(env,account){
 if(!account)return null;
 const row=await env.TOWER_DB.prepare("SELECT subject, school_id FROM tower_external_accounts WHERE provider='liveweave' AND account_id=?").bind(account.id).first();
 const match=/^student:([1-9]\d*)$/.exec(row?.subject??'');
 return match?{studentId:Number(match[1]),schoolId:row.school_id}:null;
}

export async function curriculumRequest(env,student,options){
 if(!positive(student.studentId)||!positive(student.schoolId))return {};
 try{
  const url=new URL('/tower-questions.php',env.LIVEWEAVE_AUTH_URL);
  if(url.protocol!=='https:'||!/^[a-f0-9]{64}$/.test(env.LIVEWEAVE_AUTH_SECRET??''))throw availabilityError();
  const response=await (env.LIVEWEAVE_FETCH??fetch)(url,{
   method:'POST',headers:{'Content-Type':'application/json','User-Agent':'TowerQuestions/1.0',Authorization:'Bearer '+env.LIVEWEAVE_AUTH_SECRET},
   body:JSON.stringify({...student,...options}),redirect:'manual',signal:AbortSignal.timeout(8000)
  });
  if(!response.ok)throw availabilityError();
  const result=await response.json();
  if(options.questionId!==undefined)return {eligible:result.eligible===true};
  const subjects=(Array.isArray(result.subjects)?result.subjects:[]).filter(subject=>/^[0-9]{4}$/.test(subject?.code??'')&&typeof subject.name==='string');
  const track=subjects.find(subject=>subject.code===result.track)?.code;
  const q=result.question;
  if(q===null)return {};
  if(!positive(q?.id)||typeof q.prompt!=='string'||!q.prompt.trim()||!Array.isArray(q.choices)||q.choices.length!==4||
     q.choices.some(choice=>typeof choice!=='string'||!choice.trim())||!Number.isInteger(q.answer)||q.answer<0||q.answer>3)throw availabilityError();
  const {id,prompt,choices,answer}=q;
  const detail={};
  for(const key of ['source','topic','course','explanation'])if(typeof q[key]==='string')detail[key]=q[key];
  return {subjects,track,question:{id,prompt,choices,answer,...detail}};
 }catch{throw availabilityError();}
}
