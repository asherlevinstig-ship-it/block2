import {handlePlayerApi} from '../server/player-api.mjs';
import {testDatabase} from './db-helper.mjs';
import {skillXpForLevel} from '../public/skill-curve.js';
import {wildlifeRoom,wildAnimal,wildlifeAnimals,nearWildAnimal,wildlifeHabitats,bondOdds,wildlifeTrials,owlCallFor} from '../public/wildlife.js';
import {moonwood} from '../public/moonwood.js';
import {validRoomTile,roomBoxes,reachableMove,socialRooms} from '../public/shared-world.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeState,startPlan} from '../server/player-state.mjs';
import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';
import {familiars,normalizeFamiliars,familiarBond,familiarFishingTime} from '../public/familiars.js';
import {explorationVisibility} from '../public/exploration-fog.js';
import {publicPeer} from '../server/shared-room.mjs';
import {spawnAddWave} from '../public/dungeon-adds.js';
import {huntingTurn} from '../public/hunting.js';

const act=(s,action,body={},now=1000)=>applyGameplayAction(s,action,body,now,()=>.5);
const bond=(s,id)=>{s.familiars=normalizeFamiliars({...s.familiars,owned:[...(s.familiars?.owned??[]),id]});act(s,'familiarEquip',{id});};

test('only taming a resting animal nearby forms a bond and the first bond equips automatically',()=>{
 const s=normalizeState({history:{fishCaught:true},adventure:{lantern:true}});
 assert.throws(()=>act(s,'familiarRecruit',{id:'otter'}),/Reserve/);
 assert.throws(()=>act(s,'familiarEquip',{id:'otter'}),/Befriend/);
 assert.throws(()=>act(s,'familiarTame',{id:'reed-otter',step:0}),/reserve/);
 s.location=wildlifeRoom;s.position={x:1,y:9};
 assert.throws(()=>act(s,'familiarTame',{id:'reed-otter',step:0}),/beside/);
 s.position={x:4,y:9};act(s,'familiarTame',{id:'reed-otter',step:0});
 assert.equal(s.familiars.trust['reed-otter'].step,1);
 assert.throws(()=>act(s,'familiarTame',{id:'reed-otter',step:0},1001),/changed/);
 assert.throws(()=>act(s,'familiarTame',{id:'reed-otter',step:1},1001),/next rest/);
 assert.throws(()=>act(s,'familiarTame',{id:'bank-otter',step:1},2800),/beside/);
 s.position={x:8,y:9};assert.throws(()=>act(s,'familiarTame',{id:'reed-otter',step:1},13000),/River Snack/);
 s.position=wildlifeHabitats.otter.forage;act(s,'familiarForage',{id:'otter'},13000);
 assert.throws(()=>act(s,'familiarForage',{id:'otter'},13001),/replenish/);
 assert.throws(()=>act(s,'familiarForage',{id:'fox'},13001),/foraging spot/);
 s.position={x:8,y:9};act(s,'familiarTame',{id:'reed-otter',step:1},14000);
 assert.equal(s.familiars.forage.otter.count,0);
 assert.throws(()=>act(s,'familiarTame',{id:'reed-otter',step:2},14001),/marked spot/);
 s.position=wildlifeTrials.pebble.tile;act(s,'familiarTame',{id:'reed-otter',step:2},14100);
 assert.equal(s.familiars.trust['reed-otter'].lastRest,1);
 assert.equal(s.familiars.forage.otter.count,0);
 s.position={x:8,y:9};act(s,'familiarTame',{id:'reed-otter',step:3},38000);
 assert.deepEqual(s.familiars.owned,['otter']);assert.equal(s.familiars.equipped,'otter');assert.deepEqual(s.familiars.trust,{});
 assert.equal(publicPeer({familiar:s.familiars.equipped}).familiar,'otter');assert.equal(publicPeer({familiar:'unknown'}).familiar,undefined);
});

test('fox tracks and the owl call advance only when the habitat activity is completed',()=>{
 const s=normalizeState({location:wildlifeRoom,position:{x:13,y:14},familiars:{trust:{'meadow-fox':{step:2,lastRest:0},'ridge-owl':{step:2,lastRest:0}}}});
 act(s,'familiarTame',{id:'meadow-fox',step:2});
 assert.equal(s.familiars.trust['meadow-fox'].step,3);
 assert.throws(()=>act(s,'familiarTame',{id:'meadow-fox',step:3}),/marked spot/);
 s.position=wildlifeTrials.trailEnd.tile;act(s,'familiarTame',{id:'meadow-fox',step:3});
 assert.equal(s.familiars.trust['meadow-fox'].step,4);
 s.position=wildlifeTrials.listen.tile;act(s,'familiarTame',{id:'ridge-owl',step:2});
 const now=15000,owl=wildAnimal('ridge-owl',now);assert(owl.resting);s.position={x:owl.x,y:owl.y+1};
 assert.throws(()=>act(s,'familiarTame',{id:'ridge-owl',step:3,reply:'two'},now),/echoing/);
 assert.equal(s.familiars.trust['ridge-owl'].step,3);
 act(s,'familiarTame',{id:'ridge-owl',step:3,reply:owlCallFor('ridge-owl')},now);
 act(s,'familiarTame',{id:'ridge-owl',step:4},now+100);
 assert.equal(s.familiars.trust['ridge-owl'].step,5);
});

