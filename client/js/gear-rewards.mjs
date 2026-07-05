const SOURCE_LABELS=Object.freeze({
  gate:'Gate clear',boss:'Boss reward',captain:'Bandit captain',bandit:'Bandit camp',
  road_warden:'Road Warden cache',regional_contract:'Regional contract',
  aegis_trial:'Aegis trial',crafted:'Crafted',starter:'Starter equipment',dev:'Test reward',
});

export function gearRewardSource(source=''){
  const id=String(source||'').toLowerCase();
  return SOURCE_LABELS[id]||id.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())||'Adventure reward';
}

export function compareGearReward({stack,item,baseline,gearSystem,toolMaxDur}){
  const armor=!!item.armor,info=item.armor||item.tool;
  const profile=armor?gearSystem.armorProfile(info,stack):gearSystem.profile(info,stack);
  const combat=armor?null:gearSystem.weaponCombatProfile(info,stack);
  const baseItem=baseline&&baseline.item,baseInfo=baseItem&&(baseItem.armor||baseItem.tool);
  const baseProfile=baseline&&(armor
    ?gearSystem.armorProfile(baseInfo,baseline.stack)
    :gearSystem.weaponCombatProfile(baseInfo,baseline.stack));
  const maxDur=armor?profile.maxDur:toolMaxDur(stack);
  const currentDur=stack.dur==null?maxDur:stack.dur;
  let verdict='NEW SLOT';
  if(baseProfile){
    if(armor){
      const better=profile.powerScore>baseProfile.powerScore||
        profile.powerScore===baseProfile.powerScore&&profile.mitigation>baseProfile.mitigation;
      const equal=profile.powerScore===baseProfile.powerScore&&profile.mitigation===baseProfile.mitigation&&
        profile.moveMultiplier===baseProfile.moveMultiplier&&profile.staminaCostMultiplier===baseProfile.staminaCostMultiplier;
      verdict=equal?'SIDEGRADE':better?'UPGRADE':'DOWNGRADE';
    }else{
      verdict=combat.dps===baseProfile.dps?'SIDEGRADE':combat.dps>baseProfile.dps?'UPGRADE':'DOWNGRADE';
    }
  }
  const signed=n=>(n>0?'+':'')+(Math.round(n*10)/10);
  const rows=armor?[
    ['MITIGATION',Math.round(profile.mitigation*100)+'%',baseProfile?signed((profile.mitigation-baseProfile.mitigation)*100)+'%':'—'],
    ['MOVEMENT',Math.round(profile.moveMultiplier*100)+'%',baseProfile?signed((profile.moveMultiplier-baseProfile.moveMultiplier)*100)+'%':'—'],
    ['STAMINA',Math.round(profile.staminaCostMultiplier*100)+'%',baseProfile?signed((profile.staminaCostMultiplier-baseProfile.staminaCostMultiplier)*100)+'%':'—'],
    ['DURABILITY',currentDur+' / '+maxDur,baseProfile?signed(maxDur-baseProfile.maxDur):'—'],
  ]:[
    ['DAMAGE',String(combat.damage),baseProfile?signed(combat.damage-baseProfile.damage):'—'],
    ['SPEED',combat.attacksPerSecond+'/s',baseProfile?signed(combat.attacksPerSecond-baseProfile.attacksPerSecond)+'/s':'—'],
    ['DPS',String(combat.dps),baseProfile?signed(combat.dps-baseProfile.dps):'—'],
    ['DURABILITY',currentDur+' / '+maxDur,baseProfile?signed(maxDur-toolMaxDur(baseline.stack)):'—'],
  ];
  return {armor,profile,combat,maxDur,currentDur,verdict,rows};
}

