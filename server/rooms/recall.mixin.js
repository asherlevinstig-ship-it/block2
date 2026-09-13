const RECALL=require('../../shared/recall-system');
const { clampN }=require('./constants');
const AI=require('../ai');
const W=require('../world');
const { getAuthService }=require('../auth');

class RecallMixin{
  async loadRecallQuestionWithTimeout(store,account,input,timeoutMs=4000){
    let timer;
    try{
      return await Promise.race([
        Promise.resolve().then(()=>store.loadRecallQuestion(account,input)),
        new Promise(resolve=>{timer=setTimeout(()=>resolve(null),timeoutMs);}),
      ]);
    }catch(_){return null;}finally{clearTimeout(timer);}
  }
  initRecallState(){this.recallChallenges=new Map();this.recallFrozenUntil=new Map();this.recallSubjects=new Map();this.recallRecentQuestions=new Map();this.recallRecentPrompts=new Map();this.recallStartsPending=new Set();this.recallSeq=0;this.recallLecternRenownAt=new Map();}
  cleanRecallSubject(value){return String(value||'').replace(/[<>]/g,'').replace(/\s+/g,' ').trim().slice(0,96);}
  recallTutorialSpace(p){
    return !!(p&&(p.dim==='tutorial'||String(p.dgn||'').startsWith('tutorial-')));
  }
  recallDungeonSpace(p){
    return !!(p&&p.dim==='dungeon'&&p.dgn&&!this.recallTutorialSpace(p));
  }
  recallAvoidance(mastery={},recent=[],recentPrompts=[]){
    const answered=Object.entries(mastery.items||{})
      .sort((a,b)=>(Number(b[1]&&b[1].lastAt)||0)-(Number(a[1]&&a[1].lastAt)||0))
      .slice(0,4)
      .map(([id])=>id);
    const ids=[...new Set([mastery.lastQuestionId,...recent,...answered].filter(Boolean))];
    const prompts=[...recentPrompts];
    for(const id of ids){
      const item=RECALL.QUESTIONS.find(question=>question.id===id);
      if(item&&item.prompt)prompts.push(String(item.prompt).toLowerCase().replace(/\s+/g,' ').trim());
    }
    return {ids,prompts:[...new Set(prompts.filter(Boolean))]};
  }
  sendRecallQuestion(client,challenge,rec,p){
    if(!client||!challenge)return false;
    client.send('recallQuestion',{id:challenge.id,questionId:challenge.questionId,subject:challenge.subject,stage:challenge.stage,topic:challenge.topic,difficulty:challenge.difficulty,prompt:challenge.prompt,answers:challenge.answers,pillars:challenge.pillars,fallback:challenge.fallback,expiresAt:challenge.expiresAt,ruinBonus:!!challenge.ruinId,lectern:challenge.source==='lectern',questionHall:challenge.source==='question_hall',dungeonRecall:this.recallDungeonSpace(p),mastery:RECALL.masterySummary(rec&&rec.prof.recallMastery||{},'Computer Science')});
    return true;
  }
  handleRecallSubject(client,message={}){
    const subject='Computer Science';
    if(!client)return;
    this.recallSubjects.set(client.sessionId,subject);
    const rec=typeof this.profileFor==='function'&&this.profileFor(client);if(rec){rec.prof.recallSubject=subject;this.dirtyPlayers.add(rec.token);client.send('recallMastery',{subject,...RECALL.masterySummary(rec.prof.recallMastery||{},subject)});}
  }
  recallStandHeight(p,x,z){
    if(this.recallTutorialSpace(p))return p.y;
    const dgn=p&&p.dgn||'',inst=dgn&&this.instances&&this.instances[dgn],world=inst&&inst.world||this.world;
    const h=world&&typeof world.standHeight==='function'?world.standHeight(x,z,(p&&p.y||W.WH)-1):W.standHeight(x,z,(p&&p.y||W.WH)-1);
    return h>0?h:p.y;
  }
  recallPillarClear(p,candidate){
    if(!p||!Number.isFinite(candidate.x)||!Number.isFinite(candidate.z))return false;
    const dungeonSpace=this.recallDungeonSpace(p);
    // Relocation probes must never pull an answer back into the camera. The
    // world-space label is intentionally large enough to read at a distance.
    if(Math.hypot(candidate.x-p.x,candidate.z-p.z)<(dungeonSpace?3.75:6))return false;
    if(this.recallTutorialSpace(p)){
      candidate.y=p.y;
      return true;
    }
    const solid=typeof this.spaceSolid==='function'?this.spaceSolid(p.dgn||''):null;
    if(!solid)return true;
    const y=this.recallStandHeight(p,candidate.x,candidate.z);
    if(!Number.isFinite(y)||y<=0)return false;
    const bx=Math.floor(candidate.x),bz=Math.floor(candidate.z);
    // Reserve the whole visible beam and label footprint, not merely enough
    // room for a player's body. This prevents apparently valid answers from
    // cutting through roofs, walls, trees or street furniture.
    const r=dungeonSpace?1:2,heights=dungeonSpace?[y+.2,y+1.5,y+2.8,y+3.6]:[y+.2,y+1.5,y+3.2,y+5,y+7];
    for(let dx=-r;dx<=r;dx++)for(let dz=-r;dz<=r;dz++){
      for(const yy of heights)if(solid(bx+dx,Math.floor(yy),bz+dz))return false;
    }
    if(!AI.losClear(solid,p.x,p.y+1.2,p.z,candidate.x,y+1.2,candidate.z))return false;
    candidate.y=y;
    return true;
  }
  recallResolvePillar(p,base,forward,right){
    const offsets=[{f:0,s:0}];
    for(const r of [2.75,5.5,8.25,11]){
      offsets.push({f:r,s:0},{f:-r,s:0},{f:0,s:r},{f:0,s:-r},{f:r,s:r},{f:r,s:-r},{f:-r,s:r},{f:-r,s:-r});
    }
    for(const o of offsets){
      const candidate={index:base.index,x:base.x+forward.x*o.f+right.x*o.s,y:base.y,z:base.z+forward.z*o.f+right.z*o.s};
      if(this.recallPillarClear(p,candidate))return candidate;
    }
    return {...base,blocked:true};
  }
  recallPositions(p,yaw=null){
    const a=Number.isFinite(yaw)?yaw:Number.isFinite(p.yaw)?p.yaw:0,forward={x:-Math.sin(a),z:-Math.cos(a)},right={x:Math.cos(a),z:-Math.sin(a)};
    const dungeonSpace=this.recallDungeonSpace(p);
    const diamond=dungeonSpace?[
      {f:8,s:0},
      {f:5.75,s:-4.75},
      {f:5.75,s:4.75},
      {f:4.25,s:0},
    ]:[
      {f:16,s:0},     // front point
      {f:11,s:-9.5},  // left point
      {f:11,s:9.5},   // right point
      {f:7,s:0},      // rear point: far enough that its label cannot engulf the camera
    ];
    return diamond.map((o,i)=>{
      const base={index:i,x:p.x+forward.x*o.f+right.x*o.s,y:p.y,z:p.z+forward.z*o.f+right.z*o.s};
      return typeof this.recallPillarClear==='function'?this.recallResolvePillar(p,base,forward,right):base;
    });
  }
  async handleRecallStart(client,message={}){
    if(!client)return;
    const p=this.state.players.get(client.sessionId);let now=Date.now();
    if(!p)return;
    const rec=typeof this.profileFor==='function'&&this.profileFor(client);
    const active=this.recallChallenges.get(client.sessionId),questionHallRequest=message.source==='question_hall';
    if(active&&active.expiresAt>now){
      if(questionHallRequest&&active.source==='question_hall')this.recallChallenges.delete(client.sessionId);
      else return this.sendRecallQuestion(client,active,rec,p);
    }
    if(this.rateLimited(client,'recallStart',4,8))return client.send('recallReject',{reason:'rate'});
    const subject='Computer Science';
    this.recallSubjects.set(client.sessionId,subject);
    if(rec)rec.prof.recallSubject=subject;
    let ruinId='';
    if(typeof message.ruinId==='string'){
      const ruin=W.regionalLandmarkSpecs().find(s=>s.id===message.ruinId&&s.type==='ruins');
      if(!ruin||p.dgn||Math.hypot(p.x-ruin.x,p.z-ruin.z)>(ruin.radius||11)+3)return client.send('recallReject',{reason:'ruin_range'});
      const claimKey=ruin.id+'_knowledge';
      if(rec&&Array.isArray(rec.prof.claimedDiscoveries)&&rec.prof.claimedDiscoveries.includes(claimKey))return client.send('recallReject',{reason:'ruin_claimed'});
      ruinId=ruin.id;
    }
    const tutorial=this.recallTutorialSpace(p),questionHall=questionHallRequest;
    let q=null;
    if(this.recallStartsPending.has(client.sessionId))return client.send('recallReject',{reason:'pending'});
    this.recallStartsPending.add(client.sessionId);
    const startDim=p.dim,startDungeon=p.dgn;
    try{
      const auth=getAuthService(),store=auth&&typeof auth.getGameQuestionStore==='function'?auth.getGameQuestionStore():null;
      if(store&&client&&client._account&&typeof store.loadRecallQuestion==='function'){
        const mastery=rec&&rec.prof&&rec.prof.recallMastery||{},recent=this.recallRecentQuestions.get(client.sessionId)||[],recentPrompts=this.recallRecentPrompts.get(client.sessionId)||[],avoid=this.recallAvoidance(mastery,recent,recentPrompts);
        q=await this.loadRecallQuestionWithTimeout(store,client._account,{subject,fallbackSubject:'Computer Science',avoidQuestionIds:avoid.ids,avoidPrompts:avoid.prompts});
      }
    }catch(_){}finally{this.recallStartsPending.delete(client.sessionId);}
    if(this.state.players.get(client.sessionId)!==p)return;
    if(p.dim!==startDim||p.dgn!==startDungeon)return client.send('recallReject',{reason:'space_changed'});
    now=Date.now();
    if(!q){
      const history=rec&&rec.prof.recallMastery||{},recent=this.recallRecentQuestions.get(client.sessionId)||[],recentPrompts=this.recallRecentPrompts.get(client.sessionId)||[],avoid=this.recallAvoidance(history,recent,recentPrompts);
      const avoidedPrompts=new Set(avoid.prompts);
      const selectionHistory={...history,items:{...(history.items||{})}};
      for(const item of RECALL.QUESTIONS){
        const prompt=String(item.prompt||'').toLowerCase().replace(/\s+/g,' ').trim();
        if(!avoid.ids.includes(item.id)&&!avoidedPrompts.has(prompt))continue;
        selectionHistory.items[item.id]={...(selectionHistory.items[item.id]||{}),nextDue:now+RECALL.QUESTION_MS};
      }
      q=RECALL.selectQuestion(subject,selectionHistory,now,Math.random);
    }
    this.recallSeq++;
    const yaw=Number.isFinite(message.yaw)?clampN(message.yaw,-10,10):p.yaw;
    const id=now.toString(36)+'-'+Math.random().toString(36).slice(2,8),pillars=this.recallPositions(p,yaw),fallback=questionHall||pillars.some(v=>v.blocked),expiresAt=now+RECALL.QUESTION_MS;
    const source=message.source==='lectern'?'lectern':(questionHall?'question_hall':(tutorial?'tutorial':''));
    if(q&&q.id){
      const recent=this.recallRecentQuestions.get(client.sessionId)||[];
      this.recallRecentQuestions.set(client.sessionId,[q.id,...recent.filter(id=>id!==q.id)].slice(0,4));
      const recentPrompts=this.recallRecentPrompts.get(client.sessionId)||[],prompt=String(q.prompt||'').toLowerCase().replace(/\s+/g,' ').trim();
      if(prompt)this.recallRecentPrompts.set(client.sessionId,[prompt,...recentPrompts.filter(value=>value!==prompt)].slice(0,4));
      // Treat opening a question as recent even if the player leaves before
      // answering it, so reconnecting cannot serve the same prompt again.
      if(rec&&rec.prof){
        rec.prof.recallMastery=rec.prof.recallMastery||{items:{},lastQuestionId:'',lastTopic:'',totalAttempts:0,totalCorrect:0};
        rec.prof.recallMastery.lastQuestionId=q.id;
        rec.prof.recallMastery.lastTopic=q.topic||'';
        this.dirtyPlayers.add(rec.token);
      }
    }
    const challenge={id,questionId:q.id,subject:q.subject,stage:q.stage,topic:q.topic,difficulty:q.difficulty,spec:q.spec,prompt:q.prompt,answers:q.answers,correct:q.correct,explanation:q.explanation,pillars,fallback,expiresAt,startedAt:now,ruinId,source};
    this.recallChallenges.set(client.sessionId,challenge);
    this.sendRecallQuestion(client,challenge,rec,p);
  }
  recordRecallAnalytics(client,challenge,answerIndex,correct,now=Date.now()){
    const account=client&&client._account;
    if(!account||String(account.accountType||account.role||'').toLowerCase()==='teacher')return;
    let store=null;
    try{const auth=getAuthService();if(!auth)return;store=typeof auth.getGameQuestionStore==='function'&&auth.getGameQuestionStore();}catch(_){return;}
    if(!store||typeof store.recordRecallAttempt!=='function')return;
    const durationMs=Math.max(0,now-(challenge.startedAt||now));
    Promise.resolve(store.recordRecallAttempt(account,{
      subject:challenge.subject,
      stage:challenge.stage,
      topic:challenge.topic,
      difficulty:challenge.difficulty,
      spec:challenge.spec||challenge.questionId,
      prompt:challenge.prompt,
      answers:challenge.answers,
      correctIndex:challenge.correct,
      explanation:challenge.explanation,
      answerIndex,
      correct,
      durationMs,
      source:challenge.source==='lectern'?'lectern':(challenge.source==='question_hall'?'question_hall':(challenge.source==='tutorial'?'tutorial':'recall')),
    })).then(result=>{
      const rec=typeof this.profileFor==='function'&&this.profileFor(client);
      if(!rec||!rec.prof||!result||!Array.isArray(result.homeworkObjectives))return;
      rec.prof.homeworkObjectives=result.homeworkObjectives;
      if(typeof this.sendProfile==='function')this.sendProfile(client,rec.prof);
      else client&&client.send&&client.send('homeworkProgress',{homework:result.homeworkObjectives});
    }).catch(e=>{if(process.env.NODE_ENV!=='test')console.warn('[teacher-analytics] recall attempt log failed:',e&&e.message||e);});
  }
  recordHomeworkActivity(client,subjectId=0,options={}){
    const account=client&&client._account;
    if(!account||String(account.accountType||account.role||'').toLowerCase()==='teacher')return Promise.resolve([]);
    let store=null;
    try{const auth=getAuthService();if(!auth)return Promise.resolve([]);store=typeof auth.getGameQuestionStore==='function'&&auth.getGameQuestionStore();}catch(_){return Promise.resolve([]);}
    if(!store||typeof store.recordHomeworkProgress!=='function')return Promise.resolve([]);
    return Promise.resolve(store.recordHomeworkProgress(account,subjectId,{fallbackToAnyActive:true,...options})).then(list=>{
      const rec=typeof this.profileFor==='function'&&this.profileFor(client);
      if(!rec||!rec.prof||!Array.isArray(list))return list;
      rec.prof.homeworkObjectives=list;
      if(typeof this.sendProfile==='function')this.sendProfile(client,rec.prof);
      else client&&client.send&&client.send('homeworkProgress',{homework:list});
      return list;
    }).catch(e=>{
      if(process.env.NODE_ENV!=='test')console.warn('[teacher-analytics] homework activity failed:',e&&e.message||e);
      return [];
    });
  }
  refreshHomeworkObjectives(client,prof){
    const account=client&&client._account;
    if(!account||String(account.accountType||account.role||'').toLowerCase()==='teacher')return;
    let store=null;
    try{const auth=getAuthService();if(!auth)return;store=typeof auth.getGameQuestionStore==='function'&&auth.getGameQuestionStore();}catch(_){return;}
    if(!store||typeof store.homeworkProgressForStudent!=='function')return;
    Promise.resolve(store.homeworkProgressForStudent(account,{})).then(list=>{
      if(!prof||!Array.isArray(list))return;
      prof.homeworkObjectives=list;
      if(typeof this.sendProfile==='function')this.sendProfile(client,prof);
    }).catch(e=>{if(process.env.NODE_ENV!=='test')console.warn('[teacher-analytics] homework progress refresh failed:',e&&e.message||e);});
  }
  handleRecallAnswer(client,message){
    const sid=client&&client.sessionId,challenge=sid&&this.recallChallenges.get(sid),p=sid&&this.state.players.get(sid),now=Date.now();
    if(!challenge||!p||!message||message.id!==challenge.id)return client&&client.send('recallReject',{reason:'invalid'});
    if(challenge.expiresAt<=now){this.recallChallenges.delete(sid);return client.send('recallResult',{id:challenge.id,expired:true});}
    const index=message.index|0,pillar=challenge.pillars[index];
    if(!pillar||(!challenge.fallback&&Math.hypot(p.x-pillar.x,p.z-pillar.z)>2.65))return client.send('recallReject',{reason:'position'});
    this.recallChallenges.delete(sid);
    const rec=typeof this.profileFor==='function'&&this.profileFor(client),correct=index===challenge.correct;
    let review=null,mastery=null;
    if(rec){
      const question=RECALL.QUESTIONS.find(q=>q.id===challenge.questionId)||{id:challenge.questionId,topic:challenge.topic};
      review=RECALL.reviewQuestion(rec.prof.recallMastery||{},question,correct,now);rec.prof.recallMastery=review.history;this.dirtyPlayers.add(rec.token);
      mastery=RECALL.masterySummary(review.history,'Computer Science');
    }
    this.recordRecallAnalytics(client,challenge,index,correct,now);
    if(correct){
      const st=this.regenAbilityState(client),restore=Math.max(1,Math.ceil(st.maxMp*RECALL.RESTORE_FRACTION));
      st.mp=Math.min(st.maxMp,st.mp+restore);this.sendAbilitySync(client,st);
      const stamina=rec?this.restoreRecallStamina(client,rec.prof):{restore:0,sp:null,maxSp:null};
      if(rec)this.dirtyPlayers.add(rec.token);
      let explorationGold=0;
      if(challenge.ruinId&&rec){
        const claimKey=challenge.ruinId+'_knowledge';
        if(!Array.isArray(rec.prof.claimedDiscoveries))rec.prof.claimedDiscoveries=[];
        if(!rec.prof.claimedDiscoveries.includes(claimKey)){
          rec.prof.claimedDiscoveries.push(claimKey);explorationGold=50;
          rec.prof.gold=Math.min(1e9,(rec.prof.gold|0)+explorationGold);this.dirtyPlayers.add(rec.token);
          if(typeof this.syncPlayerProfile==='function')this.syncPlayerProfile(client,rec.prof);
        }
      }
      let fellowshipRenown=0;
      if(challenge.source==='lectern'&&typeof this.clientGuildHasProject==='function'&&this.clientGuildHasProject(client,'recall_lectern')){
        const key=rec&&rec.token||sid,last=this.recallLecternRenownAt.get(key)||0;
        if(now-last>=10*60*1000&&typeof this.awardGuildRenown==='function'){
          if(this.awardGuildRenown(client,1,'Recall Lectern study')){fellowshipRenown=1;this.recallLecternRenownAt.set(key,now);}
        }
      }
      return client.send('recallResult',{id:challenge.id,correct:true,mana:restore,stamina:stamina.restore,sp:stamina.sp,maxSp:stamina.maxSp,staminaFraction:RECALL.RESTORE_FRACTION,explorationGold,fellowshipRenown,explanation:challenge.explanation,nextDue:review&&review.record.nextDue,mastery,questionHall:challenge.source==='question_hall'});
    }
    const hall=challenge.source==='question_hall',freezeMs=hall?0:RECALL.FREEZE_MS;
    if(!hall){const frozenUntil=now+freezeMs;this.recallFrozenUntil.set(sid,frozenUntil);}
    client.send('recallResult',{id:challenge.id,correct:false,correctIndex:challenge.correct,explanation:challenge.explanation,freezeMs,nextDue:review&&review.record.nextDue,mastery,questionHall:hall});
  }
  restoreRecallStamina(client,prof){
    if(!prof||typeof this.maxStaminaForProfile!=='function')return{restore:0,sp:null,maxSp:null};
    if(typeof this.syncProfileVitals==='function')this.syncProfileVitals(client,prof);
    const maxSp=this.maxStaminaForProfile(prof),raw=prof.vitals&&typeof prof.vitals==='object'?prof.vitals:{};
    const st=typeof this.ensureAbilityState==='function'?this.ensureAbilityState(client):null;
    const current=Number.isFinite(st&&+st.sp)?+st.sp:(Number.isFinite(+raw.sp)?+raw.sp:maxSp);
    const restore=Math.max(1,Math.ceil(maxSp*RECALL.RESTORE_FRACTION));
    const nextSp=Math.max(0,Math.min(maxSp,current+restore));
    if(st){st.sp=nextSp;st.maxSp=maxSp;}
    prof.vitals={...raw,sp:nextSp};
    prof.vitalsSavedAt=Date.now();
    return{restore,sp:prof.vitals.sp,maxSp};
  }
  recallMovementLocked(sessionId,now=Date.now()){
    const until=this.recallFrozenUntil&&this.recallFrozenUntil.get(sessionId)||0;
    if(until<=now){if(until&&this.recallFrozenUntil)this.recallFrozenUntil.delete(sessionId);return false;}return true;
  }
  clearRecallState(sessionId){if(this.recallChallenges)this.recallChallenges.delete(sessionId);if(this.recallFrozenUntil)this.recallFrozenUntil.delete(sessionId);if(this.recallSubjects)this.recallSubjects.delete(sessionId);if(this.recallRecentQuestions)this.recallRecentQuestions.delete(sessionId);if(this.recallRecentPrompts)this.recallRecentPrompts.delete(sessionId);if(this.recallStartsPending)this.recallStartsPending.delete(sessionId);}
}
module.exports=RecallMixin.prototype;
