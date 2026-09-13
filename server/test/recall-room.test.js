const test=require('node:test');
const assert=require('node:assert/strict');
const recall=require('../rooms/recall.mixin');

test('recall avoidance carries recently answered prompts across reconnects',()=>{
  const room=Object.create(recall),id='it_ns_hex_bin_003';
  const avoid=room.recallAvoidance({
    lastQuestionId:'it_ns_hex_bin_00',
    items:{[id]:{lastAt:1234}},
  },[],[]);
  assert.ok(avoid.ids.includes(id));
  assert.ok(avoid.prompts.includes('what is hexadecimal 2f in binary?'));
});

test('starting Recall again resends the active question and its pillars',async()=>{
  const room=Object.create(recall),sessionId='player-1',now=Date.now(),sent=[];
  const player={x:10,y:4,z:20,yaw:0,dim:'overworld',dgn:''};
  const challenge={id:'challenge-1',questionId:'it_ns_hex_bin_003',subject:'Computer Science',stage:'GCSE',topic:'Number systems',difficulty:2,prompt:'What is hexadecimal 2F in binary?',answers:['0010 1111','0011 1110','0010 1011','1111 0010'],pillars:[{index:0,x:10,y:4,z:4}],fallback:false,expiresAt:now+60_000,source:''};
  room.state={players:new Map([[sessionId,player]])};
  room.recallChallenges=new Map([[sessionId,challenge]]);
  room.rateLimited=()=>false;
  room.profileFor=()=>({prof:{recallMastery:{items:{}}}});
  await room.handleRecallStart({sessionId,send:(type,message)=>sent.push({type,message})},{});
  assert.equal(sent.length,1);
  assert.equal(sent[0].type,'recallQuestion');
  assert.equal(sent[0].message.id,challenge.id);
  assert.deepEqual(sent[0].message.pillars,challenge.pillars);
});

test('recall answer pillars spawn in a wide facing-relative diamond',()=>{
  const p={x:10,y:4,z:20,yaw:0};
  const pillars=recall.recallPositions(p);
  assert.equal(pillars.length,4);
  assert.deepEqual(pillars.map(p=>p.index),[0,1,2,3]);
  assert.equal(pillars[0].x,10);
  assert.equal(pillars[0].z,4);
  assert.equal(pillars[1].x,.5);
  assert.equal(Math.round(pillars[1].z*100)/100,9);
  assert.equal(pillars[2].x,19.5);
  assert.equal(Math.round(pillars[2].z*100)/100,9);
  assert.equal(pillars[3].x,10);
  assert.equal(pillars[3].z,13);
  assert.ok(Math.hypot(pillars[1].x-pillars[2].x,pillars[1].z-pillars[2].z)>18);
  assert.ok(Math.hypot(pillars[0].x-pillars[3].x,pillars[0].z-pillars[3].z)>=9);
});

test('recall diamond can use the cast-time player facing direction',()=>{
  const p={x:10,y:4,z:20,yaw:0};
  const pillars=recall.recallPositions(p,Math.PI/2);
  assert.equal(pillars[0].x,-6);
  assert.equal(pillars[0].z,20);
  assert.equal(Math.round(pillars[1].x*100)/100,-1);
  assert.equal(Math.round(pillars[1].z*100)/100,29.5);
  assert.equal(Math.round(pillars[2].x*100)/100,-1);
  assert.equal(Math.round(pillars[2].z*100)/100,10.5);
});

test('recall pillars move away from blocked buildings and objects',()=>{
  const blocked=new Set(['10,4,9','10,5,9','10,7,9']);
  const room=Object.create(recall);
  room.instances={};
  room.world={standHeight(){return 4;}};
  room.spaceSolid=()=>((x,y,z)=>blocked.has([x,y,z].join(',')));
  const p={x:10,y:4,z:20,yaw:0,dgn:''};
  const pillars=room.recallPositions(p,0);
  assert.equal(pillars[0].index,0);
  assert.notEqual(Math.floor(pillars[0].z),9);
  assert.ok(Math.hypot(pillars[0].x-10,pillars[0].z-9.5)>1);
});

test('recall uses a screen-space fallback when no safe pillar location exists',()=>{
  const room=Object.create(recall);
  room.instances={};room.world={standHeight(){return 4;}};room.spaceSolid=()=>()=>true;
  const pillars=room.recallPositions({x:10,y:4,z:20,yaw:0,dgn:''},0);
  assert.equal(pillars.length,4);
  assert.equal(pillars.every(p=>p.blocked),true);
});

test('recall answer pillars remain visible inside private tutorial spaces',()=>{
  const room=Object.create(recall);
  room.instances={};room.world={standHeight(){return -1;}};room.spaceSolid=()=>()=>true;
  const p={x:770,y:20,z:820,yaw:0,dim:'tutorial',dgn:'tutorial-onboarding-p1'};
  const pillars=room.recallPositions(p,0);
  assert.equal(pillars.length,4);
  assert.equal(pillars.every(p=>!p.blocked),true);
  assert.deepEqual(pillars.map(p=>p.y),[20,20,20,20]);
});

test('recall uses compact answer pillars inside low dungeon caves',()=>{
  const room=Object.create(recall);
  room.instances={};room.world={standHeight(){return 9;}};
  room.spaceSolid=()=>((x,y,z)=>y>=13);
  const p={x:10,y:9,z:20,yaw:0,dim:'dungeon',dgn:'crypt_1'};
  const pillars=room.recallPositions(p,0);
  assert.equal(pillars.length,4);
  assert.equal(pillars.every(p=>!p.blocked),true);
  assert.deepEqual(pillars.map(p=>p.y),[9,9,9,9]);
  assert.ok(Math.hypot(pillars[0].x-p.x,pillars[0].z-p.z)<10);
});


