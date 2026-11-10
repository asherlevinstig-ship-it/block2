import test from 'node:test';
import assert from 'node:assert/strict';
import {veilCloakId,addClothingToOutfit,normalizeWardrobe,tailorQuote} from '../public/wardrobe.js';
import {veilRules,outfitVeilUntil} from '../public/outfit-magic.js';
import {normalizeState} from '../server/player-state.mjs';
import {applyGameplayAction,protectFishingState} from '../server/gameplay.mjs';
import {SharedRoom} from '../server/shared-room.mjs';
import {boot} from './helpers/game-client.mjs';

const bankable={cleared:3,routeChoice:'dangerous',cacheGuardDefeated:true,shardEarned:true};
function dressed(input={}){
 const wardrobe=normalizeWardrobe();
 wardrobe.owned.push(veilCloakId);
 addClothingToOutfit(wardrobe,wardrobe.active,veilCloakId);
 return normalizeState({...input,wardrobe});
}

test('the cloak drops only from eligible banked clears and the pity award is unique',()=>{
 const s=normalizeState();
 assert(!s.wardrobe.owned.includes(veilCloakId));
 assert(!normalizeWardrobe(undefined,{outfit:13}).owned.includes(veilCloakId));
 assert.throws(()=>tailorQuote(s.wardrobe,veilCloakId,'piece'),/tailor/);
 const bank=run=>{s.location='depthsVault';s.depthsRun={...run};applyGameplayAction(s,'bank',{},1000,()=>.99);};
 bank({...bankable,routeChoice:'safe'});bank({...bankable,shardEarned:false});
 assert.equal(s.outfitMagic.cloakMisses,0);
 for(let i=1;i<veilRules.guarantee;i++){bank(bankable);assert.equal(s.outfitMagic.cloakMisses,i);assert(!s.wardrobe.owned.includes(veilCloakId));}
 bank(bankable);bank(bankable);
 assert.equal(s.wardrobe.owned.filter(id=>id===veilCloakId).length,1);
 assert.equal(s.outfitMagic.cloakMisses,0);
 const forged=dressed();
 assert.throws(()=>protectFishingState(normalizeState(),forged),/unavailable clothing/);
});

test('Veilstep is server-timed, prevents engagement and disengages an active fight',()=>{
 const s=dressed({location:'clearing',position:{x:5,y:5}});
 const at=1000;
 applyGameplayAction(s,'veil',{},at);
 assert.equal(outfitVeilUntil(s),at+veilRules.duration);
 assert.throws(()=>applyGameplayAction(s,'fight',{},at+1),/End Veilstep/);
 const live=boot(s);assert.equal(live.nodes.get('veilstep').hidden,false);assert.deepEqual(live.errors,[]);
 applyGameplayAction(s,'veil',{},at+2);
 assert.equal(outfitVeilUntil(s),0);
 assert.throws(()=>applyGameplayAction(s,'veil',{},at+3),/cooldown/);
 const ready=at+veilRules.cooldown;
 applyGameplayAction(s,'fight',{},ready);
 applyGameplayAction(s,'combat',{combatId:s.combatId,input:'veil'},ready+1);
 assert.equal(s.hunting.encounter,null);
 assert.equal(s.location,'trail');assert.equal(s.combatReceipt.events.at(-1).power,'Veilstep');
 assert.equal(outfitVeilUntil(s),ready+1+veilRules.duration);
 const next=structuredClone(s);next.wardrobe.outfits[0].jacket='amberJacket';next.outfitMagic.veilReadyAt=0;
 const saved=protectFishingState(s,next);
 assert.equal(saved.outfitMagic.veilUntil,0);assert.equal(saved.outfitMagic.veilReadyAt,ready+1+veilRules.cooldown);
});

test('room snapshots hide the cloaked avatar, familiar and trail until the expiry alarm',async()=>{
 const packets=[],alarms=[],socket={send:data=>packets.push(JSON.parse(data))};
 const room=new SharedRoom({getWebSockets:()=>[],blockConcurrencyWhile:run=>run(),storage:{get:async()=>[],setAlarm:async at=>alarms.push(at)}},{});
 const at=Date.now()+10000;
 const hidden={id:'hidden',name:'Cloaked',veilUntil:at,familiar:'fox',trail:{until:at+1000,route:['creek']}};
 room.sessions.set(socket,{id:'observer'});room.sessions.set({send(){}},hidden);
 room.snapshot();await room.scheduleVeilExpiry();
 assert.deepEqual(packets.at(-1).players.map(peer=>peer.id),['observer']);
 assert.deepEqual(packets.at(-1).trails,[]);assert.deepEqual(alarms,[at]);
 hidden.veilUntil=Date.now()-1;await room.alarm();
 assert.deepEqual(packets.at(-1).players.map(peer=>peer.id),['observer','hidden']);
 assert.equal(packets.at(-1).players[1].familiar,'fox');
});
