import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeWardrobe,wearClothingSet,isSmartlyDressed,createSavedOutfit} from '../public/wardrobe.js';
import {normalizeState} from '../server/player-state.mjs';import {touchPresence} from '../server/routines.mjs';import {gamblingAction} from '../server/gambling.mjs';import {autoStatus} from '../public/auto-mode.js';
import {boot} from './helpers/game-client.mjs';import {handlePlayerApi} from '../server/player-api.mjs';import {testDatabase} from './db-helper.mjs';
const visitor=()=>normalizeState({location:'hub',position:{x:14,y:1},quest:{accepted:true},bedLessonComplete:true});
test('dress code checks equipped clothing, accepts either smart look, and needs no specific shoes',()=>{
 const w=normalizeWardrobe();assert.equal(isSmartlyDressed(w),false);wearClothingSet(w,'tailoredSuit');assert.equal(isSmartlyDressed(w),true);
 const worn=w.outfits.find(o=>o.id===w.active);worn.boots='canvasBoots';assert.equal(isSmartlyDressed(w),true);worn.trousers='forestTrousers';assert.equal(isSmartlyDressed(w),false);
 wearClothingSet(w,'moonlitDress');assert.equal(isSmartlyDressed(w),true);w.active='outfit-1';assert.equal(isSmartlyDressed(w),false,'owning a dress does not count as wearing it');
});
test('casual doorway and direct room travel stay in the lobby and open the Wardrobe guide',()=>{
 const g=boot(visitor());g.run("travelDoor(hubDoors.find(d=>d.to==='lounge'))");assert.equal(g.read('currentRoom'),'hub');assert.equal(g.nodes.get('loungeDressDialog').open,true);assert.equal(g.read('route.length'),0);
 g.run("enterRoom('lounge')");assert.equal(g.read('currentRoom'),'hub');g.run('openLoungeWardrobe()');assert.equal(g.nodes.get('avatarDialog').open,true);assert.equal(g.nodes.get('loungeWardrobeGuide').hidden,false);assert.equal(g.nodes.get('loungeWardrobeContinue').hidden,true);
 g.run("wearClothingSet(wardrobe,'moonlitDress');applyWornOutfit();renderWardrobe()");assert.equal(g.nodes.get('loungeWardrobeContinue').hidden,false);assert.match(g.nodes.get('loungeWardrobeGuideTitle').textContent,/met/);
 g.run('continueToLounge()');assert.equal(g.read('route.at(-1).x'),14);assert.equal(g.read('route.at(-1).y'),0);
 for(let i=0;i<8;i++)g.run('advanceAnimation('+(1000+i*200)+')');assert.equal(g.read('currentRoom'),'lounge');assert.equal(g.read('loungeDressGuiding'),false);assert.deepEqual(g.errors,[]);
});
test('closing Wardrobe without dressing keeps a contextual prompt instead of letting the player through',()=>{
 const g=boot(visitor());g.run("requestLoungeDress();openLoungeWardrobe();$('avatarDialog').close();updateLoungeDressGuide()");assert.equal(g.nodes.get('loungeDressGuide').hidden,false);assert.equal(g.nodes.get('loungeDressGuideAction').textContent,'Open Wardrobe');assert.equal(g.read('currentRoom'),'hub');
});
test('full wardrobes offer an explicit update of the worn look so the dress code cannot strand the player',()=>{
 const g=boot(visitor());g.run("for(let i=2;i<=6;i++)createSavedOutfit(wardrobe,'Look '+i);requestLoungeDress();openLoungeWardrobe()");
 const cards=g.nodes.get('formalSets').children,card=cards.find(c=>c.dataset.set==='moonlitDress'),button=card.children.at(-1);assert.equal(button.textContent,'Update worn look');button.onclick();assert.equal(g.read('wardrobe.outfits.length'),6);assert.equal(g.read('isSmartlyDressed(wardrobe)'),true);assert.equal(g.nodes.get('loungeWardrobeContinue').hidden,false);
});
test('casual Auto gambling finishes with guidance and no wagers, gold loss or Luck XP',()=>{
 const s=normalizeState({credits:200,characterRules:{enabled:true,strategy:'gambling'}});s.controlMode='auto';s.routineLastSeen=1000;touchPresence(s,1000,{forceStart:true,active:false});assert.equal(s.plan,undefined);assert.equal(s.report.reason,'smart-clothing');assert.equal(s.report.rounds,0);assert.equal(s.credits,200);assert.equal(s.stats.luckXp,0);assert.equal(s.controlMode,'play');assert.equal(s.activityLog.length,1);assert.match(autoStatus(s).reason,/Wardrobe/);
 const manual=normalizeState({location:'lounge',position:{x:3,y:6}});assert.throws(()=>gamblingAction(manual,'gamble',{game:'roulette',bet:5,color:'red'},1000),/smart clothing/);assert.equal(manual.credits,100);
});
test('server rejects casual entry snapshots, including forged avatar colours, and accepts an equipped dress',async t=>{
 const {db,sql}=testDatabase();t.after(()=>sql.close());let packet,cookie='';const origin='https://tower.test';
 async function call(path,body){const response=await handlePlayerApi(new Request(origin+'/api/player/'+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify({...body,characterKey:packet?.characterKey}):undefined}),{TOWER_DB:db});cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;const data=await response.json();if(response.ok)packet=data;return {status:response.status,...data};}
 const act=(path,body={})=>call(path,{revision:packet.revision,operation:crypto.randomUUID(),...body});await call('session',{legacy:visitor()});
 const rejected=await act('save',{state:{...packet.state,location:'lounge',avatar:{name:'Guest',outfit:6,hair:0}}});assert.equal(rejected.status,400);assert.match(rejected.error,/smart clothing/);await call('state');assert.equal(packet.state.location,'hub');
 const w=structuredClone(packet.state.wardrobe);wearClothingSet(w,'moonlitDress');const accepted=await act('save',{state:{...packet.state,wardrobe:w,location:'lounge',position:{x:3,y:6}}});assert.equal(accepted.status,200);assert.equal(packet.state.location,'lounge');assert.equal(packet.state.avatar.outfit,6);
});
