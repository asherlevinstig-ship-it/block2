export function loungeHandValue(cards=[]){
  if(cards.some(card=>!card))return null;
  let total=cards.reduce((sum,card)=>sum+(card.rank===1?11:Math.min(10,card.rank)),0);
  let aces=cards.filter(card=>card.rank===1).length;
  while(total>21&&aces-->0)total-=10;
  return total;
}
export function loungeRoundFeedback(round){
  if(round?.status!=='complete')return null;
  const net=round.payout-round.bet,blackjack=round.game==='blackjack';
  const player=blackjack?loungeHandValue(round.player):null,dealer=blackjack?loungeHandValue(round.dealer):null;
  let title=round.outcome==='win'?'Round won':round.outcome==='push'?'Stake returned':'Round lost';
  let detail;
  if(blackjack){
    if(player>21){title='You went over 21';detail='Your hand total is '+player+'.';}
    else if(round.outcome==='push')detail='Both hands finished on '+player+'. Your stake is back in your wallet.';
    else if(round.outcome==='win'&&round.player.length===2&&player===21){title='Blackjack!';detail='A two-card 21. The payout includes your original stake.';}
    else if(dealer>21)detail='Dealer went over 21 with '+dealer+'.';
    else detail='Your '+player+' against the dealer’s '+dealer+'.';
  }else detail=round.number+' '+round.resultColor+' · You chose '+round.color+'.';
  return {outcome:round.outcome,title,detail,net,payout:round.payout,bet:round.bet,amount:net>0?'+'+net+' gold':net<0?'−'+Math.abs(net)+' gold':'0 gold lost',luckXp:round.luckXp??0};
}
