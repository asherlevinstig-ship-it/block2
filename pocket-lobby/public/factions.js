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
  function feastBoard(id,feast){
    const section=make('section','');section.className='faction-project faction-feast';
    section.append(make('h4','Guild Feast'),make('p','Supply a meal together · Restore 50 hunger per member · Once daily'));
    section.append(make('small','Resets daily at 00:00 UTC. Unused supplies and meals expire.'));
    if(!feast.inHall)section.append(make('p','Visit the faction hall to contribute or eat.'));
    for(const [resource,target] of Object.entries(feast.targets)){
      const value=feast.totals[resource],label={gold:'Gold',timber:'Timber',fish:'Fish'}[resource];
      const row=make('div','');row.className='faction-project-row';
      const meter=make('progress','');meter.max=target;meter.value=value;meter.setAttribute('aria-label','Feast '+label+' progress');
      row.append(make('b',label+' · '+value+' / '+target),meter);
      if(value<target&&feast.inHall){
        const selector=make('select','');selector.setAttribute('aria-label','Fish to contribute');
        for(const fish of feast.fish){const option=make('option',fish.name+' × '+fish.stock);option.value=fish.id;selector.append(option);}
        const amount=make('input','');amount.type='number';amount.min=1;amount.setAttribute('aria-label','Feast '+label+' quantity');
        const donate=button('Contribute',()=>{
          const quantity=Number(amount.value);if(!Number.isSafeInteger(quantity)||quantity<1||quantity>Number(amount.max)){amount.reportValidity();return;}
          confirmAction(section,'Give '+quantity+' '+label.toLowerCase(),()=>change({action:'feastDonate',id,resource,fish:resource==='fish'?selector.value:undefined,quantity},'Feast supplies contributed.'));
        });
        const update=()=>{const stock=resource==='fish'?(feast.fish.find(item=>item.id===selector.value)?.stock??0):feast.stock[resource];const max=Math.min(target-value,stock);amount.max=max;amount.value=max?1:'';amount.disabled=donate.disabled=max<1;};
        selector.onchange=update;update();if(resource==='fish')row.append(selector);row.append(amount,donate);
      }
      section.append(row);
    }
    if(feast.ready){
      section.append(make('p',feast.claimed?'You enjoyed today’s feast.':'The feast is ready for every member!'));
      const eat=button(feast.claimed?'Meal claimed':feast.hunger>=100?'Already full':'Enjoy feast · +50 hunger',()=>change({action:'feastClaim',id},'You enjoyed the Guild Feast · +50 hunger.'));
      eat.disabled=feast.claimed||!feast.inHall||feast.hunger>=100;section.append(eat);
    }
    if(feast.contributors.length){const list=make('ul','');for(const row of feast.contributors)list.append(make('li',row.name+(row.self?' · You':'')+' · '+row.quantity+' '+row.resource));const details=make('details','');details.append(make('summary','Feast contributors'),list);section.append(details);}
    return section;
  }
  function projectBoard({id,hall}){
    const section=make('section','');section.className='faction-project';
    section.append(make('h4',hall.project?.name??'Faction hall complete'));
    section.append(make('p',hall.project?.reward??'The hall and field kitchen are open to all members.'));
    if(hall.open&&!api.inHall())section.append(button('Visit faction hall',()=>{dialog.close();api.visitHall();}));
    if(hall.project){
      const controls=make('div','');controls.className='faction-project-controls';
      for(const [resource,{value,target}] of Object.entries(hall.project.progress)){
        const row=make('div','');row.className='faction-project-row';
        const label={gold:'Gold',timber:'Timber',meal:'Cooked meals'}[resource];
        const meter=make('progress','');meter.max=target;meter.value=value;meter.setAttribute('aria-label',label+' project progress');
        row.append(make('b',label+' · '+value+' / '+target),meter);
        if(value<target){
          const meals=hall.meals.filter(item=>item.stock>0),selector=make('select','');
          selector.setAttribute('aria-label','Cooked meal to donate');
          for(const item of meals){const option=make('option',item.name+' × '+item.stock);option.value=item.id;selector.append(option);}
          const amount=make('input','');amount.type='number';amount.min=1;amount.required=true;amount.setAttribute('aria-label',label+' donation quantity');
          const donate=button('Donate',()=>{
            const quantity=Number(amount.value);
            if(!Number.isSafeInteger(quantity)||quantity<1||quantity>Number(amount.max)){amount.reportValidity();return;}
            const meal=resource==='meal'?selector.value:undefined;
            confirmAction(section,'Confirm '+quantity+' '+(resource==='meal'?meals.find(item=>item.id===meal).name:label.toLowerCase()),()=>change({action:'donate',id,resource,meal,quantity},'Contribution added.'));
          });
          function updateLimit(){
            const stock=resource==='meal'?(meals.find(item=>item.id===selector.value)?.stock??0):hall.stock[resource];
            const max=Math.min(target-value,stock);amount.max=max;amount.value=max?1:'';
            amount.disabled=donate.disabled=max<1;
          }
          selector.onchange=updateLimit;updateLimit();
          if(resource==='meal'&&meals.length)row.append(selector);
          row.append(amount,donate);
        }
        controls.append(row);
      }
      section.append(controls,make('small','Donations come from your wallet or bag and cannot be withdrawn.'));
    }
    if(hall.contributors.length){
      const details=make('details',''),list=make('ul','');
      details.append(make('summary','Contributions · '+hall.contributors.length));
      for(const row of hall.contributors)list.append(make('li',row.name+(row.self?' · You':'')+' · '+row.gold+' gold · '+row.timber+' timber · '+row.meal+' meals'));
      details.append(list);section.append(details);
    }
    if(hall.feast)section.append(feastBoard(id,hall.feast));
    section.append(button('Refresh board',load));
    return section;
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
      mine.append(make('h3',name),make('p',description),projectBoard(membership),make('h4','Roster · '+roster.length+' / '+capacity));
      if(membership.silverfin){
        const watch=make('section','');watch.className='faction-project';
        watch.append(make('h4','Silverfin Watch'),make('p',membership.silverfin.today+' today · '+membership.silverfin.total+' all-time faction contributions'),make('p',membership.silverfin.paired+' paired fishing contributions'),make('small','Catch a fish at Silverfin Pond while the daily watch still needs an angler. Non-members can help too.'));
        mine.insertBefore(watch,mine.lastChild);
      }
      const list=make('ul','');
      for(const member of roster){
        const row=make('li','');
        row.append(make('span',member.name+(member.self?' · You':'')+(member.leader?' · Leader':'')));
        if(leader&&!member.self)row.append(button('Transfer leadership',()=>confirmAction(mine,'Make '+member.name+' leader',()=>change({action:'transfer',id:member.id},'Leadership transferred.'))));
        list.append(row);
      }
      mine.append(list);
      if(api.inHall())mine.append(make('p','Use the Lobby door before leaving or disbanding your faction.'));
      else if(!leader)mine.append(button('Leave faction',()=>confirmAction(mine,'Confirm leave',()=>change({action:'leave'},'You left the faction.'))));
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
