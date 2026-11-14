import {prepareDungeonBuild} from './helpers/combat-fixtures.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {createHunt,huntingTurn,advanceHunt,normalizeHunting,huntEnemy,enemyAttack,vaultPhase,transitionVaultPhase} from '../public/hunting.js';
import {normalizeState} from '../server/player-state.mjs';import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';import {advanceServerCombat} from '../server/activities.mjs';import {castEssencePower} from '../server/essences.mjs';import {normalizeMagic} from '../public/essences.js';import {depthsSpoils} from '../public/depths.js';import {skillXpForLevel} from '../public/skill-curve.js';import {boot} from './helpers/game-client.mjs';
import {handlePlayerApi} from '../server/player-api.mjs';import {testDatabase} from './db-helper.mjs';
const stats={strengthXp:skillXpForLevel(10),agilityXp:skillXpForLevel(10),vitalityXp:skillXpForLevel(10)};
const turn=(e,action,at,weapon='ironSword')=>huntingTurn(e,100,stats,action,at,()=>.5,weapon);
const veteran=()=>prepareDungeonBuild(normalizeState({location:'depthsVault',position:{x:5,y:5},depthsRun:{cleared:2},stats,combatGear:{ownedWeapons:['ironSword'],equippedWeapon:'ironSword',stonebackVestOwned:true,stonebackVestEquipped:true},dungeonLoot:{clears:4,streak:4,target:'breakerSpear'}}));

test('new boss phases use health thresholds while saved legacy fights retain their old attacks',()=>{
 const e=createHunt(1000,undefined,'depthsGuardian');assert.equal(vaultPhase(e).index,1);assert.equal(enemyAttack(e).name,'Ironclad Smash');assert.equal(e.nextBoarAt,4500);
 for(const [health,phase,armor,attack] of [[161,1,9,'Ironclad Smash'],[160,2,0,'Vault Cleave'],[81,2,0,'Vault Cleave'],[80,3,0,'Heart Bolt']]){
  const saved=normalizeHunting({encounter:{...e,health}}).encounter;assert.equal(vaultPhase(saved).index,phase);assert.equal(huntEnemy(saved).shellArmor,armor);assert.equal(enemyAttack(saved).name,attack);
 }
 const legacy={...e,enemyMove:'aftershock'};delete legacy.bossVersion;assert.equal(vaultPhase(normalizeHunting({encounter:legacy}).encounter),null);assert.equal(enemyAttack(legacy).name,'Aftershock');
 assert.throws(()=>normalizeHunting({encounter:{...e,bossVersion:2}}),/Invalid boss/);
});

test('damage changes phase once, cancels the old pattern and provides transition time plus a fresh warning',()=>{
 const e={...createHunt(1000,161,'depthsGuardian'),stagger:0,nextBoarAt:1600};
 const hit=turn(e,'attack',1450,'breakerSpear');assert.equal(hit.phaseChange.index,2);assert.equal(hit.encounter.bossPhaseAt,1450);assert.equal(hit.encounter.nextBoarAt,3950);assert.equal(hit.encounter.enemyMove,undefined);
 assert.equal(normalizeHunting({encounter:hit.encounter}).encounter.bossPhaseAt,1450);
 const again=turn({...hit.encounter,nextPlayerAt:1500},'attack',1500);assert.equal(again.phaseChange,undefined);assert.equal(again.encounter.nextBoarAt,3950);
 const delayed=transitionVaultPhase({encounter:{...e,health:160,nextBoarAt:10000}},e,1450);assert.equal(delayed.encounter.nextBoarAt,10000);
 const lethal=turn({...e,health:1},'attack',1450);assert.equal(lethal.outcome,'victory');assert.equal(lethal.phaseChange,undefined);
});

test('armour breaks only through an opening; phase-two counters exploit the duelist weakness',()=>{
 const armoured=createHunt(1000,undefined,'depthsGuardian');const guarded=turn(armoured,'attack',1450);assert.equal(guarded.shellGuarded,true);
 const cracked=turn({...armoured,stagger:159},'attack',1450,'breakerSpear');assert.equal(cracked.staggered,true);assert(cracked.encounter.exposedUntil>1450);
 const duel={...armoured,health:160};const dodge=turn(duel,'dodge',4350,'duelistBlade'),perfect=turn(dodge.encounter,'enemy',4500,'duelistBlade');assert.equal(perfect.perfectDodge,true);assert.equal(enemyAttack(perfect.encounter).name,'Vault Lunge');
 const counter=turn(perfect.encounter,'attack',4600,'duelistBlade');assert(counter.duelistBonus>0);assert.equal(counter.shellGuarded,undefined);
});

test('magic phase alternates a charged bolt and blast; three quick hits interrupt only the bolt',()=>{
 let e=createHunt(1000,80,'depthsGuardian');e.nextBoarAt=4500;
 const quickHit=(next,at)=>huntingTurn(next,100,{},'attack',at,()=>.5,'quickfang');
 for(const at of [2150,2700])e=quickHit(e,at).encounter;
 const interrupted=quickHit(e,3250);assert.equal(interrupted.castInterrupted,true);assert.equal(interrupted.encounter.nextBoarAt,7450);
 const bolt=turn(createHunt(1000,80,'depthsGuardian'),'enemy',4500);assert.equal(bolt.attackShape,'bolt');assert.equal(enemyAttack(bolt.encounter).name,'Runic Blast');
 const blast=turn(bolt.encounter,'enemy',bolt.encounter.nextBoarAt);assert.equal(blast.attackShape,'ring');assert.equal(enemyAttack(blast.encounter).name,'Heart Bolt');
});

