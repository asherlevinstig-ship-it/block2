(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.BlockcraftRecallSystem=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const COOLDOWN_MS=0,QUESTION_MS=10*60*1000,FREEZE_MS=3500,RESTORE_FRACTION=.2;
  const COMPUTER_SCIENCE_BANK=[
    {id:'cs_alg_001',subject:'Computer Science',stage:'KS3',topic:'Algorithms',difficulty:1,spec:'DfE-KS3-algorithms',prompt:'What is an algorithm?',answers:['A precise sequence of steps to solve a problem','A programming language','A physical computer component','A stored password'],correct:0,explanation:'An algorithm is a finite, ordered set of unambiguous steps for completing a task.'},
    {id:'cs_alg_002',subject:'Computer Science',stage:'KS3',topic:'Algorithms',difficulty:2,spec:'DfE-KS3-algorithms',prompt:'Which search checks each item in order until a match is found?',answers:['Linear search','Binary search','Merge sort','Bubble sort'],correct:0,explanation:'Linear search examines items one at a time and does not require sorted data.'},
    {id:'cs_alg_003',subject:'Computer Science',stage:'GCSE',topic:'Algorithms',difficulty:2,spec:'AQA-8525-3.1',prompt:'What must be true before binary search can be used correctly?',answers:['The data must be ordered','The data must contain numbers','The list must have an even length','Every item must be unique'],correct:0,explanation:'Binary search repeatedly discards half of an ordered search space; unordered data breaks that reasoning.'},
    {id:'cs_alg_004',subject:'Computer Science',stage:'GCSE',topic:'Algorithms',difficulty:3,spec:'OCR-J277-2.1',prompt:'For a list of n items, what is the worst-case time complexity of binary search?',answers:['O(log n)','O(n)','O(n²)','O(1)'],correct:0,explanation:'Each comparison halves the remaining search space, producing logarithmic growth.'},
    {id:'cs_prog_001',subject:'Computer Science',stage:'KS3',topic:'Programming',difficulty:1,spec:'DfE-KS3-programming',prompt:'Which programming construct repeats instructions?',answers:['Iteration','Selection','Assignment','Input'],correct:0,explanation:'Iteration repeats a block of instructions, either a fixed number of times or while a condition holds.'},
    {id:'cs_prog_002',subject:'Computer Science',stage:'KS3',topic:'Programming',difficulty:2,spec:'DfE-KS3-programming',prompt:'Why are functions useful in a program?',answers:['They package reusable behaviour','They make every variable global','They remove the need for testing','They automatically encrypt data'],correct:0,explanation:'Functions decompose a program into named, reusable units with a clear purpose.'},
    {id:'cs_prog_003',subject:'Computer Science',stage:'GCSE',topic:'Programming',difficulty:2,spec:'AQA-8525-3.2',prompt:'Which test value lies exactly at the edge of a valid range?',answers:['Boundary data','Normal data','Erroneous data','Random data'],correct:0,explanation:'Boundary data tests values at the limits; just outside those limits is commonly tested as erroneous data.'},
    {id:'cs_prog_004',subject:'Computer Science',stage:'GCSE',topic:'Programming',difficulty:3,spec:'OCR-J277-2.2',prompt:'What does a local variable’s scope normally mean?',answers:['It is accessible only within its defining block or subprogram','It can be changed from every module','It is stored permanently after shutdown','It must contain text'],correct:0,explanation:'Scope describes where an identifier can be accessed; local variables are restricted to their defining context.'},
    {id:'cs_data_001',subject:'Computer Science',stage:'KS3',topic:'Data representation',difficulty:1,spec:'DfE-KS3-data',prompt:'How many different values can one binary digit represent?',answers:['2','8','10','16'],correct:0,explanation:'A bit has two possible states: 0 or 1.'},
    {id:'cs_data_002',subject:'Computer Science',stage:'KS3',topic:'Data representation',difficulty:2,spec:'DfE-KS3-data',prompt:'What is binary 1010 in denary?',answers:['10','8','12','1010'],correct:0,explanation:'Using place values 8, 4, 2 and 1 gives 8 + 2 = 10.'},
    {id:'cs_data_003',subject:'Computer Science',stage:'GCSE',topic:'Data representation',difficulty:2,spec:'AQA-8525-3.3',prompt:'Increasing an image’s colour depth directly allows what?',answers:['More possible colours per pixel','More pixels in the image','A higher sampling rate','A faster processor'],correct:0,explanation:'Colour depth is the number of bits used per pixel, so more bits encode more possible colours.'},
    {id:'cs_data_004',subject:'Computer Science',stage:'GCSE',topic:'Data representation',difficulty:3,spec:'OCR-J277-1.2',prompt:'Why can lossy compression usually produce a smaller file than lossless compression?',answers:['It permanently removes some data','It stores two identical copies','It increases colour depth','It converts all data to hexadecimal'],correct:0,explanation:'Lossy methods discard selected information, accepting reduced fidelity for a greater size reduction.'},
    {id:'cs_sys_001',subject:'Computer Science',stage:'KS3',topic:'Computer systems',difficulty:1,spec:'DfE-KS3-hardware',prompt:'Which component stores programs and data currently in use?',answers:['RAM','Secondary storage','Power supply','Network interface card'],correct:0,explanation:'RAM is fast, volatile main memory used for active instructions and data.'},
    {id:'cs_sys_002',subject:'Computer Science',stage:'KS3',topic:'Computer systems',difficulty:2,spec:'DfE-KS3-hardware',prompt:'Which CPU register holds the address of the next instruction?',answers:['Program counter','Accumulator','Memory data register','Current instruction register'],correct:0,explanation:'The program counter stores the memory address of the next instruction to fetch.'},
    {id:'cs_sys_003',subject:'Computer Science',stage:'GCSE',topic:'Computer systems',difficulty:2,spec:'OCR-J277-1.1',prompt:'What is the purpose of cache memory?',answers:['To hold frequently used data close to the CPU','To provide permanent archival storage','To connect a computer to Wi-Fi','To replace the operating system'],correct:0,explanation:'Cache is small, fast memory near or inside the CPU that reduces slower main-memory accesses.'},
    {id:'cs_sys_004',subject:'Computer Science',stage:'GCSE',topic:'Computer systems',difficulty:3,spec:'AQA-8525-3.4',prompt:'During the fetch-decode-execute cycle, what happens during decode?',answers:['The control unit interprets the instruction','The instruction is copied from storage to RAM','The result is always saved to secondary storage','The program counter is erased'],correct:0,explanation:'Decoding determines what operation the fetched instruction represents and what operands it needs.'},
    {id:'cs_net_001',subject:'Computer Science',stage:'KS3',topic:'Networks',difficulty:1,spec:'DfE-KS3-networks',prompt:'What does a router primarily do?',answers:['Forwards packets between networks','Stores every website permanently','Executes application instructions','Converts source code into machine code'],correct:0,explanation:'Routers inspect addressing information and forward packets between different networks.'},
    {id:'cs_net_002',subject:'Computer Science',stage:'KS3',topic:'Networks',difficulty:2,spec:'DfE-KS3-networks',prompt:'Which protocol is used to request and transfer web pages?',answers:['HTTP or HTTPS','SMTP','FTP only','Bluetooth'],correct:0,explanation:'Browsers and web servers use HTTP; HTTPS adds encryption and authentication through TLS.'},
    {id:'cs_net_003',subject:'Computer Science',stage:'GCSE',topic:'Networks',difficulty:2,spec:'AQA-8525-3.5',prompt:'What is the role of DNS?',answers:['Translates domain names into IP addresses','Encrypts every file on a device','Assigns MAC addresses to manufacturers','Compresses web pages'],correct:0,explanation:'DNS resolves human-readable domain names to the IP addresses used to route traffic.'},
    {id:'cs_net_004',subject:'Computer Science',stage:'GCSE',topic:'Networks',difficulty:3,spec:'OCR-J277-1.3',prompt:'Why does packet switching improve network resilience?',answers:['Packets can take alternative routes','Every packet reserves one fixed circuit','Packets never need addresses','Only one device can transmit'],correct:0,explanation:'Independently routed packets can avoid failed or congested links and be reassembled at the destination.'},
    {id:'cs_sec_001',subject:'Computer Science',stage:'KS3',topic:'Cyber security',difficulty:1,spec:'DfE-KS3-safety',prompt:'What is phishing?',answers:['A deceptive attempt to steal information','A method of compressing images','A sorting algorithm','A hardware upgrade'],correct:0,explanation:'Phishing impersonates a trusted source to manipulate a user into revealing data or opening malicious content.'},
    {id:'cs_sec_002',subject:'Computer Science',stage:'GCSE',topic:'Cyber security',difficulty:2,spec:'AQA-8525-3.6',prompt:'What does penetration testing aim to do?',answers:['Find vulnerabilities with permission','Damage a competitor’s network','Guarantee software has no bugs','Create backup copies'],correct:0,explanation:'Authorised penetration testing simulates attacks to identify weaknesses before malicious attackers exploit them.'},
    {id:'cs_sec_003',subject:'Computer Science',stage:'GCSE',topic:'Cyber security',difficulty:3,spec:'OCR-J277-1.4',prompt:'Why does salting strengthen stored password hashes?',answers:['Identical passwords no longer produce identical stored hashes','It makes passwords shorter','It allows hashes to be decrypted','It removes the need for access control'],correct:0,explanation:'A unique random salt defeats precomputed hash tables and prevents identical passwords sharing one stored hash.'},
    {id:'cs_db_001',subject:'Computer Science',stage:'GCSE',topic:'Databases',difficulty:1,spec:'AQA-8525-3.7',prompt:'In a relational database, what is a record?',answers:['One complete row about an entity','A single column heading','The whole database server','A validation rule'],correct:0,explanation:'A record is a row containing the related field values for one entity instance.'},
    {id:'cs_db_002',subject:'Computer Science',stage:'GCSE',topic:'Databases',difficulty:2,spec:'AQA-8525-3.7',prompt:'Which SQL keyword filters rows using a condition?',answers:['WHERE','SELECT','ORDER','TABLE'],correct:0,explanation:'WHERE restricts a query to rows that satisfy its condition.'},
    {id:'cs_db_003',subject:'Computer Science',stage:'GCSE',topic:'Databases',difficulty:3,spec:'AQA-8525-3.7',prompt:'What is a foreign key used for?',answers:['Linking a record to a key in another table','Encrypting a table','Sorting every query automatically','Making every field unique'],correct:0,explanation:'A foreign key stores a referenced table’s primary-key value, representing a relationship between records.'},
    {id:'cs_imp_001',subject:'Computer Science',stage:'KS3',topic:'Impacts of technology',difficulty:1,spec:'DfE-KS3-responsibility',prompt:'Why should personal data collection be limited?',answers:['To reduce privacy risks and unnecessary exposure','To make files larger','To prevent all software updates','To remove copyright'],correct:0,explanation:'Data minimisation reduces the amount of personal information that can be misused, breached or processed unfairly.'},
    {id:'cs_imp_002',subject:'Computer Science',stage:'GCSE',topic:'Impacts of technology',difficulty:2,spec:'AQA-8525-3.8',prompt:'Which environmental cost is associated with replacing devices frequently?',answers:['More electronic waste and resource extraction','Lower demand for raw materials','Guaranteed carbon neutrality','Less energy used in manufacturing'],correct:0,explanation:'Short replacement cycles increase e-waste and require additional mining, manufacturing and transport.'},
    {id:'cs_imp_003',subject:'Computer Science',stage:'GCSE',topic:'Impacts of technology',difficulty:3,spec:'OCR-J277-1.6',prompt:'What is algorithmic bias?',answers:['Systematic unfair outcomes produced by data or design choices','A program running more slowly over time','A syntax error in source code','The use of binary numbers'],correct:0,explanation:'Bias can enter through unrepresentative data, labels, objectives or design decisions and produce systematically unequal outcomes.'}
  ];
  const TOPICS=['Percentages','Linear equations','Graphs','Factorising','Cell biology','Bioenergetics','Atomic structure','Acids and alkalis','Forces','Motion','Grammar','Language techniques','Rivers','River processes','Norman England','First World War','Computer systems','Data structures','Cyber security','Databases','Religious practice','Beliefs'];
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
    Object.freeze({subject:'Computer Science',stage:'KS3',prompt:'Which component executes program instructions?',answers:['CPU','Monitor','Keyboard','Router'],correct:0,explanation:'The CPU fetches, decodes and executes program instructions.'}),
    Object.freeze({subject:'Computer Science',stage:'GCSE',prompt:'Which data structure processes items first-in, first-out?',answers:['Queue','Stack','Tree','Graph'],correct:0,explanation:'A queue uses FIFO: the first item added is the first removed.'}),
    Object.freeze({subject:'Information Technology',stage:'KS3',prompt:'Which password is the strongest?',answers:['R7!mQ2#vL9','password1','football','12345678'],correct:0,explanation:'A long, unpredictable mix of character types is harder to guess.'}),
    Object.freeze({subject:'Information Technology',stage:'GCSE',prompt:'What is the main purpose of a database primary key?',answers:['Uniquely identify each record','Encrypt the database','Format every field','Create a backup'],correct:0,explanation:'A primary key has a unique value for each database record.'}),
    Object.freeze({subject:'Religious Education',stage:'KS3',prompt:'What is a pilgrimage?',answers:['A journey to a sacred place','A religious building','A type of prayer','A moral rule'],correct:0,explanation:'A pilgrimage is a journey made for religious or spiritual reasons.'}),
    Object.freeze({subject:'Religious Education',stage:'GCSE',prompt:'Which term means belief in one God?',answers:['Monotheism','Polytheism','Atheism','Humanism'],correct:0,explanation:'Monotheism is belief in a single God.'})
  ].concat(COMPUTER_SCIENCE_BANK).map((q,index)=>Object.freeze({...q,id:q.id||'q'+String(index+1).padStart(3,'0'),topic:q.topic||TOPICS[index],difficulty:q.difficulty||(q.stage==='GCSE'?2:1),spec:q.spec||'legacy'})));
  const SUBJECTS=Object.freeze(['Computer Science','Information Technology','Religious Education','English']);
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
