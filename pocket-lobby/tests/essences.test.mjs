import test from 'node:test';
import assert from 'node:assert/strict';
import {confluence,bondedEssences,essencePower,stoneForms,normalizeMagic} from '../public/essences.js';
import {normalizeState} from '../server/player-state.mjs';
import {handlePlayerApi} from '../server/player-api.mjs';
import {testDatabase} from './db-helper.mjs';
import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';

const gems=['fire','ice','shadow'];
const character=()=>normalizeState({
  location:'ruins',position:{x:5,y:4}
});
const act=(s,name,body={},now=1000)=>applyGameplayAction(s,name,body,now,()=>.5);

test('three distinct base Gems form an order-independent fourth, with five powers each',()=>{
  assert.equal(confluence(['shadow','fire','ice']).id,'eclipse');
  assert.equal(confluence(['fire','ice','storm']).id,'aurora');
  assert.equal(confluence(['fire','shadow','storm']).id,'emberstorm');
  assert.equal(confluence(['storm','shadow','ice']).id,'winterveil');
  assert.equal(confluence(['fire','fire','ice']),null);
  assert.equal(confluence(['fire','ice','eclipse']),null);
  const powers=bondedEssences(gems).flatMap(gem=>Object.keys(stoneForms).map(form=>essencePower(gem+':'+form)));
  assert.equal(new Set(powers.map(power=>power.name)).size,20);
  assert(essencePower('fire:sword',{strengthXp:150}).value>essencePower('fire:sword').value);
});

test('server bonds once, spends typed stones once, preserves unlocks across gem changes, and blocks forged snapshots',()=>{
  const s=character();
  assert.throws(()=>act(s,'bondEssences',{picks:['fire','fire','ice']}),/three/);
  s.location='shrine';
  assert.throws(()=>act(s,'bondEssences',{picks:gems}),/Moonwell/);
  s.location='ruins';
  act(s,'bondEssences',{picks:gems});
  assert.equal(s.magic.stones.sword,1);
  assert.throws(()=>act(s,'awakenPower',{id:'storm:sword'}),/bonded/);
  assert.throws(()=>act(s,'awakenPower',{id:'ice:shield'}),/matching/);
  act(s,'awakenPower',{id:'eclipse:sword'});
  assert.equal(s.magic.slots.q,'eclipse:sword');
  assert.equal(s.magic.stones.sword,0);
  assert.throws(()=>act(s,'awakenPower',{id:'eclipse:sword'}),/already/);
  assert.throws(()=>act(s,'equipPower',{id:'ice:sword'}),/Awaken/);
  const forged=protectFishingState(s,{...s,magic:normalizeMagic({picks:gems,stones:{sword:999},unlocked:['ice:sword'],equipped:'ice:sword'})});
  assert.deepEqual(forged.magic,s.magic);
  s.location='shrine';
  act(s,'bondEssences',{picks:['fire','ice','storm']});
  assert.equal(s.magic.stones.sword,0);
  assert.equal(s.magic.slots.q,null);
  assert.deepEqual(s.magic.unlocked,['eclipse:sword']);
});

test('server spell damage respects cooldown and awards a typed stone on a magic victory',()=>{
  const s=character();
  act(s,'bondEssences',{picks:gems});
  act(s,'awakenPower',{id:'fire:sword'});
  s.location='clearing';s.position={x:5,y:5};
  act(s,'fight',{},1000);
  const spell={combatId:s.combatId,input:'essence'};
  act(s,'combat',spell,1100);
  assert.equal(s.hunting.encounter.health,47);
  assert.equal(s.combatReceipt.events[0].power,'Fire Blade');
  act(s,'combat',spell,1200);
  assert.equal(s.hunting.encounter.health,47);
  assert.equal(s.combatReceipt.events.length,0);
  s.magic.cooldowns['fire:sword']=0;
  s.hunting.encounter.health=20;
  act(s,'combat',spell,1250);
  assert.equal(s.huntingLoot.boar,1);
  assert.equal(s.magic.stones.shield,1);
  assert.equal(s.combatReceipt.events[0].stone,'shield');
  act(s,'combat',spell,1300);
  assert.equal(s.magic.stones.shield,1);
});

test('shield, speed, focus and renewal alter actual combat state',()=>{
  for(const [form,check] of Object.entries({
    shield:s=>{assert.equal(s.hunting.encounter.magicWard,24);act(s,'combat',{combatId:s.combatId},2300);assert.equal(s.health,50);assert(s.combatReceipt.events.some(e=>e.warded>0));},
    speed:s=>{assert(s.hunting.encounter.stamina>75);assert.equal(s.hunting.encounter.nextPlayerAt,1150);},
    focus:s=>assert.equal(s.hunting.encounter.nextBoarAt,3850),
    renewal:s=>assert.equal(s.health,62)
  })){
    const s=character();
    act(s,'bondEssences',{picks:gems});
    s.magic.stones[form]=1;
    act(s,'awakenPower',{id:'ice:'+form});
    s.location='clearing';s.position={x:5,y:5};s.health=50;
    act(s,'fight');
    s.hunting.encounter.stamina=60;
    act(s,'combat',{combatId:s.combatId,input:'essence'},1100);
    check(s);
  }
});

