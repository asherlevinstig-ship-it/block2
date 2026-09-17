const W=require('../world');
const {Mob}=require('../schema');
const {BIOME_COLLECTIBLE,BIOME_HOSTILE,DANGER_RINGS,I,dangerRingAt}=require('./constants');

const ENCOUNTER_RESET_MS=20*60*1000;
const DAILY_MODIFIERS=Object.freeze([
  {id:'fortified',name:'Fortified',description:'Guardians and their master have greatly increased health.',hp:1.45},
  {id:'frenzy',name:'Frenzy',description:'Enemies attack harder and move faster.',damage:1.3,speed:1.08},
  {id:'reinforcements',name:'Reinforcements',description:'Two additional guardians defend the structure.',guards:2},
  {id:'deadeye',name:'Deadeye',description:'More guardians fight at range and their projectiles hit harder.',ranged:true,arrow:1.4},
  {id:'champion',name:'Champion\'s Oath',description:'The structure master is empowered.',bossHp:1.65,bossDamage:1.25},
]);
const DAILY_REWARDS=Object.freeze([
  {id:I.GEODE,name:'Geode'},
  {id:I.REPAIR_KIT,name:'Repair Kit'},
  {id:I.STORMGLASS,name:'Stormglass'},
  {id:I.SOLAR_GLYPH,name:'Solar Glyph'},
  {id:I.LEGEND_TOKEN,name:'Legend Token'},
]);
const BOSS_NAMES=Object.freeze({
  ruined_keep:'Oathbound Captain',
  overgrown_temple:'Briarheart Keeper',
  arcane_tower:'Sunspire Magus',
  giant_hall:'Frostbound Jarl',
  witch_enclave:'Mirelight Hag',
});

