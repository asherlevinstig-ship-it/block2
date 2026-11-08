import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeState} from '../server/player-state.mjs';import {touchPresence} from '../server/routines.mjs';import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';import {autoStatus} from '../public/auto-mode.js';import {handlePlayerApi} from '../server/player-api.mjs';import {testDatabase} from './db-helper.mjs';import {boot} from './helpers/game-client.mjs';
const fishing=()=>normalizeState({location:'home',adventure:{discovered:['pond']},fishingGear:{ownedRods:['reed'],equippedRod:'reed',bait:20},characterRules:{enabled:true,activity:'fishing',keepBait:5}});
test('explicit Auto begins immediately with saved limits, ignores active input and matches idle/offline earnings',()=>{
 const manual=fishing();manual.controlMode='auto';manual.routineLastSeen=1000;touchPresence(manual,1000,{forceStart:true,active:false,random:()=>.5});assert.equal(manual.plan.startedAt,1000);
 touchPresence(manual,61000,{active:true,random:()=>.5});assert.equal(manual.controlMode,'auto');assert(manual.plan);assert.equal(manual.plan.baitUsed,1);
 const idle=fishing();idle.routineLastSeen=1000;touchPresence(idle,181000,{active:false,random:()=>.5});touchPresence(idle,241000,{active:false,random:()=>.5});
 assert.deepEqual(idle.fishStock,manual.fishStock);assert.deepEqual(idle.stats,manual.stats);assert.equal(idle.fishingGear.bait,manual.fishingGear.bait);
 const offline=fishing();offline.controlMode='auto';offline.routineLastSeen=1000;touchPresence(offline,1000,{forceStart:true,active:false,random:()=>.5});touchPresence(offline,61000,{active:false,random:()=>.5});assert.deepEqual(offline.fishStock,manual.fishStock);
});
test('stop reasons and the compact status distinguish work, next step, net gold and protected reserves',()=>{
 const s=fishing();s.controlMode='auto';s.routineLastSeen=1000;touchPresence(s,1000,{forceStart:true,active:false});
 assert.equal(autoStatus(s).current,'Catching fish');assert.equal(autoStatus(s).location,'Silverfin Pond');assert.equal(autoStatus(s).next,'Return home and rest');
 touchPresence(s,3600000,{active:true,random:()=>.5});assert.equal(s.controlMode,'play');assert.equal(s.fishingGear.bait,5);assert.equal(s.report.reason,'bait-reserve');assert.match(autoStatus(s).reason,/reserve/);assert.match(autoStatus(s).earned,/Net \+0 gold/);
 const forged=protectFishingState(s,{...s,controlMode:'auto'});assert.equal(forged.controlMode,'play');
});
test('explicit Auto respects the offline cap even with automatic idle activation disabled',()=>{
 const s=normalizeState({location:'home',woodcutting:{axeOwned:true,equipped:true,timber:0,xp:0},characterRules:{enabled:false,activity:'woodcutting',timberTarget:1000000}});s.controlMode='auto';s.routineLastSeen=1000;
 touchPresence(s,1000,{forceStart:true,active:false});touchPresence(s,24*3600000,{active:true});assert.equal(s.plan,undefined);assert.equal(s.report.reason,'away-cap');assert.equal(s.woodcutting.timber,480);assert.equal(s.controlMode,'play');assert.match(autoStatus(s).reason,/eight-hour/);
 const before=s.woodcutting.timber;touchPresence(s,48*3600000,{active:false});assert.equal(s.woodcutting.timber,before);
});
test('queued hunts finish the current encounter before returning control, without starting another',()=>{
 const s=normalizeState({location:'home',characterRules:{enabled:true,queue:{enabled:true,minHealth:60,steps:[{type:'huntBoars',amount:3}]}}});s.controlMode='auto';s.routineLastSeen=1000;
 touchPresence(s,1000,{forceStart:true,active:false,random:()=>.5});touchPresence(s,16500,{active:false,random:()=>.5});assert(s.plan.activeHunt);
 s.controlMode='play';touchPresence(s,16600,{active:true,random:()=>.5});assert.equal(s.plan.returnRequested,true);
 touchPresence(s,60000,{active:false,random:()=>.5});assert.equal(s.plan,undefined);assert.equal(s.report.hunts.started,1);assert.equal(s.report.reason,'returned');assert.equal(s.location,'home');assert.equal(autoStatus(s).returning,false);
});
test('inspection remains available while routine movement, equipment changes and manual combat stay blocked',()=>{
 const s=fishing();s.controlMode='auto';s.routineLastSeen=1000;touchPresence(s,1000,{forceStart:true,active:false});const g=boot(s);g.context.playerCloud.initial=s;
 g.run('openInventory()');assert.equal(g.nodes.get('inventoryDialog').open,true);g.run('walkTo({x:2,y:2})');assert.equal(g.read('route.length'),0);assert.equal(g.nodes.get('bagAction').disabled,true);g.run('openAvatar()');assert.equal(g.nodes.get('avatarDialog').open,true);assert.equal(g.nodes.get('saveAvatar').disabled,true);assert.deepEqual(g.errors,[]);
});

test('control API persists explicit Auto, retries safely, rejects unsafe starts and hands back control',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());const originalNow=Date.now;let now=1000;Date.now=()=>now;t.after(()=>Date.now=originalNow);const origin='https://tower.test';let packet,cookie='';
 async function call(path,body){const response=await handlePlayerApi(new Request(origin+'/api/player/'+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify({...body,characterKey:packet?.characterKey}):undefined}),{TOWER_DB:db});cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;const data=await response.json();if(response.ok)packet=data;return {status:response.status,...data};}
 const act=(path,body={})=>call(path,{revision:packet.revision,operation:crypto.randomUUID(),...body});
 await call('session',{legacy:{...fishing(),controlMode:'auto',characterRules:{enabled:false,activity:'fishing',keepBait:5}}});assert.equal(packet.state.controlMode,'play');
 const start={mode:'auto',revision:packet.revision,operation:crypto.randomUUID()};assert.equal((await call('control',start)).status,200);assert.equal(packet.state.plan.startedAt,1000);assert.equal(packet.state.characterRules.enabled,false);assert.equal((await call('control',start)).status,200);assert.equal(packet.state.plan.startedAt,1000);
 now=61000;assert.equal((await act('presence',{active:true})).status,200);assert.equal(packet.state.controlMode,'auto');assert(packet.state.plan);assert.equal(packet.state.plan.baitUsed,1);
 await call('state');assert.equal(packet.state.controlMode,'auto');assert(packet.state.plan);
 assert.equal((await act('control',{mode:'play'})).status,200);assert.equal(packet.state.controlMode,'play');assert.equal(packet.state.report.reason,'returned');assert.equal(packet.state.report.baitUsed,1);
 assert.equal((await act('report/ack',{startedAt:1000})).status,200);assert.equal((await act('save',{state:{...packet.state,controlMode:'auto'}})).status,200);assert.equal(packet.state.controlMode,'play');
 const before=packet.revision;assert.equal((await act('control',{mode:'wrong'})).status,400);assert.equal(packet.revision,before);
 const dungeon=normalizeState({location:'depthsVault',depthsRun:{cleared:2},position:{x:5,y:5}});sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(dungeon),packet.characterKey);assert.equal((await act('control',{mode:'auto'})).status,400);
});
