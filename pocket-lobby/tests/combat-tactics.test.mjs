import {legacyDungeonEncounter} from './helpers/combat-fixtures.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeState} from '../server/player-state.mjs';
import {normalizeCharacterRules,nextCombatTactic} from '../public/character-rules.js';
import {normalizeHunting} from '../public/hunting.js';
import {applyGameplayAction} from '../server/gameplay.mjs';
import {advanceServerCombat} from '../server/activities.mjs';
import {handlePlayerApi} from '../server/player-api.mjs';
import {testDatabase} from './db-helper.mjs';
const act=(s,name,body={},now=1000)=>applyGameplayAction(s,name,body,now,()=>.5);
function fighter(ids=['fire:sword','ice:shield'],picks=['fire','ice','shadow'],combat={enabled:true,q:true,e:true,fleeBelow:0},room='clearing'){
 const s=normalizeState({location:'shrine',position:{x:5,y:4},characterRules:{combat}});
 act(s,'bondEssences',{picks});
 for(const id of ids){s.magic.stones[id.split(':')[1]]=1;act(s,'awakenPower',{id});}
 s.location=room;s.position={x:5,y:5};if(room==='depthsCache')s.depthsRun={cleared:2};
 act(s,'fight');if(room==='depthsCache')legacyDungeonEncounter(s);return s;
}
const outcome=s=>({health:s.health,hunting:s.hunting,magic:s.magic,stats:s.stats,loot:s.huntingLoot,location:s.location,depthsRun:s.depthsRun});

test('old rules default to manual combat and tactic inputs reject malformed controls',()=>{
 assert.deepEqual(normalizeCharacterRules().combat,{enabled:false,q:true,e:true,fleeBelow:20,style:'balanced',dodge:false});
 for(const combat of [null,[],true,{enabled:'yes'},{q:1},{e:'no'},{fleeBelow:-1},{fleeBelow:81},{fleeBelow:20.5}])assert.throws(()=>normalizeCharacterRules({combat}),/Invalid combat tactics/);
 const s=fighter();delete s.hunting.encounter.tacticsAt;assert.equal(nextCombatTactic(s),null);
 assert.throws(()=>normalizeHunting({encounter:{health:10,nextPlayerAt:2000,nextBoarAt:3000,tacticsAt:-1}}),/Invalid hunting time/);
});

test('online polling and offline catch-up use identical spell timing, combat results and mastery',()=>{
 const online=fighter(),offline=fighter(),events=[];
 for(let now=1000;now<=12000;now+=50)events.push(...advanceServerCombat(online,now,()=>.5));
 const away=advanceServerCombat(offline,12000,()=>.5);
 assert.deepEqual(outcome(online),outcome(offline));
 const casts=events.filter(event=>event.automatic&&event.action==='essence');
 assert.deepEqual(casts.map(event=>[event.power,event.at]),[['Fire Blade',1150],['Ice Aegis',1850]]);
 assert.deepEqual(away.map(event=>[event.action,event.power,event.at]),events.map(event=>[event.action,event.power,event.at]));
 assert.equal(offline.magic.mastery.fire,10);assert.equal(offline.magic.mastery.ice,10);
 assert.equal(offline.huntingLoot.boar,1);
 advanceServerCombat(offline,24000,()=>.5);assert.equal(offline.magic.mastery.fire,10);
});

test('manual casting updates the tactic clock and prevents duplicate automatic casts',()=>{
 const s=fighter(['fire:sword'],undefined,{enabled:true,q:true,e:false,fleeBelow:0});
 act(s,'combat',{combatId:s.combatId,input:'essence',slot:'q'},1100);
 assert.equal(s.hunting.encounter.tacticsAt,1100);
 assert.equal(s.combatReceipt.events[0].automatic,undefined);
 assert.equal(s.magic.cooldowns['fire:sword'],7600);
 assert.equal(normalizeState(s).hunting.encounter.tacticsAt,1100);
 const events=advanceServerCombat(s,12000,()=>.5);
 assert(!events.some(event=>event.automatic&&event.power==='Fire Blade'));
 assert.equal(s.magic.mastery.fire,10);
});

test('low-health flee takes priority and failed attempts respect the existing flee cooldown',()=>{
 const escaped=fighter(['fire:sword'],undefined,{enabled:true,q:true,e:true,fleeBelow:40});escaped.health=30;
 const events=advanceServerCombat(escaped,12000,()=>0);
 assert.equal(events[0].action,'flee');assert.equal(events[0].at,1150);assert.equal(events[0].automatic,true);
 assert.equal(events[0].outcome,'escaped');assert.equal(escaped.magic.mastery.fire,0);
 assert.equal(escaped.location,'trail');assert.equal(escaped.health,30);
 const failed=fighter(['fire:sword'],undefined,{enabled:true,q:true,e:true,fleeBelow:40});failed.health=30;
 const attempts=advanceServerCombat(failed,12000,()=>.99).filter(event=>event.action==='flee');
 assert(attempts.length>=2);
 for(let i=1;i<attempts.length;i++)assert(attempts[i].at-attempts[i-1].at>=1800);
 assert.equal(failed.magic.mastery.fire,0);
});

