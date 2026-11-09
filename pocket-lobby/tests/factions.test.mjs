import test from 'node:test';
import assert from 'node:assert/strict';
import {handlePlayerApi} from '../server/player-api.mjs';
import {testDatabase} from './db-helper.mjs';

test('players create, join, transfer and leave a shared faction without changing character saves',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());
 async function player(){
  let cookie='',characterKey;
  return async (path,body)=>{
   const response=await handlePlayerApi(new Request('https://tower.test/api/player/'+path,{
    method:body?'POST':'GET',headers:{Cookie:cookie,Origin:'https://tower.test','Content-Type':'application/json'},
    body:body?JSON.stringify({characterKey,...body}):undefined
   }),{TOWER_DB:db});
   cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;
   const data=await response.json();characterKey=data.characterKey??characterKey;
   return {status:response.status,...data};
  };
 }
 const first=await player(),second=await player();
 const saved=await first('session',{legacy:{avatar:{name:'Cedar',outfit:0,hair:0},stats:{leadershipXp:999}}});
 assert.equal(saved.state.stats.leadershipXp,0);
 assert.equal((await first('factions')).leadership.level,1);
 assert.match((await first('factions',{action:'create',name:'Moon Guard'})).error,/Leadership level 3/);
 const setXp=xp=>sql.prepare("UPDATE tower_players SET state_json=json_set(state_json,'$.stats.leadershipXp',?) WHERE player_id=?").run(xp,saved.characterKey);
 setXp(124);
 assert.equal((await first('factions',{action:'create',name:'Moon Guard'})).status,400);
 setXp(125);
 await second('session',{legacy:{avatar:{name:'Rowan',outfit:0,hair:0}}});
 const created=await first('factions',{action:'create',name:'Moon Guard',description:'Explore together'});
 assert.equal(created.status,200);assert.equal(created.membership.leader,1);assert.equal(created.leadership.level,3);
 assert.equal((await second('factions',{action:'create',name:'moon guard'})).status,400);
 const directory=await second('factions?q=moon');assert.equal(directory.factions.length,1);
 const {id}=directory.factions[0];
 const outcomes=await Promise.all([second('factions',{action:'join',id}),second('factions',{action:'join',id})]);
 assert.deepEqual(outcomes.map(result=>result.status).sort(),[200,400]);
 const roster=(await first('factions')).membership.roster;
 assert.deepEqual(roster.map(member=>member.name),['Cedar','Rowan']);
 assert(roster.every(member=>!Object.hasOwn(member,'player_id')));
 assert.equal((await first('factions',{action:'disband'})).status,400);
 assert.equal((await second('factions',{action:'transfer',id:roster[0].id})).status,400);
 assert.equal((await first('factions',{action:'transfer',id:roster[1].id})).membership.leader,0);
 assert.equal((await first('factions',{action:'leave'})).membership,null);
 const disbanded=await second('factions',{action:'disband'});assert.equal(disbanded.status,200);assert.deepEqual(disbanded.factions,[]);
 assert.equal((await first('state')).revision,saved.revision);
});
