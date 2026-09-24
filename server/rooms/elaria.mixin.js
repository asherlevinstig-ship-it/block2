const W=require('../world');
const {I}=require('./constants');

const DAY_MS=24*60*60*1000;
const SITES=Object.freeze({
  throne:{x:1025.5,y:21.2,z:500.5},moonwell:{x:1034,y:20,z:500},harp:{x:1005.8,y:20,z:493.7},
  archives:{x:1022,y:31,z:504.8},orrery:{x:1022,y:40,z:500.5},
  chime_dawn:{x:997,y:21,z:492},chime_river:{x:1006,y:21,z:508},chime_crown:{x:1013,y:21,z:494},
  westwatch:{x:989,y:20,z:500},
});
const LORE_IDS=Object.freeze(['moonwell','harp','archives','orrery']);
const CHIMES=Object.freeze(['chime_dawn','chime_river','chime_crown']);
const COURT_ROUTES=Object.freeze([
  ['moonwell','archives','orrery'],
  ['harp','chime_dawn','chime_crown'],
  ['westwatch','moonwell','throne'],
]);
const COURT_NAMES=Object.freeze(['Memory of the Crown','Song of Three Boughs','The Peaceful Border']);

class ElariaMixin{
  elariaDay(now=Date.now()){return Math.floor(now/DAY_MS);}
  elariaAt(client,id,range=5.5){
    const p=client&&this.state.players.get(client.sessionId),site=SITES[id];
    return !!(p&&site&&!p.dgn&&p.dim==='overworld'&&Math.hypot(p.x-site.x,p.z-site.z)<=range&&Math.abs(p.y-site.y)<=6);
  }
  elariaCourtFor(prof,now=Date.now()){
    const day=this.elariaDay(now),raw=prof&&prof.elariaCourt;
    return raw&&raw.day===day&&COURT_ROUTES[raw.route] ? raw : null;
  }
  elariaStatePayload(prof,now=Date.now()){
    const day=this.elariaDay(now),court=this.elariaCourtFor(prof,now),ceremonyDay=prof.elariaCeremonyDay|0;
    const lore=[...new Set((prof.elariaLoreFound||[]).filter(id=>LORE_IDS.includes(id)))];
    return {
      day,lore,loreTotal:LORE_IDS.length,loreComplete:!!prof.elariaLoreRewarded,
      blessingUntil:Math.max(0,Number(prof.elariaBlessingUntil)||0),blessingReady:(prof.elariaBlessingDay|0)!==day,
      ceremony:{done:ceremonyDay===day,step:ceremonyDay===day?3:Math.max(0,Math.min(2,prof.elariaCeremonyStep|0))},
      court:court?{active:true,name:COURT_NAMES[court.route],route:COURT_ROUTES[court.route],step:court.step|0,claimable:(court.step|0)>=3,claimed:!!court.claimed}:{active:false,name:'',route:[],step:0,claimable:false,claimed:false},
    };
  }
  sendElariaState(client){const rec=this.profileFor(client);if(rec)client.send('elariaActivityState',this.elariaStatePayload(rec.prof));}
  elariaReward(client,rec,{gold=0,xp=0,item=null,source='elaria_activity'}={}){
    if(item&&this.inventorySpaceFor(rec.prof,item.id,item.count)<item.count)return false;
    if(item)this.addRewardItem(rec.prof,item.id,item.count);
    if(gold){rec.prof.gold=Math.min(1e9,(rec.prof.gold|0)+gold);if(this.recordEconomyGold)this.recordEconomyGold(client,gold,'elaria_faucet',source);}
    if(xp)this.grantHunterXp(rec.prof,xp,client,source);
    this.dirtyPlayers.add(rec.token);
    return true;
  }
  elariaAdvanceCourt(prof,target){
    const court=this.elariaCourtFor(prof);if(!court||court.claimed||court.step>=3)return false;
    const route=COURT_ROUTES[court.route];if(route[court.step]!==target)return false;
    court.step++;return true;
  }
  handleElariaActivity(client,m={}){
    const rec=this.profileFor(client),action=String(m.action||''),target=String(m.target||'');
    if(!rec)return;
    if(this.rateLimited(client,'elariaActivity',12,20))return client.send('elariaActivityResult',{ok:false,reason:'rate'});
    const reply=(payload={})=>{this.syncPlayerProfile(client,rec.prof);client.send('elariaActivityResult',{ok:true,...payload,state:this.elariaStatePayload(rec.prof)});this.sendElariaState(client);};
    if(action==='status'){
      const p=this.state.players.get(client.sessionId);
      if(!p||!W.isElfRealmLand(p.x,p.z,12))return client.send('elariaActivityResult',{ok:false,reason:'range'});
      return this.sendElariaState(client);
    }
    if(action==='court_start'){
      if(!this.elariaAt(client,'throne',7))return client.send('elariaActivityResult',{ok:false,reason:'range'});
      let court=this.elariaCourtFor(rec.prof);
      if(!court){const seed=String(rec.token||'').split('').reduce((n,ch)=>n+ch.charCodeAt(0),this.elariaDay());court={day:this.elariaDay(),route:seed%COURT_ROUTES.length,step:0,claimed:false};rec.prof.elariaCourt=court;this.dirtyPlayers.add(rec.token);}
      return reply({kind:'court_started',name:COURT_NAMES[court.route],next:COURT_ROUTES[court.route][court.step]||'throne'});
    }
    if(action==='court_claim'){
      const court=this.elariaCourtFor(rec.prof);
      if(!this.elariaAt(client,'throne',7))return client.send('elariaActivityResult',{ok:false,reason:'range'});
      if(!court||court.step<3||court.claimed)return client.send('elariaActivityResult',{ok:false,reason:'court'});
      if(!this.elariaReward(client,rec,{gold:90,xp:100,item:{id:I.HEARTWOOD_RESIN,count:2},source:'elaria_court'}))return client.send('elariaActivityResult',{ok:false,reason:'full'});
      court.claimed=true;this.dirtyPlayers.add(rec.token);return reply({kind:'court_complete',gold:90,xp:100,item:{id:I.HEARTWOOD_RESIN,count:2}});
    }
    if(action==='chime'){
      if(!CHIMES.includes(target)||!this.elariaAt(client,target,4.5))return client.send('elariaActivityResult',{ok:false,reason:'range'});
      const day=this.elariaDay();
      const courtAdvanced=this.elariaAdvanceCourt(rec.prof,target);
      if(courtAdvanced)this.dirtyPlayers.add(rec.token);
      if((rec.prof.elariaCeremonyDay|0)===day)return reply({kind:'ceremony_already',courtAdvanced});
      let step=Math.max(0,Math.min(2,rec.prof.elariaCeremonyStep|0));
      if(CHIMES[step]!==target){rec.prof.elariaCeremonyStep=target===CHIMES[0]?1:0;this.dirtyPlayers.add(rec.token);return reply({kind:'ceremony_wrong',step:rec.prof.elariaCeremonyStep,courtAdvanced});}
      step++;rec.prof.elariaCeremonyStep=step;
      if(step>=3){
        if(!this.elariaReward(client,rec,{gold:35,xp:45,item:{id:I.HEARTWOOD_RESIN,count:1},source:'elaria_ceremony'}))return client.send('elariaActivityResult',{ok:false,reason:'full'});
        rec.prof.elariaCeremonyDay=day;rec.prof.elariaCeremonyStep=0;this.dirtyPlayers.add(rec.token);
        return reply({kind:'ceremony_complete',gold:35,xp:45,item:{id:I.HEARTWOOD_RESIN,count:1},courtAdvanced});
      }
      this.dirtyPlayers.add(rec.token);return reply({kind:'ceremony_step',step,courtAdvanced});
    }
    if(action==='visit'){
      if(!SITES[target]||!this.elariaAt(client,target,target==='westwatch'?7:5.5))return client.send('elariaActivityResult',{ok:false,reason:'range'});
      let loreFound=false,loreComplete=false,blessing=false;
      if(!Array.isArray(rec.prof.elariaLoreFound))rec.prof.elariaLoreFound=[];
      if(LORE_IDS.includes(target)&&!rec.prof.elariaLoreFound.includes(target)){
        rec.prof.elariaLoreFound.push(target);loreFound=true;
      }
      if(LORE_IDS.includes(target)&&rec.prof.elariaLoreFound.length>=LORE_IDS.length&&!rec.prof.elariaLoreRewarded){
        if(!this.elariaReward(client,rec,{gold:75,xp:80,item:{id:I.HEARTWOOD_RESIN,count:2},source:'elaria_lore'}))return client.send('elariaActivityResult',{ok:false,reason:'full'});
        rec.prof.elariaLoreRewarded=true;loreComplete=true;
      }
      const courtAdvanced=this.elariaAdvanceCourt(rec.prof,target);
      if(target==='moonwell'&&(rec.prof.elariaBlessingDay|0)!==this.elariaDay()){
        const until=Date.now()+20*60*1000;rec.prof.elariaBlessingDay=this.elariaDay();rec.prof.elariaBlessingUntil=until;
        const buffs=this.abilityBuffs.get(client.sessionId)||{};buffs.elariaGraceUntil=until;this.abilityBuffs.set(client.sessionId,buffs);blessing=true;
      }
      this.dirtyPlayers.add(rec.token);
      return reply({kind:'visit',target,loreFound,loreComplete,courtAdvanced,blessing});
    }
    client.send('elariaActivityResult',{ok:false,reason:'action'});
  }
}

module.exports=ElariaMixin.prototype;
