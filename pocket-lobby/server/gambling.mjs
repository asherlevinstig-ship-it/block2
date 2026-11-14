import {isSmartlyDressed} from '../public/wardrobe.js';
import {publicLearning} from './learning.mjs';
import {MAX_SKILL_XP} from '../public/skill-curve.js';
import {roomBoxes} from '../public/shared-world.js';

export const loungeRevenue=round=>round?.status==='complete'?Math.max(0,round.bet-round.payout):0;

export const luckRules={xp:2,interval:30000,levelXp:50};
const stakes=[5,10,25];
const red=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
export const rouletteColor=n=>n===0?'green':red.has(n)?'red':'black';
export function handTotal(cards){
  let total=cards.reduce((sum,card)=>sum+(card.rank===1?11:Math.min(10,card.rank)),0);
  let aces=cards.filter(card=>card.rank===1).length;
  while(total>21&&aces-->0)total-=10;
  return total;
}
const secureRandom=()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296;
const card=random=>{const value=Math.floor(random()*52);return {rank:value%13+1,suit:Math.floor(value/13)};};
function atTable(state,game){
  if(state.location!=='lounge')return false;
  // These are the same fixed tables and footprints used by movement/collision.
  const table=roomBoxes('lounge').find(box=>box.x===(game==='blackjack'?6:3)&&box.y===(game==='blackjack'?3:7));
  const p=state.position;
  if(!table||!p)return false;
  const dx=Math.max(table.x-p.x,0,p.x-(table.x+table.w-1));
  const dy=Math.max(table.y-p.y,0,p.y-(table.y+table.d-1));
  return dx+dy===1;
}
function finish(state,round,outcome,payout,now){
  if(state.credits+payout>100000000)throw new Error('Invalid balance. Make room in your wallet to settle this round.');
  const gambling=state.gambling;
  round.status='complete';round.outcome=outcome;round.payout=payout;round.finishedAt=now;
  state.credits+=payout;
  state.goldEarned=Math.min(Number.MAX_SAFE_INTEGER,(state.goldEarned??0)+Math.max(0,payout-round.bet));
  const before=state.stats.luckXp??0;
  const xp=gambling.lastXpAt==null||now-gambling.lastXpAt>=luckRules.interval?Math.min(luckRules.xp,MAX_SKILL_XP-before):0;
  if(xp){state.stats.luckXp=before+xp;gambling.lastXpAt=now;}
  round.luckXp=xp;round.luckBefore=before;
}
export function gamblingAction(state,action,body,now,random=secureRandom){
  if(!['gamble','gambleMove'].includes(action))return false;
  if(state.plan||state.report||state.hunting?.encounter||state.hunting?.recoveryUntil||state.fishingCast||state.timberCut||state.health<=0)throw new Error('Invalid table activity while working or recovering.');
  const game=action==='gamble'?body.game:state.gambling?.round?.game;
  if(!['blackjack','roulette'].includes(game))throw new Error('Choose blackjack or roulette.');
  if(!atTable(state,game))throw new Error('Travel beside the '+game+' table in the Sunset Lounge.');
  state.gambling??={lastXpAt:null,round:null};
  const gambling=state.gambling;
  if(action==='gamble'){
    if(!isSmartlyDressed(state.wardrobe))throw new Error('Choose smart clothing in Wardrobe before playing: Tailored Suit or Moonlit Dress.');
    if(gambling.round?.status==='playing')throw new Error('Choose Hit or Stand, or reveal your spin, before starting another round.');
    if(!stakes.includes(body.bet)||state.credits<body.bet||state.credits>100000000-38)throw new Error('Invalid stake. Choose 5, 10 or 25 gold within your balance.');
    if(gambling.round&&now-gambling.round.startedAt<5000)throw new Error('Invalid round timing. Wait a moment before playing again.');
    if(game==='roulette'&&!['red','black'].includes(body.color))throw new Error('Choose red or black.');
    const round={id:crypto.randomUUID(),game,bet:body.bet,startedAt:now,status:'playing'};
    gambling.round=round;state.credits-=round.bet;
    if(game==='roulette'){
      round.color=body.color;round.revealAt=now+2400;
      // The result is rolled on reveal, so a save response never discloses it early.
    }else{
      round.player=[card(random),card(random)];round.dealer=[card(random),card(random)];
      if(handTotal(round.player)===21||handTotal(round.dealer)===21){
        const player=handTotal(round.player),dealer=handTotal(round.dealer);
        finish(state,round,player===dealer?'push':player===21?'win':'lose',player===dealer?round.bet:player===21?Math.floor(round.bet*2.5):0,now);
      }
    }
    return true;
  }
  const round=gambling.round;
  if(!round||round.id!==body.roundId)throw new Error('Invalid table round. Reopen the table.');
  if(round.status==='complete')return true;
  if(game==='roulette'){
    if(body.move!=='reveal'||now<round.revealAt)throw new Error('Invalid spin timing. Wait for the wheel to stop.');
    round.number=Math.floor(random()*37);round.resultColor=rouletteColor(round.number);
    finish(state,round,round.resultColor===round.color?'win':'lose',round.resultColor===round.color?round.bet*2:0,now);
  }else{
    if(!['hit','stand'].includes(body.move))throw new Error('Choose Hit or Stand.');
    if(body.move==='hit'){
      round.player.push(card(random));
      if(handTotal(round.player)>21)finish(state,round,'lose',0,now);
      else if(handTotal(round.player)<21&&round.player.length<12)return true;
    }
    if(round.status==='playing'){
      while(handTotal(round.dealer)<17&&round.dealer.length<12)round.dealer.push(card(random));
      const player=handTotal(round.player),dealer=handTotal(round.dealer);
      const outcome=dealer>21||player>dealer?'win':player===dealer?'push':'lose';
      finish(state,round,outcome,outcome==='win'?round.bet*2:outcome==='push'?round.bet:0,now);
    }
  }
  return true;
}

// Never send the dealer's face-down card in player saves or conflict packets.
export function publicPlayerState(state){
  if(state.pvp){const {incidents,engagements,mark,lastOpponent,pursuit,...pvp}=state.pvp;state={...state,pvp:{...pvp,...(lastOpponent?{lastOpponent:{name:lastOpponent.name,until:lastOpponent.until}}:{})}};}
  if(state.learning)state={...state,learning:publicLearning(state.learning)};
  if(state.gambling?.round?.game!=='blackjack'||state.gambling.round.status!=='playing')return state;
  return {...state,gambling:{...state.gambling,round:{...state.gambling.round,dealer:[state.gambling.round.dealer[0],null]}}};
}
