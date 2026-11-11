import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {testDatabase} from './db-helper.mjs';
import {handlePlayerApi} from '../server/player-api.mjs';
import {normalizeState} from '../server/player-state.mjs';
import {advanceMiningWork} from '../server/mining-work.mjs';
import {awardOreStrike} from '../server/mining.mjs';
import {miningBonusOre,normalizeMining,oreDeposits,deepMiningRequirement} from '../public/mining.js';
import {forgeCraftReason} from '../public/forge.js';
import {skillXpForLevel} from '../public/skill-curve.js';
import {worldActivityEvents} from '../public/world-activity.js';

const base=()=>normalizeState({location:'quarry',position:{x:9,y:8},mining:{pickOwned:true,equipped:true,xp:skillXpForLevel(5),upgrades:['iron'],pick:'iron'},woodcutting:{timber:6},huntingLoot:{ironBar:8,runicFragment:5,uncutQuartz:2}});
const runic=()=>normalizeMining({...base().mining,upgrades:['iron','runic'],pick:'runic'});
const seed=()=>{for(let n=0;n<100000;n++)if(miningBonusOre(runic(),'swing-'+n))return 'swing-'+n;throw new Error('No seed');};

test('runic crafting requires the mining level, previous tool and every material',()=>{
 const state=base();assert.equal(forgeCraftReason(state,'runic'),'');
 state.mining.xp=skillXpForLevel(4);assert.match(forgeCraftReason(state,'runic'),/Mining 5/);state.mining.xp=skillXpForLevel(5);
 state.mining.upgrades=[];assert.match(forgeCraftReason(state,'runic'),/Iron Pickaxe first/);state.mining.upgrades=['iron'];
 for(const id of ['ironBar','runicFragment','uncutQuartz']){const amount=state.huntingLoot[id];state.huntingLoot[id]=amount-1;assert.match(forgeCraftReason(state,'runic'),/Bring/);state.huntingLoot[id]=amount;}
 state.woodcutting.timber=5;assert.match(forgeCraftReason(state,'runic'),/Bring/);
 assert.equal(deepMiningRequirement({...base(),mining:runic()}),'');
});
test('runic bonus odds are stable, limited to the equipped tool and close to ten percent',()=>{
 const mining=runic();let bonuses=0;
 for(let n=0;n<10000;n++){const id=createHash('sha256').update('runic-'+n).digest('hex'),bonus=miningBonusOre(mining,id);bonuses+=bonus;assert.equal(miningBonusOre(mining,id),bonus);assert.equal(miningBonusOre({...mining,equipped:false},id),0);assert.equal(miningBonusOre({...mining,pick:'iron'},id),0);}
 assert(bonuses>900&&bonuses<1100);
 const state={...base(),mining};state.huntingLoot.copperOre=999999;
 awardOreStrike(state,oreDeposits[0],{id:seed()},1000000);assert.equal(state.huntingLoot.copperOre,1000000);assert.equal(state.miningReceipt.bonus,0);
});
test('crafting and manual runic bonuses commit once; Auto awards and counts the same bonus',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());let now=1000000;t.mock.method(Date,'now',()=>now);
 const origin='https://tower.test';let cookie='',packet;
 async function request(path,body){const res=await handlePlayerApi(new Request(origin+'/api/player/'+path,{method:body?'POST':'GET',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}),{TOWER_DB:db});cookie=res.headers.get('set-cookie')?.split(';')[0]??cookie;const data=await res.json();if(res.ok&&data.state)packet=data;return {status:res.status,...data};}
 const session=await request('session',{legacy:{}});
 const write=async state=>{sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(state),session.characterKey);await request('state');};
 const action=(name,body={},operation=crypto.randomUUID())=>request('gameplay/'+name,{...body,revision:packet.revision,operation});
 await write(base());
 const fake=await request('save',{state:{...packet.state,mining:runic()},revision:packet.revision,operation:'fake'});assert.equal(fake.state.mining.pick,'iron');
 const revision=packet.revision,crafted=await action('mineCraft',{id:'runic'},'craft');assert.equal(crafted.status,200,crafted.error);assert.equal(crafted.state.mining.pick,'runic');
 for(const id of ['ironBar','runicFragment','uncutQuartz'])assert.equal(crafted.state.huntingLoot[id],0);assert.equal(crafted.state.woodcutting.timber,0);assert(crafted.state.mining.upgrades.includes('iron'));
 assert.equal((await request('gameplay/mineCraft',{id:'runic',revision,operation:'craft'})).state.mining.pick,'runic');assert.equal((await action('mineCraft',{id:'runic'})).status,400);
 await write({...packet.state,position:{x:2,y:7}});
 const cut=await action('mineStart',{node:'copper-west'});assert.equal(cut.state.miningCut.endsAt-cut.state.miningCut.started,2400);
 const state=structuredClone(packet.state);state.miningCut.id=seed();await write(state);now=state.miningCut.endsAt;
 const rev=packet.revision,before=structuredClone(packet.state),hit=await action('mineHit',{cutId:seed()},'hit');assert.equal(hit.status,200,hit.error);assert.equal(hit.state.huntingLoot.copperOre,2);assert.equal(hit.state.miningReceipt.bonus,1);assert.equal(hit.state.miningReceipt.xp,10);
 assert(worldActivityEvents(before,hit.state,now).some(e=>e.label==='+2 Copper Ore · Runic surge'));
 assert.equal((await request('gameplay/mineHit',{cutId:seed(),revision:rev,operation:'hit'})).state.huntingLoot.copperOre,2);
 const auto=structuredClone(packet.state);delete auto.miningCut;
 auto.plan={mining:{ore:'copperOre'},queue:{steps:[{type:'mining',amount:5}]},stepIndex:0,stepCount:0,miningWork:{phase:'walking',node:'copper-west',stand:{x:2,y:7}}};
 await advanceMiningWork(db,auto,now,{room:'quarry',x:2,y:7});assert.equal(auto.plan.miningWork.cut.endsAt-now,2400);auto.plan.miningWork.cut.id=seed();now=auto.plan.miningWork.cut.endsAt;
 const mutation=await advanceMiningWork(db,auto,now,{room:'quarry',x:2,y:7});assert(mutation);assert.equal(auto.plan.ores.copperOre,2);assert.equal(auto.huntingLoot.copperOre,4);assert.equal(auto.plan.miningXp,10);
});