test('adventurer level, Luck and Patience each improve the displayed bonding chance',()=>{
 const xp=skillXpForLevel(4),base=bondOdds({},'owl','bond');
 assert.equal(base.percent,50);
 assert.equal(bondOdds({strengthXp:xp,agilityXp:xp,vitalityXp:xp},'owl','bond').percent,59);
 assert.equal(bondOdds({luckXp:xp},'owl','bond').percent,59);
 assert.equal(bondOdds({patienceXp:xp},'owl','bond').percent,62);
 assert(bondOdds({},'otter','observe').percent>bondOdds({},'fox','observe').percent);
 assert.equal(bondOdds({luckXp:xp,patienceXp:xp},'otter','observe',3).percent,97);
});

test('failed rolls preserve food and trust, lock that rest and improve the next attempt',()=>{
 const s=normalizeState({location:wildlifeRoom,position:{x:4,y:9}});
 const attempt=(step,now,roll)=>applyGameplayAction(s,'familiarTame',{id:'reed-otter',step},now,()=>roll);
 attempt(0,1000,.95);
 assert.deepEqual(normalizeState(s).familiars.trust['reed-otter'],{step:0,lastRest:0,misses:1});
 assert.throws(()=>attempt(0,1001,0),/next rest/);
 s.position=wildlifeHabitats.otter.forage;act(s,'familiarForage',{id:'otter'},11000);
 s.position={x:8,y:9};attempt(0,13000,.82); // Retry brings 78% to 86%.
 assert.equal(s.familiars.trust['reed-otter'].step,1);
 assert.equal(s.familiars.trust['reed-otter'].misses,undefined);
 s.position={x:9,y:15};attempt(1,26000,.97);
 assert.equal(s.familiars.trust['reed-otter'].step,1);
 assert.equal(s.familiars.forage.otter.count,1);
 s.stats.patienceXp=skillXpForLevel(4);
 s.position={x:8,y:9};attempt(1,38000,.94); // Patience and retry bring 78% to the cap.
 assert.equal(s.familiars.trust['reed-otter'].step,2);
 assert.equal(s.familiars.forage.otter.count,0);
});

test('reserve routes stay on land with reachable habitats and enough room for players',()=>{
 const entrance=moonwood.doors.trail.find(door=>door.to===wildlifeRoom),exit=moonwood.doors[wildlifeRoom].find(door=>door.to==='trail');
 assert.deepEqual(entrance.arrival,exit.inside);assert.deepEqual(socialRooms[wildlifeRoom],[24,20]);
 const boxes=roomBoxes(wildlifeRoom),resting=new Set();
 for(let at=0;at<70000;at+=250)for(const animal of wildlifeAnimals(at)){
  assert(validRoomTile(wildlifeRoom,Math.round(animal.x),Math.round(animal.y),boxes),`${animal.id} crosses blocked tile at ${animal.x},${animal.y}`);
  if(!animal.resting)continue;
  const key=`${animal.id}:${animal.x},${animal.y}`;if(resting.has(key))continue;resting.add(key);
  assert(reachableMove(wildlifeRoom,entrance.arrival,{x:animal.x,y:animal.y},boxes,100));
 }
 for(const {forage} of Object.values(wildlifeHabitats))assert(reachableMove(wildlifeRoom,entrance.arrival,forage,boxes,100));
 for(const {tile} of Object.values(wildlifeTrials))assert(reachableMove(wildlifeRoom,entrance.arrival,tile,boxes,100));
 assert(resting.size>=20);assert.notDeepEqual(wildAnimal('reed-otter',10000),wildAnimal('reed-otter',10600));
 assert.equal(nearWildAnimal({x:4,y:9},wildAnimal('reed-otter',1000)),true);
});

