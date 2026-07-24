(function exposeAbilityProgression(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.BlockcraftAbilityProgression=api;
})(typeof globalThis!=='undefined'?globalThis:this,function abilityProgressionFactory(){
  'use strict';
  const RANK_LEVELS=Object.freeze([1,11,21,31,41,51]);
  const RANKS=Object.freeze(['E','D','C','B','A','S']);
  const SPECIALIZATIONS=Object.freeze({
    shadow:Object.freeze({assassin:Object.freeze({name:'Assassin',desc:'Empowers Shadow Dash and Umbral Edge.'}),commander:Object.freeze({name:'Commander',desc:'Expands the army and reduces boss-shadow upkeep.'})}),
    guardian:Object.freeze({juggernaut:Object.freeze({name:'Juggernaut',desc:'Improves personal durability, impact, and knockback.'}),warden:Object.freeze({name:'Warden',desc:'Extends protection and control to nearby allies.'})}),
    mage:Object.freeze({elementalist:Object.freeze({name:'Elementalist',desc:'Strengthens burning, freezing, and chaining effects.'}),arcanist:Object.freeze({name:'Arcanist',desc:'Improves mana efficiency, cooldowns, and spell combinations.'})}),
    verdant:Object.freeze({grovekeeper:Object.freeze({name:'Grovekeeper',desc:'Strengthens healing and turns roots into safe ground for allies.'}),nightstalker:Object.freeze({name:'Nightstalker',desc:'Extends Panther Form and sharpens its hunting strikes.'})}),
  });
  const EVOLUTION=Object.freeze({
    shadow:Object.freeze(['Awaken Shadow Dash','Unlock Umbral Edge','Unlock Arise and choose a specialization','Dash charges; Umbral kills extend duration','Unlock Shadow Exchange','Unlock Monarch\'s Domain']),
    guardian:Object.freeze(['Awaken Iron Skin','Unlock Shockwave','Unlock Second Wind and choose a specialization','Gain stagger immunity, projectile guard, and stamina recovery','Unlock Fortress','Unlock Unbreakable']),
    mage:Object.freeze(['Awaken Fireball','Unlock Frost Nova','Unlock Lightning and choose a specialization','Gain burning ground, freezing, and extra chains','Unlock Elemental Resonance','Unlock Arcane Overload']),
    verdant:Object.freeze(['Awaken Verdant Mend','Unlock Rootsnare','Unlock Panther Form and choose a specialization','Mends add regeneration; Panther strikes restore momentum','Unlock Ancient Bloom','Unlock Avatar of the Wild']),
  });
  const IMPLEMENTED_RANKS=Object.freeze([true,true,true,false,false,false]);
  function rankForLevel(level){let rank=0;for(let i=1;i<RANK_LEVELS.length;i++)if((level|0)>=RANK_LEVELS[i])rank=i;return rank;}
  function validSpecialization(path,spec){return !!(SPECIALIZATIONS[path]&&SPECIALIZATIONS[path][spec]);}
  return Object.freeze({RANK_LEVELS,RANKS,SPECIALIZATIONS,EVOLUTION,IMPLEMENTED_RANKS,rankForLevel,validSpecialization});
});
