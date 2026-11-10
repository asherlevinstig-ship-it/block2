import test from 'node:test';
import assert from 'node:assert/strict';
import {testDatabase} from './db-helper.mjs';
import {normalizeState} from '../server/player-state.mjs';
import {readMillRaid,publicMillRaid,advanceMillRaid,writeMillRaid} from '../server/mill-raid.mjs';
import {millRaidClock,raidThreat,raidDanger} from '../public/mill-raid.js';
import {handlePlayerApi} from '../server/player-api.mjs';
import {SharedRoom} from '../server/shared-room.mjs';
const start=1200000+90000;
const player=name=>normalizeState({avatar:{name,outfit:0,hair:0},location:'millbrook',position:{x:5,y:4},health:100,combatGear:{ownedWeapons:['trainingSword'],equippedWeapon:'trainingSword'},quest:{accepted:true},vitals:{hunger:100,mana:100}});
const fresh=()=>({clock:millRaidClock(start),now:start,state:{wave:0,mobs:[],members:{},victoryAt:0}});
const action=(kind,extra={})=>({raidId:1,kind,...extra});
test('raid clock has warning, battle, deadline, and a fresh next event',()=>{
 assert.equal(millRaidClock(1200001).phase,'warning');assert.equal(millRaidClock(start).phase,'battle');assert.equal(millRaidClock(start+480000).phase,'quiet');assert.equal(millRaidClock(2400000).id,2);
 const threat=raidThreat(start,start+2500,2);assert.equal(threat.warning,true);assert(raidDanger({x:threat.x,y:6},threat));assert(!raidDanger({x:2,y:7},threat));
});
test('all waves are shared, scale to active defenders and grant one reward per contributor',()=>{
 const raid=fresh(),a=player('Ash'),b=player('Bee');let now=start+10;
 advanceMillRaid(raid,a,'a',action('strike',{target:'0-0'}),now);
 advanceMillRaid(raid,b,'b',action('strike',{target:'0-0'}),now);
 assert.equal(raid.state.members.a.damage,14);assert.equal(raid.state.members.b.damage,14);
 while(!raid.state.victoryAt){now+=1200;for(const [id,state] of [['a',a],['b',b]]){
  const target=raid.state.mobs.find(m=>m.hp>0);if(!target||raid.state.victoryAt)break;
  state.position={x:target.x,y:target.y+1};state.health=100;
  advanceMillRaid(raid,state,id,action('strike',{target:target.id}),now);
 }}
 assert.equal(raid.state.wave,2);assert.equal(raid.state.mobs[0].max,232);
 const before=a.credits;advanceMillRaid(raid,a,'a',action('claim'),now);advanceMillRaid(raid,b,'b',action('claim'),now);
 assert.equal(a.credits,before+75);assert.equal(a.stats.leadershipXp,10);
 assert.throws(()=>advanceMillRaid(raid,a,'a',action('claim'),now));
 const publicState=publicMillRaid(raid,'a');assert.equal(publicState.phase,'victory');assert.equal(publicState.contributors.length,2);assert(!JSON.stringify(publicState).includes('lastStrike'));
});
test('raid attacks respect danger tiles, armour, healing support, defeat, and action limits',()=>{
 const raid=fresh(),a=player('Ash'),b=player('Bee');
 advanceMillRaid(raid,a,'a',action('strike'),start+1);advanceMillRaid(raid,b,'b',action('strike',{target:'0-0'}),start+1);
 a.position={x:4,y:4};advanceMillRaid(raid,a,'a',action('tick'),start+4100);assert.equal(a.health,90);
 b.position={x:2,y:7};advanceMillRaid(raid,b,'b',action('tick'),start+4100);assert.equal(b.health,100);
 advanceMillRaid(raid,b,'b',action('heal'),start+4200);assert.equal(raid.state.members.b.support,1);assert.equal(b.vitals.mana,85);
 advanceMillRaid(raid,a,'a',action('tick'),start+4300);assert.equal(a.health,100);
 assert.throws(()=>advanceMillRaid(raid,b,'b',action('heal'),start+4500));
 a.health=1;a.position={x:5,y:4};advanceMillRaid(raid,a,'a',action('tick'),start+8100);assert.equal(a.health,1);assert.equal(raid.state.members.a.defeated,true);
 assert.throws(()=>advanceMillRaid(raid,a,'a',action('strike'),start+8200));
});
test('visitors cannot attack remotely, unarmed, after the deadline, or claim without contributing',()=>{
 const raid=fresh(),p=player('Ash');p.location='hub';assert.throws(()=>advanceMillRaid(raid,p,'a',action('strike'),start));p.location='millbrook';p.combatGear.equippedWeapon=null;assert.throws(()=>advanceMillRaid(raid,p,'a',action('strike'),start));assert.equal(Object.keys(raid.state.members).length,0);
 p.combatGear.equippedWeapon='trainingSword';raid.clock=millRaidClock(start+480001);assert.throws(()=>advanceMillRaid(raid,p,'a',action('strike'),start+480001));
 raid.state.victoryAt=start+100;assert.throws(()=>advanceMillRaid(raid,p,'a',action('claim'),start+480001));
});
test('atomic raid writes merge concurrent defenders and never debit a stale player',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());
 for(const id of ['a','b'])sql.prepare("INSERT INTO tower_players VALUES(?,?,1,'start',0)").run(id,JSON.stringify(player(id)));
 const row=id=>sql.prepare('SELECT * FROM tower_players WHERE player_id=?').get(id);
 const results=await Promise.all(['a','b'].map(id=>writeMillRaid(db,row(id),{...action('strike',{target:'0-0'}),operation:id},start+1)));
 assert(results.every(result=>result?.updated));const raid=await readMillRaid(db,start+1);assert.equal(raid.state.mobs[0].hp,14);assert.equal(Object.keys(raid.state.members).length,2);
 const stale={...row('a'),revision:1},before=raid.version;
 assert.equal(await writeMillRaid(db,stale,{...action('strike',{target:'0-0'}),operation:'stale'},start+1200),null);
 assert.equal((await readMillRaid(db,start+1200)).version,before);
});
test('the authenticated raid API returns shared state and retries an operation without a second hit',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());const realNow=Date.now;Date.now=()=>start+100;t.after(()=>{Date.now=realNow;});
 let cookie='';const call=async body=>{const response=await handlePlayerApi(new Request('https://tower.test/api/player/'+(cookie?'mill-raid':'session'),{method:body?'POST':'GET',headers:{Origin:'https://tower.test',Cookie:cookie,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}),{TOWER_DB:db});cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;return {status:response.status,...await response.json()};};
 const session=await call({legacy:{avatar:{name:'Defender',outfit:0,hair:0}}});assert.equal(session.status,200);
 sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(player('Defender')),session.characterKey);
 const get=await call();assert.equal(get.raid.mobs.length,2);assert.equal(get.raid.phase,'battle');
 const body={...action('strike',{target:'0-0'}),characterKey:session.characterKey,revision:session.revision,operation:'one-hit'};
 const hit=await call(body);assert.equal(hit.status,200);assert.equal(hit.raid.self.damage,14);
 assert.equal((await call(body)).status,200);assert.equal((await call()).raid.self.damage,14);
 assert.equal((await call({...body,operation:'stale'})).status,409);
});
test('equipped essence powers spend mana, use cooldowns and affect raid targets',()=>{
 const raid=fresh(),p=player('Mage');p.magic={picks:['fire','ice','shadow'],unlocked:['fire:sword','ice:shield'],slots:{q:'fire:sword',e:'ice:shield'},cooldowns:{}};
 advanceMillRaid(raid,p,'a',action('strike'),start+1);
 const before=raid.state.mobs[0].hp;advanceMillRaid(raid,p,'a',action('power',{slot:'q',target:'0-0'}),start+2);
 assert(raid.state.mobs[0].hp<before);assert.equal(p.vitals.mana,90);assert(p.magic.cooldowns['fire:sword']>start+2);
 assert.throws(()=>advanceMillRaid(raid,p,'a',action('power',{slot:'q',target:'0-0'}),start+3));
 advanceMillRaid(raid,p,'a',action('power',{slot:'e'}),start+4);assert(raid.state.members.a.shield>0);
});
test('raid room broadcasts identical shared health and public attack cues to every viewer',async()=>{
 const room=new SharedRoom({getWebSockets:()=>[],storage:{get:async()=>null,put:async()=>{}},blockConcurrencyWhile:fn=>fn()},{}),messages=[[],[]];
 for(let i=0;i<2;i++)room.sessions.set({send:text=>messages[i].push(JSON.parse(text))},{playerId:'private-'+i,id:'public-'+i});
 await room.fetch(new Request('https://room.internal/raid',{method:'POST',body:JSON.stringify({raid:{id:1,mobs:[{id:'0-0',hp:20}]},playerId:'private-0',receipt:{hit:14},cast:false})}));
 assert.deepEqual(messages[0],messages[1]);assert.equal(messages[0][0].cue.player,'public-0');assert.equal(messages[0][0].cue.hit,14);assert(!JSON.stringify(messages).includes('private-'));
});
