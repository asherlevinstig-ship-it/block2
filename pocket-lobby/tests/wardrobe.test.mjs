import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWardrobe,outfitAppearance,createSavedOutfit,addClothingToOutfit,wearSavedOutfit,clothingCatalog} from '../public/wardrobe.js';
import {normalizeState} from '../server/player-state.mjs';
import {publicPeer} from '../server/shared-room.mjs';

test('existing appearances migrate into an owned-clothing outfit without changing their look',()=>{
  for(let index=0;index<5;index++){
    const state=normalizeState({avatar:{name:'Ash',outfit:index,hair:2}});
    assert.equal(state.avatar.outfit,index);assert.equal(state.avatar.hair,2);assert.equal(state.avatar.trousers,0);assert.equal(state.avatar.boots,0);
    assert.equal(state.wardrobe.outfits[0].name,'Everyday');assert.equal(state.wardrobe.owned.length,Object.keys(clothingCatalog).length);
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
