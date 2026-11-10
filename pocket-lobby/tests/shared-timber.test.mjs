import test from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './db-helper.mjs';
import {normalizeState} from '../server/player-state.mjs';
import {handlePlayerApi,settled} from '../server/player-api.mjs';
import {roomTreeSnapshot,forestTrees,treeKey} from '../server/shared-trees.mjs';
import {touchPresence} from '../server/routines.mjs';
import {tokenHash,GUEST_COOKIE} from '../server/identity.mjs';
import {choppingDuration} from '../public/woodcutting.js';

test('manual and offline Auto share a tree and a competing final cut cannot pay twice',async t=>{
 const {sql,db}=testDatabase();t.after(()=>sql.close());
 const originalNow=Date.now;let now=100000;Date.now=()=>now;t.after(()=>Date.now=originalNow);
 const events=[],env={TOWER_DB:db,SHARED_ROOMS:{idFromName:name=>name,get:()=>({fetch:async request=>{events.push(await request.json());return Response.json({ok:true});}})}};
 const token='a'.repeat(64),id=await tokenHash(token);
 const woodcutting={axeOwned:true,equipped:true};
 const player=normalizeState({location:'logging',position:{x:5,y:5},woodcutting});
 const put=(key,state)=>sql.prepare('INSERT INTO tower_players VALUES (?,?,1,?,?)').run(key,JSON.stringify(state),'test',now);
 put(id,player);
 let revision=1;
 const action=async(name,body)=>{
  const response=await handlePlayerApi(new Request('https://tower.test/api/player/gameplay/'+name,{method:'POST',headers:{Origin:'https://tower.test','Content-Type':'application/json',Cookie:GUEST_COOKIE+'='+token},body:JSON.stringify({revision,operation:crypto.randomUUID(),x:6,y:5,...body})}),env);
  const result=await response.json();revision=result.revision??revision;return {response,...result};
 };
 const start=await action('chop');assert.equal(start.response.status,200,start.error);
 now=start.state.timberCut.endsAt;
 const first=await action('cut',{cutId:start.state.timberCut.id});assert.equal(first.response.status,200,first.error);
 assert.equal(first.state.woodcutting.timber,1);
 const key='logging:6,5';
 assert.equal((await roomTreeSnapshot(db,'logging',now)).trees[key].cuts,1);
 const auto=normalizeState({location:'logging',position:{x:5,y:5},woodcutting,characterRules:{enabled:true,strategy:'routine',queue:{enabled:true,repeats:1,budget:0,reserveGold:0,minHealth:60,steps:[{type:'woodcutting',amount:3}]}}});
 auto.controlMode='auto';touchPresence(auto,now,{forceStart:true,active:false,physicalTimber:true});put('auto',auto);
 const tick=async motion=>JSON.parse((await settled(env,'auto',true,{idle:true,motion})).state_json);
 now++;
 const walk=await tick({room:'trail',x:1,y:5});assert.equal(walk.plan.treeWork.phase,'walking');assert.equal(walk.woodcutting.timber,0);
 const atTree={room:'logging',x:5,y:5};
 let s=await tick(atTree);assert.equal(s.plan.treeWork.cut.key,key);assert.equal(s.plan.treeWork.cut.endsAt-now,choppingDuration(s.woodcutting));
 now=s.plan.treeWork.cut.endsAt-1;s=await tick(atTree);assert.equal(s.woodcutting.timber,0);
 now++;s=await tick(atTree);assert.equal(s.woodcutting.timber,1);
 s=await tick(atTree);now=s.plan.treeWork.cut.endsAt;s=await tick(atTree);assert.equal(s.woodcutting.timber,2);
 const stump=(await roomTreeSnapshot(db,'logging',now)).trees[key];assert.equal(stump.cuts,3);assert.equal(stump.regrowsAt,now+30000);
 const late=await action('cut',{cutId:first.state.timberCut.id});assert.equal(late.response.status,400);assert.match(late.error,/felled/);
 assert(events.some(message=>message.treesChanged&&message.events.some(e=>e.kind==='timber')));
 s=await tick(atTree);assert.notDeepEqual(s.plan.treeWork.tree,{x:6,y:5});assert.equal(s.plan.treeWork.phase,'walking');
});

test('Auto waits without earning when all trees are stumps and resumes after regrowth',async t=>{
 const {sql,db}=testDatabase();t.after(()=>sql.close());
 const originalNow=Date.now;let now=100000;Date.now=()=>now;t.after(()=>Date.now=originalNow);
 const env={TOWER_DB:db,SHARED_ROOMS:{idFromName:name=>name,get:()=>({fetch:async()=>Response.json({ok:true})})}};
 for(const tree of forestTrees('logging'))sql.prepare('INSERT INTO tower_trees (tree_key,room,cuts,regrows_at,generation) VALUES (?,?,3,?,1)').run(treeKey('logging',tree),'logging',now+30000);
 const auto=normalizeState({location:'logging',position:{x:5,y:5},woodcutting:{axeOwned:true,equipped:true},characterRules:{enabled:true,activity:'woodcutting',timberTarget:3}});
 auto.controlMode='auto';touchPresence(auto,now,{forceStart:true,active:false,physicalTimber:true});sql.prepare('INSERT INTO tower_players VALUES (?,?,1,?,?)').run('auto',JSON.stringify(auto),'test',now);
 const tick=async()=>JSON.parse((await settled(env,'auto',true,{idle:true,motion:{room:'logging',x:5,y:5}})).state_json);
 let state=await tick();assert.equal(state.plan.treeWork.phase,'waiting');assert.equal(state.woodcutting.timber,0);
 now+=29999;state=await tick();assert.equal(state.plan.treeWork.phase,'waiting');assert.equal(state.woodcutting.timber,0);
 now++;state=await tick();assert.equal(state.plan.treeWork.phase,'chopping');assert.equal(state.woodcutting.timber,0);
 now=state.plan.treeWork.cut.endsAt;state=await tick();assert.equal(state.woodcutting.timber,1);
});
