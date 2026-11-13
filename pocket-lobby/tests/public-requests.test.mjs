import test from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './db-helper.mjs';
import {normalizeState} from '../server/player-state.mjs';
import {deliverPublicRequest,readPublicRequests} from '../server/public-requests.mjs';
import {moonwood} from '../public/moonwood.js';
import {townContributionRecord} from '../public/public-requests.js';

test('the final bridge delivery pays only one player and opens both shortcut entrances',async t=>{
  const {db,sql}=testDatabase();
  t.after(()=>sql.close());
  sql.exec("UPDATE tower_public_projects SET delivered=110");
  const state=()=>normalizeState({location:'market',woodcutting:{timber:10}});
  const insert=sql.prepare('INSERT INTO tower_players(player_id,state_json,revision,last_request,updated_at) VALUES(?,?,1,?,1)');
  for(const id of ['a','b'])insert.run(id,JSON.stringify(state()),'initial');
  const load=id=>sql.prepare('SELECT * FROM tower_players WHERE player_id=?').get(id);
  const results=await Promise.all(['a','b'].map(id=>deliverPublicRequest(db,load(id),state(),'bridge','delivery',1000)));
  assert.equal(results.filter(Boolean).length,1);
  const saved=['a','b'].map(id=>JSON.parse(load(id).state_json));
  assert.deepEqual(saved.map(s=>s.woodcutting.timber).sort((a,b)=>a-b),[0,10]);
  assert.deepEqual(saved.map(s=>s.credits).sort((a,b)=>a-b),[100,148]);
  assert.deepEqual(await readPublicRequests(db),{delivered:120,target:120,open:true});
  const records=saved.map(state=>townContributionRecord(normalizeState(state).publicRequests));
  assert.equal(records.filter(record=>record.length===0).length,1);
  assert.deepEqual(records.find(record=>record.length),[{id:'bridge',title:'Silverfin Bridge',quantity:10,material:'timber'}]);
  for(const [from,to] of [['trail','pond'],['pond','trail']]){
    const door=moonwood.doors[from].find(door=>door.to===to);
    assert.equal(moonwood.open(door,{}),false);
    assert.equal(moonwood.open(door,{publicPondBridge:true}),true);
    assert(!moonwood.blocked(to,door.arrival.x,door.arrival.y,{}));
  }
});
