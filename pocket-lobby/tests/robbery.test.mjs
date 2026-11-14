import test from 'node:test';import assert from 'node:assert/strict';
import {testDatabase} from './db-helper.mjs';import {normalizeState} from '../server/player-state.mjs';import {robberyAction,prepareRobbery} from '../server/robbery.mjs';import {SharedRoom} from '../server/shared-room.mjs';import {equipmentStats,robberyChance} from '../public/robbery-rules.js';import {normalizeWardrobe} from '../public/wardrobe.js';import {protectFishingState} from '../server/gameplay.mjs';
const now=1000000,idA='a'.repeat(64),idB='b'.repeat(64),peerB='b'.repeat(24);
function character(extra={}){return normalizeState({location:'trail',position:{x:5,y:5},credits:300,characterCreated:true,actionPoints:{value:25,at:now,active:false},...extra});}
function fixture(){const {db,sql}=testDatabase();const a=character(),b=character({credits:200,position:{x:6,y:5}});for(const [id,s] of [[idA,a],[idB,b]])sql.prepare('INSERT INTO tower_players VALUES (?,?,1,?,?)').run(id,JSON.stringify(s),'fixture',now);
 const room={sessions:new Map([[{}, {playerId:idA,id:'a'.repeat(24),room:'trail',x:5,y:5}],[{}, {playerId:idB,id:peerB,room:'trail',x:6,y:5}]]),autoPeers:new Map()};
 const env={TOWER_DB:db,SHARED_ROOMS:{idFromName:x=>x,get:()=>({fetch:async r=>SharedRoom.prototype.robberyTarget.call(room,await r.json())})}};
 return {db,sql,a,b,room,env,row:id=>sql.prepare('SELECT * FROM tower_players WHERE player_id=?').get(id),body:{kind:'steal',target:peerB,operation:'attempt-1'}};}
