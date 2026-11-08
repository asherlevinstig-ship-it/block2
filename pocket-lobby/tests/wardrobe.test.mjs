import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWardrobe,outfitAppearance,createSavedOutfit,addClothingToOutfit,wearSavedOutfit,clothingCatalog,clothingSets,formalClothingIds,wearClothingSet} from '../public/wardrobe.js';
import {normalizeState} from '../server/player-state.mjs';
import {publicPeer} from '../server/shared-room.mjs';

test('existing appearances migrate into an owned-clothing outfit without changing their look',()=>{
  for(let index=0;index<5;index++){
    const state=normalizeState({avatar:{name:'Ash',outfit:index,hair:2}});
    assert.equal(state.avatar.outfit,index);assert.equal(state.avatar.hair,2);assert.equal(state.avatar.trousers,0);assert.equal(state.avatar.boots,0);
    assert.equal(state.wardrobe.outfits[0].name,'Everyday');assert.equal(state.wardrobe.owned.length,Object.values(clothingCatalog).filter(item=>!item.price).length);
    assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(state))).wardrobe,state.wardrobe);
  }
});
test('clothing builds independent saved outfits, and wearing applies all three slots',()=>{
  const wardrobe=normalizeWardrobe(undefined,{outfit:1});
  const fishing=createSavedOutfit(wardrobe,'Fishing trip');
  addClothingToOutfit(wardrobe,fishing.id,'sageJacket');addClothingToOutfit(wardrobe,fishing.id,'forestTrousers');addClothingToOutfit(wardrobe,fishing.id,'leatherBoots');
  assert.equal(wardrobe.active,'outfit-1');assert.equal(wardrobe.outfits[0].jacket,'skyJacket');
  wearSavedOutfit(wardrobe,fishing.id);
  assert.deepEqual(outfitAppearance(wardrobe,{name:'Ash',hair:3}),{name:'Ash',hair:3,outfit:3,trousers:2,boots:1});
  const saved=normalizeState({wardrobe,avatar:{name:'Ash',outfit:0,hair:3}});
  assert.equal(saved.avatar.outfit,3);assert.equal(saved.avatar.trousers,2);assert.equal(saved.avatar.boots,1);
  assert.equal(normalizeState(JSON.parse(JSON.stringify(saved))).wardrobe.active,fishing.id);
  const peer=publicPeer({id:'public-id',name:'Ash',...saved.avatar});assert.equal(peer.trousers,2);assert.equal(peer.boots,1);
});
test('saved outfits reject unknown clothes, wrong slots, unowned pieces and duplicate IDs',()=>{
  const wardrobe=normalizeWardrobe();
  for(const mutate of [w=>w.outfits[0].jacket='missing',w=>w.outfits[0].jacket='canvasBoots',w=>w.owned.splice(w.owned.indexOf('amberJacket'),1),w=>w.active='missing',w=>w.outfits.push({...w.outfits[0]}),w=>w.outfits[0].name=' ']){
    const invalid=structuredClone(wardrobe);mutate(invalid);assert.throws(()=>normalizeWardrobe(invalid));
  }
  assert.throws(()=>addClothingToOutfit(wardrobe,'outfit-1','missing'));assert.throws(()=>wearSavedOutfit(wardrobe,'missing'));
});
test('outfit creation is capped and copies the worn look without sharing mutable records',()=>{
  const wardrobe=normalizeWardrobe();for(let i=2;i<=6;i++)createSavedOutfit(wardrobe,'Look '+i);
  assert.throws(()=>createSavedOutfit(wardrobe,'One too many'));assert.throws(()=>createSavedOutfit(normalizeWardrobe(),'x'.repeat(25)));
  addClothingToOutfit(wardrobe,'outfit-2','roseJacket');assert.equal(wardrobe.outfits[0].jacket,'amberJacket');
});


test('older wardrobes gain formal clothing once while keeping their saved outfits and worn look',()=>{
 const old=normalizeWardrobe(undefined,{outfit:3});delete old.catalogVersion;old.owned=old.owned.filter(id=>!formalClothingIds.includes(id));
 const before=structuredClone(old.outfits),migrated=normalizeWardrobe(old);
 assert.deepEqual(migrated.outfits,before);assert.equal(migrated.active,old.active);assert.equal(migrated.catalogVersion,2);
 assert(formalClothingIds.every(id=>migrated.owned.includes(id)));assert.deepEqual(normalizeWardrobe(migrated),migrated);
});
test('formal sets create matching looks, equip them, reuse existing sets and survive server saves',()=>{
 const w=normalizeWardrobe(),original=structuredClone(w.outfits[0]);
 const suit=wearClothingSet(w,'tailoredSuit');assert.equal(suit.jacket,'tailoredJacket');assert.equal(suit.trousers,'suitTrousers');
 assert.equal(outfitAppearance(w).outfit,5);assert.equal(outfitAppearance(w).trousers,3);assert.equal(outfitAppearance(w).boots,3);
 assert.equal(wearClothingSet(w,'tailoredSuit').id,suit.id);assert.equal(w.outfits.length,2);
 wearClothingSet(w,'moonlitDress');assert.equal(outfitAppearance(w).outfit,6);assert.equal(clothingCatalog.moonlitDress.dress,true);
 assert.deepEqual(w.outfits[0],original);
 const s=normalizeState({wardrobe:w,avatar:{name:'Formal',outfit:6,hair:0}});assert.equal(s.avatar.outfit,6);assert.equal(publicPeer({...s.avatar,id:'peer'}).outfit,6);
 assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(s))).wardrobe,w);
});
test('formal sets respect outfit capacity and never overwrite a saved look',()=>{
 const w=normalizeWardrobe();for(let i=2;i<=6;i++)createSavedOutfit(w,'Look '+i);
 const before=structuredClone(w);assert.throws(()=>wearClothingSet(w,'tailoredSuit'),/six/);assert.deepEqual(w,before);
 assert.throws(()=>wearClothingSet(w,'unknown'),/Choose/);
 const locked=normalizeWardrobe();locked.owned=locked.owned.filter(id=>id!=='polishedShoes');assert.throws(()=>wearClothingSet(locked,'tailoredSuit'),/need all/);
});


test('ranger and rogue sets are earned clothing with independent hood, leg and boot slots',()=>{
 const w=normalizeWardrobe();for(const id of ['ranger','rogue']){const set=clothingSets[id];assert.equal(set.shop,true);assert.throws(()=>wearClothingSet(w,id),/need all/);w.owned.push(...['jacket','trousers','boots'].map(slot=>set[slot]));const look=wearClothingSet(w,id);assert.equal(look.name,set.name);assert.equal(outfitAppearance(w).outfit,id==='ranger'?11:12);}
 const s=normalizeState({avatar:{name:'Ranger',outfit:12,hair:0},wardrobe:w});assert.equal(s.avatar.outfit,12);assert.deepEqual(normalizeState(JSON.parse(JSON.stringify(s))).wardrobe,w);
});
