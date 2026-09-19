(function exposeRecipeSystem(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.BlockcraftRecipeSystem=api;
})(typeof globalThis!=='undefined'?globalThis:this,function recipeSystemFactory(){
  'use strict';

  function createRecipeCatalog(B,I){
    if(!B||!I)throw new Error('Recipe catalogue requires block and item ids');
    const recipes=[];
    const food=new Set([I.BREAD,I.COOKED_MEAT,I.HEARTY_SANDWICH,I.GOLDEN_BROTH,I.TRAIL_RATION,I.FEAST_PLATTER,I.COOKED_SMALL_FISH,I.COOKED_RIVER_FISH,I.COOKED_PRIZED_FISH,I.COOKED_TROPHY_FISH,I.POT_ALE,I.POT_STEW,I.POT_MANA,I.POT_SWIFT,I.POT_STONE]);
    const companions=new Set([I.DRAGON_TREAT,I.SHADOW_SIGIL,I.FANG_TOTEM,I.MOTE_CHARM,I.FORAGE_CHARM]);
    const tools=new Set([I.REPAIR_KIT,I.HIDE_ARMOR,I.CHAIN_ARMOR,I.IRON_ARMOR,I.DIA_ARMOR,I.APPRENTICE_ROBE,I.ARCWEAVE_ROBE,I.STORMGLASS_ARMOR,I.STORMWEAVE_ROBE]);
    for(const material of ['WOOD','STONE','IRON','DIA'])for(const kind of ['PICK','AXE','SHOVEL','SWORD','HOE'])tools.add(I[material+'_'+kind]);
    const basics=new Set([B.PLANKS,B.TABLE,B.FURNACE,B.CHEST,B.TORCH,B.LANTERN,B.CAMPFIRE,B.BED,I.STICK]);
    const categoryFor=out=>companions.has(out)?'companions':tools.has(out)?'tools':food.has(out)?'food':basics.has(out)?'basics':'building';
    const professionFor=(out,category)=>category==='food'?'cook':category==='tools'?'blacksmith':companions.has(out)?'pet_tamer':'';
    const add=(recipe,meta={})=>{
      const out=recipe.out[0],category=meta.category||categoryFor(out),variant=recipes.filter(entry=>entry.out[0]===out).length+1;
      const hunterLevel=Math.max(0,recipe.hunterLevel|0);
      recipes.push(Object.freeze({
        ...recipe,
        recipeId:meta.recipeId||('craft_'+out+'_'+variant),
        station:meta.station||((recipe.shapeless&&recipe.shapeless.length>4)||(recipe.shape&&Math.max(recipe.shape.length,...recipe.shape.map(row=>row.length))>2)?'crafting_table':'crafting'),
        category,
        profession:meta.profession===undefined?professionFor(out,category):meta.profession,
        source:meta.source||(hunterLevel?'level_unlock':'known'),
        tags:Object.freeze([...(meta.tags||[])]),
        unlock:Object.freeze(hunterLevel?{hunterLevel}:{})
      }));
    };

    add({shapeless:[B.LOG],out:[B.PLANKS,4]},{recipeId:'planks_from_log'});
    add({shape:['P','P'],keys:{P:B.PLANKS},out:[I.STICK,4]},{recipeId:'sticks_from_planks'});
    add({shape:['PP','PP'],keys:{P:B.PLANKS},out:[B.TABLE,1]},{recipeId:'crafting_table'});
    add({shape:['CCC','C.C','CCC'],keys:{C:B.COBBLE},out:[B.FURNACE,1]},{recipeId:'furnace'});
    add({shape:['SS','SS'],keys:{S:B.STONE},out:[B.BRICK,4]},{recipeId:'brick'});
    add({shapeless:[B.SAND,B.SAND,B.COBBLE,B.COBBLE],out:[B.CONCRETE,4]},{recipeId:'concrete'});
    add({shapeless:[B.RED_SAND,B.RED_SAND,B.COBBLE,B.COBBLE],out:[B.TERRACOTTA,4]},{recipeId:'terracotta'});
    add({shape:['SS','SS'],keys:{S:B.SNOW},out:[B.ICE,1]},{recipeId:'packed_ice'});
    add({shape:['c','s'],keys:{c:I.COAL,s:I.STICK},out:[B.TORCH,8]},{recipeId:'coal_torches'});
    add({shape:['c','s'],keys:{c:I.CHARCOAL,s:I.STICK},out:[B.TORCH,8]},{recipeId:'charcoal_torches'});
    add({shapeless:[B.TORCH,I.IRON_INGOT],out:[B.LANTERN,1]},{recipeId:'lantern'});
    add({shapeless:[I.STICK,I.STICK,B.LOG,I.COAL],out:[B.CAMPFIRE,1]},{recipeId:'coal_campfire'});
    add({shapeless:[I.STICK,I.STICK,B.LOG,I.CHARCOAL],out:[B.CAMPFIRE,1]},{recipeId:'charcoal_campfire'});
    add({shapeless:[I.IRON_INGOT,I.STICK,B.PLANKS],out:[I.REPAIR_KIT,1]},{recipeId:'repair_kit'});
    add({shape:['LLL','PPP'],keys:{L:B.LEAVES,P:B.PLANKS},out:[B.BED,1]},{recipeId:'bed'});
    add({shape:['PPP','P P','PPP'],keys:{P:B.PLANKS},out:[B.CHEST,1]},{recipeId:'chest'});
    add({shape:['..s','.sW','s..'],keys:{s:I.STICK,W:I.WHEAT},out:[I.FISHING_ROD,1]},{recipeId:'fishing_rod',category:'tools'});
    add({shapeless:[I.BREAD,I.COOKED_MEAT],out:[I.HEARTY_SANDWICH,1]},{recipeId:'meat_sandwich'});
    add({shapeless:[I.BREAD,I.COOKED_RIVER_FISH],out:[I.HEARTY_SANDWICH,1]},{recipeId:'river_fish_sandwich'});
    add({shapeless:[I.COOKED_SMALL_FISH,I.COOKED_SMALL_FISH,I.WHEAT],out:[I.GOLDEN_BROTH,1],hunterLevel:5},{recipeId:'small_fish_broth'});
    add({shapeless:[I.COOKED_PRIZED_FISH,I.BREAD,I.WHEAT],out:[I.TRAIL_RATION,1],hunterLevel:10},{recipeId:'prized_fish_ration'});
    add({shapeless:[I.COOKED_TROPHY_FISH,I.GOLDEN_WHEAT,I.BREAD],out:[I.FEAST_PLATTER,1],hunterLevel:20},{recipeId:'trophy_fish_feast'});
    add({shape:['WWW'],keys:{W:I.WHEAT},out:[I.BREAD,1]},{recipeId:'bread'});
    add({shapeless:[I.COOKED_MEAT,I.COOKED_MEAT,I.COAL],out:[I.DRAGON_TREAT,2]},{recipeId:'meat_dragon_treat'});
    add({shapeless:[I.COAL,I.COAL,I.COAL,I.DIAMOND],out:[I.SHADOW_SIGIL,1],hunterLevel:5},{recipeId:'shadow_sigil'});
    add({shapeless:[I.MONSTER_MEAT,I.MONSTER_MEAT,I.IRON_INGOT,I.STICK],out:[I.FANG_TOTEM,1],hunterLevel:10},{recipeId:'fang_totem'});
    add({shapeless:[I.BREAD,I.WHEAT,I.WHEAT,I.DIAMOND],out:[I.MOTE_CHARM,1],hunterLevel:8},{recipeId:'lifebloom_charm'});
    add({shapeless:[I.WHEAT,I.WHEAT,I.COAL,I.IRON_INGOT],out:[I.FORAGE_CHARM,1],hunterLevel:8},{recipeId:'forager_charm'});
    add({shapeless:[I.WHEAT,I.WHEAT,I.COOKED_MEAT,I.CHARCOAL],out:[I.DRAGON_TREAT,3]},{recipeId:'farm_dragon_treat'});
    add({shapeless:[I.WINDSEED,I.WHEAT,I.WHEAT],out:[I.BREAD,2]},{recipeId:'windseed_bread'});
    add({shapeless:[I.HEARTWOOD_RESIN,I.BREAD,I.COOKED_MEAT],out:[I.HEARTY_SANDWICH,2]},{recipeId:'heartwood_sandwich'});
    add({shapeless:[I.SUNSHARD,B.SAND,B.SAND],out:[B.GLASS,4]},{recipeId:'sunshard_glass'});
    add({shapeless:[I.MESA_AMBER,I.IRON_INGOT,I.STICK],out:[I.REPAIR_KIT,2]},{recipeId:'amber_repair_kits'});
    add({shapeless:[I.FROST_CRYSTAL,B.SNOW,B.SNOW],out:[B.ICE,4]},{recipeId:'frost_crystal_ice'});
    add({shapeless:[I.MIRE_BLOOM,I.COOKED_MEAT,I.CHARCOAL],out:[I.DRAGON_TREAT,2]},{recipeId:'mire_dragon_treat'});
    add({shapeless:[I.RAINWAKE_PETAL,I.WHEAT,I.COOKED_MEAT],out:[I.GOLDEN_BROTH,2],hunterLevel:5},{recipeId:'rainwake_broth'});
    add({shapeless:[I.STORMGLASS,I.IRON_INGOT,I.COAL],out:[I.REPAIR_KIT,3]},{recipeId:'stormglass_repair_kits'});
    add({shapeless:[I.SOLAR_GLYPH,I.SUNSHARD,B.GLASS],out:[I.SUNSHARD,3]},{recipeId:'solar_sunshards'});
    add({shapeless:[B.LEAVES,I.WHEAT,I.CHARCOAL],out:[I.COMPOST,2]},{recipeId:'charcoal_compost'});
    add({shapeless:[I.GOLDEN_WHEAT,I.BREAD,I.COOKED_MEAT],out:[I.HEARTY_SANDWICH,3]},{recipeId:'golden_sandwiches'});
    add({shapeless:[I.WHEAT,I.BREAD,I.COOKED_MEAT],out:[I.GOLDEN_BROTH,1],hunterLevel:5},{recipeId:'field_broth'});
    add({shapeless:[I.WINDSEED,I.HEARTY_SANDWICH,I.COOKED_MEAT],out:[I.TRAIL_RATION,2],hunterLevel:10},{recipeId:'windseed_rations'});
    add({shapeless:[I.GOLDEN_WHEAT,I.GOLDEN_BROTH,I.TRAIL_RATION,I.HEARTY_SANDWICH],out:[I.FEAST_PLATTER,1],hunterLevel:20},{recipeId:'master_feast'});
    add({shapeless:[I.GEODE],out:[I.DIAMOND,1]},{recipeId:'crack_geode'});

    const materialItems={WOOD:B.PLANKS,STONE:B.COBBLE,IRON:I.IRON_INGOT,DIA:I.DIAMOND};
    for(const material of Object.keys(materialItems)){
      const M=materialItems[material],s=I.STICK,hunterLevel=material==='DIA'?21:0,gate=hunterLevel?{hunterLevel}:{};
      add({shape:['MMM','.s.','.s.'],keys:{M,s},out:[I[material+'_PICK'],1],...gate},{recipeId:material.toLowerCase()+'_pick'});
      add({shape:['MM','Ms','.s'],keys:{M,s},out:[I[material+'_AXE'],1],mirror:true,...gate},{recipeId:material.toLowerCase()+'_axe'});
      add({shape:['M','s','s'],keys:{M,s},out:[I[material+'_SHOVEL'],1],...gate},{recipeId:material.toLowerCase()+'_shovel'});
      add({shape:['M','M','s'],keys:{M,s},out:[I[material+'_SWORD'],1],...gate},{recipeId:material.toLowerCase()+'_sword'});
      add({shape:['MM','.s','.s'],keys:{M,s},out:[I[material+'_HOE'],1],mirror:true,...gate},{recipeId:material.toLowerCase()+'_hoe'});
    }
    add({shape:['M.M','MMM','MMM'],keys:{M:I.MONSTER_MEAT},out:[I.HIDE_ARMOR,1]},{recipeId:'hide_armor'});
    add({shape:['W.W','WWW','WWW'],keys:{W:I.WHEAT},out:[I.APPRENTICE_ROBE,1]},{recipeId:'apprentice_robe'});
    add({shape:['I.I','ICI','III'],keys:{I:I.IRON_INGOT,C:I.COAL},out:[I.CHAIN_ARMOR,1]},{recipeId:'chain_armor'});
    add({shape:['W.W','WGW','WWW'],keys:{W:I.WHEAT,G:I.GEODE},out:[I.ARCWEAVE_ROBE,1]},{recipeId:'arcweave_robe'});
    add({shape:['M.M','MMM','MMM'],keys:{M:I.IRON_INGOT},out:[I.IRON_ARMOR,1]},{recipeId:'iron_armor'});
    add({shape:['M.M','MMM','MMM'],keys:{M:I.DIAMOND},out:[I.DIA_ARMOR,1],hunterLevel:21},{recipeId:'diamond_armor'});
    add({shape:['S.S','SDS','SSS'],keys:{S:I.STORMGLASS,D:I.DIAMOND},out:[I.STORMGLASS_ARMOR,1],hunterLevel:31},{recipeId:'stormglass_armor'});
    add({shape:['S.S','SGS','SSS'],keys:{S:I.STORMGLASS,G:I.SOLAR_GLYPH},out:[I.STORMWEAVE_ROBE,1],hunterLevel:31},{recipeId:'stormweave_robe'});

    // Expansion: alternate paths use existing exploration, fishing, farming and
    // Ancient City materials without introducing save-data migrations.
    add({shapeless:[I.BREAD,I.COOKED_SMALL_FISH,I.COOKED_SMALL_FISH],out:[I.HEARTY_SANDWICH,1]},{recipeId:'small_fish_sandwich',tags:['fishing','alternative']});
    add({shapeless:[I.BREAD,I.COOKED_PRIZED_FISH],out:[I.HEARTY_SANDWICH,2],hunterLevel:5},{recipeId:'prized_fish_sandwiches',tags:['fishing','alternative']});
    add({shapeless:[I.COOKED_RIVER_FISH,I.WHEAT,I.RAINWAKE_PETAL],out:[I.GOLDEN_BROTH,2],hunterLevel:5},{recipeId:'river_rainwake_broth',tags:['fishing','regional']});
    add({shapeless:[I.COOKED_MEAT,I.GOLDEN_BROTH,I.BREAD],out:[I.TRAIL_RATION,1],hunterLevel:10},{recipeId:'meat_trail_ration',tags:['gate_prep','alternative']});
    add({shapeless:[I.COOKED_PRIZED_FISH,I.WINDSEED,I.BREAD],out:[I.TRAIL_RATION,2],hunterLevel:10},{recipeId:'prized_windseed_rations',tags:['fishing','regional']});
    add({shapeless:[I.COOKED_TROPHY_FISH,I.GOLDEN_WHEAT,I.TRAIL_RATION],out:[I.FEAST_PLATTER,1],hunterLevel:20},{recipeId:'trophy_master_feast',tags:['fishing','master']});
    add({shapeless:[I.COOKED_RIVER_FISH,I.WHEAT,I.CHARCOAL],out:[I.DRAGON_TREAT,2]},{recipeId:'fish_dragon_treats',tags:['fishing','companion']});
    add({shapeless:[B.LEAVES,B.LEAVES,I.WHEAT,I.WHEAT],out:[I.COMPOST,2]},{recipeId:'green_compost',tags:['farming','alternative']});
    add({shapeless:[I.HEARTWOOD_RESIN,B.PLANKS,B.PLANKS,B.PLANKS,B.PLANKS],out:[B.CHEST,1]},{recipeId:'heartwood_chest',tags:['regional','efficient']});
    add({shapeless:[I.MESA_AMBER,I.IRON_INGOT,B.TORCH],out:[B.LANTERN,2]},{recipeId:'amber_lanterns',tags:['regional','lighting']});
    add({shapeless:[I.SUNSHARD,I.STICK],out:[B.TORCH,16]},{recipeId:'sunshard_torches',tags:['regional','lighting']});
    add({shapeless:[I.GEODE,I.STORMGLASS],out:[I.DIAMOND,2],hunterLevel:21},{recipeId:'stormglass_geode',category:'tools',profession:'blacksmith',tags:['regional','conversion']});
    add({shapeless:[I.RELIC_ARMOR_PIECE,I.RELIC_ARMOR_PIECE,I.RELIC_ARMOR_PIECE,I.RELIC_ARMOR_PIECE,I.ECHO_GLYPH,I.STORMGLASS,I.STORMGLASS,I.DIAMOND],out:[I.STORMGLASS_ARMOR,1],hunterLevel:31},{recipeId:'ancient_stormglass_armor',tags:['ancient_city','alternative']});
    add({shapeless:[I.RELIC_ARMOR_PIECE,I.RELIC_ARMOR_PIECE,I.RELIC_ARMOR_PIECE,I.ECHO_GLYPH,I.ECHO_GLYPH,I.SOLAR_GLYPH,I.STORMGLASS],out:[I.STORMWEAVE_ROBE,1],hunterLevel:31},{recipeId:'ancient_stormweave_robe',tags:['ancient_city','alternative']});

    // Brewing containers are reusable: authoritative potion consumption returns
    // the matching empty vessel, while these recipes create the initial supply.
    add({shape:['G.G','.G.'],keys:{G:B.GLASS},out:[I.EMPTY_BOTTLE,3]},{recipeId:'empty_bottles',category:'basics',tags:['brewing','container']});
    add({shape:['P.P','.P.'],keys:{P:B.PLANKS},out:[I.WOODEN_BOWL,4]},{recipeId:'wooden_bowls',category:'basics',tags:['cooking','container']});
    add({shapeless:[I.EMPTY_BOTTLE,I.WHEAT,I.GOLDEN_WHEAT],out:[I.POT_ALE,1],hunterLevel:2},{recipeId:'frothy_ale',category:'food',profession:'cook',tags:['brewing','stamina']});
    add({shapeless:[I.WOODEN_BOWL,I.COOKED_MEAT,I.WHEAT],out:[I.POT_STEW,1],hunterLevel:3},{recipeId:'hearty_stew',category:'food',profession:'cook',tags:['brewing','healing']});
    add({shapeless:[I.EMPTY_BOTTLE,I.FROST_CRYSTAL,I.MIRE_BLOOM],out:[I.POT_MANA,1],hunterLevel:8},{recipeId:'mana_draught',category:'food',profession:'cook',tags:['brewing','mana','regional']});
    add({shapeless:[I.EMPTY_BOTTLE,I.WINDSEED,I.RAINWAKE_PETAL],out:[I.POT_SWIFT,1],hunterLevel:10},{recipeId:'swiftness_tonic',category:'food',profession:'cook',tags:['brewing','speed','regional']});
    add({shapeless:[I.EMPTY_BOTTLE,I.MESA_AMBER,I.HEARTWOOD_RESIN],out:[I.POT_STONE,1],hunterLevel:12},{recipeId:'stoneskin_brew',category:'food',profession:'cook',tags:['brewing','defence','regional']});

    validateRecipeCatalog(recipes);
    return Object.freeze(recipes);
  }

  function validateRecipeCatalog(recipes){
    const ids=new Set(),patterns=new Set();
    for(const recipe of recipes){
      if(!recipe||!recipe.recipeId||ids.has(recipe.recipeId))throw new Error('Invalid or duplicate recipe id: '+String(recipe&&recipe.recipeId));
      ids.add(recipe.recipeId);
      if(!Array.isArray(recipe.out)||recipe.out.length!==2||!(recipe.out[0]>=0)||!(recipe.out[1]>0))throw new Error('Invalid recipe output: '+recipe.recipeId);
      const ingredientCount=recipe.shapeless?recipe.shapeless.length:(recipe.shape||[]).join('').replace(/[. ]/g,'').length;
      if(ingredientCount<1||ingredientCount>9)throw new Error('Invalid ingredient count: '+recipe.recipeId);
      if(recipe.hunterLevel!=null&&recipe.hunterLevel<1)throw new Error('Invalid Hunter level: '+recipe.recipeId);
      const ingredients=recipe.shapeless||Object.values(recipe.keys||{});
      if(ingredients.some(id=>!Number.isInteger(id)||id<1))throw new Error('Invalid ingredient id: '+recipe.recipeId);
      const pattern=recipe.shapeless
        ? 'free:'+recipe.shapeless.slice().sort((a,b)=>a-b).join(',')
        : 'shape:'+recipe.shape.join('/')+':'+Object.entries(recipe.keys).sort(([a],[b])=>a.localeCompare(b)).map(([key,id])=>key+'='+id).join(',')+':'+(recipe.mirror?'mirror':'fixed');
      if(patterns.has(pattern))throw new Error('Ambiguous recipe ingredients: '+recipe.recipeId);
      patterns.add(pattern);
    }
    return true;
  }

  return Object.freeze({createRecipeCatalog,validateRecipeCatalog});
});
