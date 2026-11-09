export function initializeFactions(api,document=globalThis.document){
  const find=id=>document.getElementById(id);
  const dialog=find('factionsDialog'),status=find('factionStatus'),directory=find('factionDirectory'),mine=find('myFaction');
  let busy=false,atRegistrar=false;
  const make=(tag,value)=>{const node=document.createElement(tag);node.textContent=value;return node;};
  const button=(label,action)=>{
    const node=make('button',label);node.type='button';node.onclick=action;return node;
  };
  function confirmAction(container,label,action){
    const confirm=button(label,action);
    const cancel=button('Cancel',()=>row.remove());
    const row=make('div','');row.className='faction-confirm';row.append(confirm,cancel);
    container.querySelector('.faction-confirm')?.remove();container.append(row);confirm.focus();
  }
  function render({membership,factions,capacity,leadership,founding}){
    const eligible=leadership.xp>=leadership.requiredXp;
    find('factionCreate').hidden=!eligible||!atRegistrar;
    find('visitFactionRegistrar').hidden=atRegistrar;
    find('factionFee').textContent='Founding fee · '+founding.fee+' gold · Wallet '+founding.wallet+' gold'+(founding.wallet<founding.fee?' · '+(founding.fee-founding.wallet)+' more needed':'');
    const register=find('registerFaction');
    register.textContent='Register faction · '+founding.fee+' gold';
    register.disabled=founding.wallet<founding.fee;
    find('factionLeadership').textContent=eligible
      ? 'Leadership level '+leadership.level+' · Founding unlocked'
      : 'Leadership level '+leadership.level+' · '+leadership.xp+' / '+leadership.requiredXp+' XP to level '+leadership.requiredLevel+'. Claim the Warden’s First Steps reward (+'+leadership.awards.firstSteps+' XP) or clear the Sunken Vault (+'+leadership.awards.vaultClear+' XP each).';
    const meter=find('factionLeadershipProgress');
    meter.hidden=eligible;meter.max=leadership.requiredXp;meter.value=Math.min(leadership.xp,leadership.requiredXp);

    mine.hidden=!membership;directory.hidden=!!membership;
    mine.replaceChildren();find('factionResults').replaceChildren();
    if(membership){
      const {name,description,roster,leader}=membership;
      mine.append(make('h3',name),make('p',description),make('h4','Roster · '+roster.length+' / '+capacity));
      const list=make('ul','');
      for(const member of roster){
        const row=make('li','');
        row.append(make('span',member.name+(member.self?' · You':'')+(member.leader?' · Leader':'')));
        if(leader&&!member.self)row.append(button('Transfer leadership',()=>confirmAction(mine,'Make '+member.name+' leader',()=>change({action:'transfer',id:member.id},'Leadership transferred.'))));
        list.append(row);
      }
      mine.append(list);
      if(!leader)mine.append(button('Leave faction',()=>confirmAction(mine,'Confirm leave',()=>change({action:'leave'},'You left the faction.'))));
      else if(roster.length===1)mine.append(button('Disband faction',()=>confirmAction(mine,'Confirm disband',()=>change({action:'disband'},'Faction disbanded.'))));
      else mine.append(make('p','Transfer leadership to another member before leaving.'));
      return;
    }
    const results=find('factionResults');
    if(!factions.length)results.append(make('p','No factions found. Try another name or create one.'));
    for(const faction of factions){
      const row=make('article',''),info=make('div','');
      info.append(make('b',faction.name),make('p',faction.description),make('small',faction.size+' / '+capacity+' members'));
      const join=button(faction.size>=capacity?'Full':'Join',()=>change({action:'join',id:faction.id},'Joined '+faction.name+'.'));
      join.disabled=faction.size>=capacity;join.setAttribute('aria-label','Join '+faction.name);
      row.append(info,join);results.append(row);
    }
  }
  async function load(){
    if(busy)return;
    busy=true;status.textContent='Loading factions…';
    try{render(await api.read(find('factionQuery').value));status.textContent='';}
    catch(error){status.textContent=error.message;}
    finally{busy=false;}
  }
  async function change(body,success){
    if(busy)return;
    busy=true;status.textContent='Saving…';
    try{
      const result=await api.change(body);render(result);status.textContent=body.action==='create'?success+' Paid '+result.founding.fee+' gold.':success;
      if(body.action==='create')find('factionCreate').reset();
    }catch(error){status.textContent=error.message;}
    finally{busy=false;}
  }
  function open(registrar){
    atRegistrar=registrar;
    find('factionsTitle').textContent=registrar?'Registrar Mira':'Factions';
    find('factionDialogue').hidden=!registrar;
    find('factionDirectory').hidden=true;mine.hidden=true;
    directory.querySelector('.faction-create').open=registrar;
    if(!dialog.open)dialog.showModal();
    load();
  }
  find('openFactions').onclick=()=>open(false);
  find('visitFactionRegistrar').onclick=()=>{dialog.close();api.visitRegistrar();};
  find('factionSearch').onsubmit=event=>{event.preventDefault();load();};
  find('factionCreate').onsubmit=event=>{
    event.preventDefault();
    if(!atRegistrar)return;
    change({action:'create',name:find('factionName').value,description:find('factionDescription').value},'Faction created.');
  };
  return ()=>open(true);
}