class OverworldStructuresMixin {
  fantasyStructureDaily(now=Date.now()){
    const sites=W.fantasyStructureSpecs(),day=Math.floor(now/86400000);
    if(!sites.length)return null;
    const site=sites[day%sites.length],modifier=DAILY_MODIFIERS[(day*7)%DAILY_MODIFIERS.length],reward=DAILY_REWARDS[day%DAILY_REWARDS.length];
    return {day,siteId:site.id,siteName:site.name,type:site.type,modifier:{...modifier},reward:{...reward},resetsAt:(day+1)*86400000};
  }
  fantasyStructureDailyForProfile(prof,now=Date.now()){
    const daily=this.fantasyStructureDaily(now);return daily?{...daily,claimed:!!(prof&&(prof.fantasyStructureDailyDay|0)===daily.day)}:null;
  }
  fantasyStructureSite(id){
    if(!this.fantasyStructureById)this.fantasyStructureById=new Map(W.fantasyStructureSpecs().map(s=>[s.id,s]));
    return this.fantasyStructureById.get(String(id||''))||null;
  }
  fantasyStructureCleared(prof,id){
    return !!(prof&&Array.isArray(prof.fantasyStructureClears)&&prof.fantasyStructureClears.includes(id));
  }
  livingFantasyDefenders(state){
    if(!state||!Array.isArray(state.mobIds))return [];
    return state.mobIds.filter(id=>this.state.mobs.has(id));
  }
  fantasyStructureStatusPayload(site,state){
    const done=new Set(state.objectivesDone||[]),available=(site.objectives||[]).filter(o=>!done.has(o.id));
    const objectives=(site.objectiveMode==='sequence'?available.slice(0,1):available).map(o=>({id:o.id,label:o.label,verb:o.verb,hint:o.hint,x:o.x,y:o.y,z:o.z,index:o.index}));
    return {id:site.id,name:site.name,type:site.type,phase:state.phase,objective:site.activity,intro:site.objectiveIntro,objectives,completedObjectiveIds:[...done],objectivesDone:done.size,objectiveTotal:(site.objectives||[]).length,remaining:state.phase==='boss'?1:state.phase==='guards'?Math.max(0,state.required-state.killed):objectives.length,living:this.livingFantasyDefenders(state).length,daily:state.daily||null,resetAt:state.resetAt||0};
  }
  sendFantasyStructureStatus(site,state,onlyClient=null){
    const payload=this.fantasyStructureStatusPayload(site,state);
    for(const target of onlyClient?[onlyClient]:(this.clients||[])){
      const p=this.state.players.get(target.sessionId);
      if(p&&!p.dgn&&Math.hypot(p.x-site.x,p.z-site.z)<=site.radius+24)target.send('fantasyStructureStatus',payload);
    }
  }
  spawnFantasyStructureDefenders(site,state){
    const ring=dangerRingAt(site.x,site.z),danger=DANGER_RINGS[ring],family=BIOME_HOSTILE[site.biome]||BIOME_HOSTILE[W.BIO.PLAINS];
    const modifier=state.daily&&state.daily.modifier||{};
    const living=this.livingFantasyDefenders(state),bossPhase=state.phase==='boss',needed=bossPhase?(living.length?0:1):Math.max(0,state.required-state.killed-living.length);
    for(let i=0;i<needed;i++){
      const sequence=state.killed+living.length+i,boss=bossPhase,angle=(sequence/Math.max(1,state.required))*Math.PI*2;
      const x=site.x+Math.cos(angle)*(site.radius+3),z=site.z+Math.sin(angle)*(site.radius+3),y=this.world.standHeight(x,z,W.WH-2);
      if(y<2)continue;
      this.mobSeq=(this.mobSeq|0)+1;
      const id=String(this.mobSeq),mob=new Mob(),ranged=(boss&&site.type==='arcane_tower')||(!boss&&(modifier.ranged?sequence%2===0:sequence%3===1));
      mob.x=x;mob.y=y;mob.z=z;mob.kind=ranged?family.ranged:family.melee;mob.elite=boss;
      mob.displayName=boss?BOSS_NAMES[site.type]:'';
      const hpMultiplier=(modifier.hp||1)*(boss?(modifier.bossHp||1):1),damageMultiplier=(modifier.damage||1)*(boss?(modifier.bossDamage||1):1);
      mob.maxHp=mob.hp=Math.round((boss?34:15)*danger.hp*family.hp*hpMultiplier);this.state.mobs.set(id,mob);
      const meta=this.freshMeta(x,z,Math.round((boss?7:4)*danger.dmg*family.dmg*damageMultiplier),(boss?1.35:1.55)*family.speed*(modifier.speed||1),mob.kind,ring,boss);
      meta.fantasyStructure=true;meta.structureId=site.id;meta.dangerRing=ring;meta.elite=boss;meta.biomeDrop=family.drop;meta.biomeBehavior=family.behavior;
      meta.sx=site.x;meta.sz=site.z;meta.tx=site.x;meta.tz=site.z;
      if(ranged)meta.arrowDmg=Math.max(2,Math.round(3*danger.dmg*family.dmg*damageMultiplier*(modifier.arrow||1)));
      if(family.behavior==='brute'||site.type==='giant_hall')meta.brute=true;
      if(family.behavior==='quickshot'||site.type==='arcane_tower')meta.quickShot=true;
      if(family.behavior==='flanker')meta.flank*=1.6;
      this.mobMeta[id]=meta;state.mobIds.push(id);
    }
    return this.livingFantasyDefenders(state).length;
  }
  completeFantasyStructureForClient(client,site){
    const rec=this.profileFor(client);if(!rec||this.fantasyStructureCleared(rec.prof,site.id))return false;
    if(!Array.isArray(rec.prof.fantasyStructureClears))rec.prof.fantasyStructureClears=[];
    rec.prof.fantasyStructureClears.push(site.id);
    const ring=dangerRingAt(site.x,site.z),regional=BIOME_COLLECTIBLE[site.biome],baseGold=55+ring*30,xp=60+ring*35;
    const mastery=rec.prof.fantasyStructureClears.length>=W.fantasyStructureSpecs().length&&!rec.prof.fantasyStructureMastery;
    if(mastery)rec.prof.fantasyStructureMastery=true;
    const masteryGold=mastery?300:0,gold=baseGold+masteryGold;
    rec.prof.gold=Math.min(1e9,(rec.prof.gold|0)+gold);this.dirtyPlayers.add(rec.token);
    if(this.recordEconomyGold)this.recordEconomyGold(client,gold,'exploration_faucet',mastery?'fantasy_structure_mastery':'fantasy_structure_clear',{structure:site.type,ring});
    const items=[];if(regional)items.push({id:regional.item,count:2+ring});if(site.rarity==='legendary')items.push({id:I.DIAMOND,count:2});
    if(mastery)items.push({id:I.LEGEND_TOKEN,count:2});
    this.awardGrant(client,{source:'fantasy_structure',structure:site.type,xp,items,dangerRing:ring,elite:true});
    client.send('fantasyStructureComplete',{id:site.id,name:site.name,type:site.type,gold,xp,items,totalGold:rec.prof.gold|0,clears:rec.prof.fantasyStructureClears.length});
    if(mastery)client.send('fantasyStructureMastery',{title:'Mythic Cartographer',gold:masteryGold,items:[{id:I.LEGEND_TOKEN,count:2}],totalGold:rec.prof.gold|0});
    return true;
  }
  completeFantasyStructureDailyForClient(client,site,state){
    const rec=this.profileFor(client),daily=state&&state.daily;
    if(!rec||!daily||daily.siteId!==site.id||(rec.prof.fantasyStructureDailyDay|0)===daily.day)return false;
    const ring=dangerRingAt(site.x,site.z),gold=110+ring*30,xp=105+ring*35,regional=BIOME_COLLECTIBLE[site.biome],items=[{id:daily.reward.id,count:1}];
    if(regional)items.push({id:regional.item,count:1+Math.floor(ring/2)});
    rec.prof.fantasyStructureDailyDay=daily.day;rec.prof.gold=Math.min(1e9,(rec.prof.gold|0)+gold);this.dirtyPlayers.add(rec.token);
    if(this.recordEconomyGold)this.recordEconomyGold(client,gold,'exploration_faucet','fantasy_structure_daily',{structure:site.type,modifier:daily.modifier.id,ring});
    this.awardGrant(client,{source:'fantasy_structure_daily',structure:site.type,xp,items,dangerRing:ring,elite:true});
    client.send('fantasyStructureDailyComplete',{id:site.id,name:site.name,modifier:daily.modifier,reward:daily.reward,gold,xp,items,totalGold:rec.prof.gold|0,day:daily.day,resetsAt:daily.resetsAt});
    return true;
  }
  finishFantasyStructure(site,state){
    state.phase='cleared';state.clearedAt=Date.now();state.resetAt=state.clearedAt+ENCOUNTER_RESET_MS;
    this.sendSpace('','fx',{t:'expeditionSignal',x:site.x,y:site.y+3,z:site.z,stage:3,dgn:''});
    for(const client of this.clients||[]){
      const p=this.state.players.get(client.sessionId);
      if(p&&!p.dgn&&Math.hypot(p.x-site.x,p.z-site.z)<=site.radius+24){this.completeFantasyStructureForClient(client,site);this.completeFantasyStructureDailyForClient(client,site,state);}
    }
  }
  onFantasyStructureMobKilled(client,mobId,meta){
    const site=meta&&this.fantasyStructureSite(meta.structureId);if(!site||!this.fantasyStructureStates)return false;
    const state=this.fantasyStructureStates.get(site.id);if(!state||!['guards','boss'].includes(state.phase))return false;
    state.mobIds=state.mobIds.filter(id=>id!==String(mobId));
    if(state.phase==='guards')state.killed=Math.min(state.required,state.killed+1);
    if(state.phase==='guards'&&state.killed>=state.required){
      state.phase='boss';this.spawnFantasyStructureDefenders(site,state);
      for(const target of this.clients||[]){const p=this.state.players.get(target.sessionId);if(p&&!p.dgn&&Math.hypot(p.x-site.x,p.z-site.z)<=site.radius+24)target.send('fantasyStructureBoss',{id:site.id,name:site.name,boss:BOSS_NAMES[site.type]});}
    }else if(state.phase==='boss')this.finishFantasyStructure(site,state);
    else this.sendFantasyStructureStatus(site,state);
    return true;
  }
  advanceFantasyStructureObjective(client,site,state,objectiveId){
    if(state.phase!=='objective')return false;
    const objectives=site.objectives||[],done=new Set(state.objectivesDone||[]),objective=objectives.find(o=>o.id===String(objectiveId||''));
    if(!objective||done.has(objective.id))return false;
    const p=this.state.players.get(client.sessionId);
    if(!p||Math.hypot(p.x-objective.x,p.y-objective.y,p.z-objective.z)>5){client.send('fantasyStructureReject',{reason:'objective_range'});return true;}
    if(site.objectiveMode==='sequence'){
      const expected=objectives.find(o=>!done.has(o.id));
      if(!expected||expected.id!==objective.id){client.send('fantasyStructureReject',{reason:'sequence',expected:expected&&expected.label});return true;}
    }
    state.objectivesDone.push(objective.id);done.add(objective.id);
    for(const target of this.clients||[]){
      const tp=this.state.players.get(target.sessionId);
      if(tp&&!tp.dgn&&Math.hypot(tp.x-site.x,tp.z-site.z)<=site.radius+24)target.send('fantasyStructureObjective',{id:site.id,name:site.name,type:site.type,objectiveId:objective.id,label:objective.label,x:objective.x,y:objective.y,z:objective.z,done:done.size,total:objectives.length});
    }
    if(done.size>=objectives.length){
      state.phase='guards';this.spawnFantasyStructureDefenders(site,state);
      for(const target of this.clients||[]){
        const tp=this.state.players.get(target.sessionId);
        if(tp&&!tp.dgn&&Math.hypot(tp.x-site.x,tp.z-site.z)<=site.radius+24)target.send('fantasyStructureCombat',{id:site.id,name:site.name,remaining:state.required});
      }
    }
    this.sendFantasyStructureStatus(site,state);
    return true;
  }
  handleFantasyStructureInteract(client,m={}){
    const p=this.state.players.get(client.sessionId),site=this.fantasyStructureSite(m.id),rec=this.profileFor(client);
    if(!p||p.dgn||!site||!rec||Math.hypot(p.x-site.x,p.z-site.z)>site.radius+5||Math.abs(p.y-(site.y+1))>12)return client.send('fantasyStructureReject',{reason:'range'});
    this.markDiscovery(client,site);
    const now=Date.now();
    const daily=this.fantasyStructureDaily(now),cleared=this.fantasyStructureCleared(rec.prof,site.id),dailyEligible=!!(cleared&&daily&&daily.siteId===site.id&&(rec.prof.fantasyStructureDailyDay|0)!==daily.day);
    if(cleared&&!dailyEligible)return client.send('fantasyStructureStatus',{id:site.id,name:site.name,phase:'complete',remaining:0,daily:daily&&daily.siteId===site.id?daily:null});
    if(!this.fantasyStructureStates)this.fantasyStructureStates=new Map();
    let state=this.fantasyStructureStates.get(site.id);
    if(state&&state.phase==='cleared'&&now<state.resetAt){
      if(!cleared)this.completeFantasyStructureForClient(client,site);
      else client.send('fantasyStructureStatus',{id:site.id,name:site.name,type:site.type,phase:'cooldown',remaining:0,daily:state.daily||null,resetAt:state.resetAt});
      return;
    }
    if(!state||state.phase==='cleared'){
      const ring=dangerRingAt(site.x,site.z),activeDaily=daily&&daily.siteId===site.id?daily:null;state={phase:'objective',objectivesDone:[],required:2+Math.min(2,ring)+(activeDaily&&activeDaily.modifier.guards||0),killed:0,mobIds:[],startedAt:now,resetAt:0,daily:activeDaily};this.fantasyStructureStates.set(site.id,state);
    }
    if(m.objectiveId&&this.advanceFantasyStructureObjective(client,site,state,m.objectiveId))return;
    if(state.phase!=='objective')this.spawnFantasyStructureDefenders(site,state);
    this.sendFantasyStructureStatus(site,state,client);
  }
}

module.exports=OverworldStructuresMixin.prototype;
