import {enemyAttack} from './hunting.js';
import {signaturePoses} from './signature-poses.js';

const clamp=value=>Math.max(0,Math.min(1,value));
const pulse=(age,duration)=>age>=0&&age<duration?Math.sin(age/duration*Math.PI):0;
export function combatFacing(from,to){
  const dx=to.x-from.x,dy=to.y-from.y;
  return dx||dy?{direction:dx-dy>=0?'right':'left',back:dx+dy<0}:null;
}
export function meleeApproach(from,target,reach,walkable){
  if(Math.hypot(from.x-target.x,from.y-target.y)<=reach)return null;
  const queue=[{...from,first:null}],seen=new Set([from.x+','+from.y]);
  for(const tile of queue){
    if(tile.first&&Math.hypot(tile.x-target.x,tile.y-target.y)<=reach)return tile.first;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const next={x:tile.x+dx,y:tile.y+dy},key=next.x+','+next.y;
      if(seen.has(key)||next.x===target.x&&next.y===target.y||!walkable(next))continue;
      seen.add(key);queue.push({...next,first:tile.first??next});
    }
  }
  return null;
}
export function recordCharacterReaction(events,hit,time){
  if(hit.damage>0){events.hurtAt=time;events.hurtHeavy=hit.heavy===true||hit.damage>=20;}
  if(hit.shielded>0)events.shieldAt=time;
  if(hit.perfectDodge)events.perfectDodgeAt=time;
}
export function recordEnemyReaction(events,hit,time){
  if(hit.damage>0){events.boarHitAt=time;events.enemyGuarded=hit.guarded===true;}
  if(hit.broken)events.enemyBreakAt=time;
  if(hit.interrupted)events.enemyInterruptAt=time;
}
export function playerCombatPose({time,now,encounter,events,reduced=false,health=100,maxHealth=100}){
  const victoryAge=time-events.victoryAt;
  const victory=victoryAge>=0&&victoryAge<1000;
  const ready=!!encounter;
  const windup=ready?clamp(1-(encounter.nextPlayerAt-now)/240):0;
  const strikeAge=time-events.strikeAt;
  const castAge=time-events.castAt;
  const signature=signaturePoses[events.castKind],duration=signature?.duration??380;
  const casting=castAge>=0&&castAge<duration;
  const swing=!casting&&strikeAge>=0&&strikeAge<360;
  const strike=swing?clamp(strikeAge/140):0;
  const recover=swing?clamp((strikeAge-140)/220):0;
  const hitDuration=events.hurtHeavy?460:230,hitAge=time-events.hurtAt;
  const hurt=hitAge>=0&&hitAge<hitDuration;
  const shieldAge=time-events.shieldAt,evadeAge=time-events.perfectDodgeAt,dodgeAge=time-events.dodgeAt;
  return {
    hurt,heavyHit:hurt&&events.hurtHeavy===true,
    strained:ready&&health>0&&health<=maxHealth*.2,
    shieldPulse:shieldAge>=0&&shieldAge<420?shieldAge/420:null,
    perfectEvade:evadeAge>=0&&evadeAge<350?evadeAge/350:null,
    armed:ready||victory||casting,ready,victory,castKind:casting&&signature?events.castKind:null,casting:casting?clamp(castAge/duration):null,attack:swing?clamp(strikeAge/360):null,
    angle:reduced?-.45:victory?-1.05:casting?-.55-pulse(castAge,380)*1.15:swing?-.95+strike*2.55-recover*1.95:-.45-windup*.7,
    lunge:reduced||!swing?0:pulse(strikeAge,340)*5,
    recoil:reduced?0:pulse(hitAge,hitDuration)*(events.hurtHeavy?6:2),
    hurtProgress:clamp(hitAge/hitDuration),
    dodging:dodgeAge>=0&&dodgeAge<430?dodgeAge/430:null,
    dodge:reduced?0:pulse(dodgeAge,430)*6,
    crouch:reduced?0:ready?1+windup:0,
    lift:reduced?0:victory?pulse(victoryAge,700)*3:casting?pulse(castAge,380)*2:0
  };
}
export function boarCombatPose({time,now,encounter,events,reduced=false,defeated=false}){
  const age=time-events.victoryAt;
  const death=defeated?clamp(age/430):0;
  const staggered=!!encounter&&now<encounter.staggerUntil;
  const hitAge=time-events.boarHitAt;
  const braced=events.enemyGuarded===true&&hitAge>=0&&hitAge<220;
  const guardBroken=time-events.enemyBreakAt>=0&&time-events.enemyBreakAt<600;
  const interrupted=time-events.enemyInterruptAt>=0&&time-events.enemyInterruptAt<550;
  const windup=encounter&&!staggered?clamp(1-(encounter.nextBoarAt-now)/(enemyAttack(encounter).shape==='bolt'?enemyAttack(encounter).tell:Math.min(850,enemyAttack(encounter).tell))):0;
  return {
    windup:interrupted?0:windup,staggered,braced,guardBroken,interrupted,
    charge:staggered?0:reduced?0:pulse(time-events.boarAttackAt,340)*8,
    recoil:reduced?0:staggered?Math.sin(time/90)*2:pulse(hitAge,braced?180:260)*(braced?.6:5),
    squash:staggered?.82:reduced?1:defeated?1-death*.6:1-windup*.1,
    fall:reduced?0:defeated?death*5:0,
    alpha:defeated?1-clamp((age-750)/550):1,
    defeated,death,hit:hitAge>=0&&hitAge<200
  };
}