test('Shadow waits for heavy warnings and Storm respects resistance while opening the elite shell',()=>{
 const s=fighter(['shadow:sword','storm:shield'],['fire','shadow','storm'],undefined,'depthsCache');
 s.hunting.encounter.nextPlayerAt=100000;s.hunting.encounter.enemyMove='runicSlam';s.hunting.encounter.nextBoarAt=3000;
 const first=advanceServerCombat(s,2500,()=>.5).filter(event=>event.automatic);
 assert.deepEqual(first.map(event=>[event.power,event.at]),[['Storm Aegis',1850]]);
 assert.equal(s.hunting.encounter.exposedUntil,4250);
 assert.equal(s.hunting.encounter.interruptResistUntil,7850);
 const storm=fighter(['storm:sword','storm:shield'],['fire','shadow','storm'],undefined,'depthsCache');
 storm.hunting.encounter.nextPlayerAt=100000;storm.hunting.encounter.enemyMove='runicSlam';storm.hunting.encounter.nextBoarAt=3000;
 const interrupts=advanceServerCombat(storm,10000,()=>.5).filter(event=>event.interrupted);
 assert.equal(interrupts.length,2);assert.equal(interrupts[1].at-interrupts[0].at,6000);
 assert(storm.health<100);
});

test('disabled slots, full-health healing and Confluence spells follow their supported rules',()=>{
 const disabled=fighter(undefined,undefined,{enabled:true,q:false,e:false,fleeBelow:0});
 assert(!advanceServerCombat(disabled,12000,()=>.5).some(event=>event.automatic));
 assert.equal(disabled.magic.mastery.fire,0);
 const heal=fighter(['eclipse:renewal']);
 assert.equal(nextCombatTactic(heal),null);
 heal.health=70;
 assert.equal(nextCombatTactic(heal).at,1150);
 const result=advanceServerCombat(heal,1150,()=>.5);
 assert.equal(result[0].power,'Eclipse Mend');assert.equal(result[0].healed,13);
 const missing=fighter();missing.magic.slots.q=null;missing.magic.slots.e=null;
 assert.equal(nextCombatTactic(missing),null);
});

test('rules API persists tactics, blocks mid-fight changes and settles a saved fight once',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());
 const origin='https://tower.test',original=Date.now;let now=1000;Date.now=()=>now;t.after(()=>{Date.now=original;});
 let cookie='',packet;
 async function call(path,body){
  const response=await handlePlayerApi(new Request(origin+'/api/player/'+path,{method:body?'POST':'GET',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:body?JSON.stringify({...body,characterKey:packet?.characterKey}):undefined}),{TOWER_DB:db});
  cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;
  const data=await response.json();if(response.ok)packet=data;return {status:response.status,...data};
 }
 const send=(path,body={})=>call(path,{...body,revision:packet.revision,operation:crypto.randomUUID()});
 await call('session',{legacy:{location:'shrine',position:{x:5,y:4}}});
 await send('rules/save',{rules:{combat:{enabled:true,q:true,e:false,fleeBelow:20}}});
 assert.equal(packet.state.characterRules.enabled,false);assert.equal(packet.state.characterRules.combat.enabled,true);
 await send('gameplay/bondEssences',{picks:['fire','ice','shadow']});await send('gameplay/awakenPower',{id:'fire:sword'});
 await send('save',{state:{...packet.state,location:'clearing',position:{x:5,y:5}}});await send('gameplay/fight');
 const blocked=await send('rules/save',{rules:{combat:{enabled:false}}});assert.equal(blocked.status,409);
 await send('save',{state:{...packet.state,characterRules:{combat:{enabled:false}},hunting:{...packet.state.hunting,encounter:{...packet.state.hunting.encounter,tacticsAt:0}}}});
 assert.equal(packet.state.characterRules.combat.enabled,true);assert.equal(packet.state.hunting.encounter.tacticsAt,1000);
 now=12000;
 const returns=await Promise.all([call('state'),call('state')]);
 for(const response of returns){assert.equal(response.status,200);assert.equal(response.state.huntingLoot.boar,1);assert.equal(response.state.magic.mastery.fire,10);}
 assert.equal(packet.state.hunting.encounter,null);
 await send('rules/save',{rules:{enabled:false,activity:'rest'}});
 assert.equal(packet.state.characterRules.combat.enabled,true);
});
