(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.BlockcraftNpcQuestChains=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const TYPE_META=Object.freeze({
    fetch:Object.freeze({location:'Town delivery',action:null,text:'Gather the requested supplies.',claimLabel:'TURN IN'}),
    mine:Object.freeze({location:'Mine or cave route',action:null,text:'Mine the requested material.',claimLabel:'TURN IN'}),
    farm:Object.freeze({location:'Town Farm or claimed field',action:Object.freeze({type:'craft',label:'FARM CROPS'}),text:'Work crops through tilling, planting, or harvesting.',claimLabel:'REPORT HARVEST'}),
    cook:Object.freeze({location:'Crafting and kitchens',action:Object.freeze({type:'craft',label:'COOK FOOD'}),text:'Cook the requested food.',claimLabel:'REPORT COOKING'}),
    smith:Object.freeze({location:'Forge and crafting',action:Object.freeze({type:'craft',label:'CRAFT GEAR'}),text:'Smith the requested item.',claimLabel:'REPORT FORGE WORK'}),
    treasure:Object.freeze({location:'Treasure map route',action:Object.freeze({type:'guild_contracts',label:'FIND CACHE'}),text:'Follow a treasure map or recover a buried cache.',claimLabel:'REPORT CACHE'}),
    kill:Object.freeze({location:'Overworld wilderness',action:null,text:'Defeat hostile creatures beyond town.',claimLabel:'REPORT BACK'}),
    gate:Object.freeze({location:'Wilderness Gate',action:Object.freeze({type:'find_gate',label:'FIND GATE'}),text:'Find and clear the assigned Gate.',claimLabel:'REPORT CLEAR'}),
    sell:Object.freeze({location:'Town market',action:Object.freeze({type:'sell_items',label:'SELL ITEMS'}),text:'Sell the requested goods.',claimLabel:'REPORT SALE'}),
    utility:Object.freeze({location:'Utility unlock path',action:Object.freeze({type:'utility',label:'OPEN UTILITIES'}),text:'Unlock or equip the requested utility.',claimLabel:'SHOW UTILITY'}),
    familiar:Object.freeze({location:'Companion bond',action:Object.freeze({type:'companions',label:'OPEN COMPANIONS'}),text:'Bind the requested familiar.',claimLabel:'SHOW FAMILIAR'}),
    mount:Object.freeze({location:'Dragon roost',action:Object.freeze({type:'companions',label:'OPEN ROOST'}),text:'Bond the requested mount.',claimLabel:'SHOW MOUNT'}),
    mount_use:Object.freeze({location:'Overworld travel',action:Object.freeze({type:'companions',label:'SUMMON MOUNT'}),text:'Summon and ride the requested mount.',claimLabel:'REPORT RIDE'}),
    manhunt:Object.freeze({location:'Overworld wilderness',action:Object.freeze({type:'hunt',label:'TRACK TARGETS'}),text:'Track and defeat the marked threats.',claimLabel:'REPORT HUNT'})
  });
  function actionCopy(action){ return action?Object.freeze({type:action.type,label:action.label}):null; }
  function cleanRole(role){ return String(role||'town').replace(/[<>]/g,'').slice(0,32)||'town'; }
  function rewardItemsCopy(items){
    return Array.isArray(items)?items.slice(0,8).map(it=>Object.freeze({id:it&&it.id|0,count:Math.max(1,it&&it.count|0||1)})).filter(it=>it.id>0):[];
  }
  function metadataForQuest(def,giver){
    const meta=TYPE_META[def&&def.type]||TYPE_META.fetch;
    const claimLabel=String(def&&def.turnInLabel||meta.claimLabel||'TURN IN');
    return Object.freeze({
      category:def&&def.type==='manhunt'?'manhunt':'story',
      questType:def&&def.type==='manhunt'?'manhunt':'npc',
      objectiveText:String(def&&def.objectiveText||meta.text||'Complete the objective.'),
      objectiveLocation:String(def&&def.objectiveLocation||meta.location||'Follow the active trail'),
      objectiveAction:actionCopy(def&&def.objectiveAction||meta.action),
      turnInText:String(def&&def.turnInText||('Turn in to '+String(giver||'the quest giver'))),
      turnInLocation:String(def&&def.turnInLocation||giver||'Quest giver'),
      turnInAction:actionCopy(def&&def.turnInAction||{type:'turn_in',label:claimLabel})
    });
  }
  function Q(def,giver){ return Object.freeze({...def,metadata:metadataForQuest(def,giver)}); }
  function freezeChains(chains){
    const out={};
    for(const [giver,list] of Object.entries(chains))out[giver]=Object.freeze(list.map(q=>Q(q,giver)));
    return Object.freeze(out);
  }
  function createNpcQuestChains({B,I}={}){
    if(!B||!I)throw new Error('createNpcQuestChains requires block and item constants');
    return freezeChains({
      'Mara Vale':[
        {title:'First Hands', type:'fetch', item:B.LOG, need:6, desc:'Gather {N} logs beyond the walls. This first field task will take you to Level 2.', gold:16, xp:28, levelTarget:2},
        {title:'Road Ready', type:'kill', need:3, desc:'Mara hands you a wooden sword. Use it to defeat {N} monsters beyond town, then return ready for Level 3 and your first Gate.', gold:24, xp:47, levelTarget:3, objectiveText:'Use Mara\'s wooden sword to defeat 3 hostile monsters beyond the walls.', objectiveLocation:'Wilderness outside town'},
        {title:'The First Gate', type:'gate', need:1, gateRank:0, desc:'Your first E-rank Gate has opened. Check your health, bring food if you have it, enter the glowing Gate, defeat its boss, and return to Mara.', gold:50, xp:60, objectiveText:'Find the cinematic E-rank Gate marker, enter when ready, and defeat the dungeon boss.', objectiveLocation:'First E-rank Gate', objectiveAction:{type:'find_gate',label:'FIND GATE'}},
        {title:'A Better Sense', type:'utility', utility:'compass', need:1, desc:'Earn and equip a utility. Start with Compass Sense from a Guild Contract, then return to Mara.', gold:42, xp:58},
        {title:'Meat Becomes Gold', type:'sell', item:I.MONSTER_MEAT, need:1, desc:'Go hunting, bring Monster Meat to Greta at the tavern, and sell {N} piece for gold.', gold:38, xp:54, rewardItems:[{id:I.SHADOW_SIGIL,count:1}]},
        {title:'A Shadow Companion', type:'familiar', familiar:'shade', need:1, desc:'Use the Shadow Sigil Mara gave you to bind Shade, then return. Press K to call it afterward.', gold:52, xp:72, rewardItems:[{id:B.EGG_INSULATOR,count:1},{id:I.DRAGON_EGG,count:1}]},
        {title:'First Bonded Mount', type:'mount', mount:'dragon', need:1, desc:'Place the Egg Insulator, use the Dragon Egg on it, and claim the hatchling when it is ready.', gold:78, xp:100},
        {title:'Sky Legs', type:'mount_use', mount:'dragon', need:1, desc:'Summon your dragon with X and ride it. Return once you have mounted up.', gold:64, xp:88}
      ],
      'Garrik Flint':[
        {title:'Stonehand Trial', type:'fetch', item:B.COBBLE, need:18, desc:'Bring {N} cobble. A miner learns by weight, not by words.', gold:24, xp:34},
        {title:'Coal Mark', type:'mine', item:B.COAL_ORE, need:6, desc:'Mine {N} coal ore veins and listen for the pitch of the rock.', gold:34, xp:46},
        {title:'Iron Below', type:'mine', item:B.IRON_ORE, need:5, desc:'Mine {N} iron ore veins. Bring back proof you can read the deeper seams.', gold:48, xp:64},
        {title:'Old Survey Marks', type:'treasure', need:1, desc:'Complete {N} treasure route or recover a buried cache. Garrik wants to compare old survey marks with what you find.', gold:66, xp:78}
      ],
      'Tobin Ashhand':[
        {title:'Forge Fuel', type:'mine', item:B.COAL_ORE, need:5, desc:'The forge needs heat. Mine {N} coal ore for the smithy.', gold:30, xp:42},
        {title:'Smith Stock', type:'smith', item:I.IRON_INGOT, need:3, desc:'Smelt {N} iron ingots for real town equipment.', gold:48, xp:66},
        {title:'A Practical Edge', type:'smith', item:I.REPAIR_KIT, need:1, desc:'Craft {N} repair kit. Good gear is maintained, not discarded.', gold:64, xp:84}
      ],
      'Edda Quill':[
        {title:'Gate Notes', type:'gate', need:1, desc:'Clear {N} gate and return with what the air felt like inside.', gold:72, xp:80},
        {title:'Crystal Harmonics', type:'mine', item:B.DIAMOND_ORE, need:2, desc:'Mine {N} diamond ore veins. Their resonance helps map gate behavior.', gold:90, xp:100},
        {title:'Scholar Supplies', type:'fetch', item:B.GLASS, need:8, desc:'Bring {N} glass panes for safer experiments and cleaner lenses.', gold:44, xp:58}
      ],
      'Bram Ledger':[
        {title:'Crates And Claims', type:'fetch', item:B.PLANKS, need:20, desc:'Bring {N} planks so the market can crate supplies properly.', gold:28, xp:34},
        {title:'Road Reserve', type:'fetch', item:B.COBBLE, need:20, desc:'Deliver {N} cobble for road patches between town buildings.', gold:32, xp:40},
        {title:'Night Stock', type:'fetch', item:B.TORCH, need:10, desc:'Bring {N} torches for the night patrol supply chest.', gold:42, xp:52}
      ],
      'Liss Barley':[
        {title:'Field Hands', type:'farm', need:8, desc:'Till, plant, or harvest crops {N} times so the tavern can feed workers and travelers.', gold:30, xp:42},
        {title:'Bread Line', type:'fetch', item:I.BREAD, need:3, desc:'Bake and deliver {N} loaves for the morning shift.', gold:42, xp:54},
        {title:'Care Feed', type:'fetch', item:I.DRAGON_TREAT, need:1, desc:'Craft {N} dragon treat. The roost depends on farmers and cooks.', gold:62, xp:74},
        {title:'The Bright Harvest', type:'fetch', item:I.GOLDEN_WHEAT, need:1, desc:'Bring Liss one Golden Wheat. She has seen a harvest-sprite following its light.', gold:74, xp:92, rewardItems:[{id:I.FORAGE_CHARM,count:1}]},
        {title:'A Sprite in the Sheaves', type:'familiar', familiar:'sprite', need:1, desc:'Use the Forage Charm to bind Sprite, then return to Liss.', gold:82, xp:104}
      ],
      'Pippa Hearth':[
        {title:'Warm Meals', type:'cook', item:I.COOKED_MEAT, need:3, desc:'Cook {N} cuts for workers coming in from the cold roads.', gold:36, xp:46},
        {title:'Travel Bread', type:'fetch', item:I.BREAD, need:3, desc:'Bring {N} loaves for travelers headed to the gates.', gold:40, xp:52},
        {title:'Roost Treats', type:'fetch', item:I.DRAGON_TREAT, need:1, desc:'Prepare {N} dragon treat for the stablemaster.', gold:64, xp:78},
        {title:'A Light for the Wounded', type:'fetch', item:I.HEARTY_SANDWICH, need:1, desc:'Bring Pippa a Hearty Sandwich for the infirmary. She will entrust you with a restorative charm.', gold:76, xp:94, rewardItems:[{id:I.MOTE_CHARM,count:1}]},
        {title:'The Gentle Mote', type:'familiar', familiar:'mote', need:1, desc:'Use the Mote Charm to bind Mote, then return to Pippa.', gold:84, xp:108}
      ],
      'Oren Mortar':[
        {title:'Foundation Check', type:'fetch', item:B.COBBLE, need:22, desc:'Bring {N} cobble for the next wall repair.', gold:32, xp:42},
        {title:'Pane Work', type:'fetch', item:B.GLASS, need:8, desc:'Deliver {N} glass for safer public buildings.', gold:40, xp:50},
        {title:'Brick Sense', type:'fetch', item:B.BRICK, need:12, desc:'Bring {N} brick blocks. A town should look built, not patched together.', gold:50, xp:64}
      ],
      'Sable Venn':[
        {title:'Quiet Watch', type:'kill', need:3, desc:'Remove {N} monsters near the road, then return to the shrine in silence.', gold:34, xp:48},
        {title:'Candle Reserve', type:'fetch', item:B.TORCH, need:8, desc:'Bring {N} torches for the shrine perimeter candles.', gold:38, xp:50},
        {title:'Stillness After Storm', type:'gate', need:1, desc:'Clear {N} gate, then bring the noise of it back to stillness.', gold:76, xp:86}
      ],
      'Pell Graywatch':[
        {title:'Wall Patrol', type:'kill', need:5, desc:'Cull {N} monsters beyond the wall before they learn the road.', gold:38, xp:54},
        {title:'Patrol Gear', type:'fetch', item:B.TORCH, need:10, desc:'Bring {N} torches for patrol routes and gate markers.', gold:42, xp:54},
        {title:'Gate Duty', type:'gate', need:1, desc:'Clear {N} gate. A warden trusts action more than promises.', gold:82, xp:92},
        {title:'Tracks Beyond the Wall', type:'manhunt', need:8, desc:'Manhunt: track and defeat 8 hostile creatures beyond the wall. Pell says an old guardian hound answers proven hunters.', gold:78, xp:98, rewardItems:[{id:I.FANG_TOTEM,count:1}]},
        {title:'The Fang Pact', type:'familiar', familiar:'fang', need:1, desc:'Use the Fang Totem to bind Fang, then return to Pell.', gold:86, xp:112}
      ],
      'Greta Warmug':[
        {title:'Cellar Supper', type:'sell', item:I.COOKED_MEAT, need:3, desc:'Sell {N} cooked meat through the tavern counter so Greta can serve a proper supper.', gold:38, xp:48},
        {title:'Breakfast Rush', type:'fetch', item:I.BREAD, need:4, desc:'Deliver {N} loaves before the morning crowd finds the counter empty.', gold:46, xp:56},
        {title:'House Specialty', type:'fetch', item:I.HEARTY_SANDWICH, need:1, desc:'Make {N} hearty sandwich worthy of the Gilded Mug sign.', gold:68, xp:82}
      ],
      'Rook Emberstall':[
        {title:'Roost Manners', type:'fetch', item:I.WHEAT, need:6, desc:'Bring {N} wheat for the calmer dragons and hatchlings.', gold:34, xp:44},
        {title:'Treat Training', type:'fetch', item:I.DRAGON_TREAT, need:1, desc:'Bring {N} dragon treat and learn how bond care becomes trust.', gold:70, xp:82},
        {title:'Sky Stock', type:'fetch', item:B.PLANKS, need:24, desc:'Bring {N} planks for roost perches large enough for growing wings.', gold:50, xp:62}
      ]
    });
  }
  function validateNpcQuestChains(chains){
    const errors=[];
    if(!chains||typeof chains!=='object')return ['quest chain registry must be an object'];
    for(const [giver,list] of Object.entries(chains)){
      if(!giver.trim())errors.push('quest chain has blank giver');
      if(!Array.isArray(list)||!list.length){errors.push(giver+' has no quests');continue;}
      list.forEach((q,index)=>{
        const where=giver+'['+index+']';
        if(!q||typeof q!=='object')return errors.push(where+' is not an object');
        if(!q.title)errors.push(where+' missing title');
        if(!['fetch','mine','farm','cook','smith','treasure','kill','gate','sell','utility','familiar','mount','mount_use','manhunt'].includes(q.type))errors.push(where+' invalid type '+q.type);
        if((q.need|0)<1)errors.push(where+' need must be >= 1');
        if((q.gold|0)<0||(q.xp|0)<0)errors.push(where+' reward must be non-negative');
        if(['fetch','mine','cook','smith','sell'].includes(q.type)&&!(q.item>0))errors.push(where+' missing item target');
        if(q.type==='utility'&&!q.utility)errors.push(where+' missing utility target');
        if(q.type==='familiar'&&!q.familiar)errors.push(where+' missing familiar target');
        if((q.type==='mount'||q.type==='mount_use')&&!q.mount)errors.push(where+' missing mount target');
        if(!q.metadata||typeof q.metadata!=='object')errors.push(where+' missing objective metadata');
        else{
          if(!q.metadata.category)errors.push(where+' metadata missing category');
          if(!q.metadata.questType)errors.push(where+' metadata missing questType');
          if(!q.metadata.objectiveText)errors.push(where+' metadata missing objectiveText');
          if(!q.metadata.objectiveLocation)errors.push(where+' metadata missing objectiveLocation');
          if(!q.metadata.turnInText)errors.push(where+' metadata missing turnInText');
          if(!q.metadata.turnInLocation)errors.push(where+' metadata missing turnInLocation');
          if(!q.metadata.turnInAction||!q.metadata.turnInAction.type)errors.push(where+' metadata missing turnInAction');
        }
      });
    }
    return errors;
  }
  function npcChainKey(giver){ return String(giver||'').trim(); }
  function npcChain(chains,giver){ return chains&&chains[npcChainKey(giver)]||[]; }
  function authoredNpcQuestTarget(def){
    if(!def||typeof def!=='object')return undefined;
    if(def.item!=null)return def.item;
    if(def.utility!=null)return def.utility;
    if(def.familiar!=null)return def.familiar;
    return def.mount;
  }
  function buildRuntimeNpcQuest(def,context={}){
    if(!def||typeof def!=='object')return null;
    const giver=npcChainKey(context.giver),step=Math.max(0,context.step|0),total=Math.max(step+1,context.total|0||step+1);
    if(!giver)return null;
    const meta=def.metadata||metadataForQuest(def,giver);
    const targetValue=authoredNpcQuestTarget(def);
    const textTarget=typeof targetValue==='string'?targetValue:targetValue?'the listed supplies':'the objective';
    const quest={
      source:'npc',giver,role:cleanRole(context.role),chainKey:giver,chainStep:step,chainTotal:total,
      chainTitle:String(def.title||'Town Work'),title:String(def.title||'Town Work'),type:def.type,need:Math.max(1,def.need|0),have:Math.max(0,context.have|0),
      category:meta.category,questType:meta.questType,objectiveText:meta.objectiveText,objectiveLocation:meta.objectiveLocation,
      objectiveAction:meta.objectiveAction||null,turnInText:meta.turnInText,turnInLocation:meta.turnInLocation,turnInAction:meta.turnInAction,
      gold:Math.max(0,context.gold|0),xp:Math.max(0,context.xp|0),
      desc:String(def.desc||(def.type==='fetch'?`Bring ${def.need} of ${textTarget}.`:`Complete ${def.need} ${def.type} objective${def.need===1?'':'s'}.`)).replace(/\{N\}/g,String(def.need|0)),
      rewardItems:rewardItemsCopy(def.rewardItems),
      lifecycleState:String(context.lifecycleState||'offered'),
      offeredAt:Math.max(0,Number(context.offeredAt)||Number(context.now)||Date.now()),
      acceptedAt:Math.max(0,Number(context.acceptedAt)||0),
      claimableAt:Math.max(0,Number(context.claimableAt)||0),
      completedAt:Math.max(0,Number(context.completedAt)||0),
      expiresAt:Math.max(0,Number(context.expiresAt)||0)
    };
    if((def.levelTarget|0)>0)quest.levelTarget=def.levelTarget|0;
    if(def.gateRank!=null)quest.gateRank=Math.max(0,Math.min(4,def.gateRank|0));
    if(typeof def.item==='number')quest.item=def.item;
    if(def.type==='utility')quest.utility=def.utility||def.item;
    if(def.type==='familiar')quest.familiar=def.familiar||def.item;
    if(def.type==='mount'||def.type==='mount_use')quest.mount=def.mount||def.item;
    quest.have=Math.max(0,Math.min(quest.need,quest.have|0));
    return quest;
  }
  function runtimeQuestMatchesDefinition(q,def,giver,step,total){
    if(!q||!def)return false;
    if(npcChainKey(q.giver)!==npcChainKey(giver))return false;
    if((q.chainStep|0)!==(step|0))return false;
    if((q.chainTotal|0)!==(total|0))return false;
    if(q.type!==def.type)return false;
    if(String(q.title||q.chainTitle||'')!==String(def.title||''))return false;
    if((q.need|0)!==(def.need|0))return false;
    if(typeof def.item==='number'&&(q.item|0)!==def.item)return false;
    if(def.type==='gate'&&((q.gateRank|0)!==(def.gateRank|0)))return false;
    if(def.type==='utility'&&String(q.utility||'')!==String(def.utility||def.item||''))return false;
    if(def.type==='familiar'&&String(q.familiar||'')!==String(def.familiar||def.item||''))return false;
    if((def.type==='mount'||def.type==='mount_use')&&String(q.mount||'')!==String(def.mount||def.item||''))return false;
    return true;
  }
  return {createNpcQuestChains,validateNpcQuestChains,metadataForQuest,authoredNpcQuestTarget,buildRuntimeNpcQuest,runtimeQuestMatchesDefinition,npcChainKey,npcChain};
});
