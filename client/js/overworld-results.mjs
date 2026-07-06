export function createOverworldResultPresenter({document,itemName}){
  const win=document.getElementById('overworldresult'),titleEl=document.getElementById('owrtitle');
  const summaryEl=document.getElementById('owrsummary'),rewardsEl=document.getElementById('owrrewards'),nextEl=document.getElementById('owrnext');
  let timer=0,recentGrant=null,recentSafety=null;
  const fresh=(entry,ms=3500)=>entry&&Date.now()-entry.at<ms?entry.value:null;
  function recordGrant(grant){recentGrant={at:Date.now(),value:grant||{}};}
  function recordSafety(change){
    recentSafety={at:Date.now(),value:change||{}};
    if(!win.classList.contains('hidden')&&change&&change.delta){
      const old=rewardsEl.querySelector('[data-safety]');if(old)old.remove();
      const row=document.createElement('span');row.dataset.safety='1';
      const value=document.createElement('b');value.textContent=(change.delta>0?'+':'')+(change.delta|0);
      row.append(value,document.createTextNode(' road safety'));rewardsEl.appendChild(row);
    }
  }
  function show(result={}){
    const grant=result.grant||fresh(recentGrant),safety=result.safety||fresh(recentSafety);
    titleEl.textContent=result.title||'REGIONAL WORK COMPLETE';summaryEl.textContent=result.summary||'The road is quieter for now.';
    const rows=[];
    if(grant&&grant.xp)rows.push('<span><b>+'+(grant.xp|0)+'</b> Hunter XP</span>');
    if(grant&&Array.isArray(grant.items))for(const item of grant.items)rows.push('<span><b>+'+Math.max(1,item.count|0)+'</b> '+itemName(item.id)+'</span>');
    if(safety&&safety.delta)rows.push('<span><b>'+(safety.delta>0?'+':'')+(safety.delta|0)+'</b> road safety</span>');
    if(result.contract)rows.push('<span><b>'+result.contract+'</b> contract progress</span>');
    rewardsEl.innerHTML=rows.length?rows.join(''):'<span>Outcome confirmed</span>';
    nextEl.textContent=result.next||'Continue exploring the regional roads.';
    win.classList.remove('hidden');win.classList.remove('show');void win.offsetWidth;win.classList.add('show');
    clearTimeout(timer);timer=setTimeout(()=>{win.classList.remove('show');win.classList.add('hidden');},6500);
    recentGrant=null;recentSafety=null;
  }
  return Object.freeze({recordGrant,recordSafety,show});
}
