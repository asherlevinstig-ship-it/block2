import test from 'node:test';import assert from 'node:assert/strict';
import {furnitureCatalog,purchaseFurniture} from '../public/furniture-catalog.js';
import {normalizeState} from '../server/player-state.mjs';import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';
import {socialRooms,roomBoxes,reachableMove} from '../public/shared-world.js';
import {handlePlayerApi} from '../server/player-api.mjs';import {testDatabase} from './db-helper.mjs';import {boot} from './helpers/game-client.mjs';
test('all furniture purchases charge the catalogue price and preserve existing placed and free items',()=>{
 for(const [id,item] of Object.entries(furnitureCatalog)){
  const s=normalizeState({credits:10000,location:'furnishings'}),before=s.ownedFurniture[id]??0,q=id==='safe'?1:2;
  applyGameplayAction(s,'buyFurniture',{id,quantity:q,price:0},1000);assert.equal(s.credits,10000-item.price*q);assert.equal(s.ownedFurniture[id],before+q);assert.equal(s.ownedFurniture.bed,id==='bed'?3:1);assert.deepEqual(s.homeFurniture,[]);assert.equal(s.goldEarned,0);
  assert.deepEqual(normalizeState(s).ownedFurniture,s.ownedFurniture);
  const placed={id:1,type:id,x:4,y:4,rot:1};
  const home=normalizeState(protectFishingState(s,{...structuredClone(s),location:'home',homeFurniture:[placed]}));
  assert.deepEqual(home.homeFurniture,[placed]);
  const [w,d]=item.size;
  assert.deepEqual(roomBoxes('home',home.homeFurniture),[{x:4,y:4,w:d,d:w}]);
 }
});
test('invalid orders, low wallet balances, bank-only wealth and activity locks leave the character unchanged',()=>{
 for(const body of [{id:'moonbloom',quantity:1},{id:'__proto__',quantity:1},{id:'sofa',quantity:0},{id:'sofa',quantity:-1},{id:'sofa',quantity:1.5},{id:'sofa',quantity:100},{id:'safe',quantity:2}]){
  const s=normalizeState({credits:10000,location:'furnishings'}),before=structuredClone(s);assert.throws(()=>applyGameplayAction(s,'buyFurniture',body,1000),/Choose|already/);assert.deepEqual(s,before);
 }
 for(const change of [{credits:119,bank:{gold:10000}},{location:'market'},{location:'home'},{location:'hub'},{plan:{source:'rules'}},{report:{}},{fishingCast:{}},{timberCut:{}},{hunting:{encounter:{}}},{hunting:{recoveryUntil:2000}},{health:0},{gambling:{round:{status:'playing'}}}]){
  const s={...normalizeState({credits:1000,location:'furnishings'}),...change},before=structuredClone(s);assert.throws(()=>purchaseFurniture(s,'sofa',1),/Invalid|Travel/);assert.deepEqual(s,before);
 }
 const s=normalizeState({credits:10000,location:'furnishings',ownedFurniture:{sofa:1000000}});assert.throws(()=>purchaseFurniture(s,'sofa',1),/full/);assert.equal(s.credits,10000);
});
test('shop safe and home safe purchases share one ownership limit',()=>{
 const s=normalizeState({credits:500,location:'furnishings'});applyGameplayAction(s,'buySafe',{},1000);assert.throws(()=>purchaseFurniture(s,'safe',1),/already/);assert.equal(s.credits,350);
 const other=normalizeState({credits:500,location:'furnishings'});purchaseFurniture(other,'safe',1);assert.throws(()=>applyGameplayAction(other,'buySafe',{},1000),/already/);assert.equal(other.credits,350);
});
test('save snapshots cannot mint furniture or place more copies than the player owns',()=>{
 const s=normalizeState({credits:500,location:'furnishings'});purchaseFurniture(s,'sofa',1);
 const one={id:1,type:'sofa',x:2,y:2,rot:0};const saved=protectFishingState(s,{...structuredClone(s),ownedFurniture:{sofa:999},homeFurniture:[one]});assert.equal(saved.ownedFurniture.sofa,1);
 assert.throws(()=>protectFishingState(s,{...structuredClone(s),homeFurniture:[one,{...one,id:2,x:5}]}),/ownership/);
 assert.throws(()=>protectFishingState(s,{...structuredClone(s),homeFurniture:[{...one,type:'lamp'}]}),/ownership/);
});
test('showroom is connected to the lobby, has a clear exit and renders every product and preview rotation',()=>{
 const s=normalizeState({location:'furnishings',quest:{accepted:true}}),g=boot(s);assert.deepEqual(socialRooms.furnishings,[10,10]);assert.equal(g.read('currentRoom'),'furnishings');assert.equal(g.read("hudRoute('home').map(d=>d.to).join(',')"),'hub,home');
 assert.deepEqual(JSON.parse(g.read('JSON.stringify(roomFurniture().map(item=>({x:item.x,y:item.y,...(()=>{const [w,d]=dimensions(item);return {w,d};})()})))')),roomBoxes('furnishings'));
 assert(reachableMove('furnishings',{x:5,y:7},{x:0,y:5},roomBoxes('furnishings'),40));
 for(const id of Object.keys(furnitureCatalog))for(let rot=0;rot<4;rot++)g.run('window.towerFurniturePreview('+JSON.stringify(id)+','+rot+')');
 g.run("enterRoom('hub');enterRoom('furnishings');");assert.deepEqual(g.errors,[]);
});
test('API retries and concurrent furniture purchases charge and deliver exactly once',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());const base='https://tower.test';let packet,cookie='';
 async function call(path,body){const r=await handlePlayerApi(new Request(base+'/api/player/'+path,{method:body?'POST':'GET',headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify({...body,characterKey:packet?.characterKey}):undefined}),{TOWER_DB:db});cookie=r.headers.get('set-cookie')?.split(';')[0]??cookie;const data=await r.json();if(r.ok)packet=data;return {status:r.status,...data};}
 await call('session',{legacy:{credits:500,location:'furnishings'}});const order={id:'sofa',quantity:2,revision:packet.revision,operation:crypto.randomUUID()};assert.equal((await call('gameplay/buyFurniture',order)).status,200);assert.equal((await call('gameplay/buyFurniture',order)).status,200);assert.equal(packet.state.credits,260);assert.equal(packet.state.ownedFurniture.sofa,2);
 const revision=packet.revision,results=await Promise.all([1,2].map(()=>call('gameplay/buyFurniture',{revision,operation:crypto.randomUUID(),id:'safe',quantity:1})));assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);await call('state');assert.equal(packet.state.credits,110);assert.equal(packet.state.ownedFurniture.safe,1);assert.equal(packet.state.ownedFurniture.sofa,2);
});

