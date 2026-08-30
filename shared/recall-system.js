(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.BlockcraftRecallSystem=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const COOLDOWN_MS=0,QUESTION_MS=10*60*1000,FREEZE_MS=3500,RESTORE_FRACTION=.2;
  const TOPICS=['Percentages','Linear equations','Graphs','Factorising','Cell biology','Bioenergetics','Atomic structure','Acids and alkalis','Forces','Motion','Grammar','Language techniques','Rivers','River processes','Norman England','First World War','Passwords','Primary keys','Religious practice','Beliefs'];
  const QUESTIONS=Object.freeze([
    Object.freeze({subject:'Maths',stage:'KS3',prompt:'What is 15% of 200?',answers:['30','15','20','35'],correct:0,explanation:'10% is 20 and 5% is 10, so 15% is 30.'}),
    Object.freeze({subject:'Maths',stage:'KS3',prompt:'Solve: 3x + 5 = 20',answers:['x = 5','x = 15','x = 8','x = 3'],correct:0,explanation:'Subtract 5, then divide 15 by 3.'}),
    Object.freeze({subject:'Maths',stage:'GCSE',prompt:'What is the gradient of y = 4x - 7?',answers:['4','-7','7','-4'],correct:0,explanation:'In y = mx + c, the gradient is m.'}),
    Object.freeze({subject:'Maths',stage:'GCSE',prompt:'Factorise x² + 5x + 6',answers:['(x + 2)(x + 3)','(x + 1)(x + 6)','(x - 2)(x - 3)','(x + 5)(x + 1)'],correct:0,explanation:'2 × 3 = 6 and 2 + 3 = 5.'}),
    Object.freeze({subject:'Biology',stage:'KS3',prompt:'Which structure controls a cell’s activities?',answers:['Nucleus','Cell membrane','Cytoplasm','Vacuole'],correct:0,explanation:'The nucleus contains genetic material and controls cell activities.'}),
    Object.freeze({subject:'Biology',stage:'GCSE',prompt:'Where does aerobic respiration mainly occur?',answers:['Mitochondria','Ribosomes','Nucleus','Cell wall'],correct:0,explanation:'Mitochondria are the main site of aerobic respiration.'}),
    Object.freeze({subject:'Chemistry',stage:'KS3',prompt:'What is the chemical symbol for sodium?',answers:['Na','S','So','N'],correct:0,explanation:'Sodium has the symbol Na.'}),
    Object.freeze({subject:'Chemistry',stage:'GCSE',prompt:'A solution with pH 2 is…',answers:['Acidic','Neutral','Alkaline','Saturated'],correct:0,explanation:'Values below pH 7 are acidic.'}),
    Object.freeze({subject:'Physics',stage:'KS3',prompt:'What is the unit of force?',answers:['Newton','Joule','Watt','Volt'],correct:0,explanation:'Force is measured in newtons (N).'}),
    Object.freeze({subject:'Physics',stage:'GCSE',prompt:'Which equation calculates speed?',answers:['distance ÷ time','time ÷ distance','distance × time','mass × acceleration'],correct:0,explanation:'Speed equals distance travelled divided by time taken.'}),
    Object.freeze({subject:'English',stage:'KS3',prompt:'Which word is an adverb?',answers:['Quickly','Bright','Runner','Leap'],correct:0,explanation:'“Quickly” describes how an action is performed.'}),
    Object.freeze({subject:'English',stage:'GCSE',prompt:'Giving human qualities to an object is…',answers:['Personification','Alliteration','Hyperbole','Onomatopoeia'],correct:0,explanation:'Personification attributes human qualities to non-human things.'}),
    Object.freeze({subject:'Geography',stage:'KS3',prompt:'What is the longest river in the UK?',answers:['River Severn','River Thames','River Trent','River Tyne'],correct:0,explanation:'The River Severn is the UK’s longest river.'}),
    Object.freeze({subject:'Geography',stage:'GCSE',prompt:'Which process wears away a river bank?',answers:['Erosion','Deposition','Condensation','Transpiration'],correct:0,explanation:'Erosion removes material from the river channel and banks.'}),
    Object.freeze({subject:'History',stage:'KS3',prompt:'In which year did the Battle of Hastings occur?',answers:['1066','1215','1485','1666'],correct:0,explanation:'The Norman conquest began with the Battle of Hastings in 1066.'}),
    Object.freeze({subject:'History',stage:'GCSE',prompt:'Which treaty formally ended the First World War?',answers:['Treaty of Versailles','Treaty of Paris','Treaty of Rome','Treaty of Utrecht'],correct:0,explanation:'The Treaty of Versailles was signed in 1919.'}),
    Object.freeze({subject:'Information Technology',stage:'KS3',prompt:'Which password is the strongest?',answers:['R7!mQ2#vL9','password1','football','12345678'],correct:0,explanation:'A long, unpredictable mix of character types is harder to guess.'}),
    Object.freeze({subject:'Information Technology',stage:'GCSE',prompt:'What is the main purpose of a database primary key?',answers:['Uniquely identify each record','Encrypt the database','Format every field','Create a backup'],correct:0,explanation:'A primary key has a unique value for each database record.'}),
    Object.freeze({id:'it_ns_bin_den_001',subject:'Information Technology',stage:'KS3',topic:'Number systems',difficulty:1,spec:'number-systems-base2-base10-base16',prompt:'What is binary 1010 in denary?',answers:['10','8','12','1010'],correct:0,explanation:'Binary 1010 uses place values 8, 4, 2 and 1. The 1s are worth 8 and 2, so the total is 10.'}),
    Object.freeze({id:'it_ns_bin_den_002',subject:'Information Technology',stage:'KS3',topic:'Number systems',difficulty:1,spec:'number-systems-base2-base10-base16',prompt:'What is binary 1111 in denary?',answers:['15','14','16','1111'],correct:0,explanation:'Binary 1111 means 8 + 4 + 2 + 1, which equals 15 in denary.'}),
    Object.freeze({id:'it_ns_bin_den_003',subject:'Information Technology',stage:'KS3',topic:'Number systems',difficulty:2,spec:'number-systems-base2-base10-base16',prompt:'What is binary 100101 in denary?',answers:['37','35','41','100101'],correct:0,explanation:'The place values are 32, 16, 8, 4, 2 and 1. Binary 100101 has 32 + 4 + 1, giving 37.'}),
    Object.freeze({id:'it_ns_bin_den_004',subject:'Information Technology',stage:'GCSE',topic:'Number systems',difficulty:2,spec:'number-systems-base2-base10-base16',prompt:'What is binary 11001010 in denary?',answers:['202','210','186','11001010'],correct:0,explanation:'Using 128, 64, 32, 16, 8, 4, 2, 1 gives 128 + 64 + 8 + 2 = 202.'}),
    Object.freeze({id:'it_ns_den_bin_001',subject:'Information Technology',stage:'KS3',topic:'Number systems',difficulty:1,spec:'number-systems-base2-base10-base16',prompt:'What is denary 6 in binary?',answers:['110','101','111','100'],correct:0,explanation:'Denary 6 is made from 4 + 2, so the binary place values 4, 2, 1 become 110.'}),
    Object.freeze({id:'it_ns_den_bin_002',subject:'Information Technology',stage:'KS3',topic:'Number systems',difficulty:1,spec:'number-systems-base2-base10-base16',prompt:'What is denary 13 in binary?',answers:['1101','1011','1110','1001'],correct:0,explanation:'Denary 13 is 8 + 4 + 1, so the 8, 4, 2, 1 columns are 1101.'}),
    Object.freeze({id:'it_ns_den_bin_003',subject:'Information Technology',stage:'KS3',topic:'Number systems',difficulty:2,spec:'number-systems-base2-base10-base16',prompt:'What is denary 42 in binary?',answers:['101010','100110','110010','101100'],correct:0,explanation:'Denary 42 is 32 + 8 + 2, so the 32, 16, 8, 4, 2, 1 columns are 101010.'}),
    Object.freeze({id:'it_ns_den_bin_004',subject:'Information Technology',stage:'GCSE',topic:'Number systems',difficulty:2,spec:'number-systems-base2-base10-base16',prompt:'What is denary 173 as an 8-bit binary number?',answers:['10101101','10110101','11001101','10101011'],correct:0,explanation:'173 is 128 + 32 + 8 + 4 + 1, so the 8-bit pattern is 10101101.'}),
    Object.freeze({id:'it_ns_bin_hex_001',subject:'Information Technology',stage:'KS3',topic:'Number systems',difficulty:1,spec:'number-systems-base2-base10-base16',prompt:'What is binary 1010 in hexadecimal?',answers:['A','10','B','8'],correct:0,explanation:'One hexadecimal digit represents four binary bits. The nibble 1010 has denary value 10, written as A in hex.'}),
    Object.freeze({id:'it_ns_bin_hex_002',subject:'Information Technology',stage:'KS3',topic:'Number systems',difficulty:1,spec:'number-systems-base2-base10-base16',prompt:'What is binary 1111 in hexadecimal?',answers:['F','E','15','1F'],correct:0,explanation:'The four-bit value 1111 is denary 15, and hexadecimal uses F for the value 15.'}),
    Object.freeze({id:'it_ns_bin_hex_003',subject:'Information Technology',stage:'GCSE',topic:'Number systems',difficulty:2,spec:'number-systems-base2-base10-base16',prompt:'What is binary 1101 0110 in hexadecimal?',answers:['D6','C6','D5','13'],correct:0,explanation:'Split the binary into nibbles: 1101 is D and 0110 is 6, so the hexadecimal value is D6.'}),
    Object.freeze({id:'it_ns_bin_hex_004',subject:'Information Technology',stage:'GCSE',topic:'Number systems',difficulty:2,spec:'number-systems-base2-base10-base16',prompt:'What is binary 0011 1010 in hexadecimal?',answers:['3A','4A','3B','32'],correct:0,explanation:'Convert each nibble separately: 0011 is 3 and 1010 is A, giving hexadecimal 3A.'}),
    Object.freeze({id:'it_ns_hex_bin_001',subject:'Information Technology',stage:'KS3',topic:'Number systems',difficulty:1,spec:'number-systems-base2-base10-base16',prompt:'What is hexadecimal C in binary?',answers:['1100','1010','1110','1001'],correct:0,explanation:'Hexadecimal C represents denary 12, which is 8 + 4, so the four-bit binary value is 1100.'}),
    Object.freeze({id:'it_ns_hex_bin_002',subject:'Information Technology',stage:'KS3',topic:'Number systems',difficulty:1,spec:'number-systems-base2-base10-base16',prompt:'What is hexadecimal 9 in binary?',answers:['1001','1010','0110','1111'],correct:0,explanation:'Hexadecimal 9 has the same value as denary 9, which is 8 + 1, so the four-bit binary value is 1001.'}),
    Object.freeze({id:'it_ns_hex_bin_003',subject:'Information Technology',stage:'GCSE',topic:'Number systems',difficulty:2,spec:'number-systems-base2-base10-base16',prompt:'What is hexadecimal 2F in binary?',answers:['0010 1111','0011 1110','0010 1011','1111 0010'],correct:0,explanation:'Convert each hex digit to four bits: 2 is 0010 and F is 1111, giving 0010 1111.'}),
    Object.freeze({id:'it_ns_hex_bin_004',subject:'Information Technology',stage:'GCSE',topic:'Number systems',difficulty:2,spec:'number-systems-base2-base10-base16',prompt:'What is hexadecimal A4 in binary?',answers:['1010 0100','1011 0100','1010 0011','0100 1010'],correct:0,explanation:'A is 1010 and 4 is 0100, so hexadecimal A4 becomes binary 1010 0100.'}),
    Object.freeze({id:'it_ns_base_001',subject:'Information Technology',stage:'KS3',topic:'Number systems',difficulty:1,spec:'number-systems-base2-base10-base16',prompt:'What does base 2 mean?',answers:['It uses two digit symbols: 0 and 1','It uses ten digit symbols: 0 to 9','It uses sixteen digit symbols: 0 to F','It stores every number as text'],correct:0,explanation:'Base 2 is binary. Each column is a power of 2, and only the digit symbols 0 and 1 are used.'}),
    Object.freeze({id:'it_ns_base_002',subject:'Information Technology',stage:'KS3',topic:'Number systems',difficulty:1,spec:'number-systems-base2-base10-base16',prompt:'What does base 10 mean?',answers:['It uses ten digit symbols: 0 to 9','It uses two digit symbols: 0 and 1','It uses sixteen digit symbols: 0 to F','It can only represent ten numbers'],correct:0,explanation:'Base 10 is denary. It uses the ten digit symbols 0 through 9 and place values based on powers of 10.'}),
    Object.freeze({id:'it_ns_base_003',subject:'Information Technology',stage:'KS3',topic:'Number systems',difficulty:1,spec:'number-systems-base2-base10-base16',prompt:'What does base 16 mean?',answers:['It uses sixteen digit symbols: 0 to 9 and A to F','It uses only the digits 1 and 6','It uses ten digit symbols: 0 to 9','It cannot represent binary values'],correct:0,explanation:'Base 16 is hexadecimal. It uses 0 to 9 and A to F, where A to F represent values 10 to 15.'}),
    Object.freeze({id:'it_ns_base_004',subject:'Information Technology',stage:'GCSE',topic:'Number systems',difficulty:2,spec:'number-systems-base2-base10-base16',prompt:'Why is hexadecimal often used to write binary values more compactly?',answers:['One hex digit represents exactly four binary bits','Hexadecimal removes the need for place value','Hexadecimal can only store colours','One binary bit represents four hex digits'],correct:0,explanation:'Because 16 is 2 to the power of 4, each hexadecimal digit maps neatly to one group of four binary bits.'}),
    Object.freeze({subject:'Religious Education',stage:'KS3',topic:'Religious practice',spec:'legacy-religious-practice',prompt:'What is a pilgrimage?',answers:['A journey to a sacred place','A religious building','A type of prayer','A moral rule'],correct:0,explanation:'A pilgrimage is a journey made for religious or spiritual reasons.'}),
    Object.freeze({subject:'Religious Education',stage:'GCSE',topic:'Beliefs',spec:'legacy-beliefs',prompt:'Which term means belief in one God?',answers:['Monotheism','Polytheism','Atheism','Humanism'],correct:0,explanation:'Monotheism is belief in a single God.'})
  ].map((q,index)=>Object.freeze({...q,id:q.id||'q'+String(index+1).padStart(3,'0'),topic:q.topic||TOPICS[index],difficulty:q.difficulty||(q.stage==='GCSE'?2:1),spec:q.spec||'legacy'})));
  const SUBJECTS=Object.freeze([...new Set(QUESTIONS.map(q=>q.subject).filter(Boolean))].sort());
  const REVIEW_INTERVALS_MS=Object.freeze([10*60*1000,24*60*60*1000,3*24*60*60*1000,7*24*60*60*1000,14*24*60*60*1000,30*24*60*60*1000]);
  const RETRY_INTERVAL_MS=2*60*1000;
  function normalizedPrompt(text){return String(text||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
  function validateQuestionBank(bank=QUESTIONS){
    const errors=[],ids=new Set(),prompts=new Set();
    bank.forEach((q,index)=>{
      const at='Question '+(q&&q.id||index);
      if(!q||typeof q!=='object'){errors.push(at+' is not an object');return;}
      if(!/^[a-z][a-z0-9_]{2,48}$/.test(q.id||''))errors.push(at+' has an invalid stable id');else if(ids.has(q.id))errors.push(at+' duplicates an id');else ids.add(q.id);
      if(!q.subject||!q.stage||!q.topic||!q.spec)errors.push(at+' is missing curriculum metadata');
      if(!['KS3','GCSE'].includes(q.stage))errors.push(at+' has an invalid stage');
      if(!Number.isInteger(q.difficulty)||q.difficulty<1||q.difficulty>3)errors.push(at+' difficulty must be 1-3');
      if(!Array.isArray(q.answers)||q.answers.length!==4||new Set(q.answers.map(String)).size!==4)errors.push(at+' must have four unique answers');
      if(!Number.isInteger(q.correct)||q.correct<0||q.correct>3)errors.push(at+' has an invalid correct answer');
      if(String(q.explanation||'').length<20)errors.push(at+' needs a teaching explanation');
      const prompt=normalizedPrompt(q.prompt);if(prompt.length<10)errors.push(at+' prompt is too short');else if(prompts.has(prompt))errors.push(at+' duplicates a prompt');else prompts.add(prompt);
    });
    return errors;
  }
  const BANK_ERRORS=validateQuestionBank(QUESTIONS);if(BANK_ERRORS.length)throw new Error('Invalid Recall question bank: '+BANK_ERRORS.join('; '));
  function shuffle(q,random=Math.random){
    if(!q)return null;
    const order=q.answers.map((_,i)=>i);
    for(let i=order.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
    return {...q,answers:order.map(i=>q.answers[i]),correct:order.indexOf(q.correct)};
  }
  function shuffledQuestion(index,random=Math.random,subject=''){
    const pool=SUBJECTS.includes(subject)?QUESTIONS.filter(q=>q.subject===subject):QUESTIONS;
    const q=pool[Math.abs(index|0)%pool.length];
    return shuffle(q,random);
  }
  function cleanRecord(raw={}){
    return {attempts:Math.max(0,raw.attempts|0),correct:Math.max(0,raw.correct|0),streak:Math.max(0,raw.streak|0),stage:Math.max(0,Math.min(REVIEW_INTERVALS_MS.length,raw.stage|0)),lastAt:Math.max(0,Number(raw.lastAt)||0),nextDue:Math.max(0,Number(raw.nextDue)||0),lastCorrect:raw.lastCorrect===true};
  }
  function reviewQuestion(history={},question,correct,now=Date.now()){
    const out={...history,items:{...(history.items||{})}},before=cleanRecord(out.items[question.id]);
    const stage=correct?Math.min(REVIEW_INTERVALS_MS.length,before.stage+1):0;
    const interval=correct?REVIEW_INTERVALS_MS[Math.max(0,stage-1)]:RETRY_INTERVAL_MS;
    out.items[question.id]={attempts:before.attempts+1,correct:before.correct+(correct?1:0),streak:correct?before.streak+1:0,stage,lastAt:now,nextDue:now+interval,lastCorrect:correct===true};
    out.lastQuestionId=question.id;out.lastTopic=question.topic;out.totalAttempts=Math.max(0,history.totalAttempts|0)+1;out.totalCorrect=Math.max(0,history.totalCorrect|0)+(correct?1:0);
    return {history:out,record:out.items[question.id],interval};
  }
  function selectQuestion(subject,history={},now=Date.now(),random=Math.random){
    let pool=QUESTIONS.filter(q=>!SUBJECTS.includes(subject)||q.subject===subject);if(!pool.length)pool=QUESTIONS;
    const items=history.items||{},due=pool.filter(q=>items[q.id]&&cleanRecord(items[q.id]).nextDue<=now),unseen=pool.filter(q=>!items[q.id]);
    let candidates=due.length?due:unseen.length?unseen:pool.slice().sort((a,b)=>cleanRecord(items[a.id]).nextDue-cleanRecord(items[b.id]).nextDue).slice(0,Math.max(1,Math.ceil(pool.length/2)));
    const alternates=candidates.filter(q=>q.id!==history.lastQuestionId&&q.topic!==history.lastTopic);if(alternates.length)candidates=alternates;
    const accuracy=(history.totalAttempts|0)>0?(history.totalCorrect|0)/(history.totalAttempts|0):0;
    const targetDifficulty=accuracy>=.8?2:1,matched=candidates.filter(q=>q.difficulty===targetDifficulty);if(matched.length)candidates=matched;
    const selected=candidates[Math.min(candidates.length-1,Math.floor(random()*candidates.length))]||pool[0];
    return shuffle(selected,random);
  }
  function masterySummary(history={},subject=''){
    const pool=QUESTIONS.filter(q=>!SUBJECTS.includes(subject)||q.subject===subject),items=history.items||{};let seen=0,mastered=0,due=0,correct=0,attempts=0;const now=Date.now();
    for(const q of pool){const r=items[q.id]&&cleanRecord(items[q.id]);if(!r)continue;seen++;attempts+=r.attempts;correct+=r.correct;if(r.stage>=4)mastered++;if(r.nextDue<=now)due++;}
    return {seen,total:pool.length,mastered,due,attempts,correct,accuracy:attempts?correct/attempts:0};
  }
  return Object.freeze({COOLDOWN_MS,QUESTION_MS,FREEZE_MS,RESTORE_FRACTION,SUBJECTS,QUESTIONS,REVIEW_INTERVALS_MS,RETRY_INTERVAL_MS,validateQuestionBank,cleanRecord,reviewQuestion,selectQuestion,masterySummary,shuffledQuestion});
});
