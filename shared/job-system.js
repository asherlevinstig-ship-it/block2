(function exposeJobSystem(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BlockcraftJobSystem = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function jobSystemFactory() {
  'use strict';
  const CAREER_ID = 'adventurer';
  const PROFESSION_IDS = Object.freeze(['miner','farmer','cook','blacksmith','monk']);
  const JOB_IDS = Object.freeze([CAREER_ID,...PROFESSION_IDS]);
  const JOBS = Object.freeze({
    adventurer:Object.freeze({name:'Adventurer',icon:'A',col:'#d8f2ff',role:'Quests, gates, monsters',desc:'Progress by completing town quests, clearing gates, joining events, and defeating threats.',perkName:'Trail Sense',perk:'Improves Hunter contract gold rewards.'}),
    miner:Object.freeze({name:'Miner',icon:'⛏',col:'#9ca3af',role:'Ore, stone, gems',desc:'Progress by mining stone, coal, iron, diamonds, and dungeon walls.',perkName:'Prospector',perk:'Chance for bonus block drops and spared pick durability.'}),
    farmer:Object.freeze({name:'Farmer',icon:'☘',col:'#86efac',role:'Crops and food supply',desc:'Progress by tilling, planting, and harvesting crops.',perkName:'Green Thumb',perk:'Chance for bonus wheat on harvest.'}),
    cook:Object.freeze({name:'Cook',icon:'♨',col:'#fbbf24',role:'Meals and tavern goods',desc:'Progress by cooking, baking, preparing meals, and selling food.',perkName:'Batch Cooking',perk:'Chance to create extra meals while cooking.'}),
    blacksmith:Object.freeze({name:'Blacksmith',icon:'⚒',col:'#fb923c',role:'Gear, tools, repair',desc:'Progress by crafting equipment, smelting ingots, and repairing gear.',perkName:'Tempered Craft',perk:'Crafted tools gain durability; repair kits restore more.'}),
    monk:Object.freeze({name:'Monk',icon:'◇',col:'#7dd3fc',role:'Meditation and support',desc:'Progress by meditating in the Town Shrine.',perkName:'Shrine Focus',perk:'Meditation grants short focus buffs.'}),
  });
  const TITLES = Object.freeze({
    adventurer:[[20,'Legendary Adventurer'],[10,'Gatebreaker'],[5,'Pathfinder'],[2,'Wayfarer'],[1,'Adventurer']],
    miner:[[20,'Master Miner'],[10,'Prospector'],[5,'Stonehand'],[2,'Apprentice Miner'],[1,'Miner']],
    farmer:[[20,'Harvest Master'],[10,'Greenwarden'],[5,'Cropkeeper'],[2,'Apprentice Farmer'],[1,'Farmer']],
    cook:[[20,'Master Chef'],[10,'Feastmaker'],[5,'Tavern Cook'],[2,'Kitchen Hand'],[1,'Cook']],
    blacksmith:[[20,'Master Smith'],[10,'Forgekeeper'],[5,'Ironhand'],[2,'Apprentice Smith'],[1,'Blacksmith']],
    monk:[[20,'Zen Master'],[10,'Runeseer'],[5,'Shrine Adept'],[2,'Acolyte'],[1,'Monk']],
  });
  const MILESTONES = Object.freeze({
    adventurer:Object.freeze([
      Object.freeze({level:2,title:'Trail Sense I',desc:'Hunter contract gold is increased by 6%.'}),
      Object.freeze({level:5,title:'Trail Sense II',desc:'Hunter contract gold is increased by 12%.'}),
      Object.freeze({level:10,title:'Trail Sense III',desc:'Hunter contract gold is increased by 18%.'}),
      Object.freeze({level:20,title:'Trail Sense IV',desc:'Hunter contract gold is increased by 24%.'}),
    ]),
    miner:Object.freeze([
      Object.freeze({level:2,title:'Ore Sense',desc:'Unlocks nearby ore surveys and bonus mining yields.'}),
      Object.freeze({level:5,title:'Stonehand',desc:'Mining can preserve pick durability.'}),
      Object.freeze({level:10,title:'Deep Prospecting',desc:'Ore surveys reach farther and recharge faster.'}),
      Object.freeze({level:20,title:'Geode Mastery',desc:'Ore veins can reveal rare geodes containing forge materials.'}),
    ]),
    farmer:Object.freeze([
      Object.freeze({level:2,title:'Bountiful Harvest',desc:'Unlocks a 15% chance for bonus wheat.'}),
      Object.freeze({level:5,title:'Windseed Cultivation',desc:'Plant Prairie Windseeds for richer harvests.'}),
      Object.freeze({level:10,title:'Fieldcraft',desc:'Crops grow 25% faster and compost can advance them instantly.'}),
      Object.freeze({level:20,title:'Golden Harvest',desc:'Windseed crops can produce valuable Golden Wheat.'}),
    ]),
    cook:Object.freeze([
      Object.freeze({level:2,title:'Batch Cooking',desc:'Unlocks a chance to create extra meals.'}),
      Object.freeze({level:5,title:'Restorative Cooking',desc:'Unlocks Golden Broth with powerful recovery.'}),
      Object.freeze({level:10,title:'Expedition Cuisine',desc:'Unlocks Trail Rations with combat and gathering buffs.'}),
      Object.freeze({level:20,title:'Master Feast',desc:'Unlocks feast platters that nourish and empower nearby party members.'}),
    ]),
    blacksmith:Object.freeze([
      Object.freeze({level:2,title:'Basic Reforging',desc:'Unlocks a random minor modifier at Tobin’s forge.'}),
      Object.freeze({level:5,title:'Directed Reforging',desc:'Choose Keen, Swift, or Sturdy when reforging.'}),
      Object.freeze({level:10,title:'Temper Reroll',desc:'Reroll an existing modifier into a different one.'}),
      Object.freeze({level:20,title:'Masterwork',desc:'Perfect a reforged item for stronger damage, speed, and durability.'}),
    ]),
    monk:Object.freeze([
      Object.freeze({level:2,title:'Restoring Focus',desc:'Meditation grants a regeneration blessing.'}),
      Object.freeze({level:5,title:'Flowing Focus',desc:'Meditation also grants a movement blessing.'}),
      Object.freeze({level:10,title:'Stone Focus',desc:'Meditation also reduces incoming damage.'}),
      Object.freeze({level:20,title:'Shared Tranquillity',desc:'Meditation periodically shares full focus with nearby party members.'}),
    ]),
  });
  const CONTRACTS = Object.freeze({
    adventurer:Object.freeze([
      {type:'kill',need:s=>8+s*2,title:'Road Patrol',desc:'Defeat hostile creatures beyond town.',gold:s=>30+s*5,jobXp:s=>18+s*4},
      {type:'gate',need:s=>1+Math.min(2,(s/3)|0),minLevel:3,title:'Gate Watch',desc:'Clear active gates for the Hunter Guild.',gold:s=>48+s*6,jobXp:s=>28+s*5},
      {type:'event',need:()=>1,title:'Server Duty',desc:'Complete a server event.',gold:s=>44+s*5,jobXp:s=>24+s*5},
    ]),
    miner:Object.freeze([
      {type:'mine',target:'STONE',need:s=>20+s*4,title:'Stone Quota',desc:'Mine stone or cobblestone for town repairs.',gold:s=>24+s*4,jobXp:s=>16+s*4},
      {type:'mine',target:'IRON_ORE',need:s=>5+s,title:'Iron Survey',desc:'Mine iron ore for the forge.',gold:s=>38+s*5,jobXp:s=>22+s*5},
    ]),
    farmer:Object.freeze([
      {type:'farm',need:s=>14+s*3,title:'Field Hand',desc:'Till, plant, and harvest crops for town stores.',gold:s=>26+s*4,jobXp:s=>16+s*4},
      {type:'farm',target:'WHEAT_3',need:s=>5+s,title:'Harvest Basket',desc:'Harvest ripe wheat for the tavern kitchen.',gold:s=>34+s*4,jobXp:s=>20+s*4},
    ]),
    cook:Object.freeze([
      {type:'cook',need:s=>5+s,title:'Kitchen Shift',desc:'Cook, bake, or prepare meals for hungry townsfolk.',gold:s=>34+s*5,jobXp:s=>20+s*4},
      {type:'sell',need:s=>6+s*2,title:'Tavern Supplier',desc:'Sell food to the tavern counter.',gold:s=>30+s*4,jobXp:s=>18+s*4},
    ]),
    blacksmith:Object.freeze([
      {type:'smith',need:s=>5+s,title:'Forge Work',desc:'Smelt, craft tools, make armor, or build repair kits.',gold:s=>38+s*5,jobXp:s=>22+s*5},
      {type:'repair',need:s=>2+Math.min(3,s),title:'Tool Doctor',desc:'Repair worn tools.',gold:s=>42+s*5,jobXp:s=>24+s*5},
    ]),
    monk:Object.freeze([
      {type:'meditate',need:s=>60+s*15,title:'Quiet Vigil',desc:'Meditate inside the Town Shrine and hold focus.',gold:s=>24+s*4,jobXp:s=>22+s*5},
      {type:'meditate',need:s=>90+s*20,title:'Deep Stillness',desc:'Keep a longer meditation so the shrine can settle around you.',gold:s=>36+s*5,jobXp:s=>30+s*6},
    ]),
  });
  const FIRST_HUNTER_CONTRACT = Object.freeze({job:'adventurer',type:'kill',need:3,have:0,title:"Mara's Field Work",desc:'Defeat 3 hostile creatures beyond the town walls.',rewardGold:34,rewardJobXp:20});
  const GUIDE_STEPS = Object.freeze({
    kill:['Fight hostile creatures beyond town with your attack.','Passive animals do not count.','Return to the Job Board when the contract is ready.'],
    gate:['Find an active Gate outside town.','Enter and defeat its boss.','A successful clear advances the contract.'],
    event:['Join a server-event alert and finish the event.','Cancelled or failed events do not count.','Return to the Job Board after completion.'],
    mine:['Equip a pickaxe.','Mine the requested stone or ore. Stone Quota accepts stone or cobble.','Wild caves and Gates contain useful ore.'],
    farm:['Till soil, plant seeds, and harvest mature crops.','General farm contracts accept all three actions.','Harvest Basket requires mature wheat.'],
    cook:['Gather ingredients and prepare meals through crafting or cooking stations.','Completed food items advance the contract.','Return to the board when ready.'],
    sell:['Prepare food items.','Sell them at the tavern counter.','Each accepted food item advances the contract.'],
    smith:['Smelt ingots, craft tools or armor, or make repair kits.','The work counts when the item is completed.','Return to the board when ready.'],
    repair:['Obtain Repair Kits.','Use one on a damaged tool.','Each successful repair advances the contract.'],
    meditate:['Go inside the Town Shrine circle.','Use the meditation interaction and remain focused.','Accumulated focus time advances the contract.'],
  });
  const OFFER_REFRESH_MS = 15 * 60 * 1000;
  // Contracts supplement the XP earned while doing their objective. Material-heavy
  // professions need a larger completion reward to stay near the same Lv20 runway.
  const PROFESSION_REWARD_MULTIPLIER=Object.freeze({miner:1,farmer:1.25,cook:1.5,blacksmith:1.5,monk:1});
  const OFFER_TIERS = Object.freeze([
    Object.freeze({id:'quick',label:'Quick',need:.72,reward:.78,estimate:'About 5 minutes'}),
    Object.freeze({id:'balanced',label:'Balanced',need:1,reward:1,estimate:'About 10 minutes'}),
    Object.freeze({id:'demanding',label:'Demanding',need:1.45,reward:1.5,estimate:'About 15–20 minutes'}),
  ]);
  const LOCATIONS = Object.freeze({kill:'Wilderness roads',gate:'Active Gates',event:'Server event',mine:'Caves and Gate walls',farm:'Town Farm or claimed land',cook:'Crafting and kitchens',sell:'Tavern counter',smith:'Forge and crafting',repair:'Blacksmith workbench',meditate:'Town Shrine'});
  const REFORGE_MODIFIERS=Object.freeze({keen:Object.freeze({name:'Keen',desc:'+2 weapon damage.'}),swift:Object.freeze({name:'Swift',desc:'8% faster weapon and tool use.'}),sturdy:Object.freeze({name:'Sturdy',desc:'20% more maximum durability.'})});
  const REFORGE_ACTIONS=Object.freeze({basic:Object.freeze({level:2,gold:35,iron:2,diamond:0}),choose:Object.freeze({level:5,gold:70,iron:4,diamond:0}),reroll:Object.freeze({level:10,gold:120,iron:0,diamond:1}),masterwork:Object.freeze({level:20,gold:260,iron:0,diamond:3})});
  const FARMER_RULES=Object.freeze({bonusYieldLevel:2,windseedLevel:5,fieldcraftLevel:10,goldenHarvestLevel:20,fieldcraftGrowthMultiplier:.75,goldenGrowthMultiplier:.6,goldenWheatChance:.25});
  const COOK_RULES=Object.freeze({batchLevel:2,brothLevel:5,rationLevel:10,feastLevel:20,rationDurationMs:120000,feastDurationMs:180000,feastRange:20,mightMultiplier:1.15,gatherBonusChance:.25});
  const MONK_RULES=Object.freeze({regenLevel:2,speedLevel:5,stoneLevel:10,auraLevel:20,durationByTier:Object.freeze([0,8,10,12,16]),regenPerSecond:2,speedMultiplier:1.25,stoneMitigation:.35,auraRange:12,auraCooldownMs:15000});
  const MINER_RULES=Object.freeze({oreSenseLevel:2,stonehandLevel:5,deepProspectLevel:10,geodeLevel:20,surveyRadius:8,deepSurveyRadius:18,surveyCooldownMs:30000,deepSurveyCooldownMs:15000,markerDurationMs:12000,geodeChance:.08,durabilitySaveChance:.18});
  function jobXpNeed(level){return Math.round(30*Math.pow(Math.max(1,level|0),1.45));}
  function jobLevelFromXp(xp){let lvl=1,left=Math.max(0,xp|0);while(lvl<99){const need=jobXpNeed(lvl);if(left<need)break;left-=need;lvl++;}return lvl;}
  function jobXpIntoLevel(xp){let lvl=1,left=Math.max(0,xp|0);while(lvl<99){const need=jobXpNeed(lvl);if(left<need)return {lvl,xp:left,need};left-=need;lvl++;}return {lvl,xp:left,need:jobXpNeed(lvl)};}
  function perkTierFromLevel(lvl){return lvl>=20?4:lvl>=10?3:lvl>=5?2:lvl>=2?1:0;}
  function contractScaleFromXp(xp){return Math.max(0,jobLevelFromXp(xp)-1);}
  function perkChance(tier,base=.08){return tier?base+tier*.05:0;}
  function titleFor(job,lvl){for(const [need,title] of TITLES[job]||[])if((lvl|0)>=need)return title;return JOBS[job]?JOBS[job].name:'';}
  function milestonesFor(job){return [...(MILESTONES[job]||[])];}
  function milestoneState(job,level){const all=milestonesFor(job),lvl=Math.max(1,level|0);return {earned:all.filter(m=>lvl>=m.level),next:all.find(m=>lvl<m.level)||null};}
  function milestoneAt(job,level){return (MILESTONES[job]||[]).find(m=>m.level===(level|0))||null;}
  function reforgeModifier(id){return REFORGE_MODIFIERS[id]||null;}
  function reforgeCost(action){const c=REFORGE_ACTIONS[action];return c?{...c}:null;}
  function contractPool(job,scale,level,targets={}){const rewardMult=PROFESSION_REWARD_MULTIPLIER[job]||1;return (CONTRACTS[job]||[]).filter(t=>!t.minLevel||level>=t.minLevel).map(t=>({job,type:t.type,target:t.target?(targets[t.target]??0):0,need:t.need(scale),have:0,title:t.title,desc:t.desc,rewardGold:t.gold(scale),rewardJobXp:Math.max(1,Math.round(t.jobXp(scale)*rewardMult))}));}
  function contractOffers(job,scale,level,targets={},hunterXp=0,rotation=0){
    const pool=contractPool(job,scale,level,targets);if(!pool.length)return [];
    return OFFER_TIERS.map((tier,i)=>{const base=pool[(Math.max(0,rotation|0)+i)%pool.length];return {...base,need:Math.max(1,Math.round(base.need*tier.need)),rewardGold:Math.max(1,Math.round(base.rewardGold*tier.reward)),rewardJobXp:Math.max(1,Math.round(base.rewardJobXp*tier.reward)),rewardXp:Math.max(0,Math.round(hunterXp*tier.reward)),difficulty:tier.id,difficultyLabel:tier.label,estimate:tier.estimate,location:LOCATIONS[base.type]||'Job objective'};});
  }
  function guideSteps(type){return [...(GUIDE_STEPS[type]||['Follow the contract description.','Watch the objective tracker for progress.','Return to the Job Board when complete.'])];}
  function firstHunterContract(){return {...FIRST_HUNTER_CONTRACT};}
  return Object.freeze({CAREER_ID,PROFESSION_IDS,JOB_IDS,JOBS,TITLES,MILESTONES,REFORGE_MODIFIERS,REFORGE_ACTIONS,FARMER_RULES,COOK_RULES,MONK_RULES,MINER_RULES,CONTRACTS,FIRST_HUNTER_CONTRACT,GUIDE_STEPS,OFFER_REFRESH_MS,PROFESSION_REWARD_MULTIPLIER,OFFER_TIERS,LOCATIONS,jobXpNeed,jobLevelFromXp,jobXpIntoLevel,contractScaleFromXp,perkTierFromLevel,perkChance,titleFor,milestonesFor,milestoneState,milestoneAt,reforgeModifier,reforgeCost,contractPool,contractOffers,guideSteps,firstHunterContract});
});
