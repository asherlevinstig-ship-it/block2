import test from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './db-helper.mjs';
import {changeGuildFeast,readGuildFeast} from '../server/guild-feast.mjs';
function setup(t){
 const {db,sql}=testDatabase();t.after(()=>sql.close());
 for(const id of ['a','b','outsider'])sql.prepare("INSERT INTO tower_players VALUES(?,?,1,'start',0)").run(id,JSON.stringify({avatar:{name:id},location:'factionHall',credits:1000,woodcutting:{timber:200},fishStock:{silverfin:20,trout_rare:3},meals:{},vitals:{hunger:10,mana:40}}));
 sql.prepare("INSERT INTO tower_factions(faction_id,name,name_key,description,leader_id,created_at) VALUES('guild','Guild','guild','','a',0)").run();
 sql.prepare("INSERT INTO tower_faction_members VALUES('b','b','guild',0)").run();
 sql.prepare("INSERT INTO tower_faction_donations VALUES('guild','a','build','gold','$.credits',500,0),('guild','a','wood','timber','$.woodcutting.timber',100,0),('guild','a','meals','meal','$.meals.test',20,0)").run();
 const state=id=>JSON.parse(sql.prepare('SELECT state_json FROM tower_players WHERE player_id=?').get(id).state_json);
 const act=(id,resource,quantity,operation=resource)=>changeGuildFeast(db,id,{action:'feastDonate',id:'guild',resource,quantity,fish:'silverfin',operation},1000);
 const claim=(id,operation='eat',now=1000)=>changeGuildFeast(db,id,{action:'feastClaim',id:'guild',operation},now);
 return {db,sql,state,act,claim};
}
test('feast shares supplies, names contributors, debits once and feeds every member once',async t=>{
 const {db,state,act,claim}=setup(t);
 await act('a','gold',60);await act('b','gold',40);await act('a','timber',20);await act('b','fish',10);
 const board=await readGuildFeast(db,'a','guild',1000);assert.equal(board.ready,true);assert.deepEqual(board.totals,{gold:100,timber:20,fish:10});assert.equal(board.contributors.length,4);
 assert.equal(state('b').fishStock.silverfin,10);await act('b','fish',10);assert.equal(state('b').fishStock.silverfin,10);
 await assert.rejects(act('b','fish',1,'extra'));
 await claim('a');await claim('a');await claim('b');assert.equal(state('a').vitals.hunger,60);assert.equal(state('b').vitals.hunger,60);assert.equal(state('a').vitals.mana,40);
 await assert.rejects(claim('a','again'));assert.equal((await readGuildFeast(db,'a','guild',1000)).claimed,true);
});
test('feast rejects remote, automated, invalid, nonmember and premature claims',async t=>{
 const {sql,state,act,claim}=setup(t);
 await assert.rejects(claim('a'));await assert.rejects(act('outsider','fish',1));await assert.rejects(act('a','fish',21));await assert.rejects(act('a','fish',-1));await assert.rejects(act('a','fish',1.5));
 for(const fragment of ["'$.location','hub'","'$.plan',json_object('job','fish')","'$.report',json_object('job','fish')"]){
  sql.prepare('UPDATE tower_players SET state_json=json_set(state_json,'+fragment+") WHERE player_id='b'").run();await assert.rejects(act('b','fish',1));sql.prepare("UPDATE tower_players SET state_json=json_remove(json_set(state_json,'$.location','factionHall'),'$.plan','$.report') WHERE player_id='b'").run();
 }
 assert.equal(state('b').fishStock.silverfin,20);
});
test('feast resets at UTC midnight and cannot overfill under competing donations',async t=>{
 const {db,act,claim}=setup(t);
 const outcomes=await Promise.allSettled([act('a','gold',100),act('b','gold',100)]);assert.equal(outcomes.filter(row=>row.status==='fulfilled').length,1);
 await act('a','timber',20);await act('b','fish',10);await claim('a');
 const next=await readGuildFeast(db,'a','guild',86400000);assert.equal(next.ready,false);assert.equal(next.claimed,false);assert.deepEqual(next.totals,{gold:0,timber:0,fish:0});await assert.rejects(claim('a','tomorrow',86400000));
});


test('full players preserve their meal and leaving and rejoining does not reset a claim',async t=>{
 const {db,sql,act,claim}=setup(t);
 await act('a','gold',100);await act('a','timber',20);await act('b','fish',10);
 sql.prepare("UPDATE tower_players SET state_json=json_set(state_json,'$.vitals.hunger',100) WHERE player_id='b'").run();await assert.rejects(claim('b'));
 assert.equal((await readGuildFeast(db,'b','guild',1000)).claimed,false);
 await claim('a');sql.prepare("DELETE FROM tower_faction_members WHERE player_id='a'").run();await assert.rejects(claim('a','new'));
 sql.prepare("INSERT INTO tower_faction_members VALUES('a','return','guild',0)").run();await assert.rejects(claim('a','new'));
});
