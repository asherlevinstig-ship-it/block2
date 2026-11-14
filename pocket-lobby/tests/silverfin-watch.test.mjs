import test from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './db-helper.mjs';
import {handlePlayerApi} from '../server/player-api.mjs';
import {readFactionSilverfin} from '../server/silverfin-watch.mjs';

test('two distinct pond catches complete the watch, keep fish and credit the faction at catch time',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());
 const original=Date.now;let now=1700000000000;Date.now=()=>now;t.after(()=>{Date.now=original;});
 const origin='https://tower.test';
 async function player(name){
  let cookie='',packet;
  async function call(path,body){
   const response=await handlePlayerApi(new Request(origin+'/api/player/'+path,{method:body?'POST':'GET',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),{TOWER_DB:db});
   const result=await response.json();assert.equal(response.status,200,result.error);
   cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;
   if(result.state)packet=result;
   return result;
  }
  await call('session',{legacy:{avatar:{name,outfit:0,hair:0}}});
  const state={...packet.state,location:'pond',position:{x:4,y:5},fishingGear:{...packet.state.fishingGear,bait:6}};
  sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(state),packet.characterKey);
  const act=(action,body={})=>call('gameplay/'+action,{...body,operation:crypto.randomUUID(),revision:packet.revision,characterKey:packet.characterKey});
  return {call,act,id:packet.characterKey,async fish(){
   const {state}=await act('cast');
   const cast=state.fishingCast;now=cast.landAt+901;
   return act('catch',{castId:cast.id});
  }};
 }
 const a=await player('Ari'),b=await player('Bea'),c=await player('Cora');
 sql.prepare('INSERT INTO tower_factions(faction_id,name,name_key,description,leader_id,created_at) VALUES (?,?,?,?,?,?)').run('river','River Guild','river guild','Fish together',a.id,now);
 const first=await a.fish();assert.equal(first.silverfinWatch.complete,false);await a.act('catch',{castId:first.state.fishingReceipt.castId});await a.fish();
 assert.equal((await b.call('silverfin-watch')).watch.contributors.length,1);
 const second=await b.fish();assert.equal(second.silverfinWatch.complete,true);
 assert.equal(Object.values(second.state.fishStock).reduce((a,b)=>a+b,0),1);
 await c.fish();
 const {watch}=await b.call('silverfin-watch');assert(watch.complete);
 assert.deepEqual(watch.contributors.map(p=>[p.name,p.faction]).sort(),[['Ari','River Guild'],['Bea',null]]);
 assert.equal(watch.contributors.find(p=>p.name==='Bea').self,1);
 assert.deepEqual(await readFactionSilverfin(db,'river',now),{total:1,today:1});
 now+=86400000;
 assert.deepEqual((await a.call('silverfin-watch')).watch.contributors,[]);
 assert.deepEqual(await readFactionSilverfin(db,'river',now),{total:1,today:0});
});
