import test from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './db-helper.mjs';
import {sendGift} from '../server/gifts.mjs';
test('gifting commits both bags and preserves one receipt on retries',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());
 const add=(id,count)=>sql.prepare("INSERT INTO tower_players VALUES (?,?,1,'create',0)").run(id,JSON.stringify({avatar:{name:id},health:100,location:'pond',fishStock:{silverfin:count},meals:{},actionPoints:{value:5}}));
 add('sender',4);add('recipient',0);
 const row=id=>sql.prepare('SELECT * FROM tower_players WHERE player_id=?').get(id);
 const env={TOWER_DB:db,SHARED_ROOMS:{idFromName:n=>n,get:()=>({fetch:async()=>Response.json({playerId:'recipient'})})}};
 const body={target:'a'.repeat(24),kind:'fish',item:'silverfin',quantity:2,operation:'gift-one'};
 const first=await sendGift(env,row('sender'),body);
 assert.equal(first.receipt.quantity,2);
 assert.deepEqual((await sendGift(env,row('sender'),body)).receipt,first.receipt);
 await assert.rejects(sendGift(env,row('sender'),{...body,operation:'gift-two',quantity:3}),/do not have/);
 for(const id of ['sender','recipient']){
  const save=JSON.parse(row(id).state_json);
  assert.equal(save.fishStock.silverfin,2);
  assert.equal(save.actionPoints.value,5);
 }
});
