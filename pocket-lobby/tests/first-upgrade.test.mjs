import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeState} from '../server/player-state.mjs';
test('first upgrade goal and sale receipt survive character save normalization',()=>{
 const journey={unlocked:true,choice:'fishing',complete:false,sale:{name:'Silverfin',quantity:3,gold:15}};
 const state=normalizeState({firstUpgrade:journey});assert.deepEqual(state.firstUpgrade,journey);
 const reload=normalizeState({...state,firstUpgrade:{...journey,complete:true}});assert.equal(reload.firstUpgrade.complete,true);assert.equal(reload.firstUpgrade.choice,'fishing');
});
test('reset starts without a first-sale receipt or upgrade goal',()=>{
 assert.deepEqual(normalizeState({}).firstUpgrade,{unlocked:false,choice:null,complete:false,sale:null});
});
test('upgrade saves reject invalid goals and sale totals',()=>{
 const base={unlocked:true,choice:'combat',complete:false,sale:{name:'Boar Meat',quantity:1,gold:30}};
 assert.throws(()=>normalizeState({firstUpgrade:{...base,choice:'unknown'}}),/Invalid first upgrade/);
 assert.throws(()=>normalizeState({firstUpgrade:{...base,sale:{...base.sale,gold:-30}}}),/Invalid first sale/);
 assert.throws(()=>normalizeState({firstUpgrade:{...base,sale:{...base.sale,quantity:1.5}}}),/Invalid first sale/);
});

test('an Oak Rod trial survives a save until the catch clears it',()=>{
 const firstUpgrade={unlocked:true,choice:'fishing',complete:true,sale:null,oakTrialPending:true};
 const pending=normalizeState({firstUpgrade});
 assert.equal(pending.firstUpgrade.oakTrialPending,true);
 const finished=normalizeState({...pending,firstUpgrade:{...firstUpgrade,oakTrialPending:false}});
 assert.equal(finished.firstUpgrade.oakTrialPending,undefined);
 assert.equal(normalizeState({firstUpgrade:{...firstUpgrade,choice:'combat'}}).firstUpgrade.oakTrialPending,undefined);
});
