import test from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './db-helper.mjs';
import {normalizeState,settlePlan} from '../server/player-state.mjs';
import {mineAction} from '../server/mining.mjs';
import {advanceMiningWork} from '../server/mining-work.mjs';
import {activityAction,advanceServerCombat} from '../server/activities.mjs';
import {autoRoomPath,autoTilePath} from '../server/auto-motion.mjs';
import {moonwood} from '../public/moonwood.js';
import {normalizeAutoMining,oreDeposits,miningGuardAwake} from '../public/mining.js';
import {skillXpForLevel} from '../public/skill-curve.js';
import {simpleAutoRules} from '../public/simple-auto.js';
import {nextCombatTactic} from '../public/character-rules.js';
import {touchPresence} from '../server/routines.mjs';
import {AutoActor} from '../server/auto-actor.mjs';
import {veilCloakId} from '../public/wardrobe.js';

const miner=()=>normalizeState({location:'crystaldeep',position:{x:3,y:3},mining:{pickOwned:true,equipped:true,xp:skillXpForLevel(3),upgrades:['copper'],pick:'copper'},stats:{strengthXp:skillXpForLevel(8),agilityXp:skillXpForLevel(5),vitalityXp:skillXpForLevel(5)},combatGear:{ownedWeapons:['ironSword'],equippedWeapon:'ironSword'},characterRules:simpleAutoRules('mining',{risk:'balanced',mining:{ore:'ironOre',keep:0,area:'crystaldeep'}})});
test('tunnels connect both ways and every vein and exit has a reachable approach',()=>{
 const state=miner();assert.equal(autoRoomPath('quarry','crystaldeep',state).length,1);assert.equal(autoRoomPath('crystaldeep','market',state).at(-1).to,'market');
 for(const node of oreDeposits.filter(n=>n.room==='crystaldeep'))assert([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>autoTilePath('crystaldeep',{x:1,y:5},{x:node.x+dx,y:node.y+dy},state)));
 assert(autoTilePath('quarry',{x:1,y:5},moonwood.doors.quarry.find(d=>d.to==='crystaldeep').tile,state));
 assert.deepEqual(normalizeAutoMining(),{ore:'copperOre',keep:0});assert.throws(()=>normalizeAutoMining({area:'depthsVault'}));
});
test('rich veins enforce level, pickaxe and room; outer copper is safe and iron starts real combat',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());const state=miner(),row={player_id:'miner',revision:1},now=1000000;
 state.mining.xp=0;await assert.rejects(mineAction(db,row,state,{node:'deep-copper'},'mineStart',now),/Mining 3/);
 state.mining.xp=skillXpForLevel(3);state.mining.pick='basic';await assert.rejects(mineAction(db,row,state,{node:'deep-copper'},'mineStart',now),/Copper or Iron/);
 state.mining.pick='copper';await assert.rejects(mineAction(db,row,state,{node:'copper-west'},'mineStart',now),/this area/);
 await mineAction(db,row,state,{node:'deep-copper'},'mineStart',now);assert(state.miningCut);assert.equal(state.hunting.encounter,null);
 delete state.miningCut;state.position={x:8,y:6};
 await mineAction(db,row,state,{node:'deep-iron-east'},'mineStart',now);assert.equal(state.hunting.encounter.enemy,'crystalGuardian');assert.equal(state.miningCut,undefined);
 assert.equal(state.hunting.encounter.brainVersion,2);assert.equal(normalizeState(state).hunting.encounter.arenaRoom,'crystaldeep');
 // A completed fight opens the guarded veins without clearing unrelated monster timers.
 state.hunting.encounter.health=1;state.hunting.encounter.arenaPlayer={x:6,y:4};state.hunting.encounter.nextPlayerAt=now;
 advanceServerCombat(state,now,()=>.5);assert.equal(state.hunting.encounter,null);assert.equal(state.hunting.crystalRespawnAt,now+120000);
 assert.equal(miningGuardAwake(normalizeState(state),now),false);
});
test('Veilstep bypasses the guard and fleeing returns to the quarry',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());const state=miner(),now=1000000;
 state.position={x:8,y:6};state.wardrobe.owned.push(veilCloakId);state.wardrobe.outfits.find(o=>o.id===state.wardrobe.active).jacket=veilCloakId;
 state.outfitMagic.veilUntil=now+10000;
 await mineAction(db,{},state,{node:'deep-iron-east'},'mineStart',now);assert(state.miningCut);assert.equal(state.hunting.encounter,null);
 delete state.miningCut;state.outfitMagic.veilUntil=0;
 await mineAction(db,{},state,{node:'deep-iron-east'},'mineStart',now);
 activityAction(state,'combat',{input:'flee',combatId:state.combatId},now+2000,()=>0);
 assert.equal(state.location,'quarry');assert.deepEqual(state.position,{x:9,y:1});
});
test('dangerous Auto fights only after arriving and retreats to safe mining when injured',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());const state=miner(),now=1000000;
 state.controlMode='auto';touchPresence(state,now,{active:false,forceStart:true});
 state.location='crystaldeep';state.position={x:8,y:6};state.plan.miningWork={phase:'walking',node:'deep-iron-east',stand:{x:8,y:6}};
 await advanceMiningWork(db,state,now,{room:'quarry',x:8,y:6});assert.equal(state.hunting.encounter,null);
 await advanceMiningWork(db,state,now,{room:'crystaldeep',x:8,y:6});assert.equal(state.hunting.encounter.enemy,'crystalGuardian');
 const stopping=structuredClone(state);settlePlan(stopping,now,{stop:true});assert(stopping.plan.returnRequested);assert.equal(stopping.location,'crystaldeep');
 state.health=40;assert.equal(nextCombatTactic(state).action,'flee');
 state.hunting.encounter=null;state.health=70;
 await advanceMiningWork(db,state,now+100,{room:'crystaldeep',x:8,y:6});assert.equal(state.location,'quarry');assert.equal(state.plan.mining.area,undefined);assert(state.plan.miningRetreat);
 assert.equal(state.characterRules.mining.area,'crystaldeep');
});
test('a protected ore stack with room for only one ore stops instead of looping on double-yield veins',()=>{
 const state=miner();state.huntingLoot.ironOre=999999;state.characterRules.mining.keep=999999;
 state.controlMode='auto';touchPresence(state,1000000,{active:false,forceStart:true});assert.equal(state.report.reason,'inventory-full');
});
test('offline Auto walks into Crystaldeep, wins a guard fight, mines double ore and sells it',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());let now=1000000;t.mock.method(Date,'now',()=>now);
 const state=miner();state.location='quarry';state.position={x:9,y:1};state.controlMode='auto';touchPresence(state,now,{active:false,forceStart:true});
 sql.prepare('INSERT INTO tower_players VALUES(?,?,1,?,?)').run('miner',JSON.stringify(state),'fixture',now);
 let alarm=null,ready=Promise.resolve();const data=new Map(),ctx={storage:{get:async k=>data.get(k),put:async(k,v)=>data.set(k,structuredClone(v)),getAlarm:async()=>alarm,setAlarm:async at=>{alarm=at;},deleteAlarm:async()=>{alarm=null;}},blockConcurrencyWhile(fn){const p=ready.then(fn);ready=p.catch(()=>{});return p;}};
 const actor=new AutoActor(ctx,{TOWER_DB:db,SHARED_ROOMS:{idFromName:name=>name,get:()=>({fetch:async()=>Response.json({ok:true,observed:false})})}});await actor.fetch(new Request('https://actor.internal/sync',{method:'POST',body:JSON.stringify({playerId:'miner'})}));
 const read=()=>JSON.parse(sql.prepare('SELECT state_json FROM tower_players WHERE player_id=?').get('miner').state_json);
 let fought=false,deep=false;
 for(let i=0;i<500&&!read().plan?.oreSales?.ironOre;i++){assert(alarm);now=alarm;await actor.alarm();const s=read();deep||=actor.actor.motion.room==='crystaldeep';fought||=s.hunting.encounter?.enemy==='crystalGuardian';}
 const after=read();assert(deep);assert(fought);assert(after.plan?.oreSales?.ironOre?.quantity>=4,JSON.stringify({plan:after.plan,report:after.report,health:after.health,location:after.location}));
 assert(after.plan.ores.ironOre>=4);assert(after.mining.xp>=state.mining.xp+56);assert(after.hunting.crystalRespawnAt>0);
});


