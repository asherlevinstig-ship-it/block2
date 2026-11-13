import {playerMaxHealth} from '../public/food-buffs.js';
import {roleDamage} from '../public/enemy-roles.js';
import {combatBuild} from '../public/combat-builds.js';
import {activeAdd,addEncounter,mergeAddEvent} from '../public/dungeon-adds.js';
import {bondedEssences,confluence,essencePower,normalizeMagic,essenceEffects,essenceGems,bladeSplash} from '../public/essences.js';
import {arenaEnemy} from '../public/dungeon-arena.js';
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
  const before=state.hunting.encounter,event=castSingleEssencePower(state,now,slot);
  const splash=bladeSplash(essencePower(event?.powerId,state.stats,state.magic,combatBuild(state)));
  if(!splash||!event?.encounter||!before?.adds?.length)return event;
  const primary=activeAdd(before),origin=primary??arenaEnemy(before),next=event.encounter,hits=[];
  next.adds=next.adds.map(a=>{
    if(a.id===primary?.id||a.spawnAt>now||Math.hypot(a.x-origin.x,a.y-origin.y)>splash.radius)return a;
    const damage=Math.min(a.health,splash.damage);hits.push({id:a.id,x:a.x,y:a.y,damage,killed:damage===a.health});return {...a,health:a.health-damage};
  }).filter(a=>a.health>0);
  if(!hits.length)return event;
  event.splash=hits;event.splashKills=hits.filter(a=>a.killed).length;next.addKills=(next.addKills??0)+event.splashKills;
  if(next.combatTarget!=='leader'&&!next.adds.some(a=>a.id===next.combatTarget)){next.combatTarget='leader';next.manualTarget=false;}
  if(before.enemy==='cacheGuardian'&&before.adds.some(a=>a.kind==='wisp'&&a.spawnAt<=now)&&!next.adds.some(a=>a.kind==='wisp')){next.staggerWeakUntil=Math.max(next.staggerWeakUntil??0,now+3000);event.wardBroken=true;}
  event.effect+=' · Splash hit '+hits.length+' nearby reinforcement'+(hits.length===1?'':'s');return event;
}
function castSingleEssencePower(state,now,slot='q'){
  if(!['q','e'].includes(slot))throw new Error('Choose the Q or E power slot.');
  const magic=state.magic,encounter=state.hunting.encounter;
  const id=magic?.slots[slot];
  if(!encounter||!id||now<(magic.cooldowns[id]??0)||!magic.unlocked.includes(id))return null;
  const build=combatBuild(state),power=essencePower(id,state.stats,magic,build);
  if(!power||!bondedEssences(magic.picks).includes(power.gem))return null;
  const {form,value}=power,masteryBonus=power.masteryLevel-1;
  if(form==='renewal'&&state.health>=playerMaxHealth(state,now))return null;
  const target=!encounter?.addActor&&activeAdd(encounter);
  if(target&&now>=target.spawnAt&&form==='sword'){
    const proxy={...state,hunting:{...state.hunting,encounter:addEncounter(encounter,target)}};
    const event=castSingleEssencePower(proxy,now,slot);state.vitals=proxy.vitals;
    return mergeAddEvent(encounter,target,event,now);
  }
  if(!spendMana(state,now))return null;
  const next={...encounter};
  const event={action:'essence',powerId:power.id,power:power.name,powerColor:power.color,powerForm:form,encounter:next,health:state.health,damage:0,taken:0,outcome:'fighting'};
  if(form==='sword'){
    const enemy=huntEnemy(encounter);
    const armor=now<(encounter.exposedUntil??0)?0:enemy.shellArmor??0;
    const shatter=build.id==='spellweaver'&&encounter.chilledUntil>now;
    event.damage=Math.min(next.health,Math.max(1,Math.round(value*(shatter?1.15:1))-armor));
    const roleHit=roleDamage(encounter,event.damage,now,{magic:true});event.damage=Math.min(next.health,roleHit.damage);event.wardAbsorbed=roleHit.wardAbsorbed;event.coreBonus=roleHit.coreBonus;
    if(shatter){event.shatter=true;delete next.chilledUntil;}
    next.health-=event.damage;
    if(next.health===0){if(encounter.addActor)event.killedEncounter=next;event.encounter=null;event.outcome='victory';}
    event.effect='dealt '+event.damage+' damage'+(event.shatter?' · Shatter!':'')+(event.wardAbsorbed?' · Rune Ward absorbed '+event.wardAbsorbed:'')+(event.coreBonus?' · Exposed core!':'');
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
    event.health=Math.min(playerMaxHealth(state,now),state.health+value);
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