test('success conserves gold, spends 10 AP, trains Stealth and protects the victim',()=>{
 const a=character(),b=character({credits:1000});const r=prepareRobbery(a,b,'success',now,()=>0);
 assert.equal(r.success,true);assert.equal(r.gold,25);assert.equal(a.credits+b.credits,1300);assert.equal(a.actionPoints.value,15);assert.equal(a.actionPoints.spent,10);assert.equal(a.stats.stealthXp,10);assert.equal(b.robbery.protectedUntil,now+600000);assert.equal(a.goldEarned,0);
});
test('failed attempts still spend AP, give less XP and protect the target',()=>{const a=character(),b=character();const r=prepareRobbery(a,b,'fail',now,()=>.999);assert.equal(r.success,false);assert.equal(r.gold,0);assert.equal(a.credits,300);assert.equal(b.credits,300);assert.equal(a.actionPoints.value,15);assert.equal(a.stats.stealthXp,3);assert(b.robbery.protectedUntil>now);});
test('invalid attempts cannot charge AP or touch protected gold',()=>{
 for(const [change,pattern] of [[a=>a.actionPoints.value=9,/10 AP/],[a=>a.robbery={lastAttemptAt:now-1},/Wait/],[a=>a.controlMode='auto',/Play/]]){const a=character(),b=character();change(a);const old=structuredClone(a);assert.throws(()=>prepareRobbery(a,b,'invalid',now,()=>0),pattern);assert.equal(a.actionPoints.value,old.actionPoints.value);assert.equal(b.credits,300);}
 const a=character(),b=character({credits:50});assert.throws(()=>prepareRobbery(a,b,'poor',now,()=>0),/no unprotected/);assert.equal(a.actionPoints.value,25);
 const target=character();target.robbery={protectedUntil:now+1};assert.throws(()=>prepareRobbery(a,target,'shield',now,()=>0),/protected/);
});
test('only owned and worn clothing affects Stealth/Luck; defense affects success',()=>{
 const a=character(),b=character(),plain=robberyChance(a,b);a.stats.stealthXp=500;assert(robberyChance(a,b)>plain);
 a.wardrobe=normalizeWardrobe();const outfit=a.wardrobe.outfits[0];a.wardrobe.owned.push('duskWrap','duskLeggings','duskBoots');Object.assign(outfit,{jacket:'duskWrap',trousers:'duskLeggings',boots:'duskBoots'});assert.equal(equipmentStats(a.wardrobe).stealth,6);
 b.wardrobe=structuredClone(a.wardrobe);assert(robberyChance(a,b)<robberyChance(a,character()));
 a.wardrobe.owned=a.wardrobe.owned.filter(id=>!id.startsWith('dusk'));assert.equal(equipmentStats(a.wardrobe).stealth,0);
 const lucky=character();lucky.stats.luckXp=500;assert(robberyChance(lucky,character())>plain);
});
test('live room proximity rejects far, hidden, missing and self targets',async()=>{
 const f=fixture();assert.equal((await SharedRoom.prototype.robberyTarget.call(f.room,{playerId:idA,target:peerB,room:'trail'})).status,200);
 const target=[...f.room.sessions.values()][1];target.x=9;assert.equal((await SharedRoom.prototype.robberyTarget.call(f.room,{playerId:idA,target:peerB,room:'trail'})).status,400);target.x=6;target.veilUntil=Date.now()+1000;
 assert.equal((await SharedRoom.prototype.robberyTarget.call(f.room,{playerId:idA,target:peerB,room:'trail'})).status,400);target.veilUntil=0;
 assert.equal((await SharedRoom.prototype.robberyTarget.call(f.room,{playerId:idA,target:'a'.repeat(24),room:'trail'})).status,400);f.sql.close();
});
test('the two-player transfer is atomic and retries do not double charge',async()=>{
 const f=fixture();const result=await robberyAction(f.env,f.row(idA),f.a,f.body,now,()=>0);assert.equal(result.receipt.gold,10);assert.equal(JSON.parse(f.row(idA).state_json).credits,310);assert.equal(JSON.parse(f.row(idB).state_json).credits,190);
 const retry=await robberyAction(f.env,f.row(idA),JSON.parse(f.row(idA).state_json),f.body,now+1,()=>0);assert.equal(retry.updated.revision,2);assert.equal(JSON.parse(f.row(idA).state_json).actionPoints.value,15);assert.equal(JSON.parse(f.row(idB).state_json).credits,190);f.sql.close();
});
test('concurrent revisions and database failure never partially transfer gold or spend AP',async()=>{
 const f=fixture(),stale=f.row(idA);f.sql.prepare('UPDATE tower_players SET revision=2 WHERE player_id=?').run(idA);
 await assert.rejects(robberyAction(f.env,stale,f.a,f.body,now,()=>0),/just moved or changed/);assert.equal(JSON.parse(f.row(idA).state_json).actionPoints.value,25);assert.equal(JSON.parse(f.row(idB).state_json).credits,200);
 f.sql.exec("CREATE TRIGGER fail_robbery BEFORE UPDATE ON tower_players WHEN NEW.player_id='"+idB+"' BEGIN SELECT RAISE(ABORT,'fixture failure'); END");await assert.rejects(robberyAction(f.env,f.row(idA),character(),f.body,now,()=>0));assert.equal(JSON.parse(f.row(idA).state_json).credits,300);assert.equal(JSON.parse(f.row(idB).state_json).credits,200);f.sql.close();
});
test('preview is free and player saves cannot forge Stealth or erase protection',async()=>{
 const f=fixture();const quote=await robberyAction(f.env,f.row(idA),f.a,{...f.body,kind:'preview'},now);assert.equal(quote.preview.ap,10);assert.equal(f.row(idA).revision,1);assert.equal(JSON.parse(f.row(idA).state_json).actionPoints.value,25);
 const before=character();before.robbery.protectedUntil=now+600000;before.stats.stealthXp=15;const forged=character();forged.stats.stealthXp=9999;forged.robbery.protectedUntil=0;const next=normalizeState(protectFishingState(before,forged));assert.equal(next.stats.stealthXp,15);assert.equal(next.robbery.protectedUntil,now+600000);f.sql.close();
});

