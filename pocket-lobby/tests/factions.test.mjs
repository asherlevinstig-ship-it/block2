import test from 'node:test';
import assert from 'node:assert/strict';
import {handlePlayerApi} from '../server/player-api.mjs';
import {testDatabase} from './db-helper.mjs';
import {handleWorldConnect} from '../server/shared-room.mjs';
import {boot} from './helpers/game-client.mjs';
import {normalizeState} from '../server/player-state.mjs';

function player(db){
  let cookie='',characterKey;
  const call=async (path,body)=>{
   const response=await handlePlayerApi(new Request('https://tower.test/api/player/'+path,{
    method:body?'POST':'GET',headers:{Cookie:cookie,Origin:'https://tower.test','Content-Type':'application/json'},
    body:body?JSON.stringify({characterKey,...body}):undefined
   }),{TOWER_DB:db});
   cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;
   const data=await response.json();characterKey=data.characterKey??characterKey;
   return {status:response.status,...data};
  };
  call.cookie=()=>cookie;
  return call;
}


test('players pay once to register at Mira, then join, transfer and leave a shared faction',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());
 const first=player(db),second=player(db);
 const saved=await first('session',{legacy:{avatar:{name:'Cedar',outfit:0,hair:0},stats:{leadershipXp:999}}});
 assert.equal(saved.state.stats.leadershipXp,0);
 assert.equal((await first('factions')).leadership.level,1);
 assert.match((await first('factions',{action:'create',name:'Moon Guard'})).error,/Leadership level 3/);
 const setXp=xp=>sql.prepare("UPDATE tower_players SET state_json=json_set(state_json,'$.stats.leadershipXp',?) WHERE player_id=?").run(xp,saved.characterKey);
 setXp(124);
 assert.equal((await first('factions',{action:'create',name:'Moon Guard'})).status,400);
 setXp(125);
 const secondSaved=await second('session',{legacy:{avatar:{name:'Rowan',outfit:0,hair:0}}});
 assert.match((await first('factions',{action:'create',name:'Moon Guard'})).error,/Registrar Mira/);
 const setup=sql.prepare("UPDATE tower_players SET state_json=json_set(state_json,'$.location','hub','$.position',json_object('x',13,'y',5),'$.credits',?,'$.stats.leadershipXp',125) WHERE player_id=?");
 setup.run(249,saved.characterKey);
 assert.match((await first('factions',{action:'create',name:'Moon Guard'})).error,/250 gold/);
 setup.run(400,saved.characterKey);
 setup.run(400,secondSaved.characterKey);
 const creations=await Promise.all([first('factions',{action:'create',name:'Moon Guard',description:'Explore together'}),first('factions',{action:'create',name:'Moon Guard',description:'Explore together'})]);
 assert.deepEqual(creations.map(result=>result.status).sort(),[200,400]);
 const created=creations.find(result=>result.status===200);
 assert.equal(created.state.credits,150);
 assert.equal(created.founding.wallet,150);
 assert.equal(created.status,200);assert.equal(created.membership.leader,1);assert.equal(created.leadership.level,3);
 assert.equal((await second('factions',{action:'create',name:'moon guard'})).status,400);
 assert.equal((await second('state')).state.credits,400);
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
 assert.equal((await first('state')).revision,saved.revision+1);
 assert.equal((await first('state')).state.credits,150);
});

test('members fund the hall together, unlock the kitchen, and share a private room',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());
 const founder=player(db),member=player(db),visitor=player(db);
 const register=actor=>actor('session',{legacy:{avatar:{name:'Tester',outfit:0,hair:0}}});
 const [first,second,guest]=await Promise.all([register(founder),register(member),register(visitor)]);
 const seed=sql.prepare("UPDATE tower_players SET state_json=json_set(state_json,'$.location','hub','$.position',json_object('x',13,'y',5),'$.stats.leadershipXp',125,'$.credits',1200,'$.woodcutting.timber',200,'$.meals',json_object('grilledSilverfin',32,'towerBread',10),'$.fishStock',json_object('silverfin',2),'$.health',40) WHERE player_id=?");
 for(const session of [first,second,guest])seed.run(session.characterKey);
 const id=(await founder('factions',{action:'create',name:'Moon Guard'})).membership.id;
 assert.equal((await member('factions',{action:'join',id})).status,200);
 const act=async(actor,action,body={})=>actor('gameplay/'+action,{...body,operation:crypto.randomUUID(),revision:(await actor('state')).revision});
 const donate=(actor,resource,quantity,meal,operation=crypto.randomUUID())=>actor('factions',{action:'donate',id,resource,quantity,meal,operation});
 assert.equal((await act(member,'factionHall')).status,403);
 assert.equal((await donate(visitor,'gold',20)).status,400);
 assert.equal((await donate(founder,'meal',1,'towerBread')).status,400);
 const operation=crypto.randomUUID();
 const retries=await Promise.all([donate(founder,'gold',500,undefined,operation),donate(founder,'gold',500,undefined,operation)]);
 for(const result of retries){assert.equal(result.status,200);assert.equal(result.state.credits,450);}
 assert.equal((await donate(member,'gold',1)).status,400);
 assert.equal((await donate(member,'timber',100)).state.woodcutting.timber,100);
 const opened=await donate(member,'meal',20,'grilledSilverfin');
 assert.equal(opened.state.meals.grilledSilverfin,12);
 assert.equal(opened.membership.hall.open,true);assert.equal(opened.membership.hall.kitchen,false);
 assert.equal(opened.membership.hall.contributors.length,2);
 assert.equal(opened.membership.hall.project.progress.gold.target,300);
 const entered=await act(member,'factionHall');
 assert.equal(entered.status,200);assert.equal(entered.state.location,'factionHall');
 assert.equal((await member('factions',{action:'leave'})).status,400);
 assert.equal((await act(member,'cook',{id:'grilledSilverfin'})).status,403);
 const connected=async(actor,namespace)=>{
  const res=await handleWorldConnect(new Request('https://tower.test/api/world/connect?room=factionHall',{headers:{Cookie:actor.cookie(),Origin:'https://tower.test',Upgrade:'websocket'}}),{
   TOWER_DB:db,SHARED_ROOMS:{idFromName:name=>{assert.equal(name,namespace);return name;},get:()=>({fetch:()=>new Response('connected')})}
  });
  return res.status;
 };
 assert.equal(await connected(member,'faction:'+id),200);
 sql.prepare("UPDATE tower_players SET state_json=json_set(state_json,'$.location','factionHall') WHERE player_id=?").run(guest.characterKey);
 assert.equal(await connected(visitor,null),403);
 assert.equal((await donate(founder,'gold',300)).status,200);
 assert.equal((await donate(founder,'timber',60)).status,200);
 const complete=await donate(founder,'meal',12,'grilledSilverfin');
 assert.equal(complete.membership.hall.project,null);assert.equal(complete.membership.hall.kitchen,true);
 assert.equal((await donate(member,'timber',1)).status,400);
 const move=sql.prepare("UPDATE tower_players SET state_json=json_set(state_json,'$.position',json_object('x',?,'y',?)) WHERE player_id=?");
 move.run(7,3,second.characterKey);
 assert.equal((await act(member,'cook',{id:'grilledSilverfin'})).status,200);
 move.run(7,5,second.characterKey);
 const resting=await act(member,'factionRest');
 assert.equal(resting.status,200);assert(resting.state.hunting.recoveryUntil>0);
 const game=boot(normalizeState({location:'factionHall',position:{x:1,y:5}}));
 assert.equal(game.read('roomDoors.factionHall[0].to'),'hub');assert.deepEqual(game.errors,[]);
});
