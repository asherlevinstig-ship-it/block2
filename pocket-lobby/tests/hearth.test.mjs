import test from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './db-helper.mjs';
import {changeHearth,readHearth,settleHearth} from '../server/hearth.mjs';
import {normalizeState} from '../server/player-state.mjs';

test('hearth acceptance consumes one meal and heals both players over five ticks',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());
 const now=1000000;
 const insert=sql.prepare('INSERT INTO tower_players VALUES (?,?,1,?,?)');
 const row=id=>sql.prepare('SELECT * FROM tower_players WHERE player_id=?').get(id);
 const state=id=>JSON.parse(row(id).state_json);
 for(const [id,x] of [['host',4],['guest',6]]){
  insert.run(id,JSON.stringify(normalizeState({location:'waystation',position:{x,y:5},health:60,actionPoints:{value:4},
   woodcutting:{timber:8},meals:id==='host'?{boarStew:1}:{},styleAbilities:{learned:id==='host'?['shareHearth']:[]}})),'create',now);
 }
 for(let i=0;i<8;i++)sql.prepare('INSERT INTO tower_waystation_donations (player_id,operation,site,name,at) VALUES (?,?,?,?,?)').run('host','fire:'+i,'fire','Host',now);
 const room={fetch:async request=>Response.json({playerId:(await request.json()).playerId==='host'?'guest':'host'})};
 const env={TOWER_DB:db,SHARED_ROOMS:{idFromName:()=>0,get:()=>room}};
 await changeHearth(env,row('host'),{kind:'invite',operation:'invite',meal:'boarStew',peer:'a'.repeat(24)},now);
 assert.equal(state('host').meals.boarStew,1);
 assert.equal((await readHearth(db,'guest',now)).incoming.length,1);
 await assert.rejects(changeHearth(env,row('host'),{kind:'accept',id:'invite'},now),/expired/);
 await changeHearth(env,row('guest'),{kind:'accept',id:'invite',operation:'accept'},now);
 await changeHearth(env,row('guest'),{kind:'accept',id:'invite',operation:'retry'},now);
 assert.equal(state('host').meals.boarStew,0);
 assert.equal(state('host').styleAbilities.readyAt.shareHearth,now+180000);
 for(const id of ['host','guest']){
  const saved=normalizeState(state(id));
  assert.equal(saved.actionPoints.value,4);
  assert.equal(settleHearth(saved,now+2000),true);assert.equal(saved.health,68);
  assert.equal(settleHearth(saved,now+5000),true);assert.equal(saved.health,80);
  assert.equal(saved.styleAbilities.hearth,undefined);
 }
});
