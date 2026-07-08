const ARMOR_LABELS=Object.freeze({scout:'Scout',vanguard:'Vanguard',bulwark:'Bulwark',aegis:'Aegis'});

export function armorCondition(dur,maxDur){
  const ratio=maxDur>0?Math.max(0,Math.min(1,dur/maxDur)):0;
  return Object.freeze({ratio,band:dur<=0?'broken':ratio<=.1?'critical':ratio<=.25?'low':'sound'});
}

export function createCombatFeedback({document,showName,sysMsg,sound}){
  const impact=document.getElementById('combatimpact'),warning=document.getElementById('armorwarning');
  const hitConfirm=document.getElementById('hitconfirm'),telegraph=document.getElementById('enemytelegraph'),abilityPulse=document.getElementById('abilitypulse');
  let impactTimer=0,hitTimer=0,telegraphTimer=0,abilityTimer=0,lastArmorBand='sound',baseFov=0;
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
    if(document.body){document.body.classList.remove('combat-hit','combat-crit');void document.body.offsetWidth;document.body.classList.add(hit.crit?'combat-crit':'combat-hit');setTimeout(()=>document.body.classList.remove('combat-hit','combat-crit'),hit.crit?95:58);}
    clearTimeout(hitTimer);hitTimer=setTimeout(()=>hitConfirm.classList.add('hidden'),190);
  }
  function showTelegraph(fx={}){
    if(!telegraph)return;
    const cues={warn:['SLAM — DODGE',true],cwind:['CHARGE — SIDESTEP',true],swind:['SPIKES — KEEP MOVING',true],quakewarn:['QUAKE — CLEAR THE RING',false],growl:['ATTACK INCOMING',false]};
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
  return Object.freeze({showImpact,syncArmor,confirmHit,showTelegraph,abilityPressed,abilitySettled,updateMovement});
}