test('Recall database lookup falls back on timeout, failure and an empty bank',async()=>{
  const room=Object.create(recall);
  assert.equal(await room.loadRecallQuestionWithTimeout({loadRecallQuestion:()=>new Promise(()=>{})},{},{},5),null);
  assert.equal(await room.loadRecallQuestionWithTimeout({loadRecallQuestion:()=>Promise.reject(new Error('offline'))},{},{},5),null);
  assert.equal(await room.loadRecallQuestionWithTimeout({loadRecallQuestion:()=>null},{},{},5),null);
  const question={id:'db-question'};
  assert.equal(await room.loadRecallQuestionWithTimeout({loadRecallQuestion:()=>question},{},{},50),question);
});

function recallClientHarness(){
  const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
  const timers=new Map(),sent=[],messages=[],nodes=new Map();let seq=0;
  const node=()=>({classList:{add(){},remove(){},toggle(){}},style:{setProperty(){}},querySelector(){return null;},querySelectorAll(){return [];},addEventListener(){},appendChild(){},innerHTML:'',textContent:''});
  const document={body:node(),getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},createElement:node};
  const context=vm.createContext({document,THREE:{Group:class{constructor(){this.children=[];}traverse(){};}},NET:{on:true,room:{send:(type,message)=>sent.push({type,message})}},dim:'overworld',player:{yaw:0},scene:{remove(){}},performance:{now:()=>0},Date,sysMsg:m=>messages.push(m),showName:m=>messages.push(m),setTimeout:(fn,ms)=>{timers.set(++seq,{fn,ms});return seq;},clearTimeout:id=>timers.delete(id)});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../../client/js/recall.mjs'),'utf8').replace('export {api};',''),context);
  const question={id:'one',prompt:'Question?',answers:['A','B','C','D'],pillars:[],fallback:true,expiresAt:Date.now()+60000};
  return {api:context.BlockcraftRecall,context,question,sent,messages,timers,fire(ms){const entry=[...timers].find(([,t])=>t.ms===ms);assert.ok(entry,`timer ${ms} exists`);timers.delete(entry[0]);entry[1].fn();}};
}

test('P suppresses duplicate fetches and permits retry after a missing response',()=>{
  const h=recallClientHarness();h.api.start();h.api.start();
  assert.equal(h.sent.length,1);h.fire(8000);
  assert.ok(h.messages.some(m=>m.includes('PRESS P TO RETRY')));
  h.api.start();assert.equal(h.sent.length,2);
  h.api.showQuestion(h.question);assert.equal(h.timers.size,0);
  h.api.start();assert.equal(h.sent.length,2,'an unanswered question is retained');
  assert.ok(h.messages.some(m=>m.includes('Choose an answer')));
});

test('P replaces expired client questions instead of remaining stuck active',()=>{
  const h=recallClientHarness();h.api.showQuestion({...h.question,expiresAt:Date.now()-1});
  h.api.start();assert.equal(h.sent.length,1);assert.equal(h.api.active,null);
});

test('Recall clears stale questions after changing rooms and ignores old results',()=>{
  const h=recallClientHarness();h.api.showQuestion(h.question);
  h.api.result({id:'older-question',expired:true});assert.equal(h.api.active.id,'one');
  h.context.NET.room={send(){}};h.api.tick();assert.equal(h.api.active,null);
});

test('Question Hall retries a rate-limited next question',()=>{
  const h=recallClientHarness();h.api.start({source:'question_hall'});
  h.api.reject({reason:'rate'});h.fire(2200);
  assert.equal(h.sent.length,2);assert.equal(h.sent[1].message.source,'question_hall');
});

test('closing Question Hall while loading prevents a late response reopening it',()=>{
  const h=recallClientHarness();h.api.start({source:'question_hall'});
  h.api.closeQuestionHall();h.api.showQuestion({...h.question,questionHall:true});
  assert.equal(h.api.active,null);assert.equal(h.timers.size,0);
});


test('a stalled database still delivers one playable fallback and releases pending state',async()=>{
  const auth=require('../auth').getAuthService(),original=auth.getGameQuestionStore;
  let resolveLookup;
  auth.getGameQuestionStore=()=>({loadRecallQuestion:()=>new Promise(resolve=>{resolveLookup=resolve;})});
  try{
    const room=Object.create(recall),sent=[],p={x:10,y:4,z:20,yaw:0,dim:'tutorial',dgn:'tutorial-test'};
    room.initRecallState();room.state={players:new Map([['p',p]])};room.rateLimited=()=>false;
    room.loadRecallQuestionWithTimeout=(store,account,input)=>recall.loadRecallQuestionWithTimeout(store,account,input,5);
    const client={sessionId:'p',_account:{},send:(type,message)=>sent.push({type,message})};
    await room.handleRecallStart(client);
    assert.equal(room.recallStartsPending.size,0);
    assert.equal(sent.length,1);assert.equal(sent[0].type,'recallQuestion');
    assert.equal(sent[0].message.answers.length,4);assert.ok(sent[0].message.prompt);
    resolveLookup({id:'too-late'});await new Promise(resolve=>setImmediate(resolve));
    assert.equal(sent.length,1,'late database completion cannot overwrite fallback');
    await room.handleRecallStart(client);
    assert.equal(sent[1].message.id,sent[0].message.id,'retry resends the active question');
  }finally{auth.getGameQuestionStore=original;}
});
