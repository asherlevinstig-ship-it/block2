import test from 'node:test';
import assert from 'node:assert/strict';
import {autoPresenceDelay} from '../public/auto-mode.js';

test('hidden tabs pause polling while visible Auto polls near the next timed event',()=>{
 const now=100000;
 const state={location:'pond',autoPresence:{room:'pond',moving:false},plan:{source:'rules',fishingWork:{cast:{landAt:now+60000}}}};
 assert.equal(autoPresenceDelay(state,now,true),null);
 assert.equal(autoPresenceDelay(state,now,false),20000);
 assert.equal(autoPresenceDelay(state,now+57000,false),4150);
 assert.equal(autoPresenceDelay(state,now+61000,false),2000);
 state.autoPresence.moving=true;
 assert.equal(autoPresenceDelay(state,now,false),2000);
 state.autoPresence.walk={endsAt:now+3400};
 assert.equal(autoPresenceDelay(state,now,false),3550);
 assert.equal(autoPresenceDelay(state,now+3400,false),250);
 delete state.autoPresence.walk;
 state.plan.activeHunt={};
 assert.equal(autoPresenceDelay(state,now,false),250);
 assert.equal(autoPresenceDelay(state,now,true),null);
});