test('partial trust is saved by animal, personal, and protected from snapshot edits',()=>{
 const s=normalizeState({location:wildlifeRoom,position:{x:4,y:9}}),other=structuredClone(s);
 act(s,'familiarTame',{id:'reed-otter',step:0});assert.equal(other.familiars,undefined);
 const loaded=normalizeState(s);assert.deepEqual(loaded.familiars,s.familiars);
 assert.deepEqual(normalizeFamiliars({trust:{'reed-otter':{step:2,readyAt:9000}}}).trust['reed-otter'],{step:2,lastRest:null});
 const forged={owned:['fox'],equipped:'fox',trust:{'reed-otter':{step:2,readyAt:0}}};
 assert.deepEqual(protectFishingState(s,{...s,familiars:forged}).familiars,s.familiars);
 const veteran=normalizeState({location:wildlifeRoom,position:{x:22,y:18},familiars:{owned:['owl'],equipped:'owl'}});
 assert.deepEqual(veteran.position,{x:22,y:18});assert.deepEqual(veteran.familiars.owned,['owl']);assert.equal(veteran.familiars.equipped,'owl');
});

test('Otter speeds the server bite, recovers a missed bonus once and preserves the normal catch reward',()=>{
 const make=()=>normalizeState({location:'pond',position:{x:4,y:5},history:{fishCaught:true},fishingGear:{ownedRods:['reed'],equippedRod:'reed',bait:3}});
 const withOtter=make(),control=make();bond(withOtter,'otter');act(control,'cast');act(withOtter,'cast');
 const cast=withOtter.fishingCast;assert.equal(cast.biteAt-1450,Math.round((control.fishingCast.biteAt-1450)*.85));
 assert.throws(()=>act(withOtter,'familiarUse',{castId:cast.id},cast.biteAt-1),/bite/);
 act(withOtter,'familiarUse',{castId:cast.id},cast.landAt+50);
 assert.equal(cast.bonus,5);assert.equal(withOtter.familiars.readyAt.otter,cast.landAt+50+familiars.otter.cooldown);
 assert.throws(()=>act(withOtter,'familiarUse',{castId:cast.id},cast.landAt+100),/recovering/);
 act(withOtter,'catch',{castId:cast.id},cast.landAt+900);
 assert.equal(withOtter.fishingReceipt.xp,15);assert.equal(withOtter.fishingGear.bait,2);assert.equal(withOtter.fishingCast,undefined);
});

test('Second Chance API returns a player-facing timing error and accepts a delayed landing click',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());
 const origin='https://tower.test';let cookie='',saved;
 async function call(path,body){
  const response=await handlePlayerApi(new Request(origin+'/api/player/'+path,{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(body)}),{TOWER_DB:db});
  cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;
  return {status:response.status,...await response.json()};
 }
 saved=await call('session',{legacy:{location:'pond',position:{x:4,y:5},fishingGear:{ownedRods:['reed'],equippedRod:'reed',bait:3}}});
 assert.equal(saved.status,200);
 const state=saved.state;bond(state,'otter');
 const write=()=>sql.prepare('UPDATE tower_players SET state_json=? WHERE player_id=?').run(JSON.stringify(state),saved.characterKey);
 const action=(name,body={})=>call('gameplay/'+name,{...body,operation:crypto.randomUUID(),revision:saved.revision,characterKey:saved.characterKey});
 write();
 const inactive=await action('familiarUse');assert.equal(inactive.status,400);assert.match(inactive.error,/Cast a line first/);
 const now=Date.now();state.fishingCast={id:'cast',rod:'reed',started:now-3000,castEnds:now-2500,biteAt:now-2300,landAt:now-1000,bonus:0};write();
 saved=await action('familiarUse',{castId:'cast'});assert.equal(saved.status,200);assert.equal(saved.state.fishingCast.bonus,5);
 const repeat=await action('familiarUse',{castId:'cast'});assert.equal(repeat.status,400);assert.match(repeat.error,/recovering/);
 saved=await action('catch',{castId:'cast'});assert.equal(saved.status,200);assert.equal(saved.state.fishingReceipt.xp,15);
});

test('the Otter also speeds away fishing without giving offline timing bonuses',()=>{
 const make=()=>normalizeState({location:'pond',position:{x:4,y:5},history:{fishCaught:true},fishingGear:{ownedRods:['reed'],equippedRod:'reed',bait:3}});
 const otter=make(),control=make();bond(otter,'otter');
 for(const s of [otter,control])startPlan(s,{kind:'fishing',hours:1,baitLimit:3},1000);
 assert.equal(otter.plan.interval,Math.round(control.plan.interval*.85));
 assert.equal(otter.plan.nextCatchAt,1000+otter.plan.interval);
});

