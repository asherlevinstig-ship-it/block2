import {keeperSites} from './lantern-keepers.js';
import {skillLevel} from './skill-curve.js';

export const abilitySlots=3;
export const ambushPrey=new Set(['boar','thornBoar','dusktusk']);
export function ambushPosition(position,site){
 return !!position&&!!site&&position.x===site.x+1&&position.y===site.y;
}
export const scoutClueSeconds=45;
export function scoutAheadSite(state){
 if(state.adventure?.keeperRouteFound)return null;
 if(state.location==='willowbank'&&!state.adventure?.keeperMarkerRead)return keeperSites.keeperMarker;
 if(state.location==='waystation'&&state.adventure?.keeperMarkerRead)return keeperSites.keeperCrate;
 return null;
}
export function activeScoutClue(state,now){
 const last=state.styleAbilities?.scout;
 const site=scoutAheadSite(state);
 const uses=state.styleAbilities?.mastery?.scoutAhead?.uses??0;
 const rank=Math.min(skillLevel(state.stats?.explorationXp),skillLevel(state.stats?.familiarConnectionXp));
 const seconds=uses>=2&&rank>=5?120:uses>=1&&rank>=3?75:scoutClueSeconds;
 return site&&last?.room===site.room&&now<last.at+seconds*1000?site:null;
}
export const preyTrail={room:'clearing',tracks:[{x:3,y:5},{x:5,y:7},{x:8,y:6}],site:{x:9,y:5},duration:180000};
export function activePreyTrail(state,now){
 const trail=state.styleAbilities?.preyTrail;
 return state.location===preyTrail.room&&trail?.until>now&&!trail.cleared?trail:null;
}
export const styleAbilities={
 waypoint:{name:'Waypoint',icon:'◇',cooldown:180000,description:'Travel to a discovered landmark from safety.',requirements:{exploration:3}},
 shadowstep:{name:'Shadowstep',icon:'◈',cooldown:45000,description:'Blink up to four reachable tiles. In arena combat, briefly delay the creature’s pursuit.',requirements:{exploration:3,stealth:3}},
 trackPrey:{name:'Track Prey',icon:'⁙',cooldown:180000,cost:0,description:'Reveal a trail in Bramble Clearing that leads to a Dusktusk Boar.',requirements:{hunting:2,exploration:2},discovery:'Earned through successful wild hunts and new discoveries.'},
 scoutAhead:{name:'Scout Ahead',icon:'✧',cooldown:180000,cost:0,description:'Send your equipped familiar to find a Lantern Keeper clue.',requirements:{familiarConnection:2,exploration:2},discovery:'Earned by caring for a familiar and discovering new areas.'},
 shareHearth:{name:'Share a Hearth',icon:'♨',cooldown:180000,cost:0,description:'Share a cooked meal at the Waystation campfire. Both players recover up to 20 HP over five seconds.',requirements:{cooking:2,kindness:2},discovery:'Earned by cooking and caring for a familiar.'},
 ambush:{name:'Ambush',icon:'⚔',cooldown:60000,description:'Approach a wild boar from behind and open combat with a strike dealing 50% extra damage.',requirements:{hunting:3,stealth:2},discovery:'Earned through wild hunts and practising stealth.'},
 appraise:{name:'Appraise',icon:'◉',cost:0,cooldown:60000,description:'Compare an ore listing with completed player sales from the last seven days.',requirements:{trading:3,mining:2},discovery:'Earned by trading and mining.'},
 stoneguard:{name:'Stoneguard',icon:'⬡',cooldown:60000,description:'Raise stone plates for five seconds, reducing creature damage by 30%.',requirements:{mining:3,vitality:2},discovery:'Earned by mining and building Vitality.'},
 patientCast:{name:'Patient Cast',icon:'≈',cost:0,cooldown:60000,description:'Empower your next manual cast with a brighter bobber and a 50% wider perfect-reel window.',requirements:{fishing:3,exploration:2},discovery:'Earned by catching fish and exploring.'}
};
export const waypoints={
 outside:{name:'Tower Courtyard',x:2,y:5},
 trail:{name:'Lantern Trail',x:1,y:5},
 pond:{name:'Silverfin Pond',x:4,y:5},
 logging:{name:'Timber Hollow',x:5,y:5},
 millbrook:{name:'Millbrook',x:2,y:6}
};
export function normalizeStyleAbilities(input){
 const list=key=>[...new Set((Array.isArray(input?.[key])?input[key]:[]).filter(id=>Object.hasOwn(styleAbilities,id)))];
 const learned=list('learned').slice(0,abilitySlots),declined=list('declined').filter(id=>!learned.includes(id));
 const readyAt=Object.fromEntries(learned.filter(id=>Number.isSafeInteger(input?.readyAt?.[id])&&input.readyAt[id]>0).map(id=>[id,input.readyAt[id]]));
 const quietUntil=Number.isSafeInteger(input?.quietUntil)&&input.quietUntil>0&&learned.includes('shadowstep')?input.quietUntil:0;
 const lastBlinkAt=learned.includes('shadowstep')&&Number.isSafeInteger(input?.lastBlinkAt)?Math.max(0,input.lastBlinkAt):0;
 const trail=input?.preyTrail;
 const tracked=learned.includes('trackPrey')&&Number.isSafeInteger(trail?.until)&&trail.until>0&&Number.isInteger(trail.step)&&trail.step>=0&&trail.step<=preyTrail.tracks.length;
 const scout=input?.scout;
 const scouting=learned.includes('scoutAhead')&&['willowbank','waystation'].includes(scout?.room)&&Number.isSafeInteger(scout.at)&&scout.at>0;
 const hearth=input?.hearth;
 const warming=Number.isSafeInteger(hearth?.nextAt)&&hearth.nextAt>0&&Number.isInteger(hearth.ticks)&&hearth.ticks>0&&hearth.ticks<=5;
 const mastery=Object.fromEntries(learned.filter(id=>input?.mastery?.[id]).map(id=>{
  const value=input.mastery[id];
  return [id,{uses:Number.isSafeInteger(value.uses)?Math.max(0,Math.min(1000000,value.uses)):0,
   seen:[...new Set((Array.isArray(value.seen)?value.seen:[]).filter(key=>typeof key==='string'&&key.length<=100))].slice(-60)}];
 }));
 const guard=input?.stoneguard;
 const guarded=learned.includes('stoneguard')&&Number.isSafeInteger(guard?.until)&&guard.until>0&&[30,40,50].includes(guard.reduction);
 return {learned,declined,readyAt,quietUntil,lastBlinkAt,...(learned.includes('patientCast')&&input?.patientCastReady===true?{patientCastReady:true}:{}),...(guarded?{stoneguard:{until:guard.until,reduction:guard.reduction,credited:guard.credited===true}}:{}),...(Object.keys(mastery).length?{mastery}:{}),...(warming?{hearth:{nextAt:hearth.nextAt,ticks:hearth.ticks,...([4,6,8].includes(hearth.perTick)?{perTick:hearth.perTick}:{})}}:{}),...(scouting?{scout:{room:scout.room,at:scout.at}}:{}),...(tracked?{preyTrail:{until:trail.until,step:trail.step,cleared:trail.cleared===true}}:{})};
}
export function styleAbilityOffers(state){
 const {learned,declined}=normalizeStyleAbilities(state.styleAbilities);
 if(learned.length>=abilitySlots||state.characterCreated===false)return [];
 return Object.entries(styleAbilities).filter(([id,ability])=>!learned.includes(id)&&!declined.includes(id)&&(!['scoutAhead','shareHearth'].includes(id)||Object.values(state.familiars?.careReadyAt??{}).some(at=>at>0))&&
   (['shareHearth','appraise','stoneguard'].includes(id)||(state.adventure?.discovered?.length??0)>0)&&Object.entries(ability.requirements).every(([stat,level])=>skillLevel(stat==='mining'?state.mining?.xp:state.stats?.[(stat==='fishing'?'patience':stat)+'Xp'])>=level)).map(([id])=>id);
}
