import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {awardOreStrike} from '../server/mining.mjs';
import {testDatabase} from './db-helper.mjs';
import {handlePlayerApi,settled} from '../server/player-api.mjs';
import {normalizeState,settlePlan} from '../server/player-state.mjs';
import {touchPresence} from '../server/routines.mjs';
import {simpleAutoRules} from '../public/simple-auto.js';
import {miningFind,miningFinds,oreDeposits} from '../public/mining.js';
import {worldActivityEvents} from '../public/world-activity.js';
import {autoRecapView,autoRecapSnapshot} from '../public/auto-recap.js';
import {skillXpForLevel} from '../public/skill-curve.js';

const findSeed=kind=>{for(let n=0;n<100000;n++){const id='swing-'+n;if(miningFind(id)===kind)return id;}throw new Error('No seed');};
const base=()=>normalizeState({location:'quarry',position:{x:2,y:7},mining:{pickOwned:true,equipped:true,xp:0}});

test('discoveries have bounded odds, stable rolls and a small Luck bonus',()=>{
 const counts={none:0,...Object.fromEntries(Object.keys(miningFinds).map(id=>[id,0]))};
 const sample=n=>createHash('sha256').update('mining-odds-'+n).digest('hex');
 for(let n=0;n<20000;n++){const id=sample(n),found=miningFind(id);counts[found??'none']++;assert.equal(miningFind(id),found);}
 assert(counts.none>16500&&counts.none<18500);
 for(const id of Object.keys(miningFinds))assert(counts[id]>300&&counts[id]<1300);
 let basic=0,lucky=0;
 for(let n=0;n<5000;n++){const id=sample(n);basic+=!!miningFind(id);lucky+=!!miningFind(id,skillXpForLevel(5));assert.equal(miningFind(id,skillXpForLevel(5)),miningFind(id,skillXpForLevel(100)));}
 assert(lucky>basic);
});

test('ordinary strikes and full discovery stacks cannot produce bonus items',()=>{
 const state=base(),cut={id:findSeed('uncutQuartz')};
 awardOreStrike(state,oreDeposits[0],cut,1000000);
 assert.equal(state.huntingLoot.uncutQuartz,undefined);assert.equal(state.miningReceipt.broken,false);
 state.huntingLoot.uncutQuartz=1000000;
 awardOreStrike(state,oreDeposits[0],cut,1004500,true);
 assert.equal(state.huntingLoot.uncutQuartz,1000000);assert.equal(state.miningReceipt.find,null);
});

test('manual final strikes award each find once, remain protected and sell at the Trading Post',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());let clock=1000000;t.mock.method(Date,'now',()=>clock);
 const origin='https://tower.test';let cookie='',packet;
 async function request(path,body){
  const res=await handlePlayerApi(new Request(origin+'/api/player/'+path,{method:body?'POST':'GET',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}),{TOWER_DB:db});
  cookie=res.headers.get('set-cookie')?.split(';')[0]??cookie;const data=await res.json();if(res.ok&&data.state)packet=data;return {status:res.status,...data};
 }
 const session=await request('session',{legacy:{}}),node=oreDeposits[0];
 for(const [id,item] of Object.entries(miningFinds)){
  const state=base(),cut={id:findSeed(id),node:node.id,revision:0,started:clock-4500,endsAt:clock};state.miningCut=cut;
  sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(state),session.characterKey);
  sql.prepare('INSERT OR REPLACE INTO tower_ore_deposits VALUES(?,2,0,0,?)').run(node.id,'seed');
  await request('state');const revision=packet.revision,operation='collect-'+id;
  const body={revision,operation,cutId:cut.id};
  const result=await request('gameplay/mineHit',body);
  assert.equal(result.status,200,result.error);assert.equal(result.state.huntingLoot[id],1);assert.equal(result.state.miningReceipt.broken,true);
  assert.equal((await request('gameplay/mineHit',body)).state.huntingLoot[id],1);
  const events=worldActivityEvents(state,result.state,clock);assert(events.some(e=>e.label==='Discovered '+item.name+'!'));assert(events.some(e=>e.mining?.broken));
  const save=await request('save',{revision:packet.revision,operation:'move-'+id,state:{...packet.state,location:'market',position:{x:4,y:3},huntingLoot:{[id]:999}}});
  assert.equal(save.state.huntingLoot[id],1);
  const sold=await request('gameplay/sell',{revision:packet.revision,operation:'sell-'+id,id,quantity:1});
  assert.equal(sold.status,200,sold.error);assert.equal(sold.state.huntingLoot[id],0);assert.equal(sold.state.credits,100+item.price);
  clock+=50000;
 }
});

test('offline final-strike competition awards one discovery and includes it in the recap',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());const clock=1000000;t.mock.method(Date,'now',()=>clock);
 const node=oreDeposits[0],id='uncutQuartz',seed=findSeed(id);
 sql.prepare('INSERT INTO tower_ore_deposits VALUES(?,2,0,0,?)').run(node.id,'fixture');
 for(const player of ['one','two']){
  const state=base();state.characterRules=simpleAutoRules('mining',{risk:'safe',mining:{ore:'copperOre',keep:0}});state.controlMode='auto';touchPresence(state,clock-5000,{active:false,forceStart:true});
  state.location='quarry';state.position={x:2,y:7};
  state.plan.miningWork={phase:'mining',node:node.id,stand:state.position,cut:{id:seed,node:node.id,revision:0,started:clock-4500,endsAt:clock}};
  sql.prepare('INSERT INTO tower_players VALUES(?,?,1,?,?)').run(player,JSON.stringify(state),'fixture',clock);
 }
 const rows=await Promise.all(['one','two'].map(id=>settled({TOWER_DB:db},id,true,{idle:true,motion:{room:'quarry',x:2,y:7}})));
 const states=rows.map(row=>JSON.parse(row.state_json));assert.equal(states.reduce((sum,s)=>sum+(s.huntingLoot[id]??0),0),1);
 const winner=states.find(s=>s.huntingLoot[id]);assert.equal(winner.plan.miningFinds[id],1);
 assert(autoRecapView(winner,null,room=>room).rewards.some(r=>r.label==='Uncut Quartz'&&r.value===1));
 assert(!autoRecapView(winner,autoRecapSnapshot(winner),room=>room).rewards.some(r=>r.label==='Uncut Quartz'));
 settlePlan(winner,clock,{stop:true});assert.match(winner.activityLog.at(-1).miningSummary,/1 Uncut Quartz/);
});

