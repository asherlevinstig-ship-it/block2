const ARMOR_LABELS=Object.freeze({scout:'Scout',vanguard:'Vanguard',bulwark:'Bulwark',aegis:'Aegis'});

export function armorCondition(dur,maxDur){
  const ratio=maxDur>0?Math.max(0,Math.min(1,dur/maxDur)):0;
  return Object.freeze({ratio,band:dur<=0?'broken':ratio<=.1?'critical':ratio<=.25?'low':'sound'});
}

export function createCombatFeedback({document,showName,sysMsg,sound}){
  const impact=document.getElementById('combatimpact'),warning=document.getElementById('armorwarning');
  const hitConfirm=document.getElementById('hitconfirm'),telegraph=document.getElementById('enemytelegraph'),abilityPulse=document.getElementById('abilitypulse');
  const debugPanel=document.getElementById('combatdebug');
  let impactTimer=0,hitTimer=0,telegraphTimer=0,abilityTimer=0,debugTimer=0,lastArmorBand='sound',baseFov=0;
  const debugRows=[];
  const nice=s=>String(s||'').replace(/_/g,' ').replace(/\b\w/g,ch=>ch.toUpperCase());
  const num=v=>Number.isFinite(+v)?Math.round(+v*10)/10:0;
  const buffText=buffs=>{
    const live=Array.isArray(buffs)?buffs:[];
    if(!live.length)return 'Buffs none';
    return 'Buffs '+live.slice(0,5).map(b=>nice(b.id)+' '+Math.ceil((Number(b.ms)||0)/1000)+'s').join(', ');
  };
  function showDebug(evt={}){
    if(!debugPanel)return;
    const dmg=evt.damage||{},res=evt.resources||{},target=evt.target||{},player=evt.player||{},ability=evt.ability||{};
    let title=nice(evt.kind||'combat');
    if(ability.name)title+=' - '+nice(ability.name);
    else if(evt.weapon)title+=' - '+nice(evt.weapon);
    const flags=[evt.crit?'CRIT':'',evt.panther?'PANTHER':'',evt.hitLabel||evt.reason||''].filter(Boolean).join(' / ');
    const damageLine=dmg.raw!=null
      ? 'DMG '+num(dmg.raw)+' -> '+num(dmg.applied)+' (-'+num(dmg.mitigated)+')'+(dmg.armorReduction?' armor '+dmg.armorReduction+'%':'')
      : '';
    const resourceLine=(res.maxMp||res.maxSp||res.mpSpent||res.spSpent)
      ? 'MP '+num(res.mp)+'/'+num(res.maxMp)+' -'+num(res.mpSpent)+' | SP '+num(res.sp)+'/'+num(res.maxSp)+' -'+num(res.spSpent)
      : '';
    const stateLine=target.id
      ? nice(target.kind)+' '+(target.state?nice(target.state):'Ready')+' HP '+num(target.hp)+'/'+num(target.maxHp)
      : player.maxHp?'Player HP '+num(player.hp)+'/'+num(player.maxHp):'';
    debugRows.unshift({title,flags,lines:[damageLine,resourceLine,stateLine,buffText(evt.buffs)].filter(Boolean)});
    debugRows.splice(6);
    debugPanel.innerHTML='<b>COMBAT DEBUG</b>'+debugRows.map(row=>'<section><strong>'+row.title+'</strong>'+(row.flags?'<em>'+row.flags+'</em>':'')+row.lines.map(line=>'<span>'+line+'</span>').join('')+'</section>').join('');
    debugPanel.classList.remove('hidden');
    clearTimeout(debugTimer);debugTimer=setTimeout(()=>debugPanel.classList.add('quiet'),9000);
    debugPanel.classList.remove('quiet');
  }
  function showImpact(hit={}){
    if(!impact)return;
    const damage=Math.max(0,Number(hit.n)||0),absorbed=Math.max(0,Number(hit.absorbed)||0);
    const armorType=hit.armor&&ARMOR_LABELS[hit.armor.type]||'';
    impact.textContent=hit.lethal?'LETHAL HIT':('-'+Math.round(damage)+' HP'+(absorbed?' · '+absorbed+' BLOCKED':''));
    impact.className=hit.lethal?'lethal':armorType?'armored':'hurt';
    if(armorType)impact.dataset.armor=armorType.toUpperCase();
    else delete impact.dataset.armor;
    if(absorbed&&sound&&sound.block)sound.block();
    clearTimeout(impactTimer);impactTimer=setTimeout(()=>impact.classList.add('hidden'),hit.lethal?1050:650);
  }
  function syncArmor(armor,broke=false){
    if(!warning)return;
    if(broke||!armor){
      warning.classList.add('hidden');
      if(broke){
        lastArmorBand='broken';showName('ARMOR BROKEN');
        sysMsg('<b>Armor broken.</b> Its protection and movement profile are no longer active.');
        if(sound&&sound.error)sound.error();
      }else lastArmorBand='sound';
      return;
    }
    const state=armorCondition(Number(armor.dur)||0,Number(armor.maxDur)||1);
    warning.className=state.band==='sound'?'hidden':'armor-'+state.band;
    warning.innerHTML='<b>'+Math.ceil(state.ratio*100)+'%</b><span>ARMOR '+(state.band==='critical'?'CRITICAL':'DAMAGED')+'</span>';
    if(state.band!==lastArmorBand){
      if(state.band==='low'){
        showName('Armor durability low');
        sysMsg('Armor durability below <b>25%</b>. Visit Tobin or use a Repair Kit.');
      }else if(state.band==='critical'){
        showName('Armor about to break!');
        sysMsg('<b>Armor critical:</b> protection will be lost when durability reaches zero.');
        if(sound&&sound.error)sound.error();
      }
    }
    lastArmorBand=state.band;
  }
  function confirmHit(hit={}){
    if(!hitConfirm)return;
    hitConfirm.className=hit.lethal?'lethal':hit.crit?'critical':'';
    if(sound){if(hit.crit&&sound.crit)sound.crit();else if(sound.hit)sound.hit();}
    if(document.body){document.body.classList.remove('combat-hit','combat-crit');void document.body.offsetWidth;document.body.classList.add(hit.crit?'combat-crit':'combat-hit');setTimeout(()=>document.body.classList.remove('combat-hit','combat-crit'),hit.lethal?170:hit.crit?135:72);}
    if(hit.crit)showName(hit.lethal?'EXECUTE':'CRITICAL HIT');
    clearTimeout(hitTimer);hitTimer=setTimeout(()=>hitConfirm.classList.add('hidden'),hit.lethal?260:hit.crit?230:190);
  }
  function showTelegraph(fx={}){
    if(!telegraph)return;
    const cues={
      warn:['SLAM - DODGE',true],slamWarn:['SLAM - LEAVE THE CIRCLE',true],
      cwind:['CHARGE - SIDESTEP',true],swind:['SPIKES - KEEP MOVING',true],
      meleeWarn:[(fx.label||'MELEE')+' - DODGE OUT',true],
      rangedWarn:[fx.quick?'QUICK SHOT - BREAK LINE':'ARROW DRAW - SIDESTEP',false],
      volleyWarn:['VOLLEY - LEAVE THE LANES',true],
      quakewarn:['QUAKE - CLEAR THE RING',false],growl:['ATTACK INCOMING',false],
    };
    const cue=cues[fx.t];if(!cue)return;
    telegraph.textContent=cue[0];telegraph.className=cue[1]?'urgent':'';
    clearTimeout(telegraphTimer);telegraphTimer=setTimeout(()=>telegraph.classList.add('hidden'),cue[1]?730:920);
  }
  function abilityPressed(slot,name=''){
    if(!abilityPulse)return;
    abilityPulse.textContent='CAST '+(name||('ABILITY '+(Number(slot)+1))).toUpperCase();abilityPulse.className='pending';
    clearTimeout(abilityTimer);abilityTimer=setTimeout(()=>abilityPulse.classList.add('hidden'),520);
  }
  function abilitySettled(slot,accepted=true){
    if(!abilityPulse)return;
    abilityPulse.textContent=accepted?'ABILITY READY':'CAST BLOCKED';abilityPulse.className=accepted?'resolved':'rejected';
    clearTimeout(abilityTimer);abilityTimer=setTimeout(()=>abilityPulse.classList.add('hidden'),520);
  }
  function updateMovement(camera,sprinting,moving,dt){
    document.body&&document.body.classList.toggle('sprinting',!!(sprinting&&moving));
    if(!camera)return;
    if(!baseFov)baseFov=Number(camera.fov)||72;
    const target=baseFov+(sprinting&&moving?4.5:0),next=camera.fov+(target-camera.fov)*(1-Math.exp(-Math.max(0,dt)*9));
    if(Math.abs(next-camera.fov)>.01){camera.fov=next;camera.updateProjectionMatrix();}
  }
  return Object.freeze({showImpact,syncArmor,confirmHit,showTelegraph,abilityPressed,abilitySettled,updateMovement,showDebug});
}
