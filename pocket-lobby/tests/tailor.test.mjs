import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeState} from '../server/player-state.mjs';import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';import {normalizeWardrobe,clothingSets,clothingCatalog,tailorQuote,wearClothingSet} from '../public/wardrobe.js';import {boot} from './helpers/game-client.mjs';import {roomBoxes,validRoomTile} from '../public/shared-world.js';
const customer=(extra={})=>normalizeState({credits:2000,location:'tailor',position:{x:4,y:3},quest:{accepted:true},bedLessonComplete:true,...extra});
test('tailor collections are paid cosmetics, free smart outfits stay owned, and quotes exclude purchased pieces',()=>{
 const w=normalizeWardrobe();assert(w.owned.includes('moonlitDress'));assert(w.owned.includes('tailoredJacket'));assert.equal(w.owned.includes('riverVest'),false);
 assert.equal(tailorQuote(w,'fishing').price,150);w.owned.push('riverVest');assert.equal(tailorQuote(w,'fishing').price,80);assert.equal(tailorQuote(w,'riverVest','piece').price,0);
 assert.throws(()=>tailorQuote(w,'tailoredSuit'));assert.throws(()=>tailorQuote(w,'missing'));assert.throws(()=>wearClothingSet(w,'mage'),/need all/);
});
test('counter purchases charge exactly once, grant individual clothing and preserve stats and the worn outfit',()=>{
 const s=customer(),before=structuredClone(s);applyGameplayAction(s,'buyClothing',{id:'riverVest',kind:'piece'},1000);assert.equal(s.credits,1930);assert(s.wardrobe.owned.includes('riverVest'));assert.equal(tailorQuote(s.wardrobe,'fishing').price,80);
 applyGameplayAction(s,'buyClothing',{id:'fishing',kind:'set'},2000);assert.equal(s.credits,1850);assert.equal(tailorQuote(s.wardrobe,'fishing').price,0);assert.deepEqual(s.stats,before.stats);assert.deepEqual(s.avatar,before.avatar);assert.deepEqual(s.wardrobe.outfits,before.wardrobe.outfits);
 assert.throws(()=>applyGameplayAction(s,'buyClothing',{id:'fishing',kind:'set'},3000),/already own/);assert.equal(s.credits,1850);
 wearClothingSet(s.wardrobe,'fishing');assert.equal(normalizeState({...s,avatar:{name:'Guest',outfit:7,hair:0}}).avatar.outfit,7);
});
test('buying requires the physical shop counter, available gold and no active work',()=>{
 for(const extra of [{location:'home'},{position:{x:7,y:7}},{credits:1},{plan:{kind:'rest'}},{hunting:{recoveryUntil:9000}}]){const s=customer(extra);if(extra.plan)s.plan=extra.plan;const before=structuredClone(s);assert.throws(()=>applyGameplayAction(s,'buyClothing',{id:'mage',kind:'set'},1000));assert.equal(s.credits,before.credits);assert.deepEqual(s.wardrobe,before.wardrobe);}
 const s=customer();assert.throws(()=>applyGameplayAction(s,'buyClothing',{id:'moonlitDress',kind:'piece'},1000),/Choose/);
 assert.equal(validRoomTile('tailor',4,3,roomBoxes('tailor')),true);
});
test('snapshots cannot forge paid clothing or erase legitimately bought pieces',()=>{
 const s=customer(),fake=structuredClone(s);fake.wardrobe.owned.push('arcaneRobe');fake.wardrobe.outfits[0].jacket='arcaneRobe';assert.throws(()=>protectFishingState(s,fake),/unavailable/);
 applyGameplayAction(s,'buyClothing',{id:'mage',kind:'set'},1000);const next=structuredClone(s);next.wardrobe.owned=next.wardrobe.owned.filter(id=>!clothingCatalog[id].price);assert(protectFishingState(s,next).wardrobe.owned.includes('arcaneRobe'));
});
test('tailor doorway is connected to lobby and the physical counter opens the shop',()=>{
 const g=boot(customer());assert.equal(g.read('currentRoom'),'tailor');g.run('openTailor()');assert.equal(g.nodes.get('tailorDialog').open,true);assert.equal(g.nodes.get('tailorSets').children.length,Object.values(clothingSets).filter(set=>set.shop).length);assert.match(g.nodes.get('tailorBuySet').textContent,/150 gold/);g.run('drawTailorPreview(1500)');assert.deepEqual(g.errors,[]);
 assert.equal(g.read("autoRoomRoute('hub','tailor')[0].to"),'tailor');assert.equal(g.read("autoRoomRoute('tailor','hub')[0].to"),'hub');
});


test('API purchase retries cannot charge twice and paid clothes remain owned after reload',async t=>{
 const {handlePlayerApi}=await import('../server/player-api.mjs'),{testDatabase}=await import('./db-helper.mjs'),{db,sql}=testDatabase();t.after(()=>sql.close());let packet,cookie='';const origin='https://tower.test';
 async function call(path,body){const response=await handlePlayerApi(new Request(origin+'/api/player/'+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify({...body,characterKey:packet?.characterKey}):undefined}),{TOWER_DB:db});cookie=response.headers.get('set-cookie')?.split(';')[0]??cookie;const data=await response.json();if(response.ok)packet=data;return {status:response.status,...data};}
 await call('session',{legacy:customer()});const body={id:'woodcutting',kind:'set',revision:packet.revision,operation:crypto.randomUUID()};assert.equal((await call('gameplay/buyClothing',body)).status,200);assert.equal(packet.state.credits,1810);assert.equal((await call('gameplay/buyClothing',body)).status,200);assert.equal(packet.state.credits,1810);await call('state');assert(packet.state.wardrobe.owned.includes('lumberShirt'));assert.equal(packet.state.avatar.outfit,0);
 const w=structuredClone(packet.state.wardrobe);wearClothingSet(w,'woodcutting');const saved=await call('save',{state:{...packet.state,wardrobe:w},revision:packet.revision,operation:crypto.randomUUID()});assert.equal(saved.status,200);assert.equal(packet.state.avatar.outfit,8);
});
