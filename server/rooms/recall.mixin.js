const RECALL=require('../../shared/recall-system');
const { clampN }=require('./constants');
const AI=require('../ai');
const W=require('../world');

class RecallMixin{
  initRecallState(){this.recallChallenges=new Map();this.recallFrozenUntil=new Map();this.recallSubjects=new Map();this.recallSeq=0;this.recallLecternRenownAt=new Map();}
  recallTutorialSpace(p){
    return !!(p&&(p.dim==='tutorial'||String(p.dgn||'').startsWith('tutorial-')));
  }
  handleRecallSubject(client,message={}){
    if(!client||!RECALL.SUBJECTS.includes(message.subject))return;
    this.recallSubjects.set(client.sessionId,message.subject);
    const rec=typeof this.profileFor==='function'&&this.profileFor(client);if(rec){rec.prof.recallSubject=message.subject;this.dirtyPlayers.add(rec.token);client.send('recallMastery',{subject:message.subject,...RECALL.masterySummary(rec.prof.recallMastery||{},message.subject)});}
  }
  recallStandHeight(p,x,z){
    if(this.recallTutorialSpace(p))return p.y;
    const dgn=p&&p.dgn||'',inst=dgn&&this.instances&&this.instances[dgn],world=inst&&inst.world||this.world;
    const h=world&&typeof world.standHeight==='function'?world.standHeight(x,z,(p&&p.y||W.WH)-1):W.standHeight(x,z,(p&&p.y||W.WH)-1);
    return h>0?h:p.y;
  }
  recallPillarClear(p,candidate){
    if(!p||!Number.isFinite(candidate.x)||!Number.isFinite(candidate.z))return false;
    // Relocation probes must never pull an answer back into the camera. The
    // world-space label is intentionally large enough to read at a distance.
    if(Math.hypot(candidate.x-p.x,candidate.z-p.z)<6)return false;
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
    for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){
      for(const yy of [y+.2,y+1.5,y+3.2,y+5,y+7])if(solid(bx+dx,Math.floor(yy),bz+dz))return false;
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
    const diamond=[
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
  handleRecallStart(client,message={}){
    if(!client||this.rateLimited(client,'action',4,8))return;
    const p=this.state.players.get(client.sessionId),now=Date.now();
    if(!p)return;
    const active=this.recallChallenges.get(client.sessionId);
    if(active&&active.expiresAt>now)return client.send('recallReject',{reason:'active'});
    const rec=typeof this.profileFor==='function'&&this.profileFor(client);
    const subject=RECALL.SUBJECTS.includes(message.subject)?message.subject:(this.recallSubjects.get(client.sessionId)||(rec&&rec.prof.recallSubject)||'English');
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
    const q=RECALL.selectQuestion(subject,rec&&rec.prof.recallMastery||{},now,Math.random);this.recallSeq++;
    const yaw=Number.isFinite(message.yaw)?clampN(message.yaw,-10,10):p.yaw;
    const id=now.toString(36)+'-'+Math.random().toString(36).slice(2,8),pillars=this.recallPositions(p,yaw),fallback=pillars.some(v=>v.blocked),expiresAt=now+RECALL.QUESTION_MS;
    const source=message.source==='lectern'?'lectern':'';
    this.recallChallenges.set(client.sessionId,{id,questionId:q.id,topic:q.topic,difficulty:q.difficulty,correct:q.correct,explanation:q.explanation,pillars,fallback,expiresAt,ruinId,source});
    client.send('recallQuestion',{id,questionId:q.id,subject:q.subject,stage:q.stage,topic:q.topic,difficulty:q.difficulty,prompt:q.prompt,answers:q.answers,pillars,fallback,expiresAt,ruinBonus:!!ruinId,lectern:source==='lectern',mastery:RECALL.masterySummary(rec&&rec.prof.recallMastery||{},subject)});
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
      mastery=RECALL.masterySummary(review.history,rec.prof.recallSubject||'English');
    }
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
      return client.send('recallResult',{id:challenge.id,correct:true,mana:restore,stamina:stamina.restore,sp:stamina.sp,maxSp:stamina.maxSp,staminaFraction:RECALL.RESTORE_FRACTION,explorationGold,fellowshipRenown,explanation:challenge.explanation,nextDue:review&&review.record.nextDue,mastery});
    }
    const frozenUntil=now+RECALL.FREEZE_MS;this.recallFrozenUntil.set(sid,frozenUntil);
    client.send('recallResult',{id:challenge.id,correct:false,correctIndex:challenge.correct,explanation:challenge.explanation,freezeMs:RECALL.FREEZE_MS,nextDue:review&&review.record.nextDue,mastery});
  }
  restoreRecallStamina(client,prof){
    if(!prof||typeof this.maxStaminaForProfile!=='function')return{restore:0,sp:null,maxSp:null};
    if(typeof this.syncProfileVitals==='function')this.syncProfileVitals(client,prof);
    const maxSp=this.maxStaminaForProfile(prof),raw=prof.vitals&&typeof prof.vitals==='object'?prof.vitals:{};
    const current=Number.isFinite(+raw.sp)?+raw.sp:maxSp,restore=Math.max(1,Math.ceil(maxSp*RECALL.RESTORE_FRACTION));
    prof.vitals={...raw,sp:Math.max(0,Math.min(maxSp,current+restore))};
    prof.vitalsSavedAt=Date.now();
    return{restore,sp:prof.vitals.sp,maxSp};
  }
  recallMovementLocked(sessionId,now=Date.now()){
    const until=this.recallFrozenUntil&&this.recallFrozenUntil.get(sessionId)||0;
    if(until<=now){if(until&&this.recallFrozenUntil)this.recallFrozenUntil.delete(sessionId);return false;}return true;
  }
  clearRecallState(sessionId){if(this.recallChallenges)this.recallChallenges.delete(sessionId);if(this.recallFrozenUntil)this.recallFrozenUntil.delete(sessionId);if(this.recallSubjects)this.recallSubjects.delete(sessionId);}
}
module.exports=RecallMixin.prototype;