test('higher Stealth and Luck increase the haul and equipment contributes',async()=>{
 const {robberyGold}=await import('../public/robbery-rules.js'),{skillXpForLevel}=await import('../public/skill-curve.js');
 const low=character(),stealth=character({stats:{stealthXp:skillXpForLevel(10)}}),lucky=character({stats:{luckXp:skillXpForLevel(10)}}),both=character({stats:{stealthXp:skillXpForLevel(10),luckXp:skillXpForLevel(10)}});
 assert.equal(robberyGold(1000,low),25);assert(robberyGold(1000,stealth)>25);assert(robberyGold(1000,lucky)>25);assert.equal(robberyGold(1000,both),97);
 const outfit=low.wardrobe.outfits[0];low.wardrobe.owned.push('duskWrap');outfit.jacket='duskWrap';assert(robberyGold(1000,low)>25);
 const victim=character({credits:1000}),receipt=prepareRobbery(both,victim,'scaled',now,()=>0);assert.equal(receipt.gold,97);assert.equal(victim.credits,903);assert.equal(both.actionPoints.value,15);
 assert.equal(robberyGold(50,both),0);assert.equal(robberyGold(51,both),1);assert(robberyGold(1000,character({stats:{stealthXp:4000000000000,luckXp:4000000000000}}))<=250);
});

test('the preview and the committed haul use the same stat-scaled calculation',async()=>{
 const {skillXpForLevel}=await import('../public/skill-curve.js'),f=fixture();f.a.stats.stealthXp=skillXpForLevel(8);f.a.stats.luckXp=skillXpForLevel(5);
 f.sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(f.a),idA);
 const preview=await robberyAction(f.env,f.row(idA),structuredClone(f.a),{...f.body,kind:'preview'},now);
 const attempt=await robberyAction(f.env,f.row(idA),structuredClone(f.a),f.body,now,()=>0);assert.equal(attempt.receipt.gold,preview.preview.gold);assert(attempt.receipt.gold>10);f.sql.close();
});

test('Lockbreaker requires a learned ability in the lobby and atomically records a timed room visit',async t=>{
 const f=fixture();t.after(()=>f.sql.close());
 f.a.styleAbilities={learned:['lockbreaker']};
 const body={...f.body,kind:'breakIn'};
 await assert.rejects(robberyAction(f.env,f.row(idA),f.a,body,now,()=>0),/Grand Lobby/);
 f.a.location=f.b.location='hub';
 f.b.homeFurniture=[{type:'bed',x:2,y:2,rot:0,id:'private-id'}];
 for(const meta of f.room.sessions.values())meta.room='hub';
 f.sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(f.b),idB);
 const preview=await robberyAction(f.env,f.row(idA),f.a,{...body,kind:'breakInPreview'},now);
 assert.equal(preview.preview.ap,20);assert.equal(preview.preview.visit,undefined);
 const result=await robberyAction(f.env,f.row(idA),f.a,body,now,()=>0);
 assert.deepEqual(result.receipt.visit.furniture,[{type:'bed',x:2,y:2,rot:0}]);
 assert.equal(result.receipt.visit.until,now+30000);
 const owner=JSON.parse(f.row(idB).state_json);
 assert.equal(owner.robbery.lastBreakIn.success,true);
 assert.equal(owner.robbery.lastBreakIn.visit,undefined);
 assert.equal(owner.credits,200);
 const updated=JSON.parse(result.updated.state_json);
 assert.equal(updated.actionPoints.value,5);assert.equal(updated.location,'hub');
 const retry=await robberyAction(f.env,result.updated,updated,body,now+1,()=>0);
 assert.equal(retry.updated.revision,2);
});

test('A failed Lockbreaker attempt charges AP and notifies the homeowner without revealing their room',async t=>{
 const f=fixture();t.after(()=>f.sql.close());
 f.a.location=f.b.location='hub';f.a.styleAbilities={learned:['lockbreaker']};
 for(const meta of f.room.sessions.values())meta.room='hub';
 f.sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(f.b),idB);
 const result=await robberyAction(f.env,f.row(idA),f.a,{...f.body,kind:'breakIn'},now,()=>.99);
 assert.equal(result.receipt.success,false);assert.equal(result.receipt.visit,undefined);
 const homeowner=JSON.parse(f.row(idB).state_json);
 assert.equal(homeowner.robbery.lastBreakIn.success,false);
 assert(homeowner.robbery.protectedUntil>now);
 assert.equal(JSON.parse(result.updated.state_json).actionPoints.value,5);
});
