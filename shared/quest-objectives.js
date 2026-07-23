(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.BlockcraftQuestObjectives=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const CATEGORIES={
    story:'story',manhunt:'manhunt',aegis:'aegis',job:'job',guild:'guild',
    progression:'progression',tutorial:'tutorial',event:'event',discovery:'discovery'
  };
  const SOURCE_CATEGORY={
    story:'story',npc:'story',manhunt:'manhunt',aegis:'aegis',job:'job',guild:'guild',
    progression:'progression',tutorial:'tutorial',event:'event',discovery:'discovery'
  };
  function clean(value,fallback='',limit=80){
    return String(value==null?fallback:value).replace(/[<>]/g,'').slice(0,limit);
  }
  function statusOf(value){
    return ['offered','active','complete','claimable','failed','expired'].includes(value)?value:'active';
  }
  function categoryFor(o){
    const raw=clean(o&&o.category||'', '', 32);
    if(CATEGORIES[raw])return raw;
    return SOURCE_CATEGORY[clean(o&&o.source||'quest','quest',32)]||'progression';
  }
  function progressOf(progress){
    if(!progress||typeof progress!=='object')return null;
    const required=Math.max(1,Math.min(999999,progress.required|0||1));
    return {current:Math.max(0,Math.min(required,progress.current|0)),required};
  }
  function actionOf(action){
    if(!action||typeof action!=='object')return null;
    const type=clean(action.type,'',32),label=clean(action.label,'',40);
    if(!type&&!label)return null;
    return {type,label};
  }
  function chapterOf(chapter){
    if(!chapter||typeof chapter!=='object')return null;
    const id=clean(chapter.id||'', '', 48);
    const title=clean(chapter.title||'', '', 80);
    const step=Math.max(0,Math.min(99,chapter.step|0));
    const total=Math.max(step||1,Math.min(99,chapter.total|0||step||1));
    if(!id&&!title)return null;
    return {id,title,step,total};
  }
  function defaultAction(o,category,status){
    if(o&&o.action)return actionOf(o.action);
    if(status==='claimable'||status==='complete'){
      if(category==='job')return {type:'jobs',label:'CLAIM AT JOB BOARD'};
      if(category==='guild')return {type:'guild_contracts',label:'CLAIM GUILD CONTRACT'};
      if(category==='aegis')return {type:'claim_aegis',label:'CLAIM AT AEGIS'};
      return {type:'turn_in',label:'TURN IN'};
    }
    if(category==='job')return {type:'jobs',label:'OPEN JOB BOARD'};
    if(category==='guild')return {type:'guild_contracts',label:'OPEN GUILD CONTRACTS'};
    if(category==='aegis')return {type:'claim_aegis',label:'OPEN AEGIS'};
    return actionOf(o&&o.action)||{type:'quest_log',label:'OPEN QUEST LOG'};
  }
  function hudTextFor(o,status,progress){
    if(o&&o.hudText)return clean(o.hudText,'',180);
    const prefix=progress?Math.min(progress.required,progress.current)+'/'+progress.required+' - ':'';
    if(status==='claimable'||status==='complete'){
      if(o&&o.category==='job')return 'Complete - claim at the Job Board';
      if(o&&o.category==='guild')return 'Complete - claim from Guild Contracts';
      if(o&&o.category==='aegis')return 'Complete - claim from the Aegis Guardian';
      return 'Complete - turn in to '+clean(o&&o.location||'the quest giver','the quest giver',80);
    }
    return prefix+clean(o&&o.text||'Follow the objective.','Follow the objective.',180);
  }
  function normalizeObjective(input){
    if(!input||typeof input!=='object')return null;
    const id=clean(input.id,'',96),title=clean(input.title,'',80);
    if(!id||!title)return null;
    const source=clean(input.source||input.category||'quest','quest',32);
    const category=categoryFor(input);
    const status=statusOf(input.status);
    const progress=progressOf(input.progress);
    const action=defaultAction(input,category,status);
    const claimAction=(status==='claimable'||status==='complete')?(actionOf(input.claimAction)||action):null;
    const hudAction=actionOf(input.hudAction)||action;
    const questLogAction=actionOf(input.questLogAction)||action;
    return {
      ...input,
      id,source,category,
      questType:clean(input.questType||category||source,'quest',32),
      title,status,
      text:clean(input.text||'', '', 180),
      location:clean(input.location||'', '', 80),
      action,
      claimAction,
      hudAction,
      questLogAction,
      hudText:hudTextFor({...input,category},status,progress),
      progress,
      chapter:chapterOf(input.chapter),
      priority:Math.max(0,Math.min(999,input.priority|0||100)),
      serverOwned:input.serverOwned!==false,
    };
  }
  function normalizeObjectiveList(list){
    return Array.isArray(list)?list.map(normalizeObjective).filter(Boolean).slice(0,12):[];
  }
  return {normalizeObjective,normalizeObjectiveList,categoryFor};
});
