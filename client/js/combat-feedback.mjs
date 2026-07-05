const ARMOR_LABELS=Object.freeze({scout:'Scout',vanguard:'Vanguard',bulwark:'Bulwark',aegis:'Aegis'});

export function armorCondition(dur,maxDur){
  const ratio=maxDur>0?Math.max(0,Math.min(1,dur/maxDur)):0;
  return Object.freeze({ratio,band:dur<=0?'broken':ratio<=.1?'critical':ratio<=.25?'low':'sound'});
}

export function createCombatFeedback({document,showName,sysMsg,sound}){
  const impact=document.getElementById('combatimpact'),warning=document.getElementById('armorwarning');
  let impactTimer=0,lastArmorBand='sound';
  function showImpact(hit={}){
    if(!impact)return;
    const damage=Math.max(0,Number(hit.n)||0),absorbed=Math.max(0,Number(hit.absorbed)||0);
    const armorType=hit.armor&&ARMOR_LABELS[hit.armor.type]||'';
    impact.textContent=hit.lethal?'LETHAL HIT':('-'+Math.round(damage)+' HP'+(absorbed?' · '+absorbed+' BLOCKED':''));
    impact.className=hit.lethal?'lethal':armorType?'armored':'hurt';
    if(armorType)impact.dataset.armor=armorType.toUpperCase();
    else delete impact.dataset.armor;
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
  return Object.freeze({showImpact,syncArmor});
}
