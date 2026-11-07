import test from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './db-helper.mjs';
import {handlePlayerApi} from '../server/player-api.mjs';
import {applyGameplayAction} from '../server/gameplay.mjs';
import {normalizeState} from '../server/player-state.mjs';

test('the same Luck XP is available from wins and losses at either table, with a shared cooldown',()=>{
  const state=normalizeState({location:'lounge',position:{x:3,y:6},stats:{luckXp:48}});
  const act=(name,body,now,random)=>applyGameplayAction(state,name,body,now,random);
  const spin=(bet,now)=>{
    act('gamble',{game:'roulette',bet,color:'red'},now);
    return state.gambling.round.id;
  };
  const first=spin(5,1000);
  assert.throws(()=>act('gambleMove',{roundId:first,move:'reveal'},3399),/timing/);
  act('gambleMove',{roundId:first,move:'reveal'},3400,()=>0);
  assert.equal(state.gambling.round.outcome,'lose');
  assert.equal(state.stats.luckXp,50);
  assert.equal(state.credits,95);
  const second=spin(25,6000);
  act('gambleMove',{roundId:second,move:'reveal'},8400,()=>1.5/37);
  assert.equal(state.gambling.round.outcome,'win');
  assert.equal(state.gambling.round.luckXp,0);
  assert.equal(state.goldEarned,25);
  assert.equal(state.credits,120);
  state.position={x:6,y:4};
  const cards=[.2,.17,.16,.17];
  act('gamble',{game:'blackjack',bet:5},31000,()=>cards.shift());
  const hand=state.gambling.round;
  assert.equal(hand.status,'playing');
  act('gambleMove',{roundId:hand.id,move:'stand'},33400,()=>.2);
  assert.equal(state.gambling.round.luckXp,2);
  assert.equal(state.stats.luckXp,52);
});

test('saved rounds hide dealer cards, ignore forged Luck, and settle at most once',async t=>{
  const {db,sql}=testDatabase();t.after(()=>sql.close());
  let cookie='',packet;
  async function call(path,body){
    const response=await handlePlayerApi(new Request('https://tower.test/api/player/'+path,{
      method:body?'POST':'GET',headers:{Cookie:cookie,Origin:'https://tower.test','Content-Type':'application/json'},
      body:body?JSON.stringify({...body,characterKey:packet?.characterKey}):undefined
    }),{TOWER_DB:db});
    cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;
    const data=await response.json();if(response.ok)packet=data;
    return {status:response.status,data};
  }
  const command=(path,body)=>call(path,{...body,revision:packet.revision,operation:crypto.randomUUID()});
  await call('session',{legacy:{location:'lounge',position:{x:3,y:6},stats:{luckXp:500}}});
  assert.equal(packet.state.stats.luckXp,0);
  assert.equal((await command('gameplay/gamble',{game:'blackjack',bet:5})).status,400);
  await command('gameplay/gamble',{game:'roulette',bet:5,color:'black'});
  const id=packet.state.gambling.round.id;
  await command('save',{state:{...packet.state,stats:{luckXp:500},gambling:null}});
  assert.equal(packet.state.stats.luckXp,0);
  assert.equal(packet.state.gambling.round.id,id);
  // Advance only the server clock stored in the fixture.
  const stored=structuredClone(packet.state);
  stored.gambling.round.revealAt=0;
  sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(stored),packet.characterKey);
  const move={roundId:id,move:'reveal'};
  const results=await Promise.all([command('gameplay/gambleMove',move),command('gameplay/gambleMove',move)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  await call('state');
  const credits=packet.state.credits;
  await command('gameplay/gambleMove',move);
  assert.equal(packet.state.credits,credits);
  assert.equal(packet.state.stats.luckXp,2);
  assert.equal(packet.state.gambling.round.status,'complete');

  const handState={...packet.state,position:{x:6,y:4}};
  handState.gambling.round.startedAt=0;
  const cards=[.2,.17,.16,.17];
  applyGameplayAction(handState,'gamble',{game:'blackjack',bet:5},Date.now(),()=>cards.shift());
  sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(handState),packet.characterKey);
  const reloaded=await call('state');
  assert.equal(reloaded.data.state.gambling.round.dealer[1],null);
  await command('save',{state:packet.state});
  const databaseState=JSON.parse(sql.prepare('SELECT state_json FROM tower_players WHERE player_id=?').get(packet.characterKey).state_json);
  assert(databaseState.gambling.round.dealer[1]);
  assert.equal(packet.state.gambling.round.dealer[1],null);
});
