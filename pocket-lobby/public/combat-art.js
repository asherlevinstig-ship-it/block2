const clamp=value=>Math.max(0,Math.min(1,value));
const pulse=(age,duration)=>age>=0&&age<duration?Math.sin(age/duration*Math.PI):0;
export function playerCombatPose({time,now,encounter,events,reduced=false}){
  const victoryAge=time-events.victoryAt;
  const victory=victoryAge>=0&&victoryAge<1000;
  const ready=!!encounter;
  const windup=ready?clamp(1-(encounter.nextPlayerAt-now)/240):0;
  const strikeAge=time-events.strikeAt;
  const swing=strikeAge>=0&&strikeAge<360;
  const strike=swing?clamp(strikeAge/140):0;
  const recover=swing?clamp((strikeAge-140)/220):0;
  return {
    armed:ready||victory,ready,victory,
    angle:reduced?-.45:victory?-1.05:swing?-.95+strike*2.55-recover*1.95:-.45-windup*.7,
    lunge:reduced?0:pulse(strikeAge,340)*5,
    recoil:reduced?0:pulse(time-events.hurtAt,280)*4,
    dodge:reduced?0:pulse(time-events.dodgeAt,430)*6,
    crouch:reduced?0:ready?1+windup:0,
    lift:reduced?0:victory?pulse(victoryAge,700)*3:0
  };
}
export function boarCombatPose({time,now,encounter,events,reduced=false,defeated=false}){
  const age=time-events.victoryAt;
  const death=defeated?clamp(age/430):0;
  const windup=encounter?clamp(1-(encounter.nextBoarAt-now)/450):0;
  return {
    windup,
    charge:reduced?0:pulse(time-events.boarAttackAt,340)*8,
    recoil:reduced?0:pulse(time-events.boarHitAt,260)*4,
    squash:reduced?1:defeated?1-death*.6:1-windup*.1,
    fall:reduced?0:defeated?death*5:0,
    alpha:defeated?1-clamp((age-750)/550):1,
    defeated,hit:time-events.boarHitAt>=0&&time-events.boarHitAt<200
  };
}