export function createGearRewardPresenter({
  document,items,gearSystem,itemName,toolMaxDur,getArmor,getWeapon,getSelectedSlot,send,nearBlacksmith,onReveal,onClose,
}){
  const win=document.getElementById('gearrewardwin'),panel=document.getElementById('gearrewardpanel');
  const queue=[];let active=null;
  const close=()=>{
    active=null;win.classList.add('hidden');panel.innerHTML='';
    if(onClose)onClose();
    if(queue.length)show(queue.shift());
  };
  const button=(label,action,{disabled=false,title=''}={})=>{
    const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=disabled;b.title=title;
    b.addEventListener('click',action);return b;
  };
  function show(entry){
    active=entry;
    const {stack,slot,recovered=false}=entry,item=items[stack.id];
    if(!item||(!item.tool&&!item.armor)){close();return;}
    const baselineStack=Object.prototype.hasOwnProperty.call(entry,'baseline')?entry.baseline:(item.armor?getArmor():getWeapon());
    const baseline=baselineStack&&items[baselineStack.id]?{stack:baselineStack,item:items[baselineStack.id]}:null;
    const summary=compareGearReward({stack,item,baseline,gearSystem,toolMaxDur});
    const {profile,armor,rows,verdict}=summary;
    const archetype=armor?profile.type.name:(item.tool.cls==='axe'?'Stagger Axe':'Momentum Sword');
    panel.style.setProperty('--gear-color',profile.rarity.color);
    panel.className='gear-reward-panel rarity-'+profile.rarity.id;
    panel.innerHTML='';
    const kicker=document.createElement('div');kicker.className='gr-kicker';kicker.textContent=recovered?'LOOT RECOVERY':'GEAR ACQUIRED';panel.appendChild(kicker);
    const header=document.createElement('header');
    const identity=document.createElement('div');
    const quality=document.createElement('small');quality.textContent=profile.rank.name+' · '+profile.rarity.name;
    const name=document.createElement('h2');name.textContent=itemName(stack);identity.append(quality,name);
    const verdictEl=document.createElement('strong');verdictEl.className=verdict.toLowerCase().replace(' ','-');verdictEl.textContent=recovered?'SECURED':verdict;
    header.append(identity,verdictEl);panel.appendChild(header);
    const meta=document.createElement('div');meta.className='gr-meta';
    for(const [label,value] of [['IDENTITY',archetype],['SOURCE',gearRewardSource(stack.source)]]){
      const block=document.createElement('span'),heading=document.createElement('b');
      heading.textContent=label;block.append(heading,document.createTextNode(value));meta.appendChild(block);
    }
    panel.appendChild(meta);
    const stats=document.createElement('div');stats.className='gr-stats';
    for(const row of rows){
      const cell=document.createElement('div'),label=document.createElement('span'),value=document.createElement('b'),delta=document.createElement('i');
      label.textContent=row[0];value.textContent=row[1];delta.textContent=row[2];
      const number=parseFloat(row[2]);delta.className=Number.isFinite(number)?number>0?'gain':number<0?'loss':'same':'same';
      if(row[0]==='STAMINA')delta.className=Number.isFinite(number)?number<0?'gain':number>0?'loss':'same':'same';
      cell.append(label,value,delta);stats.appendChild(cell);
    }
    panel.appendChild(stats);
    if(recovered){
      const notice=document.createElement('p');notice.className='gr-recovery';
      notice.textContent='Inventory full. Tobin secured this item; make space and claim it from Loot Recovery.';
      panel.appendChild(notice);
    }
    const actions=document.createElement('div');actions.className='gr-actions';
    if(!recovered){
      actions.appendChild(button('EQUIP',()=>{
        if(armor)send('equipArmor',{id:stack.id,slot,gearRank:stack.gearRank||'',armorType:stack.armorType||'',rarity:stack.rarity||'common'});
        else send('equipWeapon',{slot,hotbar:getSelectedSlot()});
        close();
      }));
      actions.appendChild(button(stack.locked?'LOCKED':'LOCK',()=>{send('gearLock',{slot,locked:true});close();},{disabled:!!stack.locked}));
      const canSalvage=nearBlacksmith()&&!stack.locked&&(item.tool||item.armor).tier<5;
      actions.appendChild(button(nearBlacksmith()?'SALVAGE':'SALVAGE AT TOBIN',()=>{send('blacksmithSalvage',{slot});close();},{
        disabled:!canSalvage,title:nearBlacksmith()?'':'Visit Tobin to salvage gear',
      }));
    }
    actions.appendChild(button(recovered?'GOT IT':'KEEP',close));panel.appendChild(actions);
    win.classList.remove('hidden');
    if(onReveal)onReveal({...entry,summary});
  }
  return Object.freeze({
    present(entry){if(!entry||!entry.stack)return;if(active)queue.push(entry);else show(entry);},
    close,
    get active(){return active;},
    get queued(){return queue.length;},
  });
}
