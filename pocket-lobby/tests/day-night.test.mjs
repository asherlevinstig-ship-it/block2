import test from 'node:test';
import assert from 'node:assert/strict';
import {DAY_MS,dayPhase,dayNightFor,syncDayClock} from '../public/day-night.js';

const at=fraction=>dayPhase(fraction*DAY_MS);

test('a game day runs dawn, day, dusk and night on the 20-minute weather clock',()=>{
 assert.equal(DAY_MS,5*240000);
 assert.equal(at(0).name,'Dawn');assert.equal(at(.25).name,'Day');assert.equal(at(.58).name,'Dusk');assert.equal(at(.8).name,'Night');
 assert.equal(at(.25).light,1);assert.equal(at(.8).light,0);assert.equal(at(.25).warm,0);assert.equal(at(.8).warm,0);
 assert(at(0).warm>.99&&at(.58).warm>.99);
 assert.deepEqual(dayPhase(-DAY_MS*.75),dayPhase(DAY_MS*.25));
});

test('light and warmth change smoothly, including across midnight into dawn',()=>{
 let previous=at(0);
 for(let i=1;i<=2000;i++){
  const next=at(i/2000%1);
  assert(Math.abs(next.light-previous.light)<.02,'light jumps at '+i);
  assert(Math.abs(next.warm-previous.warm)<.03,'warmth jumps at '+i);
  assert(next.light>=0&&next.light<=1&&next.warm>=0&&next.warm<=1);
  previous=next;
 }
});

test('only open-air maps follow the cycle, and they share the synchronised clock',()=>{
 for(const room of ['outside','trail','pond','willowbank','quarry','beaconwatch'])assert(dayNightFor(room,0),room);
 for(const room of ['home','hub','store','roots','crystaldeep','depthsVault','millCellar','emberwood','nowhere'])assert.equal(dayNightFor(room,0),null,room);
 syncDayClock(Date.now()+DAY_MS*.8-Date.now()%DAY_MS);
 assert.equal(dayNightFor('outside').name,'Night');
 syncDayClock(Date.now());
});
