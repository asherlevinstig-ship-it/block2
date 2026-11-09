import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeState} from '../server/player-state.mjs';import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';import {advanceServerCombat} from '../server/activities.mjs';import {normalizeCharacterRules,nextCombatTactic,incomingCombatDamage} from '../public/character-rules.js';import {normalizeMagic} from '../public/essences.js';import {normalizeHunting} from '../public/hunting.js';import {autoStatus} from '../public/auto-mode.js';import {boot} from './helpers/game-client.mjs';
function fighter(style='balanced',extra={}){
 const s=normalizeState({location:'clearing',position:{x:5,y:5},characterRules:{combat:{enabled:true,style,dodge:true,q:false,e:false,fleeBelow:0}},...extra});applyGameplayAction(s,'fight',{},1000,()=>.5);return s;
}
const heal=s=>{s.magic=normalizeMagic({picks:['fire','ice','shadow'],unlocked:['eclipse:renewal'],slots:{q:'eclipse:renewal',e:null}});s.characterRules.combat.q=true;};

test('styles and automatic dodge flags normalize safely and old characters retain optional defense off',()=>{
 assert.equal(normalizeCharacterRules().combat.style,'balanced');assert.equal(normalizeCharacterRules().combat.dodge,false);
 for(const combat of [{style:'reckless'},{style:null},{dodge:1}])assert.throws(()=>normalizeCharacterRules({combat}),/Invalid combat tactics/);
 const s=fighter('cautious');assert.equal(normalizeState(s).characterRules.combat.style,'cautious');assert.equal(normalizeState(s).characterRules.combat.dodge,true);
});

test('Cautious dodges normal warnings; Balanced saves stamina for threats; Aggressive saves it for lethal hits',()=>{
 const cautious=fighter('cautious');assert.equal(nextCombatTactic(cautious).action,'dodge');assert.equal(nextCombatTactic(cautious).at,2020);
 const balanced=fighter();assert.equal(nextCombatTactic(balanced),null);balanced.health=30;assert.equal(nextCombatTactic(balanced).action,'dodge');
 const aggressive=fighter('aggressive');aggressive.health=30;assert.equal(nextCombatTactic(aggressive),null);aggressive.health=10;assert.equal(nextCombatTactic(aggressive).action,'dodge');
 aggressive.hunting.encounter.health=1;assert.equal(nextCombatTactic(aggressive),null);cautious.hunting.encounter.health=1;assert.equal(nextCombatTactic(cautious),null);
});

test('automatic dodge spends stamina, avoids the scheduled attack and does not manufacture manual counters',()=>{
 const s=fighter('cautious'),events=advanceServerCombat(s,2300,()=>.5),command=events.find(e=>e.action==='dodge'),avoid=events.find(e=>e.action==='enemy');
 assert.equal(command.automatic,true);assert.equal(command.at,2020);assert.equal(command.encounter.stamina,60);assert.match(command.decision.reason,/Defending/);
 assert.equal(avoid.automaticDodge,true);assert.equal(avoid.taken,0);assert.equal(avoid.perfectDodge,undefined);assert.equal(s.hunting.encounter.counterUntil,undefined);assert.equal(s.hunting.encounter.summary.automaticDodges,1);
 assert.equal(normalizeHunting(s.hunting).encounter.autoDodgeUntil,2370);assert.equal(normalizeHunting(s.hunting).encounter.lastDecision.style,'cautious');
 const manual=fighter();manual.characterRules.combat.enabled=false;applyGameplayAction(manual,'combat',{combatId:manual.combatId,input:'dodge'},2150,()=>.5);advanceServerCombat(manual,2300,()=>.5);assert.equal(manual.hunting.encounter.summary.perfectDodges,1);assert(manual.hunting.encounter.counterUntil>2300);
});

test('defense respects stamina, cooldowns, existing wards and a dodge already covering the strike',()=>{
 const s=fighter('cautious');s.hunting.encounter.stamina=0;s.hunting.encounter.staminaAt=2000;assert.equal(nextCombatTactic(s),null);
 s.hunting.encounter.stamina=100;s.hunting.encounter.nextDodgeAt=2400;assert.equal(nextCombatTactic(s),null);
 s.hunting.encounter.nextDodgeAt=0;s.hunting.encounter.dodgeUntil=2350;assert.equal(nextCombatTactic(s),null);
 const balanced=fighter();balanced.health=10;balanced.hunting.encounter.magicWard=100;balanced.hunting.encounter.magicWardUntil=3000;assert.equal(incomingCombatDamage(balanced),0);assert.equal(nextCombatTactic(balanced),null);
});

