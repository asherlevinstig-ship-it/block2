import test from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './db-helper.mjs';
import {handlePlayerApi} from '../server/player-api.mjs';
import {normalizeState} from '../server/player-state.mjs';
import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';
import {trailCamp,trailCampPhase} from '../public/trail-camp.js';
import {publicRoomNamespace} from '../server/shared-trees.mjs';

const start=1000000,origin='https://tower.test';
const visitor=(name='Avery')=>normalizeState({
  avatar:{name,outfit:0,hair:0},location:trailCamp.room,position:{x:trailCamp.x,y:trailCamp.y+1},
  health:35,vitals:{mana:0,manaAt:start,hunger:42},woodcutting:{timber:6},fishStock:{silverfin:1}
});
async function connect(env,sql,name){
  let cookie='',packet;
  const request=async(path,body)=>{
    const response=await handlePlayerApi(new Request(origin+'/api/player/'+path,{
      method:body?'POST':'GET',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},
      body:body?JSON.stringify(body):undefined
    }),env);
    cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;
    const data=await response.json();
    if(response.ok&&data.state)packet=data;
    return {status:response.status,...data};
  };
  const session=await request('session',{legacy:{avatar:{name,outfit:0,hair:0}}});
  assert.equal(session.status,200);
  sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(visitor(name)),session.characterKey);
  return {request,action:(name,body={},operation=crypto.randomUUID())=>request('gameplay/'+name,{...body,operation,revision:packet.revision,characterKey:packet.characterKey})};
}

test('the shared camp accepts concurrent fuel, broadcasts the timer and prevents double spending',async t=>{
  const {db,sql}=testDatabase();t.after(()=>sql.close());
  t.mock.method(Date,'now',()=>start);
  const sent=[],env={TOWER_DB:db,SHARED_ROOMS:{idFromName:name=>name,get:room=>({fetch:async req=>{
    sent.push({room,...await req.json()});return Response.json({ok:true});
  }})}};
  const a=await connect(env,sql,'Avery'),b=await connect(env,sql,'Briar');
  assert.equal((await a.request('trail-camp')).camp.litUntil,0);
  const both=await Promise.all([a.action('campRefuel',{},'same'),b.action('campRefuel',{},'same')]);
  assert(both.every(result=>result.status===200&&result.state.woodcutting.timber===4));
  assert.equal((await a.request('trail-camp')).camp.litUntil,start+2*trailCamp.burnMs);
  assert.equal((await a.action('campRefuel',{},'same')).state.woodcutting.timber,4);
  assert.equal((await a.action('campRefuel')).camp.litUntil,start+trailCamp.maxMs);
  assert.equal((await b.action('campRefuel')).status,400);
  assert.equal((await b.request('state')).state.woodcutting.timber,4);
  assert(sent.some(event=>event.room===publicRoomNamespace(trailCamp.room)&&event.litUntil===start+trailCamp.maxMs));
});

test('other players can cook and finish a rest while the shared fire burns',async t=>{
  const {db,sql}=testDatabase();t.after(()=>sql.close());
  let clock=start;t.mock.method(Date,'now',()=>clock);
  const env={TOWER_DB:db},a=await connect(env,sql,'Avery'),b=await connect(env,sql,'Briar');
  assert.equal((await b.action('campRest')).status,400);
  assert.equal((await b.action('cook',{id:'grilledSilverfin'})).status,400);
  const {camp}=await a.action('campRefuel');
  assert.equal((await b.action('cook',{id:'grilledSilverfin'})).state.meals.grilledSilverfin,1);
  const rest=await b.action('campRest');
  assert.equal(rest.state.campRest.endsAt,start+trailCamp.restMs);
  clock=start+trailCamp.restMs-1;
  assert.equal((await b.request('state')).state.health,35);
  clock++;
  const {state}=await b.request('state');
  assert.equal(state.health,100);assert.equal(state.vitals.mana,100);assert.equal(state.vitals.hunger,42);
  assert.equal(state.campRest,undefined);
  assert.equal(trailCampPhase(camp.litUntil,camp.litUntil-trailCamp.emberMs),'embers');
  clock=camp.litUntil;
  assert.equal(trailCampPhase(camp.litUntil,clock),'cold');
  assert.equal((await b.action('cook',{id:'grilledSilverfin'})).status,400);
});

test('rest needs a nearby warm camp and can be cancelled before recovery',()=>{
  const state=visitor(),camp={litUntil:start+trailCamp.restMs};
  state.position={x:1,y:4};
  assert.throws(()=>applyGameplayAction(state,'campRest',{},start,Math.random,{camp}),/Walk beside/);
  state.position={x:trailCamp.x,y:trailCamp.y+1};
  assert.throws(()=>applyGameplayAction(state,'campRest',{},start+1,Math.random,{camp}),/another 12 seconds/);
  applyGameplayAction(state,'campRest',{},start,Math.random,{camp});
  const next=normalizeState({location:'hub'});
  protectFishingState(state,next);
  assert.equal(next.location,'ruins');assert.deepEqual(next.campRest,state.campRest);
  applyGameplayAction(state,'campStand',{},start+1000);
  assert.equal(state.health,35);assert.equal(state.campRest,undefined);assert.equal(state.hunting.recoveryUntil,0);
});
