import assert from 'node:assert/strict';
import {testDatabase} from '../db-helper.mjs';
import {normalizeState} from '../../server/player-state.mjs';
import {touchPresence} from '../../server/routines.mjs';
import {settled,handlePlayerApi} from '../../server/player-api.mjs';
import {tokenHash,GUEST_COOKIE} from '../../server/identity.mjs';
import {treeKey,logicalTree} from '../../server/shared-trees.mjs';
import {choppingDuration} from '../../public/woodcutting.js';
import {oreDeposits,miningRules,miningDuration} from '../../public/mining.js';

// Contention fixture: real SQL/CAS transactions; clock and room transport are
// simulated. Returned rows are counted, not Cloudflare's billable rows scanned.
export async function runGatheringContention({kind='tree',players=20,manualPlayers=0,onComplete=null}={}){
 const {db,sql}=testDatabase(),originalNow=Date.now;let now=1800000000000;
 const counts={readQueries:0,writeQueries:0,rowsReturned:0,batches:0,roomRequests:0};
 const prepare=db.prepare.bind(db);
 db.prepare=query=>{
  const statement=prepare(query);
  for(const name of ['first','all','run']){const run=statement[name];statement[name]=function(...args){
   counts[/^\s*SELECT/i.test(query)?'readQueries':'writeQueries']++;
   const result=run.apply(this,args);
   const measure=value=>{counts.rowsReturned+=name==='first'?(value?1:0):value?.results?.length??0;return value;};
   return result?.then?result.then(measure):measure(result);
  };}
  return statement;
 };
 const batch=db.batch;db.batch=async statements=>{counts.batches++;return batch(statements);};
 const messages=[],env={TOWER_DB:db,SHARED_ROOMS:{idFromName:n=>n,get:()=>({fetch:async request=>{counts.roomRequests++;messages.push(await request.json());return Response.json({ok:true});}})}};
 const tree={x:6,y:5},key=treeKey('logging',tree),node=oreDeposits[0],room=kind==='tree'?'logging':'quarry',stand=kind==='tree'?{x:5,y:5}:{x:node.x,y:node.y+1};
 const ids=[],tokens=new Map();
 Date.now=()=>now;
 try{
  for(let i=0;i<players;i++){
   const manual=i<manualPlayers,token=(i+1).toString(16).padStart(64,'0'),id=manual?await tokenHash(token):'gatherer-'+i;
   ids.push(id);if(manual)tokens.set(id,token);
   const state=normalizeState({location:room,position:stand,woodcutting:{axeOwned:true,equipped:true},mining:{pickOwned:true,equipped:true},characterRules:{queue:{enabled:true,steps:[{type:kind==='tree'?'woodcutting':'mining',amount:100}]}}});
   if(!manual){state.controlMode='auto';touchPresence(state,now,{forceStart:true,active:false,physicalTimber:true});}
   sql.prepare('INSERT INTO tower_players VALUES (?,?,1,?,?)').run(id,JSON.stringify(state),'fixture',now);
  }
  if(kind==='tree')sql.prepare('INSERT INTO tower_trees (tree_key,room) VALUES (?,?)').run(key,room);
  else for(const deposit of oreDeposits)sql.prepare('INSERT INTO tower_ore_deposits (node_id) VALUES (?)').run(deposit.id);
  const read=id=>sql.prepare('SELECT * FROM tower_players WHERE player_id=?').get(id);
  const states=()=>ids.map(id=>JSON.parse(read(id).state_json));
  const reward=()=>states().reduce((sum,s)=>sum+(kind==='tree'?s.woodcutting.timber:s.huntingLoot.copperOre??0),0);
  const xp=()=>states().reduce((sum,s)=>sum+(kind==='tree'?s.woodcutting.xp:s.mining.xp),0);
  const resource=()=>kind==='tree'?sql.prepare('SELECT * FROM tower_trees WHERE tree_key=?').get(key):sql.prepare('SELECT * FROM tower_ore_deposits WHERE node_id=?').get(node.id);
  const arrange=(round,{stale=false}={})=>{
   const saved=resource(),cuts=new Map();let endsAt=now;
   for(const id of ids){
    const s=JSON.parse(read(id).state_json),duration=kind==='tree'?choppingDuration(s.woodcutting):miningDuration(s.mining);
    const cut=kind==='tree'?{id:id+'-'+round,key,room,x:tree.x,y:tree.y,treeGeneration:stale?0:saved.generation,started:now,endsAt:now+duration}:{id:id+'-'+round,node:node.id,revision:stale?0:saved.revision,started:now,endsAt:now+duration};
    s.location=room;s.position=stand;
    if(tokens.has(id))s[kind==='tree'?'timberCut':'miningCut']=cut;
    else if(kind==='tree')s.plan.treeWork={phase:'chopping',tree,stand,cut};
    else s.plan.miningWork={phase:'mining',node:node.id,stand,cut};
    sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(s),id);
    cuts.set(id,cut);endsAt=Math.max(endsAt,cut.endsAt);
   }
   return {cuts,endsAt};
  };
  const strike=async cuts=>{
   const result=await Promise.allSettled(ids.map(async id=>{
    if(!tokens.has(id))return settled(env,id,true,{idle:true,motion:{room,...stand}});
    const response=await handlePlayerApi(new Request('https://tower.test/api/player/gameplay/'+(kind==='tree'?'cut':'mineHit'),{method:'POST',headers:{Origin:'https://tower.test','Content-Type':'application/json',Cookie:GUEST_COOKIE+'='+tokens.get(id)},body:JSON.stringify({characterKey:id,revision:read(id).revision,operation:crypto.randomUUID(),cutId:cuts.get(id).id,...tree})}),env);
    assert([200,400].includes(response.status),'manual contention must succeed or reject the stale strike, not fail with a server error');
    return response.status;
   }));
   const failures=result.filter(r=>r.status==='rejected');if(failures.length)throw new AggregateError(failures.map(r=>r.reason),'Concurrent gathering failed');
  };
  const rounds=kind==='tree'?2:4,summary=[];
  for(let round=0;round<rounds;round++){
   if(round===1&&kind==='tree'||round===3&&kind==='ore'){
    now=kind==='tree'?resource().regrows_at:resource().ready_at;
    const old=arrange('stale',{stale:true}),before=reward();now=old.endsAt;
    await strike(old.cuts);assert.equal(reward(),before,'old-generation strikes cannot pay after regrowth');
   }
   const setup=arrange(round);now=setup.endsAt;
   const before=reward(),oldCounts={...counts};await strike(setup.cuts);
   const awarded=reward()-before,expected=kind==='tree'?Math.min(players,3):1;
   assert.equal(awarded,expected,'awards must exactly match successful resource mutations');
   assert.equal(xp(),reward()*10,'all accepted strikes award XP once');
   const saved=resource();
   if(kind==='tree'){
    assert.equal(saved.cuts,Math.min(players,3));assert.equal(logicalTree(saved,now).cuts,Math.min(players,3));
    assert.equal(states().filter((s,i)=>s.timberReceipt?.id===setup.cuts.get(ids[i]).id&&s.timberReceipt.felled).length,players>=3?1:0,'exactly the committed final cut reports felling');
   }
   else assert.equal(saved.hits,round===3?1:round+1);
   summary.push({round,awarded,resourceVersion:kind==='tree'?saved.version:saved.revision,operations:Object.fromEntries(Object.keys(counts).map(k=>[k,counts[k]-oldCounts[k]]))});
  }
  const result={kind,players,manualPlayers,rewards:reward(),xp:xp(),counts:{...counts},rounds:summary,resource:{cuts:kind==='tree'?resource().cuts:resource().hits,version:kind==='tree'?resource().version:resource().revision},activityMessages:messages.filter(m=>m.events?.length).length};
  if(onComplete)await onComplete({db,sql,now,states:states(),key,node});
  return result;
 }finally{Date.now=originalNow;sql.close();}
}
