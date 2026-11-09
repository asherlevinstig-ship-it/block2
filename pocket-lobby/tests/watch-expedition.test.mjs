import {testDatabase} from './db-helper.mjs';import {handlePlayerApi} from '../server/player-api.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {moonwood} from '../public/moonwood.js';import {watchRooms,watchFlags,watchInteractLabel} from '../public/region-catalog.js';
import {roomBoxes,validRoomTile,socialRooms} from '../public/shared-world.js';
import {normalizeState} from '../server/player-state.mjs';import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';
import {huntEnemies,huntEnemyForRoom} from '../public/hunting.js';import {boot} from './helpers/game-client.mjs';
import {explorationVisibility} from '../public/exploration-fog.js';
function reachable(room,start,goal){const boxes=roomBoxes(room),queue=[start],seen=new Set();for(const p of queue){const key=p.x+','+p.y;if(seen.has(key))continue;seen.add(key);if(p.x===goal.x&&p.y===goal.y)return true;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const n={x:p.x+dx,y:p.y+dy};if(validRoomTile(room,n.x,n.y,boxes)&&!moonwood.blocked(room,n.x,n.y,{bridge:true})&&!seen.has(n.x+','+n.y))queue.push(n);}}return false;}
const act=(s,id,now=1000)=>applyGameplayAction(s,'watchFind',{id},now,()=>.5);

test('watchtower expedition branches from Millbrook, has reciprocal walking routes and reachable landmarks',()=>{
 assert(moonwood.doors.millbrook.some(d=>d.to==='ambermead'));assert(moonwood.doors.ambermead.some(d=>d.to==='beaconwatch'));assert(moonwood.doors.ambermead.some(d=>d.to==='thornwood'));
 for(const room of watchRooms){assert(socialRooms[room]);const state=normalizeState({location:room,adventure:{discovered:[room]}});assert.equal(state.location,room);assert(state.adventure.discovered.includes(room));
  const doors=moonwood.doors[room];for(const a of doors){assert(moonwood.doors[a.to].some(b=>b.to===room));assert(validRoomTile(room,a.inside.x,a.inside.y,roomBoxes(room)));for(const b of doors)assert(reachable(room,a.inside,b.tile),room+' to '+b.to);}
  for(const p of moonwood.layouts[room].scenery.filter(p=>['watchCache','watchBeacon','watchSign','fishingPost','watchOak','watchPine'].includes(p.type)))assert([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>reachable(room,doors[0].inside,{x:p.x+dx,y:p.y+dy})),room+' blocked '+p.type+' '+p.x+','+p.y);
 }
});
test('watch beacon unlocks reciprocal shortcut permanently only after an adjacent interaction',()=>{
 const door=moonwood.doors.beaconwatch.find(d=>d.to==='millbrook'),s=normalizeState({location:'beaconwatch',position:{x:1,y:5}});
 assert.equal(moonwood.open(door,s.adventure),false);assert.throws(()=>act(s,'watchBeacon'),/Travel beside/);
 s.position={x:5,y:4};act(s,'watchBeacon');assert.equal(moonwood.open(door,s.adventure),true);assert.equal(moonwood.open(moonwood.doors.millbrook.find(d=>d.to==='beaconwatch'),normalizeState(s).adventure),true);assert.equal(s.credits,100);
 const forged=protectFishingState(normalizeState(),{...normalizeState(),adventure:{watchBeacon:true,watchBoar:true,grottoCache:true,meadowCache:true}});for(const flag of watchFlags)assert.equal(forged.adventure[flag],false);
});
test('caches pay once, cave seal needs the actual boar victory, and busy players cannot claim',()=>{
 const s=normalizeState({location:'ambermead',position:{x:2,y:6}});act(s,'watchCache');assert.equal(s.credits,115);act(s,'watchCache');assert.equal(s.credits,115);assert.equal(s.goldEarned,15);
 s.location='starfall';s.position={x:6,y:5};assert.throws(()=>act(s,'watchCache'),/Defeat the Thorn Boar/);assert.equal(s.credits,115);
 s.adventure.watchBoar=true;assert.equal(watchInteractLabel('starfall','watchCache',s.adventure),'Open starfall cache');act(s,'watchCache');assert.equal(s.credits,150);assert.equal(s.magic.stones.sword,1);act(s,'watchCache');assert.equal(s.magic.stones.sword,1);assert.equal(s.goldEarned,50);
 s.location='beaconwatch';s.position={x:5,y:4};s.fishingCast={id:'busy'};assert.throws(()=>act(s,'watchBeacon'),/finishing/);
});
test('thorn boar has a real harder battle and victory breaks the seal; fleeing returns to the safe road',()=>{
 assert(huntEnemies.thornBoar.health>huntEnemies.boar.health);assert(huntEnemies.thornBoar.damage>huntEnemies.boar.damage);assert.equal(huntEnemyForRoom('thornwood').id,'thornBoar');
 const s=normalizeState({location:'thornwood',position:{x:5,y:5}});s.combatGear.equippedWeapon='trainingSword';
 applyGameplayAction(s,'fight',{},1000,()=>.5);assert.equal(s.hunting.encounter.enemy,'thornBoar');s.hunting.encounter.health=1;
 applyGameplayAction(s,'combat',{combatId:s.combatId},2200,()=>.5);assert.equal(s.adventure.watchBoar,true);assert.equal(s.huntingLoot.boar,1);assert.equal(s.hunting.respawnAt,0);assert(s.hunting.thornRespawnAt>2200);
 const f=normalizeState({location:'thornwood',position:{x:5,y:5}});f.combatGear.equippedWeapon='trainingSword';applyGameplayAction(f,'fight',{},1000,()=>.5);
 applyGameplayAction(f,'combat',{combatId:f.combatId,input:'flee'},1100,()=>0);assert.equal(f.location,'ambermead');assert.equal(f.adventure.watchBoar,false);
});
test('mature thornwood trees give double timber, saved tree progress, and no duplicate cut rewards',()=>{
 const s=normalizeState({location:'thornwood',position:{x:1,y:2},woodcutting:{axeOwned:true,equipped:true}});applyGameplayAction(s,'chop',{x:1,y:1},1000);
 const cut=s.timberCut;applyGameplayAction(s,'cut',{x:1,y:1,cutId:cut.id},cut.endsAt);assert.equal(s.woodcutting.timber,2);assert.equal(s.woodcutting.xp,20);assert.equal(s.timberReceipt.amount,2);assert(normalizeState(s).woodcutting.trees['thornwood:1,1']);
 assert.throws(()=>applyGameplayAction(s,'cut',{x:1,y:1,cutId:cut.id},cut.endsAt));assert.equal(s.woodcutting.timber,2);
});
test('hidden Ambermead pool supports normal server-timed fishing with visible hunger and catch rewards',()=>{
 const s=normalizeState({location:'ambermead',position:{x:7,y:6}});applyGameplayAction(s,'cast',{},1000,()=>.5);const c=s.fishingCast;
 applyGameplayAction(s,'catch',{castId:c.id},c.landAt+900,()=>.5);assert.equal(Object.values(s.fishStock).reduce((a,b)=>a+b,0),1);assert.equal(s.vitals.hunger,99);assert.equal(s.fishingReceipt.room,'ambermead');
 assert.equal(validRoomTile('ambermead',10,6,roomBoxes('ambermead')),false);
});
test('fog hides the grotto until Thornwood is reached and all areas render and expose route guidance',()=>{
 const fog=explorationVisibility({currentRoom:'millbrook',rooms:Object.keys(moonwood.areas),discovered:['millbrook'],exits:r=>moonwood.doors[r].filter(d=>moonwood.open(d,{}))});assert.equal(fog.status('ambermead'),'frontier');assert.equal(fog.status('starfall'),'hidden');assert.equal(fog.status('beaconwatch'),'hidden');
 for(const room of watchRooms){const g=boot(normalizeState({location:room,position:{x:1,y:5},bedLessonComplete:true,quest:{accepted:true},adventure:{discovered:[room]}}));g.run('showHudMap();draw(2000)');assert.equal(g.read('currentRoom'),room);assert.deepEqual(g.errors,[]);assert.match(g.nodes.get('worldMap').innerHTML,new RegExp(moonwood.areas[room].name));assert.equal(g.nodes.get('explorationRegion').textContent,'BEACONWATCH');}
});
test('danger warning has working Not now and explicit entry instead of trapping new explorers',async()=>{
 const g=boot(normalizeState({location:'ambermead',position:{x:10,y:2},quest:{accepted:true}}));g.run('enterRoom("thornwood",{x:1,y:5})');assert.equal(g.read('currentRoom'),'ambermead');assert.equal(g.nodes.get('watchDialog').open,true);assert.match(g.nodes.get('watchDialogText').textContent,/115 HP/);
 g.nodes.get('watchDialogCancel').onclick();assert.equal(g.nodes.get('watchDialog').open,false);assert.equal(g.read('currentRoom'),'ambermead');
 g.run('enterRoom("thornwood",{x:1,y:5})');await g.nodes.get('watchDialogAction').onclick();assert.equal(g.read('currentRoom'),'thornwood');assert.equal(g.nodes.get('watchDialog').open,false);assert.deepEqual(g.errors,[]);
});

