import test from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './db-helper.mjs';
import {saveSilverfinSupper,readSilverfinSupper,contributeSilverfinSupper,giftSilverfinSupper} from '../server/silverfin-supper.mjs';

test('supper requires both partners at the bakery and consumes and gifts only once',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());
 const now=Date.now();
 const state=position=>({avatar:{name:'Angler'},location:'bakery',position,health:100,fishStock:{silverfin:2},meals:{}});
 for(const [id,position] of [['a',{x:4,y:3}],['b',{x:1,y:1}],['c',{x:6,y:3}]]){
  sql.prepare("INSERT INTO tower_players VALUES (?,?,1,'create',?)").run(id,JSON.stringify(state(position)),now);
 }
 const row=id=>sql.prepare('SELECT * FROM tower_players WHERE player_id=?').get(id);
 const bag=id=>JSON.parse(row(id).state_json);
 const give=id=>contributeSilverfinSupper(db,row(id),'pair','silverfin',now);
 await saveSilverfinSupper(db,'pair','a','b',now).run();
 await assert.rejects(give('a'),/Both anglers/);
 assert.equal(bag('a').fishStock.silverfin,2);
 sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(state({x:6,y:3})),'b');
 await assert.rejects(give('c'),/Both anglers/);
 await give('a');await give('a');
 assert.equal(bag('a').fishStock.silverfin,1);
 assert.equal((await readSilverfinSupper(db,'b',now)).count,1);
 await give('b');await give('b');
 for(const id of ['a','b']){assert.equal(bag(id).fishStock.silverfin,1);assert.equal(bag(id).meals.silverfinSupper,1);}
 await giftSilverfinSupper(db,row('a'),'pair',now);await giftSilverfinSupper(db,row('a'),'pair',now);
 assert.equal(bag('a').meals.silverfinSupper,0);
 assert.equal(bag('b').meals.silverfinSupper,2);
 assert.equal((await readSilverfinSupper(db,'a',now)).gifted,true);
});
