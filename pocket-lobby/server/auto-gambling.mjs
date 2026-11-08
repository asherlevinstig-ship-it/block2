import {gamblingAction,handTotal} from './gambling.mjs';
export const AUTO_GAMBLE_INTERVAL=30000;
export function startAutoGambling(state,rules,now,metadata){
 state.plan={...metadata,kind:'gambling',policy:{...rules.gambling},startedAt:now,endAt:metadata.routineCapAt,nextRoundAt:now+AUTO_GAMBLE_INTERVAL,rounds:0,wins:0,losses:0,pushes:0,totalLost:0,goldEarned:0,goldSpent:0,xp:0,recent:[]};
 state.location='lounge';state.position=rules.gambling.game==='blackjack'?{x:5,y:3}:{x:2,y:7};
}
function finish(state,p,reason,at){state.report={...p,reason,endedAt:at};delete state.plan;state.location='home';state.position={x:5,y:7};return true;}
export function settleAutoGambling(state,now,{stop=false,random=Math.random}={}){
 const p=state.plan,c=p.policy,until=Math.min(now,p.endAt);let changed=false;
 const limit=()=>p.goldEarned-p.goldSpent>=c.profitTarget?'gamble-profit-target':p.totalLost+c.bet>c.lossLimit?'gamble-loss-limit':p.rounds>=c.maxRounds?'gamble-round-limit':state.credits-c.bet<c.reserveGold?'gold-reserve':state.credits>100000000-38?'wallet-full':null;
 const initial=limit();if(initial)return finish(state,p,initial,Math.min(now,p.nextRoundAt));
 while(p.nextRoundAt<=until){
  const at=p.nextRoundAt,before=state.stats.luckXp??0;
  // Work from a shallow state view so only this server-owned runner may use the real table engine during a plan.
  const table={...state,plan:undefined,report:undefined};
  gamblingAction(table,'gamble',{game:c.game,bet:c.bet,color:c.color},at-2400,random===Math.random?undefined:random);
  let round=table.gambling.round;
  if(c.game==='roulette')gamblingAction(table,'gambleMove',{roundId:round.id,move:'reveal'},at,random===Math.random?undefined:random);
  else for(let n=0;n<12&&round.status==='playing';n++)gamblingAction(table,'gambleMove',{roundId:round.id,move:handTotal(round.player)<17?'hit':'stand'},at,random===Math.random?undefined:random);
  state.credits=table.credits;state.goldEarned=table.goldEarned;state.gambling=table.gambling;
  const net=round.payout-round.bet;p.rounds++;p[round.outcome==='win'?'wins':round.outcome==='push'?'pushes':'losses']++;
  p.goldSpent+=round.bet;p.goldEarned+=round.payout;p.totalLost+=Math.max(0,-net);p.xp+=(state.stats.luckXp??0)-before;
  p.recent=[...p.recent,{at,outcome:round.outcome,net,bet:round.bet,...(c.game==='roulette'?{number:round.number,color:round.resultColor}:{player:handTotal(round.player),dealer:handTotal(round.dealer)})}].slice(-8);
  p.nextRoundAt+=AUTO_GAMBLE_INTERVAL;changed=true;
  const reason=limit();if(reason)return finish(state,p,reason,at);
 }
 if(stop||now>=p.endAt)return finish(state,p,stop?'returned':'away-cap',Math.min(now,p.endAt));
 return changed;
}
