import {bondedEssences,confluence,essencePower,normalizeMagic,essenceEffects,essenceGems} from '../public/essences.js';
import {spendMana} from '../public/player-vitals.js';
import {combatStamina,huntEnemy,enemyAttack,transitionVaultPhase} from '../public/hunting.js';

export function essenceAction(state,action,body){
  if(!['bondEssences','awakenPower','equipPower'].includes(action))return false;
  if(state.plan||state.report||state.fishingCast||state.timberCut||state.hunting.encounter||state.hunting.recoveryUntil||state.health<=0){
    throw new Error('Invalid activity. Finish your current activity first.');
  }
  const magic=state.magic=normalizeMagic(state.magic);
  const slot=body.slot??'q';
  if(action==='equipPower'&&!['q','e'].includes(slot))throw new Error('Choose the Q or E power slot.');
  if(action==='bondEssences'){
    if(!confluence(body.picks))throw new Error('Choose three different Magic Gems.');
    const {location,position}=state;
    const changing=magic.picks.length>0;
    const atLandmark=position&&Math.abs(position.x-6)+Math.abs(position.y-4)===1;
    if(!atLandmark||location!==(changing?'shrine':'ruins')){
      throw new Error(changing?'Travel beside the Moth Shrine to change your Gems.':'Travel beside the Moonwell in Moonwell Ruins to bond your first Gems.');
    }
    if(!magic.picks.length)magic.stones.sword++;
    magic.picks=[...body.picks];
    for(const key of ['q','e']){
      if(!bondedEssences(magic.picks).includes(essencePower(magic.slots[key])?.gem))magic.slots[key]=null;
    }
  }else{
    if(action==='equipPower'&&body.id===null){magic.slots[slot]=null;return true;}
    const power=essencePower(body.id,state.stats);
    if(!power||!bondedEssences(magic.picks).includes(power.gem))throw new Error('Choose a power from one of your bonded Gems.');
    const known=magic.unlocked.includes(power.id);
    if(action==='awakenPower'){
      if(known)throw new Error('This power is already awakened.');
      if(!magic.stones[power.form])throw new Error('Choose a power with a matching Awakening Stone in your journal.');
      magic.stones[power.form]--;
      magic.unlocked.push(power.id);
      const empty=['q','e'].find(key=>!magic.slots[key]);
      if(empty)magic.slots[empty]=power.id;
    }else{
      if(!known)throw new Error('Awaken this power before equipping it.');
      const other=slot==='q'?'e':'q';
      if(magic.slots[other]===power.id)magic.slots[other]=magic.slots[slot];
      magic.slots[slot]=power.id;
    }
  }
  return true;
}

export function castEssencePower(state,now,slot='q'){
  if(!['q','e'].includes(slot))throw new Error('Choose the Q or E power slot.');
  const magic=state.magic,encounter=state.hunting.encounter;
  const id=magic?.slots[slot];
  if(!encounter||!id||now<(magic.cooldowns[id]??0)||!magic.unlocked.includes(id))return null;
  const power=essencePower(id,state.stats,magic);
  if(!power||!bondedEssences(magic.picks).includes(power.gem))return null;
  const {form,value}=power,masteryBonus=power.masteryLevel-1;
  if(form==='renewal'&&state.health>=100)return null;
  if(!spendMana(state,now))return null;
  const next={...encounter};
  const event={action:'essence',powerId:power.id,power:power.name,powerColor:power.color,powerForm:form,encounter:next,health:state.health,damage:0,taken:0,outcome:'fighting'};
  if(form==='sword'){
    const enemy=huntEnemy(encounter);
    const armor=now<(encounter.exposedUntil??0)?0:enemy.shellArmor??0;
    event.damage=Math.min(next.health,Math.max(1,value-armor));
    next.health-=event.damage;
    if(next.health===0){event.encounter=null;event.outcome='victory';}
    event.effect='dealt '+event.damage+' damage';
  }else if(form==='shield'){
    next.magicWard=value;next.magicWardUntil=now+5000;
    event.ward=value;
    event.effect='raised a '+value+' point ward';
  }else if(form==='speed'){
    const stamina=combatStamina(encounter,state.stats,now,state.combatGear.moonwellCharmEquipped);
    next.stamina=Math.min(100,stamina+value);next.staminaAt=now;
    next.nextPlayerAt=Math.max(now,next.nextPlayerAt-300);
    event.staminaRestored=Math.round(next.stamina-stamina);
    event.effect='restored '+event.staminaRestored+' stamina and quickened your strike';
  }else if(form==='focus'){
    next.nextBoarAt+=value;
    event.effect='delayed the enemy strike';
  }else{
    event.health=Math.min(100,state.health+value);
    event.healed=event.health-state.health;
    event.effect='restored '+event.healed+' HP';
  }
  if(event.encounter&&power.gem==='fire'){
    const effect=essenceEffects.fire,damage=power.rank+2+masteryBonus*effect.masteryBonus;
    const burning=encounter.burn&&encounter.burn.until>=now;
    next.burn={damage:burning?Math.max(damage,encounter.burn.damage):damage,
      nextAt:burning?encounter.burn.nextAt:now+effect.interval,until:now+effect.duration};
    event.effect+=' and ignited the enemy';
  }
  if(event.encounter&&power.gem==='ice'){
    const effect=essenceEffects.ice,chilled=now<(encounter.chilledUntil??0);
    const delay=effect.delay+masteryBonus*effect.masteryBonus;
    if(!chilled)next.nextBoarAt+=delay;
    next.chilledUntil=now+effect.duration;
    event.effect+=chilled?' and refreshed Chill':' and delayed the enemy attack by '+(delay/1000).toFixed(1)+' seconds';
  }
  if(event.encounter&&power.gem==='shadow'){
    next.weakenedUntil=now+essenceEffects.shadow.duration;
    next.weakenPercent=100*essenceEffects.shadow.reduction+masteryBonus*essenceEffects.shadow.masteryBonus;
    event.effect+=' and weakened the enemy’s next hit';
  }
  if(event.encounter&&power.gem==='storm'){
    const enemy=huntEnemy(encounter),attack=enemyAttack(encounter,enemy),remaining=encounter.nextBoarAt-now;
    const windingUp=remaining>0&&remaining<=attack.tell;
    if(windingUp&&now<(encounter.interruptResistUntil??0)){
      event.interruptResisted=true;
      event.effect+=' but the enemy resisted the interrupt';
    }else if(windingUp){
      next.nextBoarAt=Math.max(next.nextBoarAt,now+enemy.interval)+masteryBonus*essenceEffects.storm.masteryBonus;
      delete next.enemyMove;
      next.interruptResistUntil=now+essenceEffects.storm.duration;
      event.interrupted=true;
      event.effect+=' and interrupted '+attack.name;
      if(enemy.elite&&attack.opensShell){
        next.exposedUntil=Math.max(next.exposedUntil??0,now+enemy.exposureMs);
        event.shellExposed=true;
        event.effect+=', exposing its shell';
      }
    }else event.effect+='. Cast during an attack warning to interrupt';
  }
  if(Object.hasOwn(essenceGems,power.gem)){
    event.masteryGem=power.gem;
    if(event.encounter)next.usedEssences=[...new Set([...(encounter.usedEssences??[]),power.gem])];
  }
  magic.cooldowns[power.id]=now+power.cooldown;
  return transitionVaultPhase(event,encounter,now);
}
