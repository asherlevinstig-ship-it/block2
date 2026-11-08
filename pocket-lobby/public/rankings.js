export function initializeRankings(cloud,document=globalThis.document,window=globalThis.window){
  const find=id=>document.getElementById(id);
  let data=null;
  let metric='wealth';
  let busy=false;

  function showPage(rankings){
    find('personalProgress').hidden=rankings;
    find('rankingsProgress').hidden=!rankings;
    find('progressPersonalTab').setAttribute('aria-pressed',String(!rankings));
    find('progressRankingsTab').setAttribute('aria-pressed',String(rankings));
    if(rankings)return refresh();
  }

  function renderPlayer(player){
    const row=document.createElement('li');
    row.className='ranking-row'+(player.isYou?' is-you':'');
    const rank=document.createElement('b');
    rank.className='ranking-position';
    rank.textContent='#'+player.rank;
    const identity=document.createElement('div');
    const name=document.createElement('b');
    name.textContent=player.name+(player.isYou?' · You':'');
    const handle=document.createElement('small');
    handle.textContent='@'+player.username;
    identity.append(name,handle);
    const score=document.createElement('div');
    score.className='ranking-score';
    const amount=document.createElement('b');
    amount.textContent=new Intl.NumberFormat().format(metric==='wealth'?player.gold:player.power);
    const label=document.createElement('small');
    label.textContent=metric==='wealth'?'gold owned · wallet + bank':'combat power';
    score.append(amount,label);
    row.append(rank,identity,score);
    if(metric==='wealth'){
      const earnings=document.createElement('small');
      earnings.className='ranking-extra';
      earnings.textContent=new Intl.NumberFormat().format(player.earned)+' recorded lifetime earnings';
      row.append(earnings);
    }else{
      const details=document.createElement('details');
      details.className='ranking-extra';
      const summary=document.createElement('summary');
      summary.textContent='Power breakdown';
      const list=document.createElement('ul');
      for(const part of player.breakdown){
        const item=document.createElement('li');
        item.textContent=part.name+' +'+part.points+' · '+part.detail;
        list.append(item);
      }
      details.append(summary,list);
      row.append(details);
    }
    return row;
  }

  function render(){
    const content=find('rankingsContent');
    content.replaceChildren();
    find('rankingsDescription').textContent=metric==='wealth'
      ?'Ranked by gold in your wallet and bank. Equal scores share a rank.'
      :'Ranked by combat power using the same breakdown as My progress. Equal scores share a rank.';
    find('rankingsWealth').setAttribute('aria-pressed',String(metric==='wealth'));
    find('rankingsPower').setAttribute('aria-pressed',String(metric==='power'));
    if(!data)return;
    const board=data[metric];
    if(board.top.length){
      const list=document.createElement('ol');
      list.className='ranking-list';
      for(const player of board.top)list.append(renderPlayer(player));
      content.append(list);
      if(board.you&&!board.top.some(player=>player.isYou)){
        const title=document.createElement('h4');
        title.textContent='Your position';
        const own=document.createElement('ol');
        own.className='ranking-list';
        own.append(renderPlayer(board.you));
        content.append(title,own);
      }
    }else{
      const empty=document.createElement('p');
      empty.className='ranking-empty';
      empty.textContent='No players have joined yet. Be the first to set a score.';
      content.append(empty);
    }
    find('rankingsConsentText').textContent=data.accountRequired
      ?'Create an account to join the rankings and keep your place across devices.'
      :data.joined?'Your saved progress is listed. Leaving removes you from both leaderboards.'
      :'Joining makes your character name, account username, gold and power visible on both leaderboards.';
    find('rankingsJoin').textContent=data.accountRequired?'Create account':data.joined?'Leave rankings':'Join rankings';
  }

  function setBusy(value){
    busy=value;
    find('rankingsRefresh').disabled=value;
    find('rankingsJoin').disabled=value||!data;
    find('rankingsProgress').setAttribute('aria-busy',String(value));
  }

  async function refresh(){
    if(busy)return;
    setBusy(true);
    find('rankingsStatus').textContent='Loading rankings…';
    try{
      data=await cloud.readRankings();
      render();
      find('rankingsStatus').textContent=data.participants+' participating players · Last saved scores';
    }catch(error){
      find('rankingsStatus').textContent=error.message;
    }finally{setBusy(false);}
  }

  find('progressPersonalTab').onclick=()=>showPage(false);
  find('progressRankingsTab').onclick=()=>showPage(true);
  find('rankingsRefresh').onclick=refresh;
  find('rankingsWealth').onclick=()=>{metric='wealth';render();};
  find('rankingsPower').onclick=()=>{metric='power';render();};
  find('rankingsJoin').disabled=true;
  find('rankingsJoin').onclick=async()=>{
    if(busy||!data)return;
    if(data.accountRequired){
      window.towerAccounts.open('register');
      return;
    }
    setBusy(true);
    find('rankingsStatus').textContent='Updating your participation…';
    try{
      await cloud.setRankingParticipation(!data.joined);
      data=await cloud.readRankings();
      render();
      find('rankingsStatus').textContent=data.joined?'You have joined the testing rankings.':'You have left the rankings.';
    }catch(error){
      find('rankingsStatus').textContent=error.message;
    }finally{setBusy(false);}
  };
}
