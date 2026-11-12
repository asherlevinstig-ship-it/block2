import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeState} from '../server/player-state.mjs';import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';import {advanceServerCombat} from '../server/activities.mjs';
import {guardianRelics,awardGuardianRelic,guardianRelicProgress} from '../public/guardian-relics.js';import {combatBuild,essenceManaCost} from '../public/combat-builds.js';import {huntingTurn,normalizeHunting,createHunt} from '../public/hunting.js';import {castEssencePower} from '../server/essences.mjs';import {normalizeMagic,essencePower} from '../public/essences.js';import {arenaMoveEvent} from '../public/dungeon-arena.js';import {createTrainingSession} from '../public/training.js';import {boot} from './helpers/game-client.mjs';import {clothingCatalog,clothingArt} from '../public/wardrobe.js';
import {nextCombatTactic} from '../public/character-rules.js';
function state(){return normalizeState({location:'clearing',position:{x:5,y:5},stats:{strengthXp:1000,agilityXp:1000,vitalityXp:1000}});}
function wear(s,...ids){for(const id of ids){s.wardrobe.owned.push(id);s.wardrobe.outfits[0][clothingCatalog[id].slot]=id;}return s;}
function fight(s,now=1000){applyGameplayAction(s,'fight',{},now,()=>.5);return s.hunting.encounter;}
test('each guardian awards its own clothing by the fifth victory, with no duplicates or shared pity',()=>{
 const s=state();for(const [id,r] of Object.entries(guardianRelics)){
  for(let n=0;n<4;n++){assert.equal(awardGuardianRelic(s,r.enemy,()=>.99),null);assert.equal(guardianRelicProgress(s,id).remaining,4-n);}
  const loaded=normalizeState(s);assert.equal(guardianRelicProgress(loaded,id).remaining,1);s.dungeonLoot=loaded.dungeonLoot;
  assert.deepEqual(awardGuardianRelic(s,r.enemy,()=>.99),{item:id,guaranteed:true});assert.equal(guardianRelicProgress(s,id).remaining,0);assert.equal(awardGuardianRelic(s,r.enemy,()=>0),null);assert.equal(s.wardrobe.owned.filter(x=>x===id).length,1);
 }
 assert.equal(awardGuardianRelic(s,'depthsGuardian',()=>0),null);
});
test('an early random drop resets its own progress; forged save rewards and counters are ignored',()=>{
 const s=state();assert(awardGuardianRelic(s,'treasuryGuardian',()=>0));assert.equal(guardianRelicProgress(s,'guardianMantle').misses,0);assert.equal(guardianRelicProgress(s,'thornstepBoots').remaining,5);
 const forged=structuredClone(s);forged.wardrobe.owned.push('runeboundHood');forged.dungeonLoot.guardians.runeboundHood={kills:4,misses:4};const next=protectFishingState(s,forged);assert(!next.wardrobe.owned.includes('runeboundHood'));assert.equal(guardianRelicProgress(next,'runeboundHood').remaining,5);
 assert.throws(()=>normalizeState({...s,dungeonLoot:{...s.dungeonLoot,guardians:{runeboundHood:{kills:1,misses:4}}}}),/relic progress/);
});
test('real guardian victories grant permanent clothing once, while merely entering a room does not',()=>{
 for(const [id,r] of Object.entries(guardianRelics)){
  const room={treasuryGuardian:'depthsTreasury',sealGuardian:'depthsTrial',cacheGuardian:'depthsCache'}[r.enemy];const s=normalizeState({...state(),location:room,depthsRun:{cleared:2,routeChoice:'dangerous'}});s.characterRules.combat.enabled=false;
  assert(!s.wardrobe.owned.includes(id));fight(s);Object.assign(s.hunting.encounter,{health:1,nextPlayerAt:1000,nextBoarAt:100000,arenaEnemy:{x:6,y:5},arenaPlayer:{x:5,y:5}});const events=advanceServerCombat(s,1000,()=>0);assert(events.some(e=>e.clothingDrop===id));assert(s.wardrobe.owned.includes(id));assert.equal(guardianRelicProgress(s,id).kills,1);advanceServerCombat(s,2000,()=>0);assert.equal(guardianRelicProgress(s,id).kills,1);assert(normalizeState(s).wardrobe.owned.includes(id));
 }
});
test('Mantle wards are stronger but combat steps take longer, and unworn pieces have no effect',()=>{
 const s=wear(state(),'guardianMantle');s.magic=normalizeMagic({picks:['fire','ice','shadow'],unlocked:['ice:shield'],slots:{q:'ice:shield'}});fight(s);const build=combatBuild(s),base=essencePower('ice:shield',s.stats,s.magic);const event=castEssencePower(s,1000);assert.equal(event.ward,Math.round(base.value*1.3));
 const plain=state();plain.wardrobe.owned.push('guardianMantle');assert.equal(combatBuild(plain).ward,undefined);
 Object.assign(s,{location:'depthsGallery',depthsRun:{cleared:1,routeChoice:'safe'},position:{x:5,y:5}});Object.assign(s.hunting.encounter,{arenaVersion:1,arenaRoom:'depthsGallery',arenaPlayer:{x:5,y:5},arenaEnemy:{x:8,y:5},arenaStepAt:1000});const move=arenaMoveEvent(s,{x:5,y:6},1000);assert.equal(move.encounter.arenaStepAt,1300);assert.equal(build.move,1.25);
});
test('Thornstep extends real perfect counters while costing two armour and never rewards an Auto dodge',()=>{
 const s=wear(state(),'thornstepBoots'),e=fight(s),plain={...e,buildRelics:[]};const dodged=huntingTurn({...e,dodgeUntil:e.nextBoarAt+100},100,s.stats,'enemy',e.nextBoarAt,()=>.99),normal=huntingTurn({...plain,dodgeUntil:e.nextBoarAt+100},100,s.stats,'enemy',e.nextBoarAt,()=>.99);
 assert(dodged.perfectDodge);assert.equal(dodged.encounter.counterUntil-normal.encounter.counterUntil,800);
 const a=huntingTurn(e,100,s.stats,'enemy',e.nextBoarAt,()=>.99),b=huntingTurn(plain,100,s.stats,'enemy',e.nextBoarAt,()=>.99);assert.equal(a.taken-b.taken,2);
 const auto=huntingTurn({...e,dodgeUntil:e.nextBoarAt+100,autoDodgeUntil:e.nextBoarAt+100},100,s.stats,'enemy',e.nextBoarAt,()=>.99);assert(!auto.perfectDodge);assert.equal(auto.encounter.counterUntil,undefined);
});
test('Runebound Hood enables Spellweaver, spends discounted mana and reduces Renewal healing',()=>{
 const s=wear(state(),'runeboundHood');s.health=10;s.magic=normalizeMagic({picks:['fire','ice','shadow'],unlocked:['fire:renewal','ice:shield'],slots:{q:'fire:renewal',e:'ice:shield'}});fight(s);assert.equal(combatBuild(s).id,'spellweaver');assert.equal(essenceManaCost(s),18);const full=essencePower('fire:renewal',s.stats,s.magic,{spell:1.4}),event=castEssencePower(s,1000);assert.equal(event.healed,Math.round(full.value*.7));assert.equal(s.vitals.mana,82);
});
test('relic effects are locked for the fight, preserved by saves and included in practice',()=>{
 const s=wear(state(),'guardianMantle','thornstepBoots'),e=fight(s);assert.deepEqual(normalizeHunting(s.hunting),s.hunting);s.wardrobe.outfits[0].jacket='amberJacket';assert.equal(combatBuild(s).ward,1.3);assert.equal(combatBuild(normalizeState(s)).counterWindow,800);
 s.hunting.encounter=null;s.wardrobe.outfits[0].jacket='guardianMantle';assert.deepEqual(createTrainingSession(s).encounter.buildRelics,e.buildRelics);assert.throws(()=>normalizeHunting({encounter:{...createHunt(0),buildRelics:['guardianMantle','runeboundHood']}}),/combat relics/);
});
test('Inventory relic journal shows all guardian sources and individual guarantees',()=>{
 const s=state();awardGuardianRelic(s,'treasuryGuardian',()=>.99);const g=boot(s);g.run('renderDungeonLoot()');const cards=g.nodes.get('guardianRelicCollection').children;assert.equal(cards.length,3);assert.match(cards[0].children[1].children[1].textContent,/Ironhide Guardian/);assert.match(cards[0].children[1].children[4].textContent,/1 \/ 5/);for(const id of Object.keys(guardianRelics))assert.match(clothingArt(id),/<svg/);assert.deepEqual(g.errors,[]);
});
test('Auto schedules discounted spells using the same mana cost, and offline replay keeps relic effects',()=>{
 const s=wear(state(),'runeboundHood');s.magic=normalizeMagic({picks:['fire','ice','shadow'],unlocked:['fire:sword'],slots:{q:'fire:sword'}});s.characterRules.combat={...s.characterRules.combat,enabled:true,style:'aggressive',dodge:false,q:true,e:false};const e=fight(s);Object.assign(e,{tacticsAt:1000,nextPlayerAt:100000,nextBoarAt:10000});s.vitals={hunger:100,mana:0,manaAt:1000};
 const tactic=nextCombatTactic(s,1000);assert.equal(tactic.action,'essence');assert.equal(tactic.at,5000);const offline=structuredClone(s);for(let now=1000;now<=6000;now+=100)advanceServerCombat(s,now,()=>.5);advanceServerCombat(offline,6000,()=>.5);for(const key of ['vitals','health','hunting','stats'])assert.deepEqual(s[key],offline[key],key);assert.equal(s.vitals.mana,2);
});