test('burn and direct spell damage trigger the same phase transition without granting early rewards',()=>{
 const e={...createHunt(1000,161,'depthsGuardian'),burn:{damage:3,nextAt:1100,until:3000}};
 const burn=advanceHunt(e,100,stats,1100,()=>.5);assert.equal(burn.phaseChange.index,2);assert.equal(burn.encounter.nextBoarAt,4500);
 const s=veteran();s.hunting.encounter=createHunt(1000,81,'depthsGuardian');s.magic=normalizeMagic({picks:['fire','ice','shadow'],unlocked:['fire:sword'],slots:{q:'fire:sword',e:null}});
 const spell=castEssencePower(s,1100);assert.equal(spell.phaseChange.index,3);assert.equal(s.depthsRun.cleared,2);assert.equal(s.dungeonLoot.clears,4);
});

test('offline replay matches polling across both transitions and pays the complete haul and relic once',()=>{
 const online=veteran();applyGameplayAction(online,'fight',{},1000,()=>.5);const offline=structuredClone(online);
 for(let at=1000;at<=60000;at+=100)advanceServerCombat(online,at,()=>.5);advanceServerCombat(offline,60000,()=>.5);
 for(const key of ['health','stats','depthsRun','hunting','dungeonLoot']){if(key==='dungeonLoot'){assert.equal(offline[key].clears,online[key].clears);continue;}assert.deepEqual(offline[key],online[key]);}
 assert.equal(online.combatReports.at(-1).outcome,'victory');assert.equal(online.depthsRun.vaultWeapon,'breakerSpear');assert.equal(online.dungeonLoot.clears,5);assert.equal(online.combatReports.at(-1).rewards.held.gold,45);assert.equal(online.credits,100);
 assert.deepEqual(depthsSpoils(online.depthsRun),{gold:81,loot:{boar:1,stonebackShell:2,moonwellShard:1}});
 advanceServerCombat(online,120000,()=>0);assert.equal(online.dungeonLoot.clears,5);
 const forged=protectFishingState(online,{...online,depthsRun:{...online.depthsRun,victorySeen:true,vaultWeapon:'quickfang'}});assert.equal(forged.depthsRun.victorySeen,undefined);assert.equal(forged.depthsRun.vaultWeapon,'breakerSpear');
 applyGameplayAction(online,'vaultVictoryAck',{},120000);applyGameplayAction(online,'vaultVictoryAck',{},120001);assert.equal(normalizeState(online).depthsRun.victorySeen,true);assert.equal(online.credits,100);
});

test('legacy saves without a physical chest keep their victory reveal and persistent dismissal',async()=>{
 const s=veteran();applyGameplayAction(s,'fight',{},1000,()=>.5);advanceServerCombat(s,60000,()=>.5);
 delete s.depthsRun.rewardChests;const game=boot(s);assert.equal(game.nodes.get('vaultVictoryDialog').open,true);assert.equal(game.nodes.get('vaultVictoryGold').textContent,'81 gold');assert.match(game.nodes.get('vaultVictoryRelic').textContent,/Breaker Spear/);assert.match(game.nodes.get('vaultVictoryMaterials').textContent,/Moonwell Shard/);
 await game.run('closeVaultVictory()');assert.equal(game.nodes.get('vaultVictoryDialog').open,false);assert.equal(game.read('depthsRun.victorySeen'),true);assert.deepEqual(game.errors,[]);
 const reloaded=boot({...s,depthsRun:{...s.depthsRun,victorySeen:true}});assert.notEqual(reloaded.nodes.get('vaultVictoryDialog').open,true);
});

test('retried victory acknowledgments and banking keep one relic and pay the haul once',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());const origin='https://tower.test';
 const response=await handlePlayerApi(new Request(origin+'/api/player/session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({legacy:veteran()})}),{TOWER_DB:db});
 let packet=await response.json();const cookie=response.headers.get('set-cookie').split(';')[0],state=veteran();applyGameplayAction(state,'fight',{},1000,()=>.5);advanceServerCombat(state,60000,()=>.5);
 sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(state),packet.characterKey);
 async function action(name,body){const result=await handlePlayerApi(new Request(origin+'/api/player/gameplay/'+name,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({...body,characterKey:packet.characterKey})}),{TOWER_DB:db});assert.equal(result.status,200);packet=await result.json();return packet.state;}
 const ack={revision:packet.revision,operation:crypto.randomUUID()};await action('vaultVictoryAck',ack);await action('vaultVictoryAck',ack);assert.equal(packet.state.depthsRun.victorySeen,true);assert.equal(packet.state.credits,100);
 const bank={revision:packet.revision,operation:crypto.randomUUID()};await action('bank',bank);await action('bank',bank);assert.equal(packet.state.credits,181);assert.equal(packet.state.huntingLoot.moonwellShard,1);assert.equal(packet.state.combatGear.ownedWeapons.filter(id=>id==='breakerSpear').length,1);assert.equal(packet.state.dungeonLoot.clears,5);assert.equal(packet.state.depthsRun,null);
});