test('old saves shed the retired magic while retaining Essence powers and an already scheduled woodcutting shift',async t=>{
  const {db,sql}=testDatabase();
  t.after(()=>sql.close());
  const origin='https://tower.test';
  let cookie='',packet;
  async function call(path,body,status=200){
    const response=await handlePlayerApi(new Request(origin+'/api/player/'+path,{
      method:body?'POST':'GET',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},
      body:body?JSON.stringify({...body,characterKey:packet?.characterKey}):undefined
    }),{TOWER_DB:db});
    assert.equal(response.status,status);
    cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;
    if(response.ok)packet=await response.json();
  }
  await call('session',{legacy:{location:'ruins',position:{x:5,y:4},woodcutting:{axeOwned:true,equipped:true}}});
  const send=(path,body)=>call(path,{...body,revision:packet.revision,operation:crypto.randomUUID()});
  await send('gameplay/bondEssences',{picks:gems});
  await send('gameplay/awakenPower',{id:'fire:sword'});
  const magic=structuredClone(packet.state.magic);
  const legacy=packet.state;
  legacy.adventure.rootstone={awakened:true,power:'deepRoots'};
  const now=Date.now();
  legacy.location='logging';
  legacy.plan={kind:'woodcutting',deepRoots:true,startedAt:now,endAt:now+60000,nextCutAt:now+45000,interval:45000,timber:0,xp:0,levelBefore:1};
  sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(legacy),packet.characterKey);
  await call('state');
  assert.equal(packet.state.adventure.rootstone,undefined);
  assert.equal(packet.state.plan.deepRoots,undefined);
  assert.equal(packet.state.plan.interval,45000);
  assert.deepEqual(packet.state.magic,magic);
  await send('plan/stop');
  assert.equal(packet.state.report.deepRoots,undefined);
  await send('report/ack',{startedAt:packet.state.report.startedAt});
  await send('save',{state:{...packet.state,location:'logging',adventure:{rootstone:{awakened:true,power:'deepRoots'}}}});
  await send('plan/start',{kind:'woodcutting',hours:1});
  assert.equal(packet.state.plan.interval,60000);
  assert.equal(packet.state.adventure.rootstone,undefined);
  assert.deepEqual(packet.state.magic,magic);
});


test('legacy spell and cooldown migrate to Q, with unique slots and cooldowns surviving swaps',()=>{
  const legacy={picks:gems,unlocked:['fire:sword','ice:shield'],equipped:'fire:sword',nextCastAt:9000};
  const magic=normalizeMagic(legacy);
  assert.deepEqual(magic.slots,{q:'fire:sword',e:null});
  assert.equal(magic.cooldowns['fire:sword'],9000);
  assert.deepEqual(normalizeMagic({...legacy,slots:{q:null,e:null}}).slots,{q:null,e:null});
  assert.equal(normalizeMagic({...legacy,slots:{q:'fire:sword',e:'fire:sword'}}).slots.e,null);
  const s=character();s.magic=magic;
  act(s,'equipPower',{id:'ice:shield',slot:'e'});
  act(s,'equipPower',{id:'fire:sword',slot:'e'});
  assert.deepEqual(s.magic.slots,{q:'ice:shield',e:'fire:sword'});
  assert.equal(s.magic.cooldowns['fire:sword'],9000);
  assert.throws(()=>act(s,'equipPower',{id:null,slot:'other'}),/Q or E/);
  act(s,'equipPower',{id:null,slot:'q'});
  assert.deepEqual(s.magic.slots,{q:null,e:'fire:sword'});
});

test('Ice Aegis and Fire Blade cast independently while both cooldowns are enforced',()=>{
  const s=character();
  act(s,'bondEssences',{picks:gems});
  act(s,'awakenPower',{id:'fire:sword'});
  s.magic.stones.shield=1;
  act(s,'awakenPower',{id:'ice:shield'});
  assert.deepEqual(s.magic.slots,{q:'fire:sword',e:'ice:shield'});
  s.location='clearing';s.position={x:5,y:5};
  act(s,'fight');
  const cast=slot=>act(s,'combat',{combatId:s.combatId,input:'essence',slot},1100);
  cast('e');cast('q');
  assert.equal(s.hunting.encounter.magicWard,24);
  assert.equal(s.hunting.encounter.health,47);
  assert.equal(s.magic.cooldowns['fire:sword'],7600);
  assert.equal(s.magic.cooldowns['ice:shield'],9600);
  cast('q');cast('e');
  assert.equal(s.combatReceipt.events.length,0);
  act(s,'combat',{combatId:s.combatId},2300);
  assert(s.combatReceipt.events.some(event=>event.warded>0));
});

test('Shadow Snare and Storm Rush chain before the enemy next attacks',()=>{
  const s=character();
  act(s,'bondEssences',{picks:['fire','shadow','storm']});
  s.magic.stones.focus=1;s.magic.stones.speed=1;
  act(s,'awakenPower',{id:'shadow:focus'});
  act(s,'awakenPower',{id:'storm:speed'});
  s.location='clearing';s.position={x:5,y:5};
  act(s,'fight');s.hunting.encounter.stamina=50;
  const before=s.hunting.encounter.nextBoarAt;
  for(const slot of ['q','e'])act(s,'combat',{combatId:s.combatId,input:'essence',slot},1100);
  assert.equal(s.hunting.encounter.nextBoarAt,before+1300);
  assert(s.hunting.encounter.stamina>85);
  assert.equal(s.hunting.encounter.nextPlayerAt,1150);
  assert.equal(s.magic.cooldowns['shadow:focus'],10100);
  assert.equal(s.magic.cooldowns['storm:speed'],8100);
});