test('API keeps beacon and treasure ownership across reloads and rejects forged new-character unlocks',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());const origin='https://tower.test';
 const response=await handlePlayerApi(new Request(origin+'/api/player/session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({legacy:normalizeState({location:'beaconwatch',position:{x:5,y:4},adventure:Object.fromEntries(watchFlags.map(k=>[k,true]))})})}),{TOWER_DB:db});
 assert.equal(response.status,200);let data=await response.json();for(const key of watchFlags)assert.equal(data.state.adventure[key],false);
 const cookie=response.headers.get('Set-Cookie').split(';')[0];
 async function call(path,body){const res=await handlePlayerApi(new Request(origin+'/api/player/'+path,{method:body?'POST':'GET',headers:{Cookie:cookie,...(body?{Origin:origin,'Content-Type':'application/json'}:{})},body:body?JSON.stringify({...body,revision:data.revision,characterKey:data.characterKey}):undefined}),{TOWER_DB:db});assert.equal(res.status,200);data=await res.json();return data.state;}
 await call('gameplay/watchFind',{operation:'beacon',id:'watchBeacon'});assert.equal(data.state.adventure.watchBeacon,true);
 await call('save',{operation:'forgery',state:{...data.state,adventure:{...data.state.adventure,watchBeacon:false,watchBoar:true,grottoCache:true,meadowCache:true}}});
 assert.equal(data.state.adventure.watchBeacon,true);assert.equal(data.state.adventure.watchBoar,false);assert.equal(data.state.adventure.grottoCache,false);assert.equal(data.state.adventure.meadowCache,false);
 await call('state');assert.equal(data.state.location,'beaconwatch');assert.equal(data.state.adventure.watchBeacon,true);
});