test('styles heal at different health levels and healing wins ties against damage',()=>{
 for(const [style,hp,expected] of [['cautious',85,true],['balanced',85,false],['balanced',70,true],['aggressive',70,false],['aggressive',45,true]]){
  const s=fighter(style);s.characterRules.combat.dodge=false;heal(s);s.health=hp;assert.equal(!!nextCombatTactic(s),expected,style+' '+hp);if(expected)assert.match(nextCombatTactic(s).reason,/Healing/);
 }
 const s=fighter();heal(s);s.health=50;s.magic.unlocked.push('fire:sword');s.magic.slots={q:'fire:sword',e:'eclipse:renewal'};s.characterRules.combat.e=true;assert.equal(nextCombatTactic(s).slot,'e');
});

test('Cautious retreats before an unprotected hit crosses its safety line; all styles obey the hard line',()=>{
 const s=fighter('cautious');s.characterRules.combat.dodge=false;s.characterRules.combat.fleeBelow=20;s.health=35;assert.equal(nextCombatTactic(s).action,'flee');assert.match(nextCombatTactic(s).reason,/early/);
 s.characterRules.combat.dodge=true;assert.equal(nextCombatTactic(s).action,'dodge');
 for(const style of ['cautious','balanced','aggressive']){const f=fighter(style);f.characterRules.combat.fleeBelow=20;f.health=20;assert.equal(nextCombatTactic(f).action,'flee');}
 s.characterRules.combat.fleeBelow=0;s.characterRules.combat.dodge=false;assert.equal(nextCombatTactic(s),null);
});

test('the next guaranteed physical cast interrupt avoids wasting Storm or a dodge',()=>{
 const s=fighter('cautious',{location:'depthsCache',depthsRun:{cleared:2}});s.hunting.encounter.castHits=2;s.hunting.encounter.castDeadline=s.hunting.encounter.nextBoarAt;s.hunting.encounter.nextPlayerAt=3500;
 s.magic=normalizeMagic({picks:['fire','ice','storm'],unlocked:['storm:sword'],slots:{q:'storm:sword',e:null}});s.characterRules.combat.q=true;assert.equal(nextCombatTactic(s),null);
 s.hunting.encounter.castHits=1;assert.equal(nextCombatTactic(s).action,'essence');assert.match(nextCombatTactic(s).reason,/Interrupting/);
});

test('online and offline intelligence settle identically without repeated rewards or forged decisions',()=>{
 const online=fighter('cautious'),offline=structuredClone(online),events=[];for(let at=1000;at<=20000;at+=50)events.push(...advanceServerCombat(online,at,()=>.5));const batch=advanceServerCombat(offline,20000,()=>.5);
 for(const key of ['health','hunting','stats','huntingLoot'])assert.deepEqual(online[key],offline[key]);assert.deepEqual(events.map(e=>[e.action,e.at,e.decision]),batch.map(e=>[e.action,e.at,e.decision]));assert.equal(offline.huntingLoot.boar,1);assert(offline.combatReports.at(-1).summary.automaticDodges>0);advanceServerCombat(offline,40000,()=>.5);assert.equal(offline.huntingLoot.boar,1);
 const active=fighter('cautious');advanceServerCombat(active,2020,()=>.5);const forged=protectFishingState(active,{...active,hunting:{encounter:{...active.hunting.encounter,autoDodgeUntil:999999,lastDecision:{at:0,reason:'forged',action:'dodge',style:'aggressive'}}}});assert.deepEqual(forged.hunting,active.hunting);
});

test('Rules exposes saved style and dodge choices and Auto displays its latest decision',()=>{
 const s=fighter('cautious');s.hunting.encounter=null;const g=boot(s);g.run('openAdvancedCharacterRules()');assert.equal(g.nodes.get('rulesCombatStyle').value,'cautious');assert.equal(g.nodes.get('rulesAutoDodge').checked,true);assert.match(g.nodes.get('rulesStyleDescription').textContent,/Heal early/);
 const active=fighter('cautious');advanceServerCombat(active,2020,()=>.5);active.plan={source:'rules',kind:'queue',queue:{steps:[{type:'huntBoars',amount:1}],repeats:1},activeHunt:{},stepIndex:0,cycle:0};assert.match(autoStatus(active).decision,/Defending/);assert.deepEqual(g.errors,[]);
});
