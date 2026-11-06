import test from 'node:test';
import assert from 'node:assert/strict';
import {jobPreview} from '../public/jobs.js';
import {normalizeState,startPlan,settlePlan} from '../server/player-state.mjs';
import {testDatabase} from './db-helper.mjs';
import {handlePlayerApi} from '../server/player-api.mjs';
const ready=()=>normalizeState({location:'hub',adventure:{discovered:['pond','logging']},woodcutting:{axeOwned:true,equipped:true},fishingGear:{ownedRods:['reed'],equippedRod:'reed',bait:100}});
test('board estimates use actual pacing and cap supply consumption and storage',()=>{
 const state=ready();let p=jobPreview(state,'fishing',8,10);assert.equal(p.allowed,true);assert.equal(p.count,10);assert.equal(p.xp,100);assert.equal(p.duration,600000);assert.equal(p.valueMin,50);assert.equal(p.valueMax,120);
 p=jobPreview(state,'woodcutting',8);assert.equal(p.count,480);assert.equal(p.xp,4800);assert.equal(p.valueMin,1920);
 state.woodcutting.timber=999999;assert.equal(jobPreview(state,'woodcutting',8).count,1);
 state.fishingGear={ownedRods:['reed','oak'],equippedRod:'oak',bait:100};state.stats.patienceXp=50;assert.equal(jobPreview(state,'fishing',1,100).count,71);
 assert.equal(jobPreview(state,'fishing',1,101).allowed,false);
});
test('board dispatches both jobs from hub, applies requirements and settles rewards once',()=>{
 const fish=ready();startPlan(fish,{source:'board',kind:'fishing',hours:1,baitLimit:2},1000);assert.equal(fish.location,'pond');settlePlan(fish,121000,{random:()=>0});assert.equal(fish.stats.patienceXp,20);assert.equal(fish.fishingGear.bait,98);assert.equal(fish.location,'home');assert.equal(fish.report.baitUsed,2);assert.equal(settlePlan(fish,999999),false);
 const wood=ready();startPlan(wood,{source:'board',kind:'woodcutting',hours:1},1000);assert.equal(wood.location,'logging');settlePlan(wood,121000,{stop:true});assert.equal(wood.woodcutting.timber,2);assert.equal(wood.location,'home');assert.equal(wood.report.reason,'stopped');assert.equal(wood.credits,100);
 for(const [patch,kind,error] of [[{location:'home'},'fishing',/Travel/],[{adventure:{discovered:[]}},'fishing',/Visit/],[{woodcutting:{axeOwned:false,equipped:false,xp:0,timber:0}},'woodcutting',/axe/],[{health:0},'woodcutting',/recover/],[{fishingGear:{ownedRods:['reed'],equippedRod:'reed',bait:0}},'fishing',/bait/]])assert.throws(()=>startPlan({...ready(),...patch},{source:'board',kind,hours:1,baitLimit:1},1000),error);
 assert.throws(()=>startPlan(ready(),{source:'board',kind:'mining',hours:1},0),/Unknown/);
});
test('job API persists dispatched location and rejects repeat starts and locked saves',async()=>{
 const {db,sql}=testDatabase(),env={TOWER_DB:db},origin='https://tower.test';let cookie='',packet;
 const request=async(path,body)=>{
  const response=await handlePlayerApi(new Request(origin+'/api/player/'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({...body,...(packet?.characterKey?{characterKey:packet.characterKey}:{})})}),env);
  cookie=response.headers.get('Set-Cookie')?.split(';')[0]??cookie;const data=await response.json();if(response.ok)packet=data;return {status:response.status,data};
 };
 await request('session',{legacy:ready()});
 const options={source:'board',kind:'woodcutting',hours:1,operation:'start',revision:packet.revision};assert.equal((await request('plan/start',options)).status,200);assert.equal(packet.state.location,'logging');
 assert.equal((await request('plan/start',options)).status,200);assert.equal(packet.revision,2);
 assert.equal((await request('save',{operation:'blocked',revision:packet.revision,state:ready()})).status,409);
 assert.equal((await request('plan/start',{...options,operation:'overlap',revision:packet.revision})).status,400);
 assert.equal((await request('plan/stop',{operation:'stop',revision:packet.revision})).status,200);assert.equal(packet.state.location,'home');assert(packet.state.report);
 assert.equal((await request('report/ack',{operation:'ack',revision:packet.revision,startedAt:packet.state.report.startedAt})).status,200);assert(!packet.state.report);sql.close();
});
