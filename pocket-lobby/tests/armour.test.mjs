import test from 'node:test';import assert from 'node:assert/strict';
import {armourCatalog,armourSelection,armourProfile,combatDodgeCost,normalizeCombatGear,createHunt,huntingTurn} from '../public/hunting.js';
import {normalizeState} from '../server/player-state.mjs';import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';import {skillXpForLevel} from '../public/skill-curve.js';import {incomingCombatDamage} from '../public/character-rules.js';import {advanceServerCombat} from '../server/activities.mjs';import {boot} from './helpers/game-client.mjs';
const veteran=(extra={})=>normalizeState({credits:2000,location:'armory',stats:{vitalityXp:skillXpForLevel(3)},...extra});
test('armour purchases require the Armory, stats and gold, equip without stacking and never charge again',()=>{
 const empty=veteran();applyGameplayAction(empty,'armour',{id:null},500);assert.doesNotThrow(()=>normalizeState(empty));
 const s=veteran();applyGameplayAction(s,'armour',{id:'scoutLeather'},1000);assert.equal(s.credits,1820);assert.equal(armourSelection(s.combatGear),'scoutLeather');
 applyGameplayAction(s,'armour',{id:'towerPlate'},2000);assert.equal(s.credits,1170);assert.equal(armourSelection(s.combatGear),'towerPlate');assert.equal(s.combatGear.stonebackVestEquipped,false);
 applyGameplayAction(s,'armour',{id:'scoutLeather'},3000);assert.equal(s.credits,1170);assert.equal(armourSelection(s.combatGear),'scoutLeather');
 s.location='home';applyGameplayAction(s,'armour',{id:null},4000);assert.equal(armourSelection(s.combatGear),null);applyGameplayAction(s,'armour',{id:'towerPlate'},5000);assert.equal(armourSelection(s.combatGear),'towerPlate');
 assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(s))).combatGear,normalizeCombatGear(s.combatGear));
 for(const extra of [{location:'home'},{credits:1},{stats:{vitalityXp:0}}]){const denied=veteran(extra);assert.throws(()=>applyGameplayAction(denied,'armour',{id:'towerPlate'},1000));assert.equal(denied.credits,extra.credits??2000);}
});
test('each armour has a real defence/dodge tradeoff shared by manual and server combat',()=>{
 const base=createHunt(0),plain=huntingTurn(base,100,{},'enemy',base.nextBoarAt,()=>.99);
 for(const [id,absorbed,cost] of [['scoutLeather',2,35],['stonebackVest',4,50],['towerPlate',7,65]]){
  const hit=huntingTurn(base,100,{},'enemy',base.nextBoarAt,()=>.99,'trainingSword',null,id);
  assert.equal(hit.absorbed,absorbed);assert.equal(hit.taken,plain.taken-absorbed);assert.equal(combatDodgeCost(id),cost);
  const dodge=huntingTurn(createHunt(0),100,{},'dodge',100,()=>.99,'trainingSword',null,id);assert.equal(dodge.encounter.stamina,100-cost);
 }
 assert.equal(combatDodgeCost(false),40);assert.equal(combatDodgeCost(true),50);assert.equal(armourProfile(true).name,'Stoneback Vest');
 const s=veteran();applyGameplayAction(s,'armour',{id:'towerPlate'},1000);s.location='clearing';s.hunting.encounter=createHunt(1000);s.hunting.encounter.nextPlayerAt=99999;
 const noArmour=structuredClone(s);noArmour.combatGear.equippedArmour=null;assert.equal(incomingCombatDamage(noArmour)-incomingCombatDamage(s),7);
 advanceServerCombat(s,2300,()=>.99);assert(s.combatReceipt.events.some(e=>e.absorbed===7));
});
test('equipment validation rejects unowned, conflicting or forged armour and retains old Stoneback saves',()=>{
 const old=normalizeCombatGear({ownedWeapons:['trainingSword'],stonebackVestOwned:true,stonebackVestEquipped:true});assert.equal(armourSelection(old),'stonebackVest');
 assert.throws(()=>normalizeCombatGear({...old,ownedArmour:['towerPlate'],equippedArmour:'towerPlate'}),/Invalid/);
 assert.throws(()=>normalizeCombatGear({ownedWeapons:['trainingSword'],ownedArmour:[],equippedArmour:'towerPlate'}),/Invalid/);
 const s=veteran(),forged=structuredClone(s);forged.combatGear.ownedArmour=['towerPlate'];forged.combatGear.equippedArmour='towerPlate';const protectedState=protectFishingState(s,forged);assert.equal(protectedState.combatGear.equippedArmour,undefined);
 applyGameplayAction(s,'armour',{id:'scoutLeather'},1000);const next=structuredClone(s);next.combatGear.ownedArmour=['towerPlate'];next.combatGear.equippedArmour='towerPlate';protectFishingState(s,next);assert.deepEqual(next.combatGear.ownedArmour,['scoutLeather']);assert.equal(next.combatGear.equippedArmour,'scoutLeather');
});
test('Armory advertises armour tradeoffs and Inventory lets a player remove purchased armour',()=>{
 const s=veteran();applyGameplayAction(s,'armour',{id:'scoutLeather'},1000);const g=boot(s);g.run('updateArmoryShop();renderBag()');assert(g.nodes.get('weaponOffers').children.some(node=>node.dataset.item==='towerPlate'));assert(g.read("bagEntries().some(i=>i.key==='armour:scoutLeather')"));assert.deepEqual(g.errors,[]);
});


test('server purchase retries cannot duplicate armour charges and lower-level players cannot equip plate',async t=>{
 const {handlePlayerApi}=await import('../server/player-api.mjs'),{testDatabase}=await import('./db-helper.mjs'),{db,sql}=testDatabase();t.after(()=>sql.close());let packet,cookie='';const origin='https://tower.test';
 async function call(path,body){const response=await handlePlayerApi(new Request(origin+'/api/player/'+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify({...body,characterKey:packet?.characterKey}):undefined}),{TOWER_DB:db});cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;const data=await response.json();if(response.ok)packet=data;return {status:response.status,...data};}
 await call('session',{legacy:{credits:1000,location:'armory'}});const act=(path,body={})=>call(path,{revision:packet.revision,operation:crypto.randomUUID(),...body});
 assert.equal((await act('gameplay/armour',{id:'towerPlate'})).status,400);assert.equal(packet.state.credits,1000);
 const buy={id:'scoutLeather',revision:packet.revision,operation:crypto.randomUUID()};assert.equal((await call('gameplay/armour',buy)).status,200);assert.equal(packet.state.credits,820);await call('gameplay/armour',buy);assert.equal(packet.state.credits,820);
 await call('state');assert.equal(packet.state.combatGear.equippedArmour,'scoutLeather');assert.deepEqual(packet.state.combatGear.ownedArmour,['scoutLeather']);
 await act('gameplay/armour',{id:null});assert.equal(packet.state.combatGear.equippedArmour,null);await act('gameplay/armour',{id:'scoutLeather'});assert.equal(packet.state.credits,820);
});
