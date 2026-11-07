import {bondedEssences,confluence,essencePower,normalizeMagic} from '../public/essences.js';
import {combatStamina,huntEnemy} from '../public/hunting.js';

export function essenceAction(state,action,body){
  if(!['bondEssences','awakenPower','equipPower'].includes(action))return false;
  if(state.plan||state.report||state.fishingCast||state.timberCut||state.hunting.encounter||state.hunting.recoveryUntil||state.health<=0){
    throw new Error('Invalid activity. Finish your current activity first.');
  }
  const magic=state.magic??=normalizeMagic();
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
    if(magic.equipped&&!bondedEssences(magic.picks).includes(essencePower(magic.equipped)?.gem))magic.equipped=null;
  }else{
    if(action==='equipPower'&&body.id===null){magic.equipped=null;return true;}
    const power=essencePower(body.id,state.stats);
    if(!power||!bondedEssences(magic.picks).includes(power.gem))throw new Error('Choose a power from one of your bonded Gems.');
    const known=magic.unlocked.includes(power.id);
    if(action==='awakenPower'){
      if(known)throw new Error('This power is already awakened.');
      if(!magic.stones[power.form])throw new Error('Choose a power with a matching Awakening Stone in your journal.');
      magic.stones[power.form]--;
      magic.unlocked.push(power.id);
      magic.equipped??=power.id;
    }else{
      if(!known)throw new Error('Awaken this power before equipping it.');
      magic.equipped=power.id;
    }
  }
  return true;
}

export function castEssencePower(state,now){
  const magic=state.magic,encounter=state.hunting.encounter;
  if(!encounter||!magic?.equipped||now<magic.nextCastAt||!magic.unlocked.includes(magic.equipped))return null;
  const power=essencePower(magic.equipped,state.stats);
  if(!power||!bondedEssences(magic.picks).includes(power.gem))return null;
  const {form,value}=power;
  if(form==='renewal'&&state.health>=100)return null;
  const next={...encounter};
  const event={action:'essence',power:power.name,powerColor:power.color,encounter:next,health:state.health,damage:0,taken:0,outcome:'fighting'};
  if(form==='sword'){
    const enemy=huntEnemy(encounter);
    const armor=now<(encounter.exposedUntil??0)?0:enemy.shellArmor??0;
    event.damage=Math.min(next.health,Math.max(1,value-armor));
    next.health-=event.damage;
    if(next.health===0){event.encounter=null;event.outcome='victory';}
    event.effect='dealt '+event.damage+' damage';
  }else if(form==='shield'){
    next.magicWard=value;next.magicWardUntil=now+5000;
    event.effect='raised a '+value+' point ward';
  }else if(form==='speed'){
    const stamina=combatStamina(encounter,state.stats,now,state.combatGear.moonwellCharmEquipped);
    next.stamina=Math.min(100,stamina+value);next.staminaAt=now;
    next.nextPlayerAt=Math.max(now,next.nextPlayerAt-300);
    event.effect='restored '+Math.round(next.stamina-stamina)+' stamina and quickened your strike';
  }else if(form==='focus'){
    next.nextBoarAt+=value;
    event.effect='delayed the enemy strike';
  }else{
    event.health=Math.min(100,state.health+value);
    event.effect='restored '+(event.health-state.health)+' HP';
  }
  magic.nextCastAt=now+power.cooldown;
  return event;
}
