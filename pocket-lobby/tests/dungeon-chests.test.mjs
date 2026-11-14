import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeState} from '../server/player-state.mjs';
import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';
import {advanceServerCombat} from '../server/activities.mjs';
import {normalizeRewardChests,chestEquipmentComparison,dungeonChestRooms} from '../public/dungeon-chests.js';
import {skillXpForLevel} from '../public/skill-curve.js';
import {boot} from './helpers/game-client.mjs';
const runs={depthsGate:{cleared:0,routeChoice:'pending'},depthsGallery:{cleared:1,routeChoice:'safe'},depthsCache:{cleared:1,routeChoice:'dangerous'},depthsTreasury:{cleared:2,routeChoice:'safe'},depthsTrial:{cleared:2,routeChoice:'safe'},depthsVault:{cleared:2,routeChoice:'safe'}};
function win(room='depthsVault',random=()=>0){
 const s=normalizeState({location:room,position:{x:5,y:5},depthsRun:runs[room],stats:{strengthXp:skillXpForLevel(10),agilityXp:skillXpForLevel(10),vitalityXp:skillXpForLevel(10)},combatGear:{ownedWeapons:['ironSword'],equippedWeapon:'ironSword'}});
 applyGameplayAction(s,'fight',{},1000,random);s.hunting.encounter.health=1;advanceServerCombat(s,1450,random);return s;
}
test('each dungeon leader creates one saved receipt with the exact victory rewards and a reachable physical chest',()=>{
 for(const room of Object.keys(dungeonChestRooms)){
  const s=win(room),c=s.depthsRun.rewardChests[room],r=s.combatReports.at(-1);
  assert.equal(c.id,r.id);assert.equal(c.enemy,r.enemy);assert.equal(c.opened,false);assert.equal(c.gold,r.rewards.held.gold);assert.deepEqual(c.loot,r.rewards.held.loot);
  assert.deepEqual(normalizeState(s).depthsRun.rewardChests,s.depthsRun.rewardChests);
  const g=boot(s);g.context.playerCloud.initial=s;g.run("draw(2200);use(roomFurniture().find(i=>i.type==='dungeonRewardChest'))");
  assert.deepEqual(g.errors,[]);assert.equal(g.read('interaction.type'),'dungeonRewardChest');assert(g.read('route.length')>=0);
  assert.equal(g.run('showVaultVictory()'),false);
  g.run('enterRoom(currentRoom,{x:5,y:5});updateDepthsPanel()');assert.equal(g.nodes.get('depthsDecision').hidden,true);
  g.run('showPendingDungeonLoot();showPendingCombatRecap()');assert(!g.nodes.get('combatRecapDialog').open);assert(!g.nodes.get('dungeonLootDialog').open);
 }
});
test('opening and reopening only acknowledges already committed loot, never rerolls or awards twice',()=>{
 const s=win(),c=s.depthsRun.rewardChests.depthsVault;
 const before=structuredClone({credits:s.credits,gear:s.combatGear,stats:s.stats,magic:s.magic});
 const actionPoints=s.actionPoints.value;
 for(let i=0;i<3;i++)applyGameplayAction(s,'dungeonChestOpen',{id:c.id},2000+i,()=>{throw Error('Must not reroll');});
 assert.equal(c.opened,true);assert.equal(s.depthsRun.victorySeen,true);assert(!s.combatReports);assert.equal(s.dungeonLoot.notices.length,0);assert.equal(s.actionPoints.value,actionPoints);
 assert.deepEqual({credits:s.credits,gear:s.combatGear,stats:s.stats,magic:s.magic},before);
 assert.deepEqual(normalizeState(s).depthsRun.rewardChests,s.depthsRun.rewardChests);
});
test('wrong expedition, distance, combat and forged snapshots cannot open or replace chest rewards',()=>{
 const s=win(),c=s.depthsRun.rewardChests.depthsVault;
 assert.throws(()=>applyGameplayAction(s,'dungeonChestOpen',{id:'old-run'},2000),/another expedition/);
 s.position={x:2,y:5};assert.throws(()=>applyGameplayAction(s,'dungeonChestOpen',{id:c.id},2000),/Walk beside/);assert(!c.opened);
 const forged=structuredClone(s);forged.depthsRun.rewardChests.depthsVault.gold=99999;forged.depthsRun.rewardChests.depthsVault.opened=true;
 assert.deepEqual(protectFishingState(s,forged).depthsRun,s.depthsRun);
 assert.throws(()=>normalizeRewardChests({depthsVault:{...c,gold:-1}}),/Invalid/);
});
test('Equip requires an opened receipt, ownership and stats; weapons and clothing update the actual active loadout',()=>{
 const s=win(),c=s.depthsRun.rewardChests.depthsVault,id='vampiricSword';assert(c.items.includes(id));
 assert.throws(()=>applyGameplayAction(s,'dungeonChestEquip',{chest:c.id,id},2000),/Open/);
 applyGameplayAction(s,'dungeonChestOpen',{id:c.id},2000);
 const cmp=chestEquipmentComparison(s,id);assert(cmp.canEquip);assert.equal(cmp.current,'Iron Sword');assert.equal(cmp.metrics.length,3);
 applyGameplayAction(s,'dungeonChestEquip',{chest:c.id,id},2001);assert.equal(s.combatGear.equippedWeapon,id);
 assert.throws(()=>applyGameplayAction(s,'dungeonChestEquip',{chest:c.id,id:'quickfang'},2002),/Open/);
 s.combatGear.ownedWeapons=s.combatGear.ownedWeapons.filter(x=>x!==id);assert.throws(()=>applyGameplayAction(s,'dungeonChestEquip',{chest:c.id,id},2003),/requirements/);
 const novice=win();novice.stats.strengthXp=0;novice.stats.agilityXp=0;applyGameplayAction(novice,'dungeonChestOpen',{id:novice.depthsRun.rewardChests.depthsVault.id},2000);assert.throws(()=>applyGameplayAction(novice,'dungeonChestEquip',{chest:novice.depthsRun.rewardChests.depthsVault.id,id},2003),/requirements/);
 const mage=win('depthsCache'),cc=mage.depthsRun.rewardChests.depthsCache;applyGameplayAction(mage,'dungeonChestOpen',{id:cc.id},2000);applyGameplayAction(mage,'dungeonChestEquip',{chest:cc.id,id:'runeboundHood'},2001);assert.equal(mage.wardrobe.outfits.find(o=>o.id===mage.wardrobe.active).jacket,'runeboundHood');assert.equal(mage.avatar.outfit,15);
});