test('Fox adds stagger only on adds and its pounce cancels a committed attack without harming the leader',()=>{
 const s=normalizeState({location:'depthsCache',position:{x:5,y:5},depthsDiscovered:true,depthsRun:{cleared:1,routeChoice:'dangerous'}});bond(s,'fox');act(s,'fight');
 const e=spawnAddWave(s.hunting.encounter,1200).encounter,a=e.adds[0];s.hunting.encounter=e;
 Object.assign(a,{x:5,y:4,thinkAt:4001,attackAt:4000,lockedFor:4000,origin:{x:5,y:4},target:{x:5,y:5}});e.combatTarget=a.id;e.nextPlayerAt=3000;
 const withFox=huntingTurn(e,100,s.stats,'attack',3000,()=>.5),withoutFox=huntingTurn({...e,foxBond:false},100,s.stats,'attack',3000,()=>.5);
 assert.equal(withFox.staggerGained-withoutFox.staggerGained,8);assert.equal(withFox.encounter.health,e.health);
 e.nextPlayerAt=e.nextBoarAt=e.brainNextThinkAt=10000;
 act(s,'combat',{combatId:s.combatId,input:'familiar'},3500);
 const after=s.hunting.encounter,add=after.adds.find(x=>x.id===a.id);assert.equal(after.health,e.health);assert.equal(after.nextBoarAt,10000);assert.equal(add.lockedFor,0);assert(add.attackAt>4000);
 assert(s.combatReceipt.events.some(event=>event.targetId===a.id&&event.interrupted));
 assert.equal(s.familiars.bondXp.fox,6);assert.equal(normalizeState(s).hunting.encounter.adds.find(x=>x.id===a.id).pounceBonded,true);
 assert.throws(()=>act(s,'combat',{combatId:s.combatId,input:'familiar'},3501),/recovering/);
 s.familiars.bondXp.fox=90;s.familiars.readyAt.fox=0;
 add.lockedFor=add.attackAt=4200;add.thinkAt=4300;
 act(s,'combat',{combatId:s.combatId,input:'familiar'},3800);
 assert.equal(s.familiars.readyAt.fox,23800);assert.equal(s.hunting.encounter.adds.find(x=>x.id===a.id).staggerWeakUntil,6800);
});

test('Owl scouts only the local frontier and Moon Sight has a room, duration and cooldown',()=>{
 const s=normalizeState({location:'trail',adventure:{lantern:true}});bond(s,'owl');act(s,'familiarUse');
 assert.deepEqual(s.familiars.sight,{room:'trail',until:16000});assert.equal(s.familiars.readyAt.owl,36000);
 s.location='hub';assert.throws(()=>act(s,'familiarUse',{},37000),/outdoors/);
 const options={currentRoom:'a',rooms:['a','b','c','d'],exits:room=>({a:[{to:'b'}],b:[{to:'c'}],c:[{to:'d'}],d:[]})[room]};
 assert.equal(explorationVisibility(options).status('c'),'hidden');const scouted=explorationVisibility({...options,scout:true});assert.equal(scouted.status('c'),'frontier');assert.equal(scouted.status('d'),'hidden');assert.equal(normalizeFamiliars(s.familiars).equipped,'owl');
});


test('Otter earns bond XP on a landed catch once and Kindred Second Chance saves bait',()=>{
 const s=normalizeState({location:'pond',position:{x:4,y:5},fishingGear:{ownedRods:['reed'],equippedRod:'reed',bait:3}});
 bond(s,'otter');s.familiars.bondXp={otter:28};act(s,'cast');
 const a=s.fishingCast;act(s,'catch',{castId:a.id},a.landAt+900);
 assert.equal(familiarBond(s.familiars,'otter').rank,2);assert.equal(familiarFishingTime(s,1000),800);
 act(s,'catch',{castId:a.id},a.landAt+950);assert.equal(familiarBond(s.familiars,'otter').xp,30);
 s.familiars.bondXp.otter=90;act(s,'cast',{},10000);
 const b=s.fishingCast;act(s,'familiarUse',{castId:b.id},b.biteAt);act(s,'catch',{castId:b.id},b.landAt+900);
 assert.equal(s.fishingGear.bait,2);assert.equal(s.fishingReceipt.baitSaved,true);
 assert.equal(normalizeState(s).familiars.bondXp.otter,90);
 assert.deepEqual(protectFishingState(s,{...s,familiars:{...s.familiars,bondXp:{otter:900}}}).familiars,s.familiars);
});

test('Owl earns XP only on the first scout of each area and Kindred extends Moon Sight',()=>{
 const s=normalizeState({location:'trail'});bond(s,'owl');act(s,'familiarUse');
 assert.equal(s.familiars.bondXp.owl,10);act(s,'familiarUse',{},40000);assert.equal(s.familiars.bondXp.owl,10);
 s.location='grove';s.familiars.bondXp.owl=90;act(s,'familiarUse',{},80000);
 assert.deepEqual(s.familiars.sight,{room:'grove',until:102000});assert.deepEqual(s.familiars.scouted,['trail','grove']);
 const edges={a:['b'],b:['a','c'],c:['d'],d:['e'],e:[]};
 const map=explorationVisibility({currentRoom:'a',rooms:Object.keys(edges),exits:room=>edges[room].map(to=>({to})),scout:3});
 assert.equal(map.status('d'),'frontier');assert(map.scouted.has('d'));assert(!map.known.has('d'));assert.equal(map.status('e'),'hidden');
});