test('walking to each lobby shop or home never crosses another shop doorway',()=>{
 const g=boot(normalizeState({location:'hub',quest:{accepted:true}}));
 for(const to of ['home','furnishings','market','store','armory','lounge']){
  const path=JSON.parse(g.read("JSON.stringify(walkingPath({x:8,y:12},hubDoors.find(d=>d.to==="+JSON.stringify(to)+").tile))"));assert(path.length>0);
  const forbidden=JSON.parse(g.read("JSON.stringify(hubDoors.filter(d=>d.to!=="+JSON.stringify(to)+").map(d=>d.tile))"));assert(path.every(p=>!forbidden.some(d=>d.x===p.x&&d.y===p.y)),to+' crosses a different exit');
 }
 assert.deepEqual(g.errors,[]);
});

test('a room connection correction preserves an active walking destination',()=>{
 const g=boot(normalizeState({location:'hub',quest:{accepted:true}}));
 g.run("walkTo(hubDoors.find(d=>d.to==='furnishings').tile);correctRoomPosition({x:8,y:12})");
 assert.equal(g.read("target.x+','+target.y"),'9,0');assert(g.read('route.length>0'));assert.equal(g.read("route.at(-1).x+','+route.at(-1).y"),'9,0');
 g.run('route=[];step=null;target=null;correctRoomPosition({x:8,y:12})');assert.equal(g.read('route.length'),0);assert.deepEqual(g.errors,[]);
});