import {testDatabase} from './db-helper.mjs';
import {handlePlayerApi} from '../server/player-api.mjs';
test('database actions persist chest opening and equipment; a repeated request cannot duplicate rewards',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());const clock=Date.now;Date.now=()=>2000;t.after(()=>Date.now=clock);
 const origin='https://tower.test';let packet,cookie='';
 async function call(path,body){const response=await handlePlayerApi(new Request(origin+'/api/player/'+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify({...body,characterKey:packet?.characterKey}):undefined}),{TOWER_DB:db});cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;const data=await response.json();assert.equal(response.status,200,data.error);packet=data;return data;}
 await call('session',{legacy:normalizeState({})});const s=win(),c=s.depthsRun.rewardChests.depthsVault;
 sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(s),packet.characterKey);
 const body={revision:packet.revision,operation:crypto.randomUUID(),id:c.id};
 await call('gameplay/dungeonChestOpen',body);await call('gameplay/dungeonChestOpen',body);assert(packet.state.depthsRun.rewardChests.depthsVault.opened);assert.equal(packet.state.credits,100);
 await call('gameplay/dungeonChestEquip',{revision:packet.revision,operation:crypto.randomUUID(),chest:c.id,id:'vampiricSword'});
 await call('state');assert.equal(packet.state.combatGear.equippedWeapon,'vampiricSword');assert.equal(packet.state.combatGear.ownedWeapons.filter(id=>id==='vampiricSword').length,1);assert.equal(packet.state.dungeonLoot.clears,1);
 await call('gameplay/bank',{revision:packet.revision,operation:crypto.randomUUID()});assert.equal(packet.state.credits,181);assert.equal(packet.state.depthsRun,null);assert.equal(packet.state.location,'ruins');
});
