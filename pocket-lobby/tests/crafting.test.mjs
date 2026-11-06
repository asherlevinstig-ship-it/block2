import test from 'node:test';
import assert from 'node:assert/strict';
import {craftFurniture,isAtWorkbench,craftingRecipes} from '../public/crafting.js';
import {normalizeState} from '../server/player-state.mjs';

const maker=()=>normalizeState({location:'logging',position:{x:5,y:4},woodcutting:{timber:30}});
test('recipes consume the listed timber and add distinct furniture to inventory',()=>{
  const state=maker(),gold=state.credits;
  for(const [id,recipe] of Object.entries(craftingRecipes)){
    const before=state.woodcutting.timber,result=craftFurniture(state,id);
    assert.equal(before-state.woodcutting.timber,recipe.cost);assert.equal(result.name,recipe.name);assert.equal(state.ownedFurniture[id],1);
  }
  assert.equal(state.woodcutting.timber,0);assert.equal(state.credits,gold);
  const before=JSON.stringify(state);assert.throws(()=>craftFurniture(state,'woodStool'),/timber/);assert.equal(JSON.stringify(state),before);
  assert.deepEqual(normalizeState(state).ownedFurniture,state.ownedFurniture);
});
test('crafting requires a nearby workbench and rejects unknown recipes or active jobs',()=>{
  for(const position of [{x:4,y:3},{x:5,y:2},{x:6,y:2},{x:7,y:3},{x:5,y:4},{x:6,y:4}])assert(isAtWorkbench({location:'logging',position}));
  for(const state of [{...maker(),location:'home'},{...maker(),position:{x:1,y:5}},{...maker(),plan:{kind:'woodcutting'}}]){
    assert.throws(()=>craftFurniture(state,'woodStool'),/workbench/);assert.equal(state.woodcutting.timber,30);
  }
  assert.throws(()=>craftFurniture(maker(),'constructor'),/recipe/);
});
test('crafted furniture placements and rotations survive server normalization',()=>{
  const state=maker();for(const id of Object.keys(craftingRecipes))craftFurniture(state,id);
  state.homeFurniture=[{id:1,type:'woodStool',x:2,y:2,rot:0},{id:2,type:'woodTable',x:4,y:2,rot:2},{id:3,type:'bookcase',x:6,y:2,rot:1}];
  const restored=normalizeState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored.homeFurniture,state.homeFurniture);assert.equal(restored.ownedFurniture.bookcase,1);
});
