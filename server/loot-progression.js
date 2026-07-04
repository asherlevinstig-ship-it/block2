const GEAR_SYSTEM=require('../shared/gear-system');
const LOOT_ECONOMY=require('../shared/loot-economy');

const DEFAULT_ACTIVITY=Object.freeze({
  banditsPerHour:36,
  captainsPerHour:3,
  gatesPerHour:1,
});

function seededRandom(seed=0x51f15e){
  let state=(seed>>>0)||1;
  return ()=>{
    state=(Math.imul(state,1664525)+1013904223)>>>0;
    return state/0x100000000;
  };
}

function gearTierForRank(rank){return Math.min(4,Math.max(1,(rank|0)+1));}

function rollSource(source,tier,plus,random){
  const spec=LOOT_ECONOMY.weaponSpec(source,tier,plus,random(),random());
  if(!spec)return null;
  const rarity=GEAR_SYSTEM.rollRarity(random(),spec.rarityBonus);
  return {
    source,
    archetype:spec.archetype,
    rankIndex:spec.rank,
    rarityIndex:GEAR_SYSTEM.RARITIES.findIndex(row=>row.id===rarity.id),
    powerScore:spec.rank*10+GEAR_SYSTEM.RARITIES.findIndex(row=>row.id===rarity.id),
  };
}

function simulateLootProgression(options={}){
  const tier=Math.max(0,Math.min(4,options.tier|0));
  const trials=Math.max(100,options.trials|0||20000);
  const freeSlots=options.freeSlots==null?36:Math.max(0,options.freeSlots|0);
  const recoverySlots=options.recoverySlots==null?12:Math.max(0,options.recoverySlots|0);
  const activity={...DEFAULT_ACTIVITY,...options.activity};
  const random=seededRandom(options.seed==null?0x51f15e:options.seed);
  const distribution=Array.from({length:6},()=>new Array(5).fill(0));
  const archetypes={sword:0,axe:0},sourceArchetypes={bandit:{sword:0,axe:0},captain:{sword:0,axe:0},gate:{sword:0,axe:0}};
  let drops=0,delivered=0,recovered=0,upgrades=0,rankSkips=0,salvageIron=0,salvageGold=0,lost=0;
  for(let trial=0;trial<trials;trial++){
    let best=tier*10,slots=freeSlots,recoveryOpen=recoverySlots;
    const attempts=[
      ['bandit',activity.banditsPerHour],
      ['captain',activity.captainsPerHour],
      ['gate',activity.gatesPerHour],
    ];
    for(const [source,count] of attempts){
      for(let n=0;n<count;n++){
        const item=rollSource(source,tier,options.shardPlus|0,random);
        if(!item)continue;
        drops++;distribution[item.rankIndex][item.rarityIndex]++;archetypes[item.archetype]++;sourceArchetypes[source][item.archetype]++;
        if(slots<=0){
          if(recoveryOpen>0){recoveryOpen--;recovered++;}
          else lost++;
          continue;
        }
        slots--;delivered++;
        if(item.powerScore>best){
          upgrades++;if(item.rankIndex>tier+1)rankSkips++;
          best=item.powerScore;
        }else{
          const salvage=LOOT_ECONOMY.salvageYield(item.rankIndex,item.rarityIndex,gearTierForRank(item.rankIndex));
          salvageIron+=salvage.iron;salvageGold+=salvage.gold;
        }
      }
    }
  }
  const perHour=value=>Math.round(value/trials*100)/100;
  return Object.freeze({
    tier,
    trials,
    activity:Object.freeze(activity),
    dropsPerHour:perHour(drops),
    upgradesPerHour:perHour(upgrades),
    salvageIronPerHour:perHour(salvageIron),
    salvageGoldPerHour:perHour(salvageGold),
    deliveryRate:drops?Math.round(delivered/drops*10000)/100:100,
    securedRate:drops?Math.round((delivered+recovered)/drops*10000)/100:100,
    recoveredPerHour:perHour(recovered),
    lostPerHour:perHour(lost),
    rankSkips,
    distribution,
    archetypes,
    sourceArchetypes,
  });
}

function lootEconomySnapshot(options={}){
  return [0,1,2,3,4].map(tier=>simulateLootProgression({...options,tier,seed:(options.seed||0x51f15e)+tier*7919}));
}

module.exports={DEFAULT_ACTIVITY,seededRandom,simulateLootProgression,lootEconomySnapshot};
